# BendScript — Script Bending Through Graph Space
## Technical Specification v1.0

**Date:** March 25, 2026
**Status:** Draft
**Author:** [&] Ampersand Box Design
**License:** MIT (open core)
**Stack:** SvelteKit · Supabase · TypeScript

---

## 1. Overview

BendScript is a **multi-tenant, AI-powered knowledge graph editor** and **Knowledge Augmented Generation (KAG) server**. Humans build knowledge interactively on a visual canvas. Agents query, traverse, and extend that knowledge via MCP and REST API.

The canvas is the builder. The graph data is the moat. The API is the product.

BendScript is the only non-Elixir product in the [&] Protocol ecosystem — built entirely on SvelteKit and TypeScript, with Supabase (Postgres) as the persistence layer.

### 1.1 The Problem

Current knowledge tools force a choice: **linear chat** (every AI assistant), **flat documents** (Notion, Google Docs), or **manual graphs** (Obsidian Canvas, Heptabase). None of them let AI reason about the *shape* of your knowledge. Meanwhile, RAG pipelines retrieve text chunks by vector similarity — blind to the causal, temporal, and associative relationships that make knowledge useful for multi-hop reasoning.

The canvas-AI space is growing (Flowith: 1M+ users, Heptabase: $7M ARR), but no tool sends graph topology to the model as generative input. AI assists *within* the canvas — it does not reason *about* the canvas. And no canvas tool exposes its graph as a queryable knowledge backend for agents.

BendScript closes both gaps: topology-aware AI synthesis for humans, and a KAG server for agents.

### 1.2 Design Principles

1. **Graph-native** — Every interaction produces nodes and typed edges, not chat messages
2. **Topology-aware AI** — The model receives graph structure as context, not just text history
3. **Fractal depth** — Stargates create nested graph planes; knowledge has spatial dimension
4. **Data freedom** — Full JSON export at any time; no vendor lock-in on user knowledge
5. **Two surfaces** — Visual canvas for humans, MCP/REST API for agents
6. **KAG over RAG** — Graph traversal + vector search + logical forms beat flat similarity
7. **Zero-friction entry** — The landing page is a live, working graph; no signup to feel the product

### 1.3 Why SvelteKit

BendScript requires a framework that compiles to minimal JavaScript (the canvas renderer is performance-critical), supports SSR for SEO (landing page and shared graphs), and has first-class adapter support for edge deployment (Cloudflare Pages). SvelteKit satisfies all three constraints. Its reactive stores map cleanly to the force-directed graph engine state. Unlike React, there is no virtual DOM overhead during the 60fps render loop — the canvas engine is pure JS, and Svelte stores are thin reactive wrappers over engine state.

### 1.4 One-Liner

**Script bending = thinking in graphs. Agent-native knowledge infrastructure.**

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         BENDSCRIPT                                │
│              Knowledge Graph Editor + KAG Server                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────────────────────────┐  ┌───────────────────────────┐  │
│   │   Visual Canvas (Humans)    │  │   MCP / REST API (Agents) │  │
│   │                             │  │                           │  │
│   │   HTML5 Canvas              │  │   Streamable HTTP / SSE   │  │
│   │   Force-directed physics    │  │   REST + API key          │  │
│   │   Composer bar              │  │   AGENTS.md discovery     │  │
│   │   Stargates + Breadcrumbs   │  │                           │  │
│   │   Inspectors (node/edge)    │  │   search_nodes            │  │
│   │   Edit / Preview modes      │  │   get_subgraph            │  │
│   │                             │  │   traverse_path           │  │
│   └──────────────┬──────────────┘  │   query_graph             │  │
│                  │                 │   build_from_text          │  │
│                  │                 │   list_planes              │  │
│                  │                 └─────────────┬─────────────┘  │
│                  │                               │                │
│   ┌──────────────▼───────────────────────────────▼─────────────┐  │
│   │                    AI Graph Synthesis                        │  │
│   │                                                             │  │
│   │   Tier 1: Contextual response (prompt → 2 nodes)           │  │
│   │   Tier 2: Graph-aware synthesis (topology → 2-4 nodes)     │  │
│   │   Tier 3: Topic-to-graph (topic → 8-12 node subgraph)     │  │
│   │   Tier 4: Edge inference (suggest connections)              │  │
│   │                                                             │  │
│   │   Free: Haiku 4.5 · Paid: Sonnet 4.6 · Prompt caching     │  │
│   └──────────────┬──────────────────────────────────────────────┘  │
│                  │                                                 │
│   ┌──────────────▼──────────────────────────────────────────────┐  │
│   │                    KAG Solver + Builder                      │  │
│   │                                                             │  │
│   │   ┌─ KAG-Solver ─────────────────────────────────────────┐ │  │
│   │   │  1. Decompose query → logical forms                   │ │  │
│   │   │  2. Match forms to graph operations                   │ │  │
│   │   │  3. Traverse edges (typed, multi-hop, 2-5 hops)      │ │  │
│   │   │  4. Assemble subgraph + reasoning path                │ │  │
│   │   └───────────────────────────────────────────────────────┘ │  │
│   │                                                             │  │
│   │   ┌─ KAG-Builder ────────────────────────────────────────┐ │  │
│   │   │  Ingest text → extract entities/relations             │ │  │
│   │   │  Schema-free + schema-constrained modes               │ │  │
│   │   │  AI Tier 2-3 synthesis = interactive graph building   │ │  │
│   │   └───────────────────────────────────────────────────────┘ │  │
│   └──────────────┬──────────────────────────────────────────────┘  │
│                  │                                                 │
│   ┌──────────────▼──────────────────────────────────────────────┐  │
│   │                    Graph Store                               │  │
│   │                                                             │  │
│   │   Supabase (Postgres) + pgvector                            │  │
│   │   Workspaces · Planes · Nodes · Edges                       │  │
│   │   Row-Level Security (multi-tenant isolation)               │  │
│   │   Supabase Realtime (broadcast for collaboration)           │  │
│   │   Supabase Auth (email + Google OAuth)                      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│   Deploy: Cloudflare Pages (SvelteKit) + Supabase Cloud           │
│   AI Proxy: Supabase Edge Functions (Anthropic key server-side)   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Component Summary

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Canvas Engine | Force-directed graph rendering, physics simulation, hit testing, camera transforms | Pure JS (no framework), HTML5 Canvas, requestAnimationFrame |
| Svelte Stores | Reactive state wrappers over engine state (nodes, edges, planes, selection) | Svelte writable stores |
| Composer | Floating prompt input — spawns node pairs via AI synthesis | Svelte component |
| Inspectors | Right-panel editors for node text/type and edge metadata | Svelte components |
| Plane System | Multi-plane graph with Stargate portals, breadcrumb navigation | `planes.js` engine module |
| AI Synthesis | Tiered Claude API integration — contextual, graph-aware, topic-to-graph, edge inference | TypeScript, Anthropic SDK |
| AI Proxy | Server-side Claude API calls (key never exposed to client), rate limiting per plan | Supabase Edge Functions |
| KAG Solver | Query decomposition → logical forms → graph traversal → reasoning paths | TypeScript |
| KAG Builder | Text ingestion → entity/relation extraction → graph construction | TypeScript + Claude API |
| Graph Store | Multi-tenant persistence with workspace isolation via RLS | Supabase (Postgres) |
| Auth | Email + Google OAuth, auto-created personal workspace on first sign-in | Supabase Auth |
| Realtime | Live collaboration — node position sync, text broadcast | Supabase Realtime |
| MCP Server | Streamable HTTP / SSE transport exposing graph tools to agents | TypeScript, MCP SDK |
| Export | JSON full state, Markdown outline, Mermaid diagram generation | TypeScript |

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | SvelteKit 2.x | Routing, SSR, component framework |
| Canvas | HTML5 Canvas + vanilla JS | Graph rendering, physics, input handling |
| State | Svelte writable stores | Reactive wrappers over engine state |
| Backend | Supabase (Postgres) | Graph persistence, multi-tenancy, RLS |
| Auth | Supabase Auth | Email + Google OAuth, workspace isolation |
| Realtime | Supabase Realtime (broadcast) | Live collaboration — node positions + text |
| AI | Anthropic Claude API | Haiku 4.5 (Free), Sonnet 4.6 (Paid); prompt caching |
| AI Proxy | Supabase Edge Functions | Server-side API calls, rate limiting per plan |
| Vector Search | pgvector | Semantic node similarity for KAG queries |
| Styling | Custom CSS (no Tailwind) | 935+ line stylesheet, spatial visual language |
| Testing | Vitest (unit) + Playwright (e2e) | Engine logic + canvas interaction tests |
| Deploy | Cloudflare Pages + Supabase Cloud | Static frontend + managed backend |
| Linting | ESLint + Prettier | TypeScript code quality |

---

## 4. Core Concepts

### 4.1 Script Bending

"Script bending" is the manipulation of conversational and computational flows through graph topology. Instead of linear chat, users interact with a living graph:

- **Nodes** are contexts — prompts, responses, ideas, code, or sub-worlds
- **Edges** are typed relationships — causal, associative, temporal, context, or user-defined
- **Stargates** are special nodes that portal into entirely new graph planes (fractal depth)
- **Bending** is reshaping the graph — forking paths, merging contexts, warping connections
- **AI synthesis** generates new nodes and edges that understand the graph's existing topology

### 4.2 Node Types

| Type | Description | Visual |
|------|------------|--------|
| `normal` | Standard content node — prompts, responses, ideas, code | Rounded-rect card with gradient fill and chromatic header |
| `stargate` | Portal node that opens into a nested sub-graph plane | Spinning dual-arc animation (event horizon effect) |

### 4.3 Edge Types

| Type | Semantics | Example |
|------|----------|---------|
| `context` | Frames or scopes another node | "BendScript" → context → "What is Script Bending?" |
| `causal` | One node causes or leads to another | "User prompt" → causal → "AI response" |
| `temporal` | Sequence in time | "Step 1" → temporal → "Step 2" |
| `associative` | Related by theme or similarity | "Graph theory" → associative → "Network science" |
| `user-defined` | Custom relationship label | Any label the user provides |

### 4.4 Graph Planes and Stargates

Stargates create **fractal depth**. Clicking a Stargate node triggers a warp transition into its nested sub-graph — a new plane with its own nodes, edges, and potentially more Stargates. Breadcrumbs show the depth path and allow navigation back up.

```
Root Plane
├── [Node A]
├── [⊛ Stargate X] ─── opens ──► Sub-Plane X
│                                  ├── [Node X1]
│                                  ├── [Node X2]
│                                  └── [⊛ Stargate Y] ── opens ──► Sub-Plane Y
│                                                                    ├── [Node Y1]
│                                                                    └── [Node Y2]
├── [Node B]
└── [Node C]

Breadcrumbs: Root > Stargate X > Stargate Y
```

### 4.5 AI Graph Synthesis (4 Tiers)

The Composer connects to the Anthropic Claude API. AI does not just respond with text — it reasons about graph structure and returns nodes and edges that fit the topology.

**Tier 1 — Contextual response:**
Prompt → AI returns `{ text, type, edgeLabel, edgeKind }` → spawns 2 nodes (user + response).
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid). ~800 input tokens, ~600 output tokens.

**Tier 2 — Graph-aware synthesis:**
Prompt + current graph context (nodes + edges) → AI returns 2-4 nodes that semantically fit the existing structure. The graph shape influences the response, not just the text. This is the core differentiator.
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid). ~3,000 input tokens, ~1,500 output tokens.

**Tier 3 — Topic-to-graph:**
Topic → AI returns a full subgraph of 8-12 nodes with typed edges, Stargate suggestions, and depth hierarchy. The graph IS the answer.
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid). ~4,000 input tokens, ~4,000 output tokens.

**Tier 4 — Edge inference:**
On new node creation, AI suggests which existing nodes it should connect to and why.
Model: Sonnet 4.6 (Paid only). ~2,500 input tokens, ~800 output tokens.

### 4.6 Data Model

#### 4.6.1 TypeScript Interface Definitions

```typescript
// Core graph entities — authoritative schema definitions for Supabase tables

interface Workspace {
  id: string;                   // UUID, primary key
  name: string;
  slug: string;                 // globally unique, lowercase + hyphens
  plan: 'free' | 'pro' | 'teams' | 'business' | 'enterprise';
  stripe_customer_id: string | null;
  owner_id: string;             // Supabase auth user ID
  created_at: string;           // ISO8601
  updated_at: string;
}

interface WorkspaceMember {
  id: string;
  workspace_id: string;         // FK → workspaces.id
  user_id: string;              // Supabase auth user ID
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invited_by: string | null;
  created_at: string;
}

interface GraphPlane {
  id: string;
  workspace_id: string;         // FK → workspaces.id (RLS partition key)
  graph_id: string;             // FK → graphs.id
  name: string;
  parent_plane_id: string | null; // null = root plane
  is_root: boolean;
  node_count: number;           // denormalized counter
  created_at: string;
  updated_at: string;
}

interface Node {
  id: string;
  plane_id: string;             // FK → graph_planes.id
  workspace_id: string;         // FK → workspaces.id (RLS partition key)
  text: string;
  type: 'normal' | 'stargate';
  x: number;                    // canvas position
  y: number;
  width: number;
  height: number;
  pinned: boolean;              // exempt from physics simulation
  portal_plane_id: string | null; // non-null only for stargate nodes
  embedding: number[] | null;   // pgvector (384-dim, all-MiniLM-L6-v2)
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Edge {
  id: string;
  plane_id: string;             // FK → graph_planes.id
  workspace_id: string;         // FK → workspaces.id (RLS partition key)
  source_node_id: string;       // FK → nodes.id
  target_node_id: string;       // FK → nodes.id
  label: string;                // human-readable edge label
  kind: 'context' | 'causal' | 'temporal' | 'associative' | 'custom';
  strength: number;             // 0.0–1.0, default 0.5
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AIGeneration {
  id: string;
  workspace_id: string;         // FK → workspaces.id
  user_id: string;              // Supabase auth user ID
  prompt: string;
  tier: 1 | 2 | 3 | 4;
  model: string;                // e.g., "claude-haiku-4-5", "claude-sonnet-4-6"
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;        // prompt cache hits
  cost_usd: number;             // computed from token counts + model pricing
  nodes_spawned: number;
  edges_spawned: number;
  duration_ms: number;
  created_at: string;
}

// Invariants:
// - {workspace_id} is the RLS partition key on all tables
// - {source_node_id, target_node_id, plane_id} is unique per edge (no parallel edges of same type)
// - Stargate nodes: portal_plane_id must reference an existing GraphPlane
// - Node embedding is auto-generated on insert/update via Supabase Edge Function
// - ai_generations has composite index on {workspace_id, created_at} for rate-limit queries
```

#### 4.6.2 Summary Table

| Table | Primary Key | RLS Key | Relationships |
|-------|------------|---------|---------------|
| `workspaces` | `id` | `id` | has_many: members, planes, nodes, edges, generations |
| `workspace_members` | `id` | `workspace_id` | belongs_to: workspace, user |
| `graph_planes` | `id` | `workspace_id` | belongs_to: workspace, graph; has_many: nodes, edges; self-ref: parent_plane |
| `nodes` | `id` | `workspace_id` | belongs_to: plane; has_many: source_edges, target_edges |
| `edges` | `id` | `workspace_id` | belongs_to: plane, source_node, target_node |
| `ai_generations` | `id` | `workspace_id` | belongs_to: workspace, user |

Row-level security (RLS) in Postgres enforces tenant isolation at the database layer. On first sign-in, a personal workspace is automatically created.

### 4.7 Data Freedom

Graph portability is a hard requirement:

- **JSON export** — Full graph state (planes, nodes, edges, metadata) as a single JSON file
- **Markdown outline** — Flatten a graph plane into a nested document following edge hierarchy
- **Mermaid export** — Renders in GitHub, Notion, Obsidian, and most Markdown tools
- **JSON import** — Reload a previously exported graph for backup/restore

> If you can't export everything at any time, we've failed.

---

## 5. KAG — Knowledge Augmented Generation

BendScript's graph data is structurally identical to a knowledge graph. Every node is an entity, every typed edge is a relation, every Stargate is a sub-domain. This makes BendScript a **KAG server** — any LLM system can query it for grounded, multi-hop reasoning.

### 5.1 Why KAG, Not Just RAG

| Capability | RAG | KAG (BendScript) |
|------------|-----|-------------------|
| Retrieval method | Vector similarity on text chunks | Graph traversal + vector search + logical forms |
| Multi-hop reasoning | Weak — chains of similarity matches | Native — follow typed edges across 2-5 hops |
| Numerical/temporal logic | Blind — treats "30 days" as text | Aware — temporal edges encode sequence; strength encodes weight |
| Hallucination resistance | Moderate — relevant but possibly wrong chunks | Strong — answers grounded in explicit graph structure |
| Context for LLM | Flat text chunks | Structured subgraph (nodes, edges, paths, planes) |
| Domain adaptability | Requires re-indexing documents | Users build domain graphs interactively via AI synthesis |

### 5.2 KAG Query Flow

```
Agent sends natural language query
    │
    ▼
┌─────────────────────┐
│ Query Decomposer     │  Break question into logical forms
│                     │  (entity lookup, relation traversal,
│                     │   aggregation, comparison)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Graph Matcher        │  Map logical forms to graph operations:
│                     │  - pgvector similarity for entity lookup
│                     │  - Edge traversal for relation queries
│                     │  - Multi-hop pathfinding for reasoning
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Subgraph Assembler   │  Collect traversed nodes + edges into
│                     │  a coherent subgraph with provenance
│                     │  (source nodes, edge paths, plane context)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Response Formatter   │  Return structured JSON:
│                     │  { nodes, edges, paths, reasoning }
│                     │  Agent's LLM generates grounded answer
└─────────────────────┘
```

### 5.3 KAG-Builder

The KAG-Builder ingests unstructured text and produces graph structure:

1. Extract entities from input text (named entities, concepts, terms)
2. Identify relationships between entities (causal, temporal, associative)
3. Map to existing graph nodes where overlap exists (deduplication)
4. Create new nodes and typed edges in the target workspace
5. Optionally constrain extraction to a user-provided schema

This is functionally equivalent to AI Tier 2-3 synthesis but triggered via API rather than the Composer.

---

## 6. MCP Tools

BendScript exposes its graph as an MCP-compatible server via Streamable HTTP / SSE transport. MCP — now governed by the Agentic AI Foundation under the Linux Foundation — is the de facto standard for AI-to-tool integration with 97M+ monthly SDK downloads.

### 6.1 Tool Definitions

| Tool | Description | Input | Output |
|------|------------|-------|--------|
| `search_nodes` | Semantic search across node text in a workspace | `{ query: string, workspace_id: string, limit?: number }` | Array of matching nodes with relevance scores |
| `get_subgraph` | Return a node and its neighborhood to N hops | `{ node_id: string, depth?: number, edge_kinds?: string[] }` | Subgraph JSON (nodes + edges + plane context) |
| `traverse_path` | Find reasoning paths between two concepts | `{ from_query: string, to_query: string, max_hops?: number }` | Ordered path with edge labels and types |
| `query_graph` | Natural language → logical form → graph traversal | `{ question: string, workspace_id: string }` | Reasoning result with source nodes and path |
| `build_from_text` | Ingest text and return extracted nodes/edges | `{ text: string, workspace_id: string, schema?: object }` | New nodes and edges added to graph |
| `list_planes` | List all graph planes in a workspace | `{ workspace_id: string }` | Plane hierarchy with node counts |

### 6.2 Integration Methods

| Method | Transport | Best For | Status |
|--------|----------|----------|--------|
| **MCP Server** | Streamable HTTP / SSE | Claude, ChatGPT, Cursor, any MCP client | v1.0 (read-only), v1.1 (full) |
| **REST API** | HTTPS + API key | Custom apps, webhooks, server-to-server | v1.1 |
| **AGENTS.md** | File in repository | Agent discovery and capability declaration | v1.0 |

### 6.3 Example: Claude Desktop Integration

```json
{
  "mcpServers": {
    "bendscript": {
      "url": "https://bendscript.com/api/mcp",
      "headers": {
        "Authorization": "Bearer bs_key_..."
      }
    }
  }
}
```

Once configured, Claude (or any MCP client) can:
1. **Search knowledge:** Call `search_nodes` to find relevant concepts in a user's graph
2. **Get context:** Call `get_subgraph` to retrieve structured neighborhood around a concept
3. **Reason across hops:** Call `traverse_path` to find multi-hop reasoning paths
4. **Ask questions:** Call `query_graph` for natural language queries resolved against graph structure
5. **Build knowledge:** Call `build_from_text` to ingest documents into the graph
6. **Navigate structure:** Call `list_planes` to understand graph organization

---

## 7. [&] Protocol Integration

BendScript provides `&memory.graph` within the [&] Protocol ecosystem — the human-built knowledge surface that complements Graphonomous's agent-side continual learning.

### 7.1 Ecosystem Position

```
SpecPrompt (Standards)    → defines agent behavior as versioned specs
    ↓
Agentelic (Engineering)   → builds, tests, deploys agents against specs
    ↓
OpenSentience (Runtime)   → governs, executes, observes agents locally
    ↓
Graphonomous (Memory)     → agent-side continual learning knowledge graphs
BendScript (Knowledge)    → human-built knowledge graphs + KAG server  ← THIS
    ↓
FleetPrompt (Distribution) · Delegatic (Orchestration)
```

### 7.2 Integration Points

| Product | Integration |
|---------|------------|
| **Graphonomous** | Complementary graph engines — Graphonomous for agent-side continual learning (automatic, edge-native, Elixir/OTP), BendScript for human-built knowledge (interactive, visual, SvelteKit). Agents can query both: Graphonomous for what the agent has learned, BendScript for what humans have curated. |
| **OpenSentience** | Agents deployed to OpenSentience can query BendScript workspaces as KAG backends via MCP. BendScript graphs provide domain knowledge; OpenSentience provides runtime governance. |
| **FleetPrompt** | BendScript MCP server can be listed as a capability provider in FleetPrompt's marketplace. Agents discover and connect to BendScript workspaces for domain-specific knowledge retrieval. |
| **Agentelic** | Agents built in Agentelic can declare BendScript KAG as a dependency in their spec. The build pipeline validates that the agent can reach its required BendScript workspace. |
| **Delegatic** | Multi-agent orchestration can route knowledge queries to BendScript workspaces based on domain — different agents query different graphs via Delegatic's routing policies. |

### 7.3 Graphonomous vs BendScript

| Dimension | Graphonomous | BendScript |
|-----------|-------------|------------|
| Who builds the graph | Agent (automatic, from inference) | Human (interactive, on canvas) |
| Primary consumer | Agent (retrieve context for LLM) | Agent (KAG queries) + Human (visual exploration) |
| Graph construction | Continual learning pipeline | AI synthesis tiers + manual editing |
| Node types | Episodic, semantic, procedural, temporal, outcome, goal | Normal, stargate |
| Edge semantics | Weighted, decaying, co-activated | Typed (causal, temporal, associative, context, custom) |
| Storage | SQLite (edge) / Postgres (server) | Supabase (Postgres) |
| Stack | Elixir/OTP | SvelteKit/TypeScript |
| API | MCP (stdio + streamable HTTP) | MCP (streamable HTTP) + REST |
| Consolidation | Sleep-cycle pruning/merging | Manual curation on canvas |

---

## 8. Project Structure

```
bendscript/
├── src/
│   ├── lib/
│   │   ├── engine/              # Canvas, physics, renderer — pure JS
│   │   │   ├── physics.js       # Force simulation (repulsion + spring + damping)
│   │   │   ├── renderer.js      # rAF draw loop (nodes, edges, background)
│   │   │   ├── camera.js        # World ↔ screen coordinate transforms
│   │   │   ├── graph.js         # Node + edge CRUD
│   │   │   ├── planes.js        # Multi-plane system + Stargate portals
│   │   │   ├── hittest.js       # nodeAtPoint, edgeAtPoint, resize handle
│   │   │   └── input.js         # Pointer / keyboard event handlers
│   │   ├── stores/              # Svelte writable stores wrapping engine state
│   │   ├── supabase/            # Client, typed queries, realtime helpers
│   │   └── ai/                  # Claude API client, prompts, graph synthesis parser
│   ├── routes/
│   │   ├── (marketing)/         # Public landing page (graph demo, no auth)
│   │   ├── (app)/graph/[id]/    # Main canvas view
│   │   ├── (app)/dashboard/     # Workspace graph list
│   │   ├── share/[id]/          # Public read-only graph view
│   │   ├── auth/                # Login, OAuth callback
│   │   └── api/
│   │       ├── ai/              # Server-side Claude proxy route
│   │       └── mcp/             # MCP server endpoint (Streamable HTTP)
│   └── components/
│       ├── canvas/              # GraphCanvas, HUD, Composer, Inspectors, ContextMenu
│       ├── ui/                  # Pill, Button, Modal
│       └── workspace/           # Nav, GraphCard, MemberList
├── ampersand-supabase/
│   ├── migrations/              # SQL schema + RLS policies
│   └── functions/ai-proxy/      # Anthropic Edge Function
├── tests/
│   ├── unit/engine/             # Physics + graph logic (Vitest)
│   └── e2e/                     # Canvas interaction (Playwright)
├── prompts/                     # Implementation prompts
│   ├── BUILD.md                 # SvelteKit + Supabase migration spec
│   ├── MIGRATION_PROMPT.md      # Engine extraction spec
│   └── CODEX_COMPLETION_PROMPT.md  # Codex completion spec
├── svelte.config.js
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── eslint.config.js
├── wrangler.toml
├── AGENTS.md                    # Agent discovery specification
└── README.md
```

---

## 9. Interaction Model

| Action | Result |
|--------|--------|
| Type in Composer + submit | Spawns a user node + AI response node, connected by a labeled edge |
| Click a Stargate node | Warp transition into the node's nested sub-graph plane |
| Drag a node | Repositions it; physics simulation respects pinned nodes |
| Scroll on a node | Scrolls the node's text content |
| Right-click a node | Context menu: fork, merge, pin, convert to Stargate, delete |
| Click an edge | Opens Edge Inspector: edit label, kind, strength |
| Click Breadcrumb | Navigates up to that ancestor plane |
| Toggle Edit / Preview | Switches between authoring and read-only presentation |

### 9.1 Visual Language

- Light void background (`#f4f6f8`) — clean, spatial, minimal chrome
- Nodes are rounded-rect cards with gradient fills and chromatic headers
- Stargate nodes have a spinning dual-arc animation (event horizon effect)
- Edges are directional lines with arrowheads and labeled relationship text
- Force-directed physics — nodes breathe and settle with spring/repulsion simulation
- Warp flash transition when entering a Stargate plane
- HUD pills and breadcrumbs in `ui-monospace` — graph data as ambient interface

---

## 10. Competitive Positioning

| Tool | What It Does | BendScript Differentiator |
|------|-------------|--------------------------|
| **Flowith** (1M+ users) | Infinite canvas AI workspace, Agent Neo, FlowithOS desktop agent | No fractal depth; AI is task-agentic, not graph-structural; no KAG/MCP API |
| **Heptabase** ($7M ARR) | Visual canvas PKM, whiteboard + card linking, AI annotation | No AI that generates structure; AI assists reading, not graph building |
| **Obsidian Canvas** | Spatial layout of notes with graph view | Manual structure only; AI is a plugin layer, not the core mechanic |
| **Canvas Chat** (OSS) | Infinite canvas, DAG-aware branching chat | Flat tree; AI sees history, not topology; no nested planes |
| **Tana** | Structured PKM with supertags and AI | Text/outline-first; no spatial canvas or fractal depth |
| **Neo4j + OpenSPG** | Enterprise knowledge graph infrastructure | Requires DevOps team; no interactive visual builder; developer-only |

**Three differentiators no competitor offers together:**

1. **Fractal depth via Stargates** — Nodes are portals into new graph planes, not flat branches
2. **Topology-aware AI synthesis (Tier 2-4)** — The model receives graph structure as generative input
3. **KAG server** — Graphs are queryable knowledge backends for any agent via MCP/REST

---

## 11. Pre-Phase Feasibility Validation (Weeks 0-2)

Before committing to the full roadmap, validate the highest-risk technical assumptions:

| Gate | Validates | Pass Criteria | Fallback |
|------|-----------|---------------|----------|
| **FV-1: Canvas Performance at Scale** | Force-directed physics simulation with 200+ nodes at 60fps on mid-range hardware (M1 MacBook Air, 8GB) | Sustained 60fps with 200 nodes, 300 edges; frame budget <16ms; no GC jank | Implement spatial indexing (quadtree) in Phase 0 instead of Phase 1; reduce physics tick rate to 30fps for large graphs |
| **FV-2: KAG-Solver Accuracy** | That typed edge traversal + pgvector similarity produces meaningfully better answers than flat vector search alone on a 500-node test graph | Multi-hop query accuracy >70% on a curated 50-question benchmark (vs. vector-only baseline); latency <500ms | Simplify to "vector search + 1-hop expansion" for v1; defer full logical form decomposition to Phase 3 |
| **FV-3: Supabase Realtime Collaboration** | Concurrent editing by 5 users on a shared graph with node position + text sync via Supabase Realtime broadcast | No lost updates; position sync latency <200ms; text conflicts resolved by last-write-wins | Defer collaboration to Phase 3; ship single-user-per-graph for v1 |
| **FV-4: AI Tier 2 Graph Context Window** | That sending graph topology (nodes + edges + plane context) as structured JSON stays within prompt budget while producing topology-aware responses | Tier 2 responses demonstrably reference graph structure (not just text); context fits within 8K tokens for 50-node graphs | Reduce context to nearest 20 nodes by graph distance; use embedding-based selection instead of full topology |

### 11.1 Acceptance Test Criteria

**Canvas Engine:**
- Given a new graph → root plane is created with 0 nodes
- Given a Composer prompt submission → 2 nodes (user + response) are created with a labeled edge
- Given a Stargate click → warp transition fires and breadcrumb updates within 200ms
- Given a pinned node → physics simulation does not move it; unpinned neighbors still settle
- Given 200 nodes → frame rate stays above 55fps (measured via `performance.now()` in rAF loop)

**AI Synthesis:**
- Given a Tier 1 prompt → response contains `{ text, type, edgeLabel, edgeKind }` fields
- Given a Tier 2 prompt with 10-node context → response references at least 1 existing node by semantic overlap
- Given a Tier 3 topic → response generates 8-12 nodes with typed edges and optional Stargate suggestions
- Given a Free plan user → AI calls use Haiku 4.5 model; Paid plan uses Sonnet 4.6

**KAG Server:**
- Given `search_nodes({ query: "machine learning" })` → returns nodes ranked by pgvector similarity
- Given `traverse_path({ from: "A", to: "B", max_hops: 3 })` → returns ordered path with edge labels or empty if no path
- Given `build_from_text({ text: "..." })` → creates nodes and edges; no duplicate entities if overlap exists
- Given an unauthenticated MCP request → returns 401 with clear error message

**Multi-Tenancy:**
- Given User A in Workspace 1 → cannot read/write Workspace 2 data (RLS enforced at DB layer)
- Given a deleted workspace → all planes, nodes, edges, and generations are cascade-deleted

**Data Freedom:**
- Given JSON export → reimporting the same JSON produces an identical graph (round-trip fidelity)
- Given Mermaid export → output renders correctly in GitHub Markdown preview

### 11.2 [&] Protocol Integration Detail

BendScript provides `&memory.graph` as a KAG capability. Integration with the broader [&] ecosystem:

**ampersand.json example for an agent using BendScript:**
```json
{
  "$schema": "https://protocol.ampersandboxdesign.com/schema/v0.1.0/ampersand.schema.json",
  "agent": "DomainExpert",
  "version": "1.0.0",
  "capabilities": {
    "&memory.graph": {
      "provider": "bendscript",
      "config": { "workspace_id": "ws_acme_engineering" }
    },
    "&memory.graph.learned": {
      "provider": "graphonomous",
      "config": { "instance": "domain-expert" }
    },
    "&reason.argument": {
      "provider": "deliberatic",
      "config": { "governance": "evidence-first" }
    }
  },
  "governance": {
    "hard": ["Never modify human-curated nodes without approval"],
    "soft": ["Prefer BendScript knowledge over Graphonomous for domain-specific queries"],
    "escalate_when": { "confidence_below": 0.6 }
  }
}
```

**`&govern.telemetry` integration:**
BendScript emits telemetry events for KAG API queries via `&govern.telemetry.emit`:
- `kag.query` — query_graph, traverse_path, search_nodes calls
- `kag.build` — build_from_text entity extraction events
- `ai.generation` — all AI tier calls with token counts and cost

These feed into Delegatic budget enforcement — an org's `max_cost_usd_per_period` limit applies across all [&] capabilities including BendScript KAG queries.

**Graphonomous cross-query pattern:**
Agents can query both knowledge backends in a single pipeline:
```
query |> &memory.graph[bendscript].search() |> &memory.graph[graphonomous].enrich() |> &reason.argument.evaluate()
```
BendScript provides human-curated domain knowledge; Graphonomous provides agent-learned operational knowledge. The pipeline composes them before reasoning.

---

## 12. Implementation Roadmap

### Phase 0: Foundation — v1.0 Launch (Weeks 3-10)

- [ ] Extract canvas engine from prototype into SvelteKit component architecture
- [ ] Supabase persistence — schema, RLS, graph load/save
- [ ] Auth — email + Google OAuth, auto-created personal workspace
- [ ] AI Tier 1-2 — contextual response + graph-aware synthesis (core differentiator)
- [ ] AI proxy via Supabase Edge Function (key never client-side)
- [ ] Tiered model routing — Haiku 4.5 for Free, Sonnet 4.6 for Paid
- [ ] Prompt caching on system prompts (90% input cost reduction on cache hits)
- [ ] `ai_generations` logging with composite index for rate-limit queries
- [ ] JSON export — full graph state from day one
- [ ] Public graph sharing — read-only `/share/[id]` URL (growth loop)
- [ ] MCP endpoint (read-only) — `search_nodes` + `get_subgraph`
- [ ] AGENTS.md — agent discovery file

### Phase 1: Polish + Export (Weeks 11-16)

- [ ] Markdown outline export
- [ ] Mermaid diagram export
- [ ] AI Tier 3 — topic-to-graph full subgraph generation (= KAG-Builder)
- [ ] JSON import for backup/restore
- [ ] Quadtree spatial index (unlocks 500+ node graphs)
- [ ] Undo/redo stack — immutable state snapshots
- [ ] Comparison SEO pages — BendScript vs Flowith, Heptabase, Obsidian Canvas

### Phase 2: KAG API + MCP Full (Weeks 17-24)

- [ ] pgvector semantic search — node embeddings + mutual indexing
- [ ] KAG REST API — `/api/kag/query` endpoint (KAG-Solver)
- [ ] KAG MCP Server — full read/write tools via Streamable HTTP
- [ ] `traverse_path` — multi-hop reasoning with edge-type filtering
- [ ] `query_graph` — natural language → logical form → traversal
- [ ] `build_from_text` — document ingestion → entity/relation extraction
- [ ] KAG API dashboard — usage analytics, query logs, cost tracking

### Phase 3: Collaboration + Enterprise (Weeks 25-34)

- [ ] Real-time collaboration — Supabase Realtime broadcast, node sync
- [ ] Team workspaces with role-based access (owner/admin/member/viewer)
- [ ] AI Tier 4 — edge inference on node creation
- [ ] Mobile optimization — pinch zoom, two-finger pan, long-press menu
- [ ] Graph templates library (community-contributed starter graphs)
- [ ] Enterprise SSO + audit logging

### Phase 4: Ecosystem Integration (Weeks 35-42)

- [ ] LangChain/LlamaIndex retriever — drop-in KAG replacement for vector-only retrieval
- [ ] Embedded reasoning page — iframe/web component for inline Q&A
- [ ] Graphonomous cross-query — agents query both BendScript (human knowledge) and Graphonomous (learned knowledge) in a single MCP session
- [ ] FleetPrompt listing as capability provider
- [ ] OpenSentience agent manifest integration

---

## 13. Pricing

### 12.1 Canvas Plans (for Humans)

| Plan | Price | Graphs | Nodes/Graph | Collaboration | AI Generations |
|------|-------|--------|-------------|---------------|----------------|
| Free | $0/mo | 5 | 100 | -- | 20 T1 / 5 T2 / 2 T3 per day (Haiku only) |
| Pro | $12/mo | Unlimited | 500 | -- | 80 T1 / 15 T2 / 5 T3 per day (Sonnet) |
| Teams | $22/seat/mo | Unlimited | 1,000 | Real-time | 1,000/mo shared pool, all tiers (Sonnet) |
| Business | $18/seat/mo (10+) | Unlimited | Unlimited | + SSO + audit log | 5,000/mo + edge inference (Sonnet) |
| Enterprise | Custom | Unlimited | Unlimited | + on-prem option | Custom / self-hosted model |

### 12.2 KAG API Plans (for Agents)

| Plan | Price | API Queries | MCP Endpoint | Webhook | Notes |
|------|-------|-------------|--------------|---------|-------|
| Pro (included) | $12/mo | 200/mo (read-only) | Read-only | -- | Canvas building only |
| KAG API | $49/mo | 5,000/mo | Full | Yes | Single workspace; personal agents |
| KAG Teams | $99/mo | 20,000/mo | Full | Yes | Multi-workspace; shared team graphs |
| KAG Enterprise | Custom | Unlimited | Full | Yes | Self-hosted option; SLA; SSO; audit log |

### 12.3 AI Cost Model

All costs reflect March 2026 Anthropic API pricing: Haiku 4.5 at $1/$5 per MTok, Sonnet 4.6 at $3/$15 per MTok. Prompt caching reduces cached input token costs by 90%.

| AI Tier | Model (Free) | Model (Paid) | Cost/Call (Free) | Cost/Call (Paid) | With Cache (Paid) |
|---------|-------------|-------------|-----------------|-----------------|-------------------|
| Tier 1 — Contextual | Haiku 4.5 | Sonnet 4.6 | $0.0038 | $0.0114 | $0.0093 |
| Tier 2 — Graph-aware | Haiku 4.5 | Sonnet 4.6 | $0.0105 | $0.0315 | $0.0240 |
| Tier 3 — Topic-to-graph | Haiku 4.5 | Sonnet 4.6 | $0.0240 | $0.0720 | $0.0630 |
| Tier 4 — Edge inference | -- | Sonnet 4.6 | -- | $0.0195 | $0.0150 |

**Required optimizations:**
- **Prompt caching** — System prompts are identical across same-tier calls; 90% cost reduction on cache hits
- **Tiered model routing** — Haiku for Free, Sonnet for Paid (5x cost difference per token)
- **Generation logging** — Every call writes to `ai_generations` with token counts for cost visibility

---

## 14. Success Criteria

### MVP (Phase 0-1 complete, ~14 weeks)

| Metric | Target |
|--------|--------|
| Activation rate (landing page visitors who submit Composer prompt) | >25% |
| Graph-to-signup conversion | >8% |
| T2 engagement (paid users using Tier 2+ weekly) | >40% |
| Share rate (graphs with `/share/[id]` link) | >10% |
| Free → Pro monthly conversion | >4% |

### Product-Market Fit (Phase 2 complete, ~22 weeks)

| Metric | Target |
|--------|--------|
| Paying customers | 500+ |
| KAG API subscribers | 50+ |
| Monthly KAG API queries | 100K+ |
| Public shared graphs | 1,000+ |
| NPS | 50+ |

---

## 15. Open Questions

1. **Quadtree vs spatial hashing:** For 500+ node graphs, which spatial indexing approach gives better performance on the force-directed canvas? Quadtree is standard but spatial hashing may be simpler for the hit-testing use case.

2. **pgvector vs dedicated vector DB:** Supabase's pgvector is convenient (same database), but at scale, will it match the query performance of a dedicated vector service? Initial choice is pgvector for operational simplicity.

3. **KAG-Solver complexity:** Full logical form decomposition (as in OpenSPG/KAG) is a research-grade system. BendScript's v1 KAG-Solver may need to be a simplified version — typed edge traversal + vector search — before attempting full logical form reasoning.

4. **Collaboration conflict resolution:** Supabase Realtime broadcast handles position sync, but concurrent node text edits need a conflict strategy. OT or CRDT? Or last-write-wins for v1?

5. **Self-hosted option:** Enterprise customers may want on-prem BendScript. SvelteKit + Supabase self-hosted is possible but adds significant support burden. Evaluate demand before building.

---

*[&] Ampersand Box Design — bendscript.com*
