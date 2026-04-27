<script>
  let { currentKey = "", onSave, onClose } = $props();

  let key = $state(currentKey);

  function handleSave() {
    onSave(key.trim());
  }

  function handleKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-label="Set OpenRouter API Key"
  >
    <div class="modal-header">
      <b>OpenRouter API Key</b>
      <button class="modal-close" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      <p>
        Paste your <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener">OpenRouter</a
        > API key. It's stored only in your browser's localStorage.
      </p>
      <input
        type="password"
        class="modal-input"
        placeholder="sk-or-..."
        bind:value={key}
        onkeydown={handleKeydown}
      />
      <p class="modal-hint">
        Default model: <code>qwen/qwen3.6-plus</code> (Claude Sonnet 4)
      </p>
    </div>

    <div class="modal-footer">
      <button class="modal-btn secondary" onclick={onClose}>Cancel</button>
      <button class="modal-btn primary" onclick={handleSave}>Save</button>
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
    width: min(420px, calc(100vw - 32px));
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
  .modal-body p {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--text, #222);
    line-height: 1.5;
  }
  .modal-body a {
    color: var(--cyan, #ff6d5a);
  }

  .modal-input {
    width: 100%;
    padding: 9px 11px;
    border: 1px solid var(--bg-2, #e0e4e8);
    border-radius: 8px;
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    font: inherit;
    font-size: 13px;
    outline: none;
  }
  .modal-input:focus {
    border-color: var(--cyan, #ff6d5a);
    box-shadow: 0 0 0 2px rgba(255, 109, 90, 0.15);
  }

  .modal-hint {
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted, #666);
  }
  .modal-hint code {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--bg-0, #f4f6f8);
    border: 1px solid var(--bg-2, #e0e4e8);
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
    background: var(--cyan, #ff6d5a);
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
