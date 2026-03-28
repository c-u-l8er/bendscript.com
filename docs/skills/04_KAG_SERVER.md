# Skill 04 — KAG Server

> **What this teaches:** How BendScript's Knowledge Augmented Generation server
> works — KAG vs RAG, query decomposition, graph traversal, vector search, and
> the MCP tools agents use to query knowledge graphs.

---

## KAG vs RAG

| Dimension | RAG | KAG |
|-----------|-----|-----|
| Retrieval | Vector similarity on text chunks | Graph traversal + vector search + logical forms |
| Structure | Flat document chunks | Typed nodes and edges in a graph |
| Multi-hop | Poor (each chunk is independent) | Native (follow edges across hops) |
| Provenance | "chunk from document X" | "Node A → causal → Node B → temporal → Node C" |
| Relationships | Implicit (in text) | Explicit (typed edges) |
| Query types | Similarity search only | Similarity + traversal + decomposition |

KAG preserves the *shape* of knowledge. When an agent asks "what caused X
and what did X lead to?", KAG follows causal edges in both directions. RAG
returns text chunks that happen to mention X.

---

## Query Decomposition

The KAG solver decomposes natural language queries into logical forms that
map to graph operations.

```
Query: "What are the consequences of the database migration?"

Decomposition:
  1. FIND node matching "database migration"
  2. TRAVERSE causal edges outward (depth 3)
  3. COLLECT all reached nodes
  4. RANK by edge strength and path length
  5. ASSEMBLE reasoning path with provenance
```

### Logical Form Types

| Form | Graph Operation |
|------|----------------|
| `FIND(text)` | Vector similarity search via pgvector |
| `TRAVERSE(node, edge_type, direction, depth)` | BFS/DFS along typed edges |
| `FILTER(nodes, predicate)` | Filter by node type, plane, or metadata |
| `RANK(nodes, criterion)` | Sort by edge strength, recency, or relevance |
| `ASSEMBLE(paths)` | Merge traversal paths into a response |

---

## Graph Traversal Strategies

### Breadth-First (BFS)

Default traversal. Explores all neighbors at distance 1, then distance 2, etc.
Good for "what is connected to X?" queries.

### Typed-Edge Following

Constrained traversal that only follows specific edge types. Essential for
questions like "what caused X?" (follow only `causal` edges).

### Multi-Hop Traversal

The solver supports 2-5 hop traversals. Each hop follows one edge. Multi-hop
enables reasoning chains: A → caused → B → led to → C → resulted in → D.

### Cross-Plane Traversal

When a Stargate is encountered during traversal, the solver can optionally
descend into the sub-plane to continue following edges.

---

## Vector Search Integration

BendScript uses pgvector for semantic similarity search on node text content.

- Embeddings are generated when nodes are created or updated.
- `search_nodes` performs vector similarity against the query.
- The KAG solver uses vector search as the `FIND` operation in decomposed
  queries — locating starting nodes before graph traversal begins.

Vector search and graph traversal are complementary: similarity finds the
starting point, traversal follows the structure.

---

## MCP Tools

### search_nodes

Find nodes by text similarity or keyword.

```
search_nodes(
  query: "authentication flow",
  workspace_id: "ws_abc",
  plane_id: "plane_1",     # optional — omit to search all planes
  limit: 10                # default 10, max 50
)
```

Returns nodes ranked by relevance with text, type, plane, and score.

### get_subgraph

Retrieve a node and its neighborhood.

```
get_subgraph(
  node_id: "node_abc",
  depth: 2,                # hops from center node (default 1)
  edge_types: ["causal", "context"]  # optional filter
)
```

Returns the center node, all connected nodes within depth, and the edges
between them.

### traverse_path

Follow typed edges from a starting node.

```
traverse_path(
  start_node_id: "node_abc",
  edge_type: "causal",
  direction: "outgoing",   # "outgoing", "incoming", or "both"
  max_hops: 3              # default 2, max 5
)
```

Returns an ordered list of nodes along the traversal path with the edges
that connect them.

### query_graph

Natural language graph query via the KAG solver.

```
query_graph(
  query: "What caused the deployment failure and how was it resolved?",
  workspace_id: "ws_abc",
  plane_id: "plane_1"      # optional
)
```

Returns a structured response with:

- Answer text assembled from graph traversal
- Source nodes (with IDs and text)
- Reasoning path (edges followed)
- Confidence score

### build_from_text

Ingest external text, extract entities and relations, build graph structure.

```
build_from_text(
  text: "Kubernetes uses etcd for cluster state. The API server...",
  workspace_id: "ws_abc",
  plane_id: "plane_1",
  mode: "schema_free"      # or "schema_constrained"
)
```

Uses AI (Tier 2-3) to extract entities as nodes and relations as typed edges.
Two modes:

- **schema_free** — extract whatever entities and relations the model finds.
- **schema_constrained** — extract only entities and relations matching
  predefined types.

### list_planes

List all planes in a workspace (see Skill 03).

---

## Response Formats and Provenance

KAG responses include provenance — the path through the graph that produced
the answer.

```json
{
  "answer": "The deployment failed due to...",
  "sources": [
    { "node_id": "n1", "text": "Database migration ran...", "plane": "Root" },
    { "node_id": "n2", "text": "Connection pool exhausted...", "plane": "Root" }
  ],
  "reasoning_path": [
    { "from": "n1", "to": "n2", "edge_type": "causal", "label": "caused" }
  ],
  "confidence": 0.85
}
```

Provenance lets agents and humans verify how an answer was derived from the
graph — not just what text was retrieved.

---

## Best Practices for Agents

1. **Start with `list_planes`** to understand the workspace structure.
2. **Use `search_nodes`** to find starting points, then **`traverse_path`**
   to follow relationships.
3. **Use `query_graph`** for complex questions that require multi-hop reasoning.
4. **Specify `edge_types`** in traversal to get precise answers (e.g., only
   follow `causal` edges for cause-effect questions).
5. **Use `build_from_text`** to ingest external knowledge into the graph
   before querying it.
