<script>
  let { onImport, onClose } = $props();

  let repoUrl = $state("");
  let branch = $state("main");
  let loading = $state(false);
  let error = $state("");

  function parseGitHubUrl(url) {
    const trimmed = url.trim().replace(/\/+$/, "").replace(/\.git$/, "");
    const match = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  }

  async function fetchRepoTree(owner, repo, branchName) {
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branchName}?recursive=1`
    );
    if (!resp.ok) {
      if (resp.status === 404) throw new Error("Repository or branch not found");
      throw new Error(`GitHub API error (${resp.status})`);
    }
    const data = await resp.json();
    return (data.tree || [])
      .filter((e) => e.type === "blob" || e.type === "tree")
      .map((e) => ({ path: e.path, type: e.type, size: e.size || 0 }));
  }

  async function handleImport() {
    error = "";
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      error = "Enter a valid GitHub URL (e.g. https://github.com/owner/repo)";
      return;
    }

    loading = true;
    try {
      const tree = await fetchRepoTree(parsed.owner, parsed.repo, branch);
      onImport({
        url: `https://github.com/${parsed.owner}/${parsed.repo}`,
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        tree,
        importedAt: Date.now(),
      });
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleImport();
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown} role="presentation">
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-label="Import repository"
  >
    <div class="modal-header">
      <b>Import Repository</b>
      <button class="modal-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      <p class="modal-desc">Import a public GitHub repository to browse its files and use as a benchmark target.</p>

      <label class="config-field">
        <span class="config-label">GitHub URL</span>
        <input
          type="text"
          class="config-input"
          placeholder="https://github.com/owner/repo"
          bind:value={repoUrl}
          onkeydown={handleKeydown}
          disabled={loading}
        />
      </label>

      <label class="config-field">
        <span class="config-label">Branch</span>
        <input
          type="text"
          class="config-input config-input-sm"
          placeholder="main"
          bind:value={branch}
          onkeydown={handleKeydown}
          disabled={loading}
        />
      </label>

      {#if error}
        <p class="modal-error">{error}</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="modal-btn secondary" onclick={onClose} disabled={loading}>Cancel</button>
      <button class="modal-btn primary" onclick={handleImport} disabled={loading}>
        {loading ? "Importing..." : "Import"}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.36);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    width: min(460px, calc(100vw - 32px));
    border-radius: 12px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bg-2, #e0e4e8);
    font-size: 13px;
  }

  .modal-close {
    border: none;
    background: transparent;
    font-size: 18px;
    cursor: pointer;
    color: var(--muted, #666);
    padding: 0 4px;
    line-height: 1;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-desc {
    margin: 0 0 14px;
    font-size: 12px;
    color: var(--muted, #666);
    line-height: 1.5;
  }

  .modal-error {
    margin: 8px 0 0;
    font-size: 12px;
    color: #ef4444;
  }

  .config-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .config-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text, #222);
    letter-spacing: 0.02em;
  }

  .config-input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--bg-2, #e0e4e8);
    border-radius: 8px;
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    font: inherit;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }
  .config-input:focus {
    border-color: var(--cyan, #ff6d5a);
    box-shadow: 0 0 0 2px rgba(255, 109, 90, 0.15);
  }

  .config-input-sm {
    width: 120px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--bg-2, #e0e4e8);
  }

  .modal-btn {
    padding: 6px 16px;
    border-radius: 999px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: filter 0.15s ease;
  }
  .modal-btn.primary {
    background: var(--green, #10b981);
    color: #fff;
  }
  .modal-btn.primary:hover {
    filter: brightness(1.1);
  }
  .modal-btn.primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .modal-btn.secondary {
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    border: 1px solid var(--bg-2, #e0e4e8);
  }
  .modal-btn.secondary:hover {
    background: var(--bg-2, #e0e4e8);
  }
</style>
