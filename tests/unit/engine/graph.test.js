import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NODE_TYPES,
  EDGE_KINDS,
  normalizeNodeType,
  normalizeEdgeProps,
  newPlane,
  createGraphState,
  activePlane,
  depthOfPlane,
  breadcrumbList,
  addNode,
  addEdge,
  findNode,
  findEdge,
  connectedNodes,
  removeNode,
  mergeNodes,
  ensurePortalPlane,
} from "../../../src/lib/engine/graph.js";

describe("graph engine primitives", () => {
  describe("constants", () => {
    it("exposes fixed node and edge type lists", () => {
      expect(NODE_TYPES).toEqual(["normal", "stargate"]);
      expect(EDGE_KINDS).toEqual([
        "context",
        "causal",
        "temporal",
        "associative",
        "user",
      ]);
    });
  });

  describe("normalizers", () => {
    it("normalizes node type with safe fallback", () => {
      expect(normalizeNodeType("normal")).toBe("normal");
      expect(normalizeNodeType("stargate")).toBe("stargate");
      expect(normalizeNodeType("unknown")).toBe("normal");
      expect(normalizeNodeType(null)).toBe("normal");
    });

    it("normalizes edge props with clamping and kind fallback", () => {
      const props = normalizeEdgeProps({
        label: "relates to",
        kind: "causal",
        strength: 99,
      });

      expect(props).toEqual({
        label: "relates to",
        kind: "causal",
        strength: 5,
      });

      const invalid = normalizeEdgeProps({
        label: "",
        kind: "not-a-kind",
        strength: 0,
      });

      expect(invalid).toEqual({
        label: "",
        kind: "context",
        strength: 1,
      });
    });
  });

  describe("plane + state creation", () => {
    it("creates plane with defaults and camera clamping", () => {
      const plane = newPlane({
        id: "plane_a",
        name: "Root",
        camera: { x: 10, y: 20, zoom: 99 },
      });

      expect(plane.id).toBe("plane_a");
      expect(plane.name).toBe("Root");
      expect(plane.parentPlaneId).toBeNull();
      expect(plane.parentNodeId).toBeNull();
      expect(Array.isArray(plane.nodes)).toBe(true);
      expect(Array.isArray(plane.edges)).toBe(true);
      expect(plane.camera).toEqual({ x: 10, y: 20, zoom: 4 });
      expect(plane.tick).toBe(0);
    });

    it("creates graph state with safe defaults", () => {
      const s = createGraphState();
      expect(s.version).toBe(1);
      expect(s.rootPlaneId).toBeNull();
      expect(s.activePlaneId).toBeNull();
      expect(s.planes).toEqual({});
      expect(s.ui).toEqual({});
      expect(s.cameraDefaults).toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });

  describe("state helpers", () => {
    it("returns active plane from state", () => {
      const p1 = newPlane({ id: "p1", name: "P1" });
      const p2 = newPlane({ id: "p2", name: "P2", parentPlaneId: "p1" });
      const state = createGraphState({
        rootPlaneId: "p1",
        activePlaneId: "p2",
        planes: { p1, p2 },
      });

      expect(activePlane(state)?.id).toBe("p2");
    });

    it("computes plane depth and breadcrumbs", () => {
      const p1 = newPlane({ id: "p1", name: "Root" });
      const p2 = newPlane({ id: "p2", name: "Child", parentPlaneId: "p1" });
      const p3 = newPlane({
        id: "p3",
        name: "Grandchild",
        parentPlaneId: "p2",
      });
      const state = createGraphState({
        rootPlaneId: "p1",
        activePlaneId: "p3",
        planes: { p1, p2, p3 },
      });

      expect(depthOfPlane(state, "p1")).toBe(0);
      expect(depthOfPlane(state, "p2")).toBe(1);
      expect(depthOfPlane(state, "p3")).toBe(2);

      const crumbs = breadcrumbList(state, "p3");
      expect(crumbs.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    });
  });

  describe("node/edge CRUD", () => {
    let plane;

    beforeEach(() => {
      plane = newPlane({ id: "plane_test", name: "Test" });
    });

    it("adds and finds nodes", () => {
      const node = addNode(plane, {
        id: "node_a",
        text: "A",
        x: 12,
        y: -4,
        type: "normal",
        pinned: true,
      });

      expect(node.id).toBe("node_a");
      expect(node.text).toBe("A");
      expect(node.x).toBe(12);
      expect(node.y).toBe(-4);
      expect(node.type).toBe("normal");
      expect(node.pinned).toBe(true);
      expect(findNode(plane, "node_a")).toBe(node);
    });

    it("adds and finds edges", () => {
      const a = addNode(plane, { id: "a", text: "A" });
      const b = addNode(plane, { id: "b", text: "B" });
      const edge = addEdge(plane, a, b, { kind: "temporal", strength: 2 });

      expect(edge).toBeTruthy();
      expect(edge.a).toBe("a");
      expect(edge.b).toBe("b");
      expect(edge.props.kind).toBe("temporal");
      expect(edge.props.strength).toBe(2);
      expect(findEdge(plane, edge.id)).toBe(edge);
    });

    it("returns connected node ids", () => {
      const a = addNode(plane, { id: "a", text: "A" });
      const b = addNode(plane, { id: "b", text: "B" });
      const c = addNode(plane, { id: "c", text: "C" });

      addEdge(plane, a, b);
      addEdge(plane, c, a);

      const ids = connectedNodes(plane, "a");
      expect(ids.has("b")).toBe(true);
      expect(ids.has("c")).toBe(true);
      expect(ids.size).toBe(2);
    });

    it("removes node and incident edges", () => {
      const a = addNode(plane, { id: "a", text: "A" });
      const b = addNode(plane, { id: "b", text: "B" });
      const c = addNode(plane, { id: "c", text: "C" });

      addEdge(plane, a, b);
      addEdge(plane, a, c);

      expect(plane.nodes.length).toBe(3);
      expect(plane.edges.length).toBe(2);

      const removed = removeNode(plane, "a");
      expect(removed).toBe(true);
      expect(findNode(plane, "a")).toBeNull();
      expect(plane.nodes.length).toBe(2);
      expect(plane.edges.length).toBe(0);
    });

    it("merges two nodes and creates a merged node with links", () => {
      const a = addNode(plane, { id: "a", text: "Alpha" });
      const b = addNode(plane, { id: "b", text: "Beta" });

      const merged = mergeNodes(plane, a, b);

      expect(merged).toBeTruthy();
      expect(merged.id).toBeTruthy();
      expect(merged.text.startsWith("Merge:")).toBe(true);

      expect(findNode(plane, "a")).toBeNull();
      expect(findNode(plane, "b")).toBeNull();

      const edgeToMerged = plane.edges.filter((e) => e.b === merged.id);
      expect(edgeToMerged.length).toBe(0);
      expect(plane.nodes.map((n) => n.id)).toEqual([merged.id]);
    });
  });

  describe("portal plane creation", () => {
    let randomSpy;

    beforeEach(() => {
      randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      randomSpy?.mockRestore();
    });

    it("creates a portal plane and links it from stargate node", () => {
      const root = newPlane({ id: "root", name: "Root" });
      const stargate = addNode(root, {
        id: "sg_1",
        text: "⊛ Deep Dive",
        type: "stargate",
      });

      const state = createGraphState({
        rootPlaneId: "root",
        activePlaneId: "root",
        planes: { root },
      });

      const portal = ensurePortalPlane(state, stargate, root);

      expect(portal).toBeTruthy();
      expect(portal.id).toBeTruthy();
      expect(portal.parentPlaneId).toBe("root");
      expect(portal.parentNodeId).toBe("sg_1");
      expect(state.planes[portal.id]).toBe(portal);
      expect(stargate.portalPlaneId).toBe(portal.id);

      expect(portal.nodes.length).toBeGreaterThanOrEqual(4);
      expect(portal.edges.length).toBeGreaterThanOrEqual(3);
    });

    it("reuses existing portal plane if already assigned", () => {
      const root = newPlane({ id: "root", name: "Root" });
      const stargate = addNode(root, {
        id: "sg_1",
        text: "⊛ Existing",
        type: "stargate",
      });

      const existingPortal = newPlane({
        id: "portal_existing",
        name: "Existing Portal",
        parentPlaneId: "root",
        parentNodeId: "sg_1",
      });

      stargate.portalPlaneId = "portal_existing";

      const state = createGraphState({
        rootPlaneId: "root",
        activePlaneId: "root",
        planes: {
          root,
          portal_existing: existingPortal,
        },
      });

      const result = ensurePortalPlane(state, stargate, root);
      expect(result).toBe(existingPortal);
      expect(Object.keys(state.planes)).toHaveLength(2);
    });
  });
});
