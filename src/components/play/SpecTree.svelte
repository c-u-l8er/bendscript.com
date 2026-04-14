<script>
  import { WORKSPACES } from "$lib/play/workspaces/index.js";

  let {
    selectedSchemaType = "ampersand",
    selectedExampleId = "",
    selectedFileKey = "",
    onSelect,
    onLoadExample,
    onLoadJson,
  } = $props();

  // Track which tree nodes are expanded: "ws:<id>", "ws:<id>/schemas", "ws:<id>/examples"
  let expanded = $state({
    "ws:ampersand-protocol": true,
    "ws:ampersand-protocol/examples": true,
  });

  function toggle(key) {
    expanded = { ...expanded, [key]: !expanded[key] };
  }
</script>

<div class="file-tree">
  <div class="ft-header">WORKSPACES</div>

  {#each WORKSPACES as ws}
    {@const wsKey = `ws:${ws.id}`}
    {@const hasSchemas = ws.schemaFiles.length > 0}
    {@const hasExamples = ws.examples.length > 0}
    {@const hasActions = ws.actions?.length > 0}

    <!-- Workspace folder -->
    <button
      class="ft-row ft-folder depth-0"
      class:demo={ws.isDemo}
      onclick={() => toggle(wsKey)}
      title={ws.description}
    >
      <span class="ft-chevron" class:open={expanded[wsKey]}></span>
      <span class="ft-icon ft-icon-folder" class:open={expanded[wsKey]}></span>
      <span class="ft-name">{ws.id}</span>
    </button>

    {#if expanded[wsKey]}
      <!-- meta.json -->
      <button
        class="ft-row ft-file depth-1 ft-meta"
        class:selected={selectedFileKey === `${ws.id}/meta.json`}
        onclick={() => onLoadJson(`${ws.id}/meta.json`, { label: ws.label, description: ws.description, isDemo: ws.isDemo, order: ws.order })}
      >
        <span class="ft-icon ft-icon-json"></span>
        <span class="ft-name">meta.json</span>
      </button>

      <!-- schemas/ folder -->
      {#if hasSchemas}
        <button
          class="ft-row ft-folder depth-1"
          onclick={() => toggle(`${wsKey}/schemas`)}
        >
          <span class="ft-chevron" class:open={expanded[`${wsKey}/schemas`]}></span>
          <span class="ft-icon ft-icon-folder" class:open={expanded[`${wsKey}/schemas`]}></span>
          <span class="ft-name">schemas</span>
        </button>

        {#if expanded[`${wsKey}/schemas`]}
          {#each ws.schemaFiles as sf}
            <button
              class="ft-row ft-file depth-2 ft-schema"
              class:selected={selectedFileKey === `${ws.id}/schemas/${sf.filename}`}
              onclick={() => onLoadJson(`${ws.id}/schemas/${sf.filename}`, sf.data)}
            >
              <span class="ft-icon ft-icon-schema"></span>
              <span class="ft-name">{sf.filename}</span>
            </button>
          {/each}
        {/if}
      {/if}

      <!-- examples/ folder -->
      {#if hasExamples}
        <button
          class="ft-row ft-folder depth-1"
          onclick={() => toggle(`${wsKey}/examples`)}
        >
          <span class="ft-chevron" class:open={expanded[`${wsKey}/examples`]}></span>
          <span class="ft-icon ft-icon-folder" class:open={expanded[`${wsKey}/examples`]}></span>
          <span class="ft-name">examples</span>
        </button>

        {#if expanded[`${wsKey}/examples`]}
          {#each ws.examples as ex}
            <button
              class="ft-row ft-file depth-2"
              class:selected={selectedExampleId === ex.id}
              onclick={() => onLoadExample(ex.id)}
            >
              <span class="ft-icon ft-icon-json"></span>
              <span class="ft-name">{ex.filename}</span>
            </button>
          {/each}
        {/if}
      {/if}

      <!-- actions.json -->
      {#if hasActions}
        <button
          class="ft-row ft-file depth-1 ft-action"
          class:selected={selectedFileKey === `${ws.id}/actions.json`}
          onclick={() => onLoadJson(`${ws.id}/actions.json`, ws.actions)}
        >
          <span class="ft-icon ft-icon-action"></span>
          <span class="ft-name">actions.json</span>
        </button>
      {/if}
    {/if}
  {/each}
</div>

<style>
  .file-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1;
    user-select: none;
    padding: 4px 0;
  }

  .ft-header {
    padding: 6px 12px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #888;
  }

  /* ── Row base ── */
  .ft-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 22px;
    padding: 0 8px;
    border: none;
    background: transparent;
    color: #ccc;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .ft-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  /* ── Depth indentation ── */
  .depth-0 { padding-left: 8px; }
  .depth-1 { padding-left: 24px; }
  .depth-2 { padding-left: 40px; }

  /* ── Chevron ── */
  .ft-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    font-size: 10px;
    color: #888;
    transition: transform 0.1s ease;
  }
  .ft-chevron::before {
    content: "\25B8";
  }
  .ft-chevron.open {
    transform: rotate(90deg);
  }

  /* ── Icons ── */
  .ft-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    font-size: 14px;
  }

  .ft-icon-folder::before {
    content: "\1F4C1";
    font-size: 13px;
    filter: saturate(0.7);
  }
  .ft-icon-folder.open::before {
    content: "\1F4C2";
  }

  .ft-icon-json::before {
    content: "{ }";
    font-size: 8px;
    font-weight: 700;
    color: #e8ab53;
    letter-spacing: -1px;
  }

  .ft-icon-schema::before {
    content: "{ }";
    font-size: 8px;
    font-weight: 700;
    color: #56b6c2;
    letter-spacing: -1px;
  }

  .ft-icon-action::before {
    content: "\25B6";
    font-size: 9px;
    color: #10b981;
  }

  .ft-file.ft-action .ft-name {
    color: #10b981;
  }

  /* ── Name text ── */
  .ft-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Folder styling ── */
  .ft-folder .ft-name {
    font-weight: 600;
  }
  .ft-folder.demo .ft-name {
    color: #ff6d5a;
  }

  /* ── File styling ── */
  .ft-file .ft-name {
    font-weight: 400;
  }
  .ft-file.ft-meta .ft-name {
    color: #999;
  }
  .ft-file.ft-schema .ft-name {
    color: #56b6c2;
  }

  /* ── Selected state ── */
  .ft-file.selected {
    background: rgba(255, 109, 90, 0.12);
  }
  .ft-file.selected .ft-name {
    color: #ff6d5a;
    font-weight: 600;
  }
</style>
