<script>
  let { data, form } = $props();

  const appName = "BendScript";

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

  const membersByWorkspace = $derived(data?.membersByWorkspace ?? {});
  const graphCountsByWorkspace = $derived(data?.graphCountsByWorkspace ?? {});
  const recentGraphs = $derived(
    Array.isArray(data?.recentGraphs) ? data.recentGraphs : [],
  );

  const workspacePlans = ["free", "kag_api", "kag_teams", "enterprise"];
  const actionMessage = $derived(form?.message ?? "");
  const actionType = $derived(form?.action ?? "");

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

  function dashboardWorkspaceHref(workspaceId = activeWorkspaceId) {
    if (!workspaceId) return "/dashboard";
    return `/dashboard?ws=${encodeURIComponent(workspaceId)}`;
  }

  function graphHref(graphId, workspaceId = activeWorkspaceId) {
    if (!graphId) return dashboardWorkspaceHref(workspaceId);
    const workspaceQuery = workspaceId
      ? `?workspace=${encodeURIComponent(workspaceId)}`
      : "";
    return `/graph/${graphId}${workspaceQuery}`;
  }

  function workspaceOpenHref(workspace) {
    const workspaceId = workspace?.id ?? null;
    const graphId = workspace?.defaultGraphId ?? null;
    return graphHref(graphId, workspaceId);
  }
</script>

<svelte:head>
  <title>Dashboard — {appName}</title>
</svelte:head>

<section class="dashboard">
  <header class="topbar">
    <div>
      <p class="eyebrow">workspace dashboard</p>
      <h1>Welcome back</h1>
      <p class="muted">
        Manage your workspaces, members, and graph projects from one place.
      </p>
    </div>

    <div class="actions">
      <a
        class="btn btn-secondary"
        href={graphHref(
          activeWorkspace?.defaultGraphId ?? null,
          activeWorkspace?.id ?? null,
        )}
      >
        Open graph
      </a>
      <a class="btn" href="/workspaces">Manage workspaces</a>
    </div>
  </header>

  <div class="layout">
    <aside class="panel">
      <div class="panel-head">
        <h2>Your workspaces</h2>
        <span class="count">{workspaces.length}</span>
      </div>

      {#if workspaces.length === 0}
        <div class="empty">
          <p>No workspaces yet.</p>
          <a class="link" href="/workspaces">Create your first workspace</a>
        </div>
      {:else}
        <ul class="workspace-list">
          {#each workspaces as workspace}
            {@const isActive = workspace.id === activeWorkspaceId}
            <li class:active={isActive}>
              <a
                href={workspaceOpenHref(workspace)}
                aria-current={isActive ? "page" : undefined}
              >
                <span class="avatar">{initials(workspace.name)}</span>
                <span class="meta">
                  <strong>{workspace.name}</strong>
                  <small>
                    {roleLabel(workspace.role)} • {graphCountsByWorkspace[
                      workspace.id
                    ] ?? 0} graphs
                  </small>
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
          <h2>{activeWorkspace?.name ?? "No workspace selected"}</h2>
          <span class="plan">{activeWorkspace?.plan ?? "free"}</span>
        </div>

        <div class="stats">
          <article>
            <p>Members</p>
            <strong
              >{membersByWorkspace[activeWorkspace?.id]?.length ?? 0}</strong
            >
          </article>
          <article>
            <p>Graphs</p>
            <strong>{graphCountsByWorkspace[activeWorkspace?.id] ?? 0}</strong>
          </article>
          <article>
            <p>Last updated</p>
            <strong>{formatDate(activeWorkspace?.updated_at)}</strong>
          </article>
        </div>
      </section>

      <section class="card" id="workspace-crud">
        <div class="card-head">
          <h2>Workspace management</h2>
          <span class="plan">CRUD</span>
        </div>

        {#if actionMessage}
          <p class="notice">{actionType}: {actionMessage}</p>
        {/if}

        <div class="workspace-crud-grid">
          <form method="POST" action="?/createWorkspace" class="workspace-form">
            <h3>Create workspace</h3>
            <label>
              Name
              <input name="name" type="text" required maxlength="80" />
            </label>
            <label>
              Slug (optional)
              <input name="slug" type="text" maxlength="120" />
            </label>
            <label>
              Plan
              <select name="plan">
                {#each workspacePlans as plan}
                  <option value={plan}>{plan}</option>
                {/each}
              </select>
            </label>
            <button class="btn" type="submit">Create</button>
          </form>

          <form method="POST" action="?/updateWorkspace" class="workspace-form">
            <h3>Update workspace</h3>
            <input
              type="hidden"
              name="workspaceId"
              value={activeWorkspace?.id ?? ""}
            />
            <label>
              Name
              <input
                name="name"
                type="text"
                required
                maxlength="80"
                value={activeWorkspace?.name ?? ""}
                disabled={!activeWorkspace}
              />
            </label>
            <label>
              Slug
              <input
                name="slug"
                type="text"
                maxlength="120"
                value={activeWorkspace?.slug ?? ""}
                disabled={!activeWorkspace}
              />
            </label>
            <label>
              Plan
              <select name="plan" disabled={!activeWorkspace}>
                {#each workspacePlans as plan}
                  <option
                    value={plan}
                    selected={(activeWorkspace?.plan ?? "free") === plan}
                  >
                    {plan}
                  </option>
                {/each}
              </select>
            </label>
            <button
              class="btn btn-secondary"
              type="submit"
              disabled={!activeWorkspace}
            >
              Save changes
            </button>
          </form>

          <form
            method="POST"
            action="?/deleteWorkspace"
            class="workspace-form danger"
          >
            <h3>Delete workspace</h3>
            <input
              type="hidden"
              name="workspaceId"
              value={activeWorkspace?.id ?? ""}
            />
            <p class="muted">
              This permanently deletes the selected workspace. Type its exact
              name to confirm.
            </p>
            <label>
              Confirm name
              <input
                name="confirmName"
                type="text"
                placeholder={activeWorkspace?.name ?? "Workspace name"}
                disabled={!activeWorkspace}
              />
            </label>
            <button
              class="btn btn-danger"
              type="submit"
              disabled={!activeWorkspace}
            >
              Delete workspace
            </button>
          </form>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Recent graphs</h2>
          <a
            class="link"
            href={dashboardWorkspaceHref(activeWorkspace?.id ?? null)}
            >View all</a
          >
        </div>

        {#if recentGraphs.length === 0}
          <p class="muted">
            No graphs yet. Start by opening the canvas and creating your first
            nodes.
          </p>
        {:else}
          <ul class="graphs">
            {#each recentGraphs as graph}
              <li>
                <a href={graphHref(graph.id, activeWorkspace?.id ?? null)}>
                  <div>
                    <strong>{graph.name || "Untitled Graph"}</strong>
                    <small>{graph.description || "No description"}</small>
                  </div>
                  <span>{formatDate(graph.updated_at)}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Team members</h2>
          <a class="link" href="/settings/members">Manage</a>
        </div>

        {#if !activeWorkspace}
          <p class="muted">Select a workspace to view members.</p>
        {:else}
          {@const members = membersByWorkspace[activeWorkspace.id] ?? []}
          {#if members.length === 0}
            <p class="muted">No members found for this workspace.</p>
          {:else}
            <ul class="members">
              {#each members as member}
                <li>
                  <span class="avatar small"
                    >{initials(
                      member?.profile?.full_name ||
                        member?.profile?.email ||
                        "U",
                    )}</span
                  >
                  <div>
                    <strong
                      >{member?.profile?.full_name ||
                        member?.profile?.email ||
                        "Unknown user"}</strong
                    >
                    <small>{roleLabel(member.role)}</small>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </section>
    </main>
  </div>
</section>

<style>
  :global(body) {
    background: #f4f6f8;
  }

  .dashboard {
    max-width: 1160px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    color: #0f172a;
  }

  .eyebrow {
    font:
      600 0.75rem/1.2 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #64748b;
    margin: 0 0 0.5rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.6rem, 2.8vw, 2.3rem);
    line-height: 1.15;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
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
    margin-bottom: 1.4rem;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: white;
    text-decoration: none;
    border-radius: 0.7rem;
    padding: 0.6rem 0.9rem;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .btn-secondary {
    background: white;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .btn-danger {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    border-color: #991b1b;
    color: #fff;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(240px, 290px) 1fr;
    gap: 1rem;
  }

  .panel,
  .card {
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    background: white;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  }

  .panel {
    padding: 0.9rem;
    height: fit-content;
    position: sticky;
    top: 1rem;
  }

  .panel-head,
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    margin-bottom: 0.7rem;
  }

  .count,
  .plan {
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

  .workspace-list,
  .graphs,
  .members {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .workspace-list li a,
  .graphs li a,
  .members li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    text-decoration: none;
    color: inherit;
    padding: 0.62rem 0.55rem;
    border-radius: 0.75rem;
  }

  .workspace-list li.active a {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .workspace-list li a:hover,
  .graphs li a:hover {
    background: #f8fafc;
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

  .avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e2e8f0;
    color: #0f172a;
    font:
      700 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    flex-shrink: 0;
  }

  .avatar.small {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 0.68rem;
  }

  .content {
    display: grid;
    gap: 1rem;
  }

  .card {
    padding: 1rem;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7rem;
    margin-top: 0.7rem;
  }

  .stats article {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 0.75rem;
    padding: 0.7rem;
  }

  .stats p {
    margin: 0 0 0.25rem;
    color: #64748b;
    font-size: 0.82rem;
  }

  .stats strong {
    font-size: 1rem;
  }

  .graphs li + li {
    border-top: 1px dashed #e2e8f0;
  }

  .graphs strong,
  .members strong {
    display: block;
    margin-bottom: 0.1rem;
  }

  .graphs small,
  .members small {
    color: #64748b;
  }

  .link {
    color: #2563eb;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .link:hover {
    text-decoration: underline;
  }

  .empty {
    border: 1px dashed #cbd5e1;
    border-radius: 0.75rem;
    padding: 0.9rem;
    color: #475569;
  }

  .notice {
    margin: 0 0 0.85rem;
    border: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    border-radius: 0.7rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.9rem;
  }

  .workspace-crud-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workspace-form {
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 0.75rem;
    background: #f8fafc;
    display: grid;
    gap: 0.55rem;
    align-content: start;
  }

  .workspace-form h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  .workspace-form label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.84rem;
    color: #334155;
  }

  .workspace-form input,
  .workspace-form select {
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    padding: 0.5rem 0.6rem;
    font: inherit;
    color: #0f172a;
    background: #fff;
  }

  .workspace-form input:disabled,
  .workspace-form select:disabled,
  .workspace-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .workspace-form.danger {
    border-color: #fecaca;
    background: #fff7f7;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .panel {
      position: static;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .workspace-crud-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
