# BendScript Architecture

System architecture for the BendScript knowledge graph editor and KAG server.

---

## Component Overview

BendScript has five major subsystems:

```
┌────────────────────────────────────────────────────────────────┐
│                        BENDSCRIPT                              │
├──────────────────────┬─────────────────────────────────────────┤
│  Canvas Engine       │  MCP / REST API                         │
│  (humans)            │  (agents)                               │
├──────────────────────┴─────────────────────────────────────────┤
│  AI Graph Synthesis (4 tiers)                                  │
├────────────────────────────────────────────────────────────────┤
│  KAG Solver + Builder                                          │
├────────────────────────────────────────────────────────────────┤
│  Graph Store (Supabase + pgvector)                             │
├────────────────────────────────────────────────────────────────┤
│  Deploy: Cloudflare Pages + Supabase Cloud                     │
└────────────────────────────────────────────────────────────────┘
```

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Canvas Engine | Force-directed rendering, physics, hit testing, camera | Pure JS, HTML5 Canvas, requestAnimationFrame |
| SvelteKit App | Routing, SSR, component framework, reactive stores | SvelteKit 2.x, TypeScript |
| Supabase Backend | Graph persistence, auth, RLS, realtime collaboration | Postgres 16+, pgvector, Supabase Auth |
| AI Proxy | Server-side Claude API calls, rate limiting per plan | Supabase Edge Functions |
| MCP Server | Streamable HTTP/SSE transport exposing graph tools | TypeScript, MCP SDK |

---

## Data Flow

### User Interaction Flow

```
User action (click/drag/type)
  │
  ▼
Canvas Engine (input.js → graph.js → physics.js)
  │
  ▼
Svelte Store (reactive wrapper over engine state)
  │
  ▼
Supabase Client (upsert node/edge)
  │
  ▼
Postgres (RLS enforced) + Realtime broadcast
  │
  ▼
Other connected clients receive update
```

### AI Synthesis Flow

```
User prompt (Composer bar)
  │
  ▼
SvelteKit API route (+server.ts)
  │
  ▼
Supabase Edge Function (AI Proxy)
  │  ├── Tier selection (1-4)
  │  ├── Graph context assembly (for Tier 2+)
  │  └── Prompt caching check
  │
  ▼
Anthropic Claude API
  │
  ▼
Structured response (nodes + edges JSON)
  │
  ▼
Canvas Engine (insert nodes, create edges, run physics)
```

### KAG Query Flow

```
Agent query (MCP tool or REST endpoint)
  │
  ▼
KAG Solver
  ├── 1. Decompose query → logical forms
  ├── 2. Match forms to graph operations
  ├── 3. Traverse edges (typed, multi-hop, 2-5 hops)
  ├── 4. Vector search via pgvector (semantic similarity)
  └── 5. Assemble subgraph + reasoning path
  │
  ▼
Structured response with provenance
```

---

## Engine Module Breakdown

The canvas engine is pure JavaScript — no framework dependency. It runs at 60fps
via `requestAnimationFrame`.

| Module | File | Responsibility |
|--------|------|---------------|
| Physics | `physics.js` | Force-directed layout: spring attraction, charge repulsion, damping, velocity integration |
| Renderer | `renderer.js` | Canvas 2D drawing: nodes (rounded-rect cards), edges (bezier curves), selection highlights, Stargate animations |
| Camera | `camera.js` | Pan, zoom, world-to-screen coordinate transforms |
| Graph | `graph.js` | Node/edge CRUD, adjacency lists, graph state management |
| Planes | `planes.js` | Multi-plane navigation, Stargate portal transitions, breadcrumb state |
| Hit Test | `hittest.js` | Point-in-node detection, edge proximity, click target resolution |
| Input | `input.js` | Mouse/touch/keyboard event handling, drag, selection, mode switching |
| Markdown | `markdown.js` | Markdown parsing for node text rendering on canvas |

### Module Interaction

```
input.js ──► graph.js ──► physics.js ──► renderer.js
   │              │                          │
   │              ▼                          │
   │         planes.js                       │
   │              │                          │
   ▼              ▼                          ▼
hittest.js   camera.js ◄──────────────── (transforms)
```

`input.js` captures user events and delegates to `graph.js` for state changes.
`physics.js` runs the force simulation each frame. `renderer.js` draws the
current state using `camera.js` transforms. `hittest.js` resolves click targets
in world coordinates.

---

## Multi-Tenant Isolation

BendScript uses Supabase Row-Level Security (RLS) for tenant isolation at the
database layer.

### Workspace Hierarchy

```
workspace
  ├── workspace_members (user_id, role)
  ├── graph_planes
  │     ├── nodes
  │     └── edges
  └── ai_generations
```

Every table has a `workspace_id` column. RLS policies enforce:

- **SELECT:** user must be a member of the workspace
- **INSERT/UPDATE:** user must have `member`, `admin`, or `owner` role
- **DELETE:** user must have `admin` or `owner` role

On first sign-in, a personal workspace is auto-created. Users can be invited
to additional workspaces with specific roles.

### Roles

| Role | Read | Write | Delete | Manage Members | Billing |
|------|------|-------|--------|---------------|---------|
| viewer | yes | no | no | no | no |
| member | yes | yes | no | no | no |
| admin | yes | yes | yes | yes | no |
| owner | yes | yes | yes | yes | yes |

---

## AI Synthesis Pipeline

Four tiers of AI integration, each sending progressively more graph context
to the model.

| Tier | Name | Input | Output | Tokens (in/out) |
|------|------|-------|--------|-----------------|
| 1 | Contextual response | Prompt text | 2 nodes (user + response) | ~800 / ~600 |
| 2 | Graph-aware synthesis | Prompt + graph topology | 2-4 nodes fitting structure | ~3,000 / ~1,500 |
| 3 | Topic-to-graph | Topic string | 8-12 node subgraph with edges | ~4,000 / ~4,000 |
| 4 | Edge inference | New node + existing graph | Suggested connections | ~2,500 / ~800 |

### Model Routing

| Plan | Tiers 1-3 | Tier 4 |
|------|-----------|--------|
| Free | Haiku 4.5 | not available |
| Paid | Sonnet 4.6 | Sonnet 4.6 |

Prompt caching is enabled for graph context in Tiers 2-3 to reduce latency
and cost on repeated synthesis within the same graph.

---

## Data Model

Six core tables in Postgres:

```sql
workspaces          (id, name, slug, plan, stripe_customer_id)
workspace_members   (workspace_id, user_id, role)
graph_planes        (id, workspace_id, graph_id, name, parent_plane_id, is_root)
nodes               (id, plane_id, workspace_id, text, type, x, y, pinned, portal_plane_id)
edges               (id, plane_id, workspace_id, node_a, node_b, label, kind, strength)
ai_generations      (id, workspace_id, user_id, prompt, tier, tokens_used, nodes_spawned)
```

`graph_planes.parent_plane_id` creates the Stargate hierarchy. `nodes.portal_plane_id`
links Stargate nodes to the planes they open.

---

## Deployment Architecture

```
Cloudflare Pages (SvelteKit adapter-cloudflare)
  │
  ├── Static assets (CDN-distributed)
  ├── Server routes (Cloudflare Workers)
  └── MCP server endpoint
  │
  ▼
Supabase Cloud
  ├── Postgres 16+ (graph data, RLS)
  ├── pgvector (embeddings for KAG)
  ├── Auth (email + Google OAuth)
  ├── Realtime (broadcast channels)
  └── Edge Functions (AI proxy)
       │
       ▼
  Anthropic Claude API
```

SvelteKit compiles to minimal JavaScript. The canvas engine runs as pure JS
with no virtual DOM overhead — critical for 60fps rendering. SSR is used for
the landing page and shared graph previews (SEO).
