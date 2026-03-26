import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { authenticateApiKey, hasScope } from "$lib/server/apiAuth";

const ALLOWED_EDGE_KINDS = new Set([
  "context",
  "causal",
  "temporal",
  "associative",
  "user",
]);

const ALLOWED_NODE_TYPES = new Set(["normal", "stargate"]);
const DEFAULT_MAX_NODES = 12;
const DEFAULT_MAX_EDGES = 24;
const DEFAULT_TIER = 3;

function toInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function trimText(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeNode(raw, idx) {
  const text = trimText(raw?.text ?? raw?.label ?? `Node ${idx + 1}`, 280);
  const type = ALLOWED_NODE_TYPES.has(raw?.type) ? raw.type : "normal";

  if (!text) return null;

  return {
    ref: String(raw?.id ?? raw?.ref ?? `n_${idx + 1}`),
    text,
    type,
  };
}

function normalizeEdge(raw) {
  const kind = ALLOWED_EDGE_KINDS.has(raw?.kind) ? raw.kind : "context";
  const label = trimText(raw?.label ?? "", 80);
  const strength = toInt(raw?.strength, 2, 1, 5);

  return {
    from: raw?.from ?? raw?.a ?? raw?.from_ref ?? raw?.source ?? null,
    to: raw?.to ?? raw?.b ?? raw?.to_ref ?? raw?.target ?? null,
    label,
    kind,
    strength,
  };
}

function dedupeNodes(nodes) {
  const seen = new Set();
  const out = [];

  for (const node of nodes) {
    const key = node.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(node);
  }

  return out;
}

function canWrite(scopes = []) {
  return (
    hasScope(scopes, "*") ||
    hasScope(scopes, "write") ||
    hasScope(scopes, "graph:write") ||
    hasScope(scopes, "build:write")
  );
}

function buildExtractionPrompt({ text, maxNodes, maxEdges }) {
  return [
    "Convert the source text into a compact BendScript graph extraction.",
    "Return STRICT JSON only (no markdown, no code fences).",
    "Schema:",
    "{",
    '  "summary": "string",',
    '  "nodes": [{ "id": "n1", "text": "string", "type": "normal|stargate" }],',
    '  "edges": [{ "from": "n1", "to": "n2", "label": "string", "kind": "context|causal|temporal|associative|user", "strength": 1-5 }]',
    "}",
    `Limits: max ${maxNodes} nodes, max ${maxEdges} edges.`,
    "Use short edge labels and avoid duplicate nodes.",
    "",
    "SOURCE TEXT:",
    text,
  ].join("\n");
}

function resolvePlaneId(graphRow, requestedPlaneId) {
  if (requestedPlaneId) return requestedPlaneId;
  return graphRow?.root_plane_id ?? null;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
    },
  });
}

export async function POST(event) {
  const supabase = event.locals?.supabase ?? createSupabaseServerClient(event);
  const requestId =
    event.request.headers.get("x-request-id") ||
    `req_${Math.random().toString(36).slice(2, 10)}`;

  let body;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { ok: false, error: "Invalid JSON body.", request_id: requestId },
      { status: 400 },
    );
  }

  const workspaceId = trimText(body?.workspace_id ?? body?.workspaceId, 120);
  const graphId = trimText(body?.graph_id ?? body?.graphId, 120);
  const requestedPlaneId = trimText(body?.plane_id ?? body?.planeId, 120) || null;
  const inputText = trimText(body?.text, 12000);
  const dryRun = Boolean(body?.dry_run ?? body?.dryRun ?? false);
  const maxNodes = toInt(body?.max_nodes ?? body?.maxNodes, DEFAULT_MAX_NODES, 1, 50);
  const maxEdges = toInt(body?.max_edges ?? body?.maxEdges, DEFAULT_MAX_EDGES, 0, 100);
  const tier = toInt(body?.tier, DEFAULT_TIER, 1, 4);

  if (!workspaceId || !graphId || !inputText) {
    return json(
      {
        ok: false,
        error: "`workspace_id`, `graph_id`, and `text` are required.",
        request_id: requestId,
      },
      { status: 400 },
    );
  }

  const auth = await authenticateApiKey({
    request: event.request,
    supabase,
    requiredScopes: [],
    workspaceId,
    route: event.url.pathname,
    requestId,
  });

  if (!auth.ok) {
    return json(
      { ok: false, error: auth.error || "Unauthorized.", request_id: requestId },
      { status: auth.status || 401 },
    );
  }

  if (!canWrite(auth.auth?.scopes || [])) {
    return json(
      {
        ok: false,
        error: "API key lacks write scope.",
        request_id: requestId,
      },
      { status: 403 },
    );
  }

  const { data: graphRow, error: graphErr } = await supabase
    .from("graphs")
    .select("id, workspace_id, root_plane_id, name")
    .eq("id", graphId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (graphErr) {
    return json(
      { ok: false, error: `Failed to load graph: ${graphErr.message}`, request_id: requestId },
      { status: 500 },
    );
  }

  if (!graphRow) {
    return json(
      { ok: false, error: "Graph not found for workspace.", request_id: requestId },
      { status: 404 },
    );
  }

  const planeId = resolvePlaneId(graphRow, requestedPlaneId);
  if (!planeId) {
    return json(
      { ok: false, error: "No target plane available. Provide `plane_id`.", request_id: requestId },
      { status: 400 },
    );
  }

  const prompt = buildExtractionPrompt({
    text: inputText,
    maxNodes,
    maxEdges,
  });

  const aiPayload = {
    requestId: `build_from_text_${Date.now().toString(36)}`,
    workspaceId,
    graphId,
    planeId,
    prompt,
    tier,
    context: {
      activePlaneId: planeId,
      mode: "build_from_text",
      limits: { maxNodes, maxEdges },
    },
    source: "api:v1/build-from-text",
  };

  const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-proxy", {
    body: aiPayload,
  });

  if (aiError) {
    return json(
      {
        ok: false,
        error: "AI proxy invocation failed.",
        details: aiError.message || "Unknown AI proxy error.",
        request_id: requestId,
      },
      { status: 502 },
    );
  }

  const textOutput =
    aiData?.data?.text ??
    aiData?.synthesis?.text ??
    aiData?.synthesis?.primary_response_text ??
    aiData?.synthesis ??
    aiData?.result?.text ??
    aiData?.result ??
    null;

  const parsed = parseMaybeJson(textOutput) || parseMaybeJson(aiData?.data) || parseMaybeJson(aiData);

  if (!parsed || !Array.isArray(parsed.nodes)) {
    return json(
      {
        ok: false,
        error: "AI proxy returned non-parseable graph JSON.",
        raw: typeof textOutput === "string" ? textOutput.slice(0, 800) : null,
        request_id: requestId,
      },
      { status: 502 },
    );
  }

  const normalizedNodes = dedupeNodes(
    parsed.nodes
      .slice(0, maxNodes)
      .map((n, i) => normalizeNode(n, i))
      .filter(Boolean),
  );

  const normalizedEdges = (Array.isArray(parsed.edges) ? parsed.edges : [])
    .slice(0, maxEdges)
    .map(normalizeEdge);

  if (normalizedNodes.length === 0) {
    return json(
      {
        ok: true,
        request_id: requestId,
        workspace_id: workspaceId,
        graph_id: graphId,
        plane_id: planeId,
        summary: trimText(parsed.summary, 500),
        generated: { nodes: [], edges: [] },
        persisted: { nodes: 0, edges: 0 },
        dry_run: dryRun,
      },
      { status: 200 },
    );
  }

  const refToIndex = new Map();
  normalizedNodes.forEach((n, i) => {
    refToIndex.set(n.ref, i);
    refToIndex.set(String(i), i);
    refToIndex.set(String(i + 1), i);
    refToIndex.set(n.text.toLowerCase(), i);
  });

  const edgeDrafts = normalizedEdges
    .map((e) => {
      const fromRef = e.from == null ? null : String(e.from).toLowerCase();
      const toRef = e.to == null ? null : String(e.to).toLowerCase();

      const fromIdx = fromRef != null ? refToIndex.get(fromRef) : undefined;
      const toIdx = toRef != null ? refToIndex.get(toRef) : undefined;

      if (fromIdx == null || toIdx == null || fromIdx === toIdx) return null;

      return {
        fromIdx,
        toIdx,
        label: e.label,
        kind: e.kind,
        strength: e.strength,
      };
    })
    .filter(Boolean);

  if (dryRun) {
    return json({
      ok: true,
      request_id: requestId,
      workspace_id: workspaceId,
      graph_id: graphId,
      plane_id: planeId,
      summary: trimText(parsed.summary, 500),
      generated: {
        nodes: normalizedNodes,
        edges: edgeDrafts,
      },
      persisted: { nodes: 0, edges: 0 },
      dry_run: true,
    });
  }

  const nodeInsertRows = normalizedNodes.map((n) => ({
    workspace_id: workspaceId,
    graph_id: graphId,
    plane_id: planeId,
    text: n.text,
    type: n.type,
    x: 0,
    y: 0,
    pinned: false,
    metadata: {
      source: "build-from-text",
      request_id: requestId,
    },
  }));

  const { data: insertedNodes, error: nodeInsertErr } = await supabase
    .from("nodes")
    .insert(nodeInsertRows)
    .select("id, text, type");

  if (nodeInsertErr) {
    return json(
      {
        ok: false,
        error: `Failed to persist nodes: ${nodeInsertErr.message}`,
        request_id: requestId,
      },
      { status: 500 },
    );
  }

  const nodeIds = (insertedNodes || []).map((n) => n.id);
  const edgeInsertRows = edgeDrafts
    .map((e) => {
      const a = nodeIds[e.fromIdx];
      const b = nodeIds[e.toIdx];
      if (!a || !b || a === b) return null;

      return {
        workspace_id: workspaceId,
        graph_id: graphId,
        plane_id: planeId,
        node_a: a,
        node_b: b,
        label: e.label,
        kind: e.kind,
        strength: e.strength,
        metadata: {
          source: "build-from-text",
          request_id: requestId,
        },
      };
    })
    .filter(Boolean);

  let insertedEdges = [];
  if (edgeInsertRows.length) {
    const { data: edgesData, error: edgeInsertErr } = await supabase
      .from("edges")
      .insert(edgeInsertRows)
      .select("id, node_a, node_b, label, kind, strength");

    if (edgeInsertErr) {
      return json(
        {
          ok: false,
          error: `Nodes were created, but edge insert failed: ${edgeInsertErr.message}`,
          request_id: requestId,
          partial: {
            created_nodes: insertedNodes?.length || 0,
          },
        },
        { status: 500 },
      );
    }

    insertedEdges = edgesData || [];
  }

  return json({
    ok: true,
    request_id: requestId,
    workspace_id: workspaceId,
    graph_id: graphId,
    plane_id: planeId,
    summary: trimText(parsed.summary, 500),
    generated: {
      nodes: normalizedNodes,
      edges: edgeDrafts,
    },
    persisted: {
      nodes: insertedNodes?.length || 0,
      edges: insertedEdges.length,
      node_ids: (insertedNodes || []).map((n) => n.id),
      edge_ids: insertedEdges.map((e) => e.id),
    },
    dry_run: false,
  });
}
