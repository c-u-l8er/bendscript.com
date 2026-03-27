// ProjectAmp2/bendscript.com/src/routes/(app)/dashboard/+page.server.js
import { redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import {
  listMyWorkspaces,
  listWorkspaceGraphs,
  listWorkspaceMembers,
} from "$lib/supabase/queries";

function getSupabase(event) {
  return event.locals?.supabase ?? createSupabaseServerClient(event);
}

function normalizeWorkspaceIdParam(url) {
  const workspace = String(url.searchParams.get("workspace") || "").trim();
  if (workspace) return workspace;

  const ws = String(url.searchParams.get("ws") || "").trim();
  if (ws) return ws;

  return null;
}

function pickActiveWorkspace(workspaces, requestedId) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) return null;
  if (requestedId) {
    const match = workspaces.find((w) => w.id === requestedId);
    if (match) return match;
  }
  return workspaces[0];
}

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const supabase = getSupabase(event);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw redirect(303, "/auth/login");
  }

  let workspaces = [];
  try {
    workspaces = await listMyWorkspaces({ client: supabase });
  } catch {
    workspaces = [];
  }

  const membersByWorkspace = {};
  const graphCountsByWorkspace = {};
  const graphsByWorkspace = {};

  if (workspaces.length > 0) {
    await Promise.all(
      workspaces.map(async (workspace) => {
        const [graphsResult, membersResult] = await Promise.allSettled([
          listWorkspaceGraphs(workspace.id, { client: supabase }),
          listWorkspaceMembers(workspace.id, { client: supabase }),
        ]);

        const graphs =
          graphsResult.status === "fulfilled" &&
          Array.isArray(graphsResult.value)
            ? graphsResult.value
            : [];

        const members =
          membersResult.status === "fulfilled" &&
          Array.isArray(membersResult.value)
            ? membersResult.value
            : [];

        graphsByWorkspace[workspace.id] = graphs;
        graphCountsByWorkspace[workspace.id] = graphs.length;
        membersByWorkspace[workspace.id] = members;
      }),
    );
  }

  const requestedWorkspaceId = normalizeWorkspaceIdParam(event.url);
  const activeWorkspace = pickActiveWorkspace(workspaces, requestedWorkspaceId);
  const activeWorkspaceId = activeWorkspace?.id ?? null;

  const decoratedWorkspaces = workspaces.map((workspace) => {
    const graphs = graphsByWorkspace[workspace.id] || [];
    return {
      ...workspace,
      defaultGraphId: graphs[0]?.id ?? null,
      graphCount: graphCountsByWorkspace[workspace.id] ?? 0,
    };
  });

  const recentGraphs = activeWorkspaceId
    ? (graphsByWorkspace[activeWorkspaceId] || []).slice(0, 12)
    : [];

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    workspaces: decoratedWorkspaces,
    activeWorkspaceId,
    selectedWorkspaceId: activeWorkspaceId,
    selectedWorkspace:
      decoratedWorkspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    membersByWorkspace,
    graphCountsByWorkspace,
    recentGraphs,
    graphs: recentGraphs,
  };
}
