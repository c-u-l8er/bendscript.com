import { createSupabaseAdminClient } from "$lib/supabase/server";
import { requireApiKeyAuth } from "$lib/server/apiAuth";

const amp = (c) => c.schema("amp");
const kag = (c) => c.schema("kag");

export const prerender = false;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-api-key, content-type, x-request-id",
};

function apiJson(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

function toErrorResponse(err) {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message =
    err?.body?.message ||
    err?.message ||
    "Unexpected error while listing workspaces.";

  return apiJson(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

/**
 * GET /api/v1/workspaces
 * API key authenticated endpoint.
 *
 * Since API keys are workspace-scoped, this endpoint returns the single
 * workspace bound to the key in a list shape.
 */
export async function GET(event) {
  try {
    const supabase = createSupabaseAdminClient();

    const auth = await requireApiKeyAuth(event, {
      supabase,
      requiredScopes: ["read"],
      route: "/api/v1/workspaces",
    });

    const workspaceId = auth.workspaceId;

    const [
      { data: workspace, error: workspaceError },
      { count: graphCount, error: graphCountError },
      { count: memberCount, error: memberCountError },
      { count: activeKeyCount, error: activeKeyCountError },
      { data: recentGraphs, error: recentGraphsError },
    ] = await Promise.all([
      amp(supabase)
        .from("workspaces")
        .select("id, name, slug, plan, metadata, created_at, updated_at")
        .eq("id", workspaceId)
        .maybeSingle(),

      kag(supabase)
        .from("graphs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false),

      amp(supabase)
        .from("workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),

      kag(supabase)
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true),

      kag(supabase)
        .from("graphs")
        .select("id, name, slug, description, is_public, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    if (workspaceError) throw workspaceError;
    if (graphCountError) throw graphCountError;
    if (memberCountError) throw memberCountError;
    if (activeKeyCountError) throw activeKeyCountError;
    if (recentGraphsError) throw recentGraphsError;

    if (!workspace) {
      return apiJson(
        {
          ok: false,
          error: "Workspace not found for this API key.",
        },
        { status: 404 },
      );
    }

    return apiJson({
      ok: true,
      workspaces: [
        {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          metadata: workspace.metadata || {},
          createdAt: workspace.created_at,
          updatedAt: workspace.updated_at,
          role: "api_key",
          stats: {
            graphs: graphCount ?? 0,
            members: memberCount ?? 0,
            activeApiKeys: activeKeyCount ?? 0,
          },
          recentGraphs: (recentGraphs || []).map((g) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            description: g.description,
            isPublic: !!g.is_public,
            updatedAt: g.updated_at,
          })),
        },
      ],
      meta: {
        count: 1,
        source: "api_key",
        workspaceId,
        keyPrefix: auth.keyPrefix || null,
        scopes: auth.scopes || [],
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
