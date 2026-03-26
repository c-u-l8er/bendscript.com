import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { authenticateApiKey, queryGraph } from "$lib/server/graphApi";

export const prerender = false;

const DEFAULT_LIMIT = 12;
const DEFAULT_MAX_HOPS = 4;

function toInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeText(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function badRequest(message, details = null) {
  return json(
    {
      ok: false,
      error: message,
      details,
    },
    { status: 400 },
  );
}

function unauthorized(message = "Unauthorized") {
  return json(
    {
      ok: false,
      error: message,
    },
    { status: 401 },
  );
}

function forbidden(message = "Forbidden") {
  return json(
    {
      ok: false,
      error: message,
    },
    { status: 403 },
  );
}

function internalError(message = "Internal server error") {
  return json(
    {
      ok: false,
      error: message,
    },
    { status: 500 },
  );
}

async function parseInput(event) {
  if (event.request.method === "GET") {
    const params = event.url.searchParams;
    return {
      question:
        normalizeText(params.get("question"), 2000) ||
        normalizeText(params.get("q"), 2000),
      graph_id: normalizeText(params.get("graph_id"), 120),
      workspace_id: normalizeText(params.get("workspace_id"), 120),
      limit: params.get("limit"),
      max_hops: params.get("max_hops"),
    };
  }

  let body = {};
  try {
    body = await event.request.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }

  return {
    question:
      normalizeText(body?.question, 2000) || normalizeText(body?.q, 2000),
    graph_id: normalizeText(body?.graph_id, 120),
    workspace_id: normalizeText(body?.workspace_id, 120),
    limit: body?.limit,
    max_hops: body?.max_hops,
  };
}

async function handleQuery(event) {
  const supabase = event.locals?.supabase ?? createSupabaseServerClient(event);

  const authResult = await authenticateApiKey({
    client: supabase,
    apiKey:
      event.request.headers.get("x-api-key") ||
      event.request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "",
  });

  if (!authResult?.ok) {
    return unauthorized(authResult?.error || "Invalid API key.");
  }

  const apiKeyWorkspaceId = authResult.key.workspace_id;
  const scopes = Array.isArray(authResult.key.scopes) ? authResult.key.scopes : [];

  // Require at least one read-capable scope.
  const hasReadScope =
    scopes.includes("*") ||
    scopes.includes("read") ||
    scopes.includes("graph:read") ||
    scopes.includes("graph:*");

  if (!hasReadScope) {
    return forbidden("API key does not have read permissions.");
  }

  const input = await parseInput(event);

  if (!input.question) {
    return badRequest("`question` is required.");
  }

  if (!input.graph_id) {
    return badRequest("`graph_id` is required.");
  }

  if (input.workspace_id && input.workspace_id !== apiKeyWorkspaceId) {
    return forbidden("API key is not authorized for the requested workspace.");
  }

  const workspaceId = input.workspace_id || apiKeyWorkspaceId;
  const limit = toInt(input.limit, DEFAULT_LIMIT, 1, 30);
  const maxHops = toInt(input.max_hops, DEFAULT_MAX_HOPS, 1, 10);

  try {
    const result = await queryGraph({
      client: supabase,
      workspaceId,
      graphId: input.graph_id,
      question: input.question,
      limit,
      maxHops,
    });

    return json({
      ok: true,
      workspace_id: workspaceId,
      graph_id: input.graph_id,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed.";
    return internalError(message);
  }
}

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
  return handleQuery(event);
}

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
  return handleQuery(event);
}
