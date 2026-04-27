<script>
  let { result = null } = $props();
</script>

<div class="validator-panel">
  {#if !result}
    <div class="validator-empty">
      Click <b>Validate</b> to check your spec against the detected schema.
    </div>
  {:else if result.valid}
    <div class="validator-success">
      <span class="validator-icon">&#10003;</span>
      <div>
        <div class="validator-title">Valid</div>
        <div class="validator-subtitle">
          Detected: <b>{result.schemaType}</b>
        </div>
      </div>
    </div>
  {:else}
    <div class="validator-header-error">
      <span class="validator-icon error">&#10007;</span>
      <div>
        <div class="validator-title">
          {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
        </div>
        {#if result.schemaType !== "unknown"}
          <div class="validator-subtitle">
            Detected: <b>{result.schemaType}</b>
          </div>
        {/if}
      </div>
    </div>
    <div class="validator-errors">
      {#each result.errors as err}
        <div class="validator-error">
          {#if err.path}
            <span class="validator-path">{err.path}</span>
          {/if}
          <span class="validator-msg">{err.message}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .validator-panel {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .validator-empty {
    padding: 24px 8px;
    text-align: center;
    font-size: 12px;
    color: var(--muted, #666);
    line-height: 1.5;
  }

  .validator-success,
  .validator-header-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .validator-success {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .validator-header-error {
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .validator-icon {
    font-size: 18px;
    font-weight: 700;
    color: var(--green, #10b981);
  }
  .validator-icon.error {
    color: var(--danger, #ef4444);
  }

  .validator-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text, #222);
  }

  .validator-subtitle {
    font-size: 11px;
    color: var(--muted, #666);
    margin-top: 2px;
  }

  .validator-errors {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .validator-error {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-0, #f4f6f8);
    font-size: 11px;
    line-height: 1.4;
  }

  .validator-path {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(139, 92, 246, 0.1);
    color: var(--violet, #8b5cf6);
    font-weight: 600;
    font-size: 10px;
    margin-right: 6px;
  }

  .validator-msg {
    color: var(--text, #222);
  }
</style>
