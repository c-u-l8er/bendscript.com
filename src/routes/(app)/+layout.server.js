// ProjectAmp2/bendscript.com/src/routes/(app)/+layout.server.js
import { redirect } from "@sveltejs/kit";
import { env as publicEnv } from "$env/dynamic/public";
import { env as privateEnv } from "$env/dynamic/private";
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
        updatedAt: workspace.updated_at || null,
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
    supabase.auth.getUser(),
  ]);

  return {
    session: sessionData?.session ?? null,
    user: userData?.user ?? null,
  };
}

function pickActiveWorkspace({
  workspaces,
  cookieWorkspaceId,
  queryWorkspaceId,
}) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    return {
      currentWorkspace: null,
      currentRole: null,
      currentWorkspaceId: null,
    };
  }

  const requestedId = queryWorkspaceId || cookieWorkspaceId;
  const selected =
    (requestedId && workspaces.find((w) => w.id === requestedId)) ||
    workspaces[0] ||
    null;

  return {
    currentWorkspace: selected,
    currentRole: selected?.role ?? null,
    currentWorkspaceId: selected?.id ?? null,
  };
}

function getIntegrationStatus() {
  const pickFirst = (sources, keys) => {
    for (const key of keys) {
      for (const source of sources) {
        const value = source?.[key];
        if (typeof value === "string" && value.trim().length > 0) {
          return { key, value: value.trim() };
        }
      }
    }
    return { key: null, value: "" };
  };

  const supabaseUrl = pickFirst(
    [publicEnv],
    ["PUBLIC_SUPABASE_URL", "VITE_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"],
  );

  const supabaseAnonKey = pickFirst(
    [publicEnv],
    [
      "PUBLIC_SUPABASE_ANON_KEY",
      "VITE_PUBLIC_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_ANON_KEY",
    ],
  );

  const serviceRoleKey = pickFirst(
    [privateEnv],
    ["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY"],
  );

  const hasSupabaseUrl = Boolean(supabaseUrl.value);
  const hasSupabaseAnonKey = Boolean(supabaseAnonKey.value);
  const hasServiceRole = Boolean(serviceRoleKey.value);

  const supabaseConfigured = hasSupabaseUrl && hasSupabaseAnonKey;
  const apiInfraConfigured = supabaseConfigured && hasServiceRole;

  // AI proxy runs as a Supabase Edge Function and its provider key is managed
  // in Supabase function secrets, not this SvelteKit server environment.
  // Treat it as available when Supabase client integration is configured.
  const aiProxyConfigured = supabaseConfigured;

  return {
    mode: supabaseConfigured ? "cloud" : "prototype_local",
    supabase: {
      configured: supabaseConfigured,
      missing: [
        !hasSupabaseUrl
          ? "PUBLIC_SUPABASE_URL|VITE_PUBLIC_SUPABASE_URL|VITE_SUPABASE_URL"
          : null,
        !hasSupabaseAnonKey
          ? "PUBLIC_SUPABASE_ANON_KEY|VITE_PUBLIC_SUPABASE_ANON_KEY|VITE_SUPABASE_ANON_KEY"
          : null,
      ].filter(Boolean),
    },
    api: {
      configured: apiInfraConfigured,
      missing: [
        !hasServiceRole
          ? "SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY"
          : null,
      ].filter(Boolean),
    },
    aiProxy: {
      configured: aiProxyConfigured,
      missing: [],
    },
    realtime: {
      configured: supabaseConfigured,
    },
    graphPersistence: {
      configured: supabaseConfigured,
    },
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
      .schema("amp")
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
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    workspaces = normalizeMembershipRows(data || []);
  } catch (err) {
    console.warn(
      "Failed to load workspace memberships in app layout guard:",
      err,
    );
    workspaces = [];
  }

  const cookieWorkspaceId = cookies.get(WORKSPACE_COOKIE) || null;
  const queryWorkspaceId =
    url.searchParams.get("workspace") || url.searchParams.get("ws") || null;

  const { currentWorkspace, currentRole, currentWorkspaceId } =
    pickActiveWorkspace({
      workspaces,
      cookieWorkspaceId,
      queryWorkspaceId,
    });

  if (currentWorkspaceId && currentWorkspaceId !== cookieWorkspaceId) {
    cookies.set(WORKSPACE_COOKIE, currentWorkspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return {
    session,
    user,
    workspaces,
    currentWorkspace,
    currentRole,
    currentWorkspaceId,
    integration: getIntegrationStatus(),
  };
}
