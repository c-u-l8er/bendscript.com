# AGENTS.md — BendScript Agent Interface

> How AI agents should interact with BendScript knowledge graphs.

## What is BendScript?

BendScript is a multi-tenant knowledge graph where nodes are contexts, edges are typed relationships, and Stargates are portals into nested sub-graph planes. Humans build graphs on a visual canvas. Agents query and build graphs via MCP or REST API.

## MCP Server

BendScript exposes its graph data as an MCP-compatible server. Connect via Streamable HTTP transport.

### Available Tools

| Tool | Description | Use When |
|---|---|---|
| `search_nodes` | Semantic search across node text in a workspace | You need to find concepts, entities, or topics in the graph |
| `get_subgraph` | Return a node and its N-hop neighborhood | You need context around a specific concept |
| `traverse_path` | Find reasoning paths between two concepts | You need to understand how two ideas are connected |
| `query_graph` | Natural language → logical form → graph traversal | You have a complex question that requires multi-hop reasoning |
| `build_from_text` | Ingest text → extract entities/relations → add to graph | You want to add knowledge from a document or conversation |
| `list_planes` | List all graph planes in a workspace | You need to understand the graph's structure and depth |

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
search_nodes({ query: "machine learning", workspace_id: "..." })
```

### Explore a concept's context
```
get_subgraph({ node_id: "node_abc123", depth: 2, edge_kinds: ["causal", "context"] })
```

### Trace reasoning between two ideas
```
traverse_path({ from_query: "neural networks", to_query: "gradient descent", workspace_id: "...", max_hops: 4 })
```

### Ask a complex question
```
query_graph({ question: "What are the causal factors that led to transformer architectures?", workspace_id: "..." })
```

### Add knowledge to the graph
```
build_from_text({ text: "Attention mechanisms allow models to focus on relevant parts of the input...", workspace_id: "..." })
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
