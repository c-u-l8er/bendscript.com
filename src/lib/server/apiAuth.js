import crypto from "node:crypto";
import { error as kitError } from "@sveltejs/kit";

const kag = (c) => c.schema("kag");

const DEFAULT_KEY_PREFIX = process.env.API_KEY_PREFIX || "bsk_live_";
const DEFAULT_SCOPES = ["read"];

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeScopes(scopes) {
  return toArray(scopes)
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
}

function uniq(items) {
  return [...new Set(items)];
}

function nowIso() {
  return new Date().toISOString();
}

function getHeader(request, name) {
  return request?.headers?.get?.(name) || "";
}

/**
 * Extract API key from:
 * - Authorization: Bearer <token>
 * - x-api-key: <token>
 */
export function extractApiKeyFromRequest(request) {
  const auth = getHeader(request, "authorization");
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const xApiKey = getHeader(request, "x-api-key").trim();
  if (xApiKey) return xApiKey;

  return "";
}

/**
 * Hashes API key with optional server pepper.
 * Keep pepper private and server-only.
 */
export function hashApiKey(rawKey) {
  const input = String(rawKey || "").trim();
  const pepper = process.env.API_KEY_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}:${input}`).digest("hex");
}

/**
 * Scope matcher:
 * - exact match: "read"
 * - wildcard all: "*"
 * - namespace wildcard: "graph:*" matches "graph:read"
 */
export function hasScope(grantedScopes, requiredScope) {
  const required = String(requiredScope || "").trim().toLowerCase();
  if (!required) return true;

  const granted = normalizeScopes(grantedScopes);
  if (granted.includes("*")) return true;
  if (granted.includes(required)) return true;

  const requiredParts = required.split(":");
  if (requiredParts.length > 1) {
    const wildcardParent = `${requiredParts[0]}:*`;
    if (granted.includes(wildcardParent)) return true;
  }

  return false;
}

export function hasAllScopes(grantedScopes, requiredScopes = []) {
  const required = normalizeScopes(requiredScopes);
  if (!required.length) return true;
  return required.every((scope) => hasScope(grantedScopes, scope));
}

function makePublicPrefix(apiKey) {
  const key = String(apiKey || "");
  const prefix = key.slice(0, 12);
  return prefix.length >= 8 ? prefix : key.slice(0, 8);
}

function makeApiSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Generates a new API key pair (plaintext + hashed metadata).
 * Plaintext should be shown once to user and never stored.
 */
export function generateApiKeyMaterial({ prefix = DEFAULT_KEY_PREFIX } = {}) {
  const safePrefix = String(prefix || DEFAULT_KEY_PREFIX);
  const plaintext = `${safePrefix}${makeApiSecret(32)}`;
  const keyHash = hashApiKey(plaintext);
  const keyPrefix = makePublicPrefix(plaintext);

  return {
    plaintext,
    keyHash,
    keyPrefix,
  };
}

/**
 * Creates and stores a new API key record.
 * Returns plaintext once + persisted row.
 */
export async function createApiKey({
  supabase,
  workspaceId,
  createdBy = null,
  name,
  scopes = DEFAULT_SCOPES,
  expiresAt = null,
  prefix = DEFAULT_KEY_PREFIX,
}) {
  if (!supabase) throw new Error("createApiKey: missing supabase client");
  if (!workspaceId) throw new Error("createApiKey: workspaceId is required");
  if (!name || !String(name).trim()) {
    throw new Error("createApiKey: name is required");
  }

  const normalizedScopes = uniq(normalizeScopes(scopes));
  const { plaintext, keyHash, keyPrefix } = generateApiKeyMaterial({ prefix });

  const payload = {
    workspace_id: workspaceId,
    created_by: createdBy,
    name: String(name).trim().slice(0, 80),
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes: normalizedScopes.length ? normalizedScopes : DEFAULT_SCOPES,
    is_active: true,
    expires_at: expiresAt || null,
  };

  const { data, error } = await kag(supabase)
    .from("api_keys")
    .insert(payload)
    .select(
      "id, workspace_id, name, key_prefix, scopes, is_active, expires_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(`createApiKey failed: ${error.message || "unknown error"}`);
  }

  return {
    plaintext,
    apiKey: data,
  };
}

export async function revokeApiKey({ supabase, workspaceId, apiKeyId }) {
  if (!supabase) throw new Error("revokeApiKey: missing supabase client");
  if (!workspaceId) throw new Error("revokeApiKey: workspaceId is required");
  if (!apiKeyId) throw new Error("revokeApiKey: apiKeyId is required");

  const { data, error } = await kag(supabase)
    .from("api_keys")
    .update({ is_active: false, updated_at: nowIso() })
    .eq("id", apiKeyId)
    .eq("workspace_id", workspaceId)
    .select("id, workspace_id, is_active, updated_at")
    .single();

  if (error) {
    throw new Error(`revokeApiKey failed: ${error.message || "unknown error"}`);
  }

  return data;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

function getClientIp(request) {
  const forwarded = getHeader(request, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return (
    getHeader(request, "cf-connecting-ip") ||
    getHeader(request, "x-real-ip") ||
    null
  );
}

async function logApiKeyEvent({
  supabase,
  apiKeyId,
  workspaceId,
  route = null,
  method = null,
  statusCode = null,
  request = null,
  requestId = null,
}) {
  if (!supabase || !workspaceId) return;

  const payload = {
    api_key_id: apiKeyId || null,
    workspace_id: workspaceId,
    route: route || null,
    method: method || null,
    status_code: Number.isFinite(Number(statusCode))
      ? Number(statusCode)
      : null,
    ip: getClientIp(request),
    user_agent: request ? getHeader(request, "user-agent") || null : null,
    request_id: requestId || getHeader(request, "x-request-id") || null,
  };

  // Best effort logging only.
  await kag(supabase).from("api_key_events").insert(payload).then(() => {}).catch(() => {});
}

/**
 * Validates API key from request and verifies required scopes.
 * Returns { ok, status, error?, auth? }.
 */
export async function authenticateApiKey({
  request,
  supabase,
  requiredScopes = [],
  workspaceId = null,
  route = null,
  requestId = null,
}) {
  if (!supabase) {
    return { ok: false, status: 500, error: "Missing Supabase client." };
  }

  const rawKey = extractApiKeyFromRequest(request);
  if (!rawKey) {
    return { ok: false, status: 401, error: "Missing API key." };
  }

  const keyHash = hashApiKey(rawKey);

  const { data: keyRow, error: keyError } = await kag(supabase)
    .from("api_keys")
    .select(
      "id, workspace_id, name, scopes, is_active, expires_at, created_by, last_used_at, key_prefix",
    )
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError) {
    return {
      ok: false,
      status: 500,
      error: `API key lookup failed: ${keyError.message || "unknown error"}`,
    };
  }

  if (!keyRow) {
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  if (!keyRow.is_active) {
    await logApiKeyEvent({
      supabase,
      apiKeyId: keyRow.id,
      workspaceId: keyRow.workspace_id,
      route,
      method: request?.method,
      statusCode: 401,
      request,
      requestId,
    });
    return { ok: false, status: 401, error: "API key is inactive." };
  }

  if (isExpired(keyRow.expires_at)) {
    await logApiKeyEvent({
      supabase,
      apiKeyId: keyRow.id,
      workspaceId: keyRow.workspace_id,
      route,
      method: request?.method,
      statusCode: 401,
      request,
      requestId,
    });
    return { ok: false, status: 401, error: "API key has expired." };
  }

  if (workspaceId && keyRow.workspace_id !== workspaceId) {
    await logApiKeyEvent({
      supabase,
      apiKeyId: keyRow.id,
      workspaceId: keyRow.workspace_id,
      route,
      method: request?.method,
      statusCode: 403,
      request,
      requestId,
    });
    return { ok: false, status: 403, error: "API key not valid for workspace." };
  }

  const normalizedGranted = normalizeScopes(keyRow.scopes || []);
  const normalizedRequired = normalizeScopes(requiredScopes);

  if (!hasAllScopes(normalizedGranted, normalizedRequired)) {
    await logApiKeyEvent({
      supabase,
      apiKeyId: keyRow.id,
      workspaceId: keyRow.workspace_id,
      route,
      method: request?.method,
      statusCode: 403,
      request,
      requestId,
    });

    return {
      ok: false,
      status: 403,
      error: "Insufficient API key scope.",
      missingScopes: normalizedRequired.filter(
        (scope) => !hasScope(normalizedGranted, scope),
      ),
    };
  }

  // Best-effort usage update
  await kag(supabase)
    .from("api_keys")
    .update({ last_used_at: nowIso() })
    .eq("id", keyRow.id)
    .then(() => {})
    .catch(() => {});

  await logApiKeyEvent({
    supabase,
    apiKeyId: keyRow.id,
    workspaceId: keyRow.workspace_id,
    route,
    method: request?.method,
    statusCode: 200,
    request,
    requestId,
  });

  return {
    ok: true,
    status: 200,
    auth: {
      apiKeyId: keyRow.id,
      keyPrefix: keyRow.key_prefix,
      name: keyRow.name,
      workspaceId: keyRow.workspace_id,
      scopes: normalizedGranted,
      createdBy: keyRow.created_by || null,
    },
  };
}

/**
 * SvelteKit convenience wrapper:
 * throws HTTP errors for failed API key auth.
 */
export async function requireApiKeyAuth(event, options = {}) {
  const result = await authenticateApiKey({
    request: event?.request,
    supabase: options.supabase || event?.locals?.supabase,
    requiredScopes: options.requiredScopes || [],
    workspaceId: options.workspaceId || null,
    route: options.route || event?.url?.pathname || null,
    requestId: options.requestId || getHeader(event?.request, "x-request-id"),
  });

  if (!result.ok) {
    throw kitError(result.status || 401, result.error || "Unauthorized");
  }

  return result.auth;
}
