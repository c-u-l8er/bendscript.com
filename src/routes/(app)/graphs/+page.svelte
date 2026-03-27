<script>
  let { data, form } = $props();

  const workspaces = $derived(
    Array.isArray(data?.workspaces) ? data.workspaces : [],
  );
  const activeWorkspaceId = $derived(
    data?.activeWorkspaceId ?? workspaces[0]?.id ?? null,
  );
  const activeWorkspace = $derived(
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0] ??
      null,
  );

  const graphs = $derived(Array.isArray(data?.graphs) ? data.graphs : []);
  const activeGraphId = $derived(data?.activeGraphId ?? graphs[0]?.id ?? null);
  const activeGraph = $derived(
    graphs.find((graph) => graph.id === activeGraphId) ?? graphs[0] ?? null,
  );

  const actionMessage = $derived(form?.message ?? "");
  const actionType = $derived(form?.action ?? "");

  function workspaceHref(workspaceId) {
    const p = new URLSearchParams();
    p.set("ws", workspaceId);
    if (activeGraphId) p.set("graph", activeGraphId);
    return `/graphs?${p.toString()}`;
  }

  function graphHref(graphId, workspaceId = activeWorkspaceId) {
    if (!graphId) return `/graphs?ws=${encodeURIComponent(workspaceId || "")}`;
    const p = new URLSearchParams();
    if (workspaceId) p.set("workspace", workspaceId);
    return `/graph/${graphId}?${p.toString()}`;
  }

  function graphManageHref(graphId, workspaceId = activeWorkspaceId) {
    const p = new URLSearchParams();
    if (workspaceId) p.set("ws", workspaceId);
    if (graphId) p.set("graph", graphId);
    return `/graphs?${p.toString()}`;
  }

  function formatDate(input) {
    if (!input) return "—";
    const d = new Date(input);
    if (Number.isNaN(d.valueOf())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function roleLabel(role) {
    if (!role) return "member";
    return String(role).replaceAll("_", " ");
  }

  function initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "WS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
</script>

<svelte:head>
  <title>Graphs — BendScript</title>
</svelte:head>

<section class="graphs-page">
  <header class="topbar">
    <div>
      <p class="eyebrow">graph management</p>
      <h1>Manage Graphs</h1>
      <p class="muted">
        Select a workspace route, then create, update, delete, and open graphs.
      </p>
    </div>
    <div class="actions">
      <a class="btn btn-secondary" href="/dashboard">Dashboard</a>
      <a class="btn btn-secondary" href="/workspaces">Workspaces</a>
      {#if activeGraph}
        <a class="btn" href={graphHref(activeGraph.id, activeWorkspaceId)}>Open selected graph</a>
      {/if}
    </div>
  </header>

  {#if actionMessage}
    <p class="notice">{actionType}: {actionMessage}</p>
  {/if}

  <div class="layout">
    <aside class="panel">
      <div class="panel-head">
        <h2>Workspaces</h2>
        <span class="count">{workspaces.length}</span>
      </div>

      {#if workspaces.length === 0}
        <div class="empty">
          <p>No workspaces found.</p>
          <a class="link" href="/workspaces">Create your first workspace</a>
        </div>
      {:else}
        <ul class="workspace-list">
          {#each workspaces as workspace}
            {@const isActive = workspace.id === activeWorkspaceId}
            <li class:active={isActive}>
              <a href={workspaceHref(workspace.id)} aria-current={isActive ? "page" : undefined}>
                <span class="avatar">{initials(workspace.name)}</span>
                <span class="meta">
                  <strong>{workspace.name}</strong>
                  <small>{roleLabel(workspace.role)} • {workspace.plan ?? "free"}</small>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <main class="content">
      <section class="card">
        <div class="card-head">
          <h2>Graphs in selected workspace</h2>
          <span class="count">{graphs.length}</span>
        </div>

        {#if !activeWorkspace}
          <p class="muted">No active workspace selected.</p>
        {:else if graphs.length === 0}
          <p class="muted">
            No graphs in <strong>{activeWorkspace.name}</strong> yet. Use the create form below.
          </p>
        {:else}
          <ul class="graph-list">
            {#each graphs as graph}
              {@const isSelected = graph.id === activeGraphId}
              <li class:selected={isSelected}>
                <a class="graph-meta" href={graphManageHref(graph.id, activeWorkspaceId)}>
                  <div>
                    <strong>{graph.name || "Untitled Graph"}</strong>
                    <small>{graph.description || "No description"}</small>
                  </div>
                  <span>{formatDate(graph.updated_at)}</span>
                </a>
                <a class="open-link" href={graphHref(graph.id, activeWorkspaceId)}>Open</a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Create graph</h2>
        </div>
        <form method="POST" action="?/createGraph" class="crud-form">
          <input type="hidden" name="workspaceId" value={activeWorkspace?.id ?? ""} />
          <label>
            Name
            <input name="name" type="text" maxlength="180" placeholder="Untitled Graph" />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows="3"
              maxlength="280"
              placeholder="Optional description"
            ></textarea>
          </label>
          <label class="checkbox-row">
            <input name="isPublic" type="checkbox" />
            Public graph
          </label>
          <button class="btn" type="submit" disabled={!activeWorkspace}>
            Create graph
          </button>
        </form>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Update selected graph</h2>
        </div>
        <form method="POST" action="?/updateGraph" class="crud-form">
          <input type="hidden" name="workspaceId" value={activeWorkspace?.id ?? ""} />
          <input type="hidden" name="graphId" value={activeGraph?.id ?? ""} />

          <label>
            Name
            <input
              name="name"
              type="text"
              required
              maxlength="180"
              value={activeGraph?.name ?? ""}
              disabled={!activeGraph}
            />
          </label>
          <label>
            Slug (optional)
            <input
              name="slug"
              type="text"
              maxlength="220"
              value={activeGraph?.slug ?? ""}
              disabled={!activeGraph}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows="3"
              maxlength="280"
              disabled={!activeGraph}
            >{activeGraph?.description ?? ""}</textarea>
          </label>
          <label class="checkbox-row">
            <input
              name="isPublic"
              type="checkbox"
              checked={!!activeGraph?.is_public}
              disabled={!activeGraph}
            />
            Public graph
          </label>
          <button class="btn btn-secondary" type="submit" disabled={!activeGraph}>
            Save graph
          </button>
        </form>
      </section>

      <section class="card danger">
        <div class="card-head">
          <h2>Delete selected graph</h2>
        </div>
        <form method="POST" action="?/deleteGraph" class="crud-form">
          <input type="hidden" name="workspaceId" value={activeWorkspace?.id ?? ""} />
          <input type="hidden" name="graphId" value={activeGraph?.id ?? ""} />

          <p class="muted">
            This permanently deletes <strong>{activeGraph?.name ?? "the selected graph"}</strong>.
            Type its exact name to confirm.
          </p>
          <label>
            Confirm name
            <input
              name="confirmName"
              type="text"
              placeholder={activeGraph?.name ?? "Graph name"}
              disabled={!activeGraph}
            />
          </label>
          <button class="btn btn-danger" type="submit" disabled={!activeGraph}>
            Delete graph
          </button>
        </form>
      </section>
    </main>
  </div>
</section>

<style>
  :global(html, body) {
    overflow: auto;
  }

  :global(body) {
    user-select: text;
    -webkit-user-select: text;
    background: #f4f6f8;
    color: #0f172a;
  }

  .graphs-page {
    max-width: 1160px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: #64748b;
    font:
      600 0.75rem/1.2 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  h1 {
    margin: 0 0 0.4rem;
    font-size: clamp(1.6rem, 2.6vw, 2.3rem);
    line-height: 1.15;
  }

  .muted {
    color: #64748b;
    margin: 0.25rem 0 0;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .layout {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(240px, 290px) 1fr;
  }

  .panel,
  .card {
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    background: #fff;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  }

  .panel {
    padding: 0.9rem;
    height: fit-content;
    position: sticky;
    top: 1rem;
  }

  .content {
    display: grid;
    gap: 1rem;
  }

  .card {
    padding: 1rem;
  }

  .panel-head,
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    margin-bottom: 0.7rem;
  }

  .workspace-list,
  .graph-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .workspace-list li a {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    padding: 0.62rem 0.55rem;
    border-radius: 0.75rem;
    text-decoration: none;
    color: inherit;
  }

  .workspace-list li.active a {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .workspace-list li a:hover {
    background: #f8fafc;
  }

  .avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e2e8f0;
    font:
      700 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    flex-shrink: 0;
  }

  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .meta small {
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .graph-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;
    padding: 0.55rem;
  }

  .graph-list li + li {
    margin-top: 0.4rem;
  }

  .graph-list li.selected {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  .graph-meta {
    min-width: 0;
    flex: 1;
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
    text-decoration: none;
    color: inherit;
  }

  .graph-meta strong {
    display: block;
    margin-bottom: 0.1rem;
  }

  .graph-meta small {
    color: #64748b;
  }

  .open-link {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    text-decoration: none;
    border-radius: 0.6rem;
    padding: 0.35rem 0.6rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .open-link:hover {
    background: #f8fafc;
  }

  .crud-form {
    display: grid;
    gap: 0.55rem;
  }

  .crud-form label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.86rem;
    color: #334155;
  }

  .crud-form input,
  .crud-form textarea {
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    padding: 0.5rem 0.6rem;
    font: inherit;
    color: #0f172a;
    background: #fff;
  }

  .crud-form input:disabled,
  .crud-form textarea:disabled,
  .crud-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .checkbox-row {
    display: flex !important;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox-row input {
    width: 1rem;
    height: 1rem;
  }

  .count {
    font:
      600 0.74rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    text-transform: uppercase;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 0.24rem 0.5rem;
    background: #f8fafc;
  }

  .notice {
    margin: 0 0 1rem;
    border: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    border-radius: 0.7rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.9rem;
  }

  .empty {
    border: 1px dashed #cbd5e1;
    border-radius: 0.75rem;
    padding: 0.9rem;
    color: #475569;
  }

  .link {
    color: #2563eb;
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: #fff;
    text-decoration: none;
    border-radius: 0.7rem;
    padding: 0.6rem 0.9rem;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .btn-secondary {
    background: #fff;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .btn-danger {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    border-color: #991b1b;
    color: #fff;
  }

  .card.danger {
    border-color: #fecaca;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .panel {
      position: static;
    }
  }
</style>
