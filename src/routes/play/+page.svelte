<script>
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import SpecTree from "../../components/play/SpecTree.svelte";
  import ValidatorPanel from "../../components/play/ValidatorPanel.svelte";
  import LlmChat from "../../components/play/LlmChat.svelte";
  import ApiKeyModal from "../../components/play/ApiKeyModal.svelte";
  import McpPanel from "../../components/play/McpPanel.svelte";
  import { validateSpec, SCHEMA_TYPES } from "$lib/play/validator.js";
  import { mcpToolsToOpenAI } from "$lib/play/tools.js";
  import { discoverTools, discoverLocalTools } from "$lib/play/mcp-client.js";
  import {
    saveGuestState,
    loadGuestState,
    loadApiKey,
    saveApiKey,
    loadMcpConnections,
    saveMcpConnections,
  } from "$lib/play/storage.js";
  import { DEFAULT_MCP_SERVERS } from "$lib/play/default-servers.js";

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

  // LLM state
  let apiKey = $state("");
  let showApiKeyModal = $state(false);
  let chatMessages = $state([]);

  // Right panel tab
  let rightTab = $state("validator"); // "validator" | "chat" | "mcp"

  // MCP state
  let mcpConnections = $state([]);
  let mcpTools = $state([]); // OpenAI-format tool defs from all connected servers

  const EXAMPLES = {
    ampersand: JSON.stringify(
      {
        $schema:
          "https://protocol.ampersandboxdesign.com/schema/v0.1.0/ampersand.schema.json",
        agent: "FleetManager",
        version: "0.1.0",
        capabilities: {
          "&memory.episodic": {
            provider: "auto",
            need: "route performance history",
          },
          "&time.forecast": {
            provider: "auto",
            need: "demand spike prediction",
          },
          "&space.fleet": {
            provider: "auto",
            need: "US regional fleet tracking",
          },
          "&reason.argument": {
            provider: "auto",
            need: "auditable scaling decisions",
          },
        },
        governance: {
          infer_from_goal: true,
        },
        provenance: true,
      },
      null,
      2,
    ),
    "capability-contract": JSON.stringify(
      {
        $schema:
          "https://protocol.ampersandboxdesign.com/schema/v0.1.0/capability-contract.schema.json",
        capability: "&time.anomaly",
        provider: "ticktickclock",
        version: "0.1.0",
        description:
          "Temporal anomaly detection and enrichment contract.",
        operations: {
          detect: { in: "stream_data", out: "anomaly_set" },
          enrich: { in: "context", out: "enriched_context" },
          learn: { in: "observation", out: "ack" },
        },
        accepts_from: ["&memory.*", "&space.*", "raw_data"],
        feeds_into: ["&memory.*", "&reason.*", "&space.*", "output"],
        a2a_skills: ["temporal-anomaly-detection"],
      },
      null,
      2,
    ),
    registry: JSON.stringify(
      {
        $schema:
          "https://protocol.ampersandboxdesign.com/schema/v0.1.0/registry.schema.json",
        version: "0.1.0",
        registry: "registry.ampersandboxdesign.com",
        generated_at: "2026-03-14T14:23:07Z",
        "&memory": {
          subtypes: {
            graph: {
              ops: ["recall", "learn", "consolidate", "enrich"],
              description:
                "Graph-structured memory for durable contextual recall.",
            },
            vector: {
              ops: ["search", "upsert", "enrich"],
            },
          },
          providers: [
            {
              id: "graphonomous",
              subtypes: ["graph"],
              protocol: "mcp_v1",
              status: "stable",
            },
            {
              id: "pgvector",
              subtypes: ["vector"],
              protocol: "mcp_v1",
            },
          ],
        },
      },
      null,
      2,
    ),
    pulse: JSON.stringify(
      {
        pulse_protocol_version: "0.1",
        loop_id: "example.my_loop",
        version: "0.1.0",
        phases: [
          { id: "gather_ctx", kind: "retrieve" },
          { id: "decide_path", kind: "route" },
          { id: "execute", kind: "act" },
          { id: "update_model", kind: "learn" },
          { id: "cleanup", kind: "consolidate" },
        ],
        closure: {
          from_phase: "cleanup",
          to_phase: "gather_ctx",
          guarantee: "eventual",
        },
        cadence: { type: "event" },
        substrates: {
          memory: "graphonomous://workspace/default",
          policy: null,
          audit: null,
          auth: null,
        },
        invariants: {
          phase_atomicity: true,
          feedback_immutability: true,
          kappa_routing: false,
        },
      },
      null,
      2,
    ),
    prism: JSON.stringify(
      {
        scenario_id: "recall-basic-001",
        name: "Basic Fact Recall",
        dimensions: ["retention", "latency"],
        steps: [
          { action: "store", payload: { key: "capital-france", value: "Paris" } },
          { action: "wait", duration_ms: 5000 },
          { action: "retrieve", query: "What is the capital of France?" },
        ],
        expected: {
          recall: true,
          max_latency_ms: 500,
        },
      },
      null,
      2,
    ),
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

    // Connect BendScript's own MCP endpoint first (same origin, no proxy)
    const localMcpUrl = `${window.location.origin}/api/mcp`;
    try {
      const info = await discoverLocalTools();
      const tools = mcpToolsToOpenAI(info.name, info.tools);
      mcpConnections = [...mcpConnections, {
        id: localMcpUrl, url: localMcpUrl, authHeader: undefined,
        name: info.name, version: info.version,
        tools: info.tools, openaiTools: tools,
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
    const example = EXAMPLES[schemaId] || "{}";
    editorContent = example;
    if (editorInstance) {
      editorInstance.setValue(example);
      editorInstance.layout();
    }
    validationResult = null;
    autoSave();
  }

  function handleLoadExample(schemaId) {
    const example = EXAMPLES[schemaId] || "{}";
    editorContent = example;
    selectedSchemaType = schemaId;

    if (editorInstance) {
      editorInstance.setValue(example);
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

    <div class="play-header-center">
      <span class="play-schema-label">Schema:</span>
      {#each SCHEMA_TYPES as schema}
        <button
          class="play-schema-btn"
          class:active={selectedSchemaType === schema.id}
          onclick={() => handleSchemaSelect(schema.id)}
        >
          {schema.label}
        </button>
      {/each}
    </div>

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
        onSelect={handleSchemaSelect}
        onLoadExample={handleLoadExample}
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
    grid-template-columns: 220px 1fr 320px;
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
    border-right: 1px solid var(--bg-2, #e0e4e8);
    background: var(--bg-1, #fff);
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
