<script>
  let { action, onRun, onClose } = $props();

  // Build editable config from action params
  let config = $state(buildConfig(action));

  function buildConfig(action) {
    if (action.type === "prism-benchmark") {
      return {
        max_cycles: action.params?.max_cycles || 10,
        judge_model: action.params?.judge_model || "qwen/qwen3.6-plus",
        system_id: action.params?.system_id || "auto",
        scenario_ids: (action.params?.scenario_ids || []).join(", "),
      };
    }
    if (action.type === "mcp-call") {
      return {
        tool_name: action.params?.tool_name || "",
        server_name: action.params?.server_name || "",
        args: JSON.stringify(action.params?.args || {}, null, 2),
      };
    }
    return {};
  }

  function handleRun() {
    const merged = { ...action.params };
    if (action.type === "prism-benchmark") {
      merged.max_cycles = parseInt(config.max_cycles, 10) || 10;
      merged.judge_model = config.judge_model.trim() || "qwen/qwen3.6-plus";
      merged.system_id = config.system_id.trim() || "auto";
      const ids = config.scenario_ids.trim();
      merged.scenario_ids = ids ? ids.split(/\s*,\s*/).filter(Boolean) : [];
    } else if (action.type === "mcp-call") {
      merged.tool_name = config.tool_name;
      merged.server_name = config.server_name;
      try {
        merged.args = JSON.parse(config.args);
      } catch {
        merged.args = action.params?.args || {};
      }
    }
    onRun({ ...action, params: merged });
  }

  function handleKeydown(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleRun();
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown} role="presentation">
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-label="Configure action"
  >
    <div class="modal-header">
      <b>{action.label}</b>
      <button class="modal-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      <p class="modal-desc">{action.description}</p>

      {#if action.type === "prism-benchmark"}
        <label class="config-field">
          <span class="config-label">Cycles</span>
          <input
            type="number"
            class="config-input config-input-sm"
            min="1"
            max="100"
            bind:value={config.max_cycles}
            onkeydown={handleKeydown}
          />
        </label>

        <label class="config-field">
          <span class="config-label">Judge model</span>
          <input
            type="text"
            class="config-input"
            placeholder="qwen/qwen3.6-plus"
            bind:value={config.judge_model}
            onkeydown={handleKeydown}
          />
        </label>

        <label class="config-field">
          <span class="config-label">System ID</span>
          <input
            type="text"
            class="config-input"
            placeholder="auto"
            bind:value={config.system_id}
            onkeydown={handleKeydown}
          />
        </label>

        <label class="config-field">
          <span class="config-label">Scenario IDs</span>
          <input
            type="text"
            class="config-input"
            placeholder="all (comma-separated to filter)"
            bind:value={config.scenario_ids}
            onkeydown={handleKeydown}
          />
        </label>
      {:else if action.type === "mcp-call"}
        <label class="config-field">
          <span class="config-label">Server</span>
          <input
            type="text"
            class="config-input"
            bind:value={config.server_name}
            readonly
          />
        </label>

        <label class="config-field">
          <span class="config-label">Tool</span>
          <input
            type="text"
            class="config-input"
            bind:value={config.tool_name}
            readonly
          />
        </label>

        <label class="config-field">
          <span class="config-label">Arguments (JSON)</span>
          <textarea
            class="config-input config-textarea"
            bind:value={config.args}
            onkeydown={handleKeydown}
          ></textarea>
        </label>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="modal-btn secondary" onclick={onClose}>Cancel</button>
      <button class="modal-btn primary" onclick={handleRun}>Run</button>
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
  .config-input[readonly] {
    opacity: 0.6;
    cursor: default;
  }

  .config-input-sm {
    width: 80px;
  }

  .config-textarea {
    min-height: 80px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
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
  .modal-btn.secondary {
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    border: 1px solid var(--bg-2, #e0e4e8);
  }
  .modal-btn.secondary:hover {
    background: var(--bg-2, #e0e4e8);
  }
</style>
