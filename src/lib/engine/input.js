/**
 * BendScript migration scaffold.
 * Input handlers are still hosted in prototypeRuntime.js for parity in this phase.
 * This module exists so the SvelteKit architecture has the intended boundary.
 */

/**
 * Setup canvas/app input handlers.
 * @param {object} _ctx - Reserved context object for future extracted dependencies.
 * @returns {() => void} cleanup function
 */
export function setupInputHandlers(_ctx = {}) {
  // TODO(migration): move pointer/keyboard/context-menu listeners from prototypeRuntime.js here.
  // Keep this as a no-op until full extraction is completed.
  return () => {};
}
