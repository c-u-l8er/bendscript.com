const NODE_TYPES = new Set(["normal", "stargate"]);
const EDGE_KINDS = new Set(["context", "causal", "temporal", "associative", "user"]);

const DEFAULT_ENDPOINT = "/api/ai";
const DEFAULT_TIMEOUT_MS = 30000;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function trim(text, max = 4000) {
  return String(text ?? "").trim().slice(0, max);
}

function normalizeNodeType(type) {
  return NODE_TYPES.has(type) ? type : "normal";
}

function normalizeEdgeKind(kind) {
  return EDGE_KINDS.has(kind) ? kind : "context";
}

function normalizeStrength(strength) {
  const n = Number(strength);
  if (!Number.isFinite(n)) return 1;
  return clamp(Math.round(n), 1, 5);
}

function parseJsonMaybe(input) {
  if (input == null) return null;
  if (typeof input === "object") return input;
  const raw = String(input).trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function pickFirstObject(...values) {
  for (const v of values) {
    if (v && typeof v === "object") return v;
  }
  return null;
}

function extractPayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  const direct = pickFirstObject(raw.synthesis, raw.result, raw.data, raw.output);
  if (direct) return direct;

  const content = Array.isArray(raw.content) ? raw.content : [];
  for (const block of content) {
    const asObj = parseJsonMaybe(block?.text ?? block?.content ?? null);
    if (asObj && typeof asObj === "object") return asObj;
  }

  const asObj = parseJsonMaybe(raw.text ?? raw.message ?? null);
  if (asObj && typeof asObj === "object") return asObj;

  return raw;
}

function normalizeNodeLike(node, index = 0) {
  const text = trim(node?.text || node?.label || node?.title || `Node ${index + 1}`, 4000);
  const nodeType = normalizeNodeType(node?.type);
  const x = Number(node?.x);
  const y = Number(node?.y);

  return {
    id: node?.id ? String(node.id) : null,
    text,
    type: nodeType,
    x: Number.isFinite(x) ? x : null,
    y: Number.isFinite(y) ? y : null,
    pinned: !!node?.pinned,
    metadata: node?.metadata && typeof node.metadata === "object" ? node.metadata : {},
  };
}

function normalizeEdgeLike(edge) {
  return {
    id: edge?.id ? String(edge.id) : null,
    fromId: edge?.fromId ? String(edge.fromId) : edge?.a ? String(edge.a) : null,
    toId: edge?.toId ? String(edge.toId) : edge?.b ? String(edge.b) : null,
    fromIndex: Number.isInteger(edge?.fromIndex) ? edge.fromIndex : null,
    toIndex: Number.isInteger(edge?.toIndex) ? edge.toIndex : null,
    label: trim(edge?.label || "", 80),
    kind: normalizeEdgeKind(edge?.kind),
    strength: normalizeStrength(edge?.strength),
    metadata: edge?.metadata && typeof edge.metadata === "object" ? edge.metadata : {},
  };
}

function normalizeSynthesis(raw) {
  const payload = extractPayload(raw) || {};

  const nodesRaw = Array.isArray(payload.nodes)
    ? payload.nodes
    : Array.isArray(payload.node_suggestions)
      ? payload.node_suggestions
      : [];

  const edgesRaw = Array.isArray(payload.edges)
    ? payload.edges
    : Array.isArray(payload.edge_suggestions)
      ? payload.edge_suggestions
      : [];

  const nodes = nodesRaw.map(normalizeNodeLike).filter((n) => n.text.length > 0);
  const edges = edgesRaw.map(normalizeEdgeLike);

  const summary = trim(payload.summary || payload.reasoning || payload.explanation || "", 3000);
  const tier = clamp(Number(payload.tier || payload.level || 1), 1, 4);

  return {
    tier,
    summary,
    nodes,
    edges,
    raw: payload,
  };
}

function inferTier(prompt, requestedTier) {
  if (Number.isFinite(Number(requestedTier))) {
    return clamp(Number(requestedTier), 1, 4);
  }
  const p = String(prompt || "").toLowerCase();
  if (p.includes("full graph") || p.includes("topic-to-graph") || p.includes("10 nodes")) return 3;
  if (p.includes("infer edges") || p.includes("connect to existing")) return 4;
  if (p.includes("graph-aware") || p.includes("multi node")) return 2;
  return 1;
}

export function buildGraphContext(state, options = {}) {
  const {
    activePlaneId = state?.activePlaneId ?? null,
    maxNodes = 40,
    maxEdges = 80,
  } = options;

  if (!state || !state.planes || !activePlaneId || !state.planes[activePlaneId]) {
    return {
      version: state?.version ?? 1,
      activePlaneId: activePlaneId ?? null,
      nodes: [],
      edges: [],
    };
  }

  const plane = state.planes[activePlaneId];
  const nodes = (plane.nodes || []).slice(0, maxNodes).map((n) => ({
    id: String(n.id),
    text: trim(n.text, 400),
    type: normalizeNodeType(n.type),
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    pinned: !!n.pinned,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (plane.edges || [])
    .filter((e) => nodeIds.has(String(e.a)) && nodeIds.has(String(e.b)))
    .slice(0, maxEdges)
    .map((e) => ({
      id: String(e.id),
      fromId: String(e.a),
      toId: String(e.b),
      label: trim(e?.props?.label || "", 80),
      kind: normalizeEdgeKind(e?.props?.kind),
      strength: normalizeStrength(e?.props?.strength),
    }));

  return {
    version: state.version ?? 1,
    activePlaneId,
    nodeCount: (plane.nodes || []).length,
    edgeCount: (plane.edges || []).length,
    nodes,
    edges,
  };
}

export async function callGraphSynthesis({
  prompt,
  state = null,
  activePlaneId = null,
  targetNodeId = null,
  workspaceId = null,
  graphId = null,
  tier = null,
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = globalThis.fetch,
  signal = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extra = {},
}) {
  if (!fetchImpl) {
    throw new Error("No fetch implementation available for AI synthesis call.");
  }

  const controller = signal ? null : new AbortController();
  const timer =
    controller && Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort("AI synthesis timeout"), timeoutMs)
      : null;

  try {
    const reqTier = inferTier(prompt, tier);
    const context = buildGraphContext(state, { activePlaneId });

    const body = {
      prompt: trim(prompt, 2000),
      tier: reqTier,
      workspaceId,
      graphId,
      targetNodeId,
      context,
      ...extra,
    };

    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: signal || controller?.signal,
    });

    const text = await res.text();
    const parsed = parseJsonMaybe(text) ?? { text };

    if (!res.ok) {
      const msg = parsed?.error || parsed?.message || `AI proxy failed (${res.status})`;
      throw new Error(msg);
    }

    const synthesis = normalizeSynthesis(parsed);

    return {
      ok: true,
      status: res.status,
      tier: synthesis.tier,
      summary: synthesis.summary,
      nodes: synthesis.nodes,
      edges: synthesis.edges,
      raw: parsed,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function autoPlace(nodes, anchorX = 0, anchorY = 0, radius = 180) {
  const count = nodes.length || 1;
  return nodes.map((n, i) => {
    const theta = (Math.PI * 2 * i) / count - Math.PI / 2;
    return {
      ...n,
      x: Number.isFinite(n.x) ? n.x : anchorX + Math.cos(theta) * radius,
      y: Number.isFinite(n.y) ? n.y : anchorY + Math.sin(theta) * radius,
    };
  });
}

export function materializeSynthesisForPlane({
  synthesis,
  parentNode = null,
  anchorX = 0,
  anchorY = 0,
  radius = 180,
}) {
  const normalized = normalizeSynthesis(synthesis);
  const nodes = autoPlace(normalized.nodes, anchorX, anchorY, radius);

  const idByIndex = new Map();
  const nodeSpecs = nodes.map((n, i) => {
    idByIndex.set(i, n.id || null);
    return {
      id: n.id || null,
      text: n.text,
      type: n.type,
      x: n.x,
      y: n.y,
      pinned: n.pinned,
      metadata: n.metadata,
    };
  });

  const edgeSpecs = normalized.edges.map((e) => ({
    id: e.id,
    fromId: e.fromId,
    toId: e.toId,
    fromIndex: e.fromIndex,
    toIndex: e.toIndex,
    label: e.label,
    kind: e.kind,
    strength: e.strength,
    metadata: e.metadata,
  }));

  if (parentNode && nodeSpecs.length > 0) {
    edgeSpecs.unshift({
      id: null,
      fromId: String(parentNode.id),
      toId: nodeSpecs[0].id,
      fromIndex: null,
      toIndex: 0,
      label: "expands",
      kind: "context",
      strength: 2,
      metadata: {},
    });
  }

  return {
    tier: normalized.tier,
    summary: normalized.summary,
    nodes: nodeSpecs,
    edges: edgeSpecs,
  };
}

export default {
  buildGraphContext,
  callGraphSynthesis,
  materializeSynthesisForPlane,
};
