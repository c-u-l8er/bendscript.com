# BendScript — Coding Agent Build Prompt
**Version:** 1.0 | **Date:** March 2026 | **Type:** Full Migration + Feature Build

> **NOTE (2026-03-28):** BendScript's Supabase config, migrations, and edge functions have moved to the **shared ecosystem Supabase** at the repo root (`ProjectAmp2/ampersand-supabase/`). BendScript tables now live in the `kag.*` PostgreSQL schema. The `supabase/` paths referenced below are historical — the canonical locations are now:
> - Schema: `/ampersand-supabase/migrations/010_kag_schema.sql`
> - RLS: `/ampersand-supabase/migrations/011_kag_rls.sql`
> - Edge Function: `/ampersand-supabase/functions/kag-ai-proxy/`
> - Architecture: `/ampersand-supabase/ARCHITECTURE.md`
> - Use `.schema('kag')` in the Supabase JS client to target BendScript tables.

---

## Your Mission

You are migrating **BendScript** from a single-file HTML/CSS/JS prototype (`index.html`, ~3,500 lines) into a production SvelteKit + Supabase multi-tenant web application with real AI graph synthesis via the Anthropic Claude API.

The existing `index.html` is the source of truth for all core logic. You are NOT redesigning — you are extracting, restructuring, and extending. Preserve the engine. Plug in the backend. Wire in AI.

Read `index.html` fully before writing a single line. Every major system you need is already there.

---

## What Already Exists (Do NOT rewrite from scratch)

Read `index.html` and extract these systems as-is into their new homes:

| System | Location in `index.html` | Where it goes in SvelteKit |
|---|---|---|
| Physics simulation | `simulate(dt)` function | `src/lib/engine/physics.js` |
| Canvas renderer | `tick()`, `drawNodes()`, `drawEdges()`, `drawBackground()` | `src/lib/engine/renderer.js` |
| World/screen coordinate transforms | `projectToScreen()`, `screenToWorld()` | `src/lib/engine/camera.js` |
| Node CRUD | `addNode()`, `removeNode()`, `mergeNodes()` | `src/lib/engine/graph.js` |
| Edge CRUD | `addEdge()`, `findEdge()`, `normalizeEdgeProps()` | `src/lib/engine/graph.js` |
| Plane system | `newPlane()`, `activePlane()`, `depthOfPlane()` | `src/lib/engine/planes.js` |
| Hit testing | `nodeAtPoint()`, `edgeAtPoint()`, `isPointOnNodeResizeHandle()` | `src/lib/engine/hittest.js` |
| Markdown renderer | `markdownToInspectorHtml()`, marked + DOMPurify usage | `src/lib/markdown.js` |
| State shape | `seedState()`, `loadState()`, `saveState()` — the full state object | `src/lib/stores/graphStore.js` |
| Pointer/input handlers | All `canvas.addEventListener(...)` blocks | `src/lib/engine/input.js` |

**Do not alter the physics constants, force calculations, or rendering math unless explicitly told to. These are tuned.**

---

## Target Stack

```
Frontend:   SvelteKit (latest stable)
Backend:    Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
AI:         Anthropic Claude API (claude-haiku-4-5-20251001 for Free, claude-sonnet-4-6 for Paid)
Styling:    Tailwind CSS v4 (utility classes only — no component libraries)
Testing:    Vitest (unit) + Playwright (e2e)
Deploy:     Cloudflare Pages (frontend) + Supabase cloud (backend)
```

---

## Repository Structure

Create this exact structure:

```
bendscript/
├── src/
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── physics.js          # Force simulation (extracted from index.html)
│   │   │   ├── renderer.js         # Canvas draw loop (extracted)
│   │   │   ├── camera.js           # World/screen transforms (extracted)
│   │   │   ├── graph.js            # Node + edge CRUD (extracted)
│   │   │   ├── planes.js           # Plane system + stargate logic (extracted)
│   │   │   ├── hittest.js          # nodeAtPoint, edgeAtPoint (extracted)
│   │   │   └── input.js            # Pointer/keyboard handlers (extracted)
│   │   ├── stores/
│   │   │   ├── graphStore.js       # Svelte writable store wrapping engine state
│   │   │   ├── uiStore.js          # Selected node/edge, edit mode, composer pos
│   │   │   └── workspaceStore.js   # Current workspace, members, plan
│   │   ├── supabase/
│   │   │   ├── client.js           # createClient() singleton
│   │   │   ├── queries.js          # Type-safe query helpers
│   │   │   └── realtime.js         # Broadcast channel setup + handlers
│   │   ├── ai/
│   │   │   ├── client.js           # fetch wrapper for /api/ai Edge Function
│   │   │   ├── prompts.js          # System prompts for each AI tier
│   │   │   └── graphSynthesis.js   # Parse AI response → node/edge objects
│   │   └── markdown.js             # Markdown → HTML (reuse existing logic)
│   ├── routes/
│   │   ├── +layout.svelte          # Root layout — auth guard, workspace init
│   │   ├── +layout.server.js       # Session check
│   │   ├── (marketing)/
│   │   │   └── +page.svelte        # Landing page (graph demo, no auth required)
│   │   ├── (app)/
│   │   │   ├── +layout.svelte      # App shell — sidebar, nav
│   │   │   ├── dashboard/
│   │   │   │   └── +page.svelte    # Workspace graph list
│   │   │   └── graph/
│   │   │       └── [id]/
│   │   │           ├── +page.svelte      # Main canvas page
│   │   │           └── +page.server.js   # Load graph from Supabase
│   │   ├── share/
│   │   │   └── [id]/
│   │   │       └── +page.svelte    # Public read-only graph view
│   │   ├── auth/
│   │   │   ├── login/+page.svelte
│   │   │   └── callback/+page.server.js
│   │   └── api/
│   │       └── ai/
│   │           └── +server.js      # Claude API proxy (server-side only)
│   └── components/
│       ├── canvas/
│       │   ├── GraphCanvas.svelte       # <canvas> element + rAF loop mount
│       │   ├── NodeInspector.svelte     # Right panel — node text/type/pin
│       │   ├── EdgeInspector.svelte     # Right panel — edge label/kind/strength
│       │   ├── Composer.svelte          # Floating prompt input bar
│       │   ├── HUD.svelte               # Top bar — stats, breadcrumbs, mode toggle
│       │   ├── ContextMenu.svelte       # Right-click menu
│       │   ├── MarkdownModal.svelte     # Full-screen markdown editor/preview
│       │   └── WarpOverlay.svelte       # Stargate transition flash
│       ├── ui/
│       │   ├── Pill.svelte
│       │   ├── Button.svelte
│       │   └── Modal.svelte
│       └── workspace/
│           ├── WorkspaceNav.svelte
│           ├── GraphCard.svelte
│           └── MemberList.svelte
├── ampersand-supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql          # Full schema (see below)
│   │   └── 002_rls.sql             # RLS policies (see below)
│   └── functions/
│       └── ai-proxy/
│           └── index.ts            # Claude API Edge Function
├── tests/
│   ├── unit/
│   │   └── engine/                 # Physics + graph logic tests
│   └── e2e/
│       └── graph.spec.js           # Canvas interaction tests
├── .env.example
├── svelte.config.js
├── vite.config.js
└── README.md
```

---

## Phase 0 — Validate Topology-Aware AI (Day 0)

**This is the single most important milestone.** BendScript's core differentiator is that AI receives graph topology as generative input (Tier 2+). This hypothesis is currently unvalidated — the prototype uses keyword stubs. Before investing 16 days in a full SvelteKit migration, spend one day proving the concept works.

### 0.1 Quick T2 Prototype

Create a standalone test script (not part of the migration) that:

1. Takes the seed graph state (nodes + edges from `seedState()`)
2. Sends it to Claude as Tier 2 graph context + a user prompt
3. Compares the structural quality of the response against a Tier 1 (no context) call

```js
// scripts/validate-t2.js — run with: node scripts/validate-t2.js
// Requires: ANTHROPIC_API_KEY env var

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const seedGraph = {
  nodes: [
    { id: 'n1', text: 'BendScript', type: 'normal' },
    { id: 'n2', text: 'What is Script Bending?', type: 'normal' },
    { id: 'n3', text: '⊛ Stargates', type: 'stargate' },
    { id: 'n4', text: 'Graph Prompting', type: 'normal' },
    { id: 'n5', text: 'The Protocol', type: 'normal' },
  ],
  edges: [
    { a: 'n1', b: 'n2', label: 'defines', kind: 'context' },
    { a: 'n1', b: 'n3', label: 'portals', kind: 'associative' },
    { a: 'n1', b: 'n4', label: 'interaction model', kind: 'context' },
    { a: 'n1', b: 'n5', label: 'spec backbone', kind: 'causal' },
  ]
};

const prompt = 'How does the graph topology influence AI reasoning?';

// Tier 1: no graph context
const t1 = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [{ type: 'text', text: `You are BendScript's graph engine. Respond with JSON: { "text": "response (max 280 chars)", "type": "normal"|"stargate", "edgeLabel": "label", "edgeKind": "context"|"causal"|"temporal"|"associative" }. JSON only.` }],
  messages: [{ role: 'user', content: prompt }],
});

// Tier 2: with graph context
const t2 = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [{ type: 'text', text: `You are BendScript's graph synthesis engine. You receive a graph's nodes and edges. Generate 2-4 new nodes that enrich this graph's topology. Respond with JSON array: [{ "text": "content", "type": "normal"|"stargate", "edgeTo": "exact text of existing node", "edgeLabel": "label", "edgeKind": "context"|"causal"|"temporal"|"associative" }]. JSON only.` }],
  messages: [{ role: 'user', content: `Current graph:\n${JSON.stringify(seedGraph, null, 2)}\n\nUser prompt: ${prompt}` }],
});

console.log('=== TIER 1 (no graph context) ===');
console.log(t1.content[0].text);
console.log('\n=== TIER 2 (with graph context) ===');
console.log(t2.content[0].text);
console.log('\n=== VALIDATION ===');
console.log('Does T2 reference existing node names? Does it use edge types that fit the existing topology?');
console.log('If yes → topology-aware synthesis is validated. Proceed with migration.');
console.log('If no → revisit system prompts before building the full product.');
```

### 0.2 T2 Validation Protocol

**This is a gate, not a checklist.** If validation fails, the build plan halts. Prompt engineering iterates until it passes. No exceptions.

Run the test script with **3 different prompts** to avoid single-prompt bias:

| # | Test Prompt | Expected Structural Property |
|---|---|---|
| 1 | "How does the graph topology influence AI reasoning?" | T2 should connect to both "Graph Prompting" and "The Protocol" (bridging existing clusters) |
| 2 | "What are the risks of this approach?" | T2 should generate nodes with `causal` edges (risks → consequences), not just `context` |
| 3 | "Expand the Stargates concept" | T2 should reference the ⊛ Stargates node by name and suggest a `stargate` type node for deeper exploration |

**Quantitative pass/fail criteria (ALL must pass):**

1. **Node reference rate ≥ 75%** — At least 3 of 4 T2-generated nodes connect to an existing node by exact text match (not a hallucinated node name)
2. **Edge kind diversity ≥ 2** — T2 uses at least 2 different edge kinds across its generated nodes (proves it's reading topology, not defaulting to "context")
3. **Structural gap fill ≥ 1** — At least 1 T2 node connects two previously unconnected nodes or creates a bridge between clusters
4. **Stargate awareness** — When the prompt relates to a stargate node, T2 references it and/or suggests a new stargate
5. **Blind preference ≥ 70%** — Show T1 and T2 outputs (unlabeled) to 3 people. At least 2 of 3 must prefer the T2 output for each prompt

**If any criterion fails:**
- Log which criterion failed and the actual T2 output
- Iterate on the Tier 2 system prompt (adjust graph context formatting, add few-shot examples, try different framing)
- Re-run all 3 prompts
- Maximum 5 iteration cycles before escalating to "pivot the differentiator" discussion

**If this test fails after 5 iterations**, the topology-aware synthesis hypothesis is invalidated. The product needs a different thesis before proceeding. Do NOT proceed with the migration on hope.

> **The prompt design is the product — everything else is infrastructure.**

---

## Phase 1 — Scaffold & Extract (Days 1–3)

### 1.0 Immediate Tasks (before coding)

**Create AGENTS.md** in the repository root. This is the open standard (AAIF / Linux Foundation, adopted by 60,000+ repos) that tells AI agents how to interact with BendScript. See `AGENTS.md` in the repo. Zero engineering effort, immediate ecosystem visibility.

### 1.0.1 Engine as Portable Package

The engine modules (physics, graph, planes, hittest, camera) must be extracted as **framework-agnostic pure JS with no DOM or framework dependencies**. This is already the case in `index.html` — preserve it during extraction.

**Why this matters:** The engine is the portable core that enables future distribution surfaces without rewriting:
- **Web app** — SvelteKit imports `@bendscript/engine` as a local package
- **CLI agent tool** — Node.js process runs the engine with SQLite persistence + local MCP server
- **Desktop app (Tauri)** — Rust shell wraps the SvelteKit frontend, engine runs in webview
- **Third-party integrations** — npm package for anyone building on BendScript graphs

Structure the engine extraction with this in mind: no `window`, no `document`, no `canvas` references in the core graph/physics/planes modules. The renderer and input modules are the only ones that touch the DOM.

```
src/lib/engine/          # Framework-agnostic — could be published as @bendscript/engine
├── physics.js           # Pure math — no DOM
├── graph.js             # Node + edge CRUD — no DOM
├── planes.js            # Plane system — no DOM
├── hittest.js           # Geometry — no DOM
├── camera.js            # Coordinate transforms — no DOM
├── renderer.js          # Canvas-specific — DOM required
└── input.js             # Event handlers — DOM required
```

> **Future milestone (v1.1):** Extract `physics.js`, `graph.js`, `planes.js`, `hittest.js`, and `camera.js` into a standalone npm package `@bendscript/engine`. This unlocks the CLI tool and desktop app without any rewrite.

### 1.1 Init SvelteKit

```bash
npm create svelte@latest bendscript
# Choose: Skeleton project, TypeScript: No (use JS), ESLint + Prettier: Yes
cd bendscript
npm install
npm install @supabase/supabase-js @supabase/ssr
npm install -D tailwindcss @tailwindcss/vite
```

### 1.2 Extract Engine Files

Pull each system verbatim from `index.html`. Wrap in ES module exports. Example pattern:

```js
// src/lib/engine/physics.js
// Extracted from BendScript index.html — do not alter constants

const REPEL = 8200;
const SPRING = 0.018;
const DAMPING = 0.74;
const REST = 210;

export function simulate(plane, dt) {
  // ... exact code from index.html simulate() function
}
```

**Do not modify any numeric constants or algorithm logic during extraction. Only add `export` keywords and ES module syntax.**

### 1.3 Create Svelte Stores

The existing flat state object becomes Svelte stores:

```js
// src/lib/stores/graphStore.js
import { writable, derived } from 'svelte/store';

// Mirrors the existing state shape exactly
export const planes = writable({});
export const activePlaneId = writable(null);
export const rootPlaneId = writable(null);

export const activePlane = derived(
  [planes, activePlaneId],
  ([$planes, $id]) => $planes[$id] || null
);
```

```js
// src/lib/stores/uiStore.js
export const selectedNodeId = writable(null);
export const selectedEdgeId = writable(null);
export const editMode = writable('edit'); // 'edit' | 'preview'
export const composerPos = writable({ free: false, x: 0, y: 0 });
export const mergeSourceNodeId = writable(null);
```

```js
// src/lib/stores/workspaceStore.js
// Matches workspace_members join shape from Supabase
export const currentWorkspace = writable(null);
// Shape: { id: uuid, name: string, slug: string, plan: 'free'|'pro'|'teams'|'business'|'enterprise' }

export const currentRole = writable(null);
// Shape: 'owner' | 'admin' | 'member' | 'viewer'

export const workspaceMembers = writable([]);
// Shape: [{ user_id: uuid, role: string, joined_at: string, profiles: { email, display_name } }]
```

### 1.3.1 Canvas ↔ Store Synchronization Contract

**This is the most important architectural boundary in the migration.** The engine (physics, renderer, input) runs on raw mutable JS objects inside each plane. Svelte stores are the reactive layer above it. These two worlds must not be conflated.

**Rule:** The engine mutates plane objects directly (e.g., `node.x += vx`). Svelte stores are *not* called from inside the rAF loop. Stores are only updated when discrete user actions complete (drag end, text save, node add/delete).

```
┌─────────────────────────────────────────────┐
│  Svelte Stores (reactive, drives UI)         │
│  planes, activePlaneId, selectedNodeId, etc. │
└────────────────┬────────────────────────────┘
                 │ read on mount / write on action
┌────────────────▼────────────────────────────┐
│  Engine State (mutable JS objects)           │
│  plane.nodes[], plane.edges[], camera        │
│  — mutated freely by physics + input         │
└────────────────┬────────────────────────────┘
                 │ rAF reads directly — no store subscription
┌────────────────▼────────────────────────────┐
│  Canvas Renderer (drawNodes, drawEdges)      │
└─────────────────────────────────────────────┘
```

**Sync points — when to call `planes.update()`:**

| Event | Store update required |
|---|---|
| Node drag **end** (`pointerup`) | Yes — update `node.x`, `node.y` in store |
| Node text change (debounced 500ms) | Yes — update `node.text` in store |
| Node added | Yes — push to `plane.nodes` in store |
| Node deleted | Yes — remove from `plane.nodes` in store |
| Stargate enter (plane change) | Yes — update `activePlaneId` |
| Node position during drag | **No** — engine mutates directly, canvas reads directly |
| Physics tick (every frame) | **No** — never call stores from rAF |

**Pattern for action handlers in `input.js`:**

```js
// input.js — engine runs mutations; dispatches events for store sync
import { dispatch } from '$lib/stores/engineBridge';

// On drag end:
canvas.addEventListener('pointerup', () => {
  if (draggingNode) {
    dispatch('node:moved', { id: draggingNode.id, x: draggingNode.x, y: draggingNode.y });
    draggingNode = null;
  }
});
```

```js
// src/lib/stores/engineBridge.js — thin event bus between engine and stores
import { planes } from './graphStore';

const handlers = {};
export function on(event, fn) { handlers[event] = fn; }
export function dispatch(event, payload) { handlers[event]?.(payload); }

// --- rAF → store boundary guard ---
// The engine mutates objects directly inside rAF. Svelte stores must NEVER be
// updated from inside the animation loop. This flag catches violations early.
let _insideRAF = false;
export function markRAFStart() { _insideRAF = true; }
export function markRAFEnd() { _insideRAF = false; }
export function assertNotInRAF(caller = 'unknown') {
  if (_insideRAF) {
    throw new Error(`[BendScript] Store update called from inside rAF loop (${caller}). This violates the engine/store boundary. Stores must only be updated on discrete user actions (drag end, text save, node add/delete), never during physics or render ticks.`);
  }
}

// In GraphCanvas.svelte onMount:
on('node:moved', ({ id, x, y }) => {
  assertNotInRAF('node:moved');
  planes.update(ps => {
    const plane = ps[get(activePlaneId)];
    const node = plane?.nodes.find(n => n.id === id);
    if (node) { node.x = x; node.y = y; }
    return ps;
  });
});
```

### 1.4 GraphCanvas Component

The canvas lifecycle maps to Svelte's `onMount`/`onDestroy`:

```svelte
<!-- src/components/canvas/GraphCanvas.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { activePlane } from '$lib/stores/graphStore';
  import { simulate } from '$lib/engine/physics';
  import { drawBackground, drawEdges, drawNodes } from '$lib/engine/renderer';
  import { setupInputHandlers } from '$lib/engine/input';
  import { markRAFStart, markRAFEnd } from '$lib/stores/engineBridge';

  let canvas;
  let ctx;
  let rafId;
  let lastT = performance.now();
  let cleanup;

  onMount(() => {
    ctx = canvas.getContext('2d');
    resize();
    cleanup = setupInputHandlers(canvas, ctx);
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    cleanup?.();
  });

  function tick() {
    markRAFStart(); // --- guard: any store.update() call after this will throw ---
    const t = performance.now();
    const dt = Math.min(33, t - lastT);
    lastT = t;
    const plane = $activePlane;
    if (!plane) { markRAFEnd(); rafId = requestAnimationFrame(tick); return; }
    const W = window.innerWidth;
    const H = window.innerHeight;
    simulate(plane, dt);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, W, H, t);
    drawEdges(ctx, plane, W, H, t);
    drawNodes(ctx, plane, W, H, t);
    markRAFEnd(); // --- guard lifted: store updates are safe again ---
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

---

## Phase 2 — Supabase Backend (Days 3–5)

### 2.1 Database Schema

Run this as migration `001_schema.sql`:

```sql
-- Workspaces (tenants)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free', -- 'free' | 'pro' | 'teams' | 'business' | 'enterprise'
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Workspace membership
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'admin' | 'member' | 'viewer'
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- Graph planes (root plane per graph, child planes via stargate)
create table graph_planes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  graph_id uuid not null, -- groups planes belonging to one graph
  name text not null default 'Graph Plane',
  parent_plane_id uuid references graph_planes(id) on delete cascade,
  parent_node_id text, -- node id (string) of the stargate that spawned this plane
  is_root boolean default false,
  created_at timestamptz default now()
);

-- Nodes
create table nodes (
  id text primary key, -- preserves existing uid() format
  plane_id uuid references graph_planes(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  text text not null default '',
  type text not null default 'normal', -- 'normal' | 'stargate'
  x float not null default 0,
  y float not null default 0,
  width float,
  height float,
  pinned boolean default false,
  portal_plane_id uuid references graph_planes(id),
  scroll_y float default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Edges
create table edges (
  id text primary key,
  plane_id uuid references graph_planes(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  node_a text not null,
  node_b text not null,
  label text default '',
  kind text default 'context', -- 'context' | 'causal' | 'temporal' | 'associative' | 'user'
  strength integer default 1 check (strength between 1 and 5),
  created_at timestamptz default now()
);

-- AI generation log (for usage billing)
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  graph_id uuid not null,
  prompt text not null,
  model text not null,
  tier integer not null, -- 1 | 2 | 3
  tokens_used integer,
  nodes_spawned integer,
  created_at timestamptz default now()
);

-- Indexes
create index on nodes(plane_id);
create index on edges(plane_id);
create index on graph_planes(workspace_id);
create index on graph_planes(graph_id);
create index on workspace_members(user_id);

-- Composite index for AI rate limiting queries (filters on workspace_id + tier + created_at)
-- Without this, the rate limit check in the Edge Function becomes a sequential scan at scale.
create index idx_ai_gen_rate on ai_generations(workspace_id, tier, created_at);

-- Auto-update updated_at on nodes
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
create trigger nodes_updated_at before update on nodes
  for each row execute function update_updated_at();

-- Clean up orphaned edges when a node is deleted
-- (edges.node_a and edges.node_b are text IDs, not FK-constrained, so we use a trigger)
create or replace function cleanup_orphaned_edges()
returns trigger language plpgsql as $$
begin
  delete from edges where node_a = OLD.id or node_b = OLD.id;
  return OLD;
end;
$$;
create trigger nodes_delete_cleanup before delete on nodes
  for each row execute function cleanup_orphaned_edges();
```

### 2.2 RLS Policies

Run as migration `002_rls.sql`:

```sql
-- Enable RLS on all tables
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table graph_planes enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table ai_generations enable row level security;

-- Helper: check workspace membership
create or replace function is_workspace_member(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Workspace: members can read, owners/admins can update
create policy "members can view workspace" on workspaces
  for select using (is_workspace_member(id));

create policy "owners can update workspace" on workspaces
  for update using (
    exists (select 1 from workspace_members
      where workspace_id = id and user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- Workspace members: visible to other members
create policy "members visible to workspace" on workspace_members
  for select using (is_workspace_member(workspace_id));

-- Graph planes, nodes, edges: workspace members can read/write
create policy "workspace members can read planes" on graph_planes
  for select using (is_workspace_member(workspace_id));

create policy "workspace members can write planes" on graph_planes
  for insert with check (is_workspace_member(workspace_id));

create policy "workspace members can read nodes" on nodes
  for select using (is_workspace_member(workspace_id));

create policy "workspace members can insert nodes" on nodes
  for insert with check (is_workspace_member(workspace_id));

create policy "workspace members can update nodes" on nodes
  for update using (is_workspace_member(workspace_id));

create policy "workspace members can delete nodes" on nodes
  for delete using (is_workspace_member(workspace_id));

create policy "workspace members can read edges" on edges
  for select using (is_workspace_member(workspace_id));

create policy "workspace members can insert edges" on edges
  for insert with check (is_workspace_member(workspace_id));

create policy "workspace members can update edges" on edges
  for update using (is_workspace_member(workspace_id));

create policy "workspace members can delete edges" on edges
  for delete using (is_workspace_member(workspace_id));

-- AI generations: workspace members can read; inserts come from Edge Function (service role)
-- but also allow authenticated member inserts for client-side logging fallback
create policy "workspace members can read generations" on ai_generations
  for select using (is_workspace_member(workspace_id));

create policy "workspace members can insert generations" on ai_generations
  for insert with check (is_workspace_member(workspace_id));
```

### 2.3 Supabase Client

```js
// src/lib/supabase/client.js
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

### 2.4 Graph Persistence Helpers

```js
// src/lib/supabase/queries.js
import { supabase } from './client';

// Load a full graph (all planes, nodes, edges) into the existing state shape
export async function loadGraph(graphId) {
  const { data: planes } = await supabase
    .from('graph_planes')
    .select('*, nodes(*), edges(*)')
    .eq('graph_id', graphId);

  // Reconstruct state object matching existing shape
  const state = { planes: {}, rootPlaneId: null, activePlaneId: null };
  for (const plane of planes) {
    if (plane.is_root) state.rootPlaneId = plane.id;
    state.planes[plane.id] = {
      id: plane.id,
      name: plane.name,
      parentPlaneId: plane.parent_plane_id,
      parentNodeId: plane.parent_node_id,
      nodes: plane.nodes.map(dbNodeToEngine),
      edges: plane.edges.map(dbEdgeToEngine),
      camera: { x: 0, y: 0, zoom: 1 },
      tick: 0,
    };
  }
  state.activePlaneId = state.rootPlaneId;
  return state;
}

// Debounced node position sync (call on drag end, not on every frame)
export async function syncNode(node, workspaceId) {
  await supabase.from('nodes').upsert({
    id: node.id,
    plane_id: node.planeId,
    workspace_id: workspaceId,
    text: node.text,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    pinned: node.pinned,
    updated_at: new Date().toISOString(),
  });
}

// Debounced text sync — call this on every keystroke; it fires DB write 500ms after typing stops
export function makeDebouncedTextSync(workspaceId, delay = 500) {
  let timer;
  return function syncNodeText(node) {
    clearTimeout(timer);
    timer = setTimeout(() => syncNode(node, workspaceId), delay);
  };
}
// Usage in NodeInspector.svelte:
//   const debouncedSync = makeDebouncedTextSync($currentWorkspace.id);
//   $: debouncedSync(selectedNode);  // fires on every text change

function dbNodeToEngine(row) {
  return {
    id: row.id, text: row.text, x: row.x, y: row.y,
    vx: 0, vy: 0, fx: 0, fy: 0,
    pinned: row.pinned, type: row.type,
    portalPlaneId: row.portal_plane_id,
    pulse: Math.random() * Math.PI * 2,
    width: row.width, height: row.height, scrollY: row.scroll_y || 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function dbEdgeToEngine(row) {
  return {
    id: row.id, a: row.node_a, b: row.node_b,
    props: { label: row.label, kind: row.kind, strength: row.strength }
  };
}
```

---

## Phase 3 — AI Integration (Days 5–9)

### 3.1 Edge Function — Claude API Proxy

Create `ampersand-supabase/functions/ai-proxy/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Tiered model routing: Free gets Haiku, paid gets Sonnet
// March 2026 pricing: Haiku 4.5 = $1/$5 per MTok, Sonnet 4.6 = $3/$15 per MTok
function selectModel(plan: string, tier: number): string {
  if (plan === 'free') return 'claude-haiku-4-5-20251001';
  return 'claude-sonnet-4-6';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { prompt, graphContext, tier, userId, workspaceId, graphId, plan } = await req.json();

  // --- Rate limiting: check generation count against plan limits ---
  const { count } = await supabase
    .from('ai_generations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('tier', tier)
    .gte('created_at', todayStart());

  const limit = getLimit(plan, tier);
  if (count !== null && count >= limit) {
    return new Response(JSON.stringify({ error: 'Generation limit reached for this tier' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // --- Select model based on plan ---
  const model = selectModel(plan, tier);

  const systemPrompt = tier === 3
    ? TOPIC_TO_GRAPH_SYSTEM
    : tier === 2
    ? GRAPH_AWARE_SYSTEM
    : CONTEXTUAL_RESPONSE_SYSTEM;

  const userMessage = tier >= 2
    ? `Current graph context:\n${JSON.stringify(graphContext, null, 2)}\n\nUser prompt: ${prompt}`
    : prompt;

  // --- Prompt caching: system prompts are identical across all calls of the same tier.
  //     Adding cache_control reduces input token costs by 90% on cache hits. ---
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  // --- Log generation for billing and rate limiting ---
  const tokensUsed = (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0);
  await supabase.from('ai_generations').insert({
    workspace_id: workspaceId,
    user_id: userId,
    graph_id: graphId,
    prompt: prompt.slice(0, 500),
    model,
    tier,
    tokens_used: tokensUsed,
    nodes_spawned: tier === 3 ? 10 : tier === 2 ? 3 : 1, // estimate, refined by client
  });

  return new Response(JSON.stringify({ content: msg.content }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

function todayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Per-plan daily limits by tier — these match the pricing table in README.md
// Pro caps set to maintain positive margins at avg 25% utilization ($19/mo plan):
//   Worst-case (maxed): ~$31.59/mo AI cost → −$12.59 margin (tolerable for outliers)
//   Avg 25%: ~$7.90/mo AI cost → +$11.10 margin (healthy)
function getLimit(plan: string, tier: number): number {
  const limits: Record<string, Record<number, number>> = {
    free:       { 1: 20, 2: 5, 3: 2, 4: 0 },
    pro:        { 1: 80, 2: 15, 3: 5, 4: 0 },
    teams:      { 1: 9999, 2: 9999, 3: 9999, 4: 0 },  // pool-based, checked monthly
    business:   { 1: 9999, 2: 9999, 3: 9999, 4: 9999 },
    enterprise: { 1: 9999, 2: 9999, 3: 9999, 4: 9999 },
  };
  return limits[plan]?.[tier] ?? 20;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tier 1: Contextual response — replaces generateResponse() stub
const CONTEXTUAL_RESPONSE_SYSTEM = `You are BendScript's graph engine. The user typed a prompt into a knowledge graph node.
Respond with a JSON object:
{
  "text": "your response (max 280 chars)",
  "type": "normal" | "stargate",
  "edgeLabel": "short relationship label (max 40 chars)",
  "edgeKind": "context" | "causal" | "temporal" | "associative"
}
If the response is a deep sub-topic worth drilling into, use type "stargate".
Respond with JSON only. No markdown fences, no preamble.`;

// Tier 2: Graph-aware synthesis
const GRAPH_AWARE_SYSTEM = `You are BendScript's graph synthesis engine. You receive a user prompt and the current graph plane's nodes and edges as context.
Reason about what new nodes would enrich this graph's topology.
Respond with a JSON array of 2-4 node objects:
[
  {
    "text": "node content (max 280 chars)",
    "type": "normal" | "stargate",
    "edgeTo": "exact text of the node this connects to (must match an existing node)",
    "edgeLabel": "relationship label (max 40 chars)",
    "edgeKind": "context" | "causal" | "temporal" | "associative"
  }
]
Respond with JSON array only. No markdown fences, no preamble.`;

// Tier 3: Topic-to-graph — full subgraph generation
const TOPIC_TO_GRAPH_SYSTEM = `You are BendScript's graph architect. Given a topic, generate a complete knowledge graph.
Respond with a JSON array of 8-12 node objects:
[
  {
    "text": "node content (max 280 chars)",
    "type": "normal" | "stargate",
    "edgeTo": null | "exact text of parent node",
    "edgeLabel": "relationship (max 40 chars)",
    "edgeKind": "context" | "causal" | "temporal" | "associative"
  }
]
Rules:
- First node is the root (edgeTo: null)
- Stargate nodes represent sub-topics worth exploring in a new graph plane
- Build a tree with 2-3 levels of depth
- Use varied edge kinds to show semantic relationships
- Respond with JSON array only. No markdown fences, no preamble.`;
```

### 3.2 SvelteKit API Route — AI Proxy

```js
// src/routes/api/ai/+server.js
// This is the client-facing endpoint — it validates auth, resolves the user's plan, then calls the Edge Function

import { json, error } from '@sveltejs/kit';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST({ request, locals }) {
  const session = await locals.getSession();
  if (!session) throw error(401, 'Unauthorized');

  const body = await request.json();

  // Resolve user's workspace and plan for rate limiting + model selection
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, workspaces(plan)')
    .eq('user_id', session.user.id)
    .eq('workspace_id', body.workspaceId)
    .single();

  if (!membership) throw error(403, 'Not a member of this workspace');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      ...body,
      userId: session.user.id,
      plan: membership.workspaces.plan || 'free',
    }),
  });

  if (response.status === 429) {
    const err = await response.json();
    throw error(429, err.error || 'Generation limit reached');
  }

  const data = await response.json();
  return json(data);
}
```

### 3.3 Graph Synthesis Client

```js
// src/lib/ai/graphSynthesis.js
// Replaces generateResponse() with real AI

export async function spawnPromptFlow(prompt, plane, currentTargetNode, tier = 1, workspaceId, graphId) {
  const graphContext = tier >= 2 ? {
    nodes: plane.nodes.map(n => ({ id: n.id, text: n.text, type: n.type })),
    edges: plane.edges.map(e => ({ a: e.a, b: e.b, label: e.props.label, kind: e.props.kind }))
  } : null;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, graphContext, tier, workspaceId, graphId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn('[BendScript] AI request failed:', res.status, err.error || '');
    return fallbackResponse(prompt);
  }

  const data = await res.json();
  const text = data.content.find(b => b.type === 'text')?.text || '';

  const parsed = safeParseAIResponse(text);
  if (!parsed) return fallbackResponse(prompt);

  // Tier 1: single object → wrap in array for uniform handling
  const nodeSpecs = Array.isArray(parsed) ? parsed : [parsed];

  // Validate and sanitize each node spec individually — don't drop the whole response
  // if one node is malformed
  const validSpecs = nodeSpecs
    .map(spec => validateNodeSpec(spec))
    .filter(Boolean);

  return validSpecs.length > 0 ? validSpecs : fallbackResponse(prompt);
}

// Robust JSON extraction — handles markdown fences, mixed text, and partial responses
function safeParseAIResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Try direct parse first (happy path)
  try { return JSON.parse(text); } catch {}

  // Extract first JSON array from mixed text (e.g., "Here are the nodes: [{...}]")
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch {}
  }

  // Extract first JSON object from mixed text
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  return null;
}

// Validate a single node spec — returns sanitized spec or null
function validateNodeSpec(spec) {
  if (!spec || typeof spec !== 'object') return null;

  // text is required
  if (typeof spec.text !== 'string' || !spec.text.trim()) return null;

  return {
    text: spec.text.slice(0, 280),
    type: spec.type === 'stargate' ? 'stargate' : 'normal',
    edgeLabel: typeof spec.edgeLabel === 'string' ? spec.edgeLabel.slice(0, 40) : 'context',
    edgeKind: ['context', 'causal', 'temporal', 'associative', 'user'].includes(spec.edgeKind)
      ? spec.edgeKind : 'context',
    // For Tier 2+: edgeTo references an existing node
    edgeTo: typeof spec.edgeTo === 'string' ? spec.edgeTo : null,
  };
}

function fallbackResponse(prompt) {
  return [{ text: `Exploring: ${prompt.slice(0, 180)}`, type: 'normal', edgeLabel: 'context', edgeKind: 'context' }];
}
```

---

## Phase 4 — Real-time Collaboration (Days 9–12)

### 4.1 Broadcast Channel Setup

```js
// src/lib/supabase/realtime.js
import { supabase } from './client';

let channel = null;

export function joinGraphRoom(graphId, onRemoteUpdate) {
  channel = supabase.channel(`graph:${graphId}`, {
    config: { broadcast: { self: false } }
  });

  channel
    .on('broadcast', { event: 'node_move' }, ({ payload }) => {
      onRemoteUpdate('node_move', payload);
    })
    .on('broadcast', { event: 'node_text' }, ({ payload }) => {
      onRemoteUpdate('node_text', payload);
    })
    .on('broadcast', { event: 'node_add' }, ({ payload }) => {
      onRemoteUpdate('node_add', payload);
    })
    .on('broadcast', { event: 'node_delete' }, ({ payload }) => {
      onRemoteUpdate('node_delete', payload);
    })
    .on('broadcast', { event: 'edge_add' }, ({ payload }) => {
      onRemoteUpdate('edge_add', payload);
    })
    .subscribe();

  return channel;
}

// Call on drag END (not every frame — too much traffic)
export function broadcastNodeMove(nodeId, x, y) {
  channel?.send({ type: 'broadcast', event: 'node_move', payload: { nodeId, x, y } });
}

export function broadcastNodeText(nodeId, text) {
  channel?.send({ type: 'broadcast', event: 'node_text', payload: { nodeId, text } });
}

export function leaveGraphRoom() {
  channel?.unsubscribe();
  channel = null;
}
```

**Critical:** Broadcast node positions on `pointerup` (drag end), not on every `pointermove`. The canvas runs at 60fps locally but Supabase Realtime has rate limits.

---

## Phase 5 — Auth + Multi-tenancy (Days 12–14)

### 5.1 Auth Flow

Use Supabase's email + Google OAuth. On first sign-in, create a personal workspace:

```js
// src/routes/auth/callback/+page.server.js
import { redirect } from '@sveltejs/kit';

export async function load({ url, locals: { supabase } }) {
  const code = url.searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Ensure user has a workspace
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      // Create personal workspace
      const { data: ws } = await supabase
        .from('workspaces')
        .insert({ name: `${user.email}'s Workspace`, slug: user.id, plan: 'free' })
        .select()
        .single();

      await supabase.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: 'owner'
      });
    }
  }

  throw redirect(303, '/dashboard');
}
```

### 5.2 Auth Guard Layout

**Important:** Client-side-only auth guards (`onMount` + `goto`) allow a flash of protected content before redirect. Use a server-side layout load function instead.

```js
// src/routes/(app)/+layout.server.js
import { redirect } from '@sveltejs/kit';

export async function load({ locals: { getSession } }) {
  const session = await getSession();
  if (!session) {
    throw redirect(303, '/auth/login');
  }
  return { session };
}
```

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script>
  export let data; // { session } from layout.server.js
  // No need for onMount auth check — server already redirected unauthenticated users
</script>

<slot />
```

The `safeGetSession` helper comes from `@supabase/ssr` (the `@supabase/auth-helpers-sveltekit` package is deprecated). Ensure `locals.safeGetSession` is set up in `src/hooks.server.js`:

```js
// src/hooks.server.js
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function handle({ event, resolve }) {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        },
      },
    }
  );

  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };
    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  // Alias for backward compat with existing code that calls getSession()
  event.locals.getSession = async () => {
    const { session } = await event.locals.safeGetSession();
    return session;
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range';
    },
  });
}
```

> **Note:** `@supabase/auth-helpers-sveltekit` is deprecated. Use `@supabase/ssr` instead. The key difference is that `safeGetSession()` validates the JWT via `auth.getUser()` to prevent token tampering, whereas the old `getSession()` trusted the JWT without server-side validation.

---

## Phase 6 — Visual Parity (Days 14–16)

### 6.1 Preserve the Exact Visual Language

The current `index.html` has a specific light-mode aesthetic. Port it exactly:

```css
/* Extract from index.html :root vars and apply in app.css */
:root {
  --bg-0: #f4f6f8;
  --bg-1: #ffffff;
  --bg-2: #e0e4e8;
  --cyan: #ff6d5a;    /* Primary accent — coral/salmon, NOT cyan despite the name */
  --green: #10b981;
  --violet: #8b5cf6;
  --text: #222222;
  --muted: #666666;
  --warn: #f59e0b;
  --danger: #ef4444;
  --edge: #a3a8b0;
}
```

**Note:** The `--cyan` variable in the existing code is actually `#ff6d5a` (coral/salmon). This is intentional branding — do not correct it to an actual cyan value.

### 6.2 Component Visual Specs

Port these exact UI elements as Svelte components, pixel-matching the original:

- **HUD pills** — `border-radius: 999px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.05)`, font: `ui-monospace`
- **Breadcrumbs** — `max-width: min(860px, 95vw)`, crumb separator `›`
- **Composer bar** — `border-radius: 999px`, centered overlay, draggable via grip handle
- **Inspector panels** — `width: min(330px, calc(100vw - 28px))`, right-anchored
- **Context menu** — `border-radius: 10px`, `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`
- **Warp overlay** — radial gradient flash on stargate enter, `transition: 560ms cubic-bezier(0.17, 0.84, 0.44, 1)`

---

## Environment Variables

### `.env.example`
```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
```

The `ANTHROPIC_API_KEY` is **only** used in the Supabase Edge Function. It is **never** exposed to the client. The SvelteKit `/api/ai` route acts as the proxy.

---

## Acceptance Criteria

Before considering any phase complete, verify:

### Phase 0 (T2 Validation)
- [ ] `scripts/validate-t2.js` runs successfully with live Claude API
- [ ] T2 response references at least one existing node by name
- [ ] T2 response uses edge kinds that semantically fit the existing graph
- [ ] T2 output is qualitatively richer than T1 for the same prompt
- [ ] If validation fails, system prompts are iterated until it passes

### Phase 1 (Extract)
- [ ] All existing graph interactions work identically to `index.html`
- [ ] Physics simulation produces identical node movement behavior
- [ ] Stargate planes open and breadcrumb navigation works
- [ ] Fork / merge / pin / delete context menu actions work
- [ ] Markdown modal opens, renders, and saves
- [ ] Edit / Preview mode toggle works
- [ ] Composer drag handle repositions the prompt bar

### Phase 2 (Supabase)
- [ ] Graph state loads from Supabase on page mount
- [ ] Node text changes persist to DB within 500ms of stopping typing
- [ ] Node positions persist on drag end
- [ ] New nodes and edges persist immediately
- [ ] Deleted nodes/edges remove from DB
- [ ] Deleting a node also removes all connected edges (cleanup trigger fires)
- [ ] RLS: user cannot read graphs from another workspace
- [ ] `ai_generations` composite index exists: `(workspace_id, tier, created_at)`
- [ ] `nodes.updated_at` auto-updates on row modification

### Phase 3 (AI)
- [ ] Submitting a prompt spawns a user node + AI response node (Tier 1)
- [ ] AI response is real Claude output, not keyword stubs
- [ ] Edge label and kind from AI response are applied to the spawned edge
- [ ] Stargate nodes are spawned when AI sets `type: "stargate"`
- [ ] JSON parser handles markdown-fenced responses (```json ... ```)
- [ ] JSON parser extracts JSON from mixed text/JSON responses
- [ ] Malformed individual nodes are skipped without dropping the entire response
- [ ] A completely unparseable response falls back to a single context node (not a crash)
- [ ] API key is NOT present in any client-side bundle (verify with `grep -r "sk-ant" .svelte-kit/`)
- [ ] `/api/ai` returns 401 for unauthenticated requests
- [ ] Free tier uses Haiku 4.5; paid tiers use Sonnet 4.6 (verify model in `ai_generations` log)
- [ ] Prompt caching is active — verify `cache_creation_input_tokens` or `cache_read_input_tokens` in API response usage
- [ ] Generation rate limits enforced: free user hitting daily T1 cap (20) gets 429 response
- [ ] Pro user hitting daily T3 cap (5) gets 429 response
- [ ] Every generation writes a row to `ai_generations` with token count and tier
- [ ] `/api/ai` returns 429 when user exceeds their plan's daily tier limit

### Phase 4 (Realtime)
- [ ] Two browser tabs on the same graph see each other's node movements
- [ ] Node text changes sync between tabs within 1 second
- [ ] New nodes spawned in tab A appear in tab B
- [ ] Deleting a node in tab A removes it in tab B
- [ ] Broadcast does NOT fire on every animation frame (verify: max 1 broadcast per drag, not 60/sec)

### Phase 5 (Auth)
- [ ] Email login works
- [ ] Google OAuth works
- [ ] New users get a personal workspace automatically
- [ ] `/dashboard` redirects to `/auth/login` when unauthenticated
- [ ] Users cannot access graphs in workspaces they don't belong to

---

## What NOT to Change

These are intentional design decisions from the original — do not "fix" them:

1. **`--cyan: #ff6d5a`** — The cyan CSS variable is intentionally coral. It's a branding quirk, not a bug.
2. **The `⊛` glyph** — Stargate nodes are prefixed with `⊛`. Preserve this exactly.
3. **Physics constants** — `REPEL = 8200`, `SPRING = 0.018`, `DAMPING = 0.74`, `REST = 210` are tuned values.
4. **Node size formula** — `nodeCardSize()` auto-sizing logic is intentional. Don't simplify it.
5. **`uid()` format** — `${prefix}_${random base36}${timestamp base36}` — preserve for DB compatibility.
6. **The `STORAGE_KEY = "bendscript-state-v1"`** — Keep for backward-compat with existing localStorage users during migration.
7. **Seed graph structure** — The initial demo graph (BendScript → What is Script Bending? → etc.) should remain identical for new users.
8. **Edit vs Preview mode** — The two-mode system is a core UX concept, not a temporary scaffold.

---

## Suggested Commit Sequence

```
chore: create AGENTS.md — agent discovery and MCP interface specification
feat: validate T2 topology-aware synthesis (Phase 0 — scripts/validate-t2.js with quantitative protocol)
feat: scaffold SvelteKit project with Tailwind
feat: extract engine modules from index.html (no logic changes, DOM-free core)
feat: create Svelte stores mirroring existing state shape
feat: rAF → store boundary guard (engineBridge assertions)
feat: GraphCanvas component with rAF loop
feat: port all HUD, Inspector, Composer, ContextMenu components
feat: Supabase schema migrations + RLS policies + composite indexes + cleanup triggers
feat: graph load/save via Supabase queries
feat: auth flow (email + Google OAuth) + workspace auto-creation
feat: Claude API Edge Function (ai-proxy) with prompt caching + tiered model routing (Haiku 4.5 / Sonnet 4.6)
feat: SvelteKit /api/ai proxy route with plan-aware rate limiting (Pro: 80/15/5 daily caps)
feat: AI generation logging to ai_generations table
feat: robust AI JSON parser — fence stripping, mixed text extraction, per-node validation
feat: wire AI synthesis into Composer — replace generateResponse() stub
feat: Tier 2 graph-aware AI synthesis
feat: graph export (JSON full state — data freedom from day one)
feat: public graph sharing via /share/[id] route (growth loop)
feat: read-only MCP endpoint — search_nodes + get_subgraph (v1.0 agent surface)
--- v1.0 LAUNCH LINE ---
feat: Markdown outline + Mermaid export
feat: Tier 3 topic-to-graph full subgraph generation (= KAG-Builder)
feat: prompt caching optimization + generation cap monitoring dashboard
feat: JSON import for backup/restore
--- v1.1 LINE ---
feat: realtime collaboration via Supabase broadcast
feat: pgvector semantic search + mutual indexing (node ↔ chunk cross-references)
feat: extract @bendscript/engine as standalone npm package (DOM-free core)
feat: KAG REST API — /api/kag/query endpoint with logical-form decomposition
feat: KAG MCP server — Streamable HTTP transport, 6 graph tools exposed (full write access)
feat: KAG traverse_path — multi-hop reasoning with edge-type filtering
feat: KAG build_from_text — document ingestion → entity/relation extraction → graph
feat: KAG API key management + usage metering + per-query billing
feat: quadtree spatial index (unlocks 500+ node graphs)
--- v2.0 LINE ---
feat: bendscript-agent CLI tool — local MCP server + SQLite graph + @bendscript/engine
feat: Tauri desktop app shell (if CLI validates local demand)
feat: KAG LangChain/LlamaIndex retriever
feat: mobile optimization — pinch zoom, two-finger pan, long-press menu
feat: enterprise SSO + audit logging
chore: Playwright e2e tests for core graph interactions (all 5 pointer modes)
chore: deploy to Cloudflare Pages + Supabase cloud
```

### Distribution Roadmap

BendScript's distribution evolves in phases, validated at each step:

```
v1.0  Cloud web app (SvelteKit + Cloudflare) — zero-install canvas builder
      └── Read-only MCP endpoint — agents can query graphs over HTTPS

v1.1  Full KAG MCP server — agents can query, traverse, and build
      └── @bendscript/engine npm package — portable graph core

v2.0  bendscript-agent CLI — local MCP server + SQLite
      └── Validates local demand before investing in desktop GUI

v2.x  Tauri desktop app (IF CLI adoption warrants it)
      └── SvelteKit frontend in Tauri shell + Rust graph backend
      └── Local MCP server for subagent integration (Claude Code, Cursor, etc.)
      └── Sync to cloud via Supabase for collaboration
```

> **Framework choice for desktop:** Tauri over Electron. Tauri apps are 3–5MB vs 150MB+, use 40% less RAM, and Rust backend is ideal for graph operations. SvelteKit frontend ports directly since Tauri accepts any web frontend. The architecture already supports this — the engine extraction in v1.1 is the prerequisite.

---

## Phase 7 — KAG Server (Post-Launch)

### 7.1 Overview

The KAG Server transforms BendScript from a canvas application into a knowledge infrastructure layer. It exposes workspace graphs as queryable knowledge bases via MCP and REST API, enabling any LLM system to perform grounded, multi-hop reasoning over user-built graph data.

This phase builds on Phase 3 (AI Integration) and the pgvector semantic search from the roadmap. It reuses the existing Supabase schema (nodes, edges, graph_planes) and adds query decomposition, graph traversal, and structured context assembly.

### 7.2 Repository Structure Additions

```
bendscript/
├── src/
│   ├── lib/
│   │   ├── kag/
│   │   │   ├── solver.js          # Query decomposition → logical forms → graph ops
│   │   │   ├── traversal.js       # Multi-hop graph traversal with edge-type filtering
│   │   │   ├── context.js         # Assemble subgraph + reasoning path as LLM context
│   │   │   ├── builder.js         # Text → entity/relation extraction → graph ingestion
│   │   │   └── search.js          # pgvector semantic search + mutual index lookup
│   │   └── mcp/
│   │       ├── server.js           # MCP server entry point (Streamable HTTP)
│   │       ├── tools.js            # Tool definitions (search_nodes, get_subgraph, etc.)
│   │       └── auth.js             # API key validation + workspace scoping
│   ├── routes/
│   │   └── api/
│   │       ├── kag/
│   │       │   ├── query/+server.js       # POST: natural language → graph reasoning
│   │       │   ├── search/+server.js      # POST: semantic node search
│   │       │   ├── subgraph/+server.js    # GET: node neighborhood to N hops
│   │       │   ├── traverse/+server.js    # POST: path between two concepts
│   │       │   ├── build/+server.js       # POST: ingest text → extract → graph
│   │       │   └── planes/+server.js      # GET: list planes in workspace
│   │       └── mcp/
│   │           └── +server.js             # MCP Streamable HTTP endpoint
```

### 7.3 KAG-Solver: Query Decomposition

The solver decomposes natural language questions into logical forms that map to graph operations. This replaces vector-only retrieval with structured reasoning.

```js
// src/lib/kag/solver.js
// Decomposes a natural language query into graph operations using Claude

export async function decomposeQuery(question, graphContext, model = 'claude-sonnet-4-6') {
  const response = await callClaude({
    model,
    system: KAG_SOLVER_SYSTEM,
    messages: [{ role: 'user', content: `Graph schema:\n${JSON.stringify(graphContext.schema)}\n\nQuestion: ${question}` }],
  });

  return parseLogicalForms(response);
  // Returns: [
  //   { op: 'search', query: 'authentication system', target: 'node' },
  //   { op: 'traverse', from: '$result_0', edge_kinds: ['causal', 'context'], depth: 3 },
  //   { op: 'filter', condition: 'node.text contains billing' },
  //   { op: 'assemble', format: 'reasoning_path' }
  // ]
}

const KAG_SOLVER_SYSTEM = `You are a KAG query planner for BendScript knowledge graphs.
Given a natural language question and a graph schema (node types, edge types, plane structure),
decompose the question into an ordered list of graph operations.

Available operations:
- search: semantic search for nodes matching a query
- traverse: follow edges from a node to depth N, optionally filtered by edge kind
- filter: narrow results by node type, text content, or edge properties
- aggregate: count, list, or summarize matching nodes
- assemble: format results as reasoning_path (ordered), subgraph (neighborhood), or summary (text)

Edge kinds: context, causal, temporal, associative, user
Node types: normal, stargate

Respond with JSON array of operations only. No preamble.`;
```

### 7.4 MCP Server

The MCP server uses the `@modelcontextprotocol/sdk` package with Streamable HTTP transport, hosted as a Supabase Edge Function or SvelteKit server route.

```js
// src/lib/mcp/tools.js
// Tool definitions for the BendScript KAG MCP server

export const kagTools = [
  {
    name: 'search_nodes',
    description: 'Semantic search across node text in a BendScript workspace. Returns matching nodes with relevance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        workspace_id: { type: 'string', description: 'Workspace UUID' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
      required: ['query', 'workspace_id'],
    },
  },
  {
    name: 'get_subgraph',
    description: 'Return a node and its neighborhood to N hops depth. Includes connected nodes, edges with types, and plane context.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Starting node ID' },
        depth: { type: 'number', description: 'Hops to traverse (default 2)', default: 2 },
        edge_kinds: { type: 'array', items: { type: 'string' }, description: 'Filter by edge types (e.g., ["causal", "temporal"])' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'traverse_path',
    description: 'Find reasoning paths between two concepts in the graph. Returns ordered paths with edge labels and types for multi-hop reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        from_query: { type: 'string', description: 'Starting concept (natural language)' },
        to_query: { type: 'string', description: 'Target concept (natural language)' },
        workspace_id: { type: 'string', description: 'Workspace UUID' },
        max_hops: { type: 'number', description: 'Maximum path length (default 5)', default: 5 },
      },
      required: ['from_query', 'to_query', 'workspace_id'],
    },
  },
  {
    name: 'query_graph',
    description: 'Ask a natural language question and get an answer grounded in the knowledge graph. Uses logical-form decomposition for multi-hop reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question' },
        workspace_id: { type: 'string', description: 'Workspace UUID' },
      },
      required: ['question', 'workspace_id'],
    },
  },
  {
    name: 'build_from_text',
    description: 'Ingest text and extract entities, relations, and events into the knowledge graph. Returns the new nodes and edges created.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to process (max 10,000 chars)' },
        workspace_id: { type: 'string', description: 'Workspace UUID' },
        plane_id: { type: 'string', description: 'Target plane ID (optional — defaults to root plane)' },
      },
      required: ['text', 'workspace_id'],
    },
  },
  {
    name: 'list_planes',
    description: 'List all graph planes (context levels) in a workspace with node/edge counts and hierarchy.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Workspace UUID' },
      },
      required: ['workspace_id'],
    },
  },
];
```

### 7.5 Database Additions

Add to migration `003_kag.sql`:

```sql
-- pgvector extension for semantic search
create extension if not exists vector;

-- Node embeddings for semantic search
alter table nodes add column embedding vector(1536);

-- Mutual index: link nodes to source text chunks
create table node_chunks (
  node_id text references nodes(id) on delete cascade,
  chunk_text text not null,
  chunk_source text, -- 'user_input' | 'document' | 'ai_generated'
  embedding vector(1536),
  created_at timestamptz default now(),
  primary key (node_id, created_at)
);

-- KAG API keys
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  key_hash text not null, -- bcrypt hash of the API key
  name text not null default 'Default',
  permissions text[] default '{"read","query"}', -- 'read' | 'query' | 'build'
  rate_limit integer default 100, -- queries per day
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked boolean default false
);

-- KAG query log (for usage billing and analytics)
create table kag_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  api_key_id uuid references api_keys(id),
  query_text text not null,
  tool_name text not null, -- 'search_nodes' | 'traverse_path' | etc.
  nodes_returned integer,
  hops_traversed integer,
  latency_ms integer,
  created_at timestamptz default now()
);

-- Indexes
create index on nodes using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on node_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on api_keys(workspace_id) where not revoked;
create index on kag_queries(workspace_id, created_at);
create index on kag_queries(api_key_id, created_at);

-- RLS for KAG tables
alter table node_chunks enable row level security;
alter table api_keys enable row level security;
alter table kag_queries enable row level security;

create policy "workspace members can read chunks" on node_chunks
  for select using (
    exists (select 1 from nodes n where n.id = node_id and is_workspace_member(n.workspace_id))
  );

create policy "workspace owners can manage api keys" on api_keys
  for all using (
    exists (select 1 from workspace_members
      where workspace_id = api_keys.workspace_id and user_id = auth.uid() and role in ('owner', 'admin'))
  );

create policy "workspace members can read query log" on kag_queries
  for select using (is_workspace_member(workspace_id));
```

### 7.6 Acceptance Criteria

- [ ] `search_nodes` returns semantically relevant results using pgvector cosine similarity
- [ ] `get_subgraph` returns correct neighborhood to specified depth with edge-type filtering
- [ ] `traverse_path` finds multi-hop paths between two concepts (verified on seed graph)
- [ ] `query_graph` decomposes a 2-hop question into logical forms and returns grounded answer
- [ ] `build_from_text` extracts entities and relations from a paragraph and adds nodes/edges
- [ ] MCP server responds to `tools/list` and `tools/call` via Streamable HTTP
- [ ] API key authentication works — invalid keys return 401
- [ ] Rate limiting enforced per API key plan
- [ ] Every query writes a row to `kag_queries` with latency and result stats
- [ ] RLS prevents cross-workspace data access via API
- [ ] MCP server is discoverable via `/.well-known/mcp` metadata endpoint

---

## Resources

- Existing prototype: `index.html` (read this first — it is the source of truth)
- Product spec: `README.md`
- Supabase SvelteKit guide: https://supabase.com/docs/guides/auth/auth-helpers/sveltekit
- Supabase Realtime broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Anthropic Claude API: https://docs.anthropic.com/en/api/messages
- SvelteKit docs: https://kit.svelte.dev/docs
- MCP Specification: https://modelcontextprotocol.io/specification/2025-11-25
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- OpenSPG/KAG: https://github.com/OpenSPG/KAG
- KAG paper: https://arxiv.org/abs/2409.13731
- KAG-Thinker: https://github.com/OpenSPG/KAG-Thinker

---

*This prompt was generated for BendScript v3.0 — March 2026*
*Source prototype: `index.html` (~3,500 lines) | Target: SvelteKit + Supabase + Claude API + KAG Server*
*v3.0 changes: KAG Server phase (MCP + REST API + pgvector + query decomposition), KAG API pricing, mutual indexing, build_from_text ingestion, updated roadmap and positioning*
