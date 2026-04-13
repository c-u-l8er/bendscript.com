// Lightweight MCP client for the /play route.
// Discovers tools via MCP protocol and executes them through the server proxy.

const PROXY_URL = "/api/play/mcp-proxy";

/**
 * Discover tools from an MCP server via the proxy.
 * @param {string} serverUrl - The MCP server URL
 * @param {string} [authHeader] - Optional Authorization header value
 * @returns {Promise<{ name: string, version: string, tools: Array }>}
 */
export async function discoverTools(serverUrl, authHeader) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverUrl,
      authHeader: authHeader || undefined,
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "bendscript-playground", version: "0.1.0" },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }

  const initResult = await res.json();
  if (initResult.error) {
    throw new Error(initResult.error.message || "MCP initialize failed");
  }
  const serverInfo = initResult.result?.serverInfo || {};
  const sessionId = initResult._mcpSessionId || undefined;

  // Send notifications/initialized (required by stateful MCP servers before tools/list)
  if (sessionId) {
    await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverUrl,
        authHeader: authHeader || undefined,
        sessionId,
        request: {
          jsonrpc: "2.0",
          method: "notifications/initialized",
        },
      }),
    }).catch(() => {}); // notification — no response expected
  }

  // Now list tools (pass session ID for stateful servers like Graphonomous/PRISM)
  const toolsRes = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverUrl,
      authHeader: authHeader || undefined,
      sessionId,
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      },
    }),
  });

  if (!toolsRes.ok) {
    const text = await toolsRes.text();
    throw new Error(`Tool discovery failed ${toolsRes.status}: ${text}`);
  }

  const toolsResult = await toolsRes.json();
  if (toolsResult.error) {
    throw new Error(toolsResult.error.message || "MCP tools/list failed");
  }
  const tools = toolsResult.result?.tools || [];

  return {
    name: serverInfo.name || "unknown",
    version: serverInfo.version || "0.0.0",
    tools,
  };
}

/**
 * Call a tool on an MCP server via the proxy.
 * @param {string} serverUrl - The MCP server URL
 * @param {string} [authHeader] - Optional Authorization header value
 * @param {string} toolName - Tool name to call
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} Tool result
 */
export async function callTool(serverUrl, authHeader, toolName, args) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverUrl,
      authHeader: authHeader || undefined,
      request: {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tool call failed ${res.status}: ${text}`);
  }

  const result = await res.json();

  if (result.error) {
    throw new Error(result.error.message || "MCP tool error");
  }

  return result.result;
}

/**
 * Quick-discover tools from BendScript's own MCP endpoint (same origin, no proxy needed).
 * Uses the GET endpoint which returns server info + tools.
 * @returns {Promise<{ name: string, version: string, tools: Array }>}
 */
export async function discoverLocalTools() {
  const res = await fetch("/api/mcp", { method: "GET" });
  if (!res.ok) throw new Error(`Local MCP error ${res.status}`);

  const data = await res.json();
  const tools = data.tools || [];
  return {
    name: data.name || "bendscript-mcp",
    version: data.version || "0.2.0",
    tools,
  };
}

/**
 * Call a tool on BendScript's own MCP endpoint (same origin).
 * @param {string} toolName
 * @param {object} args
 * @returns {Promise<object>}
 */
export async function callLocalTool(toolName, args) {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Local MCP call failed ${res.status}: ${text}`);
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error.message || "MCP tool error");
  return result.result;
}
