<script>
  import "../../../../app.css";
  import { page } from "$app/stores";
  import GraphCanvas from "../../../../components/canvas/GraphCanvas.svelte";
  import Breadcrumbs from "../../../../components/canvas/Breadcrumbs.svelte";
  import Hint from "../../../../components/canvas/Hint.svelte";
  import Composer from "../../../../components/canvas/Composer.svelte";
  import NodeInspector from "../../../../components/canvas/NodeInspector.svelte";
  import EdgeInspector from "../../../../components/canvas/EdgeInspector.svelte";
  import ContextMenu from "../../../../components/canvas/ContextMenu.svelte";
  import MarkdownModal from "../../../../components/canvas/MarkdownModal.svelte";
  import WarpOverlay from "../../../../components/canvas/WarpOverlay.svelte";
  import Legend from "../../../../components/canvas/Legend.svelte";

  /** @type {{ data: any }} */
  let { data } = $props();

  const graphId = $derived(data?.graph?.id ?? $page.params.id ?? "unknown");
  const graphName = $derived(data?.graph?.name ?? `Graph ${graphId}`);
  const workspaceName = $derived(data?.workspace?.name ?? "Workspace");
  const isAuthed = $derived(!!data?.user);
  const canEdit = $derived(!!data?.canEdit);
  const initialGraphState = $derived(data?.initialState ?? null);
  const graphCanvasAi = $derived(
    canEdit
      ? {
          enabled: true,
          workspaceId: data?.workspace?.id ?? data?.graph?.workspaceId ?? null,
          graphId: data?.graph?.id ?? null,
          tier: 2,
        }
      : { enabled: false },
  );
  const graphCanvasRealtime = $derived(
    canEdit
      ? {
          enabled: true,
          workspaceId: data?.workspace?.id ?? data?.graph?.workspaceId ?? null,
          graphId: data?.graph?.id ?? null,
          userId: data?.user?.id ?? null,
          userLabel: data?.user?.email ?? "Anonymous",
        }
      : { enabled: false },
  );
</script>

<svelte:head>
  <title>{graphName} · BendScript</title>
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  />
</svelte:head>

{#if !isAuthed}
  <main class="auth-guard">
    <h1>Sign in required</h1>
    <p>You need to be signed in to access this graph.</p>
    <a class="auth-link" href="/auth/login">Go to Login</a>
  </main>
{:else}
  <section class="app-shell">
    <header class="app-topbar">
      <div class="left">
        <a class="back-link" href="/dashboard">← Dashboard</a>
        <div class="graph-meta">
          <strong>{graphName}</strong>
          <span>{workspaceName}</span>
        </div>
      </div>
      <div class="right">
        <span class="graph-id">id: {graphId}</span>
        <form method="POST" action="/auth/logout">
          <button type="submit" class="logout-btn">Logout</button>
        </form>
      </div>
    </header>

    <section class="app-section" id="appSection">
      <GraphCanvas
        initialState={initialGraphState}
        readOnly={!canEdit}
        aiSynthesis={graphCanvasAi}
        realtime={graphCanvasRealtime}
      />

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
      <EdgeInspector />
      <NodeInspector />
      <MarkdownModal />
      <WarpOverlay />
    </section>
  </section>
{/if}

<style>
  .app-shell {
    position: relative;
    width: 100%;
    min-height: 100vh;
  }

  .app-topbar {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    z-index: 50;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0.875rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .graph-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
    min-width: 0;
  }

  .graph-meta strong {
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 42vw;
  }

  .graph-meta span,
  .graph-id {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .back-link,
  .logout-btn,
  .auth-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1;
    padding: 0.55rem 0.72rem;
    text-decoration: none;
    border: 1px solid rgba(15, 23, 42, 0.14);
    background: white;
    color: inherit;
  }

  .logout-btn {
    cursor: pointer;
  }

  .auth-guard {
    min-height: 100vh;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  @media (max-width: 900px) {
    .app-topbar {
      top: 0.5rem;
      left: 0.5rem;
      right: 0.5rem;
      padding: 0.55rem 0.65rem;
    }

    .graph-id {
      display: none;
    }

    .graph-meta strong {
      max-width: 36vw;
    }
  }
</style>
