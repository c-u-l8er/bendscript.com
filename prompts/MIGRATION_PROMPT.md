# BendScript — SvelteKit Migration Prompt

> **Purpose:** Extract the monolithic `index.html` prototype (4,068 lines) into a clean SvelteKit application with modular JS files. No backend, no auth, no AI — just the engine, canvas, and UI working identically to the prototype.
>
> **Target agent:** ChatGPT-5.3-Codex (or any coding agent with file access)
>
> **Author:** Travis / [&] Ampersand Box Design
>
> **Date:** 2026-03-21
>
> **Scope:** Engine extraction + visual parity + directed-edge creation. LocalStorage persistence. This is the foundation that the κ topology engine (see `AmpersandBoxDesign/prompts/KAPPA_BUILD_PROMPT.md` Path 2) and backend (`bendscript.com/prompts/BUILD.md` Phases 2–7) build on top of.

---

## 0. The Goal

**Input:** `bendscript.com/index.html` — a single-file 4,068-line HTML/CSS/JS canvas graph editor.

**Output:** A SvelteKit app where `npm run dev` opens a canvas that behaves identically to `index.html` — same physics, same rendering, same interactions — but with the code split into modular files that are easy to extend.

**Plus one new interaction:** Users can create edges between nodes via a right-click "Connect to…" menu, with a visual indicator showing edge directionality (arrowheads on `causal` and `temporal` edges). This is required for the κ topology engine that comes next.

**Do NOT build:** Supabase, auth, AI integration, billing, realtime collaboration, KAG server. Those come later via `BUILD.md`.

---

## 1. What Exists Today (Read Before Writing)

### 1.1 File Location

`bendscript.com/index.html` — the single source of truth. Read it fully before writing any code.

### 1.2 Architecture Summary

| Aspect | Detail |
|--------|--------|
| Lines | 4,068 |
| CSS | ~895 lines, embedded in `<style>` tag |
| JavaScript | ~2,800 lines, embedded in `<script>` tag |
| External deps | marked.js 12.0.2, DOMPurify 3.1.7 (CDN) |
| Storage | LocalStorage (`bendscript-state-v1`) |
| Rendering | Canvas 2D API, requestAnimationFrame loop |
| Framework | None — vanilla JS |

### 1.3 Functions Inventory (62 total)

#### Pure Logic (DOM-Free — extract as-is)

| Function | ~Line | Purpose |
|----------|-------|---------|
| `uid(prefix)` | 1342 | Generate unique IDs |
| `clamp(v, a, b)` | 1329 | Clamp value |
| `rand(a, b)` | 1330 | Random float |
| `dist(ax, ay, bx, by)` | 1331 | Euclidean distance |
| `newPlane({...})` | 1492 | Create plane object |
| `addNode(plane, {...})` | 1510 | Create node, append to plane |
| `normalizeEdgeProps(props)` | 1543 | Validate edge properties |
| `addEdge(plane, nodeA, nodeB, props)` | 1559 | Create edge, append to plane |
| `findNode(plane, nodeId)` | 1573 | Linear search by ID |
| `findEdge(plane, edgeId)` | 1577 | Linear search by ID |
| `connectedNodes(plane, nodeId)` | 1581 | Set of connected node IDs |
| `activePlane()` | 1590 | Get current plane from state |
| `depthOfPlane(planeId)` | 1594 | Count parent chain depth |
| `breadcrumbList(planeId)` | 1604 | Array of parent planes |
| `removeNode(plane, nodeId)` | 1665 | Delete node + attached edges |
| `mergeNodes(plane, nodeA, nodeB)` | 1689 | Fuse two nodes |
| `trimText(str, n)` | 1702 | Truncate with ellipsis |
| `escapeHtml(s)` | 2063 | HTML entity escape |
| `projectToScreen(wx, wy, camera, W, H)` | 1707 | World → screen coords |
| `screenToWorld(sx, sy, camera, W, H)` | 1714 | Screen → world coords |
| `nodeCardSize(n)` | 1721 | Auto-sized card dimensions |
| `nodeRadius(n)` | 1750 | Bounding radius |
| `nodeAtPoint(plane, wx, wy)` | 1755 | Hit test: node under point |
| `isPointOnNodeResizeHandle(n, wx, wy, cameraZoom)` | 1775 | Resize grip hit test |
| `edgeAnchorPair(a, b)` | 1791 | Edge anchor positions on card edges |
| `pointToSegmentDistance(...)` | 1816 | Distance from point to line segment |
| `edgeAtPoint(plane, wx, wy, threshold)` | 1827 | Hit test: edge under point (14px) |
| `currentTargetNode()` | 1978 | Currently selected or first node |
| `markdownToInspectorHtml(md)` | 2072 | Regex-based markdown → HTML |
| `markdownToPlainLines(text)` | 3385 | Strip markdown formatting |
| `simulate(dt)` | 3142 | Force-directed physics step |
| `generateResponse(prompt)` | 2577 | Keyword stub (placeholder for AI) |

#### DOM-Touching (need wrapping for Svelte)

| Function | ~Line | Purpose |
|----------|-------|---------|
| `loadState()` | 1909 | Deserialize from localStorage |
| `saveState()` | 1880 | Serialize to localStorage |
| `saveSoon()` | 1875 | Debounced save (220ms) |
| `resize()` | 1851 | Sync canvas to window size |
| `setSelected(nodeId)` | 1985 | Select node, sync panels |
| `setSelectedEdge(edgeId)` | 2003 | Select edge, sync panels |
| `syncNodeInspector()` | 2306 | Populate inspector from node |
| `applyNodeInspectorToSelection()` | 2348 | Write inspector back to node |
| `syncEdgeInspector()` | 2009 | Populate inspector from edge |
| `applyEdgeInspectorToSelection()` | 2036 | Write inspector back to edge |
| `syncModeUI()` | 2274 | Update edit/preview toggle |
| `openContextMenu(x, y, nodeId)` | 2634 | Show right-click menu |
| `closeContextMenu()` | 2657 | Hide context menu |
| `drawBackground(W, H, t)` | 3220 | Canvas: bg + dot grid |
| `drawEdges(plane, W, H, t)` | 3235 | Canvas: edges + labels + flow |
| `drawNodeText(...)` | 3595 | Canvas: wrapped markdown text |
| `drawNodes(plane, W, H, t)` | 3659 | Canvas: node cards + badges |
| `wrapMarkdownLines(text, maxWidth, baseFontSize)` | 3429 | Measure text with ctx.measureText |
| `updateStats()` | 3895 | Update HUD pills |
| `updateBreadcrumbs()` | 3094 | Render breadcrumb trail |
| `triggerWarp(callback)` | 2870 | Stargate transition animation |
| `updateNodeMarkdownPreview()` | 2213 | Render markdown modal preview |
| `syncNodeMdOverlayForSelection()` | 2233 | Show/hide markdown modal |
| `installComposerDrag()` | 2507 | Composer drag-to-reposition |
| `spawnPromptFlow(text)` | 2595 | Create user + response nodes |
| `applyComposerPosition()` | 2476 | Position composer overlay |
| `tick()` | 3903 | Main rAF loop |
| `enterApp(e)` / `lockIntoAppView()` | 3960 | Hero → app transition |
| `exitToHero()` | 3998 | App → hero transition |

### 1.4 Event Listeners (38 total)

#### Canvas (5)
- `contextmenu` → preventDefault + context menu open (~2722)
- `pointerdown` → drag/resize/pan/edge-select dispatch (~2745)
- `pointermove` → drag node/resize/pan tracking (~2811)
- `pointerup` → merge detection, stargate teleport, finalize drag (~2878)
- `wheel` → zoom + node text scroll (~2942)

#### Inspector Fields (6)
- `edgePropLabel` input → sync label
- `edgePropKind` change → sync kind
- `edgePropStrength` input → sync strength
- `nodeText` input → sync node text
- `nodeType` change → sync type
- `nodePinned` change → sync pin

#### Markdown Modal (7)
- `nodeMdEditor` input/wheel/pointerdown
- `nodeMdPreview` wheel/pointerdown
- `nodeMdTabs` click → tab toggle
- `nodeMdClose` click → close
- `nodeMdOpenBtn` click → open
- `nodeMdBackdrop` click → dismiss

#### Context Menu (2)
- `menu` click delegation → fork/merge/pin/stargate/delete
- `document` click → click-away dismiss

#### Keyboard (1)
- `document` keydown → Escape (cancel merge/close), Delete/Backspace (delete node/edge), Ctrl+S (save)

#### Other (17)
- Mode toggle, composer form submit, composer drag (3 events + dblclick), breadcrumbs, window resize, beforeunload, autosave interval, hero section events (heroCta, heroScrollBtn, backBtn, scroll observer, window load)

### 1.5 Physics Constants (DO NOT CHANGE)

```javascript
// simulate() at line 3142
REPEL = 98000      // Node-node repulsion strength (used as 98000 in computation)
SPRING = 0.0095    // Edge spring constant
DAMPING = 0.9      // Velocity damping
REST = 290         // Edge rest length
CENTER_PULL = 0.00042  // Center gravity
BROWNIAN = 0.03    // Noise amplitude
MAX_SPEED = 8.2    // Velocity cap
MAX_FRAME = 33     // Max dt (ms)
```

**Note:** These differ from the CSS-exposed constants in BUILD.md (`REPEL=8200`, `SPRING=0.018`, `REST=210`). The actual values in `index.html` are the source of truth. Read the `simulate()` function and extract the exact numbers.

### 1.6 Render Loop Order (tick function, line 3903)

```
1. t = now()
2. dt = min(33, t - lastT)
3. W, H = window dimensions
4. plane = activePlane()
5. simulate(dt)           — physics step
6. ctx.clearRect(0, 0, W, H)
7. drawBackground(W, H, t)  — fill + dot grid
8. drawEdges(plane, W, H, t)  — edges + labels + animated flow
9. drawNodes(plane, W, H, t)  — cards + text + badges + resize handles
10. updateStats()          — HUD pills
11. updateBreadcrumbs()    — plane navigation
12. requestAnimationFrame(tick)
```

### 1.7 State Shape (EXACT — preserve during migration)

```javascript
{
  version: 1,
  rootPlaneId: "plane_abc123",
  activePlaneId: "plane_abc123",
  planes: {
    "plane_abc123": {
      id: string,
      name: string,
      parentPlaneId: string | null,
      parentNodeId: string | null,
      nodes: [{
        id, text, x, y, vx, vy, fx, fy,
        pinned, type, portalPlaneId,
        pulse, createdAt, width, height, scrollY
      }],
      edges: [{
        id, a, b, flowOffset,
        props: { label, kind, strength }
      }],
      camera: { x, y, zoom },
      tick: 0
    }
  },
  ui: {
    selectedNodeId, selectedEdgeId,
    editMode: "edit" | "preview",
    composerPos: { free, x, y },
    mergeSourceNodeId, panMode,
    dragNodeId, dragOffsetX, dragOffsetY,
    resizeNodeId, pointerDownAt, pointerMoved,
    contextNodeId, nodeMdOverlayOpen, nodeMdOverlayView
  }
}
```

### 1.8 Context Menu Items (current)

| Action | Condition | Effect |
|--------|-----------|--------|
| Fork node | Always | Clone node + edge from original |
| Merge with… | Always | Enter merge mode, next click merges |
| Pin / Unpin | Toggle text | Lock/unlock position |
| Convert to Stargate / Normal | Toggle text | Change node type |
| Delete | nodes > 1 | Remove node + edges |

### 1.9 What Does NOT Exist (confirm these gaps)

- **No interactive edge creation** — edges only created by: prompt flow, fork, merge, portal, seed
- **No arrowheads on edges** — all edges rendered as plain lines with flow particles
- **No edge directionality** — `a` and `b` are semantically source/target for causal/temporal, but visually symmetric
- **No drag-to-connect**
- **No "Connect to…" context menu**

### 1.10 Design System

```css
:root {
  --bg-0: #f4f6f8;     /* lightest bg */
  --bg-1: #ffffff;     /* card/panel */
  --bg-2: #e0e4e8;     /* border/divider */
  --cyan: #ff6d5a;     /* PRIMARY ACCENT — coral/orange, NOT cyan */
  --magenta: #ff6d5a;  /* alias */
  --green: #10b981;    /* pinned border */
  --violet: #8b5cf6;   /* edge kind */
  --text: #222222;     /* body text */
  --muted: #666666;    /* secondary */
  --warn: #f59e0b;     /* warning */
  --danger: #ef4444;   /* delete */
  --edge: #a3a8b0;     /* default edge */
}
```

**Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

**Note:** `--cyan` is `#ff6d5a` (coral). This is intentional branding. Do NOT change it.

---

## 2. Target Structure

```
bendscript/
├── src/
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── utils.js          # uid, clamp, rand, dist, trimText, escapeHtml
│   │   │   ├── graph.js          # newPlane, addNode, addEdge, findNode, findEdge,
│   │   │   │                     # connectedNodes, removeNode, mergeNodes,
│   │   │   │                     # normalizeEdgeProps, activePlane, depthOfPlane,
│   │   │   │                     # breadcrumbList, ensurePortalPlane, seedState
│   │   │   ├── physics.js        # simulate() + physics constants
│   │   │   ├── camera.js         # projectToScreen, screenToWorld
│   │   │   ├── hittest.js        # nodeCardSize, nodeRadius, nodeAtPoint,
│   │   │   │                     # isPointOnNodeResizeHandle, edgeAnchorPair,
│   │   │   │                     # pointToSegmentDistance, edgeAtPoint
│   │   │   ├── renderer.js       # drawBackground, drawEdges, drawNodes,
│   │   │   │                     # drawNodeText, wrapMarkdownLines (DOM: needs ctx)
│   │   │   ├── input.js          # All pointer/keyboard/wheel handlers (DOM)
│   │   │   └── persistence.js    # loadState, saveState, saveSoon (DOM: localStorage)
│   │   ├── stores/
│   │   │   ├── graphStore.js     # Svelte writable: planes, activePlaneId, rootPlaneId
│   │   │   ├── uiStore.js        # Svelte writable: selectedNodeId, editMode, etc.
│   │   │   └── engineBridge.js   # Event bus between engine and stores (rAF guard)
│   │   └── markdown.js           # markdownToInspectorHtml, markdownToPlainLines
│   ├── routes/
│   │   ├── +layout.svelte        # Root layout (minimal — no auth)
│   │   └── +page.svelte          # Single page: hero section + app section
│   └── components/
│       ├── canvas/
│       │   ├── GraphCanvas.svelte    # <canvas> + rAF mount/destroy
│       │   ├── NodeInspector.svelte  # Right panel — node text/type/pin
│       │   ├── EdgeInspector.svelte  # Right panel — edge label/kind/strength
│       │   ├── Composer.svelte       # Floating prompt input bar + drag
│       │   ├── HUD.svelte            # Brand + stat pills + mode toggle
│       │   ├── Breadcrumbs.svelte    # Plane navigation
│       │   ├── ContextMenu.svelte    # Right-click menu (fork/merge/pin/stargate/delete + Connect to…)
│       │   ├── MarkdownModal.svelte  # Full-screen markdown editor/preview
│       │   ├── WarpOverlay.svelte    # Stargate transition effect
│       │   ├── Legend.svelte         # Edge kind color legend (bottom-right)
│       │   └── Hint.svelte           # Contextual help text (bottom)
│       └── hero/
│           └── HeroSection.svelte    # Marketing hero (above the fold)
├── static/
│   └── (favicon, etc.)
├── package.json
├── svelte.config.js
├── vite.config.js
└── .env.example                      # Empty for now — no secrets needed
```

### 2.1 Module Extraction Rules

**Rule 1: DOM-free engine core.** `utils.js`, `graph.js`, `physics.js`, `camera.js`, `hittest.js` must have **zero** DOM imports — no `window`, `document`, `canvas`, `ctx`. They are pure functions that take data and return data. This enables future extraction as `@bendscript/engine` npm package.

**Rule 2: DOM-touching modules are explicit.** `renderer.js` takes `ctx` as a parameter. `input.js` takes `canvas` and `ctx` as parameters. `persistence.js` uses `localStorage` directly. These are the only files that touch the DOM.

**Rule 3: Engine mutates objects directly.** The physics simulation mutates `node.x`, `node.y`, `node.vx`, etc. directly on the plane objects. Svelte stores are NOT updated inside the rAF loop. Stores only sync on discrete user actions (drag end, text save, node add/delete).

**Rule 4: Preserve exact behavior.** Do not refactor algorithms, rename internal variables, or "improve" physics constants. The goal is a 1:1 port. If the prototype has a quirk, preserve it.

**Rule 5: marked + DOMPurify as npm deps.** Replace CDN `<script>` tags with `npm install marked dompurify` and ES module imports.

---

## 3. What to Build

### Task 1: Scaffold SvelteKit

```bash
npm create svelte@latest bendscript
# Skeleton project, JavaScript (no TypeScript), ESLint + Prettier
cd bendscript
npm install
npm install marked dompurify
npm install -D tailwindcss @tailwindcss/vite
```

Configure `vite.config.js` with Tailwind plugin. Configure `svelte.config.js` with `adapter-static` (no server-side rendering needed for this phase).

### Task 2: Extract Engine Modules

Pull each function from `index.html` into its target module. Add `export` keywords. No logic changes.

**Pattern:**
```javascript
// src/lib/engine/physics.js
// Extracted from BendScript index.html simulate() — do not alter constants

export function simulate(plane, dt) {
  // ... exact code from index.html
}
```

**Critical extraction notes:**

1. **`graph.js`** needs access to `state` for `activePlane()`, `depthOfPlane()`, `breadcrumbList()`. Pass state as a parameter or import from store. Recommendation: these become functions that take `state` as first arg:
   ```javascript
   export function activePlane(state) { return state.planes[state.activePlaneId]; }
   export function depthOfPlane(state, planeId) { ... }
   ```

2. **`renderer.js`** all draw functions take `ctx` as first parameter (they currently use a closure-captured `ctx`). Add it explicitly:
   ```javascript
   export function drawBackground(ctx, W, H, t) { ... }
   export function drawEdges(ctx, plane, W, H, t) { ... }
   export function drawNodes(ctx, plane, W, H, t) { ... }
   ```

3. **`renderer.js` depends on `camera.js` and `hittest.js`** — import `projectToScreen`, `nodeCardSize`, `edgeAnchorPair`, etc.

4. **`input.js`** returns a cleanup function and dispatches events via the engine bridge:
   ```javascript
   export function setupInputHandlers(canvas, ctx, state, dispatch) {
     // ... attach all event listeners
     return function cleanup() {
       // ... remove all event listeners
     };
   }
   ```

5. **`simulate()`** — read the actual function carefully. The constants in the code may differ from what's documented elsewhere. Extract the exact values from `index.html`.

6. **`wrapMarkdownLines()`** uses `ctx.measureText()` — it lives in `renderer.js` (DOM-touching), not `markdown.js`.

### Task 3: Create Svelte Stores

```javascript
// src/lib/stores/graphStore.js
import { writable, derived } from 'svelte/store';

export const state = writable(null); // Full state object

export const planes = derived(state, $s => $s?.planes || {});
export const activePlaneId = derived(state, $s => $s?.activePlaneId);
export const activePlane = derived(state, $s =>
  $s ? $s.planes[$s.activePlaneId] || null : null
);
```

```javascript
// src/lib/stores/uiStore.js
import { writable } from 'svelte/store';

export const selectedNodeId = writable(null);
export const selectedEdgeId = writable(null);
export const editMode = writable('edit');
export const composerPos = writable({ free: false, x: 0, y: 0 });
export const mergeSourceNodeId = writable(null);
export const contextMenuState = writable({ visible: false, x: 0, y: 0, nodeId: null });
export const hintText = writable('');
export const markdownModalOpen = writable(false);
export const markdownModalView = writable('write');
```

```javascript
// src/lib/stores/engineBridge.js
// Thin event bus — engine dispatches events, Svelte components listen

const handlers = {};
export function on(event, fn) { (handlers[event] ||= []).push(fn); }
export function off(event, fn) {
  if (handlers[event]) handlers[event] = handlers[event].filter(h => h !== fn);
}
export function dispatch(event, payload) {
  (handlers[event] || []).forEach(fn => fn(payload));
}

// rAF boundary guard
let _insideRAF = false;
export function markRAFStart() { _insideRAF = true; }
export function markRAFEnd() { _insideRAF = false; }
export function assertNotInRAF(caller = 'unknown') {
  if (_insideRAF) {
    throw new Error(`[BendScript] Store update from rAF (${caller}). ` +
      `Stores sync on discrete actions only.`);
  }
}
```

### Task 4: Build Components

#### GraphCanvas.svelte

Mount the canvas, start the rAF loop, wire up input handlers:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { state } from '$lib/stores/graphStore';
  import { simulate } from '$lib/engine/physics';
  import { drawBackground, drawEdges, drawNodes } from '$lib/engine/renderer';
  import { setupInputHandlers } from '$lib/engine/input';
  import { markRAFStart, markRAFEnd, dispatch } from '$lib/stores/engineBridge';

  let canvas;
  let ctx;
  let rafId;
  let lastT = performance.now();
  let cleanup;

  onMount(() => {
    ctx = canvas.getContext('2d');
    resize();
    cleanup = setupInputHandlers(canvas, ctx, $state, dispatch);
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    cleanup?.();
  });

  function tick() {
    markRAFStart();
    const t = performance.now();
    const dt = Math.min(33, t - lastT);
    lastT = t;
    const currentState = $state; // read once
    if (!currentState) { markRAFEnd(); rafId = requestAnimationFrame(tick); return; }
    const plane = currentState.planes[currentState.activePlaneId];
    if (!plane) { markRAFEnd(); rafId = requestAnimationFrame(tick); return; }
    const W = window.innerWidth;
    const H = window.innerHeight;
    simulate(plane, dt);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, W, H, t);
    drawEdges(ctx, plane, W, H, t);
    drawNodes(ctx, plane, W, H, t);
    markRAFEnd();
    // HUD + breadcrumbs update via store subscriptions in their components
    dispatch('frame', { plane, t });
    rafId = requestAnimationFrame(tick);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
</script>

<svelte:window on:resize={resize} />
<canvas bind:this={canvas} id="graph" />
```

#### Other Components

Port each UI element as a Svelte component. The existing HTML is in `index.html` — extract the relevant DOM + CSS:

- **HUD.svelte** — Brand pill + stat pills + mode toggle. Subscribe to `dispatch('frame')` to update counts.
- **Breadcrumbs.svelte** — Dynamic plane navigation. Subscribe to active plane changes.
- **NodeInspector.svelte** — Right panel with text, type, pin fields. Bind to `selectedNodeId`.
- **EdgeInspector.svelte** — Right panel with label, kind, strength. Bind to `selectedEdgeId`.
- **Composer.svelte** — Floating prompt bar with drag handle. Submit calls `spawnPromptFlow`.
- **ContextMenu.svelte** — Right-click menu. Bind to `contextMenuState`.
- **MarkdownModal.svelte** — Full-screen editor/preview with marked + DOMPurify.
- **WarpOverlay.svelte** — Radial gradient flash on stargate enter.
- **Legend.svelte** — Edge kind color legend (bottom-right corner).
- **Hint.svelte** — Contextual help text. Bind to `hintText`.
- **HeroSection.svelte** — Marketing hero. Scroll-to-app transition.

### Task 5: Page Assembly

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import HeroSection from '$components/hero/HeroSection.svelte';
  import GraphCanvas from '$components/canvas/GraphCanvas.svelte';
  import HUD from '$components/canvas/HUD.svelte';
  import Breadcrumbs from '$components/canvas/Breadcrumbs.svelte';
  import NodeInspector from '$components/canvas/NodeInspector.svelte';
  import EdgeInspector from '$components/canvas/EdgeInspector.svelte';
  import Composer from '$components/canvas/Composer.svelte';
  import ContextMenu from '$components/canvas/ContextMenu.svelte';
  import MarkdownModal from '$components/canvas/MarkdownModal.svelte';
  import WarpOverlay from '$components/canvas/WarpOverlay.svelte';
  import Legend from '$components/canvas/Legend.svelte';
  import Hint from '$components/canvas/Hint.svelte';
</script>

<HeroSection />
<div class="app-section">
  <GraphCanvas />
  <HUD />
  <Breadcrumbs />
  <NodeInspector />
  <EdgeInspector />
  <Composer />
  <ContextMenu />
  <MarkdownModal />
  <WarpOverlay />
  <Legend />
  <Hint />
</div>
```

### Task 6: Persistence (LocalStorage)

Keep the existing localStorage persistence. The state shape is identical.

```javascript
// src/lib/engine/persistence.js
const STORAGE_KEY = 'bendscript-state-v1';

export function loadState() {
  // ... exact logic from index.html loadState()
}

export function saveState(state) {
  // ... exact logic from index.html saveState()
}

let saveTimer;
export function saveSoon(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 220);
}
```

Wire autosave in `+page.svelte` or `GraphCanvas.svelte`:
- `beforeunload` → save
- `setInterval(save, 6000)` — periodic autosave
- `saveSoon()` on discrete actions (node move, text edit, etc.)

### Task 7: Add Directed Edge Creation (NEW)

This is the one new feature beyond the prototype. It's required for the κ topology engine.

#### 7.1: "Connect to…" Context Menu Item

Add a new item to the context menu, between "Merge with…" and "Pin":

**"Connect to…"** — When clicked:

1. Enter "connect mode" (similar to merge mode)
2. Show hint: **"Click a target node to create a directed edge"**
3. On next node click, call `addEdge(plane, sourceNode, targetNode, { kind: 'causal' })`
4. Open the edge inspector for the new edge so the user can change the kind
5. Exit connect mode

#### 7.2: Edge Arrowheads for Directed Edges

In `drawEdges()` (renderer.js), add arrowheads to edges where `kind === 'causal'` or `kind === 'temporal'`:

```javascript
// After drawing the edge line, if directed kind:
if (edge.props.kind === 'causal' || edge.props.kind === 'temporal') {
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowLen = 10;
  const arrowAngle = Math.PI / 6; // 30 degrees
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowLen * Math.cos(angle - arrowAngle),
    endY - arrowLen * Math.sin(angle - arrowAngle)
  );
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowLen * Math.cos(angle + arrowAngle),
    endY - arrowLen * Math.sin(angle + arrowAngle)
  );
  ctx.stroke();
}
```

Use the edge's existing color. The arrowhead should be visible but not dominant — same stroke width as the edge.

#### 7.3: Edge Kind Default

When creating edges via "Connect to…", default to `kind: 'causal'`. The user can change it in the edge inspector immediately after.

---

## 4. CSS Migration

### 4.1: Extract All CSS

Copy all `~895 lines` of CSS from the `<style>` tag in `index.html` into Svelte component `<style>` blocks or a shared `src/app.css`.

**Recommendation:** Put global styles (`:root` vars, `*`, `html`, `body`, `#graph`) in `src/app.css`. Put component-specific styles in each component's `<style>` block.

### 4.2: Tailwind Usage

Use Tailwind for **new CSS only** (layout utilities in components). Do NOT rewrite existing CSS as Tailwind classes — that's a cosmetic refactor that breaks visual parity. Keep the existing CSS as-is.

### 4.3: Do NOT Change

- `--cyan: #ff6d5a` — intentional coral, not cyan
- The `⊛` glyph on stargates
- Physics constants in `simulate()`
- Node auto-sizing logic in `nodeCardSize()`
- The `uid()` format (`prefix_random36timestamp36`)
- `STORAGE_KEY = 'bendscript-state-v1'` — backward compat

---

## 5. Testing Checklist

Status legend:
- `[x]` = verified in current migration pass
- `[~]` = implemented in code, needs manual browser confirmation
- `[ ]` = not verified yet

### Visual Parity

```
[~] Canvas renders identically to index.html prototype
[~] Physics simulation produces identical node movement
[x] Dot grid background matches (20px spacing)
[x] Edge flow particles animate correctly
[x] Edge colors match per kind (context=gray, causal=coral, temporal=yellow, etc.)
[x] Node cards render with correct border colors, text, badges
[x] Stargate nodes show ⊛ prefix and distinct styling
[x] Mode badge shows EDIT (coral) or PREVIEW (gray)
[x] Pinned nodes show green border
[~] Zoom works (wheel), range 0.32–2.8
[~] Pan works (drag on empty canvas)
```

### Interactions

```
[~] Click node → selects, inspector populates
[~] Click edge → selects, edge inspector populates
[~] Drag node → moves node, physics continues on release
[~] Resize node → drag bottom-right handle
[~] Right-click node → context menu appears (edit mode only)
[~] Fork → creates clone + edge
[~] Merge → enters merge mode, second click merges
[~] Pin/Unpin → toggles, zero velocity when pinned
[~] Convert to/from Stargate → type changes, ⊛ prefix
[~] Delete → removes node + edges (min 1 node)
[~] Click stargate → warp transition → enter sub-plane
[~] Breadcrumbs → navigate back up plane hierarchy
[~] Edit/Preview toggle → disables/enables editing
[~] Markdown modal → opens, renders, saves
[~] Composer → submit creates user node + response node
[~] Composer drag → repositions, dblclick recenters
[~] Keyboard: Escape, Delete/Backspace, Ctrl+S
```

### New Feature: Directed Edges

```
[x] "Connect to…" appears in context menu
[~] Click target node → creates causal edge
[~] Edge inspector opens for new edge
[x] Arrowheads render on causal edges (a → b direction)
[x] Arrowheads render on temporal edges
[x] No arrowheads on context/associative/user edges
[~] Edge kind can be changed in inspector after creation
```

### Persistence

```
[x] State loads from localStorage on page mount
[x] State saves on node drag end, text edit, mode change
[x] Autosave fires every 6 seconds
[x] beforeunload saves state
[~] Existing localStorage data from prototype loads correctly (backward compat)
```

### Build

```
[~] npm run dev → opens working canvas
[x] npm run build → produces static build
[~] No console errors in dev mode
[ ] No ESLint errors
```

### Cloudflare Pages Deployment

```
[x] wrangler.toml exists in project root
[x] wrangler.toml sets pages_build_output_dir = "build"
[x] package.json includes Cloudflare-friendly build script(s)
[~] Cloudflare Pages project root directory is set to bendscript.com
[~] Cloudflare Pages build command is set to npm run build
[~] Cloudflare Pages output directory is set to build
[ ] Preview deployment loads without runtime errors
[ ] Production deployment loads without runtime errors
```

---

## 6. File Manifest

### New files to create:

| File | Purpose |
|------|---------|
| `src/lib/engine/utils.js` | Utility functions |
| `src/lib/engine/graph.js` | Graph data model |
| `src/lib/engine/physics.js` | Force simulation |
| `src/lib/engine/camera.js` | Coordinate transforms |
| `src/lib/engine/hittest.js` | Hit testing |
| `src/lib/engine/renderer.js` | Canvas drawing |
| `src/lib/engine/input.js` | Event handlers |
| `src/lib/engine/persistence.js` | LocalStorage |
| `src/lib/stores/graphStore.js` | Svelte graph store |
| `src/lib/stores/uiStore.js` | Svelte UI store |
| `src/lib/stores/engineBridge.js` | Engine ↔ store bridge |
| `src/lib/markdown.js` | Markdown processing |
| `src/routes/+layout.svelte` | Root layout |
| `src/routes/+page.svelte` | Main page |
| `src/components/canvas/GraphCanvas.svelte` | Canvas + rAF |
| `src/components/canvas/NodeInspector.svelte` | Node panel |
| `src/components/canvas/EdgeInspector.svelte` | Edge panel |
| `src/components/canvas/Composer.svelte` | Prompt bar |
| `src/components/canvas/HUD.svelte` | Stats + mode |
| `src/components/canvas/Breadcrumbs.svelte` | Plane nav |
| `src/components/canvas/ContextMenu.svelte` | Right-click menu |
| `src/components/canvas/MarkdownModal.svelte` | Markdown editor |
| `src/components/canvas/WarpOverlay.svelte` | Stargate transition |
| `src/components/canvas/Legend.svelte` | Edge color legend |
| `src/components/canvas/Hint.svelte` | Help text |
| `src/components/hero/HeroSection.svelte` | Marketing hero |
| `src/app.css` | Global styles |

### Source file (read-only):

| File | Purpose |
|------|---------|
| `bendscript.com/index.html` | Prototype — source of truth for all logic |

### Reference files (context only):

| File | Purpose |
|------|---------|
| `bendscript.com/prompts/BUILD.md` | Full build plan (Phases 2–7 come later) |
| `AmpersandBoxDesign/prompts/KAPPA_BUILD_PROMPT.md` | κ engine added after this migration |

---

## 7. Success Criteria

**This migration is done when:**

1. `npm run dev` opens a BendScript canvas that is visually and functionally identical to opening `index.html` directly
2. A user who has used the prototype cannot tell the difference
3. The codebase is in ~27 files instead of 1, with clear module boundaries
4. Engine modules (`utils`, `graph`, `physics`, `camera`, `hittest`) have zero DOM dependencies
5. The "Connect to…" edge creation works with arrowhead rendering
6. Existing localStorage data from the prototype loads without data loss
7. `npm run build` produces a working static build

**This migration is NOT done if:**

- Physics behavior differs from the prototype (node movement, spring tension, damping)
- Any existing interaction is broken (fork, merge, pin, stargate, markdown modal, etc.)
- Console errors appear during normal use
- The hero section scroll-to-app transition doesn't work
- Edge arrowheads appear on undirected edge kinds (context, associative, user)

---

## 8. What Comes After This

Once this migration is complete:

1. **κ topology engine** — `KAPPA_BUILD_PROMPT.md` Path 2 adds SCC visualization, κ badges, HUD routing mode, bend/unbend to the SvelteKit codebase. The topology engine goes in `src/lib/engine/topology.js`. This is the next immediate step.

2. **Backend** — `BUILD.md` Phases 2–5 add Supabase, auth, AI, realtime.

3. **Integration** — `KAPPA_BUILD_PROMPT.md` Path 3 connects BendScript to Graphonomous via MCP for live κ-aware routing.

---

*Source: `bendscript.com/index.html` (4,068 lines). Target: SvelteKit + modular JS. Companion docs: `BUILD.md` (full product roadmap), `KAPPA_BUILD_PROMPT.md` (κ topology engine).*
