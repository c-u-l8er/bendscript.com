// Supabase Realtime helpers for collaborative graph updates.
//
// This module is intentionally framework-agnostic and can be used from
// engine/store bridges. It supports:
// - broadcast + receive graph patches
// - broadcast + receive cursor / selection events
// - presence tracking (active collaborators)
//
// Expected patch envelope (minimum):
// {
//   type: "node_move" | "node_upsert" | "node_remove" | "edge_upsert" | ...
//   planeId?: string,
//   ...type-specific fields
// }

const DEFAULT_EVENTS = {
  patch: "graph_patch",
  cursor: "graph_cursor",
  selection: "graph_selection",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function randomId(prefix = "client") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function upsertById(list, item) {
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex((x) => x?.id === item?.id);
  if (idx === -1) {
    arr.push(item);
  } else {
    arr[idx] = { ...arr[idx], ...item };
  }
  return arr;
}

function removeById(list, id) {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((x) => x?.id !== id);
}

function ensurePlane(nextState, planeId) {
  if (!nextState?.planes || !planeId) return null;
  if (!nextState.planes[planeId]) {
    nextState.planes[planeId] = {
      id: planeId,
      name: "Graph Plane",
      parentPlaneId: null,
      parentNodeId: null,
      nodes: [],
      edges: [],
      camera: { x: 0, y: 0, zoom: 1 },
      tick: 0,
    };
  }
  return nextState.planes[planeId];
}

function normalizeEventPayload(raw) {
  // Supabase broadcast callback shape varies by SDK context.
  // We normalize to payload-only.
  if (raw && typeof raw === "object" && "payload" in raw) return raw.payload;
  return raw;
}

export function getRealtimeChannelName(workspaceId, graphId) {
  return `bendscript:graph:${workspaceId}:${graphId}`;
}

export function flattenPresenceState(presenceState = {}) {
  const result = [];
  for (const key of Object.keys(presenceState)) {
    const entries = Array.isArray(presenceState[key]) ? presenceState[key] : [];
    for (const entry of entries) {
      result.push({
        key,
        ...entry,
      });
    }
  }
  return result;
}

/**
 * Apply a collaborative patch to graph state.
 * Returns a new state object and never mutates the input.
 */
export function applyRemoteGraphPatch(state, patch) {
  if (!state || !patch || typeof patch !== "object") return state;

  const nextState = deepClone(state);
  const patchType = patch.type;
  const targetPlaneId = patch.planeId || nextState.activePlaneId || nextState.rootPlaneId;

  if (!nextState.planes || !targetPlaneId) return nextState;
  const plane = ensurePlane(nextState, targetPlaneId);
  if (!plane) return nextState;

  switch (patchType) {
    case "state_snapshot": {
      if (patch.state && typeof patch.state === "object") {
        return deepClone(patch.state);
      }
      return nextState;
    }

    case "plane_upsert": {
      if (!patch.plane?.id) return nextState;
      const current = nextState.planes[patch.plane.id] || {};
      nextState.planes[patch.plane.id] = {
        nodes: [],
        edges: [],
        camera: { x: 0, y: 0, zoom: 1 },
        tick: 0,
        ...current,
        ...patch.plane,
      };
      return nextState;
    }

    case "plane_remove": {
      const removeId = patch.planeIdToRemove || patch.id;
      if (!removeId || removeId === nextState.rootPlaneId) return nextState;
      delete nextState.planes[removeId];
      if (nextState.activePlaneId === removeId) {
        nextState.activePlaneId = nextState.rootPlaneId;
      }
      return nextState;
    }

    case "node_upsert": {
      if (!patch.node?.id) return nextState;
      plane.nodes = upsertById(plane.nodes, patch.node);
      return nextState;
    }

    case "node_move": {
      if (!patch.nodeId) return nextState;
      const idx = plane.nodes.findIndex((n) => n.id === patch.nodeId);
      if (idx === -1) return nextState;
      plane.nodes[idx] = {
        ...plane.nodes[idx],
        x: Number.isFinite(patch.x) ? patch.x : plane.nodes[idx].x,
        y: Number.isFinite(patch.y) ? patch.y : plane.nodes[idx].y,
        vx: Number.isFinite(patch.vx) ? patch.vx : plane.nodes[idx].vx,
        vy: Number.isFinite(patch.vy) ? patch.vy : plane.nodes[idx].vy,
      };
      return nextState;
    }

    case "node_remove": {
      if (!patch.nodeId) return nextState;
      plane.nodes = removeById(plane.nodes, patch.nodeId);
      plane.edges = plane.edges.filter(
        (e) => e.a !== patch.nodeId && e.b !== patch.nodeId,
      );
      return nextState;
    }

    case "edge_upsert": {
      if (!patch.edge?.id) return nextState;
      plane.edges = upsertById(plane.edges, patch.edge);
      return nextState;
    }

    case "edge_remove": {
      const edgeId = patch.edgeId || patch.id;
      if (!edgeId) return nextState;
      plane.edges = removeById(plane.edges, edgeId);
      return nextState;
    }

    case "camera_update": {
      plane.camera = {
        ...plane.camera,
        ...(patch.camera || {}),
      };
      return nextState;
    }

    default:
      return nextState;
  }
}

function throttle(fn, waitMs = 50) {
  let lastCall = 0;
  let trailingTimer = null;
  let trailingArgs = null;

  return (...args) => {
    const t = Date.now();
    const elapsed = t - lastCall;

    if (elapsed >= waitMs) {
      lastCall = t;
      fn(...args);
      return;
    }

    trailingArgs = args;
    if (trailingTimer) return;

    trailingTimer = setTimeout(() => {
      trailingTimer = null;
      lastCall = Date.now();
      fn(...(trailingArgs || []));
      trailingArgs = null;
    }, waitMs - elapsed);
  };
}

/**
 * Create and manage a realtime collaboration session for a graph.
 */
export function createGraphRealtimeSession({
  supabase,
  workspaceId,
  graphId,
  clientId = randomId("bs"),
  userId = null,
  displayName = "Anonymous",
  channelName = null,
  events = DEFAULT_EVENTS,
  broadcastSelf = false,
  cursorThrottleMs = 50,

  onPatch = () => {},
  onCursor = () => {},
  onSelection = () => {},
  onPresence = () => {},
  onStatus = () => {},
  onError = () => {},
} = {}) {
  if (!supabase) throw new Error("createGraphRealtimeSession: missing `supabase` client");
  if (!workspaceId) throw new Error("createGraphRealtimeSession: missing `workspaceId`");
  if (!graphId) throw new Error("createGraphRealtimeSession: missing `graphId`");

  let channel = null;
  let subscribed = false;

  const resolvedChannelName = channelName || getRealtimeChannelName(workspaceId, graphId);

  const baseMeta = () => ({
    clientId,
    userId,
    displayName,
    workspaceId,
    graphId,
    ts: nowIso(),
  });

  async function emit(event, payload = {}) {
    if (!channel) return { ok: false, reason: "not_initialized" };

    try {
      const response = await channel.send({
        type: "broadcast",
        event,
        payload: {
          ...payload,
          _meta: baseMeta(),
        },
      });

      return { ok: response === "ok" || response === "timed out", response };
    } catch (error) {
      onError(error);
      return { ok: false, error };
    }
  }

  const emitCursorThrottled = throttle(
    (cursor) => emit(events.cursor, { cursor }),
    cursorThrottleMs,
  );

  async function start() {
    if (!isBrowser()) return { ok: false, reason: "not_browser" };
    if (channel) return { ok: true, reused: true };

    channel = supabase.channel(resolvedChannelName, {
      config: {
        broadcast: { self: !!broadcastSelf },
        presence: { key: clientId },
      },
    });

    channel
      .on("broadcast", { event: events.patch }, (raw) => {
        const payload = normalizeEventPayload(raw);
        if (payload?._meta?.clientId === clientId) return;
        onPatch(payload);
      })
      .on("broadcast", { event: events.cursor }, (raw) => {
        const payload = normalizeEventPayload(raw);
        if (payload?._meta?.clientId === clientId) return;
        onCursor(payload);
      })
      .on("broadcast", { event: events.selection }, (raw) => {
        const payload = normalizeEventPayload(raw);
        if (payload?._meta?.clientId === clientId) return;
        onSelection(payload);
      })
      .on("presence", { event: "sync" }, () => {
        const collaborators = flattenPresenceState(channel.presenceState());
        onPresence(collaborators);
      })
      .on("presence", { event: "join" }, () => {
        const collaborators = flattenPresenceState(channel.presenceState());
        onPresence(collaborators);
      })
      .on("presence", { event: "leave" }, () => {
        const collaborators = flattenPresenceState(channel.presenceState());
        onPresence(collaborators);
      });

    const subscribeResult = await new Promise((resolve) => {
      channel.subscribe(async (status) => {
        onStatus(status);

        if (status === "SUBSCRIBED") {
          subscribed = true;
          try {
            await channel.track({
              ...baseMeta(),
              onlineAt: nowIso(),
            });
          } catch (error) {
            onError(error);
          }
          resolve({ ok: true, status });
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribed = false;
          resolve({ ok: false, status });
        }
      });
    });

    return subscribeResult;
  }

  async function stop() {
    if (!channel) return { ok: true, reason: "already_stopped" };

    try {
      try {
        await channel.untrack();
      } catch {
        // no-op
      }
      await supabase.removeChannel(channel);
      channel = null;
      subscribed = false;
      return { ok: true };
    } catch (error) {
      onError(error);
      return { ok: false, error };
    }
  }

  async function updatePresence(extra = {}) {
    if (!channel) return { ok: false, reason: "not_initialized" };
    try {
      await channel.track({
        ...baseMeta(),
        ...extra,
        onlineAt: nowIso(),
      });
      return { ok: true };
    } catch (error) {
      onError(error);
      return { ok: false, error };
    }
  }

  return {
    get channel() {
      return channel;
    },
    get clientId() {
      return clientId;
    },
    get connected() {
      return !!channel && subscribed;
    },
    channelName: resolvedChannelName,

    start,
    stop,
    updatePresence,

    emitPatch: (patch) => emit(events.patch, patch),
    emitCursor: (cursor) => emit(events.cursor, { cursor }),
    emitCursorThrottled,
    emitSelection: (selection) => emit(events.selection, { selection }),
  };
}

// Convenience patch factories
export const realtimePatch = {
  stateSnapshot: (state) => ({ type: "state_snapshot", state }),
  planeUpsert: (plane) => ({ type: "plane_upsert", plane }),
  planeRemove: (planeIdToRemove) => ({ type: "plane_remove", planeIdToRemove }),
  nodeUpsert: (planeId, node) => ({ type: "node_upsert", planeId, node }),
  nodeMove: (planeId, nodeId, x, y, vx = 0, vy = 0) => ({
    type: "node_move",
    planeId,
    nodeId,
    x,
    y,
    vx,
    vy,
  }),
  nodeRemove: (planeId, nodeId) => ({ type: "node_remove", planeId, nodeId }),
  edgeUpsert: (planeId, edge) => ({ type: "edge_upsert", planeId, edge }),
  edgeRemove: (planeId, edgeId) => ({ type: "edge_remove", planeId, edgeId }),
  cameraUpdate: (planeId, camera) => ({ type: "camera_update", planeId, camera }),
};
