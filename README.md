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

**4. KAG server — knowledge infrastructure, not just a canvas.** BendScript graphs are queryable knowledge bases. Any LLM system can query a BendScript workspace via MCP or REST API for grounded, multi-hop reasoning over the user's accumulated knowledge. This transforms BendScript from a canvas app competing on UI into a knowledge infrastructure layer competing on data depth. See the KAG section below for full details.

---

## Pricing

| Plan | Price | Graphs | Nodes/graph | Collaboration | AI Generations |
|---|---|---|---|---|---|
| Free | $0/mo | 5 | 100 | — | 20 T1 / 5 T2 / 2 T3 per day (Haiku only) |
| Pro | $19/mo | Unlimited | 500 | — | 80 T1 / 15 T2 / 5 T3 per day (Sonnet) |
| Teams | $25/seat/mo | Unlimited | 1,000 | ✓ Real-time | 1,000/mo shared pool, all tiers (Sonnet) |
| Business | $20/seat/mo (10+) | Unlimited | Unlimited | ✓ + SSO + audit log | 5,000/mo + edge inference (Sonnet) |
| Enterprise | Custom | Unlimited | Unlimited | ✓ + on-prem option | Custom / self-hosted model |

> **Note on pricing:** Comparable tools (Heptabase $7–12/mo, Flowith $15–$50/mo) are established with large user bases. The free tier is designed to be genuinely usable for solo exploration while creating natural upgrade pressure. Generation caps are tier-aware (not flat) because Tier 3 calls cost ~6× more than Tier 1. Free tier uses Haiku to control costs; paid tiers upgrade to Sonnet. The Pro tier at $19/mo undercuts Flowith's Professional ($19.90/mo) while maintaining positive AI margins at average utilization levels — see AI Cost Model below for detailed analysis.

---

## AI Cost Model

AI generation costs vary significantly by tier. All costs below reflect **March 2026 Anthropic API pricing**: Haiku 4.5 at $1/$5 per MTok, Sonnet 4.6 at $3/$15 per MTok. Prompt caching reduces cached input token costs by 90%.

| AI Tier | Model (Free) | Model (Paid) | Est. Input Tokens | Est. Output Tokens | Cost/Call (Free) | Cost/Call (Paid) | With Cache (Paid) |
|---|---|---|---|---|---|---|---|
| Tier 1 — Contextual | Haiku 4.5 | Sonnet 4.6 | ~800 | ~600 | $0.0038 | $0.0114 | $0.0093 |
| Tier 2 — Graph-aware | Haiku 4.5 | Sonnet 4.6 | ~3,000 | ~1,500 | $0.0105 | $0.0315 | $0.0240 |
| Tier 3 — Topic-to-graph | Haiku 4.5 | Sonnet 4.6 | ~4,000 | ~4,000 | $0.0240 | $0.0720 | $0.0630 |
| Tier 4 — Edge inference | — | Sonnet 4.6 | ~2,500 | ~800 | — | $0.0195 | $0.0150 |

### Margin Analysis by Plan

| Scenario | Daily Usage | AI Cost/Month | Revenue/Month | Margin |
|---|---|---|---|---|
| Free user (worst-case, maxes all caps) | 20 T1 + 5 T2 + 2 T3 | $3.84 | $0 | −$3.84 |
| Free user (avg 30% utilization) | 6 T1 + 1.5 T2 + 0.6 T3 | $1.15 | $0 | −$1.15 |
| Pro user (worst-case, maxes all caps) | 80 T1 + 15 T2 + 5 T3 | $31.59 | $19 | −$12.59 |
| Pro user (avg 25% utilization) | 20 T1 + 3.75 T2 + 1.25 T3 | $7.90 | $19 | +$11.10 |
| Pro user (avg 15% utilization) | 12 T1 + 2.25 T2 + 0.75 T3 | $4.74 | $19 | +$14.26 |

**Worst-case free user:** ~$3.84/month with Haiku. Manageable — most free users will use 15–30% of caps.

**Worst-case Pro user:** ~$31.59/month on a $19 plan. At 25% average utilization (the realistic steady-state), margin is +$11.10/month — healthy. Monitor actual usage in `ai_generations` and adjust caps if average utilization exceeds 40%.

> **Note on cap design:** Previous iteration had 100 T1 / 30 T2 / 10 T3 at $15/mo, which produced worst-case costs of ~$55.80/month — a $40.80 monthly loss per power user. The current caps (80 T1 / 15 T2 / 5 T3 at $19/mo) are still generous for daily use while bringing worst-case losses within tolerance. T3 cap reduction from 10→5 has the largest impact because T3 calls cost ~6× more than T1.

**Required optimizations:**
- **Prompt caching** — System prompts are identical across all calls of the same tier. Anthropic's prompt caching reduces input token costs by 90% on cache hits. This is a ~10-line code change that saves thousands at scale. "With Cache" column above assumes ~90% system prompt cache hit rate after first call.
- **Tiered model routing** — Free tier must use Haiku 4.5; Sonnet 4.6 reserved for paid plans. This is the single biggest lever on unit economics — Haiku is ~5× cheaper per token than Sonnet.
- **Generation logging** — The `ai_generations` table must be written on every call with token counts. Without this, there's no visibility into actual costs per workspace. A composite index on `(workspace_id, tier, created_at)` is required for rate-limit queries to perform at scale.

---

## Export & Interoperability

Graph portability is a hard requirement for the PKM audience. BendScript must support data export from launch:

- **JSON export** — Full graph state (planes, nodes, edges, metadata) as a single JSON file. This is the "emergency exit" — users must always be able to get their data out.
- **Markdown outline** — Flatten a graph plane into a nested Markdown document following edge hierarchy. Useful for sharing graph insights in linear formats.
- **Mermaid diagram** — Export a plane as a Mermaid flowchart definition. Renders in GitHub, Notion, Obsidian, and most modern Markdown tools.
- **Import from JSON** — Reload a previously exported graph. Required for backup/restore and cross-workspace migration.

> **Phase target:** JSON export and Markdown outline at launch. Mermaid export in the first post-launch update. Import is Phase 2.

---

## KAG — Knowledge Augmented Generation Server

BendScript's graph data is structurally identical to a knowledge graph. Every node is an entity, every typed edge is a relation, every Stargate is a sub-domain. This means BendScript can serve as a **KAG (Knowledge Augmented Generation) server** — exposing its graphs as structured knowledge bases that any LLM system can query for grounded, multi-hop reasoning.

KAG is a framework developed by Ant Group (OpenSPG/KAG) that goes beyond traditional RAG by combining knowledge graph structure with vector retrieval and logical-form-guided reasoning. Where RAG retrieves text chunks by similarity, KAG traverses typed relationships, decomposes complex queries into logical steps, and returns reasoning paths — not just content. BendScript's existing data model already encodes the relationships KAG needs: causal, temporal, associative, and contextual edge types provide the semantic structure that pure vector search lacks.

### Why KAG, Not Just RAG

| Capability | RAG | KAG (BendScript) |
|---|---|---|
| Retrieval method | Vector similarity on text chunks | Graph traversal + vector search + logical forms |
| Multi-hop reasoning | Weak — chains of similarity matches | Native — follow typed edges across 2–5 hops |
| Numerical / temporal logic | Blind — treats "30 days" as text | Aware — temporal edges encode sequence; strength encodes weight |
| Hallucination resistance | Moderate — retrieves relevant but possibly wrong chunks | Strong — answers are grounded in explicit graph structure |
| Context for LLM | Flat text chunks | Structured subgraph (nodes, edges, paths, planes) |
| Domain adaptability | Requires re-indexing documents | Users build domain graphs interactively via AI synthesis |

### Architecture

```
┌─────────────────────────────────────────────────┐
│  ANY LLM CLIENT                                  │
│  Claude (MCP) · ChatGPT (function calling)       │
│  Custom agent · Slack bot · IDE copilot          │
└──────────────┬──────────────────────────────────┘
               │ MCP tool call / REST API / webhook
┌──────────────▼──────────────────────────────────┐
│  BENDSCRIPT KAG SERVER                           │
│                                                  │
│  ┌─ KAG-Solver ──────────────────────────────┐  │
│  │  1. Decompose query → logical forms        │  │
│  │  2. Match forms to graph operations        │  │
│  │  3. Traverse edges (typed, multi-hop)      │  │
│  │  4. Assemble subgraph + reasoning path     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ KAG-Builder ─────────────────────────────┐  │
│  │  AI Tier 2–3 synthesis = graph building    │  │
│  │  Ingest text → extract entities/relations  │  │
│  │  Schema-free + schema-constrained modes    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Graph Store ─────────────────────────────┐  │
│  │  Supabase (Postgres) + pgvector            │  │
│  │  Nodes · Edges · Planes · Mutual indexing  │  │
│  └────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────┘
               │ Structured context (subgraph JSON)
┌──────────────▼──────────────────────────────────┐
│  LLM generates answer grounded in graph topology │
└─────────────────────────────────────────────────┘
```

### MCP Server Tools

BendScript exposes its graph as an MCP-compatible server. KAG has already embraced MCP natively (as of KAG v0.8, March 2026), making this a direct alignment with the emerging standard. MCP is now backed by the Linux Foundation's Agentic AI Foundation, with adoption from Anthropic, OpenAI, Google, Microsoft, and 97M+ monthly SDK downloads.

The BendScript MCP server exposes these tools:

| Tool | Description | Input | Output |
|---|---|---|---|
| `search_nodes` | Semantic search across node text in a workspace | `{ query, workspace_id, limit? }` | Array of matching nodes with scores |
| `get_subgraph` | Return a node and its neighborhood to N hops | `{ node_id, depth?, edge_kinds? }` | Subgraph JSON (nodes + edges + plane context) |
| `traverse_path` | Find reasoning paths between two concepts | `{ from_query, to_query, max_hops? }` | Ordered path with edge labels and types |
| `query_graph` | Natural language → logical form → graph traversal | `{ question, workspace_id }` | Reasoning result with source nodes and path |
| `build_from_text` | Ingest text and return extracted nodes/edges | `{ text, workspace_id, schema? }` | New nodes and edges added to graph |
| `list_planes` | List all graph planes in a workspace | `{ workspace_id }` | Plane hierarchy with node counts |

### Integration Methods

| Method | Transport | Best For | Status |
|---|---|---|---|
| **MCP Server** | Streamable HTTP / SSE | Claude, ChatGPT, Cursor, any MCP client | Phase 2 |
| **REST API** | HTTPS + API key | Custom apps, webhooks, server-to-server | Phase 2 |
| **OpenAI Function Calling** | JSON schema | ChatGPT plugins, GPT-based agents | Phase 2 |
| **LangChain Retriever** | Python SDK | LangChain/LlamaIndex pipelines | Phase 3 |
| **Embedded reasoning page** | iframe / web component | Business apps that need inline Q&A | Phase 3 |

### KAG API Pricing

KAG API access is a separate add-on to the workspace subscription. Queries consume API credits; graph building via the canvas UI is covered by the base plan.

| Plan | Price | API Queries | MCP Endpoint | Webhook | Notes |
|---|---|---|---|---|---|
| Pro (included) | $19/mo | 100/day | — | — | Canvas building only; no API access |
| KAG API | $49/mo | 5,000/mo | ✓ | ✓ | Single workspace; ideal for personal agents |
| KAG Teams | $99/mo | 20,000/mo | ✓ | ✓ | Multi-workspace; shared team graphs |
| KAG Enterprise | Custom | Unlimited | ✓ | ✓ | Self-hosted option; SLA; SSO; audit log |

> **Note on positioning:** This shifts BendScript from competing as a canvas app (vs Flowith, Heptabase) to competing as **knowledge infrastructure** (vs Pinecone, Weaviate, but with graph reasoning). The canvas becomes the builder; the API is the product. Users' accumulated graph data becomes the moat — not the UI.

### Relationship to OpenSPG/KAG

BendScript is not a fork of OpenSPG/KAG. It is a complementary product that shares the same architectural principles:

- **KAG (OpenSPG)** is a Python framework for building domain-specific KAG systems with Neo4j, requiring self-hosting and developer expertise. It targets enterprises building internal knowledge Q&A systems.
- **BendScript KAG Server** is a hosted, visual-first knowledge graph with a managed API. It targets individuals and teams who want to build knowledge graphs interactively (via AI synthesis on a canvas) and then query them from any LLM system via MCP/REST.

The key insight: KAG proved that knowledge graphs + LLMs > vector RAG alone. BendScript makes that capability accessible without requiring a DevOps team to run Neo4j + OpenSPG + Python extractors.

---

## Go-to-Market Strategy

BendScript's GTM leverages the product itself as the primary acquisition channel, supported by community seeding and content-driven discovery.

### Launch Sequence

1. **Pre-launch (2 weeks before):** Seed teaser posts in PKM communities — r/ObsidianMD, Heptabase Discord, r/PKMS, r/knowledgegraph, Tools for Thought Twitter/X. Frame as "what if your AI built the graph, not just answered questions?" with a short screen recording of Tier 2 synthesis in action.
2. **Launch day:** Product Hunt launch (Flowith topped PH in June 2025 — the category has proven PH traction). Landing page IS the product: visitors interact with a live graph demo immediately, no signup wall.
3. **Week 1 post-launch:** Publish comparison content — "BendScript vs Flowith vs Heptabase" targeting "canvas AI tool" and "knowledge graph AI" search terms. Publish a technical deep-dive on topology-aware synthesis for the dev/AI audience (Hacker News, dev.to).
4. **Ongoing:** Public graph sharing (`/share/[id]`) creates organic discovery — every shared graph is a landing page. Mermaid export renders in GitHub READMEs and Notion pages, driving backlinks.

### Growth Loops

| Loop | Mechanism | Expected Impact |
|---|---|---|
| **Product-as-demo** | Landing page is a working graph — zero-friction trial | High — spatial products must be felt, not described |
| **Public graph sharing** | `/share/[id]` URLs are linkable, embeddable graph views | Medium — every shared graph is an acquisition surface |
| **Mermaid export → GitHub/Notion** | Exported graphs render natively in popular tools | Medium — drives discovery from technical users |
| **Community seeding** | PKM communities (Obsidian, Heptabase, Roam) are high-intent | High — these users already understand spatial thinking |
| **Comparison SEO** | "BendScript vs [competitor]" pages targeting search | Medium — captures active evaluators |

### Key Metrics to Track

- **Activation:** % of landing page visitors who submit at least one Composer prompt (target: >25%)
- **Graph-to-signup:** % of anonymous graph users who create an account (target: >8%)
- **T2 engagement:** % of paid users who use Tier 2+ synthesis at least weekly (target: >40% — validates core differentiator)
- **Share rate:** % of graphs that generate a `/share/[id]` link (target: >10%)
- **Expansion:** Free → Pro conversion rate (target: >4% monthly)

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
- [x] Marketing hero section — SEO-friendly landing above graph demo, snap scroll between hero and canvas
- [ ] **AI Tier 2 validation** — prototype topology-aware synthesis and A/B test against Tier 1 to validate core differentiator (do this BEFORE full migration)
- [ ] SvelteKit migration — extract engine, Svelte stores, component structure
- [ ] Supabase persistence — schema, RLS, graph load/save
- [ ] Auth + workspaces — email, OAuth, multi-tenancy
- [ ] AI Tier 1–2 — contextual + graph-aware synthesis (replace stub)
- [ ] Prompt caching + tiered model routing — Haiku 4.5 for Free, Sonnet 4.6 for paid; cache system prompts
- [ ] AI generation rate limiting — enforce per-plan caps, log token usage to `ai_generations`
- [ ] Graph export — JSON full state, Markdown outline
- [ ] **Public graph sharing** — read-only `/share/[id]` URL (growth loop — prioritize before collab)
- [ ] Real-time collaboration — Supabase broadcast, node sync
- [ ] AI Tier 3 — topic-to-graph full subgraph generation (= KAG-Builder)
- [ ] Quadtree spatial index (unlocks 500+ node graphs — required before Teams/Business plans go live)
- [ ] Undo/redo stack — immutable state snapshots
- [ ] Mermaid export + JSON import
- [ ] **Comparison SEO pages** — BendScript vs Flowith, vs Heptabase, vs Obsidian Canvas
- [ ] Semantic search — pgvector node embeddings + mutual indexing (nodes ↔ chunks)
- [ ] **KAG REST API** — `/api/kag/query` endpoint for natural language graph queries (= KAG-Solver)
- [ ] **KAG MCP Server** — expose graph tools via Model Context Protocol (Streamable HTTP transport)
- [ ] KAG `build_from_text` — ingest documents → extract entities/relations → add to graph
- [ ] KAG `traverse_path` — multi-hop reasoning between concepts with edge-type filtering
- [ ] Mobile optimization — pinch zoom, two-finger pan, long-press menu
- [ ] AI Tier 4 — edge inference on node creation
- [ ] Graph templates library
- [ ] **KAG LangChain/LlamaIndex retriever** — drop-in replacement for vector-only retrieval
- [ ] KAG API dashboard — usage analytics, query logs, cost tracking per workspace
- [ ] Enterprise SSO + audit logging

---

*BendScript is built by [Ampersand Box Design](https://ampersandboxdesign.com) — Copyright 2026*
