import { fail, redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import {
  createWorkspace,
  deleteWorkspace,
  listMyWorkspaces,
  listWorkspaceGraphs,
  updateWorkspace,
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

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const supabase = getSupabase(event);
  await requireUser(supabase);

  let workspaces = [];
  try {
    const rows = await listMyWorkspaces({ client: supabase });

    const graphCounts = {};
    await Promise.all(
      rows.map(async (workspace) => {
        try {
          const graphs = await listWorkspaceGraphs(workspace.id, {
            client: supabase,
          });
          graphCounts[workspace.id] = Array.isArray(graphs) ? graphs.length : 0;
        } catch {
          graphCounts[workspace.id] = 0;
        }
      }),
    );

    workspaces = rows.map((workspace) => ({
      ...workspace,
      graphCount: graphCounts[workspace.id] ?? 0,
    }));
  } catch {
    workspaces = [];
  }

  const requestedWorkspaceId = normalizeWorkspaceIdParam(event.url);
  const activeWorkspace = pickActiveWorkspace(workspaces, requestedWorkspaceId);

  return {
    workspaces,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    activeWorkspace: activeWorkspace ?? null,
  };
}

/** @type {import('./$types').Actions} */
export const actions = {
  createWorkspace: async (event) => {
    const supabase = getSupabase(event);
    await requireUser(supabase);

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

      throw redirect(303, `/workspaces?ws=${workspace.id}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400) {
        throw error;
      }

      return fail(500, {
        action: "createWorkspace",
        message: toMessage(error, "Failed to create workspace."),
      });
    }
  },

  updateWorkspace: async (event) => {
    const supabase = getSupabase(event);
    await requireUser(supabase);

    const form = await event.request.formData();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const name = String(form.get("name") || "").trim();
    const slugInput = String(form.get("slug") || "").trim();
    const planInput = String(form.get("plan") || "free").trim();

    if (!workspaceId) {
      return fail(400, {
        action: "updateWorkspace",
        message: "Workspace is required.",
      });
    }

    if (!name) {
      return fail(400, {
        action: "updateWorkspace",
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
      const workspace = await updateWorkspace(
        workspaceId,
        {
          name,
          slug: slugInput || slugify(name, "workspace"),
          plan,
        },
        { client: supabase },
      );

      throw redirect(303, `/workspaces?ws=${workspace.id}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400) {
        throw error;
      }

      return fail(500, {
        action: "updateWorkspace",
        message: toMessage(error, "Failed to update workspace."),
      });
    }
  },

  deleteWorkspace: async (event) => {
    const supabase = getSupabase(event);
    await requireUser(supabase);

    const form = await event.request.formData();
    const workspaceId = String(form.get("workspaceId") || "").trim();
    const confirmName = String(form.get("confirmName") || "").trim();

    if (!workspaceId) {
      return fail(400, {
        action: "deleteWorkspace",
        message: "Workspace is required.",
      });
    }

    try {
      const workspaces = await listMyWorkspaces({ client: supabase });
      const workspace = workspaces.find((w) => w.id === workspaceId);

      if (!workspace) {
        return fail(404, {
          action: "deleteWorkspace",
          message: "Workspace not found.",
        });
      }

      if (!confirmName || confirmName !== workspace.name) {
        return fail(400, {
          action: "deleteWorkspace",
          message:
            "Confirmation name does not match. Type the exact workspace name to delete.",
        });
      }

      await deleteWorkspace(workspaceId, { client: supabase });
      throw redirect(303, "/workspaces");
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400) {
        throw error;
      }

      return fail(500, {
        action: "deleteWorkspace",
        message: toMessage(error, "Failed to delete workspace."),
      });
    }
  },
};
