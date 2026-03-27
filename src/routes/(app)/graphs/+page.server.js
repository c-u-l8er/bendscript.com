import { fail, redirect } from "@sveltejs/kit";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "$lib/supabase/server";
import {
  listMyWorkspaces,
  listWorkspaceGraphs,
  upsertGraphRecord,
} from "$lib/supabase/queries";

function getSupabase(event) {
  return event.locals?.supabase ?? createSupabaseServerClient(event);
}

function getAdminClientOrNull() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

function toMessage(error, fallback = "Unexpected error") {
  return error?.message || error?.details || fallback;
}

function slugify(input, fallback = "graph") {
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
  const workspace = String(url.searchParams.get("workspace") || "").trim();
  if (workspace) return workspace;

  const ws = String(url.searchParams.get("ws") || "").trim();
  if (ws) return ws;

  return null;
}

function normalizeGraphIdParam(url) {
  const graph = String(url.searchParams.get("graph") || "").trim();
  return graph || null;
}

function pickActiveWorkspace(workspaces, requestedId) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) return null;
  if (requestedId) {
    const match = workspaces.find((w) => w.id === requestedId);
    if (match) return match;
  }
  return workspaces[0];
}

function pickActiveGraph(graphs, requestedId) {
  if (!Array.isArray(graphs) || graphs.length === 0) return null;
  if (requestedId) {
    const match = graphs.find((g) => g.id === requestedId);
    if (match) return match;
  }
  return graphs[0];
}

function isRlsError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("violates row-level security policy")
  );
}

function canManageGraphs(role) {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

async function requireUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw redirect(303, "/auth/login");
  }

  return user;
}

async function deleteGraphAsAdmin({ adminClient, graphId, workspaceId }) {
  const { error } = await adminClient
    .from("graphs")
    .delete()
    .eq("id", graphId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(
      `Failed to delete graph: ${error.message || "unknown error"}`,
    );
  }
}

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const supabase = getSupabase(event);
  await requireUser(supabase);

  let workspaces = [];
  try {
    workspaces = await listMyWorkspaces({ client: supabase });
  } catch {
    workspaces = [];
  }

  const requestedWorkspaceId = normalizeWorkspaceIdParam(event.url);
  const activeWorkspace = pickActiveWorkspace(workspaces, requestedWorkspaceId);

  let graphs = [];
  if (activeWorkspace?.id) {
    try {
      graphs = await listWorkspaceGraphs(activeWorkspace.id, {
        client: supabase,
      });
    } catch {
      graphs = [];
    }
  }

  const requestedGraphId = normalizeGraphIdParam(event.url);
  const activeGraph = pickActiveGraph(graphs, requestedGraphId);

  return {
    workspaces,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    activeWorkspace: activeWorkspace ?? null,
    graphs: Array.isArray(graphs) ? graphs : [],
    activeGraphId: activeGraph?.id ?? null,
    activeGraph: activeGraph ?? null,
  };
}

/** @type {import('./$types').Actions} */
export const actions = {
  createGraph: async (event) => {
    const supabase = getSupabase(event);
    await requireUser(supabase);

    const form = await event.request.formData();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const name = String(form.get("name") || "").trim() || "Untitled Graph";
    const description = String(form.get("description") || "").trim() || null;
    const isPublicInput = String(form.get("isPublic") || "")
      .trim()
      .toLowerCase();
    const isPublic = isPublicInput === "true" || isPublicInput === "on";

    if (!workspaceId) {
      return fail(400, {
        action: "createGraph",
        message: "Workspace is required.",
      });
    }

    try {
      const workspaces = await listMyWorkspaces({ client: supabase });
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (!workspace) {
        return fail(403, {
          action: "createGraph",
          message: "You do not have access to this workspace.",
        });
      }

      const graph = await upsertGraphRecord(
        {
          workspaceId,
          name,
          slug: uniqueSlug(slugify(name, "graph")),
          description,
          isPublic,
          metadata: {},
        },
        { client: supabase },
      );

      throw redirect(303, `/graphs?workspace=${workspaceId}&graph=${graph.id}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "createGraph",
        message: toMessage(error, "Failed to create graph."),
      });
    }
  },

  updateGraph: async (event) => {
    const supabase = getSupabase(event);
    await requireUser(supabase);

    const form = await event.request.formData();
    const graphId = String(form.get("graphId") || "").trim();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const name = String(form.get("name") || "").trim();
    const slugInput = String(form.get("slug") || "").trim();
    const description = String(form.get("description") || "").trim() || null;
    const isPublicInput = String(form.get("isPublic") || "")
      .trim()
      .toLowerCase();
    const isPublic = isPublicInput === "true" || isPublicInput === "on";

    if (!workspaceId || !graphId) {
      return fail(400, {
        action: "updateGraph",
        message: "Workspace and graph are required.",
      });
    }

    if (!name) {
      return fail(400, {
        action: "updateGraph",
        message: "Graph name is required.",
      });
    }

    try {
      const workspaces = await listMyWorkspaces({ client: supabase });
      const workspace = workspaces.find((w) => w.id === workspaceId);

      if (!workspace) {
        return fail(403, {
          action: "updateGraph",
          message: "You do not have access to this workspace.",
        });
      }

      const graph = await upsertGraphRecord(
        {
          graphId,
          workspaceId,
          name,
          slug: slugInput || slugify(name, "graph"),
          description,
          isPublic,
          metadata: {},
        },
        { client: supabase },
      );

      throw redirect(303, `/graphs?workspace=${workspaceId}&graph=${graph.id}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "updateGraph",
        message: toMessage(error, "Failed to update graph."),
      });
    }
  },

  deleteGraph: async (event) => {
    const supabase = getSupabase(event);
    const adminClient = getAdminClientOrNull();
    await requireUser(supabase);

    const form = await event.request.formData();
    const graphId = String(form.get("graphId") || "").trim();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const confirmName = String(form.get("confirmName") || "").trim();

    if (!workspaceId || !graphId) {
      return fail(400, {
        action: "deleteGraph",
        message: "Workspace and graph are required.",
      });
    }

    try {
      const workspaces = await listMyWorkspaces({ client: supabase });
      const workspace = workspaces.find((w) => w.id === workspaceId);

      if (!workspace) {
        return fail(403, {
          action: "deleteGraph",
          message: "You do not have access to this workspace.",
        });
      }

      if (!canManageGraphs(workspace.role)) {
        return fail(403, {
          action: "deleteGraph",
          message: "Only workspace owners/admins can delete graphs.",
        });
      }

      const graphs = await listWorkspaceGraphs(workspaceId, {
        client: supabase,
      });
      const graph = graphs.find((g) => g.id === graphId);

      if (!graph) {
        return fail(404, {
          action: "deleteGraph",
          message: "Graph not found.",
        });
      }

      if (!confirmName || confirmName !== graph.name) {
        return fail(400, {
          action: "deleteGraph",
          message:
            "Confirmation name does not match. Type the exact graph name to delete.",
        });
      }

      try {
        const { error } = await supabase
          .from("graphs")
          .delete()
          .eq("id", graphId)
          .eq("workspace_id", workspaceId);

        if (error) throw error;
      } catch (error) {
        if (!(adminClient && isRlsError(error))) throw error;
        await deleteGraphAsAdmin({ adminClient, graphId, workspaceId });
      }

      throw redirect(303, `/graphs?workspace=${workspaceId}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "deleteGraph",
        message: toMessage(error, "Failed to delete graph."),
      });
    }
  },
};
