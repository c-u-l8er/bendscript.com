# BendScript Protocol

A graph-first document format with typed inline link facets, for agent-native systems.

**Status:** v0.1 draft (sections 0–6). Pre-implementation.

## Direction

bendscript.com is being rebuilt as a **protocol spec + reference framework**, not a canvas/KAG SaaS. The previous direction (SvelteKit canvas editor + KAG server on Supabase) is archived under `old_scrap/v1/` and is not being extended.

The new product is:
- A JSON document format (`bend:` URI scheme, content-addressable ids, span-addressable graph edges)
- A reference parser/validator/edge-extractor (`bendscript-core`, not yet written)
- An LLM round-trip test harness (the load-bearing claim of v0.1)
- Five reserved vocabularies that integrate with the rest of the [&] portfolio

## Source-of-truth spec

- `docs/spec/README.md` — BendScript Protocol v0.1 draft (sections 0–6)

## What's archived

`old_scrap/v1/` contains the entire previous product — SvelteKit app, Supabase migrations integration, AGENTS.md, prompts, the v1.0 canvas-and-KAG spec (`old_scrap/v1/docs/spec/README.md`), and all build configs. It is historical; do not extend it.

## Build

```
npm install
npm test            # run all unit tests (vitest)
npm run typecheck   # tsc --noEmit
```

Reference framework: `bendscript-core` (TypeScript, Node 20+).

- `src/types.ts` — Document, Block, Span, Edge, Mark types
- `src/parse.ts` — `parse(text) → Document`, `normalize(doc)` (link-mark expansion), `parseAndNormalize`
- `src/validate.ts` — structural validator per §2/§3 (throws `ValidationError` with JSON path)
- `src/canonicalize.ts` — RFC 8785 (JCS) wrapper for canonical serialization
- `src/hash.ts` — content-addressable document id (`computeDocumentId`) using sha2-256 + json multicodec → CIDv1 multibase string
- `src/expand-marks.ts` — §2.5.1 link-mark → edge expansion (idempotent, dedup'd)
- `src/serialize.ts` — pretty-print and canonical serializers

`test/round-trip.test.ts` exercises the §8.1.1 strict round-trip claim against `test-corpus/v0.1/*.bend.json`.

## Verification status

**§8.1.1 parser round-trip — verified.** 96 tests passing as of 2026-04-27 against the full 20-document corpus:

- `parse(serialize(parse(d))) === parse(d)` holds for all 20 corpus documents (Unicode, ZWJ emoji, deeply nested lists, all five reserved vocabularies, supersedes/tombstones, untyped links)
- Document id is stable across parse/serialize cycles
- Editing span text changes the id; editing `meta` does NOT (§5.1 trade-off works as designed)
- RFC 8785 canonicalization is field-order independent
- Link-mark expansion is deterministic and idempotent
- Untyped link marks (no `predicate`) do NOT emit edges (per §2.5.1)

**§8 harness mechanics — verified with mock LLMs.** No paid API calls yet:

- Drift metric implemented (5 components per §8.4: block_structure, edge_preservation, span_coverage, mark_fidelity, vocabulary_integrity), zero-drift on identical docs
- Identity / small-edit / lossy / garbage mock models exercise each failure mode
- Median + P95 aggregation per §8.5
- Threshold checking emits `pass` / `fail` verdict with failing thresholds enumerated
- `MockModel` with `lossy` mode confirmed: harness correctly enforces spec invariant that link-mark edges always re-expand on parse, so dropping the `edges` array doesn't lose link-mark-derived edges

**§8.1.2 LLM round-trip — not yet run against real models.** Implementing a `ModelClient` against OpenRouter is the next step. Estimated cost: $5–20 per gating run (180 calls = 20 docs × 3 classes × 3 models).

**§14.3.1 Graphonomous adoption — not yet implemented.** This is the other gating commitment for v0.1 final.

## Conventions

- Spec uses RFC discipline (MUST / SHOULD / MAY)
- Canonical document form is JSON; text projection deferred to v0.2
- `.bend` files are not hand-authored — produced by editors that emit JSON
- No host coupling: the protocol must work in TypeScript, Elixir, Rust, plain HTML
