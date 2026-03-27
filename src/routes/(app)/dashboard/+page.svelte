<script>
  let { data } = $props();

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
    return `/dashboard?workspace=${encodeURIComponent(workspaceId)}`;
  }

  function graphHref(graphId, workspaceId = activeWorkspaceId) {
    if (!graphId) return dashboardWorkspaceHref(workspaceId);
    const workspaceQuery = workspaceId
      ? `?workspace=${encodeURIComponent(workspaceId)}`
      : "";
    return `/graph/${graphId}${workspaceQuery}`;
  }

  function graphsWorkspaceHref(workspaceId = activeWorkspaceId) {
    if (!workspaceId) return "/graphs";
    return `/graphs?workspace=${encodeURIComponent(workspaceId)}`;
  }

  function workspacesWorkspaceHref(workspaceId = activeWorkspaceId) {
    if (!workspaceId) return "/workspaces";
    return `/workspaces?workspace=${encodeURIComponent(workspaceId)}`;
  }

  function openGraphHref(workspace = activeWorkspace) {
    const workspaceId = workspace?.id ?? null;
    const graphId = workspace?.defaultGraphId ?? null;
    if (!workspaceId) return "/graphs";
    if (!graphId) return graphsWorkspaceHref(workspaceId);
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
        Overview of your selected workspace. Use the main left sidebar to switch
        workspaces.
      </p>
    </div>

    <div class="actions">
      <a
        class="btn btn-secondary"
        href={openGraphHref(activeWorkspace)}
        data-sveltekit-preload-data="off"
        data-sveltekit-preload-code="off"
      >
        Open graph
      </a>
      <a
        class="btn btn-secondary"
        href={graphsWorkspaceHref(activeWorkspace?.id ?? null)}
      >
        Manage graphs
      </a>
      <a class="btn" href={workspacesWorkspaceHref(activeWorkspace?.id ?? null)}
        >Manage workspace</a
      >
    </div>
  </header>

  <main class="content">
    <section class="card">
      <div class="card-head">
        <h2>{activeWorkspace?.name ?? "No workspace selected"}</h2>
        <span class="plan">{activeWorkspace?.plan ?? "free"}</span>
      </div>

      {#if activeWorkspace}
        <div class="overview-links">
          <a
            class="overview-link"
            href={workspacesWorkspaceHref(activeWorkspace?.id ?? null)}
          >
            Manage this workspace
          </a>
          <a
            class="overview-link"
            href={graphsWorkspaceHref(activeWorkspace?.id ?? null)}
          >
            Manage graphs in this workspace
          </a>
        </div>
      {/if}

      <div class="stats">
        <article>
          <p>Members</p>
          <strong>{membersByWorkspace[activeWorkspace?.id]?.length ?? 0}</strong
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

    <section class="card">
      <div class="card-head">
        <h2>Recent graphs</h2>
        <a class="link" href={graphsWorkspaceHref(activeWorkspace?.id ?? null)}
          >Manage graphs</a
        >
      </div>

      {#if recentGraphs.length === 0}
        <p class="muted">
          No graphs yet. Use graph management to create or edit graphs for this
          workspace.
        </p>
      {:else}
        <ul class="graphs">
          {#each recentGraphs as graph}
            <li>
              <a
                href={graphHref(graph.id, activeWorkspace?.id ?? null)}
                data-sveltekit-preload-data="off"
                data-sveltekit-preload-code="off"
              >
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
      </div>

      {#if !activeWorkspace}
        <p class="muted">Select a workspace from the main sidebar.</p>
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
                    member?.profile?.full_name || member?.profile?.email || "U",
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
</section>

<style>
  :global(body) {
    margin: 0;
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

  .content {
    display: grid;
    gap: 1rem;
  }

  .card {
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    background: white;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
    padding: 1rem;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    margin-bottom: 0.7rem;
  }

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

  .overview-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 0.7rem;
  }

  .overview-link {
    display: inline-flex;
    align-items: center;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #1d4ed8;
    text-decoration: none;
    border-radius: 999px;
    padding: 0.35rem 0.65rem;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .overview-link:hover {
    text-decoration: underline;
    background: #eff6ff;
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

  .graphs,
  .members {
    list-style: none;
    padding: 0;
    margin: 0;
  }

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

  .graphs li a:hover {
    background: #f8fafc;
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

  .link {
    color: #2563eb;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .link:hover {
    text-decoration: underline;
  }

  @media (max-width: 900px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
