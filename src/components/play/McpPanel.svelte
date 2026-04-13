<script>
  let {
    connections = [],
    onConnect,
    onDisconnect,
  } = $props();

  let url = $state("");
  let auth = $state("");
  let connecting = $state(false);
  let error = $state("");

  async function handleConnect() {
    if (!url.trim()) return;
    error = "";
    connecting = true;
    try {
      // Auto-prefix with "Bearer " if the token doesn't already have an auth scheme
      let authValue = auth.trim() || undefined;
      if (authValue && !authValue.match(/^(Bearer|Basic|Token)\s/i)) {
        authValue = `Bearer ${authValue}`;
      }
      await onConnect(url.trim(), authValue);
      url = "";
      auth = "";
    } catch (err) {
      error = err.message;
    } finally {
      connecting = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConnect();
    }
  }
</script>

<div class="mcp-panel">
  <div class="mcp-header">MCP Servers</div>

  {#if connections.length > 0}
    <div class="mcp-connections">
      {#each connections as conn}
        <div class="mcp-conn">
          <div class="mcp-conn-info">
            <span class="mcp-conn-name">{conn.name}</span>
            <span class="mcp-conn-version">v{conn.version}</span>
            <span class="mcp-conn-tools">{conn.tools.length} tools</span>
          </div>
          <button
            class="mcp-disconnect"
            onclick={() => onDisconnect(conn.id)}
            title="Disconnect"
          >
            &times;
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mcp-add">
    <input
      type="url"
      class="mcp-input"
      placeholder="https://mcp-server.example.com/api/mcp"
      bind:value={url}
      onkeydown={handleKeydown}
    />
    <input
      type="password"
      class="mcp-input mcp-auth-input"
      placeholder="Bearer token (optional)"
      bind:value={auth}
      onkeydown={handleKeydown}
    />
    <button
      class="mcp-connect-btn"
      onclick={handleConnect}
      disabled={connecting || !url.trim()}
    >
      {connecting ? "..." : "Connect"}
    </button>
  </div>

  {#if error}
    <div class="mcp-error">{error}</div>
  {/if}

  {#if connections.length === 0}
    <div class="mcp-hint">
      Connect MCP servers to give the LLM access to external tools
      (Graphonomous, BendScript graph, PRISM, etc.).
    </div>
  {/if}
</div>

<style>
  .mcp-panel {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mcp-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #666);
  }

  .mcp-connections {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mcp-conn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .mcp-conn-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .mcp-conn-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text, #222);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mcp-conn-version {
    font-size: 9px;
    color: var(--muted, #666);
  }

  .mcp-conn-tools {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.12);
    color: var(--green, #10b981);
    font-weight: 600;
    white-space: nowrap;
  }

  .mcp-disconnect {
    border: none;
    background: transparent;
    color: var(--muted, #666);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .mcp-disconnect:hover {
    color: var(--danger, #ef4444);
  }

  .mcp-add {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mcp-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--bg-2, #e0e4e8);
    border-radius: 6px;
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    font: inherit;
    font-size: 11px;
    outline: none;
    box-sizing: border-box;
  }
  .mcp-input:focus {
    border-color: var(--cyan, #ff6d5a);
    box-shadow: 0 0 0 2px rgba(255, 109, 90, 0.1);
  }

  .mcp-connect-btn {
    align-self: flex-end;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    color: var(--text, #222);
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }
  .mcp-connect-btn:hover:not(:disabled) {
    border-color: var(--cyan, #ff6d5a);
    color: var(--cyan, #ff6d5a);
  }
  .mcp-connect-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mcp-error {
    font-size: 10px;
    color: var(--danger, #ef4444);
    padding: 4px 0;
  }

  .mcp-hint {
    font-size: 10px;
    color: var(--muted, #666);
    line-height: 1.4;
  }
</style>
