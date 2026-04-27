<script>
  import { runBenchmark, runMcpCall } from "$lib/play/benchmarkRunner.js";
  import { ingestRepositories } from "$lib/play/repoIngestor.js";
  import { analyzeRepositories } from "$lib/play/repoAnalyzer.js";
  import ActionConfigModal from "./ActionConfigModal.svelte";

  let {
    actions = [],
    mcpConnections = [],
    apiKey = "",
    repositories = [],
    selectedRun = null,
    onStatusMessage,
    onCycleComplete,
    onRunComplete,
    onContinueRun,
    onDeleteRun,
    onStopRun,
  } = $props();

  let runningActionId = $state(null);
  let progressMessage = $state("");
  let abortController = $state(null);
  let pendingAction = $state(null); // action awaiting config modal

  const ICONS = {
    play: "\u25B6",
    test: "\u2702",
    list: "\u2630",
    chart: "\u2587",
    ingest: "\u21E9",
    search: "\u2315",
    health: "\u2665",
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
    if (action.type === "repo-ingest") {
      return repositories.length > 0 && !!findConnection("graphonomous");
    }
    if (action.type === "repo-analyze") {
      return repositories.length > 0 && !!findConnection("graphonomous") && !!apiKey;
    }
    if (action.type === "graph-query" || action.type === "graph-health") {
      return !!findConnection("graphonomous");
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
    if (action.type === "repo-ingest") {
      if (repositories.length === 0) return `${action.description} (no repositories imported)`;
      if (!findConnection("graphonomous")) return `${action.description} (Graphonomous not connected)`;
    }
    if (action.type === "repo-analyze") {
      if (repositories.length === 0) return `${action.description} (no repositories imported)`;
      if (!findConnection("graphonomous")) return `${action.description} (Graphonomous not connected)`;
      if (!apiKey) return `${action.description} (API key required)`;
    }
    if (action.type === "graph-query" || action.type === "graph-health") {
      if (!findConnection("graphonomous")) return `${action.description} (Graphonomous not connected)`;
    }
    return action.description;
  }

  function handleContinueClick(run) {
    // Notify the page to set up liveRunId state
    onContinueRun?.(run);

    // Build a synthetic benchmark action and run it directly
    const startCycle = (run.cycles?.length || 0) + 1;
    const remainingCycles = Math.max(5, 10 - startCycle + 1);

    runAction({
      id: `continue-${run.id}`,
      type: "prism-benchmark",
      label: "Continue Run",
      params: {
        system_id: run.systemId || "auto",
        judge_model: run.judgeModel || "qwen/qwen3.6-plus",
        max_cycles: remainingCycles,
        target_repos: run.targetRepos || [],
      },
    });
  }

  function requestAction(action) {
    pendingAction = action;
  }

  function handleConfigClose() {
    pendingAction = null;
  }

  function handleConfigRun(configuredAction) {
    pendingAction = null;
    runAction(configuredAction);
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
          graphConnection: findConnection("graphonomous"),
          apiKey,
          judgeModel: action.params?.judge_model || "qwen/qwen3.6-plus",
          targetRepos: action.params?.target_repos || [],
          onMessage: emitMessage,
          onCycleComplete,
          onRunComplete,
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
          signal: ctrl.signal,
        });
      } else if (action.type === "repo-ingest") {
        const graphConn = findConnection("graphonomous");
        if (!graphConn) {
          emitMessage({ role: "action-error", content: "Graphonomous MCP server not connected." });
          return;
        }

        // Use selected repos from action params, or all repos
        const targetRepos = action.params?.target_repos?.length > 0
          ? repositories.filter((r) => action.params.target_repos.some(
              (t) => t.url === r.url && t.branch === r.branch
            ))
          : repositories;

        if (targetRepos.length === 0) {
          emitMessage({ role: "action-error", content: "No repositories to ingest." });
          return;
        }

        await ingestRepositories({
          repos: targetRepos,
          graphConnection: graphConn,
          maxFilesPerRepo: action.params?.max_files || 30,
          onMessage: emitMessage,
          signal: ctrl.signal,
        });
      } else if (action.type === "repo-analyze") {
        const graphConn = findConnection("graphonomous");
        if (!graphConn) {
          emitMessage({ role: "action-error", content: "Graphonomous MCP server not connected." });
          return;
        }

        const targetRepos = action.params?.target_repos?.length > 0
          ? repositories.filter((r) => action.params.target_repos.some(
              (t) => t.url === r.url && t.branch === r.branch
            ))
          : repositories;

        if (targetRepos.length === 0) {
          emitMessage({ role: "action-error", content: "No repositories to analyze." });
          return;
        }

        const result = await analyzeRepositories({
          repos: targetRepos,
          graphConnection: graphConn,
          apiKey,
          model: action.params?.model || "qwen/qwen3.6-plus",
          onMessage: emitMessage,
          signal: ctrl.signal,
        });

        // Emit the analysis as assistant-style content
        for (const r of result.repos) {
          if (r.analysis) {
            emitMessage({ role: "action-result", content: r.analysis });
          }
        }
      } else if (action.type === "graph-query") {
        const graphConn = findConnection("graphonomous");
        if (!graphConn) {
          emitMessage({ role: "action-error", content: "Graphonomous MCP server not connected." });
          return;
        }

        const query = action.params?.query;
        if (!query) {
          emitMessage({ role: "action-error", content: "No query specified. Configure the search query first." });
          return;
        }

        emitMessage({ role: "action-status", content: `Searching knowledge graph: "${query}"...` });

        const { callTool } = await import("$lib/play/mcp-client.js");
        const raw = await callTool(
          graphConn.url, graphConn.authHeader, "retrieve",
          { action: "context", query, limit: 10 },
          graphConn.sessionId, ctrl.signal,
        );

        const parsed = raw?.content?.find((c) => c.type === "text");
        let results;
        try { results = JSON.parse(parsed?.text || "{}"); } catch { results = raw; }

        const nodes = results?.results || [];
        if (nodes.length === 0) {
          emitMessage({ role: "action-status", content: "No results found in the knowledge graph." });
        } else {
          emitMessage({ role: "action-status", content: `Found ${nodes.length} relevant nodes. Synthesizing answer...` });

          // Build context from retrieved nodes
          const context = nodes.slice(0, 8).map((n, i) =>
            `[Source ${i + 1}] (${n.node_type}, confidence: ${(n.confidence || 0).toFixed(2)})\n${n.content?.substring(0, 1000) || "(empty)"}`
          ).join("\n\n---\n\n");

          // LLM synthesis
          try {
            const llmResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://bendscript.com/play",
                "X-Title": "BendScript Playground",
              },
              body: JSON.stringify({
                model: "qwen/qwen3.6-plus",
                messages: [
                  { role: "system", content: "You are a knowledge graph assistant. Answer the user's question using ONLY the retrieved knowledge below. Cite sources by number [1], [2], etc. Be concise and direct. If the knowledge doesn't contain the answer, say so." },
                  { role: "user", content: `Question: ${query}\n\n---\nRetrieved Knowledge:\n${context}` },
                ],
                max_tokens: 1024,
              }),
              signal: ctrl.signal,
            });

            if (!llmResp.ok) throw new Error(`LLM API ${llmResp.status}`);
            const llmData = await llmResp.json();
            const answer = llmData.choices?.[0]?.message?.content || "No answer generated.";

            const sourceSummary = nodes.slice(0, 8).map((n, i) =>
              `${i + 1}. *${n.node_type}* (score: ${(n.score || 0).toFixed(3)}) — ${n.source || "unknown"}`
            ).join("\n");

            emitMessage({
              role: "action-result",
              content: `${answer}\n\n---\n**Sources** (${nodes.length} nodes retrieved):\n${sourceSummary}`,
            });
          } catch (err) {
            if (err.name === "AbortError") throw err;
            // Fallback to raw results if LLM fails
            const summary = nodes.map((n, i) =>
              `**[${i + 1}]** (${n.node_type}, score: ${(n.score || 0).toFixed(2)}) ${n.content?.substring(0, 200)}...`
            ).join("\n\n");
            emitMessage({ role: "action-result", content: `## Knowledge Graph Results (${nodes.length})\n\n${summary}` });
          }
        }
      } else if (action.type === "graph-health") {
        const graphConn = findConnection("graphonomous");
        if (!graphConn) {
          emitMessage({ role: "action-error", content: "Graphonomous MCP server not connected." });
          return;
        }

        emitMessage({ role: "action-status", content: "Running graph health check..." });

        const { callTool } = await import("$lib/play/mcp-client.js");
        const raw = await callTool(
          graphConn.url, graphConn.authHeader, "consolidate",
          { action: "stats" },
          graphConn.sessionId, ctrl.signal,
        );

        const parsed = raw?.content?.find((c) => c.type === "text");
        let stats;
        try { stats = JSON.parse(parsed?.text || "{}"); } catch { stats = raw; }

        const lines = [
          `## Graph Health Report`,
          ``,
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Nodes | ${stats.node_count ?? "?"} |`,
          `| Edges | ${stats.edge_count ?? "?"} |`,
          `| Orphan nodes | ${stats.orphan_node_count ?? "?"} |`,
          `| Avg confidence | ${stats.avg_confidence != null ? stats.avg_confidence.toFixed(3) : "?"} |`,
          `| Min confidence | ${stats.min_confidence != null ? stats.min_confidence.toFixed(3) : "?"} |`,
          `| Max confidence | ${stats.max_confidence != null ? stats.max_confidence.toFixed(3) : "?"} |`,
        ];

        if (stats.type_distribution) {
          lines.push(``, `**Node types:** ${Object.entries(stats.type_distribution).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
        }
        if (stats.source_distribution) {
          lines.push(`**Sources:** ${Object.entries(stats.source_distribution).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
        }

        emitMessage({ role: "action-result", content: lines.join("\n") });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        emitMessage({ role: "action-status", content: "Stopped by user." });
      } else {
        emitMessage({ role: "action-error", content: err.message });
      }
    } finally {
      runningActionId = null;
      abortController = null;
      progressMessage = "";
    }
  }

  let confirmingDelete = $state(false);

  // Reset confirmation when selected run changes
  $effect(() => {
    selectedRun; // track dependency
    confirmingDelete = false;
  });

  function stopAction() {
    if (abortController) {
      // Active benchmark in this session — abort it
      abortController.abort();
    }
    // Always notify the page to finalize the run
    if (selectedRun) {
      onStopRun?.(selectedRun);
    }
  }

  function requestDelete(runId) {
    confirmingDelete = true;
  }

  function confirmDelete() {
    if (selectedRun) {
      onDeleteRun?.(selectedRun.id);
    }
    confirmingDelete = false;
  }

  function cancelDelete() {
    confirmingDelete = false;
  }
</script>

<div class="action-bar">
  {#if selectedRun}
    <!-- Benchmark run context actions -->
    <div class="action-buttons">
      {#if selectedRun.live}
        <button
          class="action-stop"
          onclick={stopAction}
          title="Stop the running benchmark"
        >
          <span class="action-icon">&#9632;</span>
          <span class="action-label">Stop Run</span>
        </button>
      {:else}
        <button
          class="action-btn action-btn-continue"
          onclick={() => handleContinueClick(selectedRun)}
          title="Continue this benchmark from cycle {(selectedRun.cycles?.length || 0) + 1}"
          disabled={!findConnection("os-prism")}
        >
          <span class="action-icon">&#9654;</span>
          <span class="action-label">Continue Run</span>
        </button>
      {/if}
      {#if confirmingDelete}
        <span class="action-confirm-group">
          <span class="action-confirm-label">Delete this run?</span>
          <button class="action-btn action-btn-confirm-yes" onclick={confirmDelete}>Yes</button>
          <button class="action-btn action-btn-confirm-no" onclick={cancelDelete}>No</button>
        </span>
      {:else}
        <button
          class="action-btn action-btn-delete"
          onclick={requestDelete}
          title="Delete this benchmark run"
        >
          <span class="action-icon">&times;</span>
          <span class="action-label">Delete Run</span>
        </button>
      {/if}
      <span class="action-run-info">
        {selectedRun.label} &mdash; {selectedRun.cycles?.length || 0} cycle{selectedRun.cycles?.length !== 1 ? "s" : ""}
      </span>
    </div>
    {#if selectedRun.live && runningActionId}
      <div class="action-running">
        <span class="action-progress">{progressMessage}</span>
      </div>
    {/if}
  {:else}
    <!-- Normal workspace actions -->
    <div class="action-buttons">
      {#each actions as action (action.id)}
        <button
          class="action-btn"
          class:running={runningActionId === action.id}
          class:unavailable={!canRun(action) && runningActionId !== action.id}
          disabled={!canRun(action) && runningActionId !== action.id}
          onclick={() => requestAction(action)}
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
        <button class="action-stop" onclick={stopAction} title="Stop">
          Stop
        </button>
      </div>
    {/if}
  {/if}
</div>

{#if pendingAction}
  <ActionConfigModal
    action={pendingAction}
    {repositories}
    onRun={handleConfigRun}
    onClose={handleConfigClose}
  />
{/if}

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

  .action-btn-continue:hover:not(:disabled) {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .action-btn-delete {
    border-color: rgba(239, 68, 68, 0.3) !important;
    color: #ef4444 !important;
  }
  .action-btn-delete:hover {
    border-color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.06) !important;
  }

  .action-confirm-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .action-confirm-label {
    font-size: 10px;
    color: #ef4444;
    font-weight: 600;
    white-space: nowrap;
  }

  .action-btn-confirm-yes {
    padding: 1px 8px !important;
    font-size: 10px !important;
    border-color: #ef4444 !important;
    color: #fff !important;
    background: #ef4444 !important;
  }
  .action-btn-confirm-yes:hover {
    background: #dc2626 !important;
  }

  .action-btn-confirm-no {
    padding: 1px 8px !important;
    font-size: 10px !important;
  }

  .action-run-info {
    font-size: 10px;
    color: var(--muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
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
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.06);
    color: #ef4444;
    font: inherit;
    font-size: 11px;
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
