// ProjectAmp2/bendscript.com/src/routes/(app)/+layout.server.js
import { redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";

const WORKSPACE_COOKIE = "bendscript_workspace_id";

function normalizeMembershipRows(rows = []) {
  return rows
    .map((row) => {
      const workspace = row?.workspace || null;
      if (!workspace?.id) return null;

      return {
        role: row.role || "viewer",
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        metadata: workspace.metadata || {},
        createdAt: workspace.created_at || null,
        updatedAt: workspace.updated_at || null
      };
    })
    .filter(Boolean);
}

async function resolveSessionAndUser(event, supabase) {
  if (typeof event.locals?.safeGetSession === "function") {
    const { session, user } = await event.locals.safeGetSession();
    return { session: session ?? null, user: user ?? null };
  }

  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser()
  ]);

  return {
    session: sessionData?.session ?? null,
    user: userData?.user ?? null
  };
}

function pickActiveWorkspace({ workspaces, cookieWorkspaceId, queryWorkspaceId }) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    return { currentWorkspace: null, currentRole: null };
  }

  const requestedId = queryWorkspaceId || cookieWorkspaceId;
  const selected =
    (requestedId && workspaces.find((w) => w.id === requestedId)) || workspaces[0] || null;

  return {
    currentWorkspace: selected,
    currentRole: selected?.role ?? null
  };
}

export async function load(event) {
  const { url, cookies } = event;
  const supabase = event.locals?.supabase || createSupabaseServerClient(event);

  const { session, user } = await resolveSessionAndUser(event, supabase);

  if (!session || !user) {
    const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`);
    throw redirect(303, `/auth/login?redirectTo=${redirectTo}`);
  }

  let workspaces = [];
  try {
    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        `
        role,
        workspace:workspaces (
          id,
          name,
          slug,
          plan,
          metadata,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    workspaces = normalizeMembershipRows(data || []);
  } catch (err) {
    console.warn("Failed to load workspace memberships in app layout guard:", err);
    workspaces = [];
  }

  const cookieWorkspaceId = cookies.get(WORKSPACE_COOKIE) || null;
  const queryWorkspaceId = url.searchParams.get("workspace") || null;

  const { currentWorkspace, currentRole } = pickActiveWorkspace({
    workspaces,
    cookieWorkspaceId,
    queryWorkspaceId
  });

  if (currentWorkspace?.id && currentWorkspace.id !== cookieWorkspaceId) {
    cookies.set(WORKSPACE_COOKIE, currentWorkspace.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return {
    session,
    user,
    workspaces,
    currentWorkspace,
    currentRole
  };
}
