/**
 * Renderer stubs for parity migration.
 *
 * During this migration phase, the canonical canvas rendering logic
 * still runs in `prototypeRuntime.js` to preserve exact visual behavior.
 * These exports provide stable module boundaries for later extraction.
 */

export function drawBackground(/* ctx, W, H, t, state */) {
	// TODO(parity-migration): move implementation from prototypeRuntime.js
}

export function drawEdges(/* ctx, plane, W, H, t, state */) {
	// TODO(parity-migration): move implementation from prototypeRuntime.js
	// NOTE: directed arrowheads for `causal` / `temporal` edges are currently
	// implemented in prototypeRuntime.js and should be preserved on extraction.
}

export function drawNodeText(/* ctx, text, x, y, maxWidth, opts */) {
	// TODO(parity-migration): move implementation from prototypeRuntime.js
}

export function drawNodes(/* ctx, plane, W, H, t, state */) {
	// TODO(parity-migration): move implementation from prototypeRuntime.js
}
