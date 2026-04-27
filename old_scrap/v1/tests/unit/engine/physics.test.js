import { describe, it, expect, vi } from "vitest";
import { simulate, MAX_SPEED } from "../../../src/lib/engine/physics.js";

function makeNode(id, x, y, overrides = {}) {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    pinned: false,
    pulse: 0,
    ...overrides,
  };
}

function makePlane(nodes = [], edges = [], tick = 0) {
  return { nodes, edges, tick };
}

describe("engine/physics simulate", () => {
  it("returns input unchanged for invalid plane shapes", () => {
    expect(simulate(16, null)).toBeNull();

    const badPlane = {};
    expect(simulate(16, badPlane)).toBe(badPlane);
  });

  it("does nothing when dt is zero or negative", () => {
    const plane = makePlane([makeNode("n1", 10, 5)], [], 42);

    simulate(0, plane);
    expect(plane.tick).toBe(42);
    expect(plane.nodes[0].x).toBe(10);
    expect(plane.nodes[0].y).toBe(5);

    simulate(-10, plane);
    expect(plane.tick).toBe(42);
    expect(plane.nodes[0].x).toBe(10);
    expect(plane.nodes[0].y).toBe(5);
  });

  it("increments tick and integrates center pull", () => {
    const plane = makePlane([makeNode("n1", 10, 0)], [], 0);

    simulate(1, plane, {
      constants: {
        repulsion: 0,
        springK: 0,
        centerPull: 1,
        damping: 1,
        forceScale: 1,
        driftForce: 0,
        maxSpeed: 9999,
      },
    });

    expect(plane.tick).toBe(1);
    expect(Number.isFinite(plane.nodes[0].vx)).toBe(true);
    expect(plane.nodes[0].vx).toBeLessThan(0);
    expect(plane.nodes[0].x).toBeLessThan(10);
  });

  it("does not move pinned or actively dragged nodes", () => {
    const pinned = makeNode("p", 10, 0, { pinned: true });
    const dragged = makeNode("d", 20, 0);
    const free = makeNode("f", 30, 0);
    const plane = makePlane([pinned, dragged, free], [], 0);

    simulate(1, plane, {
      dragNodeId: "d",
      constants: {
        repulsion: 0,
        springK: 0,
        centerPull: 1,
        damping: 1,
        forceScale: 1,
        driftForce: 0,
        maxSpeed: 9999,
      },
    });

    expect(pinned.x).toBe(10);
    expect(dragged.x).toBe(20);
    expect(Number.isFinite(free.x)).toBe(true);
    expect(Number.isFinite(free.y)).toBe(true);
    expect(Math.abs(free.x - 30) + Math.abs(free.y - 0)).toBeGreaterThan(0);
  });

  it("caps node velocity to maxSpeed", () => {
    const node = makeNode("n1", 100, 0);
    const plane = makePlane([node], [], 0);

    simulate(1, plane, {
      constants: {
        repulsion: 0,
        springK: 0,
        centerPull: 1,
        damping: 1,
        forceScale: 100,
        driftForce: 0,
        maxSpeed: 2,
      },
    });

    const speed = Math.hypot(node.vx, node.vy);
    expect(speed).toBeLessThanOrEqual(2 + 1e-9);
    expect(node.x).toBeCloseTo(98, 6);
  });

  it("applies repulsion so nearby nodes separate", () => {
    const a = makeNode("a", 0, 0);
    const b = makeNode("b", 1, 0);
    const plane = makePlane([a, b], [], 0);

    simulate(1, plane, {
      constants: {
        repulsion: 1000,
        springK: 0,
        centerPull: 0,
        damping: 1,
        forceScale: 0.1,
        driftForce: 0,
        maxSpeed: 9999,
      },
    });

    expect(a.x).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(1);
  });

  it("applies spring forces along edges and uses custom anchor pair", () => {
    const a = makeNode("a", 0, 0);
    const b = makeNode("b", 300, 0);
    const plane = makePlane([a, b], [{ a: "a", b: "b" }], 0);

    const edgeAnchorPair = vi.fn(() => ({
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    }));

    simulate(1, plane, {
      edgeAnchorPair,
      constants: {
        repulsion: 0,
        springK: 0.1,
        edgeLen: 100,
        centerPull: 0,
        damping: 1,
        forceScale: 0.1,
        driftForce: 0,
        maxSpeed: MAX_SPEED,
      },
    });

    expect(edgeAnchorPair).toHaveBeenCalledOnce();
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(300);
  });
});
