import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";

const MAX_PROMPT_CHARS = 4000;
const MAX_CONTEXT_NODES = 80;
const MAX_CONTEXT_EDGES = 140;
const ALLOWED_TIERS = new Set([1, 2, 3, 4]);

function clampTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.round(n);
  return ALLOWED_TIERS.has(rounded) ? rounded : 1;
}

function normalizePrompt(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, MAX_PROMPT_CHARS);
}

function limitArray(input, max) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, max);
}

function sanitizeNode(node) {
  if (!node || typeof node !== "object") return null;
  return {
    id: String(node.id ?? ""),
    text: String(node.text ?? "").slice(0, 600),
    type: node.type === "stargate" ? "stargate" : "normal",
    x: Number.isFinite(node.x) ? node.x : 0,
    y: Number.isFinite(node.y) ? node.y : 0,
  };
}

function sanitizeEdge(edge) {
  if (!edge || typeof edge !== "object") return null;
  return {
    id: String(edge.id ?? ""),
    a: String(edge.a ?? ""),
    b: String(edge.b ?? ""),
    label: String(edge?.props?.label ?? edge.label ?? "").slice(0, 80),
    kind: String(edge?.props?.kind ?? edge.kind ?? "context"),
    strength: Number.isFinite(edge?.props?.strength)
      ? edge.props.strength
      : Number.isFinite(edge.strength)
        ? edge.strength
        : 1,
  };
}

function sanitizeContext(context) {
  if (!context || typeof context !== "object") return {};

  const nodes = limitArray(context.nodes, MAX_CONTEXT_NODES)
    .map(sanitizeNode)
    .filter(Boolean);

  const edges = limitArray(context.edges, MAX_CONTEXT_EDGES)
    .map(sanitizeEdge)
    .filter(Boolean);

  const topology =
    context.topology && typeof context.topology === "object"
      ? {
          routing: String(context.topology.routing ?? "fast"),
          maxKappa: Number.isFinite(context.topology.maxKappa)
            ? context.topology.maxKappa
            : 0,
          sccCount: Number.isFinite(context.topology.sccCount)
            ? context.topology.sccCount
            : 0,
        }
      : null;

  return {
    nodes,
    edges,
    topology,
    activePlaneId: context.activePlaneId ? String(context.activePlaneId) : null,
    rootPlaneId: context.rootPlaneId ? String(context.rootPlaneId) : null,
  };
}

function extractUsage(result) {
  const usage = result?.usage || result?.meta?.usage || {};
  return {
    input: Number(usage.input_tokens ?? usage.input ?? 0) || 0,
    output: Number(usage.output_tokens ?? usage.output ?? 0) || 0,
  };
}

function countGenerated(result) {
  const nodes =
    result?.nodes ||
    result?.generated?.nodes ||
    result?.graph?.nodes ||
    result?.synthesis?.nodes ||
    [];
  const edges =
    result?.edges ||
    result?.generated?.edges ||
    result?.graph?.edges ||
    result?.synthesis?.edges ||
    [];

  return {
    nodes: Array.isArray(nodes) ? nodes.length : 0,
    edges: Array.isArray(edges) ? edges.length : 0,
  };
}

async function getSessionUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
  const startedAt = Date.now();
  const supabase = event.locals?.supabase ?? createSupabaseServerClient(event);

  const user = await getSessionUser(supabase);
  if (!user) {
    return json(
      { ok: false, error: "Unauthorized. Sign in is required." },
      { status: 401 },
    );
  }

  let body;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const prompt = normalizePrompt(body?.prompt);
  if (!prompt) {
    return json(
      { ok: false, error: "Prompt is required." },
      { status: 400 },
    );
  }

  const tier = clampTier(body?.tier);
  const workspaceId = body?.workspaceId ? String(body.workspaceId) : null;
  const graphId = body?.graphId ? String(body.graphId) : null;
  const planeId = body?.planeId ? String(body.planeId) : null;
  const requestId =
    body?.requestId?.toString?.() ||
    `ai_${Math.random().toString(36).slice(2, 10)}`;

  const context = sanitizeContext(body?.context);

  const invokePayload = {
    requestId,
    prompt,
    tier,
    workspaceId,
    graphId,
    planeId,
    context,
    userId: user.id,
    source: "sveltekit:/api/ai",
  };

  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: invokePayload,
  });

  if (error) {
    return json(
      {
        ok: false,
        error: "AI backend unavailable.",
        details: error.message || "Function invocation failed.",
      },
      { status: 502 },
    );
  }

  const synthesis = data?.synthesis ?? data?.result ?? data;
  if (!synthesis) {
    return json(
      { ok: false, error: "AI backend returned empty response." },
      { status: 502 },
    );
  }

  const usage = extractUsage(synthesis);
  const generated = countGenerated(synthesis);
  const latencyMs = Date.now() - startedAt;

  // Best-effort logging; don't fail request if this insert fails.
  if (workspaceId) {
    const model =
      synthesis?.model ||
      (tier === 1
        ? process.env.ANTHROPIC_FAST_MODEL || "claude-3-5-haiku-latest"
        : process.env.ANTHROPIC_DEFAULT_MODEL || "claude-3-5-sonnet-latest");

    supabase.from("ai_generations").insert({
      workspace_id: workspaceId,
      graph_id: graphId,
      plane_id: planeId,
      user_id: user.id,
      prompt,
      model,
      tier,
      request_json: invokePayload,
      response_json: synthesis,
      tokens_input: usage.input,
      tokens_output: usage.output,
      nodes_spawned: generated.nodes,
      edges_spawned: generated.edges,
      latency_ms: latencyMs,
    }).then(() => {}).catch(() => {});
  }

  return json({
    ok: true,
    requestId,
    synthesis,
    meta: {
      tier,
      latencyMs,
      usage,
      generated,
    },
  });
}
