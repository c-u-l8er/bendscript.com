# BendScript — Script Bending Through Graph Space

> A knowledge graph that thinks about its own shape.

BendScript is a multi-tenant, AI-powered knowledge graph editor built on SvelteKit + Supabase. Conversation flows through interconnected node graphs — every node is a context, every edge is a typed relationship, and every Stargate is a portal into a deeper graph plane.

---

## Core Concept: Script Bending

"Script bending" is the manipulation of conversational and computational flows through graph topology. Instead of linear chat, users interact with a living graph where:

- **Nodes** are contexts — prompts, responses, ideas, code, or sub-worlds
- **Edges** are typed relationships — causal, associative, temporal, context, or user-defined
- **Stargates** are special nodes that portal into entirely new graph planes, creating fractal depth
- **Bending** is the act of reshaping the graph — forking paths, merging contexts, warping connections
- **AI synthesis** generates new nodes and edges that understand the graph's existing topology — not just your text

---

## The Interface

The landing page IS the product. Users land directly into a graph-based environment:

1. **Canvas** — an infinite, force-directed graph rendered on HTML5 Canvas
2. **Composer bar** — a floating prompt input that spawns node pairs (user → AI response)
3. **Stargates** — portal nodes that open into nested sub-graphs (new context planes)
4. **Breadcrumbs** — show depth path through nested planes; click to navigate up
5. **Inspectors** — right-panel editors for node text/type and edge metadata
6. **Edit / Preview modes** — toggle between authoring and read-only presentation

---

## Visual Language

- Light void background (`#f4f6f8`) — clean, spatial, minimal chrome
- Nodes are rounded-rect cards with gradient fills and chromatic headers
- Stargate nodes have a spinning dual-arc animation (event horizon effect)
- Edges are directional lines with arrowheads and labeled relationship text
- Force-directed physics — nodes breathe and settle with spring/repulsion simulation
- Warp flash transition when entering a Stargate plane
- HUD pills and breadcrumbs in `ui-monospace` — graph data as ambient interface

---

## Interaction Model

| Action | Result |
|---|---|
| Type in Composer + submit | Spawns a user node + AI response node, connected by a labeled edge |
| Click a Stargate node | Warp transition into the node's nested sub-graph plane |
| Drag a node | Repositions it; physics simulation respects pinned nodes |
| Scroll on a node | Scrolls the node's text content |
| Right-click a node | Context menu: fork, merge, pin, convert to Stargate, delete |
| Click an edge | Opens Edge Inspector: edit label, kind, strength |
| Click Breadcrumb | Navigates up to that ancestor plane |
| Toggle Edit / Preview | Switches between authoring and read-only mode |

---

## AI Graph Synthesis

The Composer connects to the Anthropic Claude API. The AI doesn't just respond with text — it reasons about your graph's structure and returns nodes and edges that fit the topology.

**Tier 1 — Contextual response:** Prompt → AI returns `{ text, type, edgeLabel, edgeKind }` → spawns 2 nodes.

**Tier 2 — Graph-aware synthesis:** Prompt + current graph context → AI returns array of 2–4 nodes that semantically fit the existing structure.

**Tier 3 — Topic-to-graph:** Type a topic → AI returns a full subgraph of 8–12 nodes with typed edges, Stargate suggestions, and depth hierarchy. The graph IS the answer.

**Tier 4 — Edge inference:** On new node creation, AI suggests which existing nodes it should connect to and why.

---

## Seed Graph (Initial State for New Users)

```
[BendScript] ──defines──► [What is Script Bending?]
     │                              │
     │                         ──expands──► [Bend the flow of scripts]
     │
     ├──portals──► [⊛ Stargates]
     │                   │
     │              ──examples──► [⊛ Examples]
     │
     ├──interaction model──► [Graph Prompting]
     │                              │
     │                        ──hands-on──► [⊛ Try It]
     │
     └──spec backbone──► [The Protocol]
                               │
                         ──deep context──► [⊛ Deep Dive]
```

Nodes marked `⊛` are Stargates that open into deeper graph contexts.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | SvelteKit (latest stable) | Routing, SSR, component framework |
| Canvas | HTML5 Canvas + vanilla JS | Graph rendering, physics, input |
| State | Svelte stores | Reactive wrappers over engine state |
| Backend | Supabase (Postgres) | Graph persistence, multi-tenancy |
| Auth | Supabase Auth | Email + Google OAuth, workspace isolation |
| Realtime | Supabase Realtime (broadcast) | Live collaboration — node positions + text |
| AI | Anthropic Claude API (claude-sonnet-4-5) | Graph synthesis, contextual responses |
| AI Proxy | Supabase Edge Functions | Server-side Claude API calls (key never exposed) |
| Vector search | pgvector | Semantic node similarity (Phase 2) |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Deploy | Cloudflare Pages + Supabase cloud | Static frontend + managed backend |

---

## Architecture

```
bendscript/
├── src/
│   ├── lib/
│   │   ├── engine/         # Canvas, physics, renderer — pure JS, no framework
│   │   │   ├── physics.js      # Force simulation (repulsion + spring + damping)
│   │   │   ├── renderer.js     # rAF draw loop (drawNodes, drawEdges, drawBackground)
│   │   │   ├── camera.js       # World ↔ screen coordinate transforms
│   │   │   ├── graph.js        # Node + edge CRUD
│   │   │   ├── planes.js       # Multi-plane system + Stargate portals
│   │   │   ├── hittest.js      # nodeAtPoint, edgeAtPoint, resize handle
│   │   │   └── input.js        # Pointer / keyboard event handlers
│   │   ├── stores/         # Svelte writable stores wrapping engine state
│   │   ├── supabase/       # Client, typed queries, realtime helpers
│   │   └── ai/             # Claude API client, prompts, graph synthesis parser
│   ├── routes/
│   │   ├── (marketing)/    # Public landing page (graph demo, no auth)
│   │   ├── (app)/graph/[id]/  # Main canvas view
│   │   ├── (app)/dashboard/   # Workspace graph list
│   │   ├── share/[id]/        # Public read-only graph view
│   │   ├── auth/              # Login, OAuth callback
│   │   └── api/ai/            # Server-side Claude proxy route
│   └── components/
│       ├── canvas/         # GraphCanvas, HUD, Composer, Inspectors, ContextMenu
│       ├── ui/             # Pill, Button, Modal
│       └── workspace/      # Nav, GraphCard, MemberList
├── supabase/
│   ├── migrations/         # SQL schema + RLS policies
│   └── functions/ai-proxy/ # Anthropic Edge Function
└── tests/
    ├── unit/engine/        # Physics + graph logic (Vitest)
    └── e2e/                # Canvas interaction (Playwright)
```

---

## Multi-tenancy

BendScript uses a **workspace-level tenancy model**:

- Every user belongs to one or more workspaces
- Workspaces contain graphs, which contain planes, which contain nodes and edges
- Row-level security (RLS) in Postgres enforces tenant isolation at the database layer
- On first sign-in, a personal workspace is automatically created
- Teams can be invited to shared workspaces with roles: owner / admin / member / viewer

---

## Data Model

```
workspaces          → name, slug, plan, stripe_customer_id
workspace_members   → workspace_id, user_id, role
graph_planes        → workspace_id, graph_id, name, parent_plane_id, is_root
nodes               → plane_id, workspace_id, text, type, x, y, pinned, portal_plane_id
edges               → plane_id, workspace_id, node_a, node_b, label, kind, strength
ai_generations      → workspace_id, user_id, prompt, tier, tokens_used, nodes_spawned
```

---

## Pricing

| Plan | Price | Graphs | Nodes/graph | Collaboration | AI |
|---|---|---|---|---|---|
| Free | $0/mo | 3 | 50 | — | 10 generations/day |
| Pro | $15/mo | Unlimited | 500 | — | 100/day + topic-to-graph |
| Teams | $25/seat/mo | Unlimited | 1,000 | ✓ Real-time | 1,000/mo shared pool |
| Business | $20/seat/mo (10+) | Unlimited | Unlimited | ✓ + SSO + audit log | 5,000/mo + edge inference |
| Enterprise | Custom | Unlimited | Unlimited | ✓ + on-prem option | Custom / self-hosted model |

---

## Deployment

**Frontend:** Cloudflare Pages (SvelteKit adapter-cloudflare)
```bash
npm run build
# Deploys to Cloudflare Pages automatically via Git integration
```

**Backend:** Supabase cloud project
```bash
supabase db push          # Apply migrations
supabase functions deploy ai-proxy  # Deploy Edge Function
```

**Environment variables:**
```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # Server-only
ANTHROPIC_API_KEY=sk-ant-...                       # Edge Function only — never client
```

---

## Development

```bash
# Install
npm install

# Local dev (Supabase CLI required for local backend)
supabase start
npm run dev

# Run tests
npm run test:unit     # Vitest
npm run test:e2e      # Playwright

# Build
npm run build
npm run preview
```

---

## Positioning

BendScript is where **prompts become topology**. Instead of flat chat, you navigate a living graph of interconnected ideas — and every node is a doorway to somewhere deeper.

The differentiator: the only knowledge graph tool where the AI reasons about the graph's existing shape when generating new content. It doesn't answer your question — it *extends your thinking*.

**Script bending = thinking in graphs.**

---

## Roadmap

- [x] HTML prototype — canvas, physics, planes, Markdown, localStorage
- [ ] SvelteKit migration — extract engine, Svelte stores, component structure
- [ ] Supabase persistence — schema, RLS, graph load/save
- [ ] Auth + workspaces — email, OAuth, multi-tenancy
- [ ] AI Tier 1–2 — contextual + graph-aware synthesis (replace stub)
- [ ] Real-time collaboration — Supabase broadcast, node sync
- [ ] AI Tier 3 — topic-to-graph full subgraph generation
- [ ] Public graph sharing — read-only `/share/[id]` URL
- [ ] Undo/redo stack — immutable state snapshots
- [ ] Semantic search — pgvector node embeddings
- [ ] Mobile optimization — pinch zoom, two-finger pan, long-press menu
- [ ] AI Tier 4 — edge inference on node creation
- [ ] Graph templates library
- [ ] API access for workspace graphs
- [ ] Quadtree spatial index (unlocks 1,000+ node graphs)
- [ ] Enterprise SSO + audit logging

---

*BendScript is built by [Ampersand Box Design](https://ampersandboxdesign.com) — Copyright 2026*
