export const REPEL = 98000;
export const SPRING = 0.0095;
export const EDGE_LEN = 290;
export const CENTER_PULL = 0.00042;
export const DAMPING = 0.9;
export const MAX_SPEED = 8.2;
export const DRIFT_X = 0.0007;
export const DRIFT_Y = 0.0006;
export const DRIFT_FORCE = 0.03;
export const EPSILON = 0.001;
export const FORCE_SCALE = 0.06;

function defaultFindNode(plane, nodeId) {
  return plane?.nodes?.find((n) => n.id === nodeId) || null;
}

function defaultEdgeAnchorPair(a, b) {
  // Fallback to center-to-center spring anchors when a renderer-specific
  // anchor function is not provided.
  return {
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
  };
}

/**
 * Full force simulation step for one plane.
 *
 * @param {number} dt - delta time in ms
 * @param {object} plane - active plane ({ nodes, edges, tick })
 * @param {object} [opts]
 * @param {string|null} [opts.dragNodeId=null] - node currently being dragged
 * @param {(plane: any, nodeId: string) => any} [opts.findNode] - node lookup
 * @param {(a: any, b: any) => {a:{x:number,y:number},b:{x:number,y:number}}} [opts.edgeAnchorPair]
 * @param {Partial<{
 *   repulsion:number,springK:number,edgeLen:number,centerPull:number,damping:number,
 *   maxSpeed:number,driftX:number,driftY:number,driftForce:number,epsilon:number,forceScale:number
 * }>} [opts.constants]
 * @returns {object} plane
 */
export function simulate(dt, plane, opts = {}) {
  if (!plane || !Array.isArray(plane.nodes) || !Array.isArray(plane.edges)) {
    return plane;
  }

  const ms = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  if (ms <= 0) return plane;

  const {
    dragNodeId = null,
    findNode = defaultFindNode,
    edgeAnchorPair = defaultEdgeAnchorPair,
    constants = {},
  } = opts;

  const repulsion = Number(constants.repulsion) || REPEL;
  const springK = Number(constants.springK) || SPRING;
  const edgeLen = Number(constants.edgeLen) || EDGE_LEN;
  const centerPull = Number(constants.centerPull) || CENTER_PULL;
  const damping = Number(constants.damping) || DAMPING;
  const maxSpeed = Number(constants.maxSpeed) || MAX_SPEED;
  const driftX = Number(constants.driftX) || DRIFT_X;
  const driftY = Number(constants.driftY) || DRIFT_Y;
  const driftForce = Number(constants.driftForce) || DRIFT_FORCE;
  const epsilon = Number(constants.epsilon) || EPSILON;
  const forceScale = Number(constants.forceScale) || FORCE_SCALE;

  const nodes = plane.nodes;
  const edges = plane.edges;

  plane.tick = (Number(plane.tick) || 0) + ms;

  // Reset accumulated forces
  for (const n of nodes) {
    n.fx = 0;
    n.fy = 0;
  }

  // N^2 repulsion
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;

      const d2 = dx * dx + dy * dy + epsilon;
      const d = Math.sqrt(d2);
      const f = repulsion / d2;

      const fx = (dx / d) * f;
      const fy = (dy / d) * f;

      a.fx -= fx;
      a.fy -= fy;
      b.fx += fx;
      b.fy += fy;
    }
  }

  // Spring forces along edges
  for (const e of edges) {
    const a = findNode(plane, e.a);
    const b = findNode(plane, e.b);
    if (!a || !b) continue;

    const anchors = edgeAnchorPair(a, b);
    const dx = anchors.b.x - anchors.a.x;
    const dy = anchors.b.y - anchors.a.y;
    const d = Math.hypot(dx, dy) + epsilon;

    const stretch = d - edgeLen;
    const f = stretch * springK;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;

    a.fx += fx;
    a.fy += fy;
    b.fx -= fx;
    b.fy -= fy;
  }

  // Integrate (skip pinned + actively dragged nodes)
  for (const n of nodes) {
    if (n.pinned || dragNodeId === n.id) continue;

    // Mild attraction to origin to keep clusters centered
    n.fx += -n.x * centerPull;
    n.fy += -n.y * centerPull;

    // Small deterministic drift so layout never fully stagnates
    const pulse = Number(n.pulse) || 0;
    n.fx += Math.sin(plane.tick * driftX + pulse) * driftForce;
    n.fy += Math.cos(plane.tick * driftY + pulse * 1.31) * driftForce;

    n.vx = (Number(n.vx) + n.fx * ms * forceScale) * damping;
    n.vy = (Number(n.vy) + n.fy * ms * forceScale) * damping;

    const speed = Math.hypot(n.vx, n.vy);
    if (speed > maxSpeed) {
      n.vx = (n.vx / speed) * maxSpeed;
      n.vy = (n.vy / speed) * maxSpeed;
    }

    n.x += n.vx;
    n.y += n.vy;
  }

  return plane;
}
