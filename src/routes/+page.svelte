<script>
  import "../app.css";
  import { onMount } from "svelte";
  import HeroSection from "../components/hero/HeroSection.svelte";
  import GraphCanvas from "../components/canvas/GraphCanvas.svelte";
  import Breadcrumbs from "../components/canvas/Breadcrumbs.svelte";
  import Hint from "../components/canvas/Hint.svelte";
  import Composer from "../components/canvas/Composer.svelte";
  import NodeInspector from "../components/canvas/NodeInspector.svelte";
  import EdgeInspector from "../components/canvas/EdgeInspector.svelte";
  import ContextMenu from "../components/canvas/ContextMenu.svelte";
  import MarkdownModal from "../components/canvas/MarkdownModal.svelte";
  import WarpOverlay from "../components/canvas/WarpOverlay.svelte";
  import Legend from "../components/canvas/Legend.svelte";
  import { initHeroController } from "$lib/engine/heroController";

  onMount(() => {
    initHeroController();
  });
</script>

<svelte:head>
  <title>BendScript — Script Bending Through Graph Space</title>
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  />
  <link rel="icon" href="/favicon.ico" sizes="any" />
</svelte:head>

<HeroSection />

<section class="app-section" id="appSection">
  <GraphCanvas />

  <div class="hud">
    <div class="hud-row">
      <div class="brand">
        <b>BENDSCRIPT</b>
        <span>prompts become topology</span>
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
        <a class="pill" href="/dashboard">dashboard</a>
        <a class="pill" href="/dashboard#workspace-crud">workspaces</a>
        <button class="pill pill-btn" id="nodeModeToggle" type="button">
          mode: EDIT
        </button>
      </div>
    </div>
    <Breadcrumbs />
    <Hint />
  </div>

  <Composer />

  <ContextMenu />
  <Legend />

  <div class="site-credit">
    Copyright 2026. Powered by
    <a
      href="https://ampersandboxdesign.com"
      target="_blank"
      rel="noopener noreferrer">[&]</a
    >
  </div>

  <EdgeInspector />
  <NodeInspector />

  <MarkdownModal />
  <WarpOverlay />

  <button class="back-to-top" id="backToTop">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 8.5l4-4 4 4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    HOME
  </button>
</section>
