// §2.5.1 — link marks expand deterministically into the edges array.
// The on-disk form may carry a typed inline link as either:
//   (a) a `link` mark on a span with a `predicate` field, OR
//   (b) an entry in the document's top-level `edges` array
// The parsed-and-normalized form has all (a) expanded into (b).

import type { Block, Document, Edge, LinkMark, Span } from "./types.ts";

/**
 * Walk a document's blocks. Yields every span with its containing block id.
 */
function* walkSpans(blocks: Block[]): Generator<{ block: Block; span: Span }> {
  for (const block of blocks) {
    if (block.spans) {
      for (const span of block.spans) {
        yield { block, span };
      }
    }
    if (block.blocks) yield* walkSpans(block.blocks);
    if (block.items) yield* walkSpans(block.items);
  }
}

/**
 * Expand all `link` marks with a `predicate` into the edges array.
 * The mark itself is preserved on the span (for round-trip fidelity);
 * the edge is appended to `doc.edges` if not already present.
 *
 * Two edges with the same (subject, predicate, object) triple are
 * considered duplicates and are not double-emitted.
 */
export function expandLinkMarks(doc: Document): Document {
  const edges = [...doc.edges];
  const seen = new Set<string>();
  for (const e of edges) {
    seen.add(edgeKey(e.subject, e.predicate, e.object));
  }
  for (const { block, span } of walkSpans(doc.blocks)) {
    if (!span.marks) continue;
    for (const mark of span.marks) {
      if (typeof mark === "string") continue;
      if (mark.kind !== "link") continue;
      const linkMark = mark as LinkMark;
      // §2.5.1: untyped links (no predicate) do NOT produce an edge.
      // Spec: "MUST preserve the absence of the predicate in round-trip."
      if (!linkMark.predicate) continue;
      const subject = `bend:${doc.id}#${block.id}.${span.id}`;
      const key = edgeKey(subject, linkMark.predicate, linkMark.target);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        subject,
        predicate: linkMark.predicate,
        object: linkMark.target,
      });
    }
  }
  return { ...doc, edges };
}

function edgeKey(subject: string, predicate: string, object: string): string {
  return `${subject}\x00${predicate}\x00${object}`;
}
