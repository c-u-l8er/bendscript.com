const EDGE_KINDS = ["context", "causal", "temporal", "associative", "user"];
const NODE_TYPES = ["normal", "stargate"];

const DEFAULT_MAX_CONTEXT_NODES = 40;
const DEFAULT_MAX_CONTEXT_EDGES = 70;
const DEFAULT_NODE_TEXT_LIMIT = 280;
const DEFAULT_LABEL_LIMIT = 40;

function safeString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function trim(value, max = 280) {
  const s = safeString(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function sanitizeNode(node = {}) {
  return {
    id: safeString(node.id),
    text: trim(node.text, DEFAULT_NODE_TEXT_LIMIT),
    type: NODE_TYPES.includes(node.type) ? node.type : "normal",
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
    pinned: !!node.pinned,
    portalPlaneId: node.portalPlaneId ?? null,
  };
}

function sanitizeEdge(edge = {}) {
  const kind = EDGE_KINDS.includes(edge?.props?.kind)
    ? edge.props.kind
    : EDGE_KINDS.includes(edge.kind)
      ? edge.kind
      : "context";

  const label = trim(edge?.props?.label ?? edge.label ?? "", DEFAULT_LABEL_LIMIT);

  const strengthRaw = edge?.props?.strength ?? edge.strength ?? 1;
  const strength = clamp(Number(strengthRaw) || 1, 1, 5);

  return {
    id: safeString(edge.id),
    a: safeString(edge.a),
    b: safeString(edge.b),
    label,
    kind,
    strength,
  };
}

function getPlaneFromState(state, activePlaneId = null) {
  const s = state && typeof state === "object" ? state : {};
  const planes = s.planes && typeof s.planes === "object" ? s.planes : {};
  const planeId = activePlaneId || s.activePlaneId || s.rootPlaneId || Object.keys(planes)[0] || null;
  if (!planeId || !planes[planeId]) return null;
  return planes[planeId];
}

function rankNodesForContext(nodes = [], targetNodeId = null) {
  const scored = nodes.map((n) => {
    let score = 0;
    if (targetNodeId && n.id === targetNodeId) score += 1000;
    if (n.type === "stargate") score += 120;
    if (n.pinned) score += 80;
    if (safeString(n.text).length > 0) score += Math.min(40, Math.floor(safeString(n.text).length / 12));
    return { node: n, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.node);
}

function summarizeGraphContext({
  state,
  activePlaneId = null,
  targetNodeId = null,
  maxNodes = DEFAULT_MAX_CONTEXT_NODES,
  maxEdges = DEFAULT_MAX_CONTEXT_EDGES,
} = {}) {
  const plane = getPlaneFromState(state, activePlaneId);
  if (!plane) {
    return {
      plane: null,
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        stargateCount: 0,
      },
      nodes: [],
      edges: [],
    };
  }

  const allNodes = Array.isArray(plane.nodes) ? plane.nodes.map(sanitizeNode) : [];
  const rankedNodes = rankNodesForContext(allNodes, targetNodeId);
  const chosenNodes = rankedNodes.slice(0, clamp(maxNodes, 1, 200));
  const chosenNodeIds = new Set(chosenNodes.map((n) => n.id));

  const allEdges = Array.isArray(plane.edges) ? plane.edges.map(sanitizeEdge) : [];
  const chosenEdges = allEdges
    .filter((e) => chosenNodeIds.has(e.a) && chosenNodeIds.has(e.b))
    .slice(0, clamp(maxEdges, 1, 300));

  const stargateCount = allNodes.filter((n) => n.type === "stargate").length;
  const kindHistogram = EDGE_KINDS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {});
  for (const e of allEdges) {
    kindHistogram[e.kind] = (kindHistogram[e.kind] || 0) + 1;
  }

  return {
    plane: {
      id: plane.id ?? null,
      name: trim(plane.name ?? "Graph Plane", 120),
      parentPlaneId: plane.parentPlaneId ?? null,
      parentNodeId: plane.parentNodeId ?? null,
    },
    summary: {
      nodeCount: allNodes.length,
      edgeCount: allEdges.length,
      stargateCount,
      edgeKinds: kindHistogram,
      targetNodeId: targetNodeId ?? null,
    },
    nodes: chosenNodes,
    edges: chosenEdges,
  };
}

function outputSchemaText() {
  return `
Return STRICT JSON only, no markdown, no prose, no code fences.
Use this schema exactly:

{
  "mode": "tier1" | "tier2" | "tier3" | "tier4",
  "nodes": [
    {
      "text": "string (1..280 chars)",
      "type": "normal" | "stargate",
      "anchor": "source" | "target" | "nearby" | "new",
      "source_ref": "optional existing node id",
      "x_hint": "optional number",
      "y_hint": "optional number",
      "reason": "short explanation"
    }
  ],
  "edges": [
    {
      "from_ref": "node id or temp ref",
      "to_ref": "node id or temp ref",
      "label": "string (<=40 chars)",
      "kind": "context" | "causal" | "temporal" | "associative" | "user",
      "strength": 1-5,
      "reason": "short explanation"
    }
  ],
  "primary_response_text": "short direct assistant response",
  "confidence": 0.0-1.0
}

Rules:
- Never invent unsupported edge kinds or node types.
- Keep node text concise and information-dense.
- Use stargate sparingly; only when deep subgraph exploration is warranted.
- Prefer adding meaningful typed edges over isolated nodes.
- Keep hallucinations low: rely on provided graph context.
`.trim();
}

export function buildAISystemPrompt({
  workspaceName = "Workspace",
  graphName = "Graph",
  tier = 1,
  modelIntent = "graph_synthesis",
} = {}) {
  const safeTier = clamp(Number(tier) || 1, 1, 4);

  return `
You are BendScript's graph synthesis engine.
Mission: transform user prompts into graph-aware nodes and typed edges.

Product context:
- Workspace: ${trim(workspaceName, 100)}
- Graph: ${trim(graphName, 100)}
- Mode/Tier: ${safeTier}
- Intent: ${trim(modelIntent, 80)}

Domain rules:
- Edge kinds (fixed): ${EDGE_KINDS.join(", ")}
- Node types (fixed): ${NODE_TYPES.join(", ")}
- Stargate node text should generally start with "⊛ " when type is "stargate".

Quality rules:
- Be precise, structured, and compact.
- Prefer causal/context relations when confidence is high.
- Use "associative" when relation is weaker.
- Keep labels verb-like and short.
- Avoid duplicate nodes semantically equivalent to existing context unless adding a new angle.
- Keep response stable and deterministic under similar inputs.

${outputSchemaText()}
`.trim();
}

export function buildTier1Prompt({
  userPrompt,
  targetNode = null,
  contextHint = "",
} = {}) {
  const target = targetNode ? sanitizeNode(targetNode) : null;

  return `
Tier 1 task: contextual response for a single prompt.
Goal: produce one strong response node and one connecting edge from the best source node.

User prompt:
"${trim(userPrompt, 1200)}"

Target node (if any):
${target ? JSON.stringify(target, null, 2) : "null"}

Extra context hint:
"${trim(contextHint, 500)}"

Output requirements:
- mode = "tier1"
- Create 1 node (optionally 2 if clearly beneficial).
- Create at least 1 edge.
- If response implies a deep branch, stargate is allowed but not required.
- "primary_response_text" must be readable as chat output.
`.trim();
}

export function buildTier2SynthesisPrompt({
  userPrompt,
  state,
  activePlaneId = null,
  targetNodeId = null,
  maxContextNodes = DEFAULT_MAX_CONTEXT_NODES,
  maxContextEdges = DEFAULT_MAX_CONTEXT_EDGES,
} = {}) {
  const context = summarizeGraphContext({
    state,
    activePlaneId,
    targetNodeId,
    maxNodes: maxContextNodes,
    maxEdges: maxContextEdges,
  });

  return `
Tier 2 task: graph-aware synthesis (2-4 nodes).
Goal: generate new nodes that fit current topology and connect to existing concepts.

User prompt:
"${trim(userPrompt, 1500)}"

Graph context:
${JSON.stringify(context, null, 2)}

Output requirements:
- mode = "tier2"
- Return 2 to 4 nodes.
- Return 2 to 6 edges.
- At least one edge should connect to an existing node from context when plausible.
- Use typed edges carefully; avoid generic low-information links.
- Keep "primary_response_text" concise (<=220 chars).
`.trim();
}

export function buildTier3TopicGraphPrompt({
  topic,
  state,
  activePlaneId = null,
  targetNodeId = null,
  desiredNodeCount = 10,
} = {}) {
  const context = summarizeGraphContext({
    state,
    activePlaneId,
    targetNodeId,
    maxNodes: 50,
    maxEdges: 80,
  });

  const count = clamp(Number(desiredNodeCount) || 10, 8, 12);

  return `
Tier 3 task: topic-to-graph expansion.
Goal: create a coherent mini-subgraph for a topic with hierarchy and navigable structure.

Topic:
"${trim(topic, 600)}"

Current graph context:
${JSON.stringify(context, null, 2)}

Output requirements:
- mode = "tier3"
- Return ${count} nodes (acceptable range: 8..12).
- Return enough edges for coherent traversal (typically nodes-1 to nodes*2).
- Include 0..2 stargate nodes only if they represent clear deep-dive areas.
- Ensure edge kind diversity where justified (not random).
- "primary_response_text" should summarize the generated map.
`.trim();
}

export function buildTier4EdgeInferencePrompt({
  userPrompt,
  newNodes = [],
  state,
  activePlaneId = null,
  targetNodeId = null,
  maxSuggestedEdges = 8,
} = {}) {
  const context = summarizeGraphContext({
    state,
    activePlaneId,
    targetNodeId,
    maxNodes: 50,
    maxEdges: 100,
  });

  const normalizedNewNodes = (Array.isArray(newNodes) ? newNodes : [])
    .map(sanitizeNode)
    .slice(0, 12);

  const edgeCap = clamp(Number(maxSuggestedEdges) || 8, 2, 20);

  return `
Tier 4 task: edge inference for newly created nodes.
Goal: infer high-value connections from new nodes to existing graph structure.

User prompt:
"${trim(userPrompt, 1200)}"

New nodes:
${JSON.stringify(normalizedNewNodes, null, 2)}

Existing context:
${JSON.stringify(context, null, 2)}

Output requirements:
- mode = "tier4"
- You may return 0 new nodes if unnecessary.
- Focus on edge proposals (up to ${edgeCap}).
- Prioritize high-signal edges with clear reasons.
- Avoid dense over-connection; prefer precision.
- "primary_response_text" should explain the inferred linkage strategy.
`.trim();
}

export function buildPromptEnvelope({
  tier = 1,
  workspaceName = "Workspace",
  graphName = "Graph",
  modelIntent = "graph_synthesis",
  userPrompt = "",
  topic = "",
  targetNode = null,
  targetNodeId = null,
  newNodes = [],
  state = null,
  activePlaneId = null,
  contextHint = "",
  desiredNodeCount = 10,
} = {}) {
  const safeTier = clamp(Number(tier) || 1, 1, 4);

  const system = buildAISystemPrompt({
    workspaceName,
    graphName,
    tier: safeTier,
    modelIntent,
  });

  let user = "";
  if (safeTier === 1) {
    user = buildTier1Prompt({
      userPrompt,
      targetNode,
      contextHint,
    });
  } else if (safeTier === 2) {
    user = buildTier2SynthesisPrompt({
      userPrompt,
      state,
      activePlaneId,
      targetNodeId,
    });
  } else if (safeTier === 3) {
    user = buildTier3TopicGraphPrompt({
      topic: topic || userPrompt,
      state,
      activePlaneId,
      targetNodeId,
      desiredNodeCount,
    });
  } else {
    user = buildTier4EdgeInferencePrompt({
      userPrompt,
      newNodes,
      state,
      activePlaneId,
      targetNodeId,
    });
  }

  return {
    tier: safeTier,
    system,
    user,
    messages: [
      { role: "user", content: user },
    ],
  };
}

export const PROMPT_CONSTANTS = {
  EDGE_KINDS,
  NODE_TYPES,
  DEFAULT_MAX_CONTEXT_NODES,
  DEFAULT_MAX_CONTEXT_EDGES,
  DEFAULT_NODE_TEXT_LIMIT,
  DEFAULT_LABEL_LIMIT,
};

export default {
  PROMPT_CONSTANTS,
  summarizeGraphContext,
  buildAISystemPrompt,
  buildTier1Prompt,
  buildTier2SynthesisPrompt,
  buildTier3TopicGraphPrompt,
  buildTier4EdgeInferencePrompt,
  buildPromptEnvelope,
};
