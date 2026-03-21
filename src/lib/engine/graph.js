import { clamp, rand, trimText, uid } from "./utils";

export const NODE_TYPES = ["normal", "stargate"];
export const EDGE_KINDS = [
  "context",
  "causal",
  "temporal",
  "associative",
  "user",
];

const NODE_TYPE_SET = new Set(NODE_TYPES);
const EDGE_KIND_SET = new Set(EDGE_KINDS);

export function normalizeNodeType(type) {
  return NODE_TYPE_SET.has(type) ? type : "normal";
}

export function normalizeEdgeProps(props = {}) {
  return {
    label: String(props.label || "").slice(0, 80),
    kind: EDGE_KIND_SET.has(props.kind) ? props.kind : "context",
    strength: clamp(Number(props.strength) || 1, 1, 5),
  };
}

export function newPlane({
  id = uid("plane"),
  name = "Graph Plane",
  parentPlaneId = null,
  parentNodeId = null,
  nodes = [],
  edges = [],
  camera = {},
  tick = 0,
} = {}) {
  return {
    id,
    name: String(name),
    parentPlaneId: parentPlaneId ?? null,
    parentNodeId: parentNodeId ?? null,
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    camera: {
      x: Number(camera.x) || 0,
      y: Number(camera.y) || 0,
      zoom: clamp(Number(camera.zoom) || 1, 0.1, 4),
    },
    tick: Number.isFinite(Number(tick)) ? Number(tick) : 0,
  };
}

export function createGraphState({
  version = 1,
  rootPlaneId = null,
  activePlaneId = null,
  planes = {},
  ui = {},
  cameraDefaults = { x: 0, y: 0, zoom: 1 },
} = {}) {
  return {
    version: Number(version) || 1,
    rootPlaneId,
    activePlaneId,
    planes: planes && typeof planes === "object" ? planes : {},
    ui: ui && typeof ui === "object" ? ui : {},
    cameraDefaults: {
      x: Number(cameraDefaults.x) || 0,
      y: Number(cameraDefaults.y) || 0,
      zoom: Number(cameraDefaults.zoom) || 1,
    },
  };
}

export function activePlane(state) {
  if (!state || !state.planes || !state.activePlaneId) return null;
  return state.planes[state.activePlaneId] || null;
}

export function depthOfPlane(state, planeId) {
  if (!state?.planes || !planeId) return 0;
  let depth = 0;
  let p = state.planes[planeId];
  while (p && p.parentPlaneId) {
    depth++;
    p = state.planes[p.parentPlaneId];
  }
  return depth;
}

export function breadcrumbList(state, planeId) {
  if (!state?.planes || !planeId) return [];
  const out = [];
  let p = state.planes[planeId];
  while (p) {
    out.push(p);
    p = p.parentPlaneId ? state.planes[p.parentPlaneId] : null;
  }
  return out.reverse();
}

export function addNode(
  plane,
  {
    id = uid("node"),
    text = "Node",
    x = 0,
    y = 0,
    type = "normal",
    pinned = false,
    portalPlaneId = null,
  } = {},
) {
  const node = {
    id,
    text: String(text).slice(0, 4000),
    x: Number(x) || 0,
    y: Number(y) || 0,
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    pinned: !!pinned,
    type: normalizeNodeType(type),
    portalPlaneId: portalPlaneId || null,
    pulse: Math.random() * Math.PI * 2,
    createdAt: Date.now(),
    width: null,
    height: null,
    scrollY: 0,
  };

  plane.nodes.push(node);
  return node;
}

export function addEdge(plane, nodeA, nodeB, props = {}) {
  const a = typeof nodeA === "string" ? nodeA : nodeA?.id;
  const b = typeof nodeB === "string" ? nodeB : nodeB?.id;
  if (!a || !b) return null;

  const edge = {
    id: uid("edge"),
    a,
    b,
    flowOffset: Math.random(),
    props: normalizeEdgeProps(props),
  };

  plane.edges.push(edge);
  return edge;
}

export function findNode(plane, nodeId) {
  return plane?.nodes?.find((n) => n.id === nodeId) || null;
}

export function findEdge(plane, edgeId) {
  return plane?.edges?.find((e) => e.id === edgeId) || null;
}

export function connectedNodes(plane, nodeId) {
  const ids = new Set();
  if (!plane?.edges || !nodeId) return ids;

  for (const e of plane.edges) {
    if (e.a === nodeId) ids.add(e.b);
    if (e.b === nodeId) ids.add(e.a);
  }
  return ids;
}

export function removeNode(plane, nodeId) {
  if (!plane?.nodes?.length) return false;
  const idx = plane.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return false;

  plane.nodes.splice(idx, 1);
  plane.edges = plane.edges.filter((e) => e.a !== nodeId && e.b !== nodeId);
  return true;
}

export function mergeNodes(plane, nodeA, nodeB) {
  if (!plane || !nodeA || !nodeB || nodeA.id === nodeB.id) return null;

  const mx = (nodeA.x + nodeB.x) * 0.5 + rand(-45, 45);
  const my = (nodeA.y + nodeB.y) * 0.5 + rand(-45, 45);

  const merged = addNode(plane, {
    text: `Merge: ${trimText(nodeA.text, 34)} + ${trimText(nodeB.text, 34)}`,
    x: mx,
    y: my,
  });

  addEdge(plane, nodeA, merged);
  addEdge(plane, nodeB, merged);

  removeNode(plane, nodeA.id);
  removeNode(plane, nodeB.id);

  return merged;
}

export function ensurePortalPlane(state, node, sourcePlane) {
  if (!state?.planes || !node || !sourcePlane) return null;

  if (node.portalPlaneId && state.planes[node.portalPlaneId]) {
    return state.planes[node.portalPlaneId];
  }

  const plane = newPlane({
    name: node.text.replace(/^⊛\s*/, "").slice(0, 80) || "Portal Plane",
    parentPlaneId: sourcePlane.id,
    parentNodeId: node.id,
  });

  const hub = addNode(plane, {
    text: `Portal: ${plane.name}`,
    x: 0,
    y: 0,
    pinned: true,
  });

  const c1 = addNode(plane, {
    text: "Sub-context",
    x: -210,
    y: -60,
    type: "normal",
  });
  const c2 = addNode(plane, {
    text: "Prompt Branch",
    x: 230,
    y: -20,
    type: "normal",
  });
  const c3 = addNode(plane, {
    text: "⊛ Deeper",
    x: 60,
    y: 230,
    type: "stargate",
  });

  addEdge(plane, hub, c1);
  addEdge(plane, hub, c2);
  addEdge(plane, hub, c3);

  state.planes[plane.id] = plane;
  node.portalPlaneId = plane.id;

  return plane;
}
