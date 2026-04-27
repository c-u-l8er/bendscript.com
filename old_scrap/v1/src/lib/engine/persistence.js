export const STORAGE_KEY = "bendscript-state-v1";
export const SAVE_DEBOUNCE_MS = 220;

function canUseStorage() {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadState(key = STORAGE_KEY) {
	if (!canUseStorage()) return null;

	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function saveState(state, key = STORAGE_KEY) {
	if (!canUseStorage()) return false;

	try {
		window.localStorage.setItem(key, JSON.stringify(state));
		return true;
	} catch {
		return false;
	}
}

/**
 * Returns a debounced save function.
 * Usage:
 *   const saveSoon = createSaveSoon(() => currentState);
 *   saveSoon();
 */
export function createSaveSoon(getState, { delay = SAVE_DEBOUNCE_MS, key = STORAGE_KEY } = {}) {
	let timer = null;

	return function saveSoon() {
		if (timer) clearTimeout(timer);

		timer = setTimeout(() => {
			timer = null;
			saveState(getState(), key);
		}, delay);
	};
}
