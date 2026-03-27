import { fail, redirect } from "@sveltejs/kit";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "$lib/supabase/server";
import {
  createWorkspace,
  deleteWorkspace,
  listMyWorkspaces,
  listWorkspaceGraphs,
  listWorkspaceMembers,
  updateWorkspace,
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

function getAdminClientOrNull() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

function isRlsError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("violates row-level security policy")
  );
}

async function createWorkspaceAsAdmin({
  adminClient,
  userId,
  name,
  slug,
  plan,
}) {
  const { data: workspace, error: createError } = await adminClient
    .from("workspaces")
    .insert({
      name,
      slug,
      plan,
      created_by: userId,
      metadata: {},
    })
    .select("id, name, slug, plan, metadata, created_at, updated_at")
    .single();

  if (createError) {
    throw new Error(
      `Failed to create workspace: ${createError.message || "unknown error"}`,
    );
  }

  const { error: memberError } = await adminClient
    .from("workspace_members")
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: userId,
        role: "owner",
        invited_by: userId,
      },
      { onConflict: "workspace_id,user_id" },
    );

  if (memberError) {
    await adminClient.from("workspaces").delete().eq("id", workspace.id);
    throw new Error(
      `Failed to create workspace membership: ${memberError.message || "unknown error"}`,
    );
  }

  return workspace;
}

async function updateWorkspaceAsAdmin({
  adminClient,
  workspaceId,
  name,
  slug,
  plan,
}) {
  const { data, error } = await adminClient
    .from("workspaces")
    .update({ name, slug, plan })
    .eq("id", workspaceId)
    .select("id, name, slug, plan, metadata, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(
      `Failed to update workspace: ${error.message || "unknown error"}`,
    );
  }

  return data;
}

async function deleteWorkspaceAsAdmin({ adminClient, workspaceId }) {
  const { error } = await adminClient
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (error) {
    throw new Error(
      `Failed to delete workspace: ${error.message || "unknown error"}`,
    );
  }
}

function requireOwnerRole(workspace, actionLabel = "perform this action") {
  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  if (workspace.role !== "owner") {
    throw new Error(`Only workspace owners can ${actionLabel}.`);
  }
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
    const adminClient = getAdminClientOrNull();

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

    const payload = {
      name,
      slug: uniqueSlug(slugify(slugInput || name, "workspace")),
      plan,
    };

    try {
      const workspace = await createWorkspace(payload, { client: supabase });
      throw redirect(303, `/dashboard?ws=${workspace.id}`);
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;

      if (adminClient && isRlsError(error)) {
        try {
          const workspace = await createWorkspaceAsAdmin({
            adminClient,
            userId: user.id,
            ...payload,
          });
          throw redirect(303, `/dashboard?ws=${workspace.id}`);
        } catch (adminError) {
          return fail(500, {
            action: "createWorkspace",
            message: toMessage(adminError, "Failed to create workspace."),
          });
        }
      }

      return fail(500, {
        action: "createWorkspace",
        message: toMessage(error, "Failed to create workspace."),
      });
    }
  },

  updateWorkspace: async (event) => {
    const supabase = getSupabase(event);
    const adminClient = getAdminClientOrNull();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw redirect(303, "/auth/login");
    }

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
      const workspaces = await listMyWorkspaces({ client: supabase });
      const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
      requireOwnerRole(currentWorkspace, "update this workspace");

      const payload = {
        name,
        slug: slugInput || slugify(name, "workspace"),
        plan,
      };

      try {
        const workspace = await updateWorkspace(workspaceId, payload, {
          client: supabase,
        });
        throw redirect(303, `/dashboard?ws=${workspace.id}`);
      } catch (error) {
        if (adminClient && isRlsError(error)) {
          const workspace = await updateWorkspaceAsAdmin({
            adminClient,
            workspaceId,
            ...payload,
          });
          throw redirect(303, `/dashboard?ws=${workspace.id}`);
        }
        throw error;
      }
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "updateWorkspace",
        message: toMessage(error, "Failed to update workspace."),
      });
    }
  },

  deleteWorkspace: async (event) => {
    const supabase = getSupabase(event);
    const adminClient = getAdminClientOrNull();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw redirect(303, "/auth/login");
    }

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

      requireOwnerRole(workspace, "delete this workspace");

      if (!confirmName || confirmName !== workspace.name) {
        return fail(400, {
          action: "deleteWorkspace",
          message:
            "Confirmation name does not match. Type the exact workspace name to delete.",
        });
      }

      try {
        await deleteWorkspace(workspaceId, { client: supabase });
      } catch (error) {
        if (!(adminClient && isRlsError(error))) throw error;
        await deleteWorkspaceAsAdmin({ adminClient, workspaceId });
      }

      throw redirect(303, "/dashboard");
    } catch (error) {
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "deleteWorkspace",
        message: toMessage(error, "Failed to delete workspace."),
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
      if (error?.status && error.status >= 300 && error.status < 400)
        throw error;
      return fail(500, {
        action: "createGraph",
        message: toMessage(error, "Failed to create graph."),
      });
    }
  },
};
