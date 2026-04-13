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

    return `You are a helpful assistant for the [&] Protocol ecosystem. The user is editing a JSON spec in the BendScript playground. Help them understand and write valid specs.

You have tools available. Use them proactively when helpful:
${toolSummary}

Current editor content:
\`\`\`json
${editorContent}
\`\`\``;
  }

  async function callOpenRouter(messages, includeTools) {
    const allTools = getAllTools();
    const body = {
      model: "google/gemma-4-26b-a4b-it",
      messages,
      max_tokens: 1024,
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
      return await callTool(conn.url, conn.authHeader, mcpInfo.toolName, args);
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

      let data = await callOpenRouter(messages, true);
      let msg = data.choices?.[0]?.message;

      // Tool-use loop: up to 5 rounds
      let rounds = 0;
      while (msg?.tool_calls?.length > 0 && rounds < 5) {
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

        // Continue the conversation with tool results (no tools in follow-up to avoid infinite loop)
        data = await callOpenRouter(messages, rounds < 4);
        msg = data.choices?.[0]?.message;
      }

      // Final text response
      const reply = msg?.content ?? "No response received.";
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
      <p>Default model: <code>google/gemma-4-26b-a4b-it</code></p>
      <button class="chat-set-key" onclick={onRequestKey}>Set API Key</button>
    </div>
  {:else}
    <div class="chat-messages">
      {#each chatMessages as msg}
        {#if msg.role === "tool-status"}
          <div class="chat-msg tool-status">
            <span class="chat-tool-label">{msg.content}</span>
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
