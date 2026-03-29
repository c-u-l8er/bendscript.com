# BendScript — Knowledge Graph Editor + KAG Server

Multi-tenant, AI-powered knowledge graph editor built on SvelteKit + Supabase. The only non-Elixir product in the [&] Protocol ecosystem.

## Source-of-truth spec

- `project_spec/README.md` — BendScript technical specification

## Implementation prompts

- `prompts/BUILD.md` — SvelteKit + Supabase migration spec (~1,600 lines)
- `prompts/MIGRATION_PROMPT.md` — engine extraction from prototype (~800 lines)
- `prompts/CODEX_COMPLETION_PROMPT.md` — current-state completion guide for Codex (~900 lines)

These document how BendScript was built and serve as templates for Codex-driven development.

## [&] Capability provided

BendScript provides `&memory.graph` as a KAG (Knowledge Augmented Generation) server — complementary to Graphonomous's agent-side continual learning graph.

- Graphonomous = agent-built knowledge (continual learning)
- BendScript = human-built knowledge (interactive canvas)

## Build and develop

```
npm install
npm run dev
```

## Shared Supabase data layer

BendScript uses the **shared ecosystem Supabase** at the repo root (`/ampersand-supabase/`), not a local supabase directory. Its tables live in the `kag.*` PostgreSQL schema.

- Schema: `/ampersand-supabase/migrations/010_kag_schema.sql`
- RLS: `/ampersand-supabase/migrations/011_kag_rls.sql`
- Edge Function: `/ampersand-supabase/functions/kag-ai-proxy/`
- Architecture: `/ampersand-supabase/ARCHITECTURE.md`

Run `supabase start` from the repo root to start the full ecosystem DB. Use `.schema('kag')` in the Supabase JS client to target BendScript tables.

## Stack

- SvelteKit 2.x + TypeScript
- Supabase (PostgreSQL 15+, Auth, Realtime) — shared ecosystem instance
- pgvector for embeddings (in `kag.*` schema)
- HTML5 Canvas for force-directed graph rendering
- Anthropic Claude API for AI synthesis
- Custom CSS (no Tailwind)

## MCP tools

`search_nodes`, `get_subgraph`, `traverse_path`, `query_graph`, `build_from_text`, `list_planes`

See AGENTS.md for full agent interface specification.
