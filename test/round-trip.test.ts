// §8.1.1 — strict parser round-trip guarantee.
//
// For every document in the test corpus:
//   - parse(serialize(parse(d))) === parse(d)
//   - the canonical hash is stable across parse/serialize cycles
//   - mutating any character of any span text changes the document id
//   - link marks expand deterministically into edges

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  computeDocumentId,
  expandLinkMarks,
  parse,
  parseAndNormalize,
  serialize,
  serializeCanonical,
} from "../src/index.ts";

const CORPUS_DIR = join(import.meta.dirname, "..", "test-corpus", "v0.1");

function corpusFiles(): string[] {
  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".bend.json"))
    .sort();
}

function loadCorpus(file: string) {
  const text = readFileSync(join(CORPUS_DIR, file), "utf8");
  return { text, file };
}

describe("§8.1.1 parser round-trip", () => {
  for (const file of corpusFiles()) {
    it(`${file}: parse(serialize(parse(d))) === parse(d)`, () => {
      const { text } = loadCorpus(file);
      const parsed1 = parse(text);
      const serialized = serialize(parsed1);
      const parsed2 = parse(serialized);
      expect(parsed2).toEqual(parsed1);
    });
  }
});

describe("§5.1 content-addressable id determinism", () => {
  for (const file of corpusFiles()) {
    it(`${file}: id is stable across parse/serialize cycles`, async () => {
      const { text } = loadCorpus(file);
      const d1 = parse(text);
      const id1 = await computeDocumentId(d1);
      const d2 = parse(serialize(d1));
      const id2 = await computeDocumentId(d2);
      expect(id1).toBe(id2);
    });

    it(`${file}: editing span text changes the id`, async () => {
      const { text } = loadCorpus(file);
      const d = parse(text);
      const id1 = await computeDocumentId(d);
      // Mutate first span text we can find
      const mutated = JSON.parse(JSON.stringify(d));
      mutated.blocks = mutateFirstSpan(mutated.blocks);
      const id2 = await computeDocumentId(mutated);
      // If the corpus document had no mutable span, this test is a no-op.
      // Otherwise, ids must differ.
      if (foundMutableSpan(d.blocks)) {
        expect(id2).not.toBe(id1);
      }
    });

    it(`${file}: editing meta does NOT change the id`, async () => {
      const { text } = loadCorpus(file);
      const d = parse(text);
      const id1 = await computeDocumentId(d);
      const withMeta = { ...d, meta: { ...(d.meta ?? {}), modified: "yes" } };
      const id2 = await computeDocumentId(withMeta);
      expect(id2).toBe(id1);
    });
  }
});

describe("§2.5.1 link mark expansion", () => {
  it("typed link mark produces an edge with correct subject/predicate/object", () => {
    const text = readFileSync(join(CORPUS_DIR, "04-typed-link.bend.json"), "utf8");
    const d = parseAndNormalize(text);
    expect(d.edges).toHaveLength(1);
    const [edge] = d.edges;
    expect(edge.predicate).toBe("defines");
    expect(edge.object).toBe("bend:bafyfakefake");
    // Subject must be the span URI: bend:<doc-id>#<block-id>.<span-id>
    expect(edge.subject).toMatch(/^bend:[^#]+#blk-1\.spn-2$/);
  });

  it("expansion is idempotent — running twice yields same edge count", () => {
    const text = readFileSync(join(CORPUS_DIR, "04-typed-link.bend.json"), "utf8");
    const d1 = parseAndNormalize(text);
    const d2 = expandLinkMarks(d1);
    expect(d2.edges).toEqual(d1.edges);
  });

  it("link mark without predicate does NOT produce an edge", () => {
    const doc = {
      bendscript: "0.1" as const,
      id: "test",
      vocabulary: "core",
      blocks: [
        {
          id: "blk-1",
          kind: "paragraph",
          spans: [
            {
              id: "spn-1",
              text: "untyped",
              marks: [{ kind: "link" as const, target: "bend:other" }],
            },
          ],
        },
      ],
      edges: [],
    };
    const expanded = expandLinkMarks(doc);
    expect(expanded.edges).toHaveLength(0);
  });
});

describe("§5.1 RFC 8785 canonicalization", () => {
  it("key order does not affect canonical output", () => {
    const a = { a: 1, b: 2, c: { d: 3, e: 4 } };
    const b = { c: { e: 4, d: 3 }, b: 2, a: 1 };
    expect(serializeCanonical(a as any)).toBe(serializeCanonical(b as any));
  });

  it("two documents with identical content produce identical ids", async () => {
    const text = readFileSync(join(CORPUS_DIR, "01-plain-prose.bend.json"), "utf8");
    const d1 = parse(text);
    // Construct a structurally identical doc with different field order
    const d2 = parse(JSON.stringify({
      edges: d1.edges,
      blocks: d1.blocks,
      vocabulary: d1.vocabulary,
      id: d1.id,
      bendscript: d1.bendscript,
      title: d1.title,
    }));
    const id1 = await computeDocumentId(d1);
    const id2 = await computeDocumentId(d2);
    expect(id1).toBe(id2);
  });
});

// --- helpers ---

function mutateFirstSpan(blocks: any[]): any[] {
  const cloned = JSON.parse(JSON.stringify(blocks));
  let mutated = false;
  walk(cloned, (b) => {
    if (mutated) return;
    if (b.spans && b.spans.length > 0 && typeof b.spans[0].text === "string") {
      b.spans[0].text = b.spans[0].text + "!";
      mutated = true;
    }
  });
  return cloned;
}

function foundMutableSpan(blocks: any[]): boolean {
  let found = false;
  walk(blocks, (b) => {
    if (b.spans && b.spans.length > 0 && typeof b.spans[0].text === "string") found = true;
  });
  return found;
}

function walk(blocks: any[], visit: (b: any) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.blocks) walk(b.blocks, visit);
    if (b.items) walk(b.items, visit);
  }
}
