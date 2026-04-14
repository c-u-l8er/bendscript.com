<script>
  import { runBenchmark, runMcpCall } from "$lib/play/benchmarkRunner.js";

  let {
    actions = [],
    mcpConnections = [],
    apiKey = "",
    onStatusMessage,
  } = $props();

  let runningActionId = $state(null);
  let progressMessage = $state("");
  let abortController = $state(null);

  const ICONS = {
    play: "\u25B6",
    test: "\u2702",
    list: "\u2630",
    chart: "\u2587",
  };

  function iconFor(icon) {
    return ICONS[icon] || ICONS.play;
  }

  function findConnection(serverName) {
    return mcpConnections.find((c) => c.name === serverName);
  }

  function canRun(action) {
    if (runningActionId) return false;
    if (action.type === "prism-benchmark") {
      return !!findConnection("os-prism");
    }
    if (action.type === "mcp-call") {
      return !!findConnection(action.params?.server_name);
    }
    return false;
  }

  function tooltip(action) {
    if (runningActionId === action.id) return "Running...";
    if (action.type === "prism-benchmark" && !findConnection("os-prism")) {
      return `${action.description} (PRISM server not connected)`;
    }
    if (action.type === "mcp-call" && !findConnection(action.params?.server_name)) {
      return `${action.description} (${action.params?.server_name} not connected)`;
    }
    return action.description;
  }

  async function runAction(action) {
    const ctrl = new AbortController();
    abortController = ctrl;
    runningActionId = action.id;
    progressMessage = "Starting...";

    const emitMessage = (msg) => {
      if (msg.role === "action-status") progressMessage = msg.content;
      onStatusMessage?.(msg);
    };

    try {
      if (action.type === "prism-benchmark") {
        const prismConn = findConnection("os-prism");
        if (!prismConn) {
          emitMessage({ role: "action-error", content: "PRISM MCP server not connected." });
          return;
        }

        await runBenchmark({
          systemId: action.params?.system_id || "auto",
          scenarioIds: action.params?.scenario_ids || [],
          maxCycles: action.params?.max_cycles || 10,
          prismConnection: prismConn,
          apiKey,
          judgeModel: action.params?.judge_model || "qwen/qwen3.6-plus",
          onMessage: emitMessage,
          signal: ctrl.signal,
        });
      } else if (action.type === "mcp-call") {
        const conn = findConnection(action.params?.server_name);
        if (!conn) {
          emitMessage({ role: "action-error", content: `${action.params?.server_name} not connected.` });
          return;
        }

        await runMcpCall({
          toolName: action.params?.tool_name,
          args: action.params?.args || {},
          connection: conn,
          onMessage: emitMessage,
        });
      }
    } catch (err) {
      emitMessage({ role: "action-error", content: err.message });
    } finally {
      runningActionId = null;
      abortController = null;
      progressMessage = "";
    }
  }

  function stopAction() {
    abortController?.abort();
  }
</script>

<div class="action-bar">
  <div class="action-buttons">
    {#each actions as action (action.id)}
      <button
        class="action-btn"
        class:running={runningActionId === action.id}
        class:unavailable={!canRun(action) && runningActionId !== action.id}
        disabled={!canRun(action) && runningActionId !== action.id}
        onclick={() => runAction(action)}
        title={tooltip(action)}
      >
        <span class="action-icon">{iconFor(action.icon)}</span>
        <span class="action-label">{action.label}</span>
      </button>
    {/each}
  </div>

  {#if runningActionId}
    <div class="action-running">
      <span class="action-progress">{progressMessage}</span>
      <button class="action-stop" onclick={stopAction} title="Stop benchmark">
        Stop
      </button>
    </div>
  {/if}
</div>

<style>
  .action-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    min-height: 32px;
  }

  .action-buttons {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    color: var(--text, #222);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
    white-space: nowrap;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--green, #10b981);
    color: var(--green, #10b981);
  }

  .action-btn.running {
    border-color: var(--green, #10b981);
    background: rgba(16, 185, 129, 0.08);
    color: var(--green, #10b981);
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  .action-btn.unavailable {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn:disabled {
    cursor: not-allowed;
  }

  .action-icon {
    font-size: 10px;
  }

  .action-running {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .action-progress {
    font-size: 10px;
    color: var(--muted, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .action-stop {
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.06);
    color: #ef4444;
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease;
  }

  .action-stop:hover {
    background: rgba(239, 68, 68, 0.12);
  }

  @keyframes pulse-border {
    0%, 100% { border-color: var(--green, #10b981); }
    50% { border-color: rgba(16, 185, 129, 0.3); }
  }
</style>
