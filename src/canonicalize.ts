// §5.1 — RFC 8785 (JSON Canonicalization Scheme) wrapper.
// We delegate to the `canonicalize` npm package for the spec-conformant
// implementation. This keeps the protocol's hash story precise and testable.

import canonicalizeJCS from "canonicalize";

/**
 * Canonicalize a JSON-shaped value per RFC 8785.
 * Returns a string suitable for hashing.
 */
export function canonicalize(value: unknown): string {
  const result = canonicalizeJCS(value);
  if (result === undefined) {
    throw new Error("canonicalize: input is not JSON-serializable");
  }
  return result;
}
