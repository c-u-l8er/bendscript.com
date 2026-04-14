<script>
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import SpecTree from "../../components/play/SpecTree.svelte";
  import ValidatorPanel from "../../components/play/ValidatorPanel.svelte";
  import LlmChat from "../../components/play/LlmChat.svelte";
  import ApiKeyModal from "../../components/play/ApiKeyModal.svelte";
  import McpPanel from "../../components/play/McpPanel.svelte";
  import ActionBar from "../../components/play/ActionBar.svelte";
  import { validateSpec, SCHEMA_TYPES } from "$lib/play/validator.js";
  import { mcpToolsToOpenAI } from "$lib/play/tools.js";
  import { discoverTools, discoverLocalTools } from "$lib/play/mcp-client.js";
  import RepoImportModal from "../../components/play/RepoImportModal.svelte";
  import {
    saveGuestState,
    loadGuestState,
    loadApiKey,
    saveApiKey,
    loadMcpConnections,
    saveMcpConnections,
    loadRepositories,
    saveRepositories,
    saveBenchmarkRuns,
    loadBenchmarkRuns,
  } from "$lib/play/storage.js";
  import { DEFAULT_MCP_SERVERS } from "$lib/play/default-servers.js";
  import { WORKSPACES, EXAMPLES_BY_ID, getDefaultExample } from "$lib/play/workspaces/index.js";

  let { data } = $props();

  // Editor state
  let editorContent = $state("");
  let editorContainer = $state(null);

  // Raw references — not wrapped in $state to avoid proxy issues with Monaco API
  let editorInstance = null;
  let monacoModule = null;

  // Validation state
  let validationResult = $state(null);
  let selectedSchemaType = $state("ampersand");
  let selectedExampleId = $state("");
  let selectedFileKey = $state("");

  // LLM state
  let apiKey = $state("");
  let showApiKeyModal = $state(false);
  let chatMessages = $state([]);

  // Right panel tab
  let rightTab = $state("validator"); // "validator" | "chat" | "mcp"

  // MCP state
  let mcpConnections = $state([]);
  let mcpTools = $state([]); // OpenAI-format tool defs from all connected servers

  // Repository state
  let repositories = $state([]);
  let showRepoImportModal = $state(false);

  // Benchmark runs state — accumulated across the session
  // Each run: { id, label, systemId, judgeModel, targetRepos, cycles: [...], leaderboard, completedAt }
  let benchmarkRuns = $state([]);
  let currentRunCycles = $state([]); // cycles for the in-progress run
  let liveRunId = $state(null); // ID of the run being built incrementally
  let selectedRun = $state(null); // currently selected benchmark run (for continue/delete)

  // Derive active workspace actions from current selection
  let activeActions = $derived.by(() => {
    if (selectedExampleId) {
      const entry = EXAMPLES_BY_ID[selectedExampleId];
      if (entry) {
        const ws = WORKSPACES.find((w) => w.id === entry.workspaceId);
        if (ws?.actions?.length) return ws.actions;
      }
    }
    if (selectedFileKey) {
      const wsId = selectedFileKey.split("/")[0];
      const ws = WORKSPACES.find((w) => w.id === wsId);
      if (ws?.actions?.length) return ws.actions;
    }
    return [];
  });

  function handleActionStatus(msg) {
    chatMessages = [...chatMessages, msg];
    // Auto-switch to chat tab so user sees progress
    if (rightTab !== "chat") rightTab = "chat";
  }

  function handleCycleComplete(cycleResult) {
    currentRunCycles = [...currentRunCycles, cycleResult];

    if (!liveRunId) {
      // First cycle — create a new live run entry
      liveRunId = `run-${Date.now()}`;
      const runNumber = benchmarkRuns.length + 1;
      benchmarkRuns = [...benchmarkRuns, {
        id: liveRunId,
        label: `Run ${runNumber} (running...)`,
        systemId: "",
        judgeModel: "",
        targetRepos: [],
        cycles: [cycleResult],
        leaderboard: [],
        success: true,
        live: true,
        completedAt: null,
      }];
    } else {
      // Subsequent cycles — update the live run in-place
      benchmarkRuns = benchmarkRuns.map((r) =>
        r.id === liveRunId
          ? { ...r, cycles: [...r.cycles, cycleResult] }
          : r
      );
    }
    // Persist incrementally
    saveBenchmarkRuns(benchmarkRuns);
  }

  function handleRunComplete(runResult) {
    const cycleCount = runResult.cycles?.length || 0;

    if (liveRunId) {
      // Finalize the live run with complete data
      const runNumber = benchmarkRuns.findIndex((r) => r.id === liveRunId) + 1;
      benchmarkRuns = benchmarkRuns.map((r) =>
        r.id === liveRunId
          ? {
              ...r,
              label: `Run ${runNumber} (${cycleCount} cycle${cycleCount !== 1 ? "s" : ""})`,
              systemId: runResult.systemId,
              judgeModel: runResult.judgeModel,
              targetRepos: runResult.targetRepos || [],
              cycles: runResult.cycles || [],
              leaderboard: runResult.leaderboard || [],
              success: runResult.success,
              error: runResult.error,
              live: false,
              completedAt: runResult.completedAt || Date.now(),
            }
          : r
      );
    } else {
      // No cycles were emitted (edge case) — create the run from scratch
      const runId = `run-${Date.now()}`;
      const label = `Run ${benchmarkRuns.length + 1} (${cycleCount} cycle${cycleCount !== 1 ? "s" : ""})`;
      benchmarkRuns = [...benchmarkRuns, {
        id: runId,
        label,
        systemId: runResult.systemId,
        judgeModel: runResult.judgeModel,
        targetRepos: runResult.targetRepos || [],
        cycles: runResult.cycles || [],
        leaderboard: runResult.leaderboard || [],
        success: runResult.success,
        error: runResult.error,
        completedAt: runResult.completedAt || Date.now(),
      }];
    }

    liveRunId = null;
    currentRunCycles = [];
    selectedRun = null;
    saveBenchmarkRuns(benchmarkRuns);
  }

  function handleSelectRun(run) {
    // Toggle selection — if clicking the already-selected run, deselect
    selectedRun = selectedRun?.id === run.id ? null : run;
  }

  function handleContinueRun(run) {
    if (!run || run.live) return;

    // Set this run as the live run so new cycles append to it
    liveRunId = run.id;
    currentRunCycles = [...(run.cycles || [])];

    // Mark as live again
    benchmarkRuns = benchmarkRuns.map((r) =>
      r.id === run.id
        ? { ...r, live: true, label: r.label.replace(/\(.*\)/, "(running...)") }
        : r
    );
    saveBenchmarkRuns(benchmarkRuns);
    selectedRun = null;
  }

  function handleStopRun(run) {
    if (!run) return;

    const cycleCount = run.cycles?.length || 0;
    const runNumber = benchmarkRuns.findIndex((r) => r.id === run.id) + 1;

    // Finalize the run as stopped
    benchmarkRuns = benchmarkRuns.map((r) =>
      r.id === run.id
        ? {
            ...r,
            label: `Run ${runNumber} (${cycleCount} cycle${cycleCount !== 1 ? "s" : ""}, stopped)`,
            live: false,
            success: false,
            error: "Stopped by user",
            completedAt: r.completedAt || Date.now(),
          }
        : r
    );

    // Clear live tracking if this was the active run
    if (liveRunId === run.id) {
      liveRunId = null;
      currentRunCycles = [];
    }
    selectedRun = null;
    saveBenchmarkRuns(benchmarkRuns);
  }

  function handleDeleteRun(runId) {
    benchmarkRuns = benchmarkRuns.filter((r) => r.id !== runId);
    if (selectedRun?.id === runId) selectedRun = null;
    saveBenchmarkRuns(benchmarkRuns);
  }

  // Legacy schema-type → example mapping (for header buttons + tools)
  const EXAMPLES = {
    ampersand: getDefaultExample("ampersand"),
    "capability-contract": getDefaultExample("capability-contract"),
    registry: getDefaultExample("registry"),
    pulse: getDefaultExample("pulse"),
    prism: getDefaultExample("prism"),
  };

  // Load guest state on mount
  onMount(async () => {
    // Restore guest state, or pre-fill with default example
    const saved = loadGuestState();
    if (saved && saved.editorContent) {
      editorContent = saved.editorContent;
      selectedSchemaType = saved.schemaType || "ampersand";
    } else {
      editorContent = EXAMPLES.ampersand;
    }

    // Restore API key
    apiKey = loadApiKey();

    // Restore benchmark runs
    benchmarkRuns = loadBenchmarkRuns();

    // Restore imported repositories (metadata only — re-fetch trees in background)
    const savedRepos = loadRepositories();
    if (savedRepos.length > 0) {
      repositories = savedRepos; // Show immediately without trees
      // Fetch trees in background
      Promise.all(
        savedRepos.map(async (repo) => {
          try {
            const resp = await fetch(
              `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${repo.branch}?recursive=1`
            );
            if (!resp.ok) return repo;
            const data = await resp.json();
            return {
              ...repo,
              tree: (data.tree || [])
                .filter((e) => e.type === "blob" || e.type === "tree")
                .map((e) => ({ path: e.path, type: e.type, size: e.size || 0 })),
            };
          } catch {
            return repo;
          }
        })
      ).then((reposWithTrees) => {
        repositories = reposWithTrees;
      });
    }

    // Connect BendScript's own MCP endpoint first (same origin, no proxy)
    const localMcpUrl = `${window.location.origin}/api/mcp`;
    try {
      const info = await discoverLocalTools();
      const tools = mcpToolsToOpenAI(info.name, info.tools);
      mcpConnections = [...mcpConnections, {
        id: localMcpUrl, url: localMcpUrl, authHeader: undefined,
        name: info.name, version: info.version,
        tools: info.tools, openaiTools: tools,
        sessionId: info.sessionId, isLocal: true,
      }];
      mcpTools = mcpConnections.flatMap((c) => c.openaiTools);
    } catch {
      // Local MCP may not be available (e.g. missing Supabase)
    }

    // Restore saved MCP connections + auto-connect defaults
    const savedConns = loadMcpConnections();
    const savedUrls = new Set(savedConns.map((c) => c.url));

    // Merge defaults with saved connections (defaults first, then any custom)
    // Filter out any saved localhost connections (handled by local discovery above)
    const allConns = [
      ...DEFAULT_MCP_SERVERS
        .filter((d) => !savedUrls.has(d.url))
        .map((d) => ({ url: d.url, authHeader: undefined })),
      ...savedConns.filter((c) => !c.url.includes("/api/mcp")),
    ];

    for (const conn of allConns) {
      try {
        const info = await discoverTools(conn.url, conn.authHeader);
        const id = conn.url;
        const tools = mcpToolsToOpenAI(info.name, info.tools);
        mcpConnections = [...mcpConnections, {
          id, url: conn.url, authHeader: conn.authHeader,
          name: info.name, version: info.version,
          tools: info.tools, openaiTools: tools,
          sessionId: info.sessionId,
        }];
        mcpTools = mcpConnections.flatMap((c) => c.openaiTools);
      } catch {
        // Skip failed connections silently (server may not be deployed yet)
      }
    }

    // Lazy-load Monaco with worker setup
    const monaco = await import("monaco-editor");
    monacoModule = monaco;

    // Configure Monaco workers to use blob URLs (avoids CSP / worker path issues)
    self.MonacoEnvironment = {
      getWorker(_, label) {
        const getWorkerModule = (url, options) =>
          new Worker(url, { type: "module", ...options });

        if (label === "json") {
          return getWorkerModule(
            new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url),
            { name: label },
          );
        }
        return getWorkerModule(
          new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
          { name: label },
        );
      },
    };

    if (editorContainer) {
      editorInstance = monaco.editor.create(editorContainer, {
        value: editorContent,
        language: "json",
        theme: "vs",
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        lineNumbers: "on",
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 8 },
      });

      editorInstance.onDidChangeModelContent(() => {
        editorContent = editorInstance.getValue();
        autoSave();
      });
    }

    return () => {
      if (editorInstance) {
        editorInstance.dispose();
      }
    };
  });

  function autoSave() {
    if (!data.isGuest) return; // signed-in users save to Supabase (future)
    saveGuestState({
      editorContent,
      schemaType: selectedSchemaType,
    });
  }

  function handleValidate() {
    if (!editorContent.trim()) {
      validationResult = null;
      return;
    }
    validationResult = validateSpec(editorContent);
  }

  function handleSchemaSelect(schemaId) {
    selectedSchemaType = schemaId;
    selectedRun = null;
    const example = EXAMPLES[schemaId] || "{}";
    editorContent = example;
    if (editorInstance) {
      editorInstance.setValue(example);
      editorInstance.layout();
    }
    validationResult = null;
    autoSave();
  }

  function handleLoadExample(exampleOrSchemaId) {
    // Support both workspace example IDs and legacy schema-type IDs
    const byId = EXAMPLES_BY_ID[exampleOrSchemaId];
    let content, schemaType;
    if (byId) {
      content = JSON.stringify(byId.data, null, 2);
      schemaType = byId.schemaType;
      selectedExampleId = exampleOrSchemaId;
      selectedFileKey = "";
    } else {
      content = EXAMPLES[exampleOrSchemaId] || "{}";
      schemaType = exampleOrSchemaId;
      selectedExampleId = "";
      selectedFileKey = "";
    }

    editorContent = content;
    selectedSchemaType = schemaType;
    selectedRun = null;
    validationResult = null;

    if (editorInstance) {
      editorInstance.setValue(content);
      editorInstance.layout();
    }
    autoSave();
  }

  function handleLoadJson(fileKey, data) {
    const content = JSON.stringify(data, null, 2);
    editorContent = content;
    selectedFileKey = fileKey;
    selectedExampleId = "";
    // Only clear selectedRun when navigating away from benchmark items
    if (!fileKey.startsWith("bench:")) selectedRun = null;
    validationResult = null;

    if (editorInstance) {
      editorInstance.setValue(content);
      // Switch Monaco language to JSON
      if (monacoModule) {
        monacoModule.editor.setModelLanguage(editorInstance.getModel(), "json");
      }
      editorInstance.layout();
    }
    autoSave();
  }

  function handleLoadText(fileKey, text) {
    editorContent = text;
    selectedFileKey = fileKey;
    selectedExampleId = "";
    // Only clear selectedRun when navigating away from benchmark items
    if (!fileKey.startsWith("bench:")) selectedRun = null;
    validationResult = null;

    if (editorInstance) {
      editorInstance.setValue(text);
      // Switch Monaco language to markdown for .md files
      if (monacoModule) {
        const lang = fileKey.endsWith("-md") ? "markdown" : "plaintext";
        monacoModule.editor.setModelLanguage(editorInstance.getModel(), lang);
      }
      editorInstance.layout();
    }
    autoSave();
  }

  function handleReset() {
    const example = EXAMPLES[selectedSchemaType] || EXAMPLES.ampersand;
    editorContent = example;
    validationResult = null;

    if (editorInstance) {
      editorInstance.setValue(example);
      editorInstance.layout();
    }
    autoSave();
  }

  function handleApiKeySave(key) {
    apiKey = key;
    saveApiKey(key);
    showApiKeyModal = false;
  }

  function handleRepoImport(repo) {
    // Deduplicate by URL
    if (repositories.some((r) => r.url === repo.url && r.branch === repo.branch)) return;
    repositories = [...repositories, repo];
    // Persist without the full tree (too large for localStorage)
    saveRepositories(repositories.map((r) => ({
      url: r.url, owner: r.owner, repo: r.repo, branch: r.branch, importedAt: r.importedAt,
    })));
    showRepoImportModal = false;
  }

  function handleRepoRemove(repo) {
    repositories = repositories.filter((r) => r.url !== repo.url || r.branch !== repo.branch);
    saveRepositories(repositories.map((r) => ({
      url: r.url, owner: r.owner, repo: r.repo, branch: r.branch, importedAt: r.importedAt,
    })));
  }

  async function handleLoadRepoFile(repo, filePath) {
    selectedFileKey = `repo:${repo.owner}/${repo.repo}/${filePath}`;
    selectedExampleId = "";
    selectedRun = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${filePath}?ref=${repo.branch}`
      );
      if (!resp.ok) throw new Error(`GitHub API error (${resp.status})`);
      const data = await resp.json();
      // GitHub returns base64-encoded content
      const content = data.encoding === "base64"
        ? atob(data.content.replace(/\n/g, ""))
        : data.content;
      editorContent = content;
      validationResult = null;
      if (editorInstance) {
        editorInstance.setValue(content);
        editorInstance.layout();
      }
    } catch {
      editorContent = `// Failed to load ${filePath}`;
      if (editorInstance) {
        editorInstance.setValue(editorContent);
      }
    }
  }

  async function handleMcpConnect(url, authHeader) {
    // Check for duplicate
    if (mcpConnections.some((c) => c.url === url)) {
      throw new Error("Already connected to this server");
    }

    const info = await discoverTools(url, authHeader);
    const id = url;
    const openaiTools = mcpToolsToOpenAI(info.name, info.tools);

    mcpConnections = [...mcpConnections, {
      id, url, authHeader,
      name: info.name, version: info.version,
      tools: info.tools, openaiTools,
      sessionId: info.sessionId,
    }];
    mcpTools = mcpConnections.flatMap((c) => c.openaiTools);

    // Persist
    saveMcpConnections(mcpConnections.map((c) => ({
      url: c.url, authHeader: c.authHeader,
    })));
  }

  function handleMcpDisconnect(id) {
    mcpConnections = mcpConnections.filter((c) => c.id !== id);
    mcpTools = mcpConnections.flatMap((c) => c.openaiTools);
    saveMcpConnections(mcpConnections.map((c) => ({
      url: c.url, authHeader: c.authHeader,
    })));
  }
</script>

<svelte:head>
  <title>Playground | BendScript</title>
</svelte:head>

<div class="play-layout">
  <!-- Header bar -->
  <header class="play-header">
    <a href="/" class="play-brand">
      <b>BendScript</b>
      <span class="play-badge">playground</span>
    </a>

    <div class="play-header-center"></div>

    <div class="play-header-right">
      {#if data.user}
        <span class="play-user">{data.user.email}</span>
      {:else}
        <span class="play-guest">Guest</span>
      {/if}
      <button class="play-key-btn" onclick={() => (showApiKeyModal = true)}>
        {apiKey ? "Key set" : "Set API Key"}
      </button>
      <a href="/auth/login?redirectTo=/play" class="play-login-link">
        {data.user ? "Dashboard" : "Sign in"}
      </a>
    </div>
  </header>

  <!-- Three-pane body -->
  <div class="play-body">
    <!-- Left pane: Spec tree -->
    <aside class="play-pane play-pane-left">
      <SpecTree
        {selectedSchemaType}
        {selectedExampleId}
        {selectedFileKey}
        {repositories}
        {benchmarkRuns}
        {currentRunCycles}
        onSelect={handleSchemaSelect}
        onLoadExample={handleLoadExample}
        onLoadJson={handleLoadJson}
        onLoadText={handleLoadText}
        onLoadRepoFile={handleLoadRepoFile}
        onImportRepo={() => (showRepoImportModal = true)}
        onRemoveRepo={handleRepoRemove}
        onSelectRun={handleSelectRun}
      />
    </aside>

    <!-- Center pane: Monaco editor -->
    <main class="play-pane play-pane-center">
      <div class="play-editor-toolbar">
        <button class="play-validate-btn" onclick={handleValidate}>
          Validate
        </button>
        <button class="play-reset-btn" onclick={handleReset}>
          Reset
        </button>
        <span class="play-editor-hint">
          Paste or write a {SCHEMA_TYPES.find((s) => s.id === selectedSchemaType)?.ext || "JSON"} spec
        </span>
      </div>
      {#if activeActions.length > 0 || selectedRun}
        <ActionBar
          actions={activeActions}
          {mcpConnections}
          {apiKey}
          {repositories}
          {selectedRun}
          onStatusMessage={handleActionStatus}
          onCycleComplete={handleCycleComplete}
          onRunComplete={handleRunComplete}
          onContinueRun={handleContinueRun}
          onStopRun={handleStopRun}
          onDeleteRun={handleDeleteRun}
        />
      {/if}
      <div class="play-editor" bind:this={editorContainer}></div>
    </main>

    <!-- Right pane: Validator output + LLM chat -->
    <aside class="play-pane play-pane-right">
      <div class="play-right-tabs">
        <button
          class="play-tab"
          class:active={rightTab === "validator"}
          onclick={() => (rightTab = "validator")}
        >
          Validator
        </button>
        <button
          class="play-tab"
          class:active={rightTab === "chat"}
          onclick={() => (rightTab = "chat")}
        >
          LLM Chat
        </button>
        <button
          class="play-tab"
          class:active={rightTab === "mcp"}
          onclick={() => (rightTab = "mcp")}
        >
          MCP
          {#if mcpConnections.length > 0}
            <span class="play-tab-badge">{mcpConnections.length}</span>
          {/if}
        </button>
      </div>

      <div class="play-tab-content" class:hidden={rightTab !== "validator"}>
        <ValidatorPanel result={validationResult} />
      </div>
      <div class="play-tab-content" class:hidden={rightTab !== "chat"}>
        <LlmChat
          {apiKey}
          {editorContent}
          {chatMessages}
          tools={mcpTools}
          {mcpConnections}
          onRequestKey={() => (showApiKeyModal = true)}
          onLoadExample={handleLoadExample}
        />
      </div>
      <div class="play-tab-content" class:hidden={rightTab !== "mcp"}>
        <McpPanel
          connections={mcpConnections}
          onConnect={handleMcpConnect}
          onDisconnect={handleMcpDisconnect}
        />
      </div>
    </aside>
  </div>
</div>

{#if showApiKeyModal}
  <ApiKeyModal
    currentKey={apiKey}
    onSave={handleApiKeySave}
    onClose={() => (showApiKeyModal = false)}
  />
{/if}

{#if showRepoImportModal}
  <RepoImportModal
    onImport={handleRepoImport}
    onClose={() => (showRepoImportModal = false)}
  />
{/if}

<style>
  /* ── LAYOUT ── */
  .play-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  /* ── HEADER ── */
  .play-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    height: 48px;
    min-height: 48px;
    border-bottom: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
  }

  .play-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }
  .play-brand b {
    font-size: 14px;
    color: var(--cyan, #ff6d5a);
    letter-spacing: 0.04em;
  }
  .play-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-0, #f4f6f8);
    border: 1px solid var(--bg-2, #e0e4e8);
    color: var(--muted, #666);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }

  .play-header-center {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
  }
  .play-schema-label {
    font-size: 11px;
    color: var(--muted, #666);
    white-space: nowrap;
  }
  .play-schema-btn {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    color: var(--text, #222);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .play-schema-btn:hover {
    border-color: var(--cyan, #ff6d5a);
  }
  .play-schema-btn.active {
    border-color: var(--cyan, #ff6d5a);
    color: var(--cyan, #ff6d5a);
    font-weight: 600;
  }

  .play-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .play-user,
  .play-guest {
    font-size: 11px;
    color: var(--muted, #666);
  }
  .play-key-btn {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    color: var(--text, #222);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  .play-key-btn:hover {
    border-color: var(--cyan, #ff6d5a);
  }
  .play-login-link {
    font-size: 11px;
    color: var(--cyan, #ff6d5a);
    text-decoration: none;
    font-weight: 600;
  }
  .play-login-link:hover {
    text-decoration: underline;
  }

  /* ── THREE-PANE BODY ── */
  .play-body {
    display: grid;
    grid-template-columns: 260px 1fr 320px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .play-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .play-pane-left {
    border-right: 1px solid var(--sidebar-border, #2d2d2d);
    background: var(--sidebar-bg, #252526);
    color: var(--sidebar-fg, #cccccc);
  }

  .play-pane-center {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .play-pane-right {
    border-left: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
  }

  /* ── EDITOR TOOLBAR ── */
  .play-editor-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
  }

  .play-validate-btn {
    padding: 5px 14px;
    border-radius: 999px;
    border: none;
    background: var(--cyan, #ff6d5a);
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease;
  }
  .play-validate-btn:hover {
    filter: brightness(1.1);
  }

  .play-reset-btn {
    padding: 5px 14px;
    border-radius: 999px;
    border: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
    color: var(--muted, #666);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .play-reset-btn:hover {
    border-color: var(--cyan, #ff6d5a);
    color: var(--text, #222);
  }

  .play-editor-hint {
    font-size: 11px;
    color: var(--muted, #666);
  }

  /* ── MONACO CONTAINER ── */
  .play-editor {
    flex: 1;
    min-height: 0;
  }

  /* ── RIGHT PANE TABS ── */
  .play-right-tabs {
    display: flex;
    border-bottom: 1px solid var(--bg-2, #e0e4e8);
  }
  .play-tab {
    flex: 1;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: var(--muted, #666);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .play-tab:hover {
    color: var(--text, #222);
  }
  .play-tab.active {
    color: var(--cyan, #ff6d5a);
    border-bottom-color: var(--cyan, #ff6d5a);
  }
  .play-tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 999px;
    background: var(--green, #10b981);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    margin-left: 4px;
  }

  /* ── TAB CONTENT ── */
  .play-tab-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .play-tab-content.hidden {
    display: none;
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .play-body {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }
    .play-pane-left {
      border-right: none;
      border-bottom: 1px solid var(--bg-2, #e0e4e8);
      max-height: 120px;
      overflow-y: auto;
    }
    .play-pane-right {
      border-left: none;
      border-top: 1px solid var(--bg-2, #e0e4e8);
      max-height: 240px;
      overflow-y: auto;
    }
    .play-header-center {
      display: none;
    }
  }
</style>
