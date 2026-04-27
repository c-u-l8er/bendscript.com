// bendscript-core — public API
export type {
  Block,
  Document,
  Edge,
  LinkMark,
  Mark,
  MarkKind,
  NormalizedDocument,
  Predicate,
  ProtocolVersion,
  Span,
} from "./types.ts";

export { parse, normalize, parseAndNormalize } from "./parse.ts";
export { serialize, serializeCanonical } from "./serialize.ts";
export { canonicalize } from "./canonicalize.ts";
export { computeDocumentId, expectedDocumentId, canonicalHashInput } from "./hash.ts";
export { expandLinkMarks } from "./expand-marks.ts";
export { validate, ValidationError, isBendUri } from "./validate.ts";
