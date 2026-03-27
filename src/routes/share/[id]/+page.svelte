<script>
  import "../../../app.css";
  import { onMount } from "svelte";

  import GraphCanvas from "../../../components/canvas/GraphCanvas.svelte";
  import Breadcrumbs from "../../../components/canvas/Breadcrumbs.svelte";
  import Hint from "../../../components/canvas/Hint.svelte";
  import Composer from "../../../components/canvas/Composer.svelte";
  import NodeInspector from "../../../components/canvas/NodeInspector.svelte";
  import EdgeInspector from "../../../components/canvas/EdgeInspector.svelte";
  import ContextMenu from "../../../components/canvas/ContextMenu.svelte";
  import MarkdownModal from "../../../components/canvas/MarkdownModal.svelte";
  import WarpOverlay from "../../../components/canvas/WarpOverlay.svelte";
  import Legend from "../../../components/canvas/Legend.svelte";

  let { data } = $props();

  let forcingPreview = $state(true);
  let shareError = $state("");

  const shareId = $derived(data?.share?.token || "unknown");
  const title = $derived(data?.graph?.name || "Shared Graph");
  const subtitle = $derived(
    data?.workspace?.name
      ? `Shared from ${data.workspace.name}`
      : "Public read-only view",
  );

  onMount(() => {
    // Force preview mode (best-effort) once runtime has mounted.
    const timer = setTimeout(() => {
      const modeBtn = document.getElementById("nodeModeToggle");
      if (
        modeBtn &&
        String(modeBtn.textContent || "")
          .toUpperCase()
          .includes("EDIT")
      ) {
        modeBtn.click();
      }
      forcingPreview = false;
    }, 350);

    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>{title} · BendScript Share</title>
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="share-shell">
  <header class="share-header">
    <div class="left">
      <a class="brand" href="/">BENDSCRIPT</a>
      <div class="meta">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>

    <div class="right">
      <span class="pill">share id: {shareId}</span>
      <span class="pill pill-readonly">read-only</span>
    </div>
  </header>

  {#if shareError}
    <div class="error-banner">{shareError}</div>
  {/if}

  <section class="app-section share-app" id="appSection">
    <GraphCanvas
      initialState={data?.initialState ?? null}
      readOnly={true}
      runtimeKey={data?.graph?.id ?? shareId}
    />

    <div class="hud">
      <div class="hud-row">
        <div class="brand">
          <b>BENDSCRIPT</b>
          <span>public shared graph</span>
        </div>
        <div class="stats">
          <div class="pill">nodes <b id="statNodes">0</b></div>
          <div class="pill">edges <b id="statEdges">0</b></div>
          <div class="pill">depth <b id="statDepth">0</b></div>
          <div class="pill">zoom <b id="statZoom">1.00x</b></div>
          <div class="pill">routing <b id="statRouting">fast</b></div>
          <div class="pill">κ <b id="statKappa">0</b></div>
          <div class="pill">scc <b id="statScc">0</b></div>
          <div class="pill">islands <b id="statIsland">0</b></div>
          <div class="pill">risk <b id="statRisk">low</b></div>
          <button
            class="pill pill-btn readonly-btn"
            id="nodeModeToggle"
            type="button"
            aria-label="Preview mode"
          >
            mode: PREVIEW
          </button>
        </div>
      </div>

      <Breadcrumbs />
      <Hint />
    </div>

    <!-- Included to satisfy canvas runtime required DOM IDs. Hidden in share mode. -->
    <div class="hidden-runtime-ui" aria-hidden="true">
      <Composer />
      <ContextMenu />
      <EdgeInspector />
      <NodeInspector />
      <MarkdownModal />
    </div>

    <Legend />
    <WarpOverlay />
  </section>

  <footer class="share-footer">
    {#if forcingPreview}
      <span>Preparing read-only mode…</span>
    {:else}
      <span>You are viewing a shared snapshot in preview mode.</span>
    {/if}
  </footer>
</section>

<style>
  .share-shell {
    min-height: 100vh;
    background: #f4f6f8;
    color: #0f172a;
  }

  .share-header {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.66rem 0.82rem;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(8px);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 0.3rem 0.55rem;
    background: #fff;
    color: #0f172a;
    text-decoration: none;
    font:
      700 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    letter-spacing: 0.08em;
  }

  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.12;
  }

  .meta strong {
    font-size: 0.86rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 42vw;
  }

  .meta span {
    font-size: 0.74rem;
    color: #64748b;
  }

  .pill {
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: #fff;
    padding: 0.24rem 0.52rem;
    font:
      600 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    color: #334155;
  }

  .pill-readonly {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #3730a3;
  }

  .readonly-btn {
    pointer-events: none;
    opacity: 0.9;
  }

  .share-app {
    position: relative;
  }

  .hidden-runtime-ui {
    position: fixed;
    left: -99999px;
    top: -99999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
  }

  .error-banner {
    position: fixed;
    top: 4.1rem;
    left: 0.75rem;
    right: 0.75rem;
    z-index: 61;
    padding: 0.6rem 0.72rem;
    border-radius: 10px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    font-size: 0.82rem;
  }

  .share-footer {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0.8rem;
    z-index: 55;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.36rem 0.72rem;
    color: #334155;
    font:
      600 0.7rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }

  @media (max-width: 900px) {
    .share-header {
      top: 0.5rem;
      left: 0.5rem;
      right: 0.5rem;
      padding: 0.55rem 0.62rem;
    }

    .right .pill:first-child {
      display: none;
    }

    .meta strong {
      max-width: 56vw;
    }
  }
</style>
