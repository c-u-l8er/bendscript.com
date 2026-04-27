// §8.4 drift metric: 5 components, each in [0, 1], weighted sum.

import type { Block, Document, Edge, Span } from "../types.ts";
import { DRIFT_WEIGHTS, type DriftComponents, type DriftScore } from "./types.ts";

/**
 * Compute drift between two documents.
 * Both docs are expected to be normalized (link-marks expanded into edges).
 */
export function computeDrift(before: Document, after: Document): DriftScore {
  const components: DriftComponents = {
    block_structure: blockStructureDrift(before, after),
    edge_preservation: edgePreservationDrift(before, after),
    span_coverage: spanCoverageDrift(before, after),
    mark_fidelity: markFidelityDrift(before, after),
    vocabulary_integrity: vocabularyIntegrityDrift(before, after),
  };
  const total =
    components.block_structure * DRIFT_WEIGHTS.block_structure +
    components.edge_preservation * DRIFT_WEIGHTS.edge_preservation +
    components.span_coverage * DRIFT_WEIGHTS.span_coverage +
    components.mark_fidelity * DRIFT_WEIGHTS.mark_fidelity +
    components.vocabulary_integrity * DRIFT_WEIGHTS.vocabulary_integrity;
  return { components, total };
}

// --- §8.4 component 1: block structure ---
// Edit distance over (kind, depth) sequences. Renaming or reordering blocks
// counts as drift. Pure addition/removal also counts.
function blockStructureDrift(a: Document, b: Document): number {
  const seqA = blockKindSequence(a.blocks, 0);
  const seqB = blockKindSequence(b.blocks, 0);
  if (seqA.length === 0 && seqB.length === 0) return 0;
  const distance = levenshtein(seqA, seqB);
  return Math.min(1, distance / Math.max(seqA.length, seqB.length, 1));
}

function blockKindSequence(blocks: Block[], depth: number): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    out.push(`${depth}:${b.kind}`);
    if (b.blocks) out.push(...blockKindSequence(b.blocks, depth + 1));
    if (b.items) out.push(...blockKindSequence(b.items, depth + 1));
  }
  return out;
}

// --- §8.4 component 2: edge preservation ---
// Of edges in `before`, what fraction are present in `after` with same predicate?
// Spurious new edges in `after` also penalize.
function edgePreservationDrift(a: Document, b: Document): number {
  const edgesA = a.edges.map(edgeKey);
  const edgesB = b.edges.map(edgeKey);
  if (edgesA.length === 0 && edgesB.length === 0) return 0;
  const setA = new Set(edgesA);
  const setB = new Set(edgesB);
  const missing = edgesA.filter((k) => !setB.has(k)).length;
  const spurious = edgesB.filter((k) => !setA.has(k)).length;
  const total = setA.size + spurious;
  return total === 0 ? 0 : (missing + spurious) / total;
}

function edgeKey(e: Edge): string {
  return `${e.subject}\x00${e.predicate}\x00${e.object}`;
}

// --- §8.4 component 3: span coverage ---
// Concatenated text of `after` is checked against `before`. Unrequested
// text changes are drift. Approximated with normalized character-level
// edit-distance ratio.
function spanCoverageDrift(a: Document, b: Document): number {
  const textA = concatText(a.blocks);
  const textB = concatText(b.blocks);
  if (textA.length === 0 && textB.length === 0) return 0;
  const distance = levenshteinChars(textA, textB);
  return Math.min(1, distance / Math.max(textA.length, textB.length, 1));
}

function concatText(blocks: Block[]): string {
  let out = "";
  for (const b of blocks) {
    if (b.spans) {
      for (const s of b.spans) {
        if (typeof s.text === "string") out += s.text;
      }
    }
    if (typeof b.text === "string") out += b.text;
    if (b.blocks) out += concatText(b.blocks);
    if (b.items) out += concatText(b.items);
  }
  return out;
}

// --- §8.4 component 4: mark fidelity ---
// Set difference over (span_id, mark) pairs. We only consider the marks
// that actually exist on spans we can identify in both docs.
function markFidelityDrift(a: Document, b: Document): number {
  const marksA = collectMarks(a.blocks);
  const marksB = collectMarks(b.blocks);
  if (marksA.size === 0 && marksB.size === 0) return 0;
  let missing = 0;
  for (const k of marksA) if (!marksB.has(k)) missing++;
  let spurious = 0;
  for (const k of marksB) if (!marksA.has(k)) spurious++;
  const denom = marksA.size + spurious;
  return denom === 0 ? 0 : (missing + spurious) / denom;
}

function collectMarks(blocks: Block[]): Set<string> {
  const out = new Set<string>();
  function visit(blocks: Block[]) {
    for (const b of blocks) {
      if (b.spans) {
        for (const s of b.spans) {
          if (s.marks) {
            for (const m of s.marks) {
              const tag = typeof m === "string" ? m : `link:${m.target}:${m.predicate ?? ""}`;
              out.add(`${s.id}\x00${tag}`);
            }
          }
        }
      }
      if (b.blocks) visit(b.blocks);
      if (b.items) visit(b.items);
    }
  }
  visit(blocks);
  return out;
}

// --- §8.4 component 5: vocabulary integrity ---
// Did vocabulary change? Did namespaced predicates get rewritten as core?
function vocabularyIntegrityDrift(a: Document, b: Document): number {
  let drift = 0;
  if (a.vocabulary !== b.vocabulary) drift += 0.5;
  // Check whether any namespaced predicates got de-namespaced
  const namespacedBefore = new Set(
    a.edges.filter((e) => e.predicate.includes(":")).map((e) => `${e.subject}|${e.object}`),
  );
  for (const e of b.edges) {
    const key = `${e.subject}|${e.object}`;
    if (namespacedBefore.has(key) && !e.predicate.includes(":")) {
      drift += 0.5 / Math.max(namespacedBefore.size, 1);
    }
  }
  return Math.min(1, drift);
}

// --- helpers ---

/** Levenshtein distance over two arrays of strings (block-kind tokens). */
function levenshtein(a: string[], b: string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Levenshtein over characters — used for span coverage. */
function levenshteinChars(a: string, b: string): number {
  // For very long strings, fall back to a cheap normalized symmetric-diff
  // to avoid O(n²) blowup. Threshold: 20k chars combined.
  if (a.length + b.length > 20000) {
    // Cheap proxy: symmetric character frequency diff
    const fa = new Map<string, number>();
    const fb = new Map<string, number>();
    for (const c of a) fa.set(c, (fa.get(c) ?? 0) + 1);
    for (const c of b) fb.set(c, (fb.get(c) ?? 0) + 1);
    let diff = 0;
    const keys = new Set([...fa.keys(), ...fb.keys()]);
    for (const k of keys) diff += Math.abs((fa.get(k) ?? 0) - (fb.get(k) ?? 0));
    return diff;
  }
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1).fill(0);
  let cur = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) cur[j] = prev[j - 1];
      else cur[j] = 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Compute median of a sorted (or unsorted) numeric array. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Compute the P95 (95th percentile) value. */
export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}
