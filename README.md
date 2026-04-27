# bendscript-core

Reference parser, validator, and round-trip harness for the **BendScript Protocol v0.1** — a graph-first document format with typed inline link facets, for agent-native systems.

> Status: **v0.1 alpha (sections 0–6 of the spec).** API may shift before `0.1.0` final.

## What is BendScript?

BendScript is a JSON document format that treats prose, structure, and a knowledge graph as one thing. Every document is content-addressable, every inline link can carry a typed predicate, and every typed link expands into a deterministic graph edge.

- **`bend:` URI scheme** — content-addressable doc ids, span-addressable edges
- **Five reserved vocabularies** — core, memory, argument, spec, runefort
- **§2.5.1 link-mark expansion** — typed inline link facets become first-class graph edges
- **§8.1.1 strict round-trip** — `parse(serialize(parse(d))) === parse(d)` for every conforming document

The full spec lives at <https://bendscript.com> and in [docs/spec/](https://github.com/c-u-l8er/bendscript.com/blob/main/docs/spec/README.md).

## Install

```bash
npm install bendscript-core
```

Requires Node 20+.

## Usage

```ts
import {
  parse,
  parseAndNormalize,
  serialize,
  serializeCanonical,
  validate,
  expandLinkMarks,
  computeDocumentId,
} from "bendscript-core";

const text = `{
  "version": "bendscript/0.1",
  "id": "bafy...",
  "vocabulary": "core",
  "blocks": [
    { "id": "blk-1", "kind": "paragraph", "spans": [{ "id": "spn-1", "text": "Hello." }] }
  ]
}`;

const doc = parseAndNormalize(text);
validate(doc);                         // throws ValidationError on structural errors
const id = await computeDocumentId(doc);
const edges = expandLinkMarks(doc);    // typed link marks → graph edges
const canonical = serializeCanonical(doc);
```

### Round-trip / drift harness

The harness used by the spec's §8 LLM round-trip evaluation is exposed as a subpath import:

```ts
import {
  MockModel,
  loadCorpus,
  runHarness,
  computeDrift,
  median,
  p95,
} from "bendscript-core/harness";
```

Bring your own `ModelClient` to evaluate any model against the BendScript corpus, or use `MockModel` for harness-mechanic tests with no API costs.

## API surface

**Main entry (`bendscript-core`)**
- `parse(text)`, `normalize(doc)`, `parseAndNormalize(text)`
- `serialize(doc)`, `serializeCanonical(doc)`
- `canonicalize(value)` — RFC 8785 (JCS) wrapper
- `computeDocumentId(doc)`, `expectedDocumentId(doc)`, `canonicalHashInput(doc)`
- `expandLinkMarks(doc)` — §2.5.1 link-mark → edge expansion (idempotent, dedup'd)
- `validate(doc)`, `ValidationError`, `isBendUri(s)`
- Types: `Document`, `NormalizedDocument`, `Block`, `Span`, `Edge`, `Mark`, `LinkMark`, `MarkKind`, `Predicate`, `ProtocolVersion`

**Harness subpath (`bendscript-core/harness`)**
- `runHarness({ corpus, models, classes })`, `runOne(...)`
- `loadCorpus(dir)`, `buildPrompt(...)`
- `computeDrift(before, after)`, `median(arr)`, `p95(arr)`, `aggregate(...)`
- `MockModel(name, { mode })`, `MockMode`
- `THRESHOLDS`, `DRIFT_WEIGHTS`
- Types: `CorpusEntry`, `DriftScore`, `DriftComponents`, `ModelClient`, `RunReport`, `Transcript`, `TaskClass`

## License

MIT © Travis Burandt — see [LICENSE](./LICENSE).
