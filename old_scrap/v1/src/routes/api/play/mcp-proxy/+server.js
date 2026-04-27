// Server-side proxy for MCP requests from the /play route.
// Forwards JSON-RPC requests to external MCP servers, avoiding CORS issues.

import { json, error } from "@sveltejs/kit";

const MAX_BODY = 64 * 1024; // 64 KB limit for proxied requests
const TIMEOUT_MS = 30_000;

// Block requests to private/internal addresses
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|\[::1\])/i;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) {
      return error(413, "Request body too large");
    }
    body = JSON.parse(text);
  } catch {
    return error(400, "Invalid JSON body");
  }

  const { serverUrl, authHeader, sessionId, request: rpcRequest } = body;

  if (!serverUrl || typeof serverUrl !== "string") {
    return error(400, "Missing serverUrl");
  }

  if (!rpcRequest || typeof rpcRequest !== "object") {
    return error(400, "Missing request object");
  }

  // Validate URL
  let parsed;
  try {
    parsed = new URL(serverUrl);
  } catch {
    return error(400, "Invalid serverUrl");
  }

  // Only allow HTTPS in production (allow HTTP for local dev)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return error(400, "Only HTTP(S) URLs are allowed");
  }

  // Block private network addresses in production
  if (import.meta.env.PROD && BLOCKED_HOSTS.test(parsed.hostname)) {
    return error(403, "Private network addresses are not allowed");
  }

  // Build headers for the upstream request
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const upstream = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(rpcRequest),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return json(
        {
          jsonrpc: "2.0",
          id: rpcRequest.id ?? null,
          error: {
            code: -32000,
            message: `Upstream error ${upstream.status}: ${errText.slice(0, 200)}`,
          },
        },
        { status: 200 }, // JSON-RPC errors are 200 with error field
      );
    }

    const contentType = upstream.headers.get("content-type") || "";

    // MCP Streamable HTTP may return SSE (text/event-stream) — extract JSON from first data line
    let result;
    if (contentType.includes("text/event-stream")) {
      const text = await upstream.text();
      const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) {
        result = JSON.parse(dataLine.slice(6));
      } else {
        throw new Error("No data in SSE response");
      }
    } else {
      result = await upstream.json();
    }

    // Forward mcp-session-id so the client can maintain stateful sessions
    const mcpSessionId = upstream.headers.get("mcp-session-id");
    if (mcpSessionId) {
      result._mcpSessionId = mcpSessionId;
    }
    return json(result);
  } catch (err) {
    const message =
      err.name === "AbortError"
        ? "MCP server timed out (30s)"
        : `Connection failed: ${err.message}`;
    return json(
      {
        jsonrpc: "2.0",
        id: rpcRequest.id ?? null,
        error: { code: -32000, message },
      },
      { status: 200 },
    );
  }
}
