<script>
  import {
    BUILTIN_TOOLS,
    executeBuiltinTool,
    parseMcpToolName,
  } from "$lib/play/tools.js";
  import { callTool, callLocalTool } from "$lib/play/mcp-client.js";

  let {
    apiKey = "",
    editorContent = "",
    chatMessages = [],
    tools = [],
    mcpConnections = [],
    onRequestKey,
    onLoadExample,
  } = $props();

  let input = $state("");
  let loading = $state(false);

  // Merge built-in tools with MCP tools
  function getAllTools() {
    return [...BUILTIN_TOOLS, ...tools];
  }

  // Build the system prompt including available tool descriptions
  function buildSystemPrompt() {
    const toolSummary = getAllTools()
      .map((t) => `- ${t.function.name}: ${t.function.description}`)
      .join("\n");

    return `You are an expert assistant for the [&] Protocol ecosystem with access to live MCP servers. You MUST call tools to get real data — never describe what to call, just call it.

RULES:
- Always call tools first, then summarize results. Never explain what you "would" do.
- Be efficient: call multiple tools in parallel when possible.
- Keep responses concise — show key data, not raw JSON dumps.
- CRITICAL: When you give a text response, it MUST be a complete summary of what you found. NEVER say "let me do X next" or "I'll now run Y" — if you have results, present them. If you need more data, call tools NOW, don't describe what you plan to call.
- Your final response must always be a finished answer, not a promise of future work.

BENCHMARK WORKFLOW (when user asks to benchmark/evaluate):
Step 1: Call mcp__os-prism__config with action="list_systems" to check registered systems
Step 2: Call mcp__os-prism__compose with action="list" to see available scenarios
Step 3: Call mcp__os-prism__interact with action="run" for available scenarios (needs scenario_id, system_id)
Step 4: Call mcp__os-prism__diagnose with action="report" for the system to get dimensional scores
Present results as a summary table. Work with whatever scenarios exist — do NOT try to create new ones unless asked.

GRAPHONOMOUS QUERIES:
- To search knowledge: mcp__graphonomous__retrieve with action="context", query="..."
- To check graph health: mcp__graphonomous__consolidate with action="stats"
- To store knowledge: mcp__graphonomous__act with action="store_node"

Available tools:
${toolSummary}

Current editor content:
\`\`\`json
${editorContent}
\`\`\``;
  }

  async function callOpenRouter(messages, includeTools) {
    const allTools = getAllTools();
    const body = {
      model: "qwen/qwen3.6-plus",
      messages,
      max_tokens: 4096,
    };
    if (includeTools && allTools.length > 0) {
      body.tools = allTools;
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bendscript.com/play",
          "X-Title": "BendScript Playground",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error ${response.status}: ${errText}`);
    }

    return response.json();
  }

  // Execute a tool call (built-in or MCP)
  async function executeTool(name, args) {
    // Check if it's an MCP tool
    const mcpInfo = parseMcpToolName(name);
    if (mcpInfo) {
      const conn = mcpConnections.find((c) => c.name === mcpInfo.serverName);
      if (!conn) throw new Error(`MCP server "${mcpInfo.serverName}" not connected`);

      if (conn.isLocal) {
        return await callLocalTool(mcpInfo.toolName, args);
      }
      return await callTool(conn.url, conn.authHeader, mcpInfo.toolName, args, conn.sessionId);
    }

    // Built-in tool
    return executeBuiltinTool(name, args, {
      editorContent,
      onLoadExample,
    });
  }

  async function sendMessage() {
    if (!input.trim()) return;

    if (!apiKey) {
      onRequestKey();
      return;
    }

    const userMsg = { role: "user", content: input.trim() };
    chatMessages = [...chatMessages, userMsg];
    input = "";
    loading = true;

    try {
      const messages = [
        { role: "system", content: buildSystemPrompt() },
        ...chatMessages,
      ];

      const MAX_ROUNDS = 6;
      let data = await callOpenRouter(messages, true);
      let msg = data.choices?.[0]?.message;

      // Tool-use loop
      let rounds = 0;
      while (msg?.tool_calls?.length > 0 && rounds < MAX_ROUNDS) {
        rounds++;

        // Show which tools are being called
        const toolNames = msg.tool_calls.map((tc) => tc.function.name);
        chatMessages = [
          ...chatMessages,
          {
            role: "tool-status",
            content: `Calling: ${toolNames.join(", ")}`,
          },
        ];

        // Add assistant message with tool_calls to conversation
        messages.push(msg);

        // Execute each tool call and collect results
        for (const tc of msg.tool_calls) {
          let result;
          try {
            const args = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {};
            const toolResult = await executeTool(tc.function.name, args);
            result = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
          } catch (err) {
            result = JSON.stringify({ error: err.message });
          }

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }

        // On the last allowed round, disable tools and inject summary instruction
        const allowMoreTools = rounds < MAX_ROUNDS - 1;
        if (!allowMoreTools) {
          messages.push({
            role: "system",
            content: "This is your final response. Summarize all results you have gathered so far. Present any scores or data as a formatted table. Give a complete, finished answer.",
          });
        }
        data = await callOpenRouter(messages, allowMoreTools);
        msg = data.choices?.[0]?.message;
      }

      // If the model hit the limit and still tried to call tools, or gave no content,
      // add a wrap-up indicator
      if (rounds >= MAX_ROUNDS && msg?.tool_calls?.length > 0) {
        chatMessages = [
          ...chatMessages,
          { role: "tool-status", content: "Wrapping up..." },
        ];
      }

      // Final text response — use whatever content we got
      let reply = msg?.content ?? "";
      if (!reply.trim()) {
        // Model returned empty — synthesize a minimal response from tool results
        reply = rounds > 0
          ? "Benchmark run complete. Check the MCP panel for raw results, or ask a follow-up question for details."
          : "No response received.";
      }
      chatMessages = [...chatMessages, { role: "assistant", content: reply }];
    } catch (err) {
      chatMessages = [
        ...chatMessages,
        { role: "assistant", content: `Request failed: ${err.message}` },
      ];
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chat-panel">
  {#if !apiKey}
    <div class="chat-empty">
      <p>Set an <b>OpenRouter API key</b> to enable LLM chat.</p>
      <p>Default model: <code>qwen/qwen3.6-plus</code></p>
      <button class="chat-set-key" onclick={onRequestKey}>Set API Key</button>
    </div>
  {:else}
    <div class="chat-messages">
      {#each chatMessages as msg}
        {#if msg.role === "tool-status"}
          <div class="chat-msg tool-status">
            <span class="chat-tool-label">{msg.content}</span>
          </div>
        {:else if msg.role === "action-status"}
          <div class="chat-msg action-status">
            <span class="chat-action-label">{msg.content}</span>
          </div>
        {:else if msg.role === "action-result"}
          <div class="chat-msg action-result">
            <span class="chat-role">BENCHMARK</span>
            <pre class="chat-content chat-result-pre">{msg.content}</pre>
          </div>
        {:else if msg.role === "action-error"}
          <div class="chat-msg action-error">
            <span class="chat-role">ERROR</span>
            <span class="chat-content">{msg.content}</span>
          </div>
        {:else}
          <div class="chat-msg" class:user={msg.role === "user"}>
            <span class="chat-role">{msg.role === "user" ? "You" : "AI"}</span>
            <span class="chat-content">{msg.content}</span>
          </div>
        {/if}
      {/each}
      {#if loading}
        <div class="chat-msg">
          <span class="chat-role">AI</span>
          <span class="chat-content chat-loading">Thinking...</span>
        </div>
      {/if}
    </div>

    <div class="chat-input-bar">
      <textarea
        class="chat-input"
        placeholder="Ask about your spec..."
        bind:value={input}
        onkeydown={handleKeydown}
        rows="2"
      ></textarea>
      <button
        class="chat-send"
        onclick={sendMessage}
        disabled={loading || !input.trim()}
      >
        Send
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .chat-empty {
    padding: 24px 14px;
    text-align: center;
    font-size: 12px;
    color: var(--muted, #666);
    line-height: 1.5;
  }
  .chat-empty code {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--bg-0, #f4f6f8);
    border: 1px solid var(--bg-2, #e0e4e8);
  }
  .chat-set-key {
    margin-top: 10px;
    padding: 6px 14px;
    border-radius: 999px;
    border: none;
    background: var(--cyan, #ff6d5a);
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .chat-set-key:hover {
    filter: brightness(1.1);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chat-msg {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--bg-0, #f4f6f8);
    font-size: 12px;
    line-height: 1.45;
  }
  .chat-msg.user {
    background: rgba(255, 109, 90, 0.06);
  }
  .chat-msg.tool-status {
    background: rgba(139, 92, 246, 0.06);
    border: 1px solid rgba(139, 92, 246, 0.15);
    padding: 4px 8px;
  }

  .chat-role {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted, #666);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .chat-tool-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--violet, #8b5cf6);
    font-style: italic;
  }

  .chat-msg.action-status {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.15);
    padding: 4px 8px;
  }
  .chat-action-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--green, #10b981);
    font-style: italic;
  }

  .chat-msg.action-result {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  .chat-result-pre {
    white-space: pre-wrap;
    font-size: 10px;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
  }

  .chat-msg.action-error {
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }
  .chat-msg.action-error .chat-role {
    color: #ef4444;
  }
  .chat-msg.action-error .chat-content {
    color: #ef4444;
  }

  .chat-content {
    color: var(--text, #222);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .chat-loading {
    color: var(--muted, #666);
    font-style: italic;
  }

  .chat-input-bar {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid var(--bg-2, #e0e4e8);
  }

  .chat-input {
    flex: 1;
    resize: none;
    border: 1px solid var(--bg-2, #e0e4e8);
    border-radius: 8px;
    background: var(--bg-0, #f4f6f8);
    color: var(--text, #222);
    padding: 7px 9px;
    font: inherit;
    font-size: 12px;
    outline: none;
  }
  .chat-input:focus {
    border-color: var(--cyan, #ff6d5a);
    box-shadow: 0 0 0 2px rgba(255, 109, 90, 0.15);
  }

  .chat-send {
    padding: 6px 12px;
    border-radius: 999px;
    border: none;
    background: var(--cyan, #ff6d5a);
    color: #fff;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .chat-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .chat-send:hover:not(:disabled) {
    filter: brightness(1.1);
  }
</style>
