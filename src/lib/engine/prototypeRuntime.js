import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  newPlane as graphNewPlane,
  addNode as graphAddNode,
  normalizeEdgeProps as graphNormalizeEdgeProps,
  addEdge as graphAddEdge,
  findNode as graphFindNode,
  findEdge as graphFindEdge,
  connectedNodes as graphConnectedNodes,
  activePlane as graphActivePlane,
  depthOfPlane as graphDepthOfPlane,
  breadcrumbList as graphBreadcrumbList,
} from "./graph";
import { simulate as simulatePhysics } from "./physics";
import {
  drawBackground as drawBackgroundRenderer,
  drawEdges as drawEdgesRenderer,
  drawNodes as drawNodesRenderer,
} from "./renderer";
import { setupInputHandlers } from "./input";
import { createInspectorController } from "./inspectors";
import { createBreadcrumbController } from "./breadcrumbs";

export function initPrototypeRuntime(options = {}) {
  if (typeof window === "undefined") return null;
  window.marked = marked;
  window.DOMPurify = DOMPurify;

  const { autoStartLoop = true } = options;
  let runtimeControls = null;

  runtimeControls = (() => {
    const STORAGE_KEY = "bendscript-state-v1";
    const canvas = document.getElementById("graph");
    const ctx = canvas.getContext("2d");
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    const statNodes = document.getElementById("statNodes");
    const statEdges = document.getElementById("statEdges");
    const statDepth = document.getElementById("statDepth");
    const statZoom = document.getElementById("statZoom");
    const breadcrumbsEl = document.getElementById("breadcrumbs");
    const hintEl = document.getElementById("hint");
    const nodeModeToggle = document.getElementById("nodeModeToggle");
    const composer = document.getElementById("composer");
    const composerDragHandle = document.getElementById("composerDragHandle");
    const composerTargetEl = document.getElementById("composerTarget");
    const promptInput = document.getElementById("promptInput");
    const composerForm = document.getElementById("composerForm");
    const menu = document.getElementById("contextMenu");
    const warp = document.getElementById("warp");
    const edgeInspector = document.getElementById("edgeInspector");
    const edgePropLabel = document.getElementById("edgePropLabel");
    const edgePropKind = document.getElementById("edgePropKind");
    const edgePropStrength = document.getElementById("edgePropStrength");
    const edgeInspectorEmpty = document.getElementById("edgeInspectorEmpty");
    const nodeInspector = document.getElementById("nodeInspector");
    const nodeText = document.getElementById("nodeText");
    const nodeMdBackdrop = document.getElementById("nodeMdBackdrop");
    const nodeMdOverlay = document.getElementById("nodeMdOverlay");
    const nodeMdTitle = document.getElementById("nodeMdTitle");
    const nodeMdTabs = document.getElementById("nodeMdTabs");
    const nodeMdClose = document.getElementById("nodeMdClose");
    const nodeMdOpenBtn = document.getElementById("nodeMdOpenBtn");
    const nodeMdEditor = document.getElementById("nodeMdEditor");
    const nodeMdPreview = document.getElementById("nodeMdPreview");
    const nodeType = document.getElementById("nodeType");
    const nodePinned = document.getElementById("nodePinned");
    const nodeInspectorEmpty = document.getElementById("nodeInspectorEmpty");

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rand = (a, b) => a + Math.random() * (b - a);
    const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
    const now = () => performance.now();

    const NODE_MIN_WIDTH = 190;
    const NODE_MAX_WIDTH = 540;
    const NODE_MIN_HEIGHT = 88;
    const NODE_MAX_HEIGHT = 420;
    const NODE_RESIZE_HANDLE_PX = 14;
    const NODE_BODY_TOP_PAD = 10;
    const NODE_BODY_BOTTOM_PAD = 12;

    function uid(prefix) {
      return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
    }

    const state = loadState() || seedState();
    state.ui = {
      selectedNodeId: state.ui?.selectedNodeId || null,
      selectedEdgeId: state.ui?.selectedEdgeId || null,
      editMode: state.ui?.editMode === "preview" ? "preview" : "edit",
      composerPos:
        state.ui?.composerPos && state.ui.composerPos.free
          ? state.ui.composerPos
          : { free: false, x: 0, y: 0 },
      mergeSourceNodeId: null,
      connectSourceNodeId: null,
      panMode: false,
      dragNodeId: null,
      dragOffsetX: 0,
      dragOffsetY: 0,
      resizeNodeId: null,
      pointerDownAt: null,
      pointerMoved: false,
      contextNodeId: null,
      nodeMdOverlayOpen: state.ui?.nodeMdOverlayOpen === true,
      nodeMdOverlayView:
        state.ui?.nodeMdOverlayView === "preview" ? "preview" : "write",
    };

    function seedState() {
      const root = newPlane({
        id: "plane_root",
        name: "BendScript",
        parentPlaneId: null,
        parentNodeId: null,
      });

      const rootCenter = addNode(root, {
        text: "BendScript",
        x: 0,
        y: 0,
        type: "normal",
        pinned: true,
      });

      const n1 = addNode(root, {
        text: "What is Script Bending?",
        x: 290,
        y: -42,
        type: "normal",
      });
      const n2 = addNode(root, {
        text: "⊛ Stargates",
        x: -230,
        y: -64,
        type: "stargate",
      });
      const n3 = addNode(root, {
        text: "Graph Prompting",
        x: -170,
        y: 206,
        type: "normal",
      });
      const n4 = addNode(root, {
        text: "The Protocol",
        x: 282,
        y: 180,
        type: "normal",
      });
      const n5 = addNode(root, {
        text: "Bend the flow of scripts",
        x: 540,
        y: -36,
        type: "normal",
      });
      const n6 = addNode(root, {
        text: "⊛ Examples",
        x: -460,
        y: -120,
        type: "stargate",
      });
      const n7 = addNode(root, {
        text: "⊛ Try It",
        x: -400,
        y: 265,
        type: "stargate",
      });
      const n8 = addNode(root, {
        text: "⊛ Deep Dive",
        x: 530,
        y: 300,
        type: "stargate",
      });

      addEdge(root, rootCenter, n1, {
        label: "defines",
        kind: "context",
        strength: 3,
      });
      addEdge(root, rootCenter, n2, {
        label: "portals",
        kind: "associative",
        strength: 4,
      });
      addEdge(root, rootCenter, n3, {
        label: "interaction model",
        kind: "context",
        strength: 3,
      });
      addEdge(root, rootCenter, n4, {
        label: "spec backbone",
        kind: "causal",
        strength: 4,
      });
      addEdge(root, n1, n5, {
        label: "expands",
        kind: "associative",
        strength: 2,
      });
      addEdge(root, n2, n6, {
        label: "examples",
        kind: "temporal",
        strength: 2,
      });
      addEdge(root, n3, n7, {
        label: "hands-on",
        kind: "user",
        strength: 3,
      });
      addEdge(root, n4, n8, {
        label: "deep context",
        kind: "causal",
        strength: 5,
      });

      const s = {
        version: 1,
        rootPlaneId: root.id,
        activePlaneId: root.id,
        planes: { [root.id]: root },
        ui: { selectedNodeId: rootCenter.id },
        cameraDefaults: { x: 0, y: 0, zoom: 1 },
      };
      return s;
    }

    function newPlane(args) {
      return graphNewPlane(args);
    }

    function addNode(plane, spec) {
      return graphAddNode(plane, spec);
    }

    function normalizeEdgeProps(props = {}) {
      return graphNormalizeEdgeProps(props);
    }

    function addEdge(plane, nodeA, nodeB, props = {}) {
      return graphAddEdge(plane, nodeA, nodeB, props);
    }

    function findNode(plane, nodeId) {
      return graphFindNode(plane, nodeId);
    }

    function findEdge(plane, edgeId) {
      return graphFindEdge(plane, edgeId);
    }

    function connectedNodes(plane, nodeId) {
      return graphConnectedNodes(plane, nodeId);
    }

    function activePlane() {
      return graphActivePlane(state);
    }

    function depthOfPlane(planeId) {
      return graphDepthOfPlane(state, planeId);
    }

    function breadcrumbList(planeId) {
      return graphBreadcrumbList(state, planeId);
    }

    function ensurePortalPlane(node, sourcePlane) {
      if (node.portalPlaneId && state.planes[node.portalPlaneId])
        return state.planes[node.portalPlaneId];

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
      state.ui.selectedNodeId = hub.id;
      saveSoon();
      return plane;
    }

    function removeNode(plane, nodeId) {
      const node = findNode(plane, nodeId);
      if (!node) return;

      const prevSelectedEdgeId = state.ui.selectedEdgeId;

      plane.nodes = plane.nodes.filter((n) => n.id !== nodeId);
      plane.edges = plane.edges.filter((e) => e.a !== nodeId && e.b !== nodeId);

      if (
        prevSelectedEdgeId &&
        !plane.edges.some((e) => e.id === prevSelectedEdgeId)
      ) {
        state.ui.selectedEdgeId = null;
        syncEdgeInspector();
      }

      if (state.ui.selectedNodeId === nodeId) {
        state.ui.selectedNodeId = plane.nodes[0]?.id || null;
      }
    }

    function mergeNodes(plane, nodeA, nodeB) {
      const mx = (nodeA.x + nodeB.x) * 0.5 + rand(-45, 45);
      const my = (nodeA.y + nodeB.y) * 0.5 + rand(-45, 45);
      const merged = addNode(plane, {
        text: `Merge: ${trimText(nodeA.text, 34)} + ${trimText(nodeB.text, 34)}`,
        x: mx,
        y: my,
      });
      addEdge(plane, nodeA, merged);
      addEdge(plane, nodeB, merged);
      state.ui.selectedNodeId = merged.id;
    }

    function trimText(str, n = 42) {
      if (str.length <= n) return str;
      return str.slice(0, n - 1) + "…";
    }

    function projectToScreen(wx, wy, camera, W, H) {
      return {
        x: (wx - camera.x) * camera.zoom + W * 0.5,
        y: (wy - camera.y) * camera.zoom + H * 0.5,
      };
    }

    function screenToWorld(sx, sy, camera, W, H) {
      return {
        x: (sx - W * 0.5) / camera.zoom + camera.x,
        y: (sy - H * 0.5) / camera.zoom + camera.y,
      };
    }

    function nodeCardSize(n) {
      const maxCharsPerLine = 22;
      const text = String(n.text || "");
      const lineCount = Math.max(
        1,
        Math.min(6, Math.ceil(text.length / maxCharsPerLine)),
      );
      const autoWidth = clamp(
        190 +
          Math.min(180, text.length * 1.8) +
          (n.type === "stargate" ? 24 : 0),
        NODE_MIN_WIDTH,
        Math.min(380, NODE_MAX_WIDTH),
      );
      const autoHeight = clamp(
        82 + lineCount * 18 + (n.type === "stargate" ? 12 : 0),
        NODE_MIN_HEIGHT,
        Math.min(240, NODE_MAX_HEIGHT),
      );
      const width = Number.isFinite(n.width)
        ? clamp(n.width, NODE_MIN_WIDTH, NODE_MAX_WIDTH)
        : autoWidth;
      const height = Number.isFinite(n.height)
        ? clamp(n.height, NODE_MIN_HEIGHT, NODE_MAX_HEIGHT)
        : autoHeight;
      const corner = 18;
      return { width, height, corner };
    }

    function nodeRadius(n) {
      const s = nodeCardSize(n);
      return Math.hypot(s.width * 0.5, s.height * 0.5) * 0.52;
    }

    function nodeAtPoint(plane, wx, wy) {
      for (let i = plane.nodes.length - 1; i >= 0; i--) {
        const n = plane.nodes[i];
        const s = nodeCardSize(n);
        const left = n.x - s.width * 0.5;
        const right = n.x + s.width * 0.5;
        const top = n.y - s.height * 0.5;
        const bottom = n.y + s.height * 0.5;
        if (wx >= left && wx <= right && wy >= top && wy <= bottom) {
          return n;
        }
      }
      return null;
    }

    function isPointOnNodeResizeHandle(n, wx, wy, cameraZoom = 1) {
      if (!n) return false;
      const s = nodeCardSize(n);
      const right = n.x + s.width * 0.5;
      const bottom = n.y + s.height * 0.5;
      const handle = NODE_RESIZE_HANDLE_PX / Math.max(0.2, cameraZoom);

      return (
        wx >= right - handle &&
        wx <= right &&
        wy >= bottom - handle &&
        wy <= bottom
      );
    }

    function edgeAnchorPair(a, b) {
      const sa = nodeCardSize(a);
      const sb = nodeCardSize(b);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 0.001;
      const ux = dx / L;
      const uy = dy / L;

      const ax = sa.width * 0.5;
      const ay = sa.height * 0.5;
      const bx = sb.width * 0.5;
      const by = sb.height * 0.5;

      const ta = 1 / Math.max(Math.abs(ux) / ax, Math.abs(uy) / ay);
      const tb = 1 / Math.max(Math.abs(ux) / bx, Math.abs(uy) / by);

      return {
        a: { x: a.x + ux * ta, y: a.y + uy * ta },
        b: { x: b.x - ux * tb, y: b.y - uy * tb },
      };
    }

    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - x1) * dx + (py - y1) * dy) / len2;
      t = clamp(t, 0, 1);
      const sx = x1 + t * dx;
      const sy = y1 + t * dy;
      return dist(px, py, sx, sy);
    }

    function edgeAtPoint(plane, wx, wy, threshold = 14) {
      let best = null;
      let bestD = Infinity;
      for (const e of plane.edges) {
        const a = findNode(plane, e.a);
        const b = findNode(plane, e.b);
        if (!a || !b) continue;
        const anchors = edgeAnchorPair(a, b);
        const d = pointToSegmentDistance(
          wx,
          wy,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
        );
        if (d < threshold && d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    }

    function resize() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const scale = dpr();
      canvas.width = Math.floor(W * scale);
      canvas.height = Math.floor(H * scale);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    window.addEventListener(
      "resize",
      () => {
        resize();
        applyComposerPosition();
      },
      { passive: true },
    );
    resize();
    applyComposerPosition();

    let lastT = now();
    let rafId = null;
    let loopRunning = false;
    let autosaveIntervalId = null;
    let saveTimer = null;
    function saveSoon() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveState, 220);
    }

    function saveState() {
      const serializable = {
        version: state.version || 1,
        rootPlaneId: state.rootPlaneId,
        activePlaneId: state.activePlaneId,
        planes: state.planes,
        ui: {
          selectedNodeId: state.ui.selectedNodeId,
          selectedEdgeId: state.ui.selectedEdgeId,
          editMode: state.ui.editMode,
          composerPos: state.ui.composerPos,
          nodeMdOverlayOpen: !!state.ui.nodeMdOverlayOpen,
          nodeMdOverlayView:
            state.ui.nodeMdOverlayView === "preview" ? "preview" : "write",
        },
        cameraDefaults: state.cameraDefaults || {
          x: 0,
          y: 0,
          zoom: 1,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.planes || !parsed.activePlaneId) return null;
        for (const p of Object.values(parsed.planes)) {
          p.nodes = Array.isArray(p.nodes) ? p.nodes : [];
          p.edges = Array.isArray(p.edges) ? p.edges : [];

          p.nodes.forEach((n) => {
            n.text = String(n.text || "").slice(0, 4000);
            n.vx = Number.isFinite(n.vx) ? n.vx : 0;
            n.vy = Number.isFinite(n.vy) ? n.vy : 0;
            n.fx = 0;
            n.fy = 0;
            n.pulse = Number.isFinite(n.pulse)
              ? n.pulse
              : Math.random() * Math.PI * 2;
            n.type = n.type === "stargate" ? "stargate" : "normal";
            n.width = Number.isFinite(n.width)
              ? clamp(n.width, NODE_MIN_WIDTH, NODE_MAX_WIDTH)
              : null;
            n.height = Number.isFinite(n.height)
              ? clamp(n.height, NODE_MIN_HEIGHT, NODE_MAX_HEIGHT)
              : null;
            n.scrollY = clamp(Number(n.scrollY) || 0, 0, 100000);
          });

          p.edges = p.edges.filter(
            (e) =>
              e &&
              typeof e === "object" &&
              typeof e.a === "string" &&
              typeof e.b === "string",
          );
          p.edges.forEach((e) => {
            e.props = normalizeEdgeProps(e.props);
          });

          p.tick = Number.isFinite(p.tick) ? p.tick : 0;
          if (!p.camera) p.camera = { x: 0, y: 0, zoom: 1 };
        }
        return parsed;
      } catch {
        return null;
      }
    }

    function resetHint(msg) {
      hintEl.innerHTML = msg;
    }

    const inspectorController = createInspectorController({
      state,
      activePlane,
      findNode,
      findEdge,
      normalizeEdgeProps,
      trimText,
      saveSoon,
      refs: {
        edgePropLabel,
        edgePropKind,
        edgePropStrength,
        edgeInspectorEmpty,
        nodeText,
        nodeType,
        nodePinned,
        nodeInspectorEmpty,
        nodeModeToggle,
        composerTargetEl,
        nodeMdBackdrop,
        nodeMdOverlay,
        nodeMdTitle,
        nodeMdTabs,
        nodeMdClose,
        nodeMdOpenBtn,
        nodeMdEditor,
        nodeMdPreview,
      },
    });

    function currentTargetNode() {
      return inspectorController.currentTargetNode();
    }

    function setSelected(nodeId) {
      inspectorController.setSelected(nodeId);
    }

    function setSelectedEdge(edgeId) {
      inspectorController.setSelectedEdge(edgeId);
    }

    function syncEdgeInspector() {
      inspectorController.syncEdgeInspector();
    }

    function syncModeUI() {
      inspectorController.syncModeUI();
    }

    function syncNodeInspector() {
      inspectorController.syncNodeInspector();
    }

    function applyNodeInspectorToSelection() {
      inspectorController.applyNodeInspectorToSelection();
    }

    function isEditMode() {
      return inspectorController.isEditMode();
    }

    function updateNodeMarkdownPreview() {
      inspectorController.updateNodeMarkdownPreview();
    }

    function syncNodeMdOverlayForSelection() {
      inspectorController.syncNodeMdOverlayForSelection();
    }

    function applyComposerPosition() {
      if (state.ui.composerPos?.free) {
        const rect = composer.getBoundingClientRect();
        const W = window.innerWidth;
        const H = window.innerHeight;
        const x = clamp(state.ui.composerPos.x, 8, W - rect.width - 8);
        const y = clamp(state.ui.composerPos.y, 8, H - rect.height - 8);
        composer.classList.add("free");
        composer.style.left = `${x}px`;
        composer.style.top = `${y}px`;
        composer.style.bottom = "auto";
        composer.style.transform = "none";
        state.ui.composerPos.x = x;
        state.ui.composerPos.y = y;
      } else {
        composer.classList.remove("free");
        composer.style.left = "50%";
        composer.style.top = "50%";
        composer.style.bottom = "auto";
        composer.style.transform = "translate(-50%, -50%)";
      }
    }

    function installComposerDrag() {
      let drag = null;

      composerDragHandle.addEventListener("pointerdown", (e) => {
        const rect = composer.getBoundingClientRect();
        composer.classList.add("free");
        composer.style.left = `${rect.left}px`;
        composer.style.top = `${rect.top}px`;
        composer.style.bottom = "auto";
        composer.style.transform = "none";
        drag = {
          id: e.pointerId,
          dx: e.clientX - rect.left,
          dy: e.clientY - rect.top,
        };
        composerDragHandle.setPointerCapture(e.pointerId);
      });

      composerDragHandle.addEventListener("pointermove", (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const rect = composer.getBoundingClientRect();
        const nx = clamp(e.clientX - drag.dx, 8, W - rect.width - 8);
        const ny = clamp(e.clientY - drag.dy, 8, H - rect.height - 8);
        composer.style.left = `${nx}px`;
        composer.style.top = `${ny}px`;
      });

      composerDragHandle.addEventListener("pointerup", (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        composerDragHandle.releasePointerCapture(e.pointerId);
        const rect = composer.getBoundingClientRect();
        state.ui.composerPos = {
          free: true,
          x: rect.left,
          y: rect.top,
        };
        drag = null;
        saveSoon();
      });

      composerDragHandle.addEventListener("dblclick", () => {
        state.ui.composerPos = { free: false, x: 0, y: 0 };
        applyComposerPosition();
        saveSoon();
      });
    }

    // ============================================================
    // NOTE: generateResponse() is a KEYWORD STUB for the prototype.
    // It returns canned strings based on keyword matching — there is
    // no real AI integration here. The production version replaces
    // this with Claude API calls via the Edge Function proxy.
    // See BUILD.md Phase 3 for the real implementation:
    //   - Tier 1: Contextual response (single node)
    //   - Tier 2: Graph-aware synthesis (2–4 nodes using topology)
    //   - Tier 3: Topic-to-graph (8–12 node subgraph)
    //   - Tier 4: Edge inference (connect to existing nodes)
    // The spawnPromptFlow() function below is also replaced by
    // src/lib/ai/graphSynthesis.js in the SvelteKit migration.
    // ============================================================
    function generateResponse(prompt) {
      const p = prompt.toLowerCase();
      if (
        p.includes("stargate") ||
        p.includes("portal") ||
        p.includes("deeper")
      ) {
        return "⊛ Opened a stargate into a deeper graph plane.";
      }
      if (p.includes("protocol"))
        return "The protocol branch maps structure, constraints, and flow contracts.";
      if (p.includes("graph"))
        return "Graph topology reshapes sequence into navigable context.";
      if (p.includes("fork"))
        return "Fork created: parallel trajectories can now evolve independently.";
      return `Bended: ${trimText(prompt, 120)} → linked as a new context node.`;
    }

    function spawnPromptFlow(text) {
      const clean = text.trim();
      if (!clean) return;
      const plane = activePlane();
      const parent =
        currentTargetNode() ||
        plane.nodes[0] ||
        addNode(plane, { text: "BendScript", pinned: true });
      const angle = rand(-Math.PI * 0.4, Math.PI * 0.4);
      const d1 = rand(120, 180);
      const d2 = rand(130, 190);

      const userNode = addNode(plane, {
        text: clean,
        x: parent.x + Math.cos(angle) * d1,
        y: parent.y + Math.sin(angle) * d1,
      });
      addEdge(plane, parent, userNode);

      const response = generateResponse(clean);
      const responseNode = addNode(plane, {
        text: response,
        x: userNode.x + Math.cos(angle + rand(-0.4, 0.4)) * d2,
        y: userNode.y + Math.sin(angle + rand(-0.4, 0.4)) * d2,
        type: response.startsWith("⊛") ? "stargate" : "normal",
      });
      addEdge(plane, userNode, responseNode);

      setSelected(responseNode.id);
      promptInput.value = "";
      saveSoon();
    }

    function triggerWarp(callback) {
      warp.classList.add("active");
      setTimeout(() => {
        callback();
        warp.classList.remove("active");
      }, 280);
    }

    const cleanupInputHandlers = setupInputHandlers({
      canvas,
      canvasCtx: ctx,
      menu,
      composerForm,
      promptInput,
      composer,
      composerDragHandle,
      composerTargetEl,
      state,

      activePlane,
      findNode,
      edgeAtPoint,
      nodeAtPoint,
      isPointOnNodeResizeHandle,
      screenToWorld,
      clamp,
      dist,
      now,
      isEditMode,
      setSelected,
      setSelectedEdge,
      syncEdgeInspector,
      saveSoon,
      saveState,
      addNode,
      addEdge,
      removeNode,
      mergeNodes,
      ensurePortalPlane,
      resetHint,
      trimText,
      rand,
      currentTargetNode,
      generateResponse,
      triggerWarp,
      nodeCardSize,
      wrapMarkdownLines,

      nodeMdOverlay,
      nodeMdBackdrop,

      NODE_MIN_WIDTH,
      NODE_MAX_WIDTH,
      NODE_MIN_HEIGHT,
      NODE_MAX_HEIGHT,
      NODE_BODY_TOP_PAD,
      NODE_BODY_BOTTOM_PAD,

      applyComposerPosition,
    });

    const breadcrumbController = createBreadcrumbController({
      breadcrumbsEl,
      state,
      breadcrumbList,
      triggerWarp,
      activePlane,
      setSelected,
      saveSoon,
    });

    function updateBreadcrumbs() {
      breadcrumbController.update();
    }

    function simulate(dt) {
      const plane = activePlane();
      simulatePhysics(dt, plane, {
        dragNodeId: state.ui.dragNodeId,
        findNode,
        edgeAnchorPair,
      });
    }

    function drawBackground(W, H, t) {
      drawBackgroundRenderer({
        ctx,
        W,
        H,
        t,
        state,
      });
    }

    function drawEdges(plane, W, H, t) {
      drawEdgesRenderer({
        ctx,
        plane,
        W,
        H,
        t,
        state,
        deps: {
          connectedNodes,
          findNode,
          edgeAnchorPair,
          projectToScreen,
          dist,
          normalizeEdgeProps,
          clamp,
        },
      });
    }

    function markdownToPlainLines(text) {
      const src = String(text || "").replace(/\r\n/g, "\n");
      const raw = src.split("\n");
      const out = [];
      let inFence = false;

      for (let line of raw) {
        if (/^\s*```/.test(line)) {
          inFence = !inFence;
          continue;
        }

        let s = line;

        if (!inFence) {
          const heading = s.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
          if (heading) s = heading[2];

          const ul = s.match(/^\s*[-*+]\s+(.*)$/);
          if (ul) s = "• " + ul[1];

          const ol = s.match(/^\s*(\d+)\.\s+(.*)$/);
          if (ol) s = `${ol[1]}. ${ol[2]}`;

          s = s.replace(/^\s*>\s?/, "");
        }

        s = s
          .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/__([^_]+)__/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          .replace(/~~([^~]+)~~/g, "$1")
          .trim();

        out.push(s);
      }

      return out;
    }

    function wrapMarkdownLines(text, maxWidth, baseFontSize = 13) {
      const plainFromHtml = (html) => {
        const el = document.createElement("div");
        el.innerHTML = html || "";
        return (el.textContent || "").replace(/\s+/g, " ").trim();
      };

      const measureWithKind = (kind, s) => {
        if (kind === "h") {
          ctx.font = `${Math.max(12, baseFontSize * 1.12)}px ui-monospace, monospace`;
        } else if (kind === "code") {
          ctx.font = `${Math.max(10, baseFontSize * 0.95)}px ui-monospace, monospace`;
        } else {
          ctx.font = `${baseFontSize}px ui-monospace, monospace`;
        }
        return ctx.measureText(s).width;
      };

      const blocks = [];
      if (window.marked && typeof window.marked.lexer === "function") {
        const tokens = window.marked.lexer(String(text || ""), {
          gfm: true,
          breaks: true,
        });

        for (const t of tokens) {
          if (t.type === "heading") {
            blocks.push({
              kind: "h",
              text: plainFromHtml(window.marked.parseInline(t.text || "")),
            });
            continue;
          }

          if (t.type === "paragraph") {
            blocks.push({
              kind: "p",
              text: plainFromHtml(window.marked.parseInline(t.text || "")),
            });
            continue;
          }

          if (t.type === "list" && Array.isArray(t.items)) {
            t.items.forEach((item, i) => {
              const bullet = t.ordered ? `${i + 1}. ` : "• ";
              blocks.push({
                kind: "li",
                text:
                  bullet +
                  plainFromHtml(window.marked.parseInline(item.text || "")),
              });
            });
            continue;
          }

          if (t.type === "blockquote") {
            const inner = Array.isArray(t.tokens) ? t.tokens : [];
            for (const bt of inner) {
              const txt =
                bt.type === "paragraph"
                  ? plainFromHtml(window.marked.parseInline(bt.text || ""))
                  : plainFromHtml(bt.raw || bt.text || "");
              blocks.push({
                kind: "quote",
                text: txt ? `│ ${txt}` : "│",
              });
            }
            continue;
          }

          if (t.type === "code") {
            String(t.text || "")
              .split("\n")
              .forEach((ln) =>
                blocks.push({
                  kind: "code",
                  text: ln || " ",
                }),
              );
            continue;
          }

          if (t.type === "space") {
            blocks.push({ kind: "p", text: "" });
          }
        }
      } else {
        markdownToPlainLines(text).forEach((ln) =>
          blocks.push({ kind: "p", text: ln }),
        );
      }

      const wrapped = [];
      for (const block of blocks) {
        const srcLine = String(block.text || "");
        const kind = block.kind || "p";

        if (!srcLine) {
          wrapped.push({ kind, text: "" });
          continue;
        }

        const words = srcLine.split(/\s+/).filter(Boolean);
        let line = "";

        for (const w of words) {
          const test = line ? `${line} ${w}` : w;

          if (measureWithKind(kind, test) <= maxWidth) {
            line = test;
            continue;
          }

          if (line) wrapped.push({ kind, text: line });

          if (measureWithKind(kind, w) <= maxWidth) {
            line = w;
            continue;
          }

          let chunk = "";
          for (const ch of w) {
            const nextChunk = chunk + ch;
            if (measureWithKind(kind, nextChunk) > maxWidth && chunk) {
              wrapped.push({ kind, text: chunk });
              chunk = ch;
            } else {
              chunk = nextChunk;
            }
          }
          line = chunk;
        }

        if (line) wrapped.push({ kind, text: line });
      }

      return wrapped;
    }

    function drawNodeText(
      node,
      text,
      x,
      y,
      maxWidth,
      maxHeight,
      lineHeight = 15,
      color = "#222222",
      fontSize = 13,
    ) {
      const lineHeightForKind = (kind) =>
        kind === "h" ? lineHeight * 1.18 : lineHeight;

      const lines = wrapMarkdownLines(text, maxWidth, fontSize);
      const contentH = lines.reduce(
        (acc, ln) => acc + lineHeightForKind(ln.kind),
        0,
      );
      const maxScroll = Math.max(0, contentH - maxHeight);
      node.scrollY = clamp(Number(node.scrollY) || 0, 0, maxScroll);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, maxWidth, maxHeight);
      ctx.clip();

      let yy = y - node.scrollY;
      for (const ln of lines) {
        const lh = lineHeightForKind(ln.kind);

        if (ln.kind === "h") {
          ctx.fillStyle = "#222222";
          ctx.font = `${Math.max(12, fontSize * 1.12)}px ui-monospace, monospace`;
        } else if (ln.kind === "quote") {
          ctx.fillStyle = "#555555";
          ctx.font = `${fontSize}px ui-monospace, monospace`;
        } else if (ln.kind === "code") {
          ctx.fillStyle = "#3a3a3a";
          ctx.font = `${Math.max(10, fontSize * 0.95)}px ui-monospace, monospace`;
        } else if (ln.kind === "li") {
          ctx.fillStyle = color;
          ctx.font = `${fontSize}px ui-monospace, monospace`;
        } else {
          ctx.fillStyle = color;
          ctx.font = `${fontSize}px ui-monospace, monospace`;
        }

        if (yy > y + maxHeight) break;
        if (yy + lh >= y) ctx.fillText(ln.text, x, yy);
        yy += lh;
      }

      ctx.restore();
      return { lineCount: lines.length, maxScroll };
    }

    function drawNodes(plane, W, H, t) {
      drawNodesRenderer({
        ctx,
        plane,
        W,
        H,
        t,
        state,
        deps: {
          connectedNodes,
          projectToScreen,
          nodeCardSize,
          dist,
          clamp,
          isEditMode,
          drawNodeText,
          syncNodeMdOverlayForSelection,
          NODE_BODY_TOP_PAD,
          NODE_BODY_BOTTOM_PAD,
        },
      });
    }

    function updateStats() {
      const plane = activePlane();
      statNodes.textContent = String(plane.nodes.length);
      statEdges.textContent = String(plane.edges.length);
      statDepth.textContent = String(depthOfPlane(plane.id));
      statZoom.textContent = `${plane.camera.zoom.toFixed(2)}x`;
    }

    function frame() {
      const t = now();
      const dt = Math.min(33, t - lastT);
      lastT = t;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const plane = activePlane();

      simulate(dt);

      ctx.clearRect(0, 0, W, H);
      drawBackground(W, H, t);
      drawEdges(plane, W, H, t);
      drawNodes(plane, W, H, t);

      updateStats();
      updateBreadcrumbs();
    }

    function startLoop() {
      if (loopRunning) return;
      loopRunning = true;

      const step = () => {
        if (!loopRunning) return;
        frame();
        rafId = requestAnimationFrame(step);
      };

      rafId = requestAnimationFrame(step);
    }

    function stopLoop() {
      loopRunning = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function destroy() {
      stopLoop();
      if (autosaveIntervalId != null) {
        clearInterval(autosaveIntervalId);
        autosaveIntervalId = null;
      }
      cleanupInputHandlers();
      inspectorController.cleanup();
      breadcrumbController.cleanup();
      saveState();
    }

    setSelected(state.ui.selectedNodeId || activePlane().nodes[0]?.id || null);
    if (state.ui.selectedEdgeId) {
      setSelectedEdge(state.ui.selectedEdgeId);
    } else {
      syncEdgeInspector();
    }
    syncNodeInspector();
    syncModeUI();
    applyComposerPosition();

    promptInput.value = "";
    promptInput.focus({ preventScroll: true });

    window.addEventListener("beforeunload", destroy);
    autosaveIntervalId = setInterval(saveState, 6000);

    if (autoStartLoop) {
      startLoop();
    }

    return {
      frame,
      startLoop,
      stopLoop,
      destroy,
      getState: () => state,
    };
  })();

  return runtimeControls;
}
