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

The landing page IS the product. Users land directly into a graph-based environment — no account required to feel it:

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

**Tier 2 — Graph-aware synthesis:** Prompt + current graph context (nodes + edges) → AI returns 2–4 nodes that semantically fit the existing structure. The graph shape influences the response, not just the text.

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
| AI | Anthropic Claude API (tiered model routing) | Haiku for Tier 1 (Free), Sonnet for Tier 2–4 (paid); prompt caching enabled |
| AI Proxy | Supabase Edge Functions | Server-side Claude API calls (key never exposed), rate limiting per plan |
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

## Positioning

BendScript is where **prompts become topology**. Instead of flat chat, you navigate a living graph of interconnected ideas — and every node is a doorway to somewhere deeper.

**Script bending = thinking in graphs.**

### Who It's For

BendScript targets two high-intent early adopter groups:

**PKM power users** who've hit the ceiling of linear tools — people already using Heptabase, Obsidian Canvas, or Roam who want AI that *generates* graph structure, not just assists reading. They already know spatial thinking works; they want an AI that speaks that language natively and builds the graph alongside them.

**Researchers, developers, and complex thinkers** doing multi-branch work — people who've tried canvas AI tools (Flowith, Canvas Chat) and want the AI to reason about *graph structure*, not just execute tasks on a flat canvas. Or people who work in visual node editors (ComfyUI, LangGraph Studio) and want that energy applied to knowledge work rather than pipelines.

### Competitive Landscape

The canvas-AI space is active and growing. Key tools in the same territory:

| Tool | What it does | Users | The gap BendScript fills |
|---|---|---|---|
| **Flowith** | Infinite canvas AI workspace with Agent Neo (autonomous), Knowledge Garden, 40+ models, real-time collab | 1M+ (YC China) | No fractal depth — flat canvas only; no topology-aware synthesis; AI is general-purpose agentic, not graph-structural |
| **Canvas Chat** (OSS) | Infinite canvas, DAG-aware branching chat with merge/synthesis | OSS | Flat tree; AI sees conversation history, not graph topology; no nested planes |
| **Thinkvas** | Branching AI conversations with context inheritance, long-term memory | Early | Linear branch model; no typed edges, no graph topology as AI input, no sub-planes |
| **Heptabase** | Visual canvas PKM, whiteboard + card linking, AI annotation | 350K+ ($7M ARR) | No AI that *generates* structure; AI assists reading/annotation, not graph building |
| **Obsidian Canvas** | Spatial layout of notes with graph view | Millions | Manual structure only; AI is a plugin layer, not the core mechanic |
| **Tana** | Structured PKM with supertags and AI | Growing | Text/outline-first; no spatial canvas or fractal depth |

> **Note on Flowith:** Flowith is the most direct competitor in terms of market positioning ("canvas + AI"). With 1M+ users and $15–$500/mo pricing, they've validated the category. However, Flowith's AI is task-agentic (autonomous execution, tool orchestration) — not graph-structural. It doesn't send graph topology to the model as generative input, and it has no concept of nested planes. BendScript's differentiator is specifically *topology-aware synthesis* and *fractal depth*, not "canvas + AI" generically.

### The Real Differentiators

Three things BendScript does that no identified competitor currently offers together:

**1. Fractal depth via Stargates.** Nodes are portals into entirely new graph planes. You don't just branch a conversation — you *enter a sub-world*. The depth metaphor creates genuine spatial reasoning across nested contexts, not a flat branching tree. This is architecturally unique in this category.

**2. Topology-aware AI synthesis (Tier 2–4).** The AI receives the current graph's node and edge structure — not just conversation history — and generates new nodes that semantically fit the *shape* of the existing graph. The topology itself becomes prompt context. No existing tool sends graph structure to the model as generative input in this way.

**3. Zero-friction entry.** The landing page is a live, working graph. No signup to feel the product. The value proposition requires spatial experience to land — and it lands on first contact.

---

## Pricing

| Plan | Price | Graphs | Nodes/graph | Collaboration | AI Generations |
|---|---|---|---|---|---|
| Free | $0/mo | 5 | 100 | — | 20 T1 / 5 T2 / 2 T3 per day (Haiku only) |
| Pro | $15/mo | Unlimited | 500 | — | 100 T1 / 30 T2 / 10 T3 per day (Sonnet) |
| Teams | $25/seat/mo | Unlimited | 1,000 | ✓ Real-time | 1,000/mo shared pool, all tiers (Sonnet) |
| Business | $20/seat/mo (10+) | Unlimited | Unlimited | ✓ + SSO + audit log | 5,000/mo + edge inference (Sonnet) |
| Enterprise | Custom | Unlimited | Unlimited | ✓ + on-prem option | Custom / self-hosted model |

> **Note on free tier:** Comparable tools (Heptabase $9–12/mo, Flowith $15–$50/mo) are established with large user bases. The free tier is designed to be genuinely usable for solo exploration while creating natural upgrade pressure. Generation caps are tier-aware (not flat) because Tier 3 calls cost ~6× more than Tier 1. Free tier uses Haiku to control costs; paid tiers upgrade to Sonnet.

---

## AI Cost Model

AI generation costs vary significantly by tier. Pricing viability depends on tiered model routing and prompt caching:

| AI Tier | Model (Free) | Model (Paid) | Est. Input Tokens | Est. Output Tokens | Cost/Call (Free) | Cost/Call (Paid) |
|---|---|---|---|---|---|---|
| Tier 1 — Contextual | Haiku | Sonnet | ~800 | ~600 | $0.004 | $0.011 |
| Tier 2 — Graph-aware | Haiku | Sonnet | ~3,000 | ~1,500 | $0.009 | $0.032 |
| Tier 3 — Topic-to-graph | Haiku | Sonnet | ~4,000 | ~4,000 | $0.024 | $0.072 |
| Tier 4 — Edge inference | — | Sonnet | ~2,500 | ~800 | — | $0.020 |

**Worst-case free user (maxes all daily caps):** ~$2.80/month with Haiku. Manageable.

**Worst-case Pro user (maxes all daily caps):** ~$85/month with Sonnet. Tight margin — monitor and adjust caps based on actual usage data.

**Required optimizations:**
- **Prompt caching** — System prompts are identical across all calls of the same tier. Anthropic's prompt caching reduces input token costs by 90% on cache hits. This is a ~10-line code change that saves thousands at scale.
- **Tiered model routing** — Free tier must use Haiku; Sonnet reserved for paid plans. This is the single biggest lever on unit economics.
- **Generation logging** — The `ai_generations` table must be written on every call with token counts. Without this, there's no visibility into actual costs per workspace.

---

## Export & Interoperability

Graph portability is a hard requirement for the PKM audience. BendScript must support data export from launch:

- **JSON export** — Full graph state (planes, nodes, edges, metadata) as a single JSON file. This is the "emergency exit" — users must always be able to get their data out.
- **Markdown outline** — Flatten a graph plane into a nested Markdown document following edge hierarchy. Useful for sharing graph insights in linear formats.
- **Mermaid diagram** — Export a plane as a Mermaid flowchart definition. Renders in GitHub, Notion, Obsidian, and most modern Markdown tools.
- **Import from JSON** — Reload a previously exported graph. Required for backup/restore and cross-workspace migration.

> **Phase target:** JSON export and Markdown outline at launch. Mermaid export in the first post-launch update. Import is Phase 2.

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

## Roadmap

- [x] HTML prototype — canvas, physics, planes, Markdown, localStorage
- [ ] SvelteKit migration — extract engine, Svelte stores, component structure
- [ ] Supabase persistence — schema, RLS, graph load/save
- [ ] Auth + workspaces — email, OAuth, multi-tenancy
- [ ] AI Tier 1–2 — contextual + graph-aware synthesis (replace stub)
- [ ] Prompt caching + tiered model routing — Haiku for Free, Sonnet for paid; cache system prompts
- [ ] AI generation rate limiting — enforce per-plan caps, log token usage to `ai_generations`
- [ ] Graph export — JSON full state, Markdown outline
- [ ] Real-time collaboration — Supabase broadcast, node sync
- [ ] AI Tier 3 — topic-to-graph full subgraph generation
- [ ] Public graph sharing — read-only `/share/[id]` URL
- [ ] Quadtree spatial index (unlocks 500+ node graphs — required before Teams/Business plans go live)
- [ ] Undo/redo stack — immutable state snapshots
- [ ] Mermaid export + JSON import
- [ ] Semantic search — pgvector node embeddings
- [ ] Mobile optimization — pinch zoom, two-finger pan, long-press menu
- [ ] AI Tier 4 — edge inference on node creation
- [ ] Graph templates library
- [ ] API access for workspace graphs
- [ ] Enterprise SSO + audit logging

---

*BendScript is built by [Ampersand Box Design](https://ampersandboxdesign.com) — Copyright 2026*
