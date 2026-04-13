// Guest-mode localStorage persistence for /play route.
// 30-day TTL enforced on load.

const STORAGE_KEY = "bendscript_play_state";
const API_KEY_STORAGE = "bendscript_play_openrouter_key";
const MCP_STORAGE = "bendscript_play_mcp_connections";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Save playground state to localStorage with timestamp.
 * @param {{ editorContent: string, schemaType: string }} state
 */
export function saveGuestState(state) {
  try {
    const payload = {
      ...state,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load playground state from localStorage. Returns null if expired or missing.
 * @returns {{ editorContent: string, schemaType: string } | null}
 */
export function loadGuestState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      editorContent: parsed.editorContent ?? "",
      schemaType: parsed.schemaType ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Save OpenRouter API key to localStorage.
 * @param {string} key
 */
export function saveApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE, key);
  } catch {
    // silently fail
  }
}

/**
 * Load OpenRouter API key from localStorage.
 * @returns {string}
 */
export function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/**
 * Save MCP server connections to localStorage.
 * @param {Array<{ url: string, authHeader?: string }>} connections
 */
export function saveMcpConnections(connections) {
  try {
    localStorage.setItem(MCP_STORAGE, JSON.stringify(connections));
  } catch {
    // silently fail
  }
}

/**
 * Load MCP server connections from localStorage.
 * @returns {Array<{ url: string, authHeader?: string }>}
 */
export function loadMcpConnections() {
  try {
    const raw = localStorage.getItem(MCP_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Clear all playground data from localStorage.
 */
export function clearGuestData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(MCP_STORAGE);
  } catch {
    // silently fail
  }
}
