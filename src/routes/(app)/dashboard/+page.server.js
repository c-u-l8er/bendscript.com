import { fail, redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import {
  createWorkspace,
  listMyWorkspaces,
  listWorkspaceGraphs,
  listWorkspaceMembers,
  upsertGraphRecord,
} from "$lib/supabase/queries";

function getSupabase(event) {
  return event.locals?.supabase ?? createSupabaseServerClient(event);
}

function toMessage(error, fallback = "Unexpected error") {
  return error?.message || error?.details || fallback;
}

function slugify(input, fallback = "workspace") {
  const value = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

  return value || fallback;
}

function uniqueSlug(base) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

function normalizeWorkspaceIdParam(url) {
  const ws = String(url.searchParams.get("ws") || "").trim();
  if (ws) return ws;

  const workspace = String(url.searchParams.get("workspace") || "").trim();
  if (workspace) return workspace;

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

    // Canonical dashboard payload
    workspaces: decoratedWorkspaces,
    activeWorkspaceId,
    selectedWorkspaceId: activeWorkspaceId,
    selectedWorkspace:
      decoratedWorkspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    membersByWorkspace,
    graphCountsByWorkspace,
    recentGraphs,

    // Backwards-compatible fields
    graphs: recentGraphs,
  };
}

export const actions = {
  createWorkspace: async (event) => {
    const supabase = getSupabase(event);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw redirect(303, "/auth/login");
    }

    const form = await event.request.formData();
    const name = String(form.get("name") || "").trim();
    const slugInput = String(form.get("slug") || "").trim();
    const planInput = String(form.get("plan") || "free").trim();

    if (!name) {
      return fail(400, {
        action: "createWorkspace",
        message: "Workspace name is required.",
      });
    }

    const allowedPlans = new Set([
      "free",
      "kag_api",
      "kag_teams",
      "enterprise",
    ]);
    const plan = allowedPlans.has(planInput) ? planInput : "free";

    try {
      const workspace = await createWorkspace(
        {
          name,
          slug: uniqueSlug(slugify(slugInput || name, "workspace")),
          plan,
        },
        { client: supabase },
      );

      throw redirect(303, `/dashboard?ws=${workspace.id}`);
    } catch (error) {
      return fail(500, {
        action: "createWorkspace",
        message: toMessage(error, "Failed to create workspace."),
      });
    }
  },

  createGraph: async (event) => {
    const supabase = getSupabase(event);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw redirect(303, "/auth/login");
    }

    const form = await event.request.formData();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const name = String(form.get("name") || "").trim() || "Untitled Graph";
    const description = String(form.get("description") || "").trim() || null;

    if (!workspaceId) {
      return fail(400, {
        action: "createGraph",
        message: "Workspace is required.",
      });
    }

    try {
      const graph = await upsertGraphRecord(
        {
          workspaceId,
          name,
          slug: uniqueSlug(slugify(name, "graph")),
          description,
          isPublic: false,
          metadata: {},
        },
        { client: supabase },
      );

      throw redirect(303, `/graph/${graph.id}`);
    } catch (error) {
      return fail(500, {
        action: "createGraph",
        message: toMessage(error, "Failed to create graph."),
      });
    }
  },
};
