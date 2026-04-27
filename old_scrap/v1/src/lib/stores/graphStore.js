import { derived, writable } from "svelte/store";

/**
 * Canonical graph state store.
 * Shape is intentionally aligned with the migration prompt:
 * {
 *   version,
 *   rootPlaneId,
 *   activePlaneId,
 *   planes: { [planeId]: Plane },
 *   ui: { ... }
 * }
 */
export const state = writable(null);

/**
 * Plane dictionary.
 */
export const planes = derived(state, ($state) => $state?.planes ?? {});

/**
 * Active plane id from state.
 */
export const activePlaneId = derived(
	state,
	($state) => $state?.activePlaneId ?? null
);

/**
 * Root plane id from state.
 */
export const rootPlaneId = derived(
	state,
	($state) => $state?.rootPlaneId ?? null
);

/**
 * Fully resolved active plane object.
 */
export const activePlane = derived(
	[state, activePlaneId],
	([$state, $activePlaneId]) => {
		if (!$state || !$activePlaneId) return null;
		return $state.planes?.[$activePlaneId] ?? null;
	}
);

/**
 * Convenience helper: get plane by id as a derived store factory.
 */
export function planeById(planeId) {
	return derived(state, ($state) => {
		if (!$state || !planeId) return null;
		return $state.planes?.[planeId] ?? null;
	});
}

/**
 * Mutator helper: replace entire graph state.
 */
export function setGraphState(nextState) {
	state.set(nextState ?? null);
}

/**
 * Mutator helper: shallow update graph state.
 */
export function patchGraphState(patch) {
	state.update((current) => {
		if (!current) return current;
		return { ...current, ...(patch ?? {}) };
	});
}

/**
 * Mutator helper: set active plane id.
 */
export function setActivePlane(nextPlaneId) {
	state.update((current) => {
		if (!current) return current;
		if (!nextPlaneId || !current.planes?.[nextPlaneId]) return current;
		return { ...current, activePlaneId: nextPlaneId };
	});
}
