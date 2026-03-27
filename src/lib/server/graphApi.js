// ProjectAmp2/bendscript.com/src/lib/server/graphApi.js
import { hashApiKey } from "$lib/server/apiAuth";

const EDGE_KINDS = new Set([
  "context",
  "causal",
  "temporal",
  "associative",
  "user",
]);
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SUBGRAPH_DEPTH = 2;
const DEFAULT_MAX_HOPS = 4;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function getClient(client) {
  invariant(client, "Supabase client is required.");
  return client;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function normalizeEdgeKinds(edgeKinds) {
  if (!Array.isArray(edgeKinds) || edgeKinds.length === 0) return null;
  const kinds = edgeKinds
    .map((k) =>
      String(k || "")
        .trim()
        .toLowerCase(),
    )
    .filter((k) => EDGE_KINDS.has(k));
  return kinds.length ? Array.from(new Set(kinds)) : null;
}

function safeText(input, max = 4000) {
  return String(input ?? "")
    .trim()
    .slice(0, max);
}

function tokenizeQuestion(question) {
  const words = safeText(question, 1200)
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((w) => w.length >= 3);
  return Array.from(new Set(words));
}

function dedupeById(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const id = row?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

function shapeNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    workspace_id: node.workspace_id,
    graph_id: node.graph_id,
    plane_id: node.plane_id,
    text: node.text,
    markdown: node.markdown ?? null,
    type: node.type,
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    pinned: !!node.pinned,
    portal_plane_id: node.portal_plane_id ?? null,
    metadata: node.metadata ?? {},
    created_at: node.created_at ?? null,
    updated_at: node.updated_at ?? null,
  };
}

function shapeEdge(edge) {
  if (!edge) return null;
  return {
    id: edge.id,
    workspace_id: edge.workspace_id,
    graph_id: edge.graph_id,
    plane_id: edge.plane_id,
    from: edge.node_a,
    to: edge.node_b,
    label: edge.label || "",
    kind: edge.kind || "context",
    strength: Number(edge.strength) || 1,
    metadata: edge.metadata ?? {},
    created_at: edge.created_at ?? null,
    updated_at: edge.updated_at ?? null,
  };
}

async function resolveNodeByQuery({
  client,
  workspaceId,
  graphId = null,
  query,
  planeId = null,
}) {
  const results = await searchNodes({
    client,
    workspaceId,
    graphId,
    query,
    limit: 1,
    planeId,
  });

  return results.nodes[0] || null;
}

/**
 * API key authentication helper for REST/MCP routes.
 * Returns key record + workspace scope when valid.
 */
export async function authenticateApiKey({ client, apiKey }) {
  const c = getClient(client);
  const raw = safeText(apiKey, 512);

  if (!raw) return { ok: false, error: "Missing API key." };

  const prefix = raw.slice(0, 12);
  const keyHash = await hashApiKey(raw);

  const { data, error } = await c
    .from("api_keys")
    .select(
      "id, workspace_id, name, key_prefix, key_hash, scopes, is_active, expires_at, created_by, last_used_at",
    )
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error)
    return { ok: false, error: error.message || "API key lookup failed." };
  if (!data) return { ok: false, error: "Invalid API key." };
  if (
    data.key_prefix &&
    prefix &&
    !String(raw).startsWith(String(data.key_prefix))
  ) {
    return { ok: false, error: "Invalid API key prefix." };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "API key expired." };
  }

  return {
    ok: true,
    key: {
      id: data.id,
      workspace_id: data.workspace_id,
      name: data.name,
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      created_by: data.created_by ?? null,
    },
  };
}

/**
 * Best-effort API usage logging helper.
 */
export async function recordApiKeyEvent({
  client,
  apiKeyId = null,
  workspaceId = null,
  route = null,
  method = null,
  statusCode = null,
  ip = null,
  userAgent = null,
  requestId = null,
}) {
  const c = getClient(client);
  try {
    await c.from("api_key_events").insert({
      api_key_id: apiKeyId,
      workspace_id: workspaceId,
      route,
      method,
      status_code: statusCode,
      ip,
      user_agent: userAgent,
      request_id: requestId,
    });
  } catch {
    // Intentionally swallow logging errors.
  }
}

/**
 * Semantic-ish node search using text match fallback.
 */
export async function searchNodes({
  client,
  workspaceId,
  graphId = null,
  planeId = null,
  query,
  limit = DEFAULT_SEARCH_LIMIT,
}) {
  const c = getClient(client);
  const q = safeText(query, 400);
  invariant(workspaceId, "workspaceId is required.");
  invariant(q, "query is required.");

  const cappedLimit = clamp(limit, 1, 100);

  let dbQuery = c
    .from("nodes")
    .select(
      "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, pinned, portal_plane_id, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .ilike("text", `%${q}%`)
    .limit(cappedLimit);

  if (graphId) dbQuery = dbQuery.eq("graph_id", graphId);
  if (planeId) dbQuery = dbQuery.eq("plane_id", planeId);

  const { data, error } = await dbQuery;
  if (error) throw new Error(`searchNodes failed: ${error.message}`);

  const nodes = dedupeById(data || [])
    .map(shapeNode)
    .filter(Boolean);

  return {
    nodes,
    meta: {
      query: q,
      count: nodes.length,
      limit: cappedLimit,
    },
  };
}

/**
 * List planes in a workspace/graph.
 */
export async function listPlanes({ client, workspaceId, graphId }) {
  const c = getClient(client);
  invariant(workspaceId, "workspaceId is required.");
  invariant(graphId, "graphId is required.");

  const { data, error } = await c
    .from("graph_planes")
    .select(
      "id, workspace_id, graph_id, name, parent_plane_id, parent_node_id, is_root, camera_x, camera_y, camera_zoom, tick, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("graph_id", graphId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`listPlanes failed: ${error.message}`);

  return {
    planes: (data || []).map((p) => ({
      id: p.id,
      workspace_id: p.workspace_id,
      graph_id: p.graph_id,
      name: p.name,
      parent_plane_id: p.parent_plane_id ?? null,
      parent_node_id: p.parent_node_id ?? null,
      is_root: !!p.is_root,
      camera: {
        x: Number(p.camera_x) || 0,
        y: Number(p.camera_y) || 0,
        zoom: Number(p.camera_zoom) || 1,
      },
      tick: Number(p.tick) || 0,
      metadata: p.metadata ?? {},
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
    })),
  };
}

/**
 * Get N-hop subgraph from a seed node.
 */
export async function getSubgraph({
  client,
  workspaceId,
  graphId,
  nodeId,
  depth = DEFAULT_SUBGRAPH_DEPTH,
  edgeKinds = null,
}) {
  const c = getClient(client);
  invariant(workspaceId, "workspaceId is required.");
  invariant(graphId, "graphId is required.");
  invariant(nodeId, "nodeId is required.");

  const hops = clamp(depth, 0, 6);
  const allowedKinds = normalizeEdgeKinds(edgeKinds);

  let edgeQuery = c
    .from("edges")
    .select(
      "id, workspace_id, graph_id, plane_id, node_a, node_b, label, kind, strength, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("graph_id", graphId);

  if (allowedKinds) edgeQuery = edgeQuery.in("kind", allowedKinds);

  const [
    { data: edges, error: edgeError },
    { data: seedRows, error: seedError },
  ] = await Promise.all([
    edgeQuery,
    c
      .from("nodes")
      .select(
        "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, pinned, portal_plane_id, metadata, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("graph_id", graphId)
      .eq("id", nodeId)
      .limit(1),
  ]);

  if (edgeError)
    throw new Error(`getSubgraph edges failed: ${edgeError.message}`);
  if (seedError)
    throw new Error(`getSubgraph seed node failed: ${seedError.message}`);
  if (!seedRows?.length) {
    return { nodes: [], edges: [], root_node_id: nodeId, depth: hops };
  }

  const edgeRows = edges || [];
  const visited = new Set([nodeId]);
  let frontier = new Set([nodeId]);

  for (let i = 0; i < hops; i++) {
    const next = new Set();
    for (const e of edgeRows) {
      if (frontier.has(e.node_a) && !visited.has(e.node_b)) next.add(e.node_b);
      if (frontier.has(e.node_b) && !visited.has(e.node_a)) next.add(e.node_a);
    }
    if (next.size === 0) break;
    for (const id of next) visited.add(id);
    frontier = next;
  }

  const nodeIds = Array.from(visited);
  const subEdges = edgeRows.filter(
    (e) => visited.has(e.node_a) && visited.has(e.node_b),
  );

  const { data: nodes, error: nodeError } = await c
    .from("nodes")
    .select(
      "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, pinned, portal_plane_id, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("graph_id", graphId)
    .in("id", nodeIds);

  if (nodeError)
    throw new Error(`getSubgraph nodes failed: ${nodeError.message}`);

  return {
    root_node_id: nodeId,
    depth: hops,
    nodes: (nodes || []).map(shapeNode).filter(Boolean),
    edges: subEdges.map(shapeEdge).filter(Boolean),
  };
}

/**
 * Find shortest path (undirected traversal) between two nodes.
 * You can provide node IDs directly or free-text queries for endpoints.
 */
export async function traversePath({
  client,
  workspaceId,
  graphId,
  fromNodeId = null,
  toNodeId = null,
  fromQuery = null,
  toQuery = null,
  maxHops = DEFAULT_MAX_HOPS,
  edgeKinds = null,
  planeId = null,
}) {
  const c = getClient(client);
  invariant(workspaceId, "workspaceId is required.");
  invariant(graphId, "graphId is required.");

  let sourceId = fromNodeId ? String(fromNodeId) : null;
  let targetId = toNodeId ? String(toNodeId) : null;

  if (!sourceId && fromQuery) {
    const n = await resolveNodeByQuery({
      client: c,
      workspaceId,
      graphId,
      query: fromQuery,
      planeId,
    });
    sourceId = n?.id ?? null;
  }

  if (!targetId && toQuery) {
    const n = await resolveNodeByQuery({
      client: c,
      workspaceId,
      graphId,
      query: toQuery,
      planeId,
    });
    targetId = n?.id ?? null;
  }

  if (!sourceId || !targetId) {
    return {
      found: false,
      reason: "Unable to resolve source/target node.",
      path: [],
      nodes: [],
      edges: [],
    };
  }

  if (sourceId === targetId) {
    const { data: onlyNode } = await c
      .from("nodes")
      .select(
        "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, pinned, portal_plane_id, metadata, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("graph_id", graphId)
      .eq("id", sourceId)
      .limit(1);

    const node = onlyNode?.[0] ? shapeNode(onlyNode[0]) : null;
    return {
      found: true,
      path: [sourceId],
      nodes: node ? [node] : [],
      edges: [],
    };
  }

  const allowedKinds = normalizeEdgeKinds(edgeKinds);

  let edgeQuery = c
    .from("edges")
    .select(
      "id, workspace_id, graph_id, plane_id, node_a, node_b, label, kind, strength, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("graph_id", graphId);

  if (planeId) edgeQuery = edgeQuery.eq("plane_id", planeId);
  if (allowedKinds) edgeQuery = edgeQuery.in("kind", allowedKinds);

  const { data: edges, error } = await edgeQuery;
  if (error) throw new Error(`traversePath failed: ${error.message}`);

  const edgeRows = edges || [];
  const adjacency = new Map(); // nodeId -> Array<{to, edge}>
  for (const e of edgeRows) {
    if (!adjacency.has(e.node_a)) adjacency.set(e.node_a, []);
    if (!adjacency.has(e.node_b)) adjacency.set(e.node_b, []);
    adjacency.get(e.node_a).push({ to: e.node_b, edge: e });
    adjacency.get(e.node_b).push({ to: e.node_a, edge: e });
  }

  const hopCap = clamp(maxHops, 1, 10);
  const queue = [{ id: sourceId, hops: 0 }];
  const parent = new Map(); // nodeId -> { prevNodeId, edge }
  const visited = new Set([sourceId]);

  let found = false;
  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    if (cur.id === targetId) {
      found = true;
      break;
    }
    if (cur.hops >= hopCap) continue;

    const neighbors = adjacency.get(cur.id) || [];
    for (const n of neighbors) {
      if (visited.has(n.to)) continue;
      visited.add(n.to);
      parent.set(n.to, { prev: cur.id, edge: n.edge });
      queue.push({ id: n.to, hops: cur.hops + 1 });
    }
  }

  if (!found) {
    return {
      found: false,
      reason: "No path found within hop limit.",
      path: [],
      nodes: [],
      edges: [],
    };
  }

  const pathNodeIds = [];
  const pathEdgesRaw = [];
  let cursor = targetId;
  while (cursor) {
    pathNodeIds.push(cursor);
    const p = parent.get(cursor);
    if (!p) break;
    pathEdgesRaw.push(p.edge);
    cursor = p.prev;
  }
  pathNodeIds.reverse();
  pathEdgesRaw.reverse();

  const { data: pathNodes, error: pathNodeError } = await c
    .from("nodes")
    .select(
      "id, workspace_id, graph_id, plane_id, text, markdown, type, x, y, pinned, portal_plane_id, metadata, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("graph_id", graphId)
    .in("id", pathNodeIds);

  if (pathNodeError)
    throw new Error(`traversePath node fetch failed: ${pathNodeError.message}`);

  const nodeById = new Map((pathNodes || []).map((n) => [n.id, shapeNode(n)]));
  const orderedNodes = pathNodeIds
    .map((id) => nodeById.get(id))
    .filter(Boolean);

  return {
    found: true,
    hops: pathNodeIds.length - 1,
    path: pathNodeIds,
    nodes: orderedNodes,
    edges: pathEdgesRaw.map(shapeEdge).filter(Boolean),
  };
}

/**
 * Natural-language graph query helper:
 * - extracts terms
 * - runs node search
 * - optionally computes a path between top candidates
 */
export async function queryGraph({
  client,
  workspaceId,
  graphId,
  question,
  limit = 12,
  maxHops = DEFAULT_MAX_HOPS,
}) {
  const c = getClient(client);
  invariant(workspaceId, "workspaceId is required.");
  invariant(graphId, "graphId is required.");
  invariant(question, "question is required.");

  const terms = tokenizeQuestion(question).slice(0, 5);
  const queries = terms.length ? terms : [safeText(question, 120)];

  const searchResults = [];
  for (const q of queries) {
    const res = await searchNodes({
      client: c,
      workspaceId,
      graphId,
      query: q,
      limit: clamp(limit, 1, 30),
    });
    for (const node of res.nodes) searchResults.push(node);
  }

  const nodes = dedupeById(searchResults);
  const source = nodes[0] || null;
  const target = nodes.length > 1 ? nodes[nodes.length - 1] : null;

  let path = null;
  if (source && target && source.id !== target.id) {
    path = await traversePath({
      client: c,
      workspaceId,
      graphId,
      fromNodeId: source.id,
      toNodeId: target.id,
      maxHops,
    });
  }

  return {
    question: safeText(question, 2000),
    terms,
    candidates: nodes,
    reasoning_path: path,
    answer_hint: path?.found
      ? `Found a ${path.hops}-hop path between "${source.text}" and "${target.text}".`
      : nodes.length
        ? `Found ${nodes.length} candidate nodes, but no strong path yet.`
        : "No matching nodes found.",
  };
}

export default {
  authenticateApiKey,
  recordApiKeyEvent,
  searchNodes,
  listPlanes,
  getSubgraph,
  traversePath,
  queryGraph,
};
