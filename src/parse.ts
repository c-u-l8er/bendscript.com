// Parse a BendScript document from JSON text.
// The "parsed" form is the same shape as the on-disk JSON; normalization
// (link-mark expansion) is a separate step (`normalize`).

import { expandLinkMarks } from "./expand-marks.ts";
import type { Document } from "./types.ts";
import { validate } from "./validate.ts";

/**
 * Parse a BendScript document from a JSON string.
 * Throws on invalid JSON or invalid document structure.
 */
export function parse(text: string): Document {
  const json = JSON.parse(text);
  validate(json);
  return json;
}

/**
 * Normalize a parsed document: expand all `link` marks with predicates into
 * the edges array. The on-disk-equivalent form is preserved (mark stays in
 * place); the edges array becomes the canonical home.
 */
export function normalize(doc: Document): Document {
  return expandLinkMarks(doc);
}

/**
 * Convenience: parse + normalize in one step.
 */
export function parseAndNormalize(text: string): Document {
  return normalize(parse(text));
}
