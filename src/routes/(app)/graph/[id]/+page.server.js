import { error, redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import { loadGraphState } from "$lib/supabase/queries";

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const { params, locals, url } = event;
  const graphRef = String(params.id || "").trim();

  if (!graphRef) {
    throw error(400, "Graph id is required.");
  }

  event.depends(`app:graph:${graphRef}`);

  const supabase = locals?.supabase ?? createSupabaseServerClient(event);

  const session =
    locals?.session ?? (await supabase.auth.getSession()).data?.session ?? null;

  if (!session?.user) {
    const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`);
    throw redirect(303, `/auth/login?redirectTo=${redirectTo}`);
  }

  const user = locals?.user ?? session.user;

  // Resolve graph by id or slug. RLS enforces workspace access.
  const { data: graphRows, error: graphQueryError } = await supabase
    .from("graphs")
    .select(
      `
      id,
      workspace_id,
      name,
      slug,
      description,
      is_archived,
      is_public,
      share_token,
      metadata,
      created_at,
      updated_at,
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
    .or(`id.eq.${graphRef},slug.eq.${graphRef}`)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (graphQueryError) {
    throw error(500, `Failed to load graph: ${graphQueryError.message}`);
  }

  const graph = graphRows?.[0] ?? null;
  if (!graph) {
    throw error(404, "Graph not found.");
  }

  // Resolve membership role in this graph's workspace.
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", graph.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw error(
      500,
      `Failed to resolve workspace membership: ${membershipError.message}`,
    );
  }

  if (!membership?.role) {
    // Extra guard in case policies are changed.
    throw error(403, "You do not have access to this graph.");
  }

  const canEdit = membership.role !== "viewer";

  const { data: memberRows, error: membersError } = await supabase
    .from("workspace_members")
    .select(
      `
      workspace_id,
      user_id,
      role,
      created_at,
      profile:profiles (
        id,
        email,
        full_name,
        avatar_url
      )
    `,
    )
    .eq("workspace_id", graph.workspace_id);

  if (membersError) {
    throw error(
      500,
      `Failed to load workspace members: ${membersError.message}`,
    );
  }

  // Graph state snapshot currently lives in graphs.metadata.prototype_state.
  // (Normalized table hydration is a later migration step.)
  let initialState = null;
  try {
    initialState = await loadGraphState(graph.id, { client: supabase });
  } catch (_stateError) {
    // Keep the page usable even if state snapshot is missing/corrupt.
    initialState = null;
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    workspace: graph.workspace ?? null,
    workspaceRole: membership.role,
    workspaceMembers: (memberRows || []).map((m) => ({
      workspaceId: m.workspace_id,
      userId: m.user_id,
      role: m.role,
      joinedAt: m.created_at,
      profile: m.profile ?? null,
    })),
    graph: {
      id: graph.id,
      workspaceId: graph.workspace_id,
      name: graph.name,
      slug: graph.slug,
      description: graph.description,
      isArchived: !!graph.is_archived,
      isPublic: !!graph.is_public,
      shareToken: graph.share_token ?? null,
      metadata: graph.metadata ?? {},
      createdAt: graph.created_at,
      updatedAt: graph.updated_at,
    },
    initialState,
    canEdit,
  };
}
