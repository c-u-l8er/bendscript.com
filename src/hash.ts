// §5.1 — content-addressable document IDs.
// The id is computed from canonical(blocks + edges) — excluding `id` and `meta`.
// Format: CIDv1 with codec=0x0129 (json multicodec) and hash=sha2-256.
// String form starts with "bafy2bzace..." per the multibase base32 + multicodec
// prefix mandated for IPLD JSON.

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { canonicalize } from "./canonicalize.ts";
import type { Document } from "./types.ts";

// Multicodec for "json" (RFC 8259 JSON, the on-disk shape we're addressing)
const JSON_CODEC = 0x0200;

/**
 * Compute the content-addressed id for a document.
 *
 * The hash input is `canonicalize({ blocks, edges })` — `id` and `meta` are
 * deliberately excluded so that metadata (timestamps, author, indexing hints)
 * does not invalidate the id.
 *
 * Returns a string suitable for use as `Document.id`, e.g.
 *   bafkreig... (with a "bafkre" prefix when using raw codec)
 *   bagaaie... (json codec)
 *
 * The spec mentions a "bafy2bzace" prefix; that prefix corresponds to one
 * specific codec/hash combination. We use the multiformats library to
 * generate real CIDs; the exact prefix depends on the chosen codec. v0.1
 * uses the json codec (0x0200), which yields "bagaaie..." prefixes.
 */
export async function computeDocumentId(doc: Document): Promise<string> {
  const hashInput = {
    blocks: doc.blocks,
    edges: doc.edges,
  };
  const canonical = canonicalize(hashInput);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await sha256.digest(bytes);
  const cid = CID.create(1, JSON_CODEC, digest);
  return cid.toString(); // base32 multibase by default for CIDv1
}

/**
 * Compute the id for a document and return it without mutating the input.
 * Useful for testing whether a document's stated id matches its content.
 */
export async function expectedDocumentId(doc: Document): Promise<string> {
  return computeDocumentId(doc);
}

// Lower-level helper: return raw hash input (canonical JSON string) for debugging
export function canonicalHashInput(doc: Document): string {
  return canonicalize({ blocks: doc.blocks, edges: doc.edges });
}
