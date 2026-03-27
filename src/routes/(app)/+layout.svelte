<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let { data, children } = $props();

  const appName = "BendScript";

  const user = $derived(data?.user ?? null);
  const session = $derived(data?.session ?? null);
  const workspaces = $derived(
    Array.isArray(data?.workspaces) ? data.workspaces : [],
  );

  const activeWorkspaceId = $derived(
    data?.currentWorkspaceId ??
      data?.currentWorkspace?.id ??
      workspaces[0]?.id ??
      null,
  );

  const currentWorkspace = $derived(
    workspaces.find((w) => w.id === activeWorkspaceId) ??
      data?.currentWorkspace ??
      workspaces[0] ??
      null,
  );

  const integration = $derived(
    data?.integration ?? {
      mode: "prototype_local",
      supabase: { configured: false, missing: [] },
      api: { configured: false, missing: [] },
      aiProxy: { configured: false, missing: [] },
      realtime: { configured: false },
      graphPersistence: { configured: false },
    },
  );

  const inPrototypeMode = $derived(integration.mode !== "cloud");

  const integrationItems = $derived([
    { label: "Supabase", ok: !!integration?.supabase?.configured },
    { label: "API", ok: !!integration?.api?.configured },
    { label: "AI Proxy", ok: !!integration?.aiProxy?.configured },
    { label: "Realtime", ok: !!integration?.realtime?.configured },
    {
      label: "Graph Sync",
      ok: !!integration?.graphPersistence?.configured,
    },
  ]);

  const missingIntegrationVars = $derived([
    ...(Array.isArray(integration?.supabase?.missing)
      ? integration.supabase.missing
      : []),
    ...(Array.isArray(integration?.api?.missing)
      ? integration.api.missing
      : []),
    ...(Array.isArray(integration?.aiProxy?.missing)
      ? integration.aiProxy.missing
      : []),
  ]);

  $effect(() => {
    if (!session || !user) {
      goto("/auth/login");
    }
  });

  function isActiveWorkspace(workspaceId) {
    const q = $page.url.searchParams.get("workspace");
    if (q) return q === workspaceId;
    return workspaceId === activeWorkspaceId;
  }

  function workspaceHref(workspaceId) {
    const q = new URLSearchParams($page.url.searchParams);
    q.set("workspace", workspaceId);
    return `${$page.url.pathname}?${q.toString()}`;
  }

  function badgeClass(ok) {
    return ok ? "badge badge-ok" : "badge badge-off";
  }
</script>

<svelte:head>
  <title>{appName} — App</title>
</svelte:head>

{#if session && user}
  <div class="app-shell">
    <aside class="sidebar">
      <a class="logo" href="/dashboard">
        <span class="logo-mark">⊛</span>
        <span class="logo-text">{appName}</span>
      </a>

      <nav class="shell-nav" aria-label="App navigation">
        <a href="/dashboard">Dashboard</a>
        <a href="/workspaces">Workspaces</a>
      </nav>

      <section class="panel">
        <header class="panel-header">
          <h2>Workspaces</h2>
        </header>

        {#if workspaces.length === 0}
          <p class="empty">No workspaces yet.</p>
        {:else}
          <ul class="workspace-list">
            {#each workspaces as ws (ws.id)}
              <li>
                <a
                  class:active={isActiveWorkspace(ws.id)}
                  href={workspaceHref(ws.id)}
                  title={ws.name}
                >
                  <span class="name">{ws.name}</span>
                  {#if ws.role}
                    <span class="role">{ws.role}</span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <form class="logout" method="post" action="/auth/logout">
        <button type="submit">Sign out</button>
      </form>
    </aside>

    <main class="content">
      <header class="topbar">
        <div class="topbar-meta">
          <h1>{currentWorkspace?.name ?? "Workspace"}</h1>
          <p>{user.email}</p>
          <div class="quick-links">
            <a href="/dashboard">Dashboard</a>
            <a href="/workspaces">Manage workspaces</a>
          </div>
        </div>

        <div class="status-pills" aria-label="Integration status">
          {#each integrationItems as item (item.label)}
            <span class={badgeClass(item.ok)}>
              <span class="dot" aria-hidden="true"></span>
              {item.label}
            </span>
          {/each}
        </div>
      </header>

      {#if inPrototypeMode}
        <section class="integration-banner" role="status" aria-live="polite">
          <strong>Cloud integrations are not fully configured.</strong>
          <span>
            Running in prototype/local mode. Some functionality (persistent
            cloud tables, API routes, realtime, AI proxy) may be unavailable.
          </span>
          {#if missingIntegrationVars.length > 0}
            <small>Missing: {missingIntegrationVars.join(", ")}</small>
          {/if}
        </section>
      {/if}

      <section class="page-body">
        {@render children?.()}
      </section>
    </main>
  </div>
{/if}

<style>
  .app-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px 1fr;
    background: #f4f6f8;
    color: #111827;
  }

  .sidebar {
    border-right: 1px solid #dbe3ea;
    background: #ffffff;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .logo-mark {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #111827;
    color: #ffffff;
    font-size: 14px;
  }

  .logo-text {
    font-size: 14px;
  }

  .shell-nav {
    display: grid;
    gap: 6px;
  }

  .shell-nav a {
    text-decoration: none;
    color: #334155;
    font-size: 13px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    background: #f8fafc;
  }

  .shell-nav a:hover {
    background: #eef2f6;
    color: #111827;
  }

  .panel {
    border: 1px solid #e5eaf0;
    border-radius: 12px;
    overflow: hidden;
    background: #fbfcfd;
  }

  .panel-header {
    border-bottom: 1px solid #e5eaf0;
    padding: 10px 12px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .empty {
    margin: 0;
    padding: 12px;
    color: #64748b;
    font-size: 13px;
  }

  .workspace-list {
    list-style: none;
    margin: 0;
    padding: 8px;
    display: grid;
    gap: 6px;
  }

  .workspace-list a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    text-decoration: none;
    border: 1px solid transparent;
    color: #111827;
    background: transparent;
  }

  .workspace-list a:hover {
    background: #eef2f6;
  }

  .workspace-list a.active {
    background: #e6eef8;
    border-color: #bfd2eb;
  }

  .workspace-list .name {
    font-size: 14px;
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-list .role {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4b5563;
  }

  .logout {
    margin-top: auto;
  }

  .logout button {
    width: 100%;
    border: 1px solid #d1d9e0;
    border-radius: 10px;
    background: #ffffff;
    color: #111827;
    padding: 10px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .logout button:hover {
    background: #f8fafc;
  }

  .content {
    display: grid;
    grid-template-rows: auto auto 1fr;
    min-width: 0;
  }

  .topbar {
    border-bottom: 1px solid #dbe3ea;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    padding: 16px 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .topbar h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
  }

  .topbar p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 13px;
  }

  .topbar-meta {
    display: grid;
    gap: 6px;
  }

  .quick-links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .quick-links a {
    text-decoration: none;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 600;
  }

  .quick-links a:hover {
    text-decoration: underline;
  }

  .status-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    display: inline-block;
    flex-shrink: 0;
  }

  .badge-ok {
    background: #ecfdf3;
    color: #166534;
    border-color: #bbf7d0;
  }

  .badge-ok .dot {
    background: #16a34a;
  }

  .badge-off {
    background: #fff1f2;
    color: #9f1239;
    border-color: #fecdd3;
  }

  .badge-off .dot {
    background: #e11d48;
  }

  .integration-banner {
    margin: 10px 18px 0;
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #9a3412;
    border-radius: 10px;
    padding: 10px 12px;
    display: grid;
    gap: 4px;
  }

  .integration-banner strong {
    font-size: 13px;
  }

  .integration-banner span,
  .integration-banner small {
    font-size: 12px;
  }

  .page-body {
    min-width: 0;
    padding: 16px 18px 18px;
  }

  @media (max-width: 980px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: 0;
      border-bottom: 1px solid #dbe3ea;
    }

    .topbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .status-pills {
      justify-content: flex-start;
    }

    .page-body {
      padding: 12px;
    }

    .integration-banner {
      margin: 8px 12px 0;
    }
  }
</style>
