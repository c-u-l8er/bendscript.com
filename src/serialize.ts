// Serialize a parsed BendScript document back to JSON text.
//
// Two serialization modes:
//   - serialize(): pretty-printed JSON for human inspection / on-disk storage
//   - serializeCanonical(): RFC 8785 canonical form, used as hash input
//
// The protocol does not mandate any particular pretty-print format. Field
// order in the pretty-printed form follows §3 (bendscript, id, vocabulary,
// title, meta, blocks, edges) but this is a SHOULD, not a MUST.

import { canonicalize } from "./canonicalize.ts";
import type { Document } from "./types.ts";

const FIELD_ORDER = ["bendscript", "id", "vocabulary", "title", "meta", "blocks", "edges"];

/**
 * Serialize to pretty-printed JSON with the recommended top-level field order.
 */
export function serialize(doc: Document): string {
  const ordered: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) {
    if (key in doc) ordered[key] = (doc as unknown as Record<string, unknown>)[key];
  }
  // Preserve any unknown top-level fields (for forward-compat)
  for (const key of Object.keys(doc)) {
    if (!FIELD_ORDER.includes(key)) ordered[key] = (doc as unknown as Record<string, unknown>)[key];
  }
  return JSON.stringify(ordered, null, 2);
}

/**
 * RFC 8785 canonical serialization. This is the form that hashes to the
 * document id (after excluding `id` and `meta` per §5.1).
 */
export function serializeCanonical(doc: Document): string {
  return canonicalize(doc);
}
