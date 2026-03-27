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

  const workspacePlans = ["free", "kag_api", "kag_teams", "enterprise"];
  const actionMessage = $derived(form?.message ?? "");
  const actionType = $derived(form?.action ?? "");

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
</script>

<svelte:head>
  <title>Workspaces — BendScript</title>
</svelte:head>

<section class="workspaces-page">
  <header class="topbar">
    <div>
      <p class="eyebrow">workspace management</p>
      <h1>Manage Workspaces</h1>
      <p class="muted">
        Use the main left sidebar to switch workspaces. This page manages the
        currently selected workspace.
      </p>
    </div>
    <div class="actions">
      <a class="btn btn-secondary" href="/dashboard">Back to dashboard</a>
      <a class="btn btn-secondary" href="/graphs">Manage graphs</a>
    </div>
  </header>

  {#if actionMessage}
    <p class="notice">{actionType}: {actionMessage}</p>
  {/if}

  <main class="content">
    <section class="card">
      <div class="card-head">
        <h2>Selected workspace</h2>
        <span class="plan">{activeWorkspace?.plan ?? "none"}</span>
      </div>

      {#if !activeWorkspace}
        <p class="muted">
          No workspace selected. Choose a workspace from the main sidebar.
        </p>
      {:else}
        <div class="stats">
          <article>
            <p>Name</p>
            <strong>{activeWorkspace.name}</strong>
          </article>
          <article>
            <p>Slug</p>
            <strong>{activeWorkspace.slug || "—"}</strong>
          </article>
          <article>
            <p>Updated</p>
            <strong>{formatDate(activeWorkspace.updated_at)}</strong>
          </article>
        </div>
      {/if}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Create workspace</h2>
      </div>

      <form method="POST" action="?/createWorkspace" class="workspace-form">
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
        <button class="btn" type="submit">Create workspace</button>
      </form>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Update selected workspace</h2>
      </div>

      <form method="POST" action="?/updateWorkspace" class="workspace-form">
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
    </section>

    <section class="card danger">
      <div class="card-head">
        <h2>Delete selected workspace</h2>
      </div>

      <form method="POST" action="?/deleteWorkspace" class="workspace-form">
        <input
          type="hidden"
          name="workspaceId"
          value={activeWorkspace?.id ?? ""}
        />
        <p class="muted">
          This permanently deletes the selected workspace. Type the exact
          workspace name to confirm.
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
    </section>
  </main>
</section>

<style>
  :global(body) {
    background: #f4f6f8;
    color: #0f172a;
  }

  .workspaces-page {
    max-width: 1160px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
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
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
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

  .workspace-form {
    display: grid;
    gap: 0.55rem;
    align-content: start;
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

  .notice {
    margin: 0 0 1rem;
    border: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    border-radius: 0.7rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.9rem;
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

  .card.danger {
    border-color: #fecaca;
  }

  @media (max-width: 900px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
