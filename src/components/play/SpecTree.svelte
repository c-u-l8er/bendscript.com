<script>
  import { SCHEMA_TYPES } from "$lib/play/validator.js";

  let { selectedSchemaType = "ampersand", onSelect, onLoadExample } = $props();

  const tree = [
    {
      label: "[&] Protocol",
      children: [
        { id: "ampersand", label: "Ampersand Spec", hasExample: true },
        { id: "capability-contract", label: "Capability Contract", hasExample: true },
        { id: "registry", label: "Registry", hasExample: true },
      ],
    },
    {
      label: "PULSE",
      children: [
        { id: "pulse", label: "Loop Manifest", hasExample: true },
      ],
    },
    {
      label: "PRISM",
      children: [
        { id: "prism", label: "Scenario", hasExample: true },
      ],
    },
  ];
</script>

<div class="spec-tree">
  <div class="spec-tree-header">Schemas</div>
  {#each tree as group}
    <div class="spec-group">
      <div class="spec-group-label">{group.label}</div>
      {#each group.children as item}
        <div class="spec-row" class:active={selectedSchemaType === item.id}>
          <button class="spec-item-btn" onclick={() => onSelect(item.id)}>
            {item.label}
          </button>
          {#if item.hasExample}
            <button
              class="spec-example-btn"
              onclick={() => onLoadExample(item.id)}
              title="Load example"
            >
              ex
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}

  <div class="spec-tree-footer">
    <span>Paste JSON to validate against the selected schema.</span>
  </div>
</div>

<style>
  .spec-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px 0;
    overflow-y: auto;
  }

  .spec-tree-header {
    padding: 4px 14px 8px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #666);
  }

  .spec-group {
    margin-bottom: 4px;
  }

  .spec-group-label {
    padding: 6px 14px 2px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text, #222);
  }

  .spec-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px 0 0;
  }
  .spec-row:hover {
    background: var(--bg-0, #f4f6f8);
  }
  .spec-row.active {
    background: rgba(255, 109, 90, 0.06);
  }

  .spec-item-btn {
    flex: 1;
    min-width: 0;
    padding: 5px 8px 5px 24px;
    border: none;
    background: transparent;
    color: var(--muted, #666);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.1s ease;
  }
  .spec-item-btn:hover {
    color: var(--text, #222);
  }
  .spec-row.active .spec-item-btn {
    color: var(--cyan, #ff6d5a);
    font-weight: 600;
  }

  .spec-example-btn {
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-0, #f4f6f8);
    color: var(--muted, #666);
    font: inherit;
    font-size: 9px;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .spec-example-btn:hover {
    border-color: var(--cyan, #ff6d5a);
    color: var(--cyan, #ff6d5a);
  }

  .spec-tree-footer {
    margin-top: auto;
    padding: 12px 14px;
    font-size: 10px;
    color: var(--muted, #666);
    line-height: 1.4;
  }
</style>
