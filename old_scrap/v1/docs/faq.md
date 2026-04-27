# BendScript FAQ

Frequently asked questions about BendScript.

---

## What is BendScript?

BendScript is a multi-tenant, AI-powered knowledge graph editor and KAG server.
Humans build knowledge visually on a canvas. Agents query and extend that
knowledge via MCP tools and REST API. It is the only non-Elixir product in the
[&] Protocol ecosystem.

---

## What makes BendScript different from Obsidian / Heptabase / Flowith?

Three things:

1. **Topology-aware AI** — BendScript sends graph structure to the model as
   generative input. AI reasons *about* the graph, not just *within* it. Other
   tools treat AI as a sidebar assistant that cannot see the canvas shape.

2. **KAG server** — BendScript exposes the graph as a queryable backend for
   agents via MCP tools and REST API. No other canvas tool does this.

3. **Stargates** — fractal depth via portal nodes into nested sub-graph planes.
   Knowledge has spatial dimension, not just flat layout.

---

## What is KAG vs RAG?

**RAG** (Retrieval-Augmented Generation) retrieves text chunks by vector
similarity. It returns the most similar passages, but is blind to relationships
between them.

**KAG** (Knowledge Augmented Generation) combines three retrieval strategies:

- **Graph traversal** — follow typed edges across multiple hops
- **Vector search** — semantic similarity via pgvector embeddings
- **Logical forms** — decompose natural language into structured graph queries

KAG preserves the *shape* of knowledge. When an agent asks "what caused X and
what did X lead to?", KAG follows causal edges. RAG just returns text that
mentions X.

---

## Why SvelteKit instead of React?

Three reasons:

1. **No virtual DOM** — the canvas engine runs at 60fps via pure JS and
   `requestAnimationFrame`. React's reconciliation overhead would fight the
   render loop. Svelte compiles to minimal JavaScript.

2. **Reactive stores** — Svelte's writable stores map cleanly to engine state.
   Updating a store triggers UI reactivity without re-rendering the entire tree.

3. **Edge deployment** — SvelteKit has first-class adapter support for
   Cloudflare Pages. SSR works for the landing page and shared graph previews.

---

## How does multi-tenancy work?

Every row in the database has a `workspace_id`. Supabase Row-Level Security
(RLS) policies enforce that users can only access data in workspaces they belong
to. This is enforced at the Postgres layer — the application cannot bypass it.

On first sign-in, a personal workspace is auto-created. Users can be invited to
additional workspaces with roles: `owner`, `admin`, `member`, `viewer`.

---

## What AI models are used?

| Plan | Models | Tiers |
|------|--------|-------|
| Free | Haiku 4.5 | 1-3 |
| Paid | Sonnet 4.6 | 1-4 |

Tier 4 (edge inference) is paid-only. All AI calls go through Supabase Edge
Functions — the API key never reaches the client.

---

## Can I self-host BendScript?

Yes. You need:

- A Supabase instance (self-hosted or cloud)
- A Cloudflare Pages deployment (or any Node.js host with SvelteKit adapter)
- An Anthropic API key for AI synthesis

Run `npm run supabase:start` locally for development. For production, point
environment variables at your hosted Supabase project.

---

## How do agents use BendScript?

Agents connect via MCP (Model Context Protocol) over Streamable HTTP/SSE.
Six tools are exposed:

| Tool | Purpose |
|------|---------|
| `search_nodes` | Find nodes by text similarity or keyword |
| `get_subgraph` | Retrieve a node and its neighborhood |
| `traverse_path` | Follow typed edges from a starting node |
| `query_graph` | Natural language graph query via KAG solver |
| `build_from_text` | Ingest text, extract entities/relations, build graph |
| `list_planes` | List all planes in a workspace |

Agents can also use the REST API with an API key for KAG queries.

---

## What are Stargates?

Stargates are portal nodes. When you click one, you warp into a nested sub-graph
plane — a new canvas with its own nodes and edges. Stargates can nest
recursively, creating fractal depth.

Use cases:

- **Detail decomposition** — high-level concept on the root plane, details
  inside the Stargate
- **Topic branches** — each major topic gets its own sub-plane
- **Temporal layers** — past/present/future as separate planes
- **Private spaces** — sub-planes for work-in-progress

---

## Is there a free tier?

Yes. The free tier includes:

- Haiku 4.5 for AI synthesis (Tiers 1-3)
- Unlimited manual graph editing
- JSON/Markdown/Mermaid export
- Personal workspace

Paid plans add Sonnet 4.6, edge inference (Tier 4), team workspaces, and
higher API rate limits.

---

## How does BendScript relate to Graphonomous?

Both are knowledge graph products in the [&] Protocol ecosystem, but they serve
different surfaces:

- **Graphonomous** = agent-built knowledge (continual learning engine, Elixir)
- **BendScript** = human-built knowledge (interactive canvas, SvelteKit)

BendScript provides `&memory.graph` as a KAG server. Graphonomous provides
`&memory.graph` as a self-evolving agent memory. They are complementary.
