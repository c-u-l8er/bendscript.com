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
  version: "0.2.0",
};

const JSON_RPC = "2.0";

// ---------------------------------------------------------------------------
// Machine definitions — PULSE loop phases
// ---------------------------------------------------------------------------

const MACHINE_DEFINITIONS = [
  {
    name: "retrieve",
    title: "Retrieve",
    description:
      'KAG read machine — "What\'s in the graph?" Search nodes, explore subgraphs, traverse paths, query by natural language, list planes.',
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["search", "subgraph", "traverse", "query", "list_planes"],
          description:
            "search: semantic/text node search | subgraph: N-hop neighborhood | traverse: shortest path between nodes | query: natural language graph query | list_planes: enumerate graph planes",
        },
        // search
        query: { type: "string", minLength: 1 },
        // search, subgraph, traverse, query, list_planes
        graph_id: { type: "string" },
        // search
        plane_id: { type: "string" },
        // search, query
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        // subgraph
        node_id: { type: "string" },
        depth: { type: "integer", minimum: 0, maximum: 6, default: 2 },
        // subgraph, traverse
        edge_kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["context", "causal", "temporal", "associative", "user"],
          },
        },
        // traverse
        from_node_id: { type: "string" },
        to_node_id: { type: "string" },
        from_query: { type: "string" },
        to_query: { type: "string" },
        max_hops: { type: "integer", minimum: 1, maximum: 10, default: 4 },
        // query
        question: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "act",
    title: "Act",
    description:
      'KAG write machine — "Mutate the graph." Build nodes and edges from text.',
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["build_from_text"],
          description:
            "build_from_text: ingest text, extract entities, create nodes and edges",
        },
        graph_id: { type: "string" },
        plane_id: { type: "string" },
        text: { type: "string", minLength: 1, maxLength: 20000 },
        max_nodes: { type: "integer", minimum: 1, maximum: 12, default: 8 },
      },
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function rpcResult(id, result) {
  return { jsonrpc: JSON_RPC, id: id ?? null, result };
}

function rpcError(id, code, message, data = null) {
  const err = { code, message };
  if (data != null) err.data = data;
  return { jsonrpc: JSON_RPC, id: id ?? null, error: err };
}

function textContentResult(machine, action, payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
    structuredContent: payload,
    _meta: {
      machine,
      action,
    },
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SSE streaming
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// build_from_text helpers
// ---------------------------------------------------------------------------

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

  const { data, error } = await supabase.schema("kag")
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

// ---------------------------------------------------------------------------
// Machine action dispatchers
// ---------------------------------------------------------------------------

async function handleRetrieve({ action, args, supabase, workspaceId }) {
  switch (action) {
    case "search": {
      if (!args?.query) {
        throw new Error("retrieve(search) requires `query`.");
      }
      const result = await searchNodes({
        client: supabase,
        workspaceId,
        graphId: args.graph_id ?? null,
        planeId: args.plane_id ?? null,
        query: args.query,
        limit: args.limit ?? 20,
      });
      return textContentResult("retrieve", action, result);
    }

    case "subgraph": {
      if (!args?.graph_id || !args?.node_id) {
        throw new Error(
          "retrieve(subgraph) requires `graph_id` and `node_id`.",
        );
      }
      const result = await getSubgraph({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
        nodeId: args.node_id,
        depth: args.depth ?? 2,
        edgeKinds: args.edge_kinds ?? null,
      });
      return textContentResult("retrieve", action, result);
    }

    case "traverse": {
      if (!args?.graph_id) {
        throw new Error("retrieve(traverse) requires `graph_id`.");
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
      return textContentResult("retrieve", action, result);
    }

    case "query": {
      if (!args?.graph_id || !args?.question) {
        throw new Error(
          "retrieve(query) requires `graph_id` and `question`.",
        );
      }
      const result = await queryGraph({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
        question: args.question,
        limit: args.limit ?? 12,
        maxHops: args.max_hops ?? 4,
      });
      return textContentResult("retrieve", action, result);
    }

    case "list_planes": {
      if (!args?.graph_id) {
        throw new Error("retrieve(list_planes) requires `graph_id`.");
      }
      const result = await listPlanes({
        client: supabase,
        workspaceId,
        graphId: args.graph_id,
      });
      return textContentResult("retrieve", action, result);
    }

    default:
      throw new Error(
        `Unknown retrieve action "${action}". Valid: search, subgraph, traverse, query, list_planes`,
      );
  }
}

async function handleAct({ action, args, supabase, workspaceId }) {
  switch (action) {
    case "build_from_text": {
      if (!args?.graph_id || !args?.text) {
        throw new Error(
          "act(build_from_text) requires `graph_id` and `text`.",
        );
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

      const { data: insertedNodes, error: nodeErr } = await supabase.schema("kag")
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
        const { data: insertedEdges, error: edgeErr } = await supabase.schema("kag")
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

      return textContentResult("act", action, {
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
      throw new Error(
        `Unknown act action "${action}". Valid: build_from_text`,
      );
  }
}

// Machine dispatcher
const MACHINE_HANDLERS = {
  retrieve: handleRetrieve,
  act: handleAct,
};

// ---------------------------------------------------------------------------
// JSON-RPC method handling
// ---------------------------------------------------------------------------

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
        "BendScript KAG server with 2 machines: retrieve (read) and act (write). Call tools/list then tools/call with machine name and action parameter.",
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: MACHINE_DEFINITIONS,
    });
  }

  if (method === "tools/call") {
    const name = payload?.params?.name;
    const args = payload?.params?.arguments ?? {};

    if (!name || typeof name !== "string") {
      return rpcError(id, -32602, "Invalid params: `name` is required.");
    }

    const handler = MACHINE_HANDLERS[name];
    if (!handler) {
      return rpcError(
        id,
        -32601,
        `Machine not found: "${name}". Available: ${Object.keys(MACHINE_HANDLERS).join(", ")}`,
      );
    }

    const action = args.action;
    if (!action || typeof action !== "string") {
      return rpcError(
        id,
        -32602,
        `Invalid params: \`action\` is required for machine "${name}".`,
      );
    }

    try {
      const result = await handler({ action, args, supabase, workspaceId });
      return rpcResult(id, result);
    } catch (err) {
      return rpcError(
        id,
        -32000,
        err instanceof Error ? err.message : "Machine execution failed.",
      );
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

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
    machines: MACHINE_DEFINITIONS,
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
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST({ request }) {
  const supabase = createSupabaseAdminClient();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error: invalid JSON."), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Allow discovery methods (initialize, tools/list, ping) without auth
  const OPEN_METHODS = new Set(["initialize", "tools/list", "ping"]);
  const isBatch = Array.isArray(payload);
  const requests = isBatch ? payload : [payload];
  const allOpen = requests.every(
    (r) => r && typeof r === "object" && OPEN_METHODS.has(r.method),
  );

  let auth = { ok: false, key: null };
  if (!allOpen) {
    const apiKey = extractApiKey(request);
    auth = await authenticateApiKey({ client: supabase, apiKey });
    if (!auth.ok) {
      return json(rpcError(null, -32001, auth.error || "Unauthorized"), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
  }

  const responses = [];
  for (const item of requests) {
    if (!item || typeof item !== "object") {
      responses.push(rpcError(null, -32600, "Invalid Request."));
      continue;
    }

    const rpcResp = await handleRpcRequest({
      payload: item,
      supabase,
      workspaceId: auth.key?.workspace_id ?? null,
    });
    responses.push(rpcResp);
  }

  const stream = parseStreamPreference(request, payload);
  const requestId = getRequestId(request);
  const statusCode = 200;

  if (auth.key) {
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
  }

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
