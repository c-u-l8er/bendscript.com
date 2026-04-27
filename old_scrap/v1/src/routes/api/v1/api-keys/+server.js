import { json } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { createApiKey, revokeApiKey } from "$lib/server/apiAuth";

const ADMIN_ROLES = new Set(["owner", "admin"]);

function getSupabase(event) {
  return event.locals?.supabase ?? createSupabaseServerClient(event);
}

async function getUserOrNull(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return ["read"];
  const out = Array.from(
    new Set(
      scopes
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return out.length ? out : ["read"];
}

function isIsoDateLike(value) {
  if (!value) return false;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts);
}

async function requireWorkspaceAdmin({ supabase, workspaceId, userId }) {
  if (!workspaceId) {
    return { ok: false, status: 400, error: "workspaceId is required." };
  }

  const { data, error } = await supabase
    .schema("amp")
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: `Failed to validate workspace membership: ${error.message}`,
    };
  }

  if (!data?.role) {
    return {
      ok: false,
      status: 403,
      error: "You are not a member of this workspace.",
    };
  }

  if (!ADMIN_ROLES.has(data.role)) {
    return {
      ok: false,
      status: 403,
      error: "Only workspace owners/admins can manage API keys.",
    };
  }

  return { ok: true, role: data.role };
}

function parseWorkspaceId(event, body = null) {
  const qs = event.url.searchParams.get("workspaceId");
  const fromBody =
    body && typeof body === "object" ? body.workspaceId || body.workspace_id : null;
  return String(fromBody || qs || "").trim();
}

function shapeApiKeyRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    isActive: !!row.is_active,
    expiresAt: row.expires_at ?? null,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    createdBy: row.created_by ?? null,
  };
}

export const prerender = false;

/**
 * GET /api/v1/api-keys?workspaceId=...
 * Lists API keys for a workspace (masked; never returns key secret/hash).
 */
export async function GET(event) {
  const supabase = getSupabase(event);
  const user = await getUserOrNull(supabase);

  if (!user) {
    return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const workspaceId = parseWorkspaceId(event);
  const adminCheck = await requireWorkspaceAdmin({
    supabase,
    workspaceId,
    userId: user.id,
  });

  if (!adminCheck.ok) {
    return json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });
  }

  const { data, error } = await supabase
    .schema("kag")
    .from("api_keys")
    .select(
      "id, workspace_id, created_by, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return json(
      { ok: false, error: `Failed to list API keys: ${error.message}` },
      { status: 500 },
    );
  }

  return json({
    ok: true,
    workspaceId,
    keys: (data || []).map(shapeApiKeyRow),
  });
}

/**
 * POST /api/v1/api-keys
 * Body:
 * {
 *   "workspaceId": "...",
 *   "name": "CI Key",
 *   "scopes": ["read", "graph:read"],
 *   "expiresAt": "2027-01-01T00:00:00.000Z",
 *   "prefix": "bsk_live_"
 * }
 *
 * Returns plaintext key exactly once.
 */
export async function POST(event) {
  const supabase = getSupabase(event);
  const user = await getUserOrNull(supabase);

  if (!user) {
    return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body = null;
  try {
    body = await event.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const workspaceId = parseWorkspaceId(event, body);
  const adminCheck = await requireWorkspaceAdmin({
    supabase,
    workspaceId,
    userId: user.id,
  });

  if (!adminCheck.ok) {
    return json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });
  }

  const name = String(body?.name || "").trim();
  if (!name) {
    return json({ ok: false, error: "Key name is required." }, { status: 400 });
  }

  const scopes = normalizeScopes(body?.scopes);
  const expiresAt = body?.expiresAt ? String(body.expiresAt).trim() : null;
  const prefix = body?.prefix ? String(body.prefix).trim() : undefined;

  if (expiresAt && !isIsoDateLike(expiresAt)) {
    return json({ ok: false, error: "expiresAt must be a valid ISO date." }, { status: 400 });
  }

  try {
    const { plaintext, apiKey } = await createApiKey({
      supabase,
      workspaceId,
      createdBy: user.id,
      name,
      scopes,
      expiresAt,
      prefix,
    });

    return json(
      {
        ok: true,
        message: "API key created. Save it now; it will not be shown again.",
        plaintextKey: plaintext,
        apiKey: {
          id: apiKey.id,
          workspaceId: apiKey.workspace_id,
          name: apiKey.name,
          keyPrefix: apiKey.key_prefix,
          scopes: apiKey.scopes || [],
          isActive: !!apiKey.is_active,
          expiresAt: apiKey.expires_at ?? null,
          createdAt: apiKey.created_at ?? null,
          updatedAt: apiKey.updated_at ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to create API key.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/api-keys
 * Body:
 * {
 *   "workspaceId": "...",
 *   "apiKeyId": "..."
 * }
 * (apiKeyId can also be provided via ?apiKeyId=...&workspaceId=...)
 */
export async function DELETE(event) {
  const supabase = getSupabase(event);
  const user = await getUserOrNull(supabase);

  if (!user) {
    return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body = {};
  try {
    body = await event.request.json();
  } catch {
    // Allow query-string-only deletes.
  }

  const workspaceId = parseWorkspaceId(event, body);
  const apiKeyId = String(
    body?.apiKeyId || body?.api_key_id || event.url.searchParams.get("apiKeyId") || "",
  ).trim();

  if (!apiKeyId) {
    return json({ ok: false, error: "apiKeyId is required." }, { status: 400 });
  }

  const adminCheck = await requireWorkspaceAdmin({
    supabase,
    workspaceId,
    userId: user.id,
  });

  if (!adminCheck.ok) {
    return json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });
  }

  try {
    const revoked = await revokeApiKey({
      supabase,
      workspaceId,
      apiKeyId,
    });

    return json({
      ok: true,
      message: "API key revoked.",
      revoked: {
        id: revoked.id,
        workspaceId: revoked.workspace_id,
        isActive: !!revoked.is_active,
        updatedAt: revoked.updated_at ?? null,
      },
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to revoke API key.",
      },
      { status: 500 },
    );
  }
}
