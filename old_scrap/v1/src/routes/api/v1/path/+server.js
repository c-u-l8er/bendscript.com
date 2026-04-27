import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { authenticateApiKey } from "$lib/server/apiAuth";
import { traversePath } from "$lib/server/graphApi";

const ROUTE = "/api/v1/path";

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function asString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function asInt(value, { min = 1, max = 10, fallback = 4 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

function asEdgeKinds(value) {
  if (Array.isArray(value)) {
    const out = value.map((v) => asString(v)).filter(Boolean);
    return out.length ? out : null;
  }

  const raw = asString(value);
  if (!raw) return null;

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.length ? parts : null;
}

function parseQueryPayload(url) {
  const sp = url.searchParams;

  return {
    workspaceId: pick(
      Object.fromEntries(sp.entries()),
      ["workspace_id", "workspaceId"],
      "",
    ),
    graphId: pick(Object.fromEntries(sp.entries()), ["graph_id", "graphId"], ""),
    fromNodeId: pick(
      Object.fromEntries(sp.entries()),
      ["from_node_id", "fromNodeId"],
      null,
    ),
    toNodeId: pick(
      Object.fromEntries(sp.entries()),
      ["to_node_id", "toNodeId"],
      null,
    ),
    fromQuery: pick(
      Object.fromEntries(sp.entries()),
      ["from_query", "fromQuery"],
      null,
    ),
    toQuery: pick(
      Object.fromEntries(sp.entries()),
      ["to_query", "toQuery"],
      null,
    ),
    maxHops: asInt(
      pick(Object.fromEntries(sp.entries()), ["max_hops", "maxHops"], 4),
      { min: 1, max: 10, fallback: 4 },
    ),
    edgeKinds: asEdgeKinds(
      pick(Object.fromEntries(sp.entries()), ["edge_kinds", "edgeKinds"], null),
    ),
    planeId: pick(Object.fromEntries(sp.entries()), ["plane_id", "planeId"], null),
  };
}

function parseJsonPayload(body) {
  return {
    workspaceId: pick(body, ["workspace_id", "workspaceId"], ""),
    graphId: pick(body, ["graph_id", "graphId"], ""),
    fromNodeId: pick(body, ["from_node_id", "fromNodeId"], null),
    toNodeId: pick(body, ["to_node_id", "toNodeId"], null),
    fromQuery: pick(body, ["from_query", "fromQuery"], null),
    toQuery: pick(body, ["to_query", "toQuery"], null),
    maxHops: asInt(pick(body, ["max_hops", "maxHops"], 4), {
      min: 1,
      max: 10,
      fallback: 4,
    }),
    edgeKinds: asEdgeKinds(pick(body, ["edge_kinds", "edgeKinds"], null)),
    planeId: pick(body, ["plane_id", "planeId"], null),
  };
}

function validatePayload(payload) {
  const workspaceId = asString(payload.workspaceId);
  const graphId = asString(payload.graphId);
  const fromNodeId = asString(payload.fromNodeId);
  const toNodeId = asString(payload.toNodeId);
  const fromQuery = asString(payload.fromQuery);
  const toQuery = asString(payload.toQuery);

  if (!workspaceId) {
    return { ok: false, status: 400, error: "`workspace_id` is required." };
  }

  if (!graphId) {
    return { ok: false, status: 400, error: "`graph_id` is required." };
  }

  const hasSource = !!fromNodeId || !!fromQuery;
  const hasTarget = !!toNodeId || !!toQuery;

  if (!hasSource || !hasTarget) {
    return {
      ok: false,
      status: 400,
      error:
        "Both source and target are required. Provide from_node_id/from_query and to_node_id/to_query.",
    };
  }

  return {
    ok: true,
    value: {
      workspaceId,
      graphId,
      fromNodeId: fromNodeId || null,
      toNodeId: toNodeId || null,
      fromQuery: fromQuery || null,
      toQuery: toQuery || null,
      maxHops: payload.maxHops,
      edgeKinds: payload.edgeKinds,
      planeId: asString(payload.planeId) || null,
    },
  };
}

async function authorize(event, supabase, workspaceId) {
  const auth = await authenticateApiKey({
    request: event.request,
    supabase,
    requiredScopes: ["read"],
    workspaceId,
    route: ROUTE,
  });

  if (!auth.ok) {
    return json(
      {
        ok: false,
        error: auth.error || "Unauthorized",
      },
      { status: auth.status || 401 },
    );
  }

  return auth.auth;
}

async function handleTraversal(event, payload) {
  const supabase = event.locals?.supabase ?? createSupabaseServerClient(event);

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, { status: validation.status });
  }

  const input = validation.value;
  const auth = await authorize(event, supabase, input.workspaceId);
  if (auth instanceof Response) return auth;

  try {
    const result = await traversePath({
      client: supabase,
      workspaceId: input.workspaceId,
      graphId: input.graphId,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      fromQuery: input.fromQuery,
      toQuery: input.toQuery,
      maxHops: input.maxHops,
      edgeKinds: input.edgeKinds,
      planeId: input.planeId,
    });

    return json(
      {
        ok: true,
        data: result,
        meta: {
          workspace_id: input.workspaceId,
          graph_id: input.graphId,
          max_hops: input.maxHops,
          edge_kinds: input.edgeKinds || [],
          authenticated_as: {
            api_key_id: auth.apiKeyId,
            workspace_id: auth.workspaceId,
            scopes: auth.scopes || [],
          },
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err?.message || "Path traversal failed.";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
  const payload = parseQueryPayload(event.url);
  return handleTraversal(event, payload);
}

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
  let body = {};
  try {
    body = await event.request.json();
  } catch {
    return json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const payload = parseJsonPayload(body);
  return handleTraversal(event, payload);
}
