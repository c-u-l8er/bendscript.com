const handlers = new Map();
let insideRAF = false;
let realtimeSession = null;

export const REALTIME_EVENTS = {
  PATCH_RECEIVED: "realtime:patch:received",
  PATCH_SENT: "realtime:patch:sent",
  CURSOR_RECEIVED: "realtime:cursor:received",
  CURSOR_SENT: "realtime:cursor:sent",
  SELECTION_RECEIVED: "realtime:selection:received",
  SELECTION_SENT: "realtime:selection:sent",
  PRESENCE_UPDATED: "realtime:presence:updated",
  STATUS_CHANGED: "realtime:status:changed",
  ERROR: "realtime:error",
};

/**
 * Subscribe to an event.
 * Returns an unsubscribe function.
 */
export function on(event, handler) {
  if (typeof handler !== "function") {
    throw new TypeError("handler must be a function");
  }

  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }

  set.add(handler);
  return () => off(event, handler);
}

/**
 * Subscribe once; auto-unsubscribes after first dispatch.
 */
export function once(event, handler) {
  const unsubscribe = on(event, (payload) => {
    unsubscribe();
    handler(payload);
  });
  return unsubscribe;
}

/**
 * Unsubscribe a handler from an event.
 */
export function off(event, handler) {
  const set = handlers.get(event);
  if (!set) return;

  set.delete(handler);
  if (set.size === 0) {
    handlers.delete(event);
  }
}

/**
 * Dispatch an event payload to all subscribers.
 */
export function dispatch(event, payload) {
  const set = handlers.get(event);
  if (!set || set.size === 0) return;

  // Copy first so handlers can safely unsubscribe/subscribe during dispatch.
  const snapshot = Array.from(set);
  for (const fn of snapshot) {
    fn(payload);
  }
}

/**
 * Clear handlers for one event, or all events if omitted.
 */
export function clear(event) {
  if (typeof event === "undefined") {
    handlers.clear();
    return;
  }
  handlers.delete(event);
}

export function markRAFStart() {
  insideRAF = true;
}

export function markRAFEnd() {
  insideRAF = false;
}

export function isInsideRAF() {
  return insideRAF;
}

/**
 * Guard to prevent state mutation during render loop.
 */
export function assertNotInRAF(scope = "mutation") {
  if (insideRAF) {
    throw new Error(
      `Engine bridge violation: "${scope}" attempted during requestAnimationFrame`,
    );
  }
}

/**
 * Attach/detach realtime collaboration session object.
 * Expected session shape:
 * {
 *   start?: () => Promise<any>,
 *   stop?: () => Promise<any>,
 *   emitPatch?: (patch) => Promise<any>,
 *   emitCursor?: (cursor) => Promise<any>,
 *   emitCursorThrottled?: (cursor) => Promise<any>,
 *   emitSelection?: (selection) => Promise<any>,
 *   connected?: boolean
 * }
 */
export function setRealtimeSession(session) {
  realtimeSession = session || null;
  dispatch(REALTIME_EVENTS.STATUS_CHANGED, {
    connected: !!realtimeSession?.connected,
    session: realtimeSession,
  });
  return realtimeSession;
}

export function getRealtimeSession() {
  return realtimeSession;
}

export function hasRealtimeSession() {
  return !!realtimeSession;
}

export async function startRealtimeSession() {
  if (!realtimeSession?.start) return { ok: false, reason: "no_session" };
  try {
    const result = await realtimeSession.start();
    dispatch(REALTIME_EVENTS.STATUS_CHANGED, {
      connected: !!realtimeSession?.connected,
      result,
    });
    return { ok: true, result };
  } catch (error) {
    dispatch(REALTIME_EVENTS.ERROR, { scope: "realtime.start", error });
    return { ok: false, error };
  }
}

export async function stopRealtimeSession() {
  if (!realtimeSession?.stop) return { ok: false, reason: "no_session" };
  try {
    const result = await realtimeSession.stop();
    dispatch(REALTIME_EVENTS.STATUS_CHANGED, {
      connected: !!realtimeSession?.connected,
      result,
    });
    return { ok: true, result };
  } catch (error) {
    dispatch(REALTIME_EVENTS.ERROR, { scope: "realtime.stop", error });
    return { ok: false, error };
  }
}

export function clearRealtimeSession() {
  realtimeSession = null;
  dispatch(REALTIME_EVENTS.STATUS_CHANGED, {
    connected: false,
    session: null,
  });
}

/**
 * Emit local outbound realtime events through current session.
 */
export async function publishRealtimePatch(patch) {
  if (!realtimeSession?.emitPatch) return { ok: false, reason: "no_session" };
  try {
    const result = await realtimeSession.emitPatch(patch);
    dispatch(REALTIME_EVENTS.PATCH_SENT, { patch, result });
    return { ok: true, result };
  } catch (error) {
    dispatch(REALTIME_EVENTS.ERROR, {
      scope: "realtime.patch.send",
      error,
      patch,
    });
    return { ok: false, error };
  }
}

export async function publishRealtimeCursor(cursor, { throttled = true } = {}) {
  if (!realtimeSession) return { ok: false, reason: "no_session" };

  const emitter =
    throttled && realtimeSession.emitCursorThrottled
      ? realtimeSession.emitCursorThrottled
      : realtimeSession.emitCursor;

  if (typeof emitter !== "function") {
    return { ok: false, reason: "cursor_emitter_unavailable" };
  }

  try {
    const result = await emitter(cursor);
    dispatch(REALTIME_EVENTS.CURSOR_SENT, {
      cursor,
      result,
      throttled: !!throttled,
    });
    return { ok: true, result };
  } catch (error) {
    dispatch(REALTIME_EVENTS.ERROR, {
      scope: "realtime.cursor.send",
      error,
      cursor,
    });
    return { ok: false, error };
  }
}

export async function publishRealtimeSelection(selection) {
  if (!realtimeSession?.emitSelection) {
    return { ok: false, reason: "no_session" };
  }

  try {
    const result = await realtimeSession.emitSelection(selection);
    dispatch(REALTIME_EVENTS.SELECTION_SENT, { selection, result });
    return { ok: true, result };
  } catch (error) {
    dispatch(REALTIME_EVENTS.ERROR, {
      scope: "realtime.selection.send",
      error,
      selection,
    });
    return { ok: false, error };
  }
}

/**
 * Inbound realtime dispatchers (to be used by realtime session callbacks).
 */
export function handleRealtimePatchReceived(payload) {
  dispatch(REALTIME_EVENTS.PATCH_RECEIVED, payload);
}

export function handleRealtimeCursorReceived(payload) {
  dispatch(REALTIME_EVENTS.CURSOR_RECEIVED, payload);
}

export function handleRealtimeSelectionReceived(payload) {
  dispatch(REALTIME_EVENTS.SELECTION_RECEIVED, payload);
}

export function handleRealtimePresenceUpdated(payload) {
  dispatch(REALTIME_EVENTS.PRESENCE_UPDATED, payload);
}

export function handleRealtimeStatusChanged(payload) {
  dispatch(REALTIME_EVENTS.STATUS_CHANGED, payload);
}

export function handleRealtimeError(payload) {
  dispatch(REALTIME_EVENTS.ERROR, payload);
}
