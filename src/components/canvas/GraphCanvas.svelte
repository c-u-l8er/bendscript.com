<script>
    import { onMount, tick } from "svelte";
    import { initPrototypeRuntime } from "$lib/engine/prototypeRuntime";

    let canvas;
    let ctx;
    let runtime = null;
    let rafId = null;
    let loopRunning = false;

    const REQUIRED_DOM_IDS = [
        "graph",
        "statNodes",
        "statEdges",
        "statDepth",
        "statZoom",
        "statRouting",
        "statKappa",
        "statScc",
        "statIsland",
        "statRisk",
        "breadcrumbs",
        "hint",
        "nodeModeToggle",
        "composer",
        "composerDragHandle",
        "composerTarget",
        "promptInput",
        "composerForm",
        "contextMenu",
        "warp",
        "edgeInspector",
        "edgePropLabel",
        "edgePropKind",
        "edgePropStrength",
        "edgeInspectorEmpty",
        "nodeInspector",
        "nodeText",
        "nodeMdBackdrop",
        "nodeMdOverlay",
        "nodeMdTitle",
        "nodeMdTabs",
        "nodeMdClose",
        "nodeMdOpenBtn",
        "nodeMdEditor",
        "nodeMdPreview",
        "nodeType",
        "nodePinned",
        "nodeInspectorEmpty",
    ];

    function resize() {
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function hasRequiredDom() {
        return REQUIRED_DOM_IDS.every((id) => document.getElementById(id));
    }

    function nextFrame() {
        return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    async function waitForRequiredDom(maxFrames = 120) {
        for (let i = 0; i < maxFrames; i++) {
            if (hasRequiredDom()) return true;
            await nextFrame();
        }
        return hasRequiredDom();
    }

    function startLoop() {
        if (loopRunning || !runtime || typeof runtime.frame !== "function")
            return;

        loopRunning = true;

        const step = () => {
            if (!loopRunning) return;
            runtime.frame();
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

    onMount(() => {
        let disposed = false;

        const bootstrap = async () => {
            ctx = canvas?.getContext("2d") ?? null;
            resize();

            await tick();
            const ready = await waitForRequiredDom();

            if (disposed || !ready || typeof window === "undefined") return;

            if (!window.__BENDSCRIPT_RUNTIME_INSTANCE__) {
                window.__BENDSCRIPT_RUNTIME_INSTANCE__ = initPrototypeRuntime({
                    autoStartLoop: false,
                });
            }

            runtime = window.__BENDSCRIPT_RUNTIME_INSTANCE__;
            runtime?.stopLoop?.();
            startLoop();
        };

        bootstrap();

        return () => {
            disposed = true;
            stopLoop();
            runtime?.stopLoop?.();
        };
    });
</script>

<svelte:window on:resize={resize} />
<canvas bind:this={canvas} id="graph"></canvas>

<style>
    #graph {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        display: block;
        cursor: grab;
        z-index: 1;
        touch-action: none;
    }

    :global(#graph.dragging) {
        cursor: grabbing;
    }
</style>
