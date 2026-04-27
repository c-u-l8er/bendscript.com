# BendScript Protocol — v0.1

**A graph-first document format with typed inline link facets, for agent-native systems.**

Status: draft v0.1 (sections 0–6)
Owner: bendscript.com
Date: 2026-04-27
Position: protocol-level. Independent of [&], PULSE, PRISM, Graphonomous, Deliberatic, Runefort. May be used by them; does not require them.

---

## 0. What this is, in one paragraph

BendScript is a small declarative protocol for describing a **graph-first document with typed inline link facets**. A document is a tree of *blocks*; a block contains *spans*; spans carry inline *marks* (formatting) and participate in *edges* (typed graph links to other documents, blocks, or spans). The canonical on-disk form is a JSON record. A *text projection* — the human-readable rendered form — is a separate, downstream concern specified in its own document. The protocol is the contract between the canonical record and any conformant processor. Nothing more.

It is not a markdown successor. It is not a presentation format. It is not a knowledge-representation framework. It is the **document layer** that graph-native agent systems can build with.

`.bend` files are not hand-authored. Humans authoring BendScript use an editor (web-based, VS Code plugin, whatever the renderer ships) that produces `.bend` JSON as output. Vim users typing raw `.bend` will have a bad time. This is the trade made to get graph-first cleanliness; it mirrors AT Protocol records, which are also not hand-authored.

## 1. Why a protocol (not a library, not a markdown extension)

- **Graph-first.** Markdown's links are untyped strings. BendScript's edges are typed graph relations. An agent reading a document gets the graph for free; an agent writing one declares the relations it intends. No post-hoc inference, no scraping for backlinks.
- **Span-addressable.** A link can target a paragraph, a sentence, or a phrase. Markdown can address documents; Roam can address blocks; BendScript can address either, plus arbitrary text spans inside a block. This is the granularity that makes evidence-level retrieval, position-level argumentation, and quote-level transclusion possible without bolting them on.
- **Renderer-portable.** The same `bend.json` should render in any host environment — TypeScript, Elixir, Rust, plain HTML. The protocol is the only thing they share. No host-specific lock-in.
- **Diffable.** Documents live in version control as JSON. Reviews are mechanical. Span edits produce localized diffs.
- **LLM round-trippable.** The canonical form is structured enough that frontier LLMs can produce, modify, and consume it without losing semantics. This is a *test*, not a guarantee — see §8.
- **Extensible by composition.** Apps add *vocabularies* (e.g. `bendscript.argument.v1`, `bendscript.memory.v1`) on top of the core primitives. The protocol does not know about arguments, memories, or specs.

## 2. Core primitives

Six primitives. That is the entire vocabulary.

### 2.1 Document

A document is the top-level record. It has an id, a vocabulary, ordered blocks, and arbitrary metadata.

```json
{
  "bendscript": "0.1",
  "id": "bafy2bzaceaxyz...",
  "vocabulary": "core",
  "title": "On the Memory Loop",
  "blocks": [ ... ],
  "meta": {}
}
```

`id` is content-addressable — see §5.1. `vocabulary` names the extension vocabulary in use; `"core"` means no extensions. `blocks` is an ordered list; document order is significant and stable.

### 2.2 Block

A block is the structural unit of a document. It has an id, a kind, and content (which is either spans or nested blocks, depending on kind).

```json
{
  "id": "blk-7f3a",
  "kind": "paragraph",
  "spans": [ ... ]
}
```

Reserved block kinds in `core`:

- `paragraph` — flowing prose; `spans` is an ordered list.
- `heading` — has a `level` field (1–6); `spans` is an ordered list.
- `list` — has an `ordered` field (boolean); `items` is a list of `list-item` blocks.
- `list-item` — `blocks` is a list of nested blocks.
- `code` — has a `language` field; `text` is a string (no spans, no inline marks).
- `quote` — `blocks` is a list of nested blocks.
- `embed` — has a `target` field (an addressable reference per §5.4); resolved by the renderer.
- `divider` — no content; a structural break.

Custom block kinds are introduced by vocabularies. Processors that don't recognize a kind MUST preserve it in round-trip and SHOULD render a fallback representation.

### 2.3 Span

A span is a contiguous range of text within a block. Spans are the **addressable unit of text**: every character of every paragraph belongs to exactly one span. Spans carry marks (inline formatting) and participate in edges.

```json
{
  "id": "spn-2c8b",
  "text": "the memory loop is closed",
  "marks": ["bold"]
}
```

A span without marks is a plain text run. Spans are concatenated in order to produce the block's text. Adjacent plain spans MAY be merged by a processor; spans with marks or edges MUST NOT be merged with their neighbors.

### 2.4 Edge

An edge is a typed graph link. Subject and object are addressable references (§5.4); predicate is an edge type drawn from the document's vocabulary.

```json
{
  "subject": "bend:bafy2bzaceaxyz#blk-7f3a.spn-2c8b",
  "predicate": "supports",
  "object": "bend:bafy2bzaceqrs#blk-1a4f",
  "meta": { "weight": 0.8 }
}
```

Edges live at the document level (in a top-level `edges` array) — not inside spans. A span participates in an edge by being the subject or object of one. This separation keeps spans local and edges global, and makes edge sets diffable independently of prose changes.

Reserved edge predicates in the `core` vocabulary:

- `cites` — the subject references the object as a source.
- `supports` — the subject argues in favor of the object.
- `contradicts` — the subject argues against the object.
- `derives-from` — the subject is derived, paraphrased, or extracted from the object.
- `supersedes` — the subject replaces the object (used for edits, see §5.3).
- `transcludes` — the subject embeds the object inline at render time.
- `responds-to` — the subject is a reply or reaction to the object.
- `defines` — the subject provides a definition of the object.
- `exemplifies` — the subject is an example of the object.

These nine are the minimum set the protocol commits to. Vocabularies extend with namespaced predicates (`bendscript.argument.v1:rebuts`, `com.example.my-vocab:cites-with-doi`). Processors that don't recognize a predicate MUST preserve it in round-trip and treat it as opaque — **edge predicate unknown = preserve, don't fail.**

### 2.5 Mark

A mark is an inline formatting attribute on a span. Marks are **not semantic** — they tell a renderer how to display a span; they do not participate in the graph.

Reserved marks in `core`:

- `bold`
- `italic`
- `code`
- `link` — see §2.5.1.

These four are the entire inline formatting surface of v0.1. Marks are not extensible by vocabulary — adding marks is a protocol-version change, not a vocabulary concern. This is deliberate: marks live at a different layer than typed semantics, and conflating the two produced markdown's dialect fragmentation.

A span MAY carry multiple marks (`["bold", "italic"]`). Mark order is not significant.

#### 2.5.1 The `link` mark

The `link` mark is the only mark that carries data. A link mark expands at parse time into a corresponding entry in the document's `edges` array:

```json
{
  "id": "spn-9d2e",
  "text": "the memory loop",
  "marks": [
    { "kind": "link", "target": "bend:bafy2bzaceqrs", "predicate": "defines" }
  ]
}
```

When a span has a `link` mark with a `predicate` field, the parser MUST emit an edge with `subject = this span`, `predicate = predicate`, `object = target`. The `link` mark is **sugar that expands deterministically**; the `edges` array is the single canonical home for edges in the parsed-and-normalized form. Round-trip serializers MAY re-fold expanded edges back into `link` marks when a `link`-mark form is unambiguous; otherwise the edge stays in `edges`.

A `link` mark MAY omit the `predicate` field, in which case the link is untyped (semantically equivalent to a markdown link). Processors SHOULD treat untyped links as `predicate: "cites"` for graph-extraction purposes, but MUST preserve the absence of the predicate in round-trip.

The `predicate` value in a `link` mark is drawn from the document's active vocabulary — this is the one extension point marks have. The set of mark *kinds* (`bold`, `italic`, `code`, `link`) is fixed by the protocol version.

### 2.6 Vocabulary

A vocabulary is a named bundle of:

- additional block kinds
- additional edge predicates
- additional fields on `meta`

The protocol's core knows nothing about arguments, memory, specs, or any specific domain. Apps declare a vocabulary in the document's top-level `vocabulary` field.

```json
{
  "bendscript": "0.1",
  "vocabulary": "bendscript.argument.v1",
  ...
}
```

A processor that doesn't know `bendscript.argument.v1` MUST still render the document correctly using core primitives — it just won't apply argument-specific overlays or validation. **Vocabulary unknown = degrade, don't fail.**

Reserved vocabularies (managed by the protocol authors):

- `core` — the six primitives, no extensions.
- `bendscript.argument.v1` — for Deliberatic-style argumentation (positions, attacks, supports with weights).
- `bendscript.memory.v1` — for Graphonomous-style memory nodes (provenance, confidence, recall metadata).
- `bendscript.spec.v1` — for SpecPrompt-style capability specifications.
- `bendscript.runefort.v1` — for documents claimed by Runefort rooms.

Custom vocabularies are namespaced freely (`com.example.my-vocab.v1`). The protocol does not require registration.

## 3. Document shape (the canonical record)

A complete `.bend` file is a JSON object containing the six primitives plus header metadata.

```json
{
  "bendscript": "0.1",
  "id": "bafy2bzaceaxyz...",
  "vocabulary": "core",
  "title": "On the Memory Loop",
  "meta": {
    "created_at": "2026-04-27T10:00:00Z",
    "authors": ["did:plc:abc123"]
  },
  "blocks": [
    {
      "id": "blk-7f3a",
      "kind": "heading",
      "level": 1,
      "spans": [
        { "id": "spn-1a", "text": "On the Memory Loop" }
      ]
    },
    {
      "id": "blk-2b9c",
      "kind": "paragraph",
      "spans": [
        { "id": "spn-2a", "text": "The " },
        {
          "id": "spn-2b",
          "text": "memory loop",
          "marks": [
            { "kind": "link", "target": "bend:bafy2bzaceqrs", "predicate": "defines" }
          ]
        },
        { "id": "spn-2c", "text": " is closed when consolidation completes." }
      ]
    }
  ],
  "edges": [
    {
      "subject": "bend:bafy2bzaceaxyz#blk-2b9c",
      "predicate": "derives-from",
      "object": "bend:bafy2bzaceold#blk-3f1e",
      "meta": { "extracted_at": "2026-04-27T10:00:00Z" }
    }
  ]
}
```

The top-level fields:

- `bendscript` (required) — protocol version. v0.1 documents MUST set `"0.1"`.
- `id` (required) — the document's content-addressable id. See §5.1.
- `vocabulary` (required) — the vocabulary in use; `"core"` if no extensions.
- `title` (optional) — a string for display and indexing.
- `meta` (optional) — arbitrary metadata. Vocabularies define schemas for fields here; `core` defines none.
- `blocks` (required, possibly empty) — ordered list of blocks.
- `edges` (required, possibly empty) — list of edges. Order is not significant.

The JSON schema is canonical. There is no required field order beyond what JSON itself imposes. Processors MUST accept any field order; processors SHOULD emit fields in the order shown above for readability.

## 4. The text projection surface

The protocol does **not** specify a normative text projection in v0.1. The canonical record is JSON. Any human-readable rendering — markdown-ish, HTML, plain prose, a Roam-style outline view — is a downstream concern.

A separate document, `bendscript.text-projection.v1.md`, will specify *one* canonical text projection for v0.2. It is deferred from v0.1 deliberately: shipping the protocol's semantics first lets the projection be designed with full knowledge of what it must round-trip, rather than the other way around.

Until then, processors MAY ship their own text projections. None are normative. Documents are interchanged as JSON.

## 5. Identity & addressing

Every primitive in BendScript is addressable. This is what makes the format graph-first rather than text-first.

### 5.1 Document IDs

Document ids are **content-addressable**. The id is a hash of the canonical serialization of the document's `blocks` and `edges` arrays (excluding the `id` field itself, excluding `meta`).

The canonical serialization MUST follow **RFC 8785 (JSON Canonicalization Scheme / JCS)**: lexicographically sorted object keys, no insignificant whitespace, UTF-8, JSON numbers in their shortest IEEE 754 round-trippable form. Two conformant processors that disagree on canonicalization will produce different ids for the same document; JCS makes this impossible.

The id format is a **CIDv1** string per the IPLD content-address standard:

- multibase: base32 lowercase (the default for CIDv1)
- multicodec: `0x0200` (`json`, RFC 8259 JSON — matches the on-disk shape we are addressing)
- multihash: sha2-256

This combination produces ids beginning with `bagaaie...` (not `bafy2bzace...` — that prefix corresponds to `dag-cbor` + sha2-256, which would require encoding the document to CBOR before hashing). v0.1 uses the JSON multicodec because the canonical on-disk form is JSON; this avoids a CBOR dependency in conformant processors and keeps the hash story end-to-end JSON.

A v0.2 amendment may switch to `dag-cbor` (and the `bafy2bzace...` prefix) if interop with the IPLD ecosystem becomes the dominant concern. For v0.1, JSON-multicodec CIDs are the spec.

```
bend:bagaaiera...
```

Two documents with identical block content and edges have identical ids. Editing any character of any span produces a new id (and thus a new document — see §5.3 for how this composes with `supersedes`).

`meta` is excluded from the hash so that processors can attach metadata (authorship, timestamps, indexing hints) without invalidating the id. This is a deliberate trade-off: it means `meta` is *not* part of the document's identity, and two documents differing only in `meta` are the same document for graph purposes.

### 5.2 Block IDs

Block ids are **stable within a document** but not content-addressable across documents. They are short opaque strings (recommended: 4–8 hex characters with a `blk-` prefix).

Block ids are assigned at authoring time. Processors MUST NOT change block ids during round-trip. Processors MAY assign ids to blocks that lack them, using any deterministic scheme.

A block's id is unique within its document; it is not globally unique. To address a block from outside its document, use the addressing scheme in §5.4.

### 5.3 Span IDs and edit semantics

Span ids are stable within a block, assigned at authoring time, with the same shape as block ids (recommended: `spn-` prefix).

**Span identity under edits is the hardest design question in this protocol.** The spec takes the following position:

- A span's id is **opaque and stable**, not derived from its text. Editing a span's text does not change its id.
- This means edges pointing to a span survive text edits. This is the right behavior for most editing scenarios (typo fixes, rewording, light edits).
- For **substantive edits** that should logically invalidate inbound edges (e.g. the span no longer means what it meant), authors emit a new span with a new id and a `supersedes` edge from the new span to the old. The old span MAY be retained as a tombstone (text replaced by `null`, marks cleared) or removed entirely; processors MUST handle both.
- The choice of "is this edit substantive?" is the author's, not the protocol's. The protocol provides the mechanism (`supersedes`); the editor or LLM applies the policy.

This mirrors how content-addressed systems handle mutable references (Git's commit-supersedes-commit, AT Protocol's record updates). It is honest about the trade-off rather than pretending span identity under arbitrary edits has a clean answer.

### 5.4 The addressing scheme

Every BendScript reference uses the URI scheme:

```
bend:<doc-id>[#<block-id>[.<span-id>]]
```

Examples:

- `bend:bafy2bzaceaxyz` — a whole document
- `bend:bafy2bzaceaxyz#blk-7f3a` — a block within a document
- `bend:bafy2bzaceaxyz#blk-7f3a.spn-2b` — a span within a block

References without a fragment address the document. References with `#blk-id` address a block. References with `#blk-id.spn-id` address a span. The scheme is hierarchical: a span reference implies the containing block and document.

External references (links to non-BendScript content) use standard URIs:

```
https://example.com/article
did:plc:abc123
ipfs://bafy...
```

Edges MAY have any URI as subject or object. Processors MUST preserve unrecognized URI schemes in round-trip.

## 6. Edges

Edges are the protocol's reason to exist. This section specifies their semantics in detail.

### 6.1 Edge shape

```json
{
  "subject": "<addressable-reference>",
  "predicate": "<edge-type>",
  "object": "<addressable-reference>",
  "meta": { ... }
}
```

- `subject` (required) — the reference doing the linking. MUST be an intra-document reference (a `bend:` URI pointing into the current document) for edges that originate inside the document. MAY be an external reference for edges that the document is reporting but does not originate (rare; typically used in vocabulary extensions).
- `predicate` (required) — an edge type. MUST be drawn from the document's `vocabulary` or from `core`. Vocabulary-namespaced predicates use `<vocab>:<name>` form (`bendscript.argument.v1:rebuts`).
- `object` (required) — the reference being pointed at. MAY be intra-document, inter-document (another `bend:` URI), or external (any URI).
- `meta` (optional) — arbitrary metadata about the edge itself. Vocabularies define schemas for fields here; `core` reserves `weight` (a number in [0, 1]) and `confidence` (a number in [0, 1]).

### 6.2 Reserved edge predicates in `core`

The nine predicates from §2.4. Each is defined here with intended semantics:

| Predicate | Semantics |
|---|---|
| `cites` | Subject refers to object as a source. Untyped links default here for graph extraction. |
| `supports` | Subject argues in favor of object. Asymmetric. |
| `contradicts` | Subject argues against object. Asymmetric. |
| `derives-from` | Subject was derived, paraphrased, summarized, or extracted from object. |
| `supersedes` | Subject replaces object. Used for span edits (§5.3) and document revisions. |
| `transcludes` | Subject embeds object inline at render time. Renderers MAY inline the object's content. |
| `responds-to` | Subject is a reply or reaction to object. Used for threaded discourse. |
| `defines` | Subject provides a definition of object. |
| `exemplifies` | Subject is an example or instance of object. |

These are the nine `core` predicates. Vocabularies add more.

### 6.3 Vocabulary extensions

A vocabulary MAY introduce additional predicates. Predicates from a vocabulary are namespaced:

```json
{
  "subject": "bend:doc1#blk-1.spn-1",
  "predicate": "bendscript.argument.v1:rebuts",
  "object": "bend:doc2#blk-3.spn-7"
}
```

A processor that doesn't know `bendscript.argument.v1` MUST preserve the edge in round-trip and SHOULD treat it as an opaque typed edge for graph-extraction purposes.

### 6.4 Edge resolution

Edges may point to references that the processor cannot resolve at the moment (the target document hasn't been loaded, the network is unavailable, the target has been deleted, the target exists but the processor lacks permission to read it). The protocol defines four resolution states:

- **resolved** — the target exists and is loadable.
- **pending** — the target has not yet been fetched; resolution may succeed later.
- **broken** — the target is known not to exist or has been deleted.
- **unauthorized** — the target is known to exist but the processor lacks permission to fetch it.

Processors MUST distinguish these four states and MUST NOT silently drop edges with unresolved targets. Renderers SHOULD indicate resolution state in their UI.

The protocol does not specify *how* targets are resolved — that is the host's responsibility. A processor running against a local file system resolves intra-doc references trivially and inter-doc references by file lookup. A processor running against Graphonomous resolves all references through the graph store. A processor running against a federated network resolves through whatever discovery mechanism the network provides.

## 8. Round-trip guarantee

This section is gating. The protocol's pitch — "structured enough that frontier LLMs can produce, modify, and consume `.bend` JSON without losing semantics" — is a load-bearing claim, not a theorem. v0.1 is not final until the test harness specified here exists, has been run against three frontier models, and reports a drift rate at or below the threshold defined in §8.5.

If the harness fails, the protocol direction is reconsidered. This is not a clause to be quietly relaxed; it is the test that decides whether the design survives contact with itself.

### 8.1 Two distinct round-trip claims

There are two round-trip properties, and the spec distinguishes them sharply.

**§8.1.1 Parser round-trip — a strict guarantee.**

For any conformant processor and any conformant document `d`:

```
parse(serialize(parse(d))) === parse(d)
```

The two parsed forms MUST be structurally identical: same blocks in same order, same spans, same edges (after `link`-mark expansion per §2.5.1), same vocabulary, same id (recomputed identically per §5.1). This is a deterministic property of the processor implementation, testable with unit tests, and is a hard MUST for §9 conformance.

**§8.1.2 LLM round-trip — a measured property, not a guarantee.**

For frontier LLMs producing, modifying, or consuming `.bend` JSON:

```
semantic_distance(d, llm_modify(d, instruction)) ≤ θ
```

where `semantic_distance` is the metric defined in §8.4 and `θ` is the acceptance threshold defined in §8.5. This is a *measured* property — a bound on observed behavior, not a guarantee about future model behavior. The harness exists to keep this bound honest.

These are different claims with different teeth. §9 enforces §8.1.1 normatively. §14 is gated on §8.1.2.

### 8.2 Test corpus

The harness operates on a fixed corpus of 20 documents covering the protocol surface. Documents are checked in at `bendscript.com/test-corpus/v0.1/` and are themselves `.bend` JSON conforming to v0.1.

The corpus distribution:

| # | Coverage focus | Vocabulary | Approx. size |
|---|---|---|---|
| 1–3 | Plain prose, headings, paragraphs only | `core` | small (1–3 blocks) |
| 4–6 | Lists, nested lists, quotes | `core` | small |
| 7–9 | Code blocks, dividers, embeds | `core` | small |
| 10–12 | Marks (bold, italic, code, link) including untyped links | `core` | medium (5–10 blocks) |
| 13–14 | Inline link marks with all 9 core predicates | `core` | medium |
| 15 | Document-level edges with `meta.weight` and `meta.confidence` | `core` | medium |
| 16 | Span supersession with tombstones (§5.3) | `core` | medium |
| 17 | `bendscript.memory.v1` document with full vocabulary | `bendscript.memory.v1` | medium |
| 18 | `bendscript.argument.v1` document with attacks/supports | `bendscript.argument.v1` | medium |
| 19 | Cross-document edges (multiple `bend:` URIs in `edges`) | `core` | large (15+ blocks) |
| 20 | Adversarial: deeply nested lists, edge cases in canonicalization, Unicode in text | `core` | large |

Each document is paired with a fixed set of **modifications** the harness asks the LLM to perform — see §8.3. The corpus is fixed at v0.1; expanding it is a v0.2 concern.

### 8.3 Modification instructions

For each corpus document `d`, the harness runs three classes of tasks:

**Class A — Read-only comprehension.** "Given this `.bend` document, answer the following question about its content." Question is a fixed string per document. The model MUST NOT modify the JSON. Drift is measured by whether the answer references content that exists in `d`.

**Class B — Local edit.** "Change span X to say Y." or "Add a `bold` mark to the span containing 'memory loop'." or "Insert a new paragraph after block X." The model returns modified `.bend` JSON. Drift is measured per §8.4.

**Class C — Semantic edit.** "Mark this document as superseding its previous version (id `bafy2bzaceold...`) at the document level. Add the `supersedes` edge." or "Convert this untyped link to a typed `cites` link." Drift is measured per §8.4.

Each document × class combination produces one transcript. With 20 documents × 3 classes = 60 transcripts per model run. Three frontier models (§8.6) → 180 transcripts per harness execution.

### 8.4 The drift metric

`semantic_distance(d_before, d_after)` is computed as a weighted sum over five components, each in [0, 1]:

| Component | Weight | What it measures |
|---|---|---|
| **Block structure** | 0.25 | Edit distance over block kinds and order. Renaming a `paragraph` to `quote` is drift; reordering blocks is drift. |
| **Edge preservation** | 0.30 | Of all edges in `d_before`, what fraction are present (with same predicate) in `d_after`? Missing edges are drift; spurious new edges are also drift. |
| **Span coverage** | 0.20 | Concatenated text of `d_after` is checked against `d_before` minus the requested edit, using normalized diff. Unrequested text changes are drift. |
| **Mark fidelity** | 0.10 | Set difference over `(span_id, mark)` pairs, ignoring requested mark changes. |
| **Vocabulary integrity** | 0.15 | Did the document's `vocabulary` field change? Did vocabulary-namespaced predicates get rewritten as core predicates? Either is drift. |

Each component returns a number in [0, 1] where 0 = identical and 1 = maximally diverged. The weighted sum is the drift score.

For Class A (read-only), the drift metric is not applicable; instead the harness measures **answer faithfulness** — a binary judgment by a separate LLM judge on whether the answer references real content in `d`.

### 8.5 Acceptance threshold

The harness reports two numbers per (model, class) combination:

- **Median drift** across all 20 documents.
- **P95 drift** across all 20 documents.

For v0.1 to be called final:

- Class A answer faithfulness ≥ 0.90 across all three models.
- Class B median drift ≤ 0.05, P95 ≤ 0.20 across all three models.
- Class C median drift ≤ 0.10, P95 ≤ 0.30 across all three models.

If any model fails any threshold, the protocol direction is reconsidered. The thresholds are not sacred — if a single model fails by a small margin and the other two pass cleanly, that's a model-specific weakness, not a protocol failure. The thresholds exist to make "the protocol survived" a falsifiable claim.

### 8.6 Models

The harness runs against three frontier models simultaneously to avoid single-vendor noise:

- Claude Opus 4.6 or current frontier Anthropic model
- GPT-5.x or current frontier OpenAI model
- Gemini 2.x or current frontier Google model

All three are run via OpenRouter (paid, per the team's preference for unrestricted benchmarks). Re-running with new frontier models when they ship is a v0.1.x maintenance task, not a protocol-version change.

The harness does NOT use Haiku, Sonnet, GPT-mini, or other tier-down models for the gating run. Smaller models may be tested for informational purposes but their results do not gate v0.1.

### 8.7 Reproducibility

The harness, the corpus, all 60 modification instructions, and the drift metric implementation are checked into `bendscript.com/round-trip-harness/`. A run is reproducible to the extent the underlying models are deterministic (set `temperature=0`, fixed seeds where supported); inter-run noise is reported alongside the drift numbers.

The harness emits a single JSON report per run:

```json
{
  "harness_version": "0.1.0",
  "ran_at": "2026-04-27T15:30:00Z",
  "models": ["claude-opus-4-6", "gpt-5.x", "gemini-2.x"],
  "results": {
    "claude-opus-4-6": {
      "class_a_faithfulness": 0.95,
      "class_b_median_drift": 0.03,
      "class_b_p95_drift": 0.18,
      "class_c_median_drift": 0.08,
      "class_c_p95_drift": 0.25,
      "transcripts": "harness/runs/2026-04-27/claude-opus-4-6/"
    },
    ...
  },
  "verdict": "pass"
}
```

The verdict is `pass` only when all thresholds in §8.5 are met for all models. Any other state is `fail` with the failing thresholds enumerated.

### 8.8 What this section does not claim

The harness measures *current* frontier-model behavior on a *fixed* corpus with *one* drift metric. It does not claim:

- That all `.bend` documents will round-trip — adversarial documents not in the corpus may fail.
- That future models will preserve the bound — model regressions are possible and the harness must be re-run on each model upgrade.
- That the drift metric captures all forms of semantic loss — it is a proxy; semantic distance over structured documents is genuinely hard and §8.4 is a working approximation.

The honest framing is: "v0.1 ships when 60 modification tasks across 20 documents and 3 frontier models stay below the §8.5 thresholds, and the harness exists for any subsequent reader to re-run."

## 14. Relationship to the [&] portfolio

This section is gating. v0.1 is not final until at least one portfolio product has committed to adopting `bend:` URIs and shipped a vocabulary implementation. Sections §0–§6 are protocol mechanics; §14 is the protocol's reason to exist *for this portfolio*.

The [&] ecosystem is becoming a stack of protocols at different layers, not a stack of apps. BendScript fills the **document layer** that no other portfolio protocol claims. This section names each portfolio product and states explicitly whether it adopts BendScript, defers, or is at the wrong layer entirely.

### 14.1 Layer map

| Layer | Protocol | What it composes |
|---|---|---|
| Capability composition | [&] (`*.ampersand.json`) | Capabilities, claims, requirements |
| Loop topology | PULSE (`*.pulse.json`) | Phases, cadence, cross-loop signals |
| Diagnostic measurement | PRISM | Loops over time (BYOR benchmark) |
| **Document content** | **BendScript (`*.bend.json`)** | **Blocks, spans, typed edges** |
| Spatial layout | Runefort (`*.rune.json`) | Rooms, tiles, file-backed UI |
| Capability specs | SpecPrompt | Domain capabilities |
| Agent memory | Graphonomous | Continual-learning knowledge graph |
| Argumentation | Deliberatic | Positions, attacks, supports |

The four protocols ([&], PULSE, PRISM, BendScript) are orthogonal. A capability spec ([&]) declares what a system can do; a PULSE manifest declares how its loops circulate; a PRISM run measures loops over time; a BendScript document carries human-or-agent-authored content with typed graph edges. None of these depends on the others. They compose by reference.

### 14.2 What "adoption" means

A portfolio product adopts BendScript when **all three** of the following hold:

1. The product can produce, store, and consume `.bend` JSON documents conforming to §3.
2. The product implements (or imports) a vocabulary — either `core` or one of the reserved vocabularies in §2.6 — for its domain.
3. The product can resolve intra-product `bend:` URIs to the granularity the protocol allows (document / block / span).

Adoption does **not** require the product to be rewritten on top of BendScript. The expected pattern is: the product keeps its native data model, adds a `.bend` import/export layer, and exposes an MCP or API method that returns `bend:` URIs for graph references. BendScript is a portable interchange format, not a storage engine.

A product MAY adopt BendScript partially — for example, supporting export but not import in v1. Partial adoption is honest and SHOULD be documented in the product's CLAUDE.md.

### 14.3 Committed adopters (gating §14)

#### 14.3.1 Graphonomous (`bendscript.memory.v1`) — primary gating commitment

Graphonomous is the **first committed adopter** and the section's gating proof. The vocabulary `bendscript.memory.v1` exists because Graphonomous needs it, not the other way around.

Concretely, Graphonomous adopts BendScript as follows:

- Each Graphonomous **node** with non-trivial textual content is exportable as a single-block BendScript document. Node text becomes the document's `blocks[0]`; node provenance, confidence, and recall metadata become `meta` fields under the `bendscript.memory.v1` schema.
- Each Graphonomous **edge** between such nodes lifts to a BendScript edge with a vocabulary-namespaced predicate (`bendscript.memory.v1:cites-source`, `bendscript.memory.v1:derives-via-consolidation`, etc.).
- The Graphonomous MCP `retrieve` machine SHOULD accept `bend:` URIs as well as native node ids in its `query` parameter, and SHOULD return `bend:` URIs in its result references where the source is BendScript-shaped.
- Document IDs (§5.1) are computed lazily — Graphonomous does not store BendScript hashes for nodes that are never exported. When exported, the hash is computed and cached in node `meta`.

The vocabulary `bendscript.memory.v1` reserves the following predicates beyond `core`:

- `bendscript.memory.v1:consolidated-from` — the subject is a consolidation of the object.
- `bendscript.memory.v1:contradicts-with-evidence` — like `core:contradicts` but requires `meta.evidence` referencing supporting nodes.
- `bendscript.memory.v1:retrieved-for` — the subject was retrieved in service of the object goal-node.
- `bendscript.memory.v1:learned-from-outcome` — the subject's confidence was updated by an outcome on the object.

And the following `meta` fields:

- `meta.confidence` — number in [0, 1], required for `learn`-machine outputs.
- `meta.provenance` — array of `bend:` URIs or external URIs, the evidence chain.
- `meta.recall_count` — integer, monotonic.
- `meta.last_consolidated_at` — RFC 3339 timestamp.

The gating commitment: a Graphonomous node `→` BendScript document `→` Graphonomous node round-trip MUST preserve all retrievable semantics in the `bendscript.memory.v1` vocabulary. This is a discrete, testable claim and is the v0.1 final gate for §14.

#### 14.3.2 Deliberatic (`bendscript.argument.v1`) — committed but deferred

Deliberatic is in-memory and currently has no persistence layer. It commits to using `bendscript.argument.v1` as its on-disk format when persistence is added — not before. This is honest deferral, not aspirational adoption.

`bendscript.argument.v1` reserves:

- Block kinds: `argument-position`, `argument-attack`, `argument-support`.
- Predicates: `bendscript.argument.v1:rebuts`, `bendscript.argument.v1:undercuts`, `bendscript.argument.v1:undermines`, `bendscript.argument.v1:reinstates`.
- Meta: `meta.attack_strength` in [0, 1], `meta.dialectical_status` in `{in, out, undecided}`.

When Deliberatic ships persistence, the v0.2 BendScript spec MUST validate these against the deliberation engine's outputs.

#### 14.3.3 SpecPrompt (`bendscript.spec.v1`) — committed conditionally

SpecPrompt has both a filesystem mode (git-based, no DB) and a registry mode (Supabase-backed). The filesystem mode commits to `bendscript.spec.v1` as the canonical on-disk format for capability specs; the registry mode is the host that resolves `bend:` URIs.

`bendscript.spec.v1` reserves:

- Block kinds: `capability`, `requirement`, `claim`, `example`.
- Predicates: `bendscript.spec.v1:requires`, `bendscript.spec.v1:provides`, `bendscript.spec.v1:satisfies`, `bendscript.spec.v1:incompatible-with`.
- Meta: `meta.capability_id` (string, required for `capability` blocks), `meta.version` (semver string).

The condition on this commitment: SpecPrompt's existing `*.spec.json` format is established. The migration path is `bendscript.spec.v1` documents that *embed* the existing JSON in their `meta`, allowing tools to read either form. v0.2 may collapse them.

#### 14.3.4 Runefort (`bendscript.runefort.v1`) — committed at the claim layer

Runefort claims arbitrary files into rooms. Files are not required to be BendScript. `bendscript.runefort.v1` is the vocabulary for documents that **describe Runefort claims themselves** — manifests, room layouts, claim tickets — not for documents that happen to live inside a Runefort room.

`bendscript.runefort.v1` reserves:

- Block kinds: `claim-ticket`, `room-manifest`, `tile-binding`.
- Predicates: `bendscript.runefort.v1:claims`, `bendscript.runefort.v1:bound-to-tile`, `bendscript.runefort.v1:supersedes-claim`.

Adoption is narrow and intentional. Most Runefort use does not involve BendScript at all.

### 14.4 Products that do NOT adopt (and why)

#### 14.4.1 [&] Protocol — wrong layer

[&] composes capabilities, not content. An `*.ampersand.json` describes what a system can do, with claims and requirements; it has no notion of textual blocks, spans, or marks. BendScript and [&] compose by reference: a BendScript document's `meta` MAY include an [&] capability id that the document satisfies, and an [&] capability MAY claim "produces BendScript documents conforming to vocabulary X." Neither protocol embeds the other.

#### 14.4.2 PULSE — wrong layer

PULSE describes loop topology and circulation. A `*.pulse.json` is structural metadata about phases and cadence; it is not a document with content. PULSE manifests are not BendScript documents and SHOULD NOT be expressed as such. A BendScript document MAY reference a PULSE manifest in its `meta` (e.g., "this content was authored by phase X of loop Y"), but the manifest itself stays in PULSE format.

#### 14.4.3 PRISM — diagnostic, not document

PRISM measures loops over time. Its outputs are scenarios, runs, and judgments — relational data, not documents. Where PRISM produces human-readable artifacts (transcripts, reports), those MAY be exported as BendScript documents using `core`, but PRISM's primary surface is not BendScript.

#### 14.4.4 WebHost.Systems — host, not consumer

WebHost.Systems is the deployment substrate for portfolio sites. It does not produce or consume BendScript documents. It MAY *host* services that do — e.g., a future BendScript document store backed by `webhost.*` schemas — but the protocol does not depend on WebHost.

### 14.5 Compositional invariants

Three invariants govern how BendScript composes with the rest of the portfolio. These are normative.

1. **No portfolio product is required to use BendScript.** Adoption is opt-in at the product level. A product that does not adopt BendScript is fully conformant with the [&] portfolio.
2. **BendScript does not require any portfolio product.** A `.bend` JSON document is meaningful without [&], without PULSE, without PRISM, without Graphonomous. The reference framework `bendscript-core` (§13) has no portfolio dependencies.
3. **Vocabularies are owned by their adopting product, not by BendScript.** The `bendscript.memory.v1` vocabulary lives wherever Graphonomous decides — likely in `graphonomous/priv/bendscript-vocab/` — and Graphonomous owns its evolution. The BendScript spec only reserves the *name* and the namespace; it does not freeze the vocabulary's contents.

### 14.6 Cross-product references

When a BendScript document originates in one product and references content in another, the reference uses the standard `bend:` URI scheme (§5.4). The resolving processor is responsible for federation: resolving a `bend:` URI whose document lives in Graphonomous from a context running in SpecPrompt is a job for the host, not the protocol.

The protocol does not specify a federation mechanism for v0.1. v0.2 may. For now, cross-product references are resolved by the host through whatever channel exists (HTTP fetch, MCP resource read, filesystem lookup). The protocol guarantees the URI is well-formed and the target's identity is stable; it does not guarantee any particular product can fetch it.

---

*This is sections 0–6 and §14 of the BendScript v0.1 protocol. Sections 7–13 and §15 (marks detail, round-trip guarantee, processor contract, vocabularies, non-goals, versioning, reference framework, open questions) remain to be drafted and follow the same RFC discipline.*

*Status flags:*
- *§5.3 (span identity under edits) is the most likely section to change before v0.1 final.*
- *§4 (text projection) is intentionally deferred; do not interpret its absence as oversight.*
- *§6.1's distinction between intra-document edges and external edges may collapse into a single rule before v0.1 final.*
- *§8 (LLM round-trip test harness) is gating: if frontier models cannot reliably round-trip `.bend` JSON without semantic drift, the protocol direction is reconsidered.*
- *§14.3.1 (Graphonomous as primary adopter) is the gating commitment for v0.1 final. Until Graphonomous ships a `bendscript.memory.v1` import/export round-trip and demonstrates semantic preservation, v0.1 stays in draft.*
