<script>
  import { onMount, tick } from "svelte";
  import { initPrototypeRuntime } from "$lib/engine/prototypeRuntime";
  import {
    callGraphSynthesis,
    materializeSynthesisForPlane,
  } from "$lib/ai/graphSynthesis";
  import { getSupabaseClient } from "$lib/supabase/client";
  import {
    createGraphRealtimeSession,
    applyRemoteGraphPatch,
    realtimePatch,
  } from "$lib/supabase/realtime";

  let {
    initialState = null,
    readOnly = false,
    aiSynthesis = null,
    realtime = null,
    runtimeKey = null,
  } = $props();

  let canvas;
  let ctx;
  let runtime = null;
  let rafId = null;
  let loopRunning = false;
  let realtimeSession = null;

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
    if (loopRunning || !runtime || typeof runtime.frame !== "function") return;

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

  function runtimeConfigSignature(options) {
    return JSON.stringify({
      runtimeKey: options.runtimeKey ?? null,
      routeKey: options.routeKey ?? null,
      hasInitialState: !!options.initialState,
      rootPlaneId: options.initialState?.rootPlaneId ?? null,
      activePlaneId: options.initialState?.activePlaneId ?? null,
      readOnly: !!options.readOnly,
      aiEnabled: options.aiSynthesis?.enabled === true,
      aiGraphId: options.aiGraphId ?? null,
      realtimeEnabled: !!options.realtimeEnabled,
      realtimeWorkspaceId: options.realtimeWorkspaceId ?? null,
      realtimeGraphId: options.realtimeGraphId ?? null,
    });
  }

  function buildRuntimeAiSynthesis() {
    if (
      aiSynthesis &&
      typeof aiSynthesis === "object" &&
      typeof aiSynthesis.synthesize === "function"
    ) {
      return aiSynthesis;
    }

    const enabled =
      aiSynthesis === true ||
      (aiSynthesis &&
        typeof aiSynthesis === "object" &&
        aiSynthesis.enabled === true);

    if (!enabled) return null;

    const cfg =
      aiSynthesis && typeof aiSynthesis === "object" ? aiSynthesis : {};

    return {
      enabled: true,
      onError: typeof cfg.onError === "function" ? cfg.onError : undefined,
      async synthesize({ prompt, state, plane, parentNode }) {
        const result = await callGraphSynthesis({
          prompt,
          state,
          activePlaneId: plane?.id ?? state?.activePlaneId ?? null,
          targetNodeId: parentNode?.id ?? null,
          workspaceId: cfg.workspaceId ?? null,
          graphId: cfg.graphId ?? null,
          tier: cfg.tier ?? null,
          endpoint: cfg.endpoint ?? "/api/ai",
        });

        if (!result?.ok) return null;

        return materializeSynthesisForPlane({
          synthesis: result,
          parentNode: parentNode ?? null,
          anchorX: Number(parentNode?.x) || 0,
          anchorY: Number(parentNode?.y) || 0,
          radius: Number(cfg.radius) || 180,
        });
      },
    };
  }

  function replaceRuntimeState(nextState) {
    if (!runtime || typeof runtime.getState !== "function") return;
    if (!nextState || typeof nextState !== "object") return;

    const current = runtime.getState();
    if (!current || typeof current !== "object") return;
    if (current === nextState) return;

    for (const key of Object.keys(current)) {
      delete current[key];
    }
    Object.assign(current, nextState);
  }

  function applyRealtimePatchToRuntime(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "object") return;
    if (!runtime || typeof runtime.getState !== "function") return;

    const patch =
      rawPayload.patch ??
      rawPayload.payload?.patch ??
      rawPayload.payload ??
      rawPayload;

    if (!patch || typeof patch !== "object") return;

    const currentState = runtime.getState();
    const nextState = applyRemoteGraphPatch(currentState, patch);
    replaceRuntimeState(nextState);
  }

  function emitRealtimePatchFromRuntime(patch) {
    if (!patch || typeof patch !== "object") return;
    if (!realtimeSession || typeof realtimeSession.emitPatch !== "function")
      return;

    try {
      realtimeSession.emitPatch(patch);
    } catch (err) {
      console.warn("Realtime outbound patch failed:", err);
    }
  }

  function buildRuntimeRealtime() {
    const enabled =
      realtime === true ||
      (realtime && typeof realtime === "object" && realtime.enabled === true);

    if (!enabled) return null;

    const cfg = realtime && typeof realtime === "object" ? realtime : {};
    const workspaceId = cfg.workspaceId ?? null;
    const graphId = cfg.graphId ?? null;

    if (!workspaceId || !graphId) return null;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const defaultClientId =
      cfg.clientId ??
      `bs_${cfg.userId ?? "anon"}_${String(graphId).slice(0, 8)}_${Math.random().toString(36).slice(2, 8)}`;

    return createGraphRealtimeSession({
      supabase,
      workspaceId,
      graphId,
      clientId: defaultClientId,
      userId: cfg.userId ?? null,
      displayName: cfg.displayName ?? cfg.userLabel ?? "Anonymous",
      broadcastSelf: false,
      onPatch: (payload) => {
        applyRealtimePatchToRuntime(payload);
      },
      onError: (err) => {
        console.warn("Realtime session error:", err);
      },
    });
  }

  onMount(() => {
    let disposed = false;

    const bootstrap = async () => {
      ctx = canvas?.getContext("2d") ?? null;
      resize();

      await tick();
      const ready = await waitForRequiredDom();

      if (disposed || !ready || typeof window === "undefined") return;

      const runtimeOptions = {
        autoStartLoop: false,
        initialState,
        runtimeKey,
        routeKey:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : null,
        readOnly: !!readOnly,
        aiSynthesis: buildRuntimeAiSynthesis(),
        emitRealtimePatch: emitRealtimePatchFromRuntime,
        realtimeEnabled:
          realtime === true ||
          (realtime &&
            typeof realtime === "object" &&
            realtime.enabled === true),
        realtimeWorkspaceId:
          realtime && typeof realtime === "object"
            ? (realtime.workspaceId ?? null)
            : null,
        realtimeGraphId:
          realtime && typeof realtime === "object"
            ? (realtime.graphId ?? null)
            : null,
        aiGraphId:
          aiSynthesis && typeof aiSynthesis === "object"
            ? (aiSynthesis.graphId ?? null)
            : null,
      };

      const nextSignature = runtimeConfigSignature(runtimeOptions);

      // Runtime captures direct DOM references; always create a fresh instance
      // for each mount so returning to the graph page rebinds correctly.
      window.__BENDSCRIPT_RUNTIME_INSTANCE__?.destroy?.();
      window.__BENDSCRIPT_RUNTIME_INSTANCE__ =
        initPrototypeRuntime(runtimeOptions);
      window.__BENDSCRIPT_RUNTIME_CONFIG_SIGNATURE__ = nextSignature;

      runtime = window.__BENDSCRIPT_RUNTIME_INSTANCE__;
      startLoop();

      realtimeSession = buildRuntimeRealtime();
      if (realtimeSession?.start) {
        await realtimeSession.start();
      }

      const shouldSendInitialSnapshot =
        !!realtime &&
        typeof realtime === "object" &&
        realtime.sendInitialSnapshot === true;

      if (
        shouldSendInitialSnapshot &&
        realtimeSession?.emitPatch &&
        runtime?.getState
      ) {
        const stateSnapshot = runtime.getState();
        await realtimeSession.emitPatch(
          realtimePatch.stateSnapshot(stateSnapshot),
        );
      }
    };

    bootstrap();

    return () => {
      disposed = true;
      stopLoop();
      runtime?.stopLoop?.();

      const activeRealtime = realtimeSession;
      realtimeSession = null;
      activeRealtime?.stop?.();

      const activeRuntime = runtime;
      runtime = null;
      activeRuntime?.destroy?.();

      if (window.__BENDSCRIPT_RUNTIME_INSTANCE__ === activeRuntime) {
        window.__BENDSCRIPT_RUNTIME_INSTANCE__ = null;
        window.__BENDSCRIPT_RUNTIME_CONFIG_SIGNATURE__ = null;
      }
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
