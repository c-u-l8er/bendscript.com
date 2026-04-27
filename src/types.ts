// BendScript Protocol v0.1 — core type definitions
// See docs/spec/README.md §2 for the canonical definitions.

export type ProtocolVersion = "0.1";

// §2.5 — fixed by protocol version, not extensible by vocabulary
export type MarkKind = "bold" | "italic" | "code" | "link";

// §2.6 — reserved core predicates
export type CorePredicate =
  | "cites"
  | "supports"
  | "contradicts"
  | "derives-from"
  | "supersedes"
  | "transcludes"
  | "responds-to"
  | "defines"
  | "exemplifies";

// Predicates may be from core, or vocabulary-namespaced (e.g. "bendscript.argument.v1:rebuts")
export type Predicate = CorePredicate | string;

// §2.5.1 — the link mark carries data; all other marks are bare names
export type LinkMark = {
  kind: "link";
  target: string;
  predicate?: Predicate;
};

export type Mark = "bold" | "italic" | "code" | LinkMark;

// §2.3 — the addressable unit of text
export type Span = {
  id: string;
  text: string | null; // null indicates a tombstone span (§5.3)
  marks?: Mark[];
};

// §2.2 — block kinds reserved by core
export type CoreBlockKind =
  | "paragraph"
  | "heading"
  | "list"
  | "list-item"
  | "code"
  | "quote"
  | "embed"
  | "divider";

// Generic block — discriminated by `kind`. Vocabularies may add kinds.
export type Block = {
  id: string;
  kind: string;
  // Discriminated content fields — one or more depending on kind
  spans?: Span[];
  blocks?: Block[];
  items?: Block[];
  text?: string;
  // Per-kind fields
  level?: number; // heading
  ordered?: boolean; // list
  language?: string; // code
  target?: string; // embed
  // Catchall for vocabulary-defined fields
  [extra: string]: unknown;
};

// §2.4 — typed graph link
export type Edge = {
  subject: string;
  predicate: Predicate;
  object: string;
  meta?: Record<string, unknown>;
};

// §3 — top-level document record
export type Document = {
  bendscript: ProtocolVersion;
  id: string;
  vocabulary: string;
  title?: string;
  meta?: Record<string, unknown>;
  blocks: Block[];
  edges: Edge[];
};

// Computed-but-not-stored: the parsed-and-normalized form has all `link` marks
// expanded into the edges array. The on-disk form may have edges in either place.
export type NormalizedDocument = Document;
