const handlers = new Map();
let insideRAF = false;

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
            `Engine bridge violation: "${scope}" attempted during requestAnimationFrame`
        );
    }
}
