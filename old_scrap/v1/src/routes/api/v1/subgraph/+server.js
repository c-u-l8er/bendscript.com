// ProjectAmp2/bendscript.com/src/routes/api/v1/subgraph/+server.js
import { json } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$lib/supabase/server";
import { authenticateApiKey, hasScope } from "$lib/server/apiAuth";
import { getSubgraph } from "$lib/server/graphApi";

export const prerender = false;

const MAX_DEPTH = 6;

function asString(value) {
  return String(value ?? "").trim();
}

function parseDepth(value, fallback = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX_DEPTH, Math.floor(n)));
}

function parseEdgeKinds(value) {
  if (Array.isArray(value)) {
    const kinds = value.map((v) => asString(v).toLowerCase()).filter(Boolean);
    return kinds.length ? kinds : null;
  }

  const raw = asString(value);
  if (!raw) return null;

  const kinds = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return kinds.length ? kinds : null;
}

async function parseRequestInput(event) {
  if (event.request.method === "GET") {
    const q = event.url.searchParams;
    return {
      workspaceId: asString(q.get("workspace_id") || q.get("workspaceId")),
      graphId: asString(q.get("graph_id") || q.get("graphId")),
      nodeId: asString(q.get("node_id") || q.get("nodeId")),
      depth: parseDepth(q.get("depth"), 2),
      edgeKinds: parseEdgeKinds(q.get("edge_kinds") || q.get("edgeKinds")),
    };
  }

  let body = {};
  try {
    body = await event.request.json();
  } catch {
    body = {};
  }

  return {
    workspaceId: asString(body.workspace_id || body.workspaceId),
    graphId: asString(body.graph_id || body.graphId),
    nodeId: asString(body.node_id || body.nodeId),
    depth: parseDepth(body.depth, 2),
    edgeKinds: parseEdgeKinds(body.edge_kinds || body.edgeKinds),
  };
}

function canReadGraph(scopes = []) {
  return (
    hasScope(scopes, "*") ||
    hasScope(scopes, "read") ||
    hasScope(scopes, "graph:read")
  );
}

async function handleSubgraph(event) {
  const input = await parseRequestInput(event);

  if (!input.graphId) {
    return json(
      { ok: false, error: "`graph_id` (or `graphId`) is required." },
      { status: 400 },
    );
  }

  if (!input.nodeId) {
    return json(
      { ok: false, error: "`node_id` (or `nodeId`) is required." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const auth = await authenticateApiKey({
    request: event.request,
    supabase,
    requiredScopes: [],
    workspaceId: input.workspaceId || null,
    route: event.url.pathname,
    requestId: event.request.headers.get("x-request-id") || null,
  });

  if (!auth.ok) {
    return json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status || 401 },
    );
  }

  if (!canReadGraph(auth.auth?.scopes || [])) {
    return json(
      {
        ok: false,
        error:
          "Insufficient API key scope. Required one of: `read`, `graph:read`, or `*`.",
      },
      { status: 403 },
    );
  }

  const workspaceId = auth.auth.workspaceId;

  try {
    const subgraph = await getSubgraph({
      client: supabase,
      workspaceId,
      graphId: input.graphId,
      nodeId: input.nodeId,
      depth: input.depth,
      edgeKinds: input.edgeKinds,
    });

    return json({
      ok: true,
      workspace_id: workspaceId,
      graph_id: input.graphId,
      root_node_id: input.nodeId,
      depth: input.depth,
      edge_kinds: input.edgeKinds,
      nodes: subgraph.nodes || [],
      edges: subgraph.edges || [],
      meta: {
        node_count: Array.isArray(subgraph.nodes) ? subgraph.nodes.length : 0,
        edge_count: Array.isArray(subgraph.edges) ? subgraph.edges.length : 0,
      },
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err?.message || "Failed to retrieve subgraph.",
      },
      { status: 500 },
    );
  }
}

export const GET = handleSubgraph;
export const POST = handleSubgraph;
