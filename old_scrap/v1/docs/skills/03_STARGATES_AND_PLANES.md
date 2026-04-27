# Skill 03 — Stargates and Planes

> **What this teaches:** How fractal depth works in BendScript — creating
> Stargates, navigating between planes, managing hierarchy, and using the
> `list_planes` MCP tool.

---

## What Are Stargates?

A Stargate is a portal node that opens into a nested sub-graph plane. When you
click a Stargate, the canvas warps into a new plane — a separate space with its
own nodes, edges, and layout. Stargates can nest recursively, creating
**fractal depth**.

Visually, Stargates render as spinning dual-arc animations (an event horizon
effect) that distinguish them from normal nodes.

```
Root Plane
├── [Node A]
├── [⊛ Stargate: "Architecture"] ──► Sub-Plane "Architecture"
│                                      ├── [Node: "Frontend"]
│                                      ├── [Node: "Backend"]
│                                      └── [⊛ Stargate: "Database"] ──► Sub-Plane "Database"
│                                                                         ├── [Node: "Schema"]
│                                                                         └── [Node: "RLS"]
├── [Node B]
└── [Node C]
```

---

## Creating a Stargate

1. Create a new node on the canvas (click empty space).
2. Open the node inspector (right panel).
3. Change the node type from `normal` to `stargate`.
4. Give the Stargate a descriptive name — this becomes the plane's title.

The Stargate node now shows the spinning animation. A new empty plane is
created and linked to this node via `portal_plane_id`.

---

## Navigating Between Planes

### Entering a Plane

Click the Stargate node. The canvas transitions (warp effect) into the nested
plane. The breadcrumb trail at the top updates to show your depth path.

### Returning to a Parent Plane

Click any breadcrumb in the trail to jump back to that level.

```
Breadcrumbs: Root > Architecture > Database
                ^         ^          ^
                |         |          current plane
                |         click to go here
                click to go here
```

### Breadcrumb State

The breadcrumb trail tracks the full navigation path. Each entry shows the
plane name (derived from the Stargate node text). Clicking a breadcrumb
navigates to that plane and discards deeper history.

---

## Plane Hierarchy

Planes form a tree rooted at the workspace's root plane.

```
Database schema:

graph_planes
  ├── id
  ├── workspace_id
  ├── name
  ├── parent_plane_id    ← NULL for root plane
  ├── is_root            ← TRUE for root plane
  └── graph_id

nodes
  ├── plane_id           ← which plane this node lives on
  └── portal_plane_id    ← (stargate only) the plane it opens
```

Every workspace has exactly one root plane (`is_root = true`). Stargates
create child planes. The `parent_plane_id` column tracks the hierarchy.

---

## Use Cases for Depth

### Detail Decomposition

Put high-level concepts on the root plane. Each concept becomes a Stargate
that opens into a detailed sub-graph.

```
Root: [Project Overview] → [⊛ Frontend] → [⊛ Backend] → [⊛ Infrastructure]

Inside "Frontend":
  [SvelteKit] → [Components] → [Canvas Engine] → [⊛ Physics Details]
```

### Topic Branches

Each major topic gets its own Stargate. The root plane is a table of contents.

### Temporal Layers

Create Stargates for time periods: "Q1 2026", "Q2 2026". Each contains events,
decisions, and outcomes from that period.

### Private Work-in-Progress

Use a Stargate as a scratch space. Build ideas inside, then promote the best
nodes up to the parent plane when ready.

### Presentation Flow

Navigate through Stargates in sequence to present a topic. The warp transition
provides a visual "drill down" effect.

---

## list_planes MCP Tool

Agents can enumerate all planes in a workspace:

```
list_planes(workspace_id: "ws_abc123")
```

Returns:

```json
[
  { "id": "plane_1", "name": "Root", "is_root": true, "parent_plane_id": null },
  { "id": "plane_2", "name": "Architecture", "is_root": false, "parent_plane_id": "plane_1" },
  { "id": "plane_3", "name": "Database", "is_root": false, "parent_plane_id": "plane_2" }
]
```

This lets agents understand the graph's depth structure before querying
specific planes with `search_nodes` or `get_subgraph`.

---

## Best Practices

- **Name Stargates descriptively** — the name becomes the plane title and
  appears in breadcrumbs.
- **Limit plane size** — if a plane has more than ~50 nodes, decompose further
  with nested Stargates.
- **Use consistent depth patterns** — decide early whether depth means
  "more detail", "subtopic", or "time period" and stick with it.
- **Connect before you descend** — create edges between the Stargate and
  related nodes on the same plane before diving into the sub-plane.
- **List planes first** — when querying via MCP, call `list_planes` to
  understand the hierarchy, then target specific planes.
