import { supabase as browserSupabase } from "./client";

const DEFAULT_GRAPH_NAME = "Untitled Graph";
const DEFAULT_GRAPH_SLUG = "untitled-graph";

function getClient(client) {
  const resolved = client ?? browserSupabase;
  if (!resolved) {
    throw new Error(
      "Supabase client is not available. Pass an initialized client to this query utility.",
    );
  }
  return resolved;
}

function toError(prefix, error) {
  const detail = error?.message || error?.details || "Unknown Supabase error";
  return new Error(`${prefix}: ${detail}`);
}

function slugify(input, fallback = "workspace") {
  const normalized = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  return normalized || fallback;
}

function safeClone(value) {
  try {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function normalizeStateShape(state) {
  const s = state && typeof state === "object" ? state : {};
  const planes = s.planes && typeof s.planes === "object" ? s.planes : {};
  const rootPlaneId = s.rootPlaneId ?? Object.keys(planes)[0] ?? null;
  const activePlaneId = s.activePlaneId ?? rootPlaneId;

  return {
    version: Number(s.version) || 1,
    rootPlaneId,
    activePlaneId,
    planes,
    ui: s.ui && typeof s.ui === "object" ? s.ui : {},
    cameraDefaults:
      s.cameraDefaults && typeof s.cameraDefaults === "object"
        ? s.cameraDefaults
        : { x: 0, y: 0, zoom: 1 },
  };
}

async function requireAuthedUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw toError("Failed to resolve current user", error);
  if (!data?.user) throw new Error("User is not authenticated");
  return data.user;
}

/**
 * Workspaces
 */

export async function listMyWorkspaces({ client } = {}) {
  const c = getClient(client);
  const user = await requireAuthedUser(c);

  const { data, error } = await c
    .from("workspace_members")
    .select(
      `
      role,
      created_at,
      workspace:workspaces (
        id,
        name,
        slug,
        plan,
        metadata,
        created_at,
        updated_at
      )
    `,
    )
    .eq("user_id", user.id);

  if (error) throw toError("Failed to load workspaces", error);

  return (data || [])
    .map((row) => ({
      role: row.role,
      joinedAt: row.created_at,
      ...(row.workspace || {}),
    }))
    .filter((w) => !!w.id);
}

export async function getWorkspaceById(workspaceId, { client } = {}) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);

  const { data, error } = await c
    .from("workspaces")
    .select("id, name, slug, plan, metadata, created_at, updated_at")
    .eq("id", workspaceId)
    .single();

  if (error) throw toError("Failed to load workspace", error);
  return data;
}

export async function createWorkspace(
  { name, slug, plan = "free", metadata = {} },
  { client } = {},
) {
  const c = getClient(client);
  const user = await requireAuthedUser(c);

  const workspaceName = String(name || "").trim() || "New Workspace";
  const workspaceSlug = slugify(
    slug || workspaceName,
    `workspace-${Date.now().toString(36)}`,
  );

  const { data: workspace, error: createWorkspaceError } = await c
    .from("workspaces")
    .insert({
      name: workspaceName,
      slug: workspaceSlug,
      plan,
      metadata,
      created_by: user.id,
    })
    .select("id, name, slug, plan, metadata, created_at, updated_at")
    .single();

  if (createWorkspaceError)
    throw toError("Failed to create workspace", createWorkspaceError);

  const { error: memberError } = await c.from("workspace_members").upsert(
    {
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
      invited_by: user.id,
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (memberError)
    throw toError("Failed to create workspace membership", memberError);

  return workspace;
}

export async function updateWorkspace(
  workspaceId,
  { name, slug, plan, metadata },
  { client } = {},
) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);

  const patch = {};

  if (typeof name === "string" && name.trim()) {
    patch.name = name.trim();
  }

  if (typeof slug === "string" && slug.trim()) {
    patch.slug = slugify(slug, "workspace");
  }

  if (typeof plan === "string" && plan.trim()) {
    patch.plan = plan.trim();
  }

  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    patch.metadata = metadata;
  }

  if (Object.keys(patch).length === 0) {
    return getWorkspaceById(workspaceId, { client: c });
  }

  const { data, error } = await c
    .from("workspaces")
    .update(patch)
    .eq("id", workspaceId)
    .select("id, name, slug, plan, metadata, created_at, updated_at")
    .single();

  if (error) throw toError("Failed to update workspace", error);
  return data;
}

export async function deleteWorkspace(workspaceId, { client } = {}) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);
  const user = await requireAuthedUser(c);

  const { data: membership, error: membershipError } = await c
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw toError("Failed to validate workspace membership", membershipError);
  }

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role !== "owner") {
    throw new Error("Only workspace owners can delete workspaces");
  }

  const { error } = await c.from("workspaces").delete().eq("id", workspaceId);
  if (error) throw toError("Failed to delete workspace", error);

  return { id: workspaceId, deleted: true };
}

export async function listWorkspaceMembers(workspaceId, { client } = {}) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);

  const { data, error } = await c
    .from("workspace_members")
    .select("workspace_id, user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  if (error) throw toError("Failed to load workspace members", error);

  const rows = data || [];
  const userIds = Array.from(
    new Set(rows.map((row) => row?.user_id).filter(Boolean)),
  );

  const profilesById = new Map();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await c
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      throw toError("Failed to load workspace member profiles", profilesError);
    }

    for (const profile of profiles || []) {
      if (!profile?.id) continue;
      profilesById.set(profile.id, profile);
    }
  }

  return rows.map((row) => ({
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    profile: profilesById.get(row.user_id) || null,
  }));
}

/**
 * Graph records
 */

export async function listWorkspaceGraphs(
  workspaceId,
  { includeArchived = false, client } = {},
) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);

  let query = c
    .from("graphs")
    .select(
      "id, workspace_id, name, slug, description, is_archived, is_public, share_token, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (!includeArchived) query = query.eq("is_archived", false);

  const { data, error } = await query;
  if (error) throw toError("Failed to list workspace graphs", error);
  return data || [];
}

export async function getGraphById(graphId, { client } = {}) {
  if (!graphId) throw new Error("graphId is required");
  const c = getClient(client);

  const { data, error } = await c
    .from("graphs")
    .select(
      "id, workspace_id, name, slug, description, is_archived, is_public, share_token, metadata, created_at, updated_at",
    )
    .eq("id", graphId)
    .single();

  if (error) throw toError("Failed to load graph", error);
  return data;
}

export async function upsertGraphRecord(
  {
    graphId = null,
    workspaceId,
    name = DEFAULT_GRAPH_NAME,
    slug = null,
    description = null,
    isPublic = false,
    metadata = {},
  },
  { client } = {},
) {
  if (!workspaceId) throw new Error("workspaceId is required");
  const c = getClient(client);
  const user = await requireAuthedUser(c);

  const graphName = String(name || "").trim() || DEFAULT_GRAPH_NAME;
  const graphSlug = slugify(slug || graphName, DEFAULT_GRAPH_SLUG);

  if (graphId) {
    const { data, error } = await c
      .from("graphs")
      .update({
        name: graphName,
        slug: graphSlug,
        description,
        is_public: !!isPublic,
        metadata,
      })
      .eq("id", graphId)
      .eq("workspace_id", workspaceId)
      .select(
        "id, workspace_id, name, slug, description, is_archived, is_public, share_token, metadata, created_at, updated_at",
      )
      .single();

    if (error) throw toError("Failed to update graph record", error);
    return data;
  }

  const { data, error } = await c
    .from("graphs")
    .insert({
      workspace_id: workspaceId,
      name: graphName,
      slug: graphSlug,
      description,
      is_public: !!isPublic,
      created_by: user.id,
      metadata,
    })
    .select(
      "id, workspace_id, name, slug, description, is_archived, is_public, share_token, metadata, created_at, updated_at",
    )
    .single();

  if (error) throw toError("Failed to create graph record", error);
  return data;
}

/**
 * Graph state persistence
 *
 * NOTE:
 * Current prototype engine uses non-UUID in-memory IDs (e.g. node_abc123),
 * while normalized DB tables use UUID keys. Until the UUID bridge migration
 * lands, we persist canonical runtime state as a JSON snapshot in `graphs.metadata`.
 */

export async function loadGraphState(graphId, { client } = {}) {
  if (!graphId) throw new Error("graphId is required");
  const graph = await getGraphById(graphId, { client });

  const snapshot = graph?.metadata?.prototype_state ?? null;
  if (!snapshot) return null;

  return normalizeStateShape(safeClone(snapshot));
}

export async function saveGraphState(
  {
    workspaceId,
    graphId = null,
    graphName = DEFAULT_GRAPH_NAME,
    graphSlug = null,
    graphDescription = null,
    isPublic = false,
    state,
    extraMetadata = {},
  },
  { client } = {},
) {
  if (!workspaceId) throw new Error("workspaceId is required");
  if (!state) throw new Error("state is required");

  const c = getClient(client);
  const normalized = normalizeStateShape(state);

  const existingGraph = graphId
    ? await getGraphById(graphId, { client: c })
    : null;
  const mergedMetadata = {
    ...(existingGraph?.metadata || {}),
    ...(extraMetadata || {}),
    prototype_state: safeClone(normalized),
    prototype_state_saved_at: new Date().toISOString(),
    prototype_state_version: normalized.version,
  };

  const graph = await upsertGraphRecord(
    {
      graphId,
      workspaceId,
      name: graphName || existingGraph?.name || DEFAULT_GRAPH_NAME,
      slug: graphSlug || existingGraph?.slug || null,
      description: graphDescription ?? existingGraph?.description ?? null,
      isPublic:
        typeof isPublic === "boolean" ? isPublic : !!existingGraph?.is_public,
      metadata: mergedMetadata,
    },
    { client: c },
  );

  return {
    graph,
    state: safeClone(normalized),
  };
}

export default {
  listMyWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  listWorkspaceGraphs,
  getGraphById,
  upsertGraphRecord,
  loadGraphState,
  saveGraphState,
};
