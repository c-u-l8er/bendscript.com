# BendScript — Agent Skills

> **Purpose:** Teach any LLM connected to BendScript how to use its MCP tools
> correctly, idiomatically, and in the right sequence. Drop these files into your
> MCP client's context so the model knows *when*, *why*, and *how* to interact
> with the knowledge graph.

---

## Quick Orientation

BendScript is a **multi-tenant, AI-powered knowledge graph editor** exposed as
both a visual canvas (for humans) and an MCP/REST API (for agents). It maintains
knowledge graphs built from **typed nodes and edges** organized into **planes**
(nested via Stargates). Agents query this graph through **KAG** (Knowledge
Augmented Generation) — graph traversal + vector search + logical forms.

BendScript is the only non-Elixir product in the [&] Protocol ecosystem. It
provides `&memory.graph` as a KAG server, complementary to Graphonomous's
agent-side continual learning graph.

### The Core Loop

Every interaction with BendScript follows this rhythm:

```
1. BUILD      → create nodes and edges (canvas or build_from_text)
2. QUERY      → search, traverse, or query the graph (KAG)
3. SYNTHESIZE → use AI to generate new graph structure (4 tiers)
4. EXPORT     → extract knowledge as JSON, Markdown, or Mermaid
```

---

## Skill Files

| File | What It Teaches |
|------|----------------|
| [01_CANVAS_ENGINE.md](01_CANVAS_ENGINE.md) | Force-directed canvas manipulation — nodes, edges, physics, camera |
| [02_GRAPH_SYNTHESIS.md](02_GRAPH_SYNTHESIS.md) | AI-powered graph building — 4 synthesis tiers and model routing |
| [03_STARGATES_AND_PLANES.md](03_STARGATES_AND_PLANES.md) | Fractal depth navigation — Stargates, planes, breadcrumbs |
| [04_KAG_SERVER.md](04_KAG_SERVER.md) | Knowledge Augmented Generation — MCP tools, query strategies, provenance |
| [05_COLLABORATION.md](05_COLLABORATION.md) | Multi-tenant real-time collaboration — workspaces, roles, RLS |
| [06_EXPORT_AND_INTEGRATION.md](06_EXPORT_AND_INTEGRATION.md) | Data freedom — JSON, Markdown, Mermaid export; MCP and REST integration |
| [07_ANTI_PATTERNS.md](07_ANTI_PATTERNS.md) | Common mistakes and how to avoid them |

---

## MCP Tool Inventory

BendScript exposes six MCP tools over Streamable HTTP/SSE.

### Query Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `search_nodes` | Find nodes by text similarity or keyword | `query` (required), `workspace_id`, `plane_id`, `limit` |
| `get_subgraph` | Retrieve a node and its neighborhood (N hops) | `node_id` (required), `depth`, `edge_types` |
| `traverse_path` | Follow typed edges from a starting node | `start_node_id` (required), `edge_type`, `direction`, `max_hops` |
| `query_graph` | Natural language graph query via KAG solver | `query` (required), `workspace_id`, `plane_id` |
| `list_planes` | List all planes in a workspace | `workspace_id` (required) |

### Write Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `build_from_text` | Ingest text, extract entities/relations, build graph | `text` (required), `workspace_id`, `plane_id`, `mode` |

---

## AI Synthesis Tiers

| Tier | Name | What It Does | Token Budget |
|------|------|-------------|--------------|
| 1 | Contextual response | Prompt → 2 nodes (user + AI response) | ~800 in / ~600 out |
| 2 | Graph-aware synthesis | Prompt + topology → 2-4 nodes fitting structure | ~3,000 in / ~1,500 out |
| 3 | Topic-to-graph | Topic → 8-12 node subgraph with typed edges | ~4,000 in / ~4,000 out |
| 4 | Edge inference | New node → suggested connections to existing nodes | ~2,500 in / ~800 out |

Free plan: Haiku 4.5 (Tiers 1-3). Paid plan: Sonnet 4.6 (Tiers 1-4).

---

## Edge Types — Use Them Correctly

| Type | Semantics | KAG Traversal Behavior |
|------|-----------|----------------------|
| `context` | Frames or scopes another node | Followed for context expansion |
| `causal` | One node causes or leads to another | Followed for causal chains |
| `temporal` | Sequence in time | Followed for timeline reconstruction |
| `associative` | Related by theme or similarity | Followed for topic expansion |
| `user-defined` | Custom relationship label | Followed if label matches query |

**Typed edges are what make KAG work.** If all edges are untyped or "related",
the KAG solver cannot distinguish causal chains from associations.

---

## Canvas Interaction Patterns

| Action | How |
|--------|-----|
| Create node | Click empty canvas area |
| Edit node text | Click the node card text area |
| Create edge | Drag from node edge handle to target node |
| Set edge type | Use the edge inspector panel |
| Create Stargate | Set node type to "Stargate" in inspector |
| Enter Stargate | Click the Stargate node |
| Navigate back | Click breadcrumb trail |
| Pin node | Toggle pin in inspector (stops physics) |
| Pan canvas | Click and drag on empty space |
| Zoom | Scroll wheel or pinch |
| AI synthesis | Type in the Composer bar |

---

## KAG Query Types

| Query Type | Tool | Example |
|-----------|------|---------|
| Keyword search | `search_nodes` | "Find all nodes about authentication" |
| Neighborhood | `get_subgraph` | "Show me everything connected to this node" |
| Path traversal | `traverse_path` | "Follow causal edges from the root cause" |
| Natural language | `query_graph` | "What caused the deployment failure?" |
| Plane listing | `list_planes` | "What sub-graphs exist in this workspace?" |
| Text ingestion | `build_from_text` | "Build a graph from this documentation" |

---

## How to Use These Skill Files

**For system prompts:** Include `SKILLS.md` first, then whichever numbered
skill files are relevant to the task.

**For context injection:** Reference specific skill files when the user asks
about a capability (e.g., "see 03_STARGATES_AND_PLANES.md for plane navigation").

**For agent bootstrapping:** Use the MCP Tool Inventory above as a quick
reference for available operations.

**Minimum viable context:** If you can only include one file, include `SKILLS.md`.
