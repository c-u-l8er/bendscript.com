# bendscript.com/play — Integrated Playground + Stage 0 Hardening Plan

**Date:** 2026-04-11
**Status:** Planning locked, ready to execute Stage 0
**Source:** Durable fallback for Graphonomous nodes that failed to persist due to an MCP store_node bug. Re-import into Graphonomous once the bug is verified fixed in a fresh session.

---

## Node 1 — os-prism npm/src/engine.ts architecture finding (CRITICAL)

**Type:** finding / de-risk signal for Stage 3
**Confidence:** 0.95

`PRISM/npm/src/engine.ts` (152 lines) is **not** an MCP client and **not** a TypeScript reimplementation of PRISM. It is a thin JSON-RPC shim that:

1. Spawns an external Elixir PRISM engine as a child process via `spawn(enginePath!, [], { stdio: ["pipe", "pipe", "inherit"] })`.
2. Writes a **custom** line-delimited JSON-RPC dialect on stdin: `{ id, method, params }` — **no `jsonrpc: "2.0"` envelope**.
3. Reads responses on stdout in the shape `{ id, ok, result, error, engine_available }` — **not MCP response shape**.
4. Defaults `enginePath` to unset → every tool call returns `{ ok: false, error: { code: "engine-unavailable" }, engine_available: false }` (stub mode).
5. Line 123 literally states: `"v0.1.0 of os-prism does not bundle the engine."`

### Implications
- This shim **cannot talk to a standard MCP server** — including PRISM's own Elixir MCP server in `PRISM/lib/`. The wire protocol is bespoke.
- Default stub mode means every `mcp__prism__*` tool call routed through this wrapper silently returns `engine-unavailable`.
- No MCP-client test harness can be written against the current code; it needs a **dual-mode client** refactor first:
  - **Remote mode (default):** HTTP MCP client hitting a hosted PRISM engine at `prism.bendscript.com` (or similar), speaking real MCP JSON-RPC 2.0.
  - **Local mode (opt-in):** existing stdio child-process behavior, kept as an escape hatch for offline dev.
- This is the single largest risk in Stage 3 (PRISM dual-backend). It must be addressed during Stage 0 PRISM hardening week, not deferred.

### Action items (Stage 0, os-prism week)
1. Refactor `engine.ts` into `TransportStdio` and `TransportHttp` implementations behind a common `Transport` interface.
2. Add an `@modelcontextprotocol/sdk` based HTTP client that speaks real MCP.
3. Keep the existing stdio path working so local Elixir dev is unaffected.
4. Add contract tests that run both transports against a minimal echo server.
5. Ship `npm` package v0.2.0 once both transports pass CI.

---

## Node 2 — Stage 1 MVP spec: bendscript.com/play

**Type:** spec
**Confidence:** 0.9
**Blocked by:** Stage 0 completion (weeks 2–8)
**Target:** Week 9 kickoff

### Route
- **URL:** `https://bendscript.com/play` (new SvelteKit route inside existing bendscript.com Cloudflare Pages deployment)
- **Layout:** Three-pane editor (left: spec tree, middle: JSON editor w/ monaco, right: validator output + optional LLM chat)

### Auth
- Reuses existing Supabase Auth wired into bendscript.com via `ampersand-supabase`.
- **Guest mode:** no auth required; state persisted to `localStorage` with **30-day TTL** enforced client-side on load.
- **Signed-in mode:** state persisted to `amp.playground_sessions` (new table, migration number TBD in `000–009` range).

### LLM — BYOK, OpenRouter
- **Default model:** `google/gemma-4-26b-a4b` (Google Gemma 4 26B A4B).
- User pastes OpenRouter API key on first load; stored in `localStorage` for guests, `amp.user_secrets` (encrypted via pgsodium) for signed-in users.
- **Proxy passthrough:** feature flag `VITE_USE_AI_PROXY`. When true, all OpenRouter calls go through a Cloudflare Worker at `/play/api/llm` that forwards with the user's key. When false (default MVP), SvelteKit frontend calls OpenRouter directly from the browser. Proxy is future-proofing for rate limiting, logging, and key rotation.

### Validators (paste-only in MVP)
- **[&] Protocol:** JSON Schema 2020-12 via `ajv` in-browser. Uses `AmpersandBoxDesign/reference/schemas/*.json` bundled at build time.
- **PULSE:** JSON Schema 2020-12 via `ajv`. Uses `PULSE/schemas/pulse-loop-manifest.v0.1.json` bundled at build time.
- **PRISM:** paste a PRISM scenario JSON, validate against `PRISM/priv/schemas/scenario.json` (or equivalent). **No live engine calls in Stage 1** — pure schema validation only. Actual benchmark execution is Stage 3.

### Out of scope for Stage 1
- No live MCP tool invocation from the playground.
- No live PRISM execution.
- No Graphonomous integration (Stage 2).
- No control plane features (Stage 3).

---

## Node 3 — Option C architecture decision (Graphonomous + Supabase)

**Type:** decision / policy reversal
**Confidence:** 0.95

### Decision
Graphonomous will use **Supabase for auth + metadata** and **SQLite (on Fly volumes) for the hot memory loop**. This is a partial reversal of the CLAUDE.md line:

> "Products that do NOT use Supabase: Graphonomous (embedded SQLite)"

It is **not** a migration to Postgres. The hot loop (ETS + `Exqlite.Sqlite3` direct via `GenServer.call`, plus `get_node_direct/1` bypassing the GenServer entirely for `:ets.lookup`) stays on SQLite.

### Why not Option A (full Postgres migration)
- `graphonomous/lib/graphonomous/store.ex` shows the hot loop is architected around ETS-first reads with SQLite as the cold tier. Postgres round-trips (even local) would add 100–500µs per read and kill the retrieve-phase latency budget.
- SQLite-on-Fly is a proven prod pattern (Tailscale, Turso, LiteFS). "SQLite is not production quality" is a misconception — it is production quality for this workload specifically.
- `sqlite-vec` is already wired in for embedding search; pgvector migration would require re-ingesting every embedding with a different index type.

### Why not Option B (keep everything local)
- Users need cloud saves and auth to use hosted Graphonomous (Stage 2). Pure local SQLite doesn't give them that.

### Option C split
- **Supabase (new schema `graphonomous.*`, migration range TBD — request `090–099` from ampersand-supabase):**
  - `graphonomous.workspaces` — workspace ownership, plan tier, Fly volume ID pointer
  - `graphonomous.sessions` — user sessions, OpenRouter key refs
  - `graphonomous.audit_log` — append-only event log for GDPR / debugging
  - Row-level security via existing `amp.*` primitives
- **SQLite (per-workspace `.db` file on Fly volume):**
  - All nodes, edges, embeddings, ETS hot cache backing
  - One file per workspace, mounted via LiteFS for replication
  - `WorkspaceSupervisor` spawns a Graphonomous OTP tree per active workspace, each with its own `Store` GenServer + ETS table

### CLAUDE.md update required
Update the shared Supabase section to add a `graphonomous.*` range and replace the "do NOT use Supabase" line with: *"Graphonomous uses Supabase for auth + workspace metadata, SQLite-on-Fly for the hot memory loop (Option C, 2026-04-11)."*

---

## Node 4 — Stage 0 package hardening plan

**Type:** plan
**Confidence:** 0.9
**Sequence:** os-pulse → box-and-box → os-prism
**Timeline:** weeks 2–8 (7 weeks serial)

### Rationale for serial, not parallel
Team is small (Zed + ChatGPT-5.3-Codex for coding, Claude for planning). Parallel tracks produce merge conflicts and context thrash. Serial is slower on paper but actually ships.

### Week 2 — os-pulse hardening
- **Current state:** 1309 LoC / 65 test LoC. Files: `cli.ts`, `conformance.ts` (328 lines — the most complex), `db.ts`, `resources.ts`, `schema.ts`, `server.ts`, `tokens.ts`, `tools.ts` (457 lines).
- **Tasks:**
  - Raise test coverage to ≥70% (currently ~5%).
  - Add conformance tests against reference manifests in `PULSE/manifests/` (graphonomous, prism, agentromatic).
  - Round-trip test: load → validate → serialize → re-load for every canonical manifest.
  - Fix any bugs surfaced by the above (expected: some, this is unproven prod code).
  - Publish v0.2.0 to npm registry.
- **Exit criteria:** CI green, coverage ≥70%, all 3 reference manifests validate clean.

### Weeks 3–5 — box-and-box hardening (3 weeks)
- **Current state:** 1469 LoC / 102 test LoC. Files: `check.ts`, `cli.ts`, `compose.ts`, `db.ts`, `generate.ts` (188), `inspect.ts`, `paths.ts`, `registry.ts`, `resources.ts`, `server.ts`, `tools.ts` (312), `validate.ts` (105). Has `bundled/` dir and `scripts/bundle.js`.
- **Parity hazard:** this is a GENUINE TypeScript reimplementation of the Elixir `ampersand_core` reference impl, **not** a thin shim. Two implementations of the same protocol = drift risk.
- **Tasks:**
  - **Week 3:** Build a parity harness — same test spec validated by both Elixir `ampersand_core` and TS box-and-box, compared output. Target: **50% of the reference spec corpus passing parity**.
  - **Week 4:** Fix divergences found in week 3. Triage which side is canonical for each divergence (Elixir is the spec, but some TS features may be ahead).
  - **Week 5:** Push parity to ≥80%. Document remaining known divergences in `AmpersandBoxDesign/box-and-box/PARITY.md`.
- **Exit criteria:** ≥80% parity, documented divergences, CI green, box-and-box v0.2.0 published.

### Weeks 6–8 — os-prism hardening (3 weeks)
- **Week 6:** Refactor `engine.ts` into dual-transport (stdio + http) per Node 1's action items. Add `@modelcontextprotocol/sdk`.
- **Week 7:** Contract tests for both transports. Minimal echo MCP server for http mode. Ensure stdio path still works against real Elixir engine.
- **Week 8:** Integration test against hosted PRISM staging (requires Stage 2 Fly setup — may slip to week 9 if blocked).
- **Exit criteria:** both transports tested in CI, `engine-unavailable` no longer the default for cloud users, os-prism v0.2.0 published.

### Stage 0 exit gate (end of week 8)
All three packages published at v0.2.0 with:
- ≥70% test coverage
- CI green
- A documented, supported transport / parity story
- No known silent-failure paths (like current `engine-unavailable` stub)

---

## Node 5 — 17-week integrated serial timeline

**Type:** plan / roadmap
**Confidence:** 0.9

| Week | Stage | Deliverable |
|------|-------|-------------|
| 1    | Stage 1 kickoff | bendscript.com/play route scaffolding, monaco editor, Supabase auth wiring, BYOK paste flow |
| 2    | Stage 0 — os-pulse | 70% coverage, reference manifest conformance, v0.2.0 published |
| 3    | Stage 0 — box-and-box | Parity harness built, 50% corpus passing |
| 4    | Stage 0 — box-and-box | Divergence fixes |
| 5    | Stage 0 — box-and-box | 80% parity, v0.2.0 published |
| 6    | Stage 0 — os-prism | Dual-transport refactor |
| 7    | Stage 0 — os-prism | Contract tests + stdio regression |
| 8    | Stage 0 — os-prism | Integration test, v0.2.0 published |
| 9    | Stage 1 resume | Playground: full [&]+PULSE+PRISM paste-only validators wired, proxy passthrough feature-flagged |
| 10   | Stage 1 | Playground: Gemma 4 26B A4B default, LLM chat pane, 30-day guest TTL enforcement |
| 11   | Stage 1 | Playground: signed-in cloud saves to `amp.playground_sessions`, polish, public launch |
| 12   | Stage 2 | Hosted Graphonomous: Fly app skeleton, LiteFS volume mount, `graphonomous.*` Supabase schema migration |
| 13   | Stage 2 | Hosted Graphonomous: `WorkspaceSupervisor`, per-workspace OTP tree, auth integration |
| 14   | Stage 2 | Hosted Graphonomous: MCP HTTP endpoint, bendscript.com/play "connect to cloud memory" UX, public beta |
| 15   | Stage 3 | Control plane: new `bendscript.com/admin` route, workspace list, usage dashboards |
| 16   | Stage 3 | PRISM dual-backend: bendscript.com/play can trigger hosted PRISM runs via new http transport (unblocked by week 8) |
| 17   | Stage 3 | Integration polish, docs, v1.0 announcement across [&] portfolio |

### Key dependencies
- **Week 1 → Week 9:** Stage 1 is *paused* during weeks 2–8 while Stage 0 runs. Only scaffolding happens in week 1.
- **Week 8 → Week 16:** os-prism dual-transport must land before Stage 3 PRISM dual-backend.
- **Week 12 → Week 16:** hosted Graphonomous must exist before the control plane has anything to administrate.
- **Stage 0 completion is the hard gate** for every downstream stage. If any Stage 0 week slips, every subsequent week slips.

### Policy reversal tracking
Update `CLAUDE.md` in week 12 (when hosted Graphonomous lands) to reflect the Option C decision documented in Node 3.
