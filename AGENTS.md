# AGENTS.md — BendScript Agent Interface

> How AI agents should interact with BendScript knowledge graphs.

## What is BendScript?

BendScript is a multi-tenant knowledge graph where nodes are contexts, edges are typed relationships, and Stargates are portals into nested sub-graph planes. Humans build graphs on a visual canvas. Agents query and build graphs via MCP or REST API.

## MCP Server (v0.2.0 — Machine Architecture)

BendScript exposes its graph data as an MCP-compatible server using a **machine architecture** that mirrors the PULSE loop phases. Connect via Streamable HTTP transport.

### Machines

Two machines, each accepting an `action` parameter:

#### `retrieve` — "What's in the graph?"

| Action | Description | Use When |
|---|---|---|
| `search` | Semantic search across node text in a workspace | You need to find concepts, entities, or topics |
| `subgraph` | Return a node and its N-hop neighborhood | You need context around a specific concept |
| `traverse` | Find reasoning paths between two concepts | You need to understand how two ideas are connected |
| `query` | Natural language graph query with multi-hop reasoning | You have a complex question |
| `list_planes` | List all graph planes in a workspace | You need to understand the graph's structure |

#### `act` — "Mutate the graph"

| Action | Description | Use When |
|---|---|---|
| `build_from_text` | Ingest text, extract entities/relations, add to graph | You want to add knowledge from a document or conversation |

### Edge Types

Edges in BendScript are typed. When creating or querying edges, use these kinds:

- `context` — definitional or descriptive relationship
- `causal` — A causes or leads to B
- `temporal` — A happens before/after B
- `associative` — A is related to B (loose connection)
- `user` — user-defined custom relationship

### Node Types

- `normal` — standard knowledge node
- `stargate` — portal to a nested sub-graph plane (prefixed with ⊛)

## Query Patterns

### Find what the graph knows about a topic
```
retrieve({ action: "search", query: "machine learning", graph_id: "..." })
```

### Explore a concept's context
```
retrieve({ action: "subgraph", graph_id: "...", node_id: "node_abc123", depth: 2, edge_kinds: ["causal", "context"] })
```

### Trace reasoning between two ideas
```
retrieve({ action: "traverse", graph_id: "...", from_query: "neural networks", to_query: "gradient descent", max_hops: 4 })
```

### Ask a complex question
```
retrieve({ action: "query", graph_id: "...", question: "What are the causal factors that led to transformer architectures?" })
```

### Add knowledge to the graph
```
act({ action: "build_from_text", graph_id: "...", text: "Attention mechanisms allow models to focus on relevant parts of the input..." })
```

## Authentication

All API and MCP requests require an API key scoped to a workspace. Keys are created in the BendScript dashboard under Settings → API Keys.

## Rate Limits

- Free plan: No API access
- KAG API ($49/mo): 5,000 queries/month
- KAG Teams ($99/mo): 20,000 queries/month
- KAG Enterprise: Custom

## Data Format

Responses return structured JSON with nodes, edges, and plane context:

```json
{
  "nodes": [
    { "id": "node_abc", "text": "Transformer Architecture", "type": "normal", "plane_id": "plane_xyz" }
  ],
  "edges": [
    { "from": "node_abc", "to": "node_def", "label": "enables", "kind": "causal", "strength": 4 }
  ],
  "planes": [
    { "id": "plane_xyz", "name": "Deep Learning", "depth": 1 }
  ]
}
```

## Contributing to a Graph

When building nodes via the API, follow these conventions:

- Node text should be concise (max 280 chars for auto-generated nodes)
- Edge labels should be short verb phrases (max 40 chars): "causes", "enables", "contradicts"
- Use `stargate` type only for concepts that warrant sub-graph exploration
- Prefix stargate node text with `⊛` (e.g., "⊛ Attention Mechanisms")

## More Information

- Product: https://bendscript.com
- Documentation: https://docs.bendscript.com
- MCP Specification: https://modelcontextprotocol.io
- Built by [Ampersand Box Design](https://ampersandboxdesign.com)
