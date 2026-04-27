/**
 * κ-topology analysis utilities for BendScript canvas graphs.
 *
 * Canonical output keys:
 * - routing
 * - maxKappa
 * - sccCount
 * - sccs
 * - dagNodes
 */

export const DIRECTED_KINDS = new Set([
  "context",
  "causal",
  "temporal",
  "user",
]);
export const DEFAULT_MAX_EXACT_SCC_SIZE = 20;

/**
 * Build adjacency from a BendScript plane.
 *
 * @param {object} plane
 * @param {object} [opts]
 * @param {boolean} [opts.associativeBidirectional=true] Treat associative edges as undirected (add both directions).
 * @returns {Map<string, Set<string>>}
 */
export function buildAdjacencyFromPlane(
  plane,
  { associativeBidirectional = true } = {},
) {
  const adjacency = new Map();

  const nodes = Array.isArray(plane?.nodes) ? plane.nodes : [];
  for (const node of nodes) {
    if (!node?.id) continue;
    adjacency.set(node.id, new Set());
  }

  const edges = Array.isArray(plane?.edges) ? plane.edges : [];
  for (const edge of edges) {
    const source = edge?.a;
    const target = edge?.b;
    const kind = edge?.props?.kind ?? "context";

    if (!source || !target || source === target) continue;
    if (!adjacency.has(source) || !adjacency.has(target)) continue;

    if (DIRECTED_KINDS.has(kind)) {
      adjacency.get(source).add(target);
      continue;
    }

    if (kind === "associative" && associativeBidirectional) {
      adjacency.get(source).add(target);
      adjacency.get(target).add(source);
    }
  }

  return adjacency;
}

/**
 * Normalize arbitrary adjacency-like input into Map<string, Set<string>>.
 *
 * @param {Map<string, Set<string>>|Object<string, Iterable<string>>} input
 * @returns {Map<string, Set<string>>}
 */
export function normalizeAdjacency(input) {
  if (input instanceof Map) {
    const out = new Map();
    for (const [k, vs] of input.entries()) {
      if (typeof k !== "string") continue;
      const set = new Set();
      if (vs && typeof vs[Symbol.iterator] === "function") {
        for (const v of vs) {
          if (typeof v === "string" && v !== k) set.add(v);
        }
      }
      out.set(k, set);
    }

    // Ensure all referenced nodes exist.
    for (const targets of out.values()) {
      for (const t of targets) {
        if (!out.has(t)) out.set(t, new Set());
      }
    }

    return out;
  }

  const out = new Map();
  if (!input || typeof input !== "object") return out;

  for (const [k, vs] of Object.entries(input)) {
    if (typeof k !== "string") continue;
    const set = new Set();
    if (vs && typeof vs[Symbol.iterator] === "function") {
      for (const v of vs) {
        if (typeof v === "string" && v !== k) set.add(v);
      }
    }
    out.set(k, set);
  }

  for (const targets of out.values()) {
    for (const t of targets) {
      if (!out.has(t)) out.set(t, new Set());
    }
  }

  return out;
}

/**
 * Tarjan SCC decomposition (recursive).
 * Returns only non-trivial SCCs (size > 1).
 *
 * @param {Map<string, Set<string>>|Object<string, Iterable<string>>} adjacencyInput
 * @returns {string[][]}
 */
export function tarjanScc(adjacencyInput) {
  const adjacency = normalizeAdjacency(adjacencyInput);
  const indexBy = new Map();
  const lowBy = new Map();
  const stack = [];
  const onStack = new Set();
  const sccs = [];
  let index = 0;

  const nodes = [...adjacency.keys()].sort();

  function strongconnect(v) {
    indexBy.set(v, index);
    lowBy.set(v, index);
    index += 1;

    stack.push(v);
    onStack.add(v);

    const targets = adjacency.get(v) ?? new Set();
    for (const w of targets) {
      if (!indexBy.has(w)) {
        strongconnect(w);
        lowBy.set(v, Math.min(lowBy.get(v), lowBy.get(w)));
      } else if (onStack.has(w)) {
        lowBy.set(v, Math.min(lowBy.get(v), indexBy.get(w)));
      }
    }

    if (lowBy.get(v) === indexBy.get(v)) {
      const component = [];
      while (stack.length > 0) {
        const w = stack.pop();
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }

      if (component.length > 1) {
        component.sort();
        sccs.push(component);
      }
    }
  }

  for (const v of nodes) {
    if (!indexBy.has(v)) strongconnect(v);
  }

  sccs.sort((a, b) => a[0].localeCompare(b[0]));
  return sccs;
}

/**
 * Weakly connected components over a directed adjacency map.
 * Direction is ignored for grouping (u -> v implies u ~ v).
 *
 * @param {Map<string, Set<string>>|Object<string, Iterable<string>>} adjacencyInput
 * @returns {string[][]}
 */
export function weaklyConnectedComponents(adjacencyInput) {
  const adjacency = normalizeAdjacency(adjacencyInput);
  const undirected = new Map();

  for (const node of adjacency.keys()) {
    if (!undirected.has(node)) undirected.set(node, new Set());
  }

  for (const [u, targets] of adjacency.entries()) {
    if (!undirected.has(u)) undirected.set(u, new Set());
    for (const v of targets) {
      if (!undirected.has(v)) undirected.set(v, new Set());
      undirected.get(u).add(v);
      undirected.get(v).add(u);
    }
  }

  const visited = new Set();
  const components = [];
  const nodes = [...undirected.keys()].sort();

  for (const start of nodes) {
    if (visited.has(start)) continue;

    const stack = [start];
    const component = [];

    while (stack.length > 0) {
      const cur = stack.pop();
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.push(cur);

      const neighbors = undirected.get(cur) ?? new Set();
      for (const nxt of neighbors) {
        if (!visited.has(nxt)) stack.push(nxt);
      }
    }

    component.sort();
    components.push(component);
  }

  components.sort((a, b) => (a[0] || "").localeCompare(b[0] || ""));
  return components;
}

/**
 * Compute κ + fault line edges for a single SCC.
 *
 * Exact for SCC size <= maxExactSccSize; approximate otherwise.
 *
 * @param {Map<string, Set<string>>|Object<string, Iterable<string>>} adjacencyInput
 * @param {string[]} sccNodes
 * @param {object} [opts]
 * @param {number} [opts.maxExactSccSize=20]
 * @returns {{kappa:number, approximate:boolean, faultLineEdges:Array<[string,string]>}}
 */
export function computeKappaForScc(
  adjacencyInput,
  sccNodes,
  { maxExactSccSize = DEFAULT_MAX_EXACT_SCC_SIZE } = {},
) {
  const adjacency = normalizeAdjacency(adjacencyInput);
  const nodes = [
    ...new Set((sccNodes || []).filter((n) => typeof n === "string")),
  ].sort();

  if (nodes.length <= 1) {
    return { kappa: 0, approximate: false, faultLineEdges: [] };
  }

  if (nodes.length > maxExactSccSize) {
    return {
      kappa: nodes.length,
      approximate: true,
      faultLineEdges: [],
    };
  }

  const nodeIndex = new Map(nodes.map((n, i) => [n, i]));
  const n = nodes.length;

  // Directed edges internal to this SCC (unique).
  const edges = [];
  const edgeSeen = new Set();

  for (const u of nodes) {
    const targets = adjacency.get(u) ?? new Set();
    for (const v of targets) {
      if (!nodeIndex.has(v)) continue;
      const key = `${u}→${v}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push([u, v]);
    }
  }

  // Enumerate bipartitions via bit masks.
  // To avoid symmetric duplicates, force first node into partition A.
  let bestCut = Number.POSITIVE_INFINITY;
  let bestFaultLines = [];

  const maxMask = 1 << n;
  for (let mask = 1; mask < maxMask - 1; mask++) {
    if ((mask & 1) === 0) continue; // canonical partition anchor

    let cutCount = 0;
    const faultLines = [];

    for (const [u, v] of edges) {
      const iu = nodeIndex.get(u);
      const iv = nodeIndex.get(v);
      const inA_u = ((mask >> iu) & 1) === 1;
      const inA_v = ((mask >> iv) & 1) === 1;

      if (inA_u !== inA_v) {
        cutCount += 1;
        faultLines.push([u, v]);
      }
    }

    if (cutCount < bestCut) {
      bestCut = cutCount;
      bestFaultLines = faultLines;
      if (bestCut === 0) break;
    }
  }

  if (!Number.isFinite(bestCut)) {
    bestCut = 0;
    bestFaultLines = [];
  }

  bestFaultLines.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });

  return {
    kappa: bestCut,
    approximate: false,
    faultLineEdges: bestFaultLines,
  };
}

/**
 * Map κ to deliberation budget.
 *
 * @param {number} kappa
 * @returns {{maxIterations:number,agentCount:number,timeoutMultiplier:number,confidenceThreshold:number}}
 */
export function deliberationBudget(kappa) {
  const k = Math.max(0, Number.isFinite(kappa) ? Math.floor(kappa) : 0);
  return {
    maxIterations: Math.min(k + 1, 4),
    agentCount: Math.min(k, 3),
    timeoutMultiplier: Math.min(1 + 0.5 * k, 3.5),
    confidenceThreshold: Number(Math.min(0.7 + 0.05 * k, 0.95).toFixed(2)),
  };
}

/**
 * Analyze adjacency and compute κ-aware routing.
 *
 * @param {Map<string, Set<string>>|Object<string, Iterable<string>>} adjacencyInput
 * @param {object} [opts]
 * @param {number} [opts.maxExactSccSize=20]
 * @returns {{
 *   routing:"fast"|"deliberate",
 *   maxKappa:number,
 *   sccCount:number,
 *   sccs:Array<{
 *     id:string,
 *     nodes:string[],
 *     kappa:number,
 *     approximate:boolean,
 *     faultLineEdges:Array<{source:string,target:string}>,
 *     routing:"fast"|"deliberate",
 *     deliberationBudget:{maxIterations:number,agentCount:number,timeoutMultiplier:number,confidenceThreshold:number}
 *   }>,
 *   dagNodes:string[],
 *   islandCount:number,
 *   islands:Array<{
 *     id:string,
 *     nodes:string[],
 *     sccCount:number,
 *     maxKappa:number,
 *     routing:"fast"|"deliberate"
 *   }>
 * }}
 */
export function analyzeAdjacency(
  adjacencyInput,
  { maxExactSccSize = DEFAULT_MAX_EXACT_SCC_SIZE } = {},
) {
  const adjacency = normalizeAdjacency(adjacencyInput);
  const allNodes = [...adjacency.keys()].sort();

  const sccNodeLists = tarjanScc(adjacency);
  const sccs = sccNodeLists.map((nodes, idx) => {
    const kappaResult = computeKappaForScc(adjacency, nodes, {
      maxExactSccSize,
    });
    const k = kappaResult.kappa;

    return {
      id: `scc-${idx}`,
      nodes: [...nodes].sort(),
      kappa: k,
      approximate: !!kappaResult.approximate,
      faultLineEdges: kappaResult.faultLineEdges.map(([source, target]) => ({
        source,
        target,
      })),
      routing: k > 0 ? "deliberate" : "fast",
      deliberationBudget: deliberationBudget(k),
    };
  });

  const sccNodeSet = new Set(sccs.flatMap((s) => s.nodes));
  const dagNodes = allNodes.filter((n) => !sccNodeSet.has(n));

  const weaklyConnected = weaklyConnectedComponents(adjacency);
  const islands = weaklyConnected.map((nodes, idx) => {
    const nodeSet = new Set(nodes);
    const islandSccs = sccs.filter((scc) =>
      scc.nodes.some((n) => nodeSet.has(n)),
    );
    const islandMaxKappa = islandSccs.reduce((m, s) => Math.max(m, s.kappa), 0);

    return {
      id: `island-${idx}`,
      nodes,
      sccCount: islandSccs.length,
      maxKappa: islandMaxKappa,
      routing: islandMaxKappa > 0 ? "deliberate" : "fast",
    };
  });

  const maxKappa = sccs.reduce((m, s) => Math.max(m, s.kappa), 0);
  const routing = maxKappa > 0 ? "deliberate" : "fast";

  return {
    routing,
    maxKappa,
    sccCount: sccs.length,
    sccs,
    dagNodes,
    islandCount: islands.length,
    islands,
  };
}

/**
 * Analyze a BendScript plane directly.
 *
 * @param {object} plane
 * @param {object} [opts]
 * @param {boolean} [opts.associativeBidirectional=true]
 * @param {number} [opts.maxExactSccSize=20]
 * @returns {ReturnType<typeof analyzeAdjacency>}
 */
export function analyzePlaneTopology(
  plane,
  {
    associativeBidirectional = true,
    maxExactSccSize = DEFAULT_MAX_EXACT_SCC_SIZE,
  } = {},
) {
  const adjacency = buildAdjacencyFromPlane(plane, {
    associativeBidirectional,
  });
  return analyzeAdjacency(adjacency, { maxExactSccSize });
}

/**
 * Preview topology impact of adding a directed edge.
 *
 * @param {object} plane
 * @param {string} sourceId
 * @param {string} targetId
 * @param {object} [opts]
 * @param {boolean} [opts.associativeBidirectional=true]
 * @param {number} [opts.maxExactSccSize=20]
 * @returns {{
 *   createsNewScc:boolean,
 *   kappaBefore:number,
 *   kappaAfter:number,
 *   kappaDelta:number,
 *   routingBefore:"fast"|"deliberate",
 *   routingAfter:"fast"|"deliberate",
 *   sccCountBefore:number,
 *   sccCountAfter:number,
 *   description:string,
 *   before:ReturnType<typeof analyzeAdjacency>,
 *   after:ReturnType<typeof analyzeAdjacency>
 * }}
 */
export function previewEdgeImpact(
  plane,
  sourceId,
  targetId,
  {
    associativeBidirectional = true,
    maxExactSccSize = DEFAULT_MAX_EXACT_SCC_SIZE,
  } = {},
) {
  const baseAdjacency = buildAdjacencyFromPlane(plane, {
    associativeBidirectional,
  });

  if (
    typeof sourceId !== "string" ||
    typeof targetId !== "string" ||
    !sourceId ||
    !targetId
  ) {
    const before = analyzeAdjacency(baseAdjacency, { maxExactSccSize });
    return {
      createsNewScc: false,
      kappaBefore: before.maxKappa,
      kappaAfter: before.maxKappa,
      kappaDelta: 0,
      routingBefore: before.routing,
      routingAfter: before.routing,
      sccCountBefore: before.sccCount,
      sccCountAfter: before.sccCount,
      description: "Invalid edge preview input.",
      before,
      after: before,
    };
  }

  // before
  const before = analyzeAdjacency(baseAdjacency, { maxExactSccSize });

  // after (copy + add edge)
  const afterAdjacency = new Map();
  for (const [n, targets] of baseAdjacency.entries()) {
    afterAdjacency.set(n, new Set(targets));
  }
  if (!afterAdjacency.has(sourceId)) afterAdjacency.set(sourceId, new Set());
  if (!afterAdjacency.has(targetId)) afterAdjacency.set(targetId, new Set());
  if (sourceId !== targetId) {
    afterAdjacency.get(sourceId).add(targetId);
  }

  const after = analyzeAdjacency(afterAdjacency, { maxExactSccSize });

  const beforeNodeSet = new Set(before.sccs.flatMap((s) => s.nodes));
  const afterNodeSet = new Set(after.sccs.flatMap((s) => s.nodes));

  const createsNewScc =
    afterNodeSet.size > beforeNodeSet.size || after.sccCount > before.sccCount;

  const kappaDelta = after.maxKappa - before.maxKappa;

  let description = "This edge has no κ impact on the analyzed topology.";
  if (createsNewScc && after.maxKappa > 0) {
    description =
      "This edge creates a feedback loop and increases deliberation pressure.";
  } else if (kappaDelta > 0) {
    description = "This edge strengthens an existing feedback loop (higher κ).";
  } else if (kappaDelta < 0) {
    description = "This edge reduces feedback complexity (lower κ).";
  }

  return {
    createsNewScc,
    kappaBefore: before.maxKappa,
    kappaAfter: after.maxKappa,
    kappaDelta,
    routingBefore: before.routing,
    routingAfter: after.routing,
    sccCountBefore: before.sccCount,
    sccCountAfter: after.sccCount,
    description,
    before,
    after,
  };
}
