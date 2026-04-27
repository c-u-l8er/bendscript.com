function req(name, value) {
  if (value == null) {
    throw new Error(`inspectors: missing required dependency "${name}"`);
  }
  return value;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToInspectorHtml(md) {
  const lines = String(md || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const out = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const inline = (raw) => {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
    s = s.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
    return s;
  };

  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      closeLists();
      if (!inCode) {
        out.push("<pre><code>");
        inCode = true;
      } else {
        out.push("</code></pre>");
        inCode = false;
      }
      continue;
    }

    if (inCode) {
      out.push(`${escapeHtml(raw)}\n`);
      continue;
    }

    const h = raw.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }

    const ul = raw.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (!inUl) {
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (!inOl) {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const quote = raw.match(/^\s*>\s?(.*)$/);
    if (quote) {
      closeLists();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    if (!raw.trim()) {
      closeLists();
      out.push("<p></p>");
      continue;
    }

    closeLists();
    out.push(`<p>${inline(raw)}</p>`);
  }

  closeLists();
  if (inCode) out.push("</code></pre>");
  return out.join("");
}

export function createInspectorController(rawCtx = {}) {
  const state = req("state", rawCtx.state);
  const activePlane = req("activePlane", rawCtx.activePlane);
  const findNode = req("findNode", rawCtx.findNode);
  const findEdge = req("findEdge", rawCtx.findEdge);
  const normalizeEdgeProps = req("normalizeEdgeProps", rawCtx.normalizeEdgeProps);
  const trimText = req("trimText", rawCtx.trimText);
  const saveSoon = req("saveSoon", rawCtx.saveSoon);

  const refs = req("refs", rawCtx.refs);
  const edgePropLabel = req("edgePropLabel", refs.edgePropLabel);
  const edgePropKind = req("edgePropKind", refs.edgePropKind);
  const edgePropStrength = req("edgePropStrength", refs.edgePropStrength);
  const edgeInspectorEmpty = req("edgeInspectorEmpty", refs.edgeInspectorEmpty);
  const nodeText = req("nodeText", refs.nodeText);
  const nodeType = req("nodeType", refs.nodeType);
  const nodePinned = req("nodePinned", refs.nodePinned);
  const nodeInspectorEmpty = req("nodeInspectorEmpty", refs.nodeInspectorEmpty);
  const nodeModeToggle = req("nodeModeToggle", refs.nodeModeToggle);
  const composerTargetEl = refs.composerTargetEl || null;

  const nodeMdBackdrop = refs.nodeMdBackdrop || null;
  const nodeMdOverlay = refs.nodeMdOverlay || null;
  const nodeMdTitle = refs.nodeMdTitle || null;
  const nodeMdTabs = refs.nodeMdTabs || null;
  const nodeMdClose = refs.nodeMdClose || null;
  const nodeMdOpenBtn = refs.nodeMdOpenBtn || null;
  const nodeMdEditor = refs.nodeMdEditor || null;
  const nodeMdPreview = refs.nodeMdPreview || null;

  let nodeMdOverlayClosedByUser = !state.ui?.nodeMdOverlayOpen;
  let nodeMdOverlayView = state.ui?.nodeMdOverlayView === "preview" ? "preview" : "write";
  let nodeMdOverlayBoundNodeId = null;
  let nodeMdSyncing = false;

  const listeners = [];
  const on = (el, event, handler, options) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    listeners.push(() => el.removeEventListener(event, handler, options));
  };

  const isEditMode = () => state.ui.editMode === "edit";

  function currentTargetNode() {
    const plane = activePlane();
    let node = findNode(plane, state.ui.selectedNodeId);
    if (!node) node = plane?.nodes?.[0] || null;
    return node;
  }

  function updateComposerTargetText() {
    if (!composerTargetEl) return;
    const node = currentTargetNode();
    composerTargetEl.textContent = `target: ${node ? trimText(node.text, 64) : "none"}`;
  }

  function setSelected(nodeId) {
    state.ui.selectedNodeId = nodeId || null;
    state.ui.selectedEdgeId = null;

    if (!nodeId) {
      state.ui.nodeMdOverlayOpen = false;
      nodeMdOverlayClosedByUser = true;
      nodeMdOverlayBoundNodeId = null;
    } else if (state.ui.nodeMdOverlayOpen) {
      nodeMdOverlayClosedByUser = false;
    }

    updateComposerTargetText();
    syncEdgeInspector();
    syncNodeInspector();
  }

  function setSelectedEdge(edgeId) {
    if (!isEditMode() && edgeId) return;
    state.ui.selectedEdgeId = edgeId || null;
    syncEdgeInspector();
  }

  function syncEdgeInspector() {
    const plane = activePlane();
    const edge = findEdge(plane, state.ui.selectedEdgeId);

    if (!edge) {
      edgeInspectorEmpty.textContent = "No edge selected yet.";
      edgePropLabel.value = "";
      edgePropKind.value = "context";
      edgePropStrength.value = "1";
      edgePropLabel.disabled = true;
      edgePropKind.disabled = true;
      edgePropStrength.disabled = true;
      return;
    }

    edge.props = normalizeEdgeProps(edge.props);
    edgeInspectorEmpty.textContent = `Editing ${trimText(findNode(plane, edge.a)?.text || edge.a, 32)} → ${trimText(findNode(plane, edge.b)?.text || edge.b, 32)}`;

    edgePropLabel.value = edge.props.label || "";
    edgePropKind.value = edge.props.kind || "context";
    edgePropStrength.value = String(edge.props.strength || 1);

    const allow = isEditMode();
    edgePropLabel.disabled = !allow;
    edgePropKind.disabled = !allow;
    edgePropStrength.disabled = !allow;
  }

  function applyEdgeInspectorToSelection() {
    if (!isEditMode()) return;
    const plane = activePlane();
    const edge = findEdge(plane, state.ui.selectedEdgeId);
    if (!edge) return;

    edge.props = normalizeEdgeProps({
      label: edgePropLabel.value,
      kind: edgePropKind.value,
      strength: edgePropStrength.value,
    });

    saveSoon();
  }

  function setNodeMdView(view) {
    nodeMdOverlayView = view === "preview" ? "preview" : "write";
    state.ui.nodeMdOverlayView = nodeMdOverlayView;

    const previewMode = nodeMdOverlayView === "preview";
    const writeBtn = nodeMdTabs?.querySelector('[data-view="write"]');
    const previewBtn = nodeMdTabs?.querySelector('[data-view="preview"]');

    if (writeBtn) writeBtn.classList.toggle("active", !previewMode);
    if (previewBtn) previewBtn.classList.toggle("active", previewMode);

    if (nodeMdEditor) nodeMdEditor.classList.toggle("hidden", previewMode);
    if (nodeMdPreview) nodeMdPreview.classList.toggle("hidden", !previewMode);

    if (previewMode) updateNodeMarkdownPreview();
  }

  function updateNodeMarkdownPreview() {
    if (!nodeMdPreview) return;
    const source = nodeMdEditor?.value ?? nodeText?.value ?? "";

    if (typeof window !== "undefined" && window.marked && window.DOMPurify) {
      const unsafe = window.marked.parse(source, { gfm: true, breaks: true });
      nodeMdPreview.innerHTML = window.DOMPurify.sanitize(unsafe, {
        USE_PROFILES: { html: true },
      });
    } else {
      nodeMdPreview.innerHTML = markdownToInspectorHtml(source);
    }
  }

  function syncNodeMdOverlayForSelection() {
    if (!nodeMdOverlay) return;

    const edit = isEditMode();
    const node = findNode(activePlane(), state.ui.selectedNodeId);
    const shouldShow =
      edit &&
      !!node &&
      !nodeMdOverlayClosedByUser &&
      !!state.ui.nodeMdOverlayOpen;

    if (!shouldShow) {
      nodeMdOverlay.classList.add("hidden");
      if (nodeMdBackdrop) nodeMdBackdrop.classList.add("hidden");
      return;
    }

    if (nodeMdTitle) {
      nodeMdTitle.textContent = `NODE MARKDOWN · ${trimText(node.text || "Node", 38)}`;
    }

    if (nodeMdOverlayBoundNodeId !== node.id) {
      nodeMdOverlayBoundNodeId = node.id;
      nodeMdSyncing = true;
      if (nodeMdEditor) nodeMdEditor.value = node.text || "";
      updateNodeMarkdownPreview();
      nodeMdSyncing = false;
    }

    nodeMdOverlay.classList.remove("hidden");
    if (nodeMdBackdrop) nodeMdBackdrop.classList.remove("hidden");
  }

  function syncModeUI() {
    const edit = isEditMode();
    nodeModeToggle.textContent = `mode: ${edit ? "EDIT" : "PREVIEW"}`;
    nodeModeToggle.style.borderColor = edit ? "#ff6d5a" : "#e0e4e8";
    nodeModeToggle.style.color = edit ? "#ff6d5a" : "#666666";

    const hasNode = !!findNode(activePlane(), state.ui.selectedNodeId);
    nodeText.disabled = !edit || !hasNode;
    nodeType.disabled = !edit || !hasNode;
    nodePinned.disabled = !edit || !hasNode;
    edgePropLabel.disabled = !edit || !state.ui.selectedEdgeId;
    edgePropKind.disabled = !edit || !state.ui.selectedEdgeId;
    edgePropStrength.disabled = !edit || !state.ui.selectedEdgeId;

    if (nodeMdEditor) nodeMdEditor.disabled = !edit || !hasNode;
    if (nodeMdOpenBtn) nodeMdOpenBtn.disabled = !edit || !hasNode;

    if (!edit && nodeMdOverlay) {
      nodeMdOverlay.classList.add("hidden");
      if (nodeMdBackdrop) nodeMdBackdrop.classList.add("hidden");
    }
  }

  function syncNodeInspector() {
    const plane = activePlane();
    const node = findNode(plane, state.ui.selectedNodeId);

    if (!node) {
      nodeInspectorEmpty.textContent = "No node selected yet.";
      nodeText.value = "";
      if (nodeMdEditor) nodeMdEditor.value = "";
      updateNodeMarkdownPreview();
      nodeType.value = "normal";
      nodePinned.value = "false";

      nodeMdOverlayBoundNodeId = null;
      nodeMdOverlayClosedByUser = true;
      nodeMdOverlayView = "write";
      state.ui.nodeMdOverlayOpen = false;
      state.ui.nodeMdOverlayView = "write";
      setNodeMdView("write");

      if (nodeMdOverlay) nodeMdOverlay.classList.add("hidden");
      if (nodeMdBackdrop) nodeMdBackdrop.classList.add("hidden");
      syncModeUI();
      return;
    }

    nodeInspectorEmpty.textContent = `Editing ${trimText(node.text, 56)}`;
    nodeText.value = node.text || "";

    if (!nodeMdSyncing && nodeMdEditor) {
      nodeMdSyncing = true;
      nodeMdEditor.value = node.text || "";
      nodeMdSyncing = false;
    }

    updateNodeMarkdownPreview();
    nodeType.value = node.type === "stargate" ? "stargate" : "normal";
    nodePinned.value = node.pinned ? "true" : "false";

    syncModeUI();
    syncNodeMdOverlayForSelection();
  }

  function applyNodeInspectorToSelection() {
    if (!isEditMode()) return;
    const node = findNode(activePlane(), state.ui.selectedNodeId);
    if (!node) return;

    node.text = String(nodeText.value || "").slice(0, 4000);
    node.type = nodeType.value === "stargate" ? "stargate" : "normal";
    node.pinned = nodePinned.value === "true";

    if (node.type === "stargate" && node.text && !/^⊛/.test(node.text)) {
      node.text = `⊛ ${node.text}`;
    }

    if (
      nodeMdEditor &&
      !nodeMdSyncing &&
      typeof document !== "undefined" &&
      document.activeElement !== nodeMdEditor &&
      nodeMdEditor.value !== node.text
    ) {
      nodeMdSyncing = true;
      nodeMdEditor.value = node.text;
      nodeMdSyncing = false;
    }

    updateNodeMarkdownPreview();
    updateComposerTargetText();
    saveSoon();
  }

  function bindEvents() {
    on(edgePropLabel, "input", applyEdgeInspectorToSelection);
    on(edgePropKind, "change", applyEdgeInspectorToSelection);
    on(edgePropStrength, "input", applyEdgeInspectorToSelection);

    on(nodeText, "input", applyNodeInspectorToSelection);
    on(nodeType, "change", applyNodeInspectorToSelection);
    on(nodePinned, "change", applyNodeInspectorToSelection);

    on(nodeModeToggle, "click", () => {
      state.ui.editMode = isEditMode() ? "preview" : "edit";
      syncModeUI();
      saveSoon();
    });

    if (nodeMdTabs) {
      on(nodeMdTabs, "click", (e) => {
        const btn = e.target.closest("button[data-view]");
        if (!btn) return;
        setNodeMdView(btn.getAttribute("data-view"));
        saveSoon();
      });
    }

    if (nodeMdClose) {
      on(nodeMdClose, "click", () => {
        nodeMdOverlayClosedByUser = true;
        state.ui.nodeMdOverlayOpen = false;
        nodeMdOverlay?.classList.add("hidden");
        nodeMdBackdrop?.classList.add("hidden");
        saveSoon();
      });
    }

    if (nodeMdOpenBtn) {
      on(nodeMdOpenBtn, "click", () => {
        if (!isEditMode()) return;
        const node = findNode(activePlane(), state.ui.selectedNodeId);
        if (!node) return;
        nodeMdOverlayClosedByUser = false;
        state.ui.nodeMdOverlayOpen = true;
        nodeMdOverlayBoundNodeId = null;
        syncNodeMdOverlayForSelection();
        saveSoon();
      });
    }

    if (nodeMdBackdrop) {
      on(nodeMdBackdrop, "click", () => {
        nodeMdOverlayClosedByUser = true;
        state.ui.nodeMdOverlayOpen = false;
        nodeMdOverlay?.classList.add("hidden");
        nodeMdBackdrop.classList.add("hidden");
        saveSoon();
      });
    }

    if (nodeMdEditor) {
      on(nodeMdEditor, "input", () => {
        if (!isEditMode() || nodeMdSyncing) return;
        nodeText.value = nodeMdEditor.value;
        applyNodeInspectorToSelection();
        updateNodeMarkdownPreview();
      });
      on(nodeMdEditor, "wheel", (e) => e.stopPropagation());
      on(nodeMdEditor, "pointerdown", (e) => e.stopPropagation());
    }

    if (nodeMdPreview) {
      on(nodeMdPreview, "wheel", (e) => e.stopPropagation());
      on(nodeMdPreview, "pointerdown", (e) => e.stopPropagation());
    }

    setNodeMdView(state.ui.nodeMdOverlayView || "write");
  }

  function cleanup() {
    for (let i = listeners.length - 1; i >= 0; i--) {
      try {
        listeners[i]();
      } catch {
        // ignore cleanup errors
      }
    }
    listeners.length = 0;
  }

  bindEvents();

  return {
    isEditMode,
    currentTargetNode,
    setSelected,
    setSelectedEdge,
    syncEdgeInspector,
    syncModeUI,
    syncNodeInspector,
    applyNodeInspectorToSelection,
    applyEdgeInspectorToSelection,
    setNodeMdView,
    updateNodeMarkdownPreview,
    syncNodeMdOverlayForSelection,
    cleanup,
  };
}
