<script>
  import { createEventDispatcher } from "svelte";

  export let workspaces = [];
  export let currentWorkspaceId = null;
  export let title = "Workspaces";
  export let showCreate = true;
  export let createHref = "/dashboard";
  export let emptyText = "No workspaces yet.";
  export let compact = false;

  const dispatch = createEventDispatcher();

  function roleLabel(role) {
    if (!role) return "member";
    return String(role).replaceAll("_", " ");
  }

  function initials(name = "") {
    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "WS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  function graphCount(workspace) {
    return (
      Number(workspace?.stats?.graphs) ||
      Number(workspace?.graphCount) ||
      Number(workspace?.graphsCount) ||
      0
    );
  }

  function selectWorkspace(workspace) {
    dispatch("select", {
      id: workspace?.id ?? null,
      workspace,
    });
  }
</script>

<aside class="workspace-sidebar" class:compact>
  <header class="sidebar-header">
    <h2>{title}</h2>
    {#if showCreate}
      <a class="new-btn" href={createHref}>+ New</a>
    {/if}
  </header>

  {#if !Array.isArray(workspaces) || workspaces.length === 0}
    <div class="empty-state">
      <p>{emptyText}</p>
    </div>
  {:else}
    <ul class="workspace-list" aria-label={title}>
      {#each workspaces as workspace (workspace.id)}
        {@const active = workspace.id === currentWorkspaceId}
        <li>
          <button
            type="button"
            class="workspace-item"
            class:active={active}
            on:click={() => selectWorkspace(workspace)}
            aria-current={active ? "page" : undefined}
            title={workspace.name}
          >
            <span class="avatar">{initials(workspace?.name)}</span>

            <span class="meta">
              <strong>{workspace?.name || "Untitled Workspace"}</strong>
              <small>
                {roleLabel(workspace?.role)} · {workspace?.plan || "free"} ·
                {graphCount(workspace)} graphs
              </small>
            </span>

            {#if Number(workspace?.unreadCount) > 0}
              <span class="badge">{workspace.unreadCount}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="sidebar-footer">
    <slot />
  </footer>
</aside>

<style>
  .workspace-sidebar {
    width: min(320px, 100%);
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.9rem;
    border-bottom: 1px solid #edf2f7;
    background: #f8fafc;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  .new-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    border: 1px solid #cbd5e1;
    background: white;
    color: #0f172a;
    font-size: 0.76rem;
    font-weight: 600;
    line-height: 1;
    padding: 0.42rem 0.58rem;
    text-decoration: none;
  }

  .new-btn:hover {
    background: #f8fafc;
  }

  .workspace-list {
    list-style: none;
    margin: 0;
    padding: 0.6rem;
    display: grid;
    gap: 0.4rem;
    max-height: 68vh;
    overflow: auto;
  }

  .workspace-item {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 11px;
    background: transparent;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    text-align: left;
    padding: 0.56rem;
    cursor: pointer;
  }

  .workspace-item:hover {
    background: #f8fafc;
  }

  .workspace-item.active {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .avatar {
    width: 1.95rem;
    height: 1.95rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #e2e8f0;
    color: #0f172a;
    font: 700 0.72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    flex: 1;
  }

  .meta strong {
    font-size: 0.86rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta small {
    color: #64748b;
    font-size: 0.74rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    min-width: 1.2rem;
    height: 1.2rem;
    border-radius: 999px;
    background: #2563eb;
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.66rem;
    font-weight: 700;
    padding: 0 0.3rem;
    flex-shrink: 0;
  }

  .empty-state {
    padding: 1rem;
    color: #64748b;
    font-size: 0.85rem;
    border-top: 1px solid #edf2f7;
  }

  .empty-state p {
    margin: 0;
  }

  .sidebar-footer {
    border-top: 1px solid #edf2f7;
    padding: 0.7rem 0.9rem;
    background: #fff;
  }

  .compact .workspace-item {
    padding: 0.45rem;
  }

  .compact .avatar {
    width: 1.7rem;
    height: 1.7rem;
    font-size: 0.64rem;
  }

  .compact .meta small {
    display: none;
  }
</style>
