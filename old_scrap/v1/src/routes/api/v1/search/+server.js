import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { requireApiKeyAuth } from "$lib/server/apiAuth";
import { searchNodes } from "$lib/server/graphApi";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

function toStringOrNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function badRequest(message, details = null) {
  return json(
    {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message,
        details,
      },
    },
    { status: 400 },
  );
}

function unauthorized(message = "Unauthorized") {
  return json(
    {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message,
      },
    },
    { status: 401 },
  );
}

function forbidden(message = "Forbidden") {
  return json(
    {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message,
      },
    },
    { status: 403 },
  );
}

function serverError(message = "Internal server error", details = null) {
  return json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message,
        details,
      },
    },
    { status: 500 },
  );
}

function parseGetInput(url) {
  return {
    workspaceId: toStringOrNull(url.searchParams.get("workspace_id")),
    graphId: toStringOrNull(url.searchParams.get("graph_id")),
    planeId: toStringOrNull(url.searchParams.get("plane_id")),
    query: toStringOrNull(url.searchParams.get("query")),
    limit: toLimit(url.searchParams.get("limit")),
  };
}

async function parsePostInput(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: badRequest("Request body must be valid JSON.") };
  }

  return {
    workspaceId: toStringOrNull(body?.workspace_id),
    graphId: toStringOrNull(body?.graph_id),
    planeId: toStringOrNull(body?.plane_id),
    query: toStringOrNull(body?.query),
    limit: toLimit(body?.limit),
  };
}

function validateInput(input) {
  if (!input.workspaceId) {
    return "workspace_id is required.";
  }

  if (!input.query) {
    return "query is required.";
  }

  if (input.query.length < MIN_QUERY_LENGTH) {
    return `query must be at least ${MIN_QUERY_LENGTH} characters.`;
  }

  return null;
}

async function runSearch(event, input) {
  const supabase =
    event.locals?.supabase ?? createSupabaseServerClient(event);

  // API key is required for this REST surface.
  let auth;
  try {
    auth = await requireApiKeyAuth(event, {
      supabase,
      requiredScopes: ["read"],
      workspaceId: input.workspaceId,
      route: "/api/v1/search",
    });
  } catch (err) {
    const status = Number(err?.status) || 401;
    const message = err?.body?.message || err?.message || "Unauthorized";
    if (status === 401) return unauthorized(message);
    if (status === 403) return forbidden(message);
    return json(
      {
        ok: false,
        error: {
          code: "AUTH_ERROR",
          message,
        },
      },
      { status },
    );
  }

  try {
    const result = await searchNodes({
      client: supabase,
      workspaceId: input.workspaceId,
      graphId: input.graphId,
      planeId: input.planeId,
      query: input.query,
      limit: input.limit,
    });

    return json({
      ok: true,
      data: result.nodes,
      meta: {
        ...result.meta,
        workspace_id: input.workspaceId,
        graph_id: input.graphId,
        plane_id: input.planeId,
        api_key_id: auth?.apiKeyId ?? null,
      },
    });
  } catch (err) {
    return serverError("Failed to search nodes.", err?.message || null);
  }
}

export const prerender = false;

export async function GET(event) {
  const input = parseGetInput(event.url);
  const validationError = validateInput(input);
  if (validationError) return badRequest(validationError);

  return runSearch(event, input);
}

export async function POST(event) {
  const parsed = await parsePostInput(event.request);
  if (parsed?.error) return parsed.error;

  const validationError = validateInput(parsed);
  if (validationError) return badRequest(validationError);

  return runSearch(event, parsed);
}
