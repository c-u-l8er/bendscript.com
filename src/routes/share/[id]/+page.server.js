import { error } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$lib/supabase/server";

export const prerender = false;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeNodeType(type) {
  return type === "stargate" ? "stargate" : "normal";
}

function normalizeEdgeKind(kind) {
  const allowed = new Set(["context", "causal", "temporal", "associative", "user"]);
  return allowed.has(kind) ? kind : "context";
}

function buildPrototypeState({ graph, planes = [], nodes = [], edges = [] }) {
  const planeMap = new Map();

  for (const p of planes) {
    planeMap.set(p.id, {
      id: p.id,
      name: p.name || "Graph Plane",
      parentPlaneId: p.parent_plane_id ?? null,
      parentNodeId: p.parent_node_id ?? null,
      nodes: [],
      edges: [],
      camera: {
        x: toNumber(p.camera_x, 0),
        y: toNumber(p.camera_y, 0),
        zoom: toNumber(p.camera_zoom, 1),
      },
      tick: toNumber(p.tick, 0),
    });
  }

  for (const n of nodes) {
    const plane = planeMap.get(n.plane_id);
    if (!plane) continue;

    plane.nodes.push({
      id: n.id,
      text: n.text || "",
      x: toNumber(n.x, 0),
      y: toNumber(n.y, 0),
      vx: toNumber(n.vx, 0),
      vy: toNumber(n.vy, 0),
      fx: toNumber(n.fx, 0),
      fy: toNumber(n.fy, 0),
      pinned: !!n.pinned,
      type: normalizeNodeType(n.type),
      portalPlaneId: n.portal_plane_id ?? null,
      pulse: Math.random() * Math.PI * 2,
      createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
      width: Number.isFinite(Number(n.width)) ? Number(n.width) : null,
      height: Number.isFinite(Number(n.height)) ? Number(n.height) : null,
      scrollY: toNumber(n.scroll_y, 0),
      markdown: n.markdown ?? "",
      metadata: n.metadata ?? {},
    });
  }

  for (const e of edges) {
    const plane = planeMap.get(e.plane_id);
    if (!plane) continue;

    plane.edges.push({
      id: e.id,
      a: e.node_a,
      b: e.node_b,
      flowOffset: toNumber(e.flow_offset, Math.random()),
      props: {
        label: String(e.label || "").slice(0, 80),
        kind: normalizeEdgeKind(e.kind),
        strength: Math.max(1, Math.min(5, toNumber(e.strength, 1))),
      },
      metadata: e.metadata ?? {},
    });
  }

  const planesObj = Object.fromEntries(Array.from(planeMap.entries()));
  const fallbackRoot = planes.find((p) => p.is_root)?.id || planes[0]?.id || null;
  const rootPlaneId = graph.root_plane_id ?? fallbackRoot;
  const activePlaneId = rootPlaneId;

  return {
    version: 1,
    rootPlaneId,
    activePlaneId,
    planes: planesObj,
    ui: {
      selectedNodeId: null,
      selectedEdgeId: null,
      editMode: "preview",
      composerPos: { free: false, x: 0, y: 0 },
      mergeSourceNodeId: null,
      connectSourceNodeId: null,
      contextMenuState: { visible: false, x: 0, y: 0, nodeId: null },
      hintText: "Public share mode",
      markdownModal: {
        open: false,
        view: "preview",
        boundNodeId: null,
        closedByUser: false,
      },
    },
    cameraDefaults: { x: 0, y: 0, zoom: 1 },
  };
}

async function resolveSharedGraph(supabase, shareId) {
  // Preferred: explicit shared link table
  const { data: sharedLink, error: sharedLinkError } = await supabase
    .from("shared_graph_links")
    .select(
      `
      id,
      token,
      is_active,
      allow_download,
      expires_at,
      graph:graphs (
        id,
        workspace_id,
        name,
        slug,
        description,
        is_archived,
        is_public,
        share_token,
        root_plane_id,
        metadata,
        created_at,
        updated_at,
        workspace:workspaces (
          id,
          name,
          slug,
          plan
        )
      )
    `,
    )
    .eq("token", shareId)
    .eq("is_active", true)
    .maybeSingle();

  if (sharedLinkError) {
    throw new Error(`Failed to resolve share link: ${sharedLinkError.message}`);
  }

  if (sharedLink?.graph?.id) {
    if (
      sharedLink.expires_at &&
      Number.isFinite(Date.parse(sharedLink.expires_at)) &&
      Date.parse(sharedLink.expires_at) < Date.now()
    ) {
      throw error(410, "This share link has expired.");
    }

    return {
      graph: sharedLink.graph,
      share: {
        id: sharedLink.id,
        token: sharedLink.token,
        allowDownload: !!sharedLink.allow_download,
        isActive: !!sharedLink.is_active,
        expiresAt: sharedLink.expires_at ?? null,
      },
    };
  }

  // Fallback: legacy graph.share_token public links
  const { data: graph, error: graphError } = await supabase
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
      root_plane_id,
      metadata,
      created_at,
      updated_at,
      workspace:workspaces (
        id,
        name,
        slug,
        plan
      )
    `,
    )
    .eq("share_token", shareId)
    .eq("is_public", true)
    .maybeSingle();

  if (graphError) {
    throw new Error(`Failed to resolve shared graph: ${graphError.message}`);
  }

  if (!graph?.id) return null;

  return {
    graph,
    share: {
      id: null,
      token: graph.share_token,
      allowDownload: true,
      isActive: true,
      expiresAt: null,
    },
  };
}

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const shareId = String(event.params.id || "").trim();
  if (!shareId) {
    throw error(400, "Share id is required.");
  }

  const supabase = createSupabaseAdminClient();
  const resolved = await resolveSharedGraph(supabase, shareId);

  if (!resolved?.graph?.id) {
    throw error(404, "Shared graph not found.");
  }

  const graph = resolved.graph;
  if (graph.is_archived) {
    throw error(404, "Shared graph is not available.");
  }

  const [planesRes, nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("graph_planes")
      .select(
        "id, workspace_id, graph_id, name, parent_plane_id, parent_node_id, is_root, camera_x, camera_y, camera_zoom, tick, metadata, created_at, updated_at",
      )
      .eq("workspace_id", graph.workspace_id)
      .eq("graph_id", graph.id)
      .order("created_at", { ascending: true }),

    supabase
      .from("nodes")
      .select(
        "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, vx, vy, fx, fy, width, height, scroll_y, pinned, portal_plane_id, metadata, created_at, updated_at",
      )
      .eq("workspace_id", graph.workspace_id)
      .eq("graph_id", graph.id),

    supabase
      .from("edges")
      .select(
        "id, workspace_id, graph_id, plane_id, node_a, node_b, label, kind, strength, flow_offset, metadata, created_at, updated_at",
      )
      .eq("workspace_id", graph.workspace_id)
      .eq("graph_id", graph.id),
  ]);

  if (planesRes.error) {
    throw error(500, `Failed to load graph planes: ${planesRes.error.message}`);
  }
  if (nodesRes.error) {
    throw error(500, `Failed to load graph nodes: ${nodesRes.error.message}`);
  }
  if (edgesRes.error) {
    throw error(500, `Failed to load graph edges: ${edgesRes.error.message}`);
  }

  const prototypeState =
    graph.metadata?.prototype_state ??
    buildPrototypeState({
      graph,
      planes: planesRes.data || [],
      nodes: nodesRes.data || [],
      edges: edgesRes.data || [],
    });

  return {
    publicShare: true,
    canEdit: false,
    canDownload: !!resolved.share.allowDownload,
    share: {
      id: resolved.share.id,
      token: resolved.share.token,
      expiresAt: resolved.share.expiresAt,
      isActive: resolved.share.isActive,
    },
    workspace: graph.workspace
      ? {
          id: graph.workspace.id,
          name: graph.workspace.name,
          slug: graph.workspace.slug,
          plan: graph.workspace.plan,
        }
      : null,
    graph: {
      id: graph.id,
      workspaceId: graph.workspace_id,
      name: graph.name || "Shared Graph",
      slug: graph.slug || null,
      description: graph.description || null,
      isPublic: !!graph.is_public,
      createdAt: graph.created_at ?? null,
      updatedAt: graph.updated_at ?? null,
    },
    initialState: prototypeState,
  };
}
