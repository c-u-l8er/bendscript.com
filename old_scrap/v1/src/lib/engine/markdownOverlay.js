function req(name, value) {
    if (value == null) {
        throw new Error(
            `markdownOverlay.createMarkdownOverlayController: missing required dependency "${name}"`,
        );
    }
    return value;
}

export function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function markdownToInspectorHtml(md) {
    const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
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

export function createMarkdownOverlayController(rawCtx = {}) {
    const ctx = rawCtx || {};

    const state = req("state", ctx.state);
    const isEditMode = req("isEditMode", ctx.isEditMode);
    const activePlane = req("activePlane", ctx.activePlane);
    const findNode = req("findNode", ctx.findNode);
    const trimText = req("trimText", ctx.trimText);

    const nodeMdOverlay = req("nodeMdOverlay", ctx.nodeMdOverlay);
    const nodeMdBackdrop = req("nodeMdBackdrop", ctx.nodeMdBackdrop);
    const nodeMdTitle = ctx.nodeMdTitle || null;
    const nodeMdTabs = ctx.nodeMdTabs || null;
    const nodeMdEditor = req("nodeMdEditor", ctx.nodeMdEditor);
    const nodeMdPreview = req("nodeMdPreview", ctx.nodeMdPreview);
    const nodeText = req("nodeText", ctx.nodeText);

    const onPersist = typeof ctx.onPersist === "function" ? ctx.onPersist : () => {};
    const onNodeTextApply =
        typeof ctx.onNodeTextApply === "function" ? ctx.onNodeTextApply : () => {};
    const getMarked = typeof ctx.getMarked === "function" ? ctx.getMarked : () => window?.marked;
    const getSanitizer =
        typeof ctx.getSanitizer === "function" ? ctx.getSanitizer : () => window?.DOMPurify;

    let closedByUser = !state.ui?.nodeMdOverlayOpen;
    let view = state.ui?.nodeMdOverlayView === "preview" ? "preview" : "write";
    let boundNodeId = null;
    let syncing = false;

    const unsubs = [];
    const on = (el, evt, fn, opts) => {
        if (!el) return;
        el.addEventListener(evt, fn, opts);
        unsubs.push(() => el.removeEventListener(evt, fn, opts));
    };

    function updateNodeMarkdownPreview() {
        const source = nodeMdEditor?.value ?? nodeText?.value ?? "";
        const marked = getMarked();
        const sanitizer = getSanitizer();

        if (marked && sanitizer) {
            const unsafe = marked.parse(source, { gfm: true, breaks: true });
            nodeMdPreview.innerHTML = sanitizer.sanitize(unsafe, {
                USE_PROFILES: { html: true },
            });
        } else {
            nodeMdPreview.innerHTML = markdownToInspectorHtml(source);
        }
    }

    function setNodeMdView(nextView) {
        view = nextView === "preview" ? "preview" : "write";
        state.ui.nodeMdOverlayView = view;

        const previewMode = view === "preview";
        const writeBtn = nodeMdTabs?.querySelector('[data-view="write"]');
        const previewBtn = nodeMdTabs?.querySelector('[data-view="preview"]');

        if (writeBtn) writeBtn.classList.toggle("active", !previewMode);
        if (previewBtn) previewBtn.classList.toggle("active", previewMode);

        nodeMdEditor.classList.toggle("hidden", previewMode);
        nodeMdPreview.classList.toggle("hidden", !previewMode);

        if (previewMode) updateNodeMarkdownPreview();
    }

    function hideOverlay() {
        nodeMdOverlay.classList.add("hidden");
        nodeMdBackdrop?.classList.add("hidden");
    }

    function showOverlay() {
        nodeMdOverlay.classList.remove("hidden");
        nodeMdBackdrop?.classList.remove("hidden");
    }

    function syncNodeMdOverlayForSelection() {
        const edit = isEditMode();
        const node = findNode(activePlane(), state.ui.selectedNodeId);
        const shouldShow =
            edit && !!node && !closedByUser && !!state.ui.nodeMdOverlayOpen;

        if (!shouldShow) {
            hideOverlay();
            return;
        }

        if (nodeMdTitle) {
            nodeMdTitle.textContent = `NODE MARKDOWN · ${trimText(node.text || "Node", 38)}`;
        }

        if (boundNodeId !== node.id) {
            boundNodeId = node.id;
            syncing = true;
            nodeMdEditor.value = node.text || "";
            updateNodeMarkdownPreview();
            syncing = false;
        }

        showOverlay();
    }

    function onSelectionChanged(nodeId) {
        if (!nodeId) {
            state.ui.nodeMdOverlayOpen = false;
            closedByUser = true;
            boundNodeId = null;
        } else if (state.ui.nodeMdOverlayOpen) {
            closedByUser = false;
        }
        syncNodeMdOverlayForSelection();
    }

    function openForCurrentNode() {
        if (!isEditMode()) return;
        const node = findNode(activePlane(), state.ui.selectedNodeId);
        if (!node) return;

        closedByUser = false;
        state.ui.nodeMdOverlayOpen = true;
        boundNodeId = null;
        syncNodeMdOverlayForSelection();
        onPersist();
    }

    function closeByUser() {
        closedByUser = true;
        state.ui.nodeMdOverlayOpen = false;
        hideOverlay();
        onPersist();
    }

    function isSyncing() {
        return syncing;
    }

    function bindEvents({ nodeMdClose, nodeMdOpenBtn } = {}) {
        if (nodeMdTabs) {
            on(nodeMdTabs, "click", (e) => {
                const btn = e.target.closest("button[data-view]");
                if (!btn) return;
                setNodeMdView(btn.getAttribute("data-view"));
                onPersist();
            });
        }

        if (nodeMdClose) on(nodeMdClose, "click", closeByUser);
        if (nodeMdOpenBtn) on(nodeMdOpenBtn, "click", openForCurrentNode);
        if (nodeMdBackdrop) on(nodeMdBackdrop, "click", closeByUser);

        on(nodeMdEditor, "input", () => {
            if (!isEditMode() || syncing) return;
            nodeText.value = nodeMdEditor.value;
            onNodeTextApply();
            updateNodeMarkdownPreview();
        });

        on(nodeMdEditor, "wheel", (e) => e.stopPropagation());
        on(nodeMdEditor, "pointerdown", (e) => e.stopPropagation());
        on(nodeMdPreview, "wheel", (e) => e.stopPropagation());
        on(nodeMdPreview, "pointerdown", (e) => e.stopPropagation());
    }

    function resetForNoNodeSelection() {
        boundNodeId = null;
        closedByUser = true;
        view = "write";
        state.ui.nodeMdOverlayOpen = false;
        state.ui.nodeMdOverlayView = "write";
        setNodeMdView("write");
        hideOverlay();
    }

    function cleanup() {
        for (let i = unsubs.length - 1; i >= 0; i--) {
            try {
                unsubs[i]();
            } catch {
                // no-op cleanup guard
            }
        }
        unsubs.length = 0;
    }

    // initial state sync
    setNodeMdView(state.ui.nodeMdOverlayView || "write");

    return {
        bindEvents,
        cleanup,
        isSyncing,
        onSelectionChanged,
        openForCurrentNode,
        closeByUser,
        resetForNoNodeSelection,
        setNodeMdView,
        updateNodeMarkdownPreview,
        syncNodeMdOverlayForSelection,
    };
}
