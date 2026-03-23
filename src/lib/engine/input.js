export const DEFAULT_HINT_TEXT =
  "<strong>Drag</strong> nodes to bend layout • <strong>Wheel/Pinch-ish</strong> to zoom • <strong>Right-click</strong> node for fork/merge/connect/pin/stargate/bend/unbend/delete • <strong>Right-click edge</strong> to select exact edge, then kind/reverse/delete • <strong>Click edge</strong> to select for inspector/Delete key • <strong>Click stargate</strong> to portal";

function req(name, value) {
  if (value == null) {
    throw new Error(
      `input.setupInputHandlers: missing required dependency "${name}"`,
    );
  }
  return value;
}

function noop() {}

export function setupInputHandlers(rawCtx = {}) {
  const ctx = rawCtx || {};

  // Required core deps
  const canvas = req("canvas", ctx.canvas);
  const state = req("state", ctx.state);
  const activePlane = req("activePlane", ctx.activePlane);
  const findNode = req("findNode", ctx.findNode);
  const edgeAtPoint = req("edgeAtPoint", ctx.edgeAtPoint);
  const nodeAtPoint = req("nodeAtPoint", ctx.nodeAtPoint);
  const isPointOnNodeResizeHandle = req(
    "isPointOnNodeResizeHandle",
    ctx.isPointOnNodeResizeHandle,
  );
  const screenToWorld = req("screenToWorld", ctx.screenToWorld);
  const clamp = req("clamp", ctx.clamp);
  const dist = req("dist", ctx.dist);
  const now = req("now", ctx.now);
  const isEditMode = req("isEditMode", ctx.isEditMode);
  const setSelected = req("setSelected", ctx.setSelected);
  const setSelectedEdge = req("setSelectedEdge", ctx.setSelectedEdge);
  const syncEdgeInspector = req("syncEdgeInspector", ctx.syncEdgeInspector);
  const saveSoon = req("saveSoon", ctx.saveSoon);
  const saveState = req("saveState", ctx.saveState);
  const addNode = req("addNode", ctx.addNode);
  const addEdge = req("addEdge", ctx.addEdge);
  const removeNode = req("removeNode", ctx.removeNode);
  const mergeNodes = req("mergeNodes", ctx.mergeNodes);
  const ensurePortalPlane = req("ensurePortalPlane", ctx.ensurePortalPlane);
  const resetHint = req("resetHint", ctx.resetHint);
  const trimText = req("trimText", ctx.trimText);
  const rand = req("rand", ctx.rand);
  const currentTargetNode = req("currentTargetNode", ctx.currentTargetNode);
  const generateResponse = req("generateResponse", ctx.generateResponse);
  const triggerWarp = req("triggerWarp", ctx.triggerWarp);
  const nodeCardSize = req("nodeCardSize", ctx.nodeCardSize);
  const wrapMarkdownLines = req("wrapMarkdownLines", ctx.wrapMarkdownLines);
  const canvasCtx = req("canvasCtx", ctx.canvasCtx);

  // Required UI refs
  const menu = req("menu", ctx.menu);
  const composerForm = req("composerForm", ctx.composerForm);
  const promptInput = req("promptInput", ctx.promptInput);
  const composer = req("composer", ctx.composer);
  const composerDragHandle = req("composerDragHandle", ctx.composerDragHandle);

  // Optional refs
  const nodeMdOverlay = ctx.nodeMdOverlay || null;
  const nodeMdBackdrop = ctx.nodeMdBackdrop || null;
  const composerTargetEl = ctx.composerTargetEl || null;

  // Optional topology hooks
  const previewConnectImpact =
    typeof ctx.previewConnectImpact === "function"
      ? ctx.previewConnectImpact
      : null;
  const bendNodeTopology =
    typeof ctx.bendNodeTopology === "function" ? ctx.bendNodeTopology : null;
  const unbendNodeTopology =
    typeof ctx.unbendNodeTopology === "function"
      ? ctx.unbendNodeTopology
      : null;

  const CONNECT_CONFIRM_WINDOW_MS = 2500;
  const EDGE_CYCLE_WINDOW_MS = 1200;
  const EDGE_KIND_ORDER = [
    "context",
    "causal",
    "temporal",
    "associative",
    "user",
  ];

  function riskLevelFromPreview(preview) {
    if (!preview) return "low";
    if (preview.createsNewScc || preview.kappaDelta >= 2) return "high";
    if (preview.kappaDelta > 0) return "medium";
    return "low";
  }

  function connectPreviewHint(preview) {
    if (!preview) {
      return "<strong>Connect preview:</strong> no topology impact";
    }

    const risk = riskLevelFromPreview(preview);
    const sccNote = preview.createsNewScc ? " · creates new SCC" : "";
    const kappaDelta = Number.isFinite(preview.kappaDelta)
      ? preview.kappaDelta
      : 0;
    const deltaText = kappaDelta > 0 ? `+${kappaDelta}` : `${kappaDelta}`;

    return `<strong>Connect preview (${risk.toUpperCase()}):</strong> κΔ ${deltaText}${sccNote} · ${preview.description}`;
  }

  function collectEdgeCandidatesAtPoint(plane, wx, wy) {
    const zoom = Math.max(0.2, Number(plane?.camera?.zoom) || 1);
    const step = 8 / zoom;

    const probes = [
      [0, 0],
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
      [step, step],
      [-step, step],
      [step, -step],
      [-step, -step],
    ];

    const seen = new Set();
    const out = [];

    for (const [dx, dy] of probes) {
      const edge = edgeAtPoint(plane, wx + dx, wy + dy);
      if (!edge || !edge.id || seen.has(edge.id)) continue;
      seen.add(edge.id);
      out.push(edge);
    }

    return out;
  }

  function isSameEdgePair(edgeA, edgeB) {
    if (!edgeA || !edgeB) return false;
    return (
      (edgeA.a === edgeB.a && edgeA.b === edgeB.b) ||
      (edgeA.a === edgeB.b && edgeA.b === edgeB.a)
    );
  }

  function edgePairCandidates(plane, edge) {
    if (!plane || !edge) return [];
    return (plane.edges || []).filter((candidate) =>
      isSameEdgePair(candidate, edge),
    );
  }

  // Constants with safe defaults
  const NODE_MIN_WIDTH = Number.isFinite(ctx.NODE_MIN_WIDTH)
    ? ctx.NODE_MIN_WIDTH
    : 190;
  const NODE_MAX_WIDTH = Number.isFinite(ctx.NODE_MAX_WIDTH)
    ? ctx.NODE_MAX_WIDTH
    : 540;
  const NODE_MIN_HEIGHT = Number.isFinite(ctx.NODE_MIN_HEIGHT)
    ? ctx.NODE_MIN_HEIGHT
    : 88;
  const NODE_MAX_HEIGHT = Number.isFinite(ctx.NODE_MAX_HEIGHT)
    ? ctx.NODE_MAX_HEIGHT
    : 420;
  const NODE_BODY_TOP_PAD = Number.isFinite(ctx.NODE_BODY_TOP_PAD)
    ? ctx.NODE_BODY_TOP_PAD
    : 10;
  const NODE_BODY_BOTTOM_PAD = Number.isFinite(ctx.NODE_BODY_BOTTOM_PAD)
    ? ctx.NODE_BODY_BOTTOM_PAD
    : 12;

  // Mutable local runtime
  let pointerId = null;
  let composerDrag = null;

  const unsubs = [];
  const on = (el, evt, fn, opts) => {
    if (!el) return;
    el.addEventListener(evt, fn, opts);
    unsubs.push(() => el.removeEventListener(evt, fn, opts));
  };

  function clearEdgeSelectionOptions() {
    const group = menu.querySelector("#edgeSelectionGroup");
    if (!group) return;
    group.innerHTML = '<div class="edge-selection-title">Select edge</div>';
  }

  function closeContextMenu() {
    menu.style.display = "none";
    state.ui.contextNodeId = null;
    state.ui.contextEdgeId = null;
    state.ui.contextMenuX = null;
    state.ui.contextMenuY = null;
    clearEdgeSelectionOptions();
  }

  function clearConnectFlowState() {
    state.ui.connectSourceNodeId = null;
    state.ui.connectPreview = null;
    state.ui.connectConfirmTargetId = null;
    state.ui.connectConfirmAt = 0;
  }

  function setMenuScope(scope) {
    const nodeActions = [
      "fork",
      "merge",
      "connect",
      "pin",
      "stargate",
      "bend",
      "unbend",
      "delete",
    ];

    const edgeActions = ["edge-kind-cycle", "edge-reverse", "edge-delete"];
    const edgeSelectionGroup = menu.querySelector("#edgeSelectionGroup");

    for (const action of nodeActions) {
      const btn = menu.querySelector(`[data-action="${action}"]`);
      if (btn) btn.style.display = scope === "node" ? "" : "none";
    }

    for (const action of edgeActions) {
      const btn = menu.querySelector(`[data-action="${action}"]`);
      if (btn) btn.style.display = scope === "edge" ? "" : "none";
    }

    if (edgeSelectionGroup) {
      edgeSelectionGroup.style.display = scope === "edge-select" ? "" : "none";
    }
  }

  function edgeSelectionLabel(plane, edge, idx) {
    const aNode = findNode(plane, edge.a);
    const bNode = findNode(plane, edge.b);
    const aName = trimText(aNode?.text || edge.a || "?", 16);
    const bName = trimText(bNode?.text || edge.b || "?", 16);
    const kind = edge?.props?.kind || "context";
    const label = String(edge?.props?.label || "").trim();
    const labelPart = label ? ` · ${trimText(label, 18)}` : "";
    return `${idx + 1}. ${aName} → ${bName} · ${kind}${labelPart}`;
  }

  function openContextMenuForEdgeSelection(x, y, plane, edges) {
    if (!isEditMode()) return;

    state.ui.contextNodeId = null;
    state.ui.contextEdgeId = null;
    state.ui.contextMenuX = x;
    state.ui.contextMenuY = y;

    const group = menu.querySelector("#edgeSelectionGroup");
    clearEdgeSelectionOptions();

    if (group) {
      edges.forEach((edge, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-action", "edge-select");
        btn.setAttribute("data-edge-id", edge.id);
        btn.textContent = edgeSelectionLabel(plane, edge, idx);
        group.appendChild(btn);
      });
    }

    setMenuScope("edge-select");
    menu.style.display = "block";
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
  }

  function openContextMenuForNode(x, y, nodeId) {
    if (!isEditMode()) return;

    state.ui.contextNodeId = nodeId;
    state.ui.contextEdgeId = null;
    state.ui.contextMenuX = x;
    state.ui.contextMenuY = y;

    const plane = activePlane();
    const node = findNode(plane, nodeId);
    if (!node) return;

    const pinBtn = menu.querySelector('[data-action="pin"]');
    const sgBtn = menu.querySelector('[data-action="stargate"]');
    const bendBtn = menu.querySelector('[data-action="bend"]');
    const unbendBtn = menu.querySelector('[data-action="unbend"]');

    if (pinBtn) pinBtn.textContent = node.pinned ? "Unpin node" : "Pin node";
    if (sgBtn) {
      sgBtn.textContent =
        node.type === "stargate" ? "Convert to Normal" : "Convert to Stargate";
    }

    if (bendBtn) bendBtn.textContent = "Bend (increase κ)";
    if (unbendBtn) unbendBtn.textContent = "Unbend (reduce κ)";

    setMenuScope("node");
    menu.style.display = "block";
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
  }

  function openContextMenuForEdge(x, y, edgeId) {
    if (!isEditMode()) return;

    state.ui.contextNodeId = null;
    state.ui.contextEdgeId = edgeId;
    state.ui.contextMenuX = x;
    state.ui.contextMenuY = y;

    setMenuScope("edge");
    menu.style.display = "block";
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
  }

  function spawnPromptFlow(text) {
    const clean = String(text || "").trim();
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

  function updateComposerTarget() {
    if (!composerTargetEl) return;
    const node = currentTargetNode();
    composerTargetEl.textContent = `target: ${node ? trimText(node.text, 64) : "none"}`;
  }

  // Composer submit
  on(composerForm, "submit", (e) => {
    e.preventDefault();
    if (!isEditMode()) return;
    spawnPromptFlow(promptInput.value);
  });

  // Context menu actions
  on(menu, "click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const plane = activePlane();

    if (action === "edge-select") {
      const edgeId = btn.getAttribute("data-edge-id");
      if (!edgeId) return;
      setSelectedEdge(edgeId);
      const mx = Number(state.ui.contextMenuX) || e.clientX || 0;
      const my = Number(state.ui.contextMenuY) || e.clientY || 0;
      openContextMenuForEdge(mx, my, edgeId);
      return;
    }

    const node = findNode(plane, state.ui.contextNodeId);
    const edge =
      plane?.edges?.find((item) => item.id === state.ui.contextEdgeId) || null;

    closeContextMenu();

    if (action === "edge-delete") {
      if (!edge) return;
      const before = plane.edges.length;
      plane.edges = plane.edges.filter((item) => item.id !== edge.id);
      if (plane.edges.length !== before) {
        if (state.ui.selectedEdgeId === edge.id) {
          state.ui.selectedEdgeId = null;
          syncEdgeInspector();
        }
        resetHint("<strong>Edge deleted.</strong>");
        saveSoon();
      }
      return;
    }

    if (action === "edge-kind-cycle") {
      if (!edge) return;
      const current = edge?.props?.kind || "context";
      const idx = EDGE_KIND_ORDER.indexOf(current);
      const nextKind =
        EDGE_KIND_ORDER[
          (idx + 1 + EDGE_KIND_ORDER.length) % EDGE_KIND_ORDER.length
        ];

      edge.props = {
        ...(edge.props || {}),
        kind: nextKind,
      };

      setSelectedEdge(edge.id);
      resetHint(`<strong>Edge kind:</strong> ${nextKind}`);
      saveSoon();
      return;
    }

    if (action === "edge-reverse") {
      if (!edge) return;
      const oldA = edge.a;
      const oldB = edge.b;
      edge.a = oldB;
      edge.b = oldA;
      setSelectedEdge(edge.id);
      resetHint("<strong>Edge direction reversed.</strong>");
      saveSoon();
      return;
    }

    if (!node) return;

    if (action === "bend") {
      clearConnectFlowState();
      if (bendNodeTopology) {
        bendNodeTopology(node.id);
      } else {
        resetHint(
          "<strong>BEND unavailable:</strong> topology hook not configured.",
        );
      }
      saveSoon();
      return;
    }

    if (action === "unbend") {
      clearConnectFlowState();
      if (unbendNodeTopology) {
        unbendNodeTopology(node.id);
      } else {
        resetHint(
          "<strong>UNBEND unavailable:</strong> topology hook not configured.",
        );
      }
      saveSoon();
      return;
    }

    if (action === "fork") {
      clearConnectFlowState();
      const clone = addNode(plane, {
        text: `${trimText(node.text, 100)} (fork)`,
        x: node.x + rand(-110, 110),
        y: node.y + rand(-90, 90),
        type: node.type,
      });
      addEdge(plane, node, clone);
      setSelected(clone.id);
      saveSoon();
      return;
    }

    if (action === "merge") {
      clearConnectFlowState();
      state.ui.mergeSourceNodeId = node.id;
      resetHint(
        `<strong>Merge mode:</strong> click a second node to merge with <em>${trimText(node.text, 44)}</em>.`,
      );
      return;
    }

    if (action === "connect") {
      state.ui.connectSourceNodeId = node.id;
      state.ui.mergeSourceNodeId = null;
      state.ui.connectPreview = null;
      state.ui.connectConfirmTargetId = null;
      state.ui.connectConfirmAt = 0;
      setSelected(node.id);
      resetHint(
        "<strong>Connect mode:</strong> Click a target node to preview risk, then click again to confirm if risk is elevated.",
      );
      return;
    }

    if (action === "pin") {
      clearConnectFlowState();
      node.pinned = !node.pinned;
      if (node.pinned) {
        node.vx = 0;
        node.vy = 0;
      }
      saveSoon();
      return;
    }

    if (action === "stargate") {
      clearConnectFlowState();
      node.type = node.type === "stargate" ? "normal" : "stargate";
      if (node.type === "stargate" && node.text && !/^⊛/.test(node.text)) {
        node.text = `⊛ ${node.text}`;
      }
      saveSoon();
      return;
    }

    if (action === "delete") {
      clearConnectFlowState();
      if (plane.nodes.length <= 1) return;
      removeNode(plane, node.id);
      saveSoon();
    }
  });

  // Click-away close menu
  on(document, "click", (e) => {
    if (!menu.contains(e.target)) closeContextMenu();
  });

  // Right click menu
  on(canvas, "contextmenu", (e) => {
    e.preventDefault();

    const plane = activePlane();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const w = screenToWorld(sx, sy, plane.camera, rect.width, rect.height);
    const n = nodeAtPoint(plane, w.x, w.y);

    if (n) {
      setSelected(n.id);
      updateComposerTarget();
      openContextMenuForNode(e.clientX + 4, e.clientY + 4, n.id);
      return;
    }

    const hitEdge = edgeAtPoint(plane, w.x, w.y);
    if (hitEdge) {
      const pairEdges = edgePairCandidates(plane, hitEdge);

      if (pairEdges.length > 1) {
        openContextMenuForEdgeSelection(
          e.clientX + 4,
          e.clientY + 4,
          plane,
          pairEdges,
        );
        resetHint(
          `<strong>Select edge:</strong> ${pairEdges.length} edges between the same two nodes.`,
        );
      } else {
        setSelectedEdge(hitEdge.id);
        openContextMenuForEdge(e.clientX + 4, e.clientY + 4, hitEdge.id);
      }
      return;
    }

    closeContextMenu();
  });

  // Pointer down
  on(canvas, "pointerdown", (e) => {
    closeContextMenu();
    canvas.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;

    const plane = activePlane();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, plane.camera, rect.width, rect.height);

    const n = nodeAtPoint(plane, w.x, w.y);
    let hitEdge = null;

    if (!n) {
      const candidates = collectEdgeCandidatesAtPoint(plane, w.x, w.y);

      if (candidates.length > 0) {
        const cycleKey = candidates
          .map((edge) => edge.id)
          .sort()
          .join("|");

        const ts = now();
        const sameCycle =
          state.ui.edgeCycleKey === cycleKey &&
          Number.isFinite(state.ui.edgeCycleAt) &&
          ts - state.ui.edgeCycleAt <= EDGE_CYCLE_WINDOW_MS;

        const prevIndex = Number.isFinite(state.ui.edgeCycleIndex)
          ? state.ui.edgeCycleIndex
          : -1;

        const nextIndex = sameCycle ? (prevIndex + 1) % candidates.length : 0;

        hitEdge = candidates[nextIndex] || null;

        state.ui.edgeCycleKey = cycleKey;
        state.ui.edgeCycleIndex = nextIndex;
        state.ui.edgeCycleAt = ts;
      } else {
        hitEdge = edgeAtPoint(plane, w.x, w.y);
        state.ui.edgeCycleKey = null;
        state.ui.edgeCycleIndex = 0;
        state.ui.edgeCycleAt = 0;
      }
    } else {
      state.ui.edgeCycleKey = null;
      state.ui.edgeCycleIndex = 0;
      state.ui.edgeCycleAt = 0;
    }

    state.ui.pointerDownAt = {
      x: e.clientX,
      y: e.clientY,
      t: now(),
      nodeId: n?.id || null,
      edgeId: hitEdge?.id || null,
    };
    state.ui.pointerMoved = false;

    if (
      n &&
      isEditMode() &&
      isPointOnNodeResizeHandle(n, w.x, w.y, plane.camera.zoom)
    ) {
      setSelected(n.id);
      updateComposerTarget();
      state.ui.resizeNodeId = n.id;
      state.ui.dragNodeId = null;
      state.ui.panMode = false;
      return;
    }

    if (n) {
      setSelected(n.id);
      updateComposerTarget();
      state.ui.resizeNodeId = null;
      state.ui.dragNodeId = n.id;
      state.ui.panMode = false;
      state.ui.dragOffsetX = w.x - n.x;
      state.ui.dragOffsetY = w.y - n.y;
    } else if (hitEdge && isEditMode()) {
      state.ui.resizeNodeId = null;
      state.ui.dragNodeId = null;
      state.ui.panMode = false;
      setSelectedEdge(hitEdge.id);
    } else {
      state.ui.resizeNodeId = null;
      state.ui.panMode = true;
      state.ui.dragNodeId = null;
      state.ui.selectedEdgeId = null;
      syncEdgeInspector();
      canvas.classList.add("dragging");
    }
  });

  // Pointer move
  on(canvas, "pointermove", (e) => {
    const plane = activePlane();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, plane.camera, rect.width, rect.height);

    if (pointerId == null) {
      if (state.ui.connectSourceNodeId && previewConnectImpact) {
        const sourceId = state.ui.connectSourceNodeId;
        const targetNode = nodeAtPoint(plane, w.x, w.y);

        if (targetNode && targetNode.id !== sourceId) {
          if (
            state.ui.connectConfirmTargetId &&
            state.ui.connectConfirmTargetId !== targetNode.id
          ) {
            state.ui.connectConfirmTargetId = null;
            state.ui.connectConfirmAt = 0;
          }

          const preview = previewConnectImpact(sourceId, targetNode.id);
          state.ui.connectPreview = {
            sourceId,
            targetId: targetNode.id,
            ...preview,
          };
          resetHint(connectPreviewHint(preview));
        } else {
          state.ui.connectPreview = null;
          state.ui.connectConfirmTargetId = null;
          state.ui.connectConfirmAt = 0;
        }
      }
      return;
    }

    if (state.ui.pointerDownAt) {
      const md = dist(
        e.clientX,
        e.clientY,
        state.ui.pointerDownAt.x,
        state.ui.pointerDownAt.y,
      );
      if (md > 4) state.ui.pointerMoved = true;
    }

    if (state.ui.resizeNodeId) {
      const n = findNode(plane, state.ui.resizeNodeId);
      if (!n) return;
      n.width = clamp((w.x - n.x) * 2, NODE_MIN_WIDTH, NODE_MAX_WIDTH);
      n.height = clamp((w.y - n.y) * 2, NODE_MIN_HEIGHT, NODE_MAX_HEIGHT);
      state.ui.pointerMoved = true;
      return;
    }

    if (state.ui.dragNodeId) {
      const n = findNode(plane, state.ui.dragNodeId);
      if (!n) return;
      n.x = w.x - state.ui.dragOffsetX;
      n.y = w.y - state.ui.dragOffsetY;
      n.vx *= 0.7;
      n.vy *= 0.7;
      return;
    }

    if (state.ui.panMode && state.ui.pointerDownAt) {
      const dx = (e.movementX || 0) / plane.camera.zoom;
      const dy = (e.movementY || 0) / plane.camera.zoom;
      plane.camera.x -= dx;
      plane.camera.y -= dy;
    }
  });

  // Pointer up
  on(canvas, "pointerup", (e) => {
    if (pointerId !== e.pointerId) return;

    canvas.releasePointerCapture(e.pointerId);
    pointerId = null;
    canvas.classList.remove("dragging");

    const plane = activePlane();
    const clickWasNode = state.ui.pointerDownAt?.nodeId;
    const wasMoved = state.ui.pointerMoved;
    const draggedNodeId = state.ui.dragNodeId;
    const wasResizing = !!state.ui.resizeNodeId;

    state.ui.panMode = false;
    state.ui.dragNodeId = null;
    state.ui.resizeNodeId = null;

    if (wasResizing) {
      saveSoon();
      state.ui.pointerDownAt = null;
      return;
    }

    if (!wasMoved && clickWasNode) {
      const node = findNode(plane, clickWasNode);
      if (node) {
        if (
          state.ui.mergeSourceNodeId &&
          state.ui.mergeSourceNodeId !== node.id
        ) {
          const source = findNode(plane, state.ui.mergeSourceNodeId);
          if (source) mergeNodes(plane, source, node);
          state.ui.mergeSourceNodeId = null;
          clearConnectFlowState();
          resetHint(DEFAULT_HINT_TEXT);
          saveSoon();
        } else if (
          state.ui.connectSourceNodeId &&
          state.ui.connectSourceNodeId !== node.id
        ) {
          const source = findNode(plane, state.ui.connectSourceNodeId);
          if (source) {
            let preview = state.ui.connectPreview;

            if (previewConnectImpact) {
              preview = previewConnectImpact(source.id, node.id);
              state.ui.connectPreview = {
                sourceId: source.id,
                targetId: node.id,
                ...preview,
              };
            }

            const risk = riskLevelFromPreview(preview);
            const requiresConfirm = risk !== "low";

            if (requiresConfirm) {
              const nowMs = Date.now();
              const sameTarget = state.ui.connectConfirmTargetId === node.id;
              const withinWindow =
                Number.isFinite(state.ui.connectConfirmAt) &&
                nowMs - state.ui.connectConfirmAt <= CONNECT_CONFIRM_WINDOW_MS;

              if (!(sameTarget && withinWindow)) {
                state.ui.connectConfirmTargetId = node.id;
                state.ui.connectConfirmAt = nowMs;
                resetHint(
                  `<strong>Confirm connect (${risk.toUpperCase()} risk):</strong> click this target again to proceed.`,
                );
                state.ui.pointerDownAt = null;
                return;
              }
            }

            const edge = addEdge(plane, source, node, { kind: "causal" });
            setSelected(source.id);
            setSelectedEdge(edge.id);
          }

          state.ui.connectSourceNodeId = null;
          state.ui.mergeSourceNodeId = null;
          state.ui.connectPreview = null;
          state.ui.connectConfirmTargetId = null;
          state.ui.connectConfirmAt = 0;
          resetHint(DEFAULT_HINT_TEXT);
          saveSoon();
        } else if (
          (node.type === "stargate" && clickWasNode === draggedNodeId) ||
          node.type === "stargate"
        ) {
          const targetPlane = ensurePortalPlane(node, plane);
          triggerWarp(() => {
            state.activePlaneId = targetPlane.id;
            const hub = targetPlane.nodes[0];
            setSelected(hub?.id || null);
            targetPlane.camera.zoom = 1;
            targetPlane.camera.x = 0;
            targetPlane.camera.y = 0;
            updateComposerTarget();
            saveSoon();
          });
        }
      }
    }

    state.ui.pointerDownAt = null;
  });

  // Wheel zoom + node text scrolling
  on(
    canvas,
    "wheel",
    (e) => {
      e.preventDefault();

      const plane = activePlane();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const world = screenToWorld(
        sx,
        sy,
        plane.camera,
        rect.width,
        rect.height,
      );
      const overNode = nodeAtPoint(plane, world.x, world.y);

      if (overNode) {
        const size = nodeCardSize(overNode);
        const w = size.width * plane.camera.zoom;
        const h = size.height * plane.camera.zoom;
        const headerH = clamp(h * 0.2, 24, 70);
        const pad = clamp(h * 0.09, 10, 28);
        const bodyW = Math.max(28, w - pad * 2);
        const bodyH = Math.max(
          18,
          h - headerH - NODE_BODY_TOP_PAD - NODE_BODY_BOTTOM_PAD,
        );
        const bodySize = clamp(h * 0.072, 11, 20);
        const lineHeight = Math.round(bodySize * 1.28);

        canvasCtx.save();
        canvasCtx.font = `${bodySize}px ui-monospace, monospace`;
        const lines = wrapMarkdownLines(overNode.text, bodyW, bodySize);
        canvasCtx.restore();

        const maxScroll = Math.max(
          0,
          lines.reduce(
            (acc, ln) =>
              acc + (ln.kind === "h" ? lineHeight * 1.18 : lineHeight),
            0,
          ) - bodyH,
        );

        if (maxScroll > 0) {
          overNode.scrollY = clamp(
            (Number(overNode.scrollY) || 0) + e.deltaY,
            0,
            maxScroll,
          );
          saveSoon();
          return;
        }
      }

      const before = screenToWorld(
        sx,
        sy,
        plane.camera,
        rect.width,
        rect.height,
      );
      const zoomFactor = Math.exp(-e.deltaY * 0.0014);
      plane.camera.zoom = clamp(plane.camera.zoom * zoomFactor, 0.32, 2.8);

      const after = screenToWorld(
        sx,
        sy,
        plane.camera,
        rect.width,
        rect.height,
      );
      plane.camera.x += before.x - after.x;
      plane.camera.y += before.y - after.y;
    },
    { passive: false },
  );

  // Global keyboard shortcuts
  on(document, "keydown", (e) => {
    if (e.key === "Escape") {
      state.ui.mergeSourceNodeId = null;
      state.ui.connectSourceNodeId = null;
      state.ui.connectPreview = null;
      state.ui.connectConfirmTargetId = null;
      state.ui.connectConfirmAt = 0;
      closeContextMenu();
      resetHint(DEFAULT_HINT_TEXT);

      if (nodeMdOverlay && !nodeMdOverlay.classList.contains("hidden")) {
        state.ui.nodeMdOverlayOpen = false;
        nodeMdOverlay.classList.add("hidden");
        if (nodeMdBackdrop) nodeMdBackdrop.classList.add("hidden");
        saveSoon();
      }
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (!isEditMode()) return;
      const plane = activePlane();

      if (state.ui.selectedEdgeId) {
        const before = plane.edges.length;
        plane.edges = plane.edges.filter(
          (edge) => edge.id !== state.ui.selectedEdgeId,
        );
        if (plane.edges.length !== before) {
          state.ui.selectedEdgeId = null;
          syncEdgeInspector();
          saveSoon();
        }
        return;
      }

      const selected = findNode(plane, state.ui.selectedNodeId);
      if (!selected) return;
      if (plane.nodes.length > 1) {
        removeNode(plane, selected.id);
        saveSoon();
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveState();
    }
  });

  // Composer drag
  on(composerDragHandle, "pointerdown", (e) => {
    const rect = composer.getBoundingClientRect();

    composer.classList.add("free");
    composer.style.left = `${rect.left}px`;
    composer.style.top = `${rect.top}px`;
    composer.style.bottom = "auto";
    composer.style.transform = "none";

    composerDrag = {
      id: e.pointerId,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };

    composerDragHandle.setPointerCapture(e.pointerId);
  });

  on(composerDragHandle, "pointermove", (e) => {
    if (!composerDrag || composerDrag.id !== e.pointerId) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const rect = composer.getBoundingClientRect();

    const nx = clamp(e.clientX - composerDrag.dx, 8, W - rect.width - 8);
    const ny = clamp(e.clientY - composerDrag.dy, 8, H - rect.height - 8);

    composer.style.left = `${nx}px`;
    composer.style.top = `${ny}px`;
  });

  on(composerDragHandle, "pointerup", (e) => {
    if (!composerDrag || composerDrag.id !== e.pointerId) return;

    composerDragHandle.releasePointerCapture(e.pointerId);
    const rect = composer.getBoundingClientRect();

    state.ui.composerPos = { free: true, x: rect.left, y: rect.top };
    composerDrag = null;
    saveSoon();
  });

  on(composerDragHandle, "dblclick", () => {
    state.ui.composerPos = { free: false, x: 0, y: 0 };
    if (typeof ctx.applyComposerPosition === "function") {
      ctx.applyComposerPosition();
    }
    saveSoon();
  });

  // Optional lifecycle callbacks
  if (typeof ctx.onAfterSetup === "function") {
    ctx.onAfterSetup();
  }

  return () => {
    for (let i = unsubs.length - 1; i >= 0; i--) {
      try {
        unsubs[i]();
      } catch {
        // ignore teardown errors
      }
    }
    unsubs.length = 0;
    pointerId = null;
    composerDrag = null;

    if (typeof ctx.onCleanup === "function") {
      (ctx.onCleanup || noop)();
    }
  };
}
