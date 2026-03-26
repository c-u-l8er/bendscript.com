import { json } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$lib/supabase/server";
import {
  authenticateApiKey,
  searchNodes,
  listPlanes,
  getSubgraph,
  traversePath,
  queryGraph,
  recordApiKeyEvent,
} from "$lib/server/graphApi";

export const prerender = false;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers":
    "content-type,authorization,x-api-key,x-request-id",
};

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = {
  name: "bendscript-mcp",
  version: "0.1.0",
};

const JSON_RPC = "2.0";

const TOOL_DEFINITIONS = [
  {
    name: "search_nodes",
    title: "Search Nodes",
    description: "Semantic/text search across node text in a workspace graph.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        graph_id: { type: "string" },
        plane_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_subgraph",
    title: "Get Subgraph",
    description:
      "Return a node and its N-hop neighborhood with optional edge-kind filtering.",
    inputSchema: {
      type: "object",
      required: ["graph_id", "node_id"],
      properties: {
        graph_id: { type: "string" },
        node_id: { type: "string" },
        depth: { type: "integer", minimum: 0, maximum: 6, default: 2 },
        edge_kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["context", "causal", "temporal", "associative", "user"],
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "traverse_path",
    title: "Traverse Path",
    description:
      "Find a reasoning path between two concepts by node ids or text queries.",
    inputSchema: {
      type: "object",
      required: ["graph_id"],
      properties: {
        graph_id: { type: "string" },
        from_node_id: { type: "string" },
        to_node_id: { type: "string" },
        from_query: { type: "string" },
        to_query: { type: "string" },
        max_hops: { type: "integer", minimum: 1, maximum: 10, default: 4 },
        plane_id: { type: "string" },
        edge_kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["context", "causal", "temporal", "associative", "user"],
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "query_graph",
    title: "Query Graph",
    description:
      "Natural language graph query that returns candidate nodes and inferred path context.",
    inputSchema: {
      type: "object",
      required: ["graph_id", "question"],
      properties: {
        graph_id: { type: "string" },
        question: { type: "string", minLength: 1 },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 12 },
        max_hops: { type: "integer", minimum: 1, maximum: 10, default: 4 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "build_from_text",
    title: "Build From Text",
    description:
      "Ingest text and build graph nodes/edges in a target graph plane.",
    inputSchema: {
      type: "object",
      required: ["graph_id", "text"],
      properties: {
        graph_id: { type: "string" },
        plane_id: { type: "string" },
        text: { type: "string", minLength: 1, maxLength: 20000 },
        max_nodes: { type: "integer", minimum: 1, maximum: 12, default: 8 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_planes",
    title: "List Planes",
    description: "List all planes in a workspace graph.",
    inputSchema: {
      type: "object",
      required: ["graph_id"],
      properties: {
        graph_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

function rpcResult(id, result) {
  return { jsonrpc: JSON_RPC, id: id ?? null, result };
}

function rpcError(id, code, message, data = null) {
  const err = { code, message };
  if (data != null) err.data = data;
  return { jsonrpc: JSON_RPC, id: id ?? null, error: err };
}

function textContentResult(name, payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
    structuredContent: payload,
    _meta: {
      tool: name,
    },
  };
}

function getRequestId(request) {
  return request.headers.get("x-request-id") || null;
}

function getClientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("cf-connecting-ip") || null;
}

function getUserAgent(request) {
  return request.headers.get("user-agent") || null;
}

function extractApiKey(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return (request.headers.get("x-api-key") || "").trim();
}

function parseStreamPreference(request, body) {
  const accept = request.headers.get("accept") || "";
  const headerWantsSSE = accept.includes("text/event-stream");
  const bodyWantsSSE =
    body?.stream === true || body?.params?.stream === true || false;
  return headerWantsSSE || bodyWantsSSE;
}

function sseEncode(event, data) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

function streamRpcResponses(responses) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseEncode("open", { ok: true })));

      for (const response of responses) {
        controller.enqueue(encoder.encode(sseEncode("message", response)));
      }

      controller.enqueue(encoder.encode(sseEncode("done", { ok: true })));
      controller.close();
    },
  });
}

function sanitizeText(input, max = 280) {
  return String(input ?? "")
    .trim()
    .slice(0, max);
}

function splitSentences(text) {
  return String(text || "")
    .split(/[\n\r]+|(?<=[.!?])\s+/g)
    .map((s) => sanitizeText(s, 280))
    .filter(Boolean);
}

function inferEdgeKind(text) {
  const t = String(text || "").toLowerCase();
  if (
    t.includes("causes") ||
    t.includes("cause") ||
    t.includes("leads to") ||
    t.includes("because")
  ) {
    return "causal";
  }
  if (
    t.includes("before") ||
    t.includes("after") ||
    t.includes("then") ||
    t.includes("timeline")
  ) {
    return "temporal";
  }
  if (t.includes("relates") || t.includes("associated")) {
    return "associative";
  }
  return "context";
}

async function resolvePlaneId({ supabase, workspaceId, graphId, planeId }) {
  if (planeId) return planeId;

  const { data, error } = await supabase
    .from("graphs")
    .select("root_plane_id")
    .eq("workspace_id", workspaceId)
    .eq("id", graphId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve graph root plane: ${error.message}`);
  }

  const rootPlaneId = data?.[0]?.root_plane_id || null;
  if (!rootPlaneId) {
    throw new Error("No root plane found for graph.");
  }

  return rootPlaneId;
}

async function handleToolCall({ name, args, supabase, workspaceId }) {
  switch (name) {
    case "search_nodes": {
      if (!args?.query) {
        throw new Error("search_nodes requires `query`.");
      }
      const result = await searchNodes({
        client: supabase,
        workspaceId,
        graphId: args.graph_id ?? null,
        planeId: args.plane_id ?? null,
        query: args.query,
        limit: args.limit ?? 20,
      });
      return textContentResult(name, result);
    }

    case "get_subgraph": {
      if (!args?.graph_id || !args?.node_id) {
        throw new Error("get_subgraph requires `graph_id` and `node_id`.");
      }
      const result = await getSubgraph({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
        nodeId: args.node_id,
        depth: args.depth ?? 2,
        edgeKinds: args.edge_kinds ?? null,
      });
      return textContentResult(name, result);
    }

    case "traverse_path": {
      if (!args?.graph_id) {
        throw new Error("traverse_path requires `graph_id`.");
      }
      const result = await traversePath({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
        fromNodeId: args.from_node_id ?? null,
        toNodeId: args.to_node_id ?? null,
        fromQuery: args.from_query ?? null,
        toQuery: args.to_query ?? null,
        maxHops: args.max_hops ?? 4,
        planeId: args.plane_id ?? null,
        edgeKinds: args.edge_kinds ?? null,
      });
      return textContentResult(name, result);
    }

    case "query_graph": {
      if (!args?.graph_id || !args?.question) {
        throw new Error("query_graph requires `graph_id` and `question`.");
      }
      const result = await queryGraph({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
        question: args.question,
        limit: args.limit ?? 12,
        maxHops: args.max_hops ?? 4,
      });
      return textContentResult(name, result);
    }

    case "list_planes": {
      if (!args?.graph_id) {
        throw new Error("list_planes requires `graph_id`.");
      }
      const result = await listPlanes({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
      });
      return textContentResult(name, result);
    }

    case "build_from_text": {
      if (!args?.graph_id || !args?.text) {
        throw new Error("build_from_text requires `graph_id` and `text`.");
      }

      const graphId = String(args.graph_id);
      const text = String(args.text);
      const planeId = await resolvePlaneId({
        supabase,
        workspaceId,
        graphId,
        planeId: args.plane_id ?? null,
      });

      const maxNodes = Math.max(1, Math.min(Number(args.max_nodes || 8), 12));
      const chunks = splitSentences(text).slice(0, maxNodes);
      const nodeTexts =
        chunks.length > 0
          ? chunks
          : [sanitizeText(text, 280) || "Imported text"];

      const radius = 180;
      const nodeRows = nodeTexts.map((nodeText, idx) => {
        const theta = (Math.PI * 2 * idx) / Math.max(nodeTexts.length, 1);
        const type = nodeText.startsWith("⊛") ? "stargate" : "normal";
        return {
          workspace_id: workspaceId,
          graph_id: graphId,
          plane_id: planeId,
          text: nodeText,
          type,
          x: Math.cos(theta) * radius,
          y: Math.sin(theta) * radius,
          pinned: false,
          metadata: { source: "mcp_build_from_text" },
        };
      });

      const { data: insertedNodes, error: nodeErr } = await supabase
        .from("nodes")
        .insert(nodeRows)
        .select(
          "id, workspace_id, graph_id, plane_id, text, type, x, y, pinned, metadata, created_at, updated_at",
        );

      if (nodeErr) {
        throw new Error(`Failed to insert nodes: ${nodeErr.message}`);
      }

      const nodes = insertedNodes || [];
      const edgeRows = [];

      for (let i = 0; i < nodes.length - 1; i += 1) {
        const label = "extracts";
        const kind = inferEdgeKind(nodes[i + 1]?.text || "");
        edgeRows.push({
          workspace_id: workspaceId,
          graph_id: graphId,
          plane_id: planeId,
          node_a: nodes[i].id,
          node_b: nodes[i + 1].id,
          label,
          kind,
          strength: 2,
          metadata: { source: "mcp_build_from_text" },
        });
      }

      let edges = [];
      if (edgeRows.length > 0) {
        const { data: insertedEdges, error: edgeErr } = await supabase
          .from("edges")
          .insert(edgeRows)
          .select(
            "id, workspace_id, graph_id, plane_id, node_a, node_b, label, kind, strength, metadata, created_at, updated_at",
          );

        if (edgeErr) {
          throw new Error(`Failed to insert edges: ${edgeErr.message}`);
        }

        edges = insertedEdges || [];
      }

      return textContentResult(name, {
        graph_id: graphId,
        plane_id: planeId,
        nodes,
        edges,
        summary: {
          nodes_created: nodes.length,
          edges_created: edges.length,
        },
      });
    }

    default:
      throw new Error(`Unknown tool "${name}".`);
  }
}

async function handleRpcRequest({ payload, supabase, workspaceId }) {
  const id = payload?.id ?? null;
  const method = payload?.method;

  if (!method || typeof method !== "string") {
    return rpcError(id, -32600, "Invalid Request: missing method.");
  }

  if (method === "ping") {
    return rpcResult(id, { ok: true, ts: new Date().toISOString() });
  }

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: { listChanged: false },
        logging: {},
      },
      instructions:
        "Use tools/list then tools/call. Provide arguments as JSON object.",
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: TOOL_DEFINITIONS,
    });
  }

  if (method === "tools/call") {
    const name = payload?.params?.name;
    const args = payload?.params?.arguments ?? {};

    if (!name || typeof name !== "string") {
      return rpcError(id, -32602, "Invalid params: `name` is required.");
    }

    const known = TOOL_DEFINITIONS.find((t) => t.name === name);
    if (!known) {
      return rpcError(id, -32601, `Tool not found: ${name}`);
    }

    try {
      const result = await handleToolCall({
        name,
        args,
        supabase,
        workspaceId,
      });

      return rpcResult(id, result);
    } catch (err) {
      return rpcError(
        id,
        -32000,
        err instanceof Error ? err.message : "Tool execution failed.",
      );
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET({ request }) {
  const supabase = createSupabaseAdminClient();
  const apiKey = extractApiKey(request);

  const auth = await authenticateApiKey({ client: supabase, apiKey });
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const body = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
    endpoint: "/api/mcp",
    transport: "streamable-http",
    tools: TOOL_DEFINITIONS,
  };

  await recordApiKeyEvent({
    client: supabase,
    apiKeyId: auth.key.id,
    workspaceId: auth.key.workspace_id,
    route: "/api/mcp",
    method: "GET",
    statusCode: 200,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    requestId: getRequestId(request),
  });

  return json(body, { headers: CORS_HEADERS });
}

export async function DELETE({ request: _request }) {
  // Streamable HTTP session teardown endpoint (stateless no-op in this implementation).
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST({ request }) {
  const supabase = createSupabaseAdminClient();
  const apiKey = extractApiKey(request);

  const auth = await authenticateApiKey({ client: supabase, apiKey });
  if (!auth.ok) {
    return json(rpcError(null, -32001, auth.error || "Unauthorized"), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    const parseErr = rpcError(null, -32700, "Parse error: invalid JSON.");
    await recordApiKeyEvent({
      client: supabase,
      apiKeyId: auth.key.id,
      workspaceId: auth.key.workspace_id,
      route: "/api/mcp",
      method: "POST",
      statusCode: 400,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      requestId: getRequestId(request),
    });

    return json(parseErr, { status: 400, headers: CORS_HEADERS });
  }

  const isBatch = Array.isArray(payload);
  const requests = isBatch ? payload : [payload];

  const responses = [];
  for (const item of requests) {
    if (!item || typeof item !== "object") {
      responses.push(rpcError(null, -32600, "Invalid Request."));
      continue;
    }

    const rpcResp = await handleRpcRequest({
      payload: item,
      supabase,
      workspaceId: auth.key.workspace_id,
    });
    responses.push(rpcResp);
  }

  const stream = parseStreamPreference(request, payload);
  const requestId = getRequestId(request);
  const statusCode = 200;

  await recordApiKeyEvent({
    client: supabase,
    apiKeyId: auth.key.id,
    workspaceId: auth.key.workspace_id,
    route: "/api/mcp",
    method: "POST",
    statusCode,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    requestId,
  });

  if (stream) {
    const body = streamRpcResponses(responses);
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  return json(isBatch ? responses : responses[0], {
    status: 200,
    headers: CORS_HEADERS,
  });
}
