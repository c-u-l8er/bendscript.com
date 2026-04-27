# Skill 01 — Canvas Engine

> **What this teaches:** How to manipulate the force-directed canvas — creating
> nodes and edges, controlling physics, managing camera state, and switching
> between edit and preview modes.

---

## Force-Directed Physics

The canvas uses a force-directed layout engine running at 60fps via
`requestAnimationFrame`. Every frame, the physics simulation applies three
forces to each node:

| Force | Behavior | Constant |
|-------|----------|----------|
| Spring attraction | Connected nodes pull toward each other | `springK` (stiffness) |
| Charge repulsion | All nodes push away from each other (Coulomb) | `chargeK` (repulsion strength) |
| Damping | Velocity decays each frame to prevent oscillation | `dampingFactor` (0-1) |

The simulation runs continuously. When node velocities drop below a threshold,
the engine enters a low-energy state and reduces frame rate to save CPU.

### Pinning

Pinned nodes are excluded from physics — they stay where you put them. Use
pinning to anchor key nodes and let the rest of the graph settle around them.

---

## Node Operations

### Creating a Node

Click an empty area of the canvas. A new `normal` node appears at the click
position with an empty text field.

### Editing Node Text

Click the text area on a node card. The node enters edit mode with a text
cursor. Supports Markdown formatting that renders in preview mode.

### Deleting a Node

Select the node and press `Delete` or use the inspector delete button.
Connected edges are removed automatically.

### Node Types

| Type | Description | Visual |
|------|------------|--------|
| `normal` | Standard content node | Rounded-rect card with gradient fill |
| `stargate` | Portal to a nested sub-graph plane | Spinning dual-arc animation |

Change node type in the right-panel inspector.

---

## Edge Operations

### Creating an Edge

1. Hover over a node to reveal edge handles (small circles on the node border).
2. Click and drag from a handle toward the target node.
3. Release on the target node to create the connection.

### Edge Types

| Type | Semantics | When to Use |
|------|-----------|-------------|
| `context` | Frames or scopes | "BendScript" → context → "What is it?" |
| `causal` | Causes or leads to | "User prompt" → causal → "AI response" |
| `temporal` | Sequence in time | "Step 1" → temporal → "Step 2" |
| `associative` | Related by theme | "Graph theory" → associative → "Networks" |
| `user-defined` | Custom label | Any label you provide |

Set the edge type in the edge inspector. **Default is `context`.**

### Edge Strength

Edges have a `strength` value (0-1) that affects the spring force in the
physics simulation. Stronger edges pull connected nodes closer together.

### Deleting an Edge

Select the edge (click near the curve) and press `Delete` or use the
inspector delete button.

---

## Drag Behavior

- **Drag a node:** moves the node to the cursor position. While dragging, the
  node is temporarily pinned. On release, it returns to physics-driven layout
  unless explicitly pinned.
- **Drag from edge handle:** creates a new edge (see above).
- **Drag on empty canvas:** pans the camera.

---

## Camera Controls

| Action | Input |
|--------|-------|
| Pan | Click + drag on empty canvas |
| Zoom in | Scroll wheel up / pinch out |
| Zoom out | Scroll wheel down / pinch in |
| Reset view | Double-click empty canvas (centers graph) |

The camera maintains world-to-screen transforms. All node positions are stored
in world coordinates. The renderer applies the camera transform each frame.

---

## Edit vs Preview Modes

| Mode | Behavior |
|------|----------|
| **Edit** | Nodes show text input fields. Click to edit. Markdown source is visible. |
| **Preview** | Nodes render Markdown as formatted HTML on the canvas. Read-only. |

Toggle between modes using the toolbar button. Preview mode is useful for
presenting graphs — all node content renders as formatted text.

---

## Performance Considerations

- **Node count:** The physics engine handles hundreds of nodes smoothly. Beyond
  ~500 nodes on a single plane, consider decomposing with Stargates.
- **Edge density:** Dense edge clusters increase physics computation. Use edge
  types deliberately rather than connecting everything.
- **Pinning:** Pin anchor nodes to reduce the number of nodes the physics
  engine must simulate.
- **Stargates:** Use planes to partition large graphs. Each plane runs its own
  physics simulation independently.

---

## Engine Module Reference

| Module | File | Role |
|--------|------|------|
| Physics | `physics.js` | Force simulation: spring, repulsion, damping |
| Renderer | `renderer.js` | Canvas 2D drawing: nodes, edges, highlights |
| Camera | `camera.js` | Pan, zoom, coordinate transforms |
| Graph | `graph.js` | Node/edge CRUD, adjacency state |
| Hit Test | `hittest.js` | Click target resolution in world coords |
| Input | `input.js` | Mouse/touch/keyboard event routing |
| Markdown | `markdown.js` | Markdown → rendered text on canvas |
