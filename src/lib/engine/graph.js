import { clamp, uid } from "./utils";

export const EDGE_KINDS = ["context", "causal", "temporal", "associative", "user"];

const EDGE_KIND_SET = new Set(EDGE_KINDS);

export function normalizeEdgeProps(props = {}) {
    const label = String(props.label ?? "").slice(0, 80);
    const kind = EDGE_KIND_SET.has(props.kind) ? props.kind : "context";
    const strength = clamp(Number(props.strength) || 1, 1, 5);

    return { label, kind, strength };
}

export function newPlane({
    id = uid("plane"),
    name = "Plane",
    parentPlaneId = null,
    parentNodeId = null,
    nodes = [],
    edges = [],
    camera = {},
    tick = 0,
} = {}) {
    return {
        id,
        name: String(name),
        parentPlaneId: parentPlaneId ?? null,
        parentNodeId: parentNodeId ?? null,
        nodes: Array.isArray(nodes) ? nodes : [],
        edges: Array.isArray(edges) ? edges : [],
        camera: {
            x: Number(camera.x) || 0,
            y: Number(camera.y) || 0,
            zoom: clamp(Number(camera.zoom) || 1, 0.1, 4),
        },
        tick: Number.isFinite(Number(tick)) ? Number(tick) : 0,
    };
}

export function createGraphState({
    version = 1,
    rootPlaneId = null,
    activePlaneId = null,
    planes = {},
    ui = {},
} = {}) {
    return {
        version: Number(version) || 1,
        rootPlaneId,
        activePlaneId,
        planes: planes && typeof planes === "object" ? planes : {},
        ui: ui && typeof ui === "object" ? ui : {},
    };
}
