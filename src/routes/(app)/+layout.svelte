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
  const currentWorkspaceId = $derived(
    data?.currentWorkspaceId ?? workspaces[0]?.id ?? null,
  );

  const currentWorkspace = $derived(
    workspaces.find((w) => w.id === currentWorkspaceId) ??
      workspaces[0] ??
      null,
  );

  $effect(() => {
    if (!session || !user) {
      // Guard for any client-side transitions where server redirect wasn't applied.
      goto("/auth/login");
    }
  });

  function isActiveWorkspace(workspaceId) {
    return $page.url.searchParams.get("workspace") === workspaceId;
  }

  function workspaceHref(workspaceId) {
    const q = new URLSearchParams($page.url.searchParams);
    q.set("workspace", workspaceId);
    return `${$page.url.pathname}?${q.toString()}`;
  }
</script>

<svelte:head>
  <title>{appName} — App</title>
</svelte:head>

{#if session && user}
  <div class="app-shell">
    <aside class="sidebar">
      <a class="logo" href="/">
        <span class="logo-mark">⊛</span>
        <span class="logo-text">{appName}</span>
      </a>

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
        <div>
          <h1>{currentWorkspace?.name ?? "Workspace"}</h1>
          <p>{user.email}</p>
        </div>
      </header>

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
    grid-template-rows: auto 1fr;
    min-width: 0;
  }

  .topbar {
    border-bottom: 1px solid #dbe3ea;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    padding: 16px 22px;
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

  .page-body {
    padding: 20px 22px 24px;
    min-width: 0;
  }

  @media (max-width: 980px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: 0;
      border-bottom: 1px solid #dbe3ea;
    }
  }
</style>
