// Structural validation for parsed BendScript documents.
// Validates the shape required by §2 and §3. Does NOT validate vocabulary-specific
// constraints — that's the vocabulary's job.

import type { Block, Document, Edge, Mark, Span } from "./types.ts";

export class ValidationError extends Error {
  constructor(
    message: string,
    public path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = "ValidationError";
  }
}

const CORE_PREDICATES = new Set([
  "cites",
  "supports",
  "contradicts",
  "derives-from",
  "supersedes",
  "transcludes",
  "responds-to",
  "defines",
  "exemplifies",
]);

const CORE_BLOCK_KINDS = new Set([
  "paragraph",
  "heading",
  "list",
  "list-item",
  "code",
  "quote",
  "embed",
  "divider",
]);

const ALLOWED_MARK_KINDS = new Set(["bold", "italic", "code", "link"]);

const BEND_URI_RE = /^bend:[A-Za-z0-9]+(?:#[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)?$/;

export function isBendUri(s: string): boolean {
  return BEND_URI_RE.test(s);
}

export function validate(doc: unknown): asserts doc is Document {
  if (typeof doc !== "object" || doc === null) {
    throw new ValidationError("document must be an object", "$");
  }
  const d = doc as Record<string, unknown>;
  if (d.bendscript !== "0.1") {
    throw new ValidationError(`bendscript must be "0.1"`, "$.bendscript");
  }
  if (typeof d.id !== "string") {
    throw new ValidationError("id must be a string", "$.id");
  }
  if (typeof d.vocabulary !== "string") {
    throw new ValidationError("vocabulary must be a string", "$.vocabulary");
  }
  if (!Array.isArray(d.blocks)) {
    throw new ValidationError("blocks must be an array", "$.blocks");
  }
  if (!Array.isArray(d.edges)) {
    throw new ValidationError("edges must be an array", "$.edges");
  }
  d.blocks.forEach((b, i) => validateBlock(b, `$.blocks[${i}]`));
  d.edges.forEach((e, i) => validateEdge(e, `$.edges[${i}]`, d.vocabulary as string));
}

function validateBlock(block: unknown, path: string): asserts block is Block {
  if (typeof block !== "object" || block === null) {
    throw new ValidationError("block must be an object", path);
  }
  const b = block as Record<string, unknown>;
  if (typeof b.id !== "string") {
    throw new ValidationError("block.id must be a string", `${path}.id`);
  }
  if (typeof b.kind !== "string") {
    throw new ValidationError("block.kind must be a string", `${path}.kind`);
  }
  if (CORE_BLOCK_KINDS.has(b.kind)) {
    validateCoreBlock(b, path);
  }
  // For unknown kinds: preserve as-is per §2.2 ("processors that don't
  // recognize a kind MUST preserve it in round-trip").
  if (Array.isArray(b.spans)) {
    b.spans.forEach((s, i) => validateSpan(s, `${path}.spans[${i}]`));
  }
  if (Array.isArray(b.blocks)) {
    b.blocks.forEach((bb, i) => validateBlock(bb, `${path}.blocks[${i}]`));
  }
  if (Array.isArray(b.items)) {
    b.items.forEach((bb, i) => validateBlock(bb, `${path}.items[${i}]`));
  }
}

function validateCoreBlock(b: Record<string, unknown>, path: string): void {
  switch (b.kind) {
    case "paragraph":
      if (!Array.isArray(b.spans)) {
        throw new ValidationError("paragraph requires spans[]", `${path}.spans`);
      }
      break;
    case "heading":
      if (!Array.isArray(b.spans)) {
        throw new ValidationError("heading requires spans[]", `${path}.spans`);
      }
      if (typeof b.level !== "number" || b.level < 1 || b.level > 6) {
        throw new ValidationError("heading.level must be 1..6", `${path}.level`);
      }
      break;
    case "list":
      if (typeof b.ordered !== "boolean") {
        throw new ValidationError("list.ordered must be boolean", `${path}.ordered`);
      }
      if (!Array.isArray(b.items)) {
        throw new ValidationError("list requires items[]", `${path}.items`);
      }
      break;
    case "list-item":
      if (!Array.isArray(b.blocks)) {
        throw new ValidationError("list-item requires blocks[]", `${path}.blocks`);
      }
      break;
    case "code":
      if (typeof b.text !== "string") {
        throw new ValidationError("code.text must be string", `${path}.text`);
      }
      if (typeof b.language !== "string") {
        throw new ValidationError("code.language must be string", `${path}.language`);
      }
      break;
    case "quote":
      if (!Array.isArray(b.blocks)) {
        throw new ValidationError("quote requires blocks[]", `${path}.blocks`);
      }
      break;
    case "embed":
      if (typeof b.target !== "string") {
        throw new ValidationError("embed.target must be string", `${path}.target`);
      }
      break;
    case "divider":
      // No content fields
      break;
  }
}

function validateSpan(span: unknown, path: string): asserts span is Span {
  if (typeof span !== "object" || span === null) {
    throw new ValidationError("span must be an object", path);
  }
  const s = span as Record<string, unknown>;
  if (typeof s.id !== "string") {
    throw new ValidationError("span.id must be a string", `${path}.id`);
  }
  if (s.text !== null && typeof s.text !== "string") {
    throw new ValidationError("span.text must be string or null", `${path}.text`);
  }
  if (s.marks !== undefined) {
    if (!Array.isArray(s.marks)) {
      throw new ValidationError("span.marks must be an array", `${path}.marks`);
    }
    s.marks.forEach((m, i) => validateMark(m, `${path}.marks[${i}]`));
  }
}

function validateMark(mark: unknown, path: string): asserts mark is Mark {
  if (typeof mark === "string") {
    if (!ALLOWED_MARK_KINDS.has(mark) || mark === "link") {
      throw new ValidationError(
        `mark must be one of bold|italic|code (link mark must be an object)`,
        path,
      );
    }
    return;
  }
  if (typeof mark !== "object" || mark === null) {
    throw new ValidationError("mark must be a string or object", path);
  }
  const m = mark as Record<string, unknown>;
  if (m.kind !== "link") {
    throw new ValidationError(`object marks must have kind="link"`, `${path}.kind`);
  }
  if (typeof m.target !== "string") {
    throw new ValidationError("link mark requires target string", `${path}.target`);
  }
  if (m.predicate !== undefined && typeof m.predicate !== "string") {
    throw new ValidationError("link mark predicate must be string if present", `${path}.predicate`);
  }
}

function validateEdge(edge: unknown, path: string, vocabulary: string): asserts edge is Edge {
  if (typeof edge !== "object" || edge === null) {
    throw new ValidationError("edge must be an object", path);
  }
  const e = edge as Record<string, unknown>;
  if (typeof e.subject !== "string") {
    throw new ValidationError("edge.subject must be string", `${path}.subject`);
  }
  if (typeof e.predicate !== "string") {
    throw new ValidationError("edge.predicate must be string", `${path}.predicate`);
  }
  if (typeof e.object !== "string") {
    throw new ValidationError("edge.object must be string", `${path}.object`);
  }
  // Predicate validation: either core, or namespaced. We don't reject unknown
  // namespaces — that violates the "preserve, don't fail" rule of §2.4.
  const isCore = CORE_PREDICATES.has(e.predicate);
  const isNamespaced = e.predicate.includes(":");
  if (!isCore && !isNamespaced) {
    throw new ValidationError(
      `predicate "${e.predicate}" is neither a core predicate nor namespaced (vocab="${vocabulary}")`,
      `${path}.predicate`,
    );
  }
}
