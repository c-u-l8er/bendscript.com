// ProjectAmp2/bendscript.com/src/lib/export/graphExport.js

const EDGE_KINDS = new Set([
  "context",
  "causal",
  "temporal",
  "associative",
  "user",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = "") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function clampHeading(level) {
  return Math.max(1, Math.min(6, level));
}

function normalizeKind(kind) {
  return EDGE_KINDS.has(kind) ? kind : "context";
}

function normalizeState(rawState) {
  const state = isObject(rawState) ? rawState : {};

  return {
    version: Number(state.version) || 1,
    rootPlaneId: state.rootPlaneId ?? null,
    activePlaneId: state.activePlaneId ?? null,
    planes: isObject(state.planes) ? state.planes : {},
    ui: isObject(state.ui) ? state.ui : {},
    cameraDefaults: isObject(state.cameraDefaults)
      ? {
          x: Number(state.cameraDefaults.x) || 0,
          y: Number(state.cameraDefaults.y) || 0,
          zoom: Number(state.cameraDefaults.zoom) || 1,
        }
      : { x: 0, y: 0, zoom: 1 },
  };
}

function normalizePlane(plane = {}) {
  return {
    id: asString(plane.id),
    name: asString(plane.name, "Graph Plane"),
    parentPlaneId: plane.parentPlaneId ?? null,
    parentNodeId: plane.parentNodeId ?? null,
    nodes: asArray(plane.nodes),
    edges: asArray(plane.edges),
    camera: isObject(plane.camera)
      ? {
          x: Number(plane.camera.x) || 0,
          y: Number(plane.camera.y) || 0,
          zoom: Number(plane.camera.zoom) || 1,
        }
      : { x: 0, y: 0, zoom: 1 },
    tick: Number(plane.tick) || 0,
  };
}

function normalizeNode(node = {}) {
  return {
    id: asString(node.id),
    text: asString(node.text, "Node"),
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    pinned: !!node.pinned,
    type: node.type === "stargate" ? "stargate" : "normal",
    portalPlaneId: node.portalPlaneId ?? null,
    width: Number.isFinite(node.width) ? node.width : null,
    height: Number.isFinite(node.height) ? node.height : null,
    scrollY: Number(node.scrollY) || 0,
  };
}

function normalizeEdge(edge = {}) {
  const props = isObject(edge.props) ? edge.props : {};
  return {
    id: asString(edge.id),
    a: asString(edge.a),
    b: asString(edge.b),
    props: {
      label: asString(props.label),
      kind: normalizeKind(props.kind),
      strength: Math.max(1, Math.min(5, Number(props.strength) || 1)),
    },
  };
}

function buildPlaneIndex(state) {
  const out = {};
  for (const [id, rawPlane] of Object.entries(state.planes || {})) {
    out[id] = normalizePlane({ ...rawPlane, id });
  }
  return out;
}

function getRootPlaneId(state, planes) {
  if (state.rootPlaneId && planes[state.rootPlaneId]) return state.rootPlaneId;
  const first = Object.keys(planes)[0] || null;
  return first;
}

function getPlaneOrder(planes, rootPlaneId) {
  if (!rootPlaneId || !planes[rootPlaneId]) return Object.keys(planes);

  const childrenByParent = {};
  for (const plane of Object.values(planes)) {
    const parent = plane.parentPlaneId || "__root__";
    if (!childrenByParent[parent]) childrenByParent[parent] = [];
    childrenByParent[parent].push(plane.id);
  }

  for (const arr of Object.values(childrenByParent)) {
    arr.sort((a, b) => asString(planes[a]?.name).localeCompare(asString(planes[b]?.name)));
  }

  const ordered = [];
  const seen = new Set();

  function visit(planeId) {
    if (!planeId || seen.has(planeId) || !planes[planeId]) return;
    seen.add(planeId);
    ordered.push(planeId);

    for (const childId of childrenByParent[planeId] || []) {
      visit(childId);
    }
  }

  visit(rootPlaneId);

  for (const planeId of Object.keys(planes)) {
    if (!seen.has(planeId)) ordered.push(planeId);
  }

  return ordered;
}

function countTotals(planes) {
  let nodeCount = 0;
  let edgeCount = 0;
  for (const plane of Object.values(planes)) {
    nodeCount += asArray(plane.nodes).length;
    edgeCount += asArray(plane.edges).length;
  }
  return { nodeCount, edgeCount, planeCount: Object.keys(planes).length };
}

/**
 * Build canonical export payload for BendScript graph state.
 */
export function toExportPayload(rawState, options = {}) {
  const {
    includeUI = false,
    includeCameraDefaults = true,
    includeTick = true,
  } = options;

  const state = normalizeState(rawState);
  const planes = buildPlaneIndex(state);
  const rootPlaneId = getRootPlaneId(state, planes);
  const activePlaneId =
    state.activePlaneId && planes[state.activePlaneId]
      ? state.activePlaneId
      : rootPlaneId;

  const outPlanes = {};

  for (const planeId of Object.keys(planes)) {
    const plane = planes[planeId];

    outPlanes[planeId] = {
      id: plane.id,
      name: plane.name,
      parentPlaneId: plane.parentPlaneId,
      parentNodeId: plane.parentNodeId,
      nodes: plane.nodes.map(normalizeNode),
      edges: plane.edges.map(normalizeEdge),
      camera: {
        x: plane.camera.x,
        y: plane.camera.y,
        zoom: plane.camera.zoom,
      },
      ...(includeTick ? { tick: plane.tick } : {}),
    };
  }

  const payload = {
    version: state.version,
    rootPlaneId,
    activePlaneId,
    planes: outPlanes,
  };

  if (includeUI) payload.ui = safeClone(state.ui);
  if (includeCameraDefaults) payload.cameraDefaults = safeClone(state.cameraDefaults);

  return payload;
}

/**
 * Export state as JSON string.
 */
export function exportGraphAsJSON(rawState, options = {}) {
  const { pretty = true, ...payloadOptions } = options;
  const payload = toExportPayload(rawState, payloadOptions);
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

function markdownNodeTitle(node) {
  const badges = [];
  if (node.type === "stargate") badges.push("stargate");
  if (node.pinned) badges.push("pinned");
  const badgeText = badges.length ? ` _(${badges.join(", ")})_` : "";
  return `- **${node.text}** \`${node.id}\`${badgeText}`;
}

function markdownEdgeLine(edge, nodeById) {
  const target = nodeById[edge.b];
  const targetText = target ? target.text : edge.b;
  const label = edge.props.label ? ` — ${edge.props.label}` : "";
  return `  - → **${targetText}** \`${edge.b}\` [${edge.props.kind}${label}]`;
}

/**
 * Export state as a readable Markdown document.
 */
export function exportGraphAsMarkdown(rawState, options = {}) {
  const {
    title = "BendScript Graph Export",
    includeSummary = true,
    includeNodePositions = false,
  } = options;

  const payload = toExportPayload(rawState, {
    includeUI: false,
    includeCameraDefaults: true,
    includeTick: true,
  });

  const planes = payload.planes || {};
  const rootPlaneId = payload.rootPlaneId;
  const order = getPlaneOrder(planes, rootPlaneId);
  const totals = countTotals(planes);

  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");

  if (includeSummary) {
    lines.push(`- Version: \`${payload.version}\``);
    lines.push(`- Root Plane: \`${payload.rootPlaneId || "n/a"}\``);
    lines.push(`- Active Plane: \`${payload.activePlaneId || "n/a"}\``);
    lines.push(`- Planes: **${totals.planeCount}**`);
    lines.push(`- Nodes: **${totals.nodeCount}**`);
    lines.push(`- Edges: **${totals.edgeCount}**`);
    lines.push("");
  }

  for (const planeId of order) {
    const plane = planes[planeId];
    if (!plane) continue;

    const depth = getPlaneDepth(planes, planeId);
    const heading = "#".repeat(clampHeading(depth + 2));
    lines.push(`${heading} Plane: ${plane.name}`);
    lines.push("");
    lines.push(`- id: \`${plane.id}\``);
    lines.push(`- parentPlaneId: \`${plane.parentPlaneId ?? "null"}\``);
    lines.push(`- parentNodeId: \`${plane.parentNodeId ?? "null"}\``);
    lines.push(
      `- camera: x=${plane.camera.x.toFixed(2)}, y=${plane.camera.y.toFixed(
        2,
      )}, zoom=${plane.camera.zoom.toFixed(2)}`,
    );
    lines.push(`- tick: ${Number(plane.tick) || 0}`);
    lines.push("");

    const nodes = asArray(plane.nodes);
    const edges = asArray(plane.edges);
    const nodeById = {};
    for (const node of nodes) nodeById[node.id] = node;

    lines.push(`**Nodes (${nodes.length})**`);
    if (!nodes.length) {
      lines.push("- _none_");
    } else {
      for (const node of nodes) {
        lines.push(markdownNodeTitle(node));
        if (includeNodePositions) {
          lines.push(`  - pos: (${node.x.toFixed(2)}, ${node.y.toFixed(2)})`);
        }
        if (node.portalPlaneId) {
          lines.push(`  - portalPlaneId: \`${node.portalPlaneId}\``);
        }

        const outgoing = edges.filter((e) => e.a === node.id);
        for (const edge of outgoing) {
          lines.push(markdownEdgeLine(edge, nodeById));
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function getPlaneDepth(planes, planeId) {
  let depth = 0;
  let current = planes[planeId];
  const guard = new Set();

  while (current?.parentPlaneId && planes[current.parentPlaneId] && !guard.has(current.parentPlaneId)) {
    guard.add(current.parentPlaneId);
    depth += 1;
    current = planes[current.parentPlaneId];
  }

  return depth;
}

function mermaidEscape(text) {
  return asString(text)
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '\\"')
    .replace(/\|/g, "/")
    .trim();
}

function createMermaidIdFactory(prefix = "N") {
  const used = new Set();

  return (raw) => {
    const base = `${prefix}_${asString(raw, "id").replace(/[^a-zA-Z0-9_]/g, "_")}`;
    let id = base;
    let i = 1;
    while (used.has(id)) {
      id = `${base}_${i++}`;
    }
    used.add(id);
    return id;
  };
}

/**
 * Export state as Mermaid flowchart definition.
 */
export function exportGraphAsMermaid(rawState, options = {}) {
  const {
    direction = "TD",
    includePlaneSubgraphs = true,
    includeKindInEdgeLabel = true,
    title = null,
  } = options;

  const payload = toExportPayload(rawState, {
    includeUI: false,
    includeCameraDefaults: false,
    includeTick: false,
  });

  const planes = payload.planes || {};
  const rootPlaneId = payload.rootPlaneId;
  const order = getPlaneOrder(planes, rootPlaneId);
  const makeNodeId = createMermaidIdFactory("N");

  // Stable mapping for all nodes before rendering edges.
  const nodeMermaidIdByGraphId = {};
  for (const planeId of order) {
    const plane = planes[planeId];
    if (!plane) continue;
    for (const node of asArray(plane.nodes)) {
      if (!nodeMermaidIdByGraphId[node.id]) {
        nodeMermaidIdByGraphId[node.id] = makeNodeId(node.id);
      }
    }
  }

  const lines = [];
  if (title) lines.push(`%% ${mermaidEscape(title)}`);
  lines.push(`flowchart ${asString(direction, "TD")}`);

  const stargateClassIds = [];

  for (const planeId of order) {
    const plane = planes[planeId];
    if (!plane) continue;

    if (includePlaneSubgraphs) {
      lines.push(`  subgraph P_${planeId.replace(/[^a-zA-Z0-9_]/g, "_")}["${mermaidEscape(plane.name)}"]`);
    }

    const indent = includePlaneSubgraphs ? "    " : "  ";

    for (const node of asArray(plane.nodes)) {
      const id = nodeMermaidIdByGraphId[node.id];
      const label = mermaidEscape(node.text);

      if (node.type === "stargate") {
        lines.push(`${indent}${id}(("${label}"))`);
        stargateClassIds.push(id);
      } else {
        lines.push(`${indent}${id}["${label}"]`);
      }
    }

    if (includePlaneSubgraphs) {
      lines.push("  end");
    }
  }

  // Edges
  for (const planeId of order) {
    const plane = planes[planeId];
    if (!plane) continue;

    for (const edge of asArray(plane.edges)) {
      const fromId = nodeMermaidIdByGraphId[edge.a];
      const toId = nodeMermaidIdByGraphId[edge.b];
      if (!fromId || !toId) continue;

      const labelParts = [];
      if (includeKindInEdgeLabel) labelParts.push(edge.props.kind);
      if (edge.props.label) labelParts.push(edge.props.label);
      const label = mermaidEscape(labelParts.join(" · "));

      if (label) {
        lines.push(`  ${fromId} -->|${label}| ${toId}`);
      } else {
        lines.push(`  ${fromId} --> ${toId}`);
      }
    }
  }

  if (stargateClassIds.length) {
    lines.push(`  classDef stargate fill:#eef2ff,stroke:#4f46e5,stroke-width:2px,color:#111827;`);
    lines.push(`  class ${stargateClassIds.join(",")} stargate;`);
  }

  return lines.join("\n");
}

/**
 * Generic export entry-point.
 */
export function exportGraph(rawState, format = "json", options = {}) {
  const f = asString(format).toLowerCase();

  if (f === "json") return exportGraphAsJSON(rawState, options);
  if (f === "md" || f === "markdown") return exportGraphAsMarkdown(rawState, options);
  if (f === "mmd" || f === "mermaid") return exportGraphAsMermaid(rawState, options);

  throw new Error(`Unsupported export format "${format}". Use json|markdown|mermaid.`);
}

export default {
  toExportPayload,
  exportGraphAsJSON,
  exportGraphAsMarkdown,
  exportGraphAsMermaid,
  exportGraph,
};
