# BendScript — Codex Completion Prompt

**Version:** 1.1 | **Date:** March 23, 2026 | **Target:** ChatGPT-5.3 Codex
**Objective:** Complete the BendScript SvelteKit + Supabase application from its current state (frontend prototype with extracted engine) to a fully functional, deployable multi-tenant product with real AI graph synthesis.

> **NOTE (2026-03-28):** Supabase config, migrations, and edge functions have moved to the shared ecosystem at `ProjectAmp2/supabase/`. BendScript tables are in the `kag.*` schema. See `/supabase/ARCHITECTURE.md` for the full shared data layer spec. Use `.schema('kag')` in the Supabase JS client.

---

## Context: What You're Working On

BendScript is a **topology-aware knowledge graph editor** where:
- Nodes are contexts (ideas, prompts, responses)
- Edges are typed relationships (context, causal, temporal, associative, user)
- Stargates are portal nodes that open nested sub-graph planes (fractal depth)
- AI synthesis generates new nodes that understand the graph's existing topology (not just text)
- The κ (kappa) invariant measures graph cyclicity and routes inference accordingly

The frontend prototype is **fully working** — a force-directed graph canvas with physics, rendering, multi-plane navigation, topology analysis, interactive editing, and localStorage persistence. What's missing is the **entire backend** (Supabase), **real AI integration** (Claude API), **authentication**, **multi-tenancy**, **collaboration**, and the **MCP/REST API**.

---

## Stack

```
Frontend:   SvelteKit 2.5.27 + Svelte 5.0.0 (already scaffolded, builds successfully)
Backend:    Supabase (Postgres + Auth + Realtime + Edge Functions) — NOT YET SET UP
AI:         Anthropic Claude API (Haiku 4.5 for Free tier, Sonnet 4.6 for Paid) — STUB ONLY
Styling:    Custom CSS variables in app.css (935 lines) — NO Tailwind installed
Testing:    Vitest (unit) + Playwright (e2e) — NOT YET SET UP
Deploy:     Cloudflare Pages (frontend, adapter-static) + Supabase cloud (backend)
            wrangler.toml exists: name="bendscript-com", pages_build_output_dir="build"
```

**IMPORTANT: Tailwind CSS is NOT installed.** The BUILD.md spec mentions Tailwind but the actual project uses hand-written CSS in `src/app.css` (935 lines). You have two options:
1. **Continue with custom CSS** (recommended — it's working and complete)
2. **Add Tailwind** — `npm install -D tailwindcss @tailwindcss/vite` and migrate

The Codex prompt assumes Option 1 (custom CSS). Do NOT add Tailwind unless explicitly asked.

---

## What Already Exists (DO NOT REWRITE)

The following are **complete, working, and tuned**. Do not modify their logic, constants, or algorithms. Only add integration points (imports, event dispatches, API calls) where specified.

### Engine Modules (`src/lib/engine/`)

| File | LOC | Status | Contains |
|---|---|---|---|
| `prototypeRuntime.js` | 1,558 | ✅ Complete | Master runtime: wires all subsystems, state machine, frame loop, localStorage load/save |
| `input.js` | 1,071 | ✅ Complete | All pointer/keyboard/wheel handlers, context menu, composer, drag, resize, merge, connect, delete |
| `topology.js` | 564 | ✅ Complete | Tarjan SCC, κ routing, weakly connected components, edge risk assessment, plane analysis |
| `renderer.js` | 434 | ✅ Complete | Canvas 2D drawing: background grid, edges with arrows/labels/flow, nodes with cards/gradients/resize handles |
| `inspectors.js` | 514 | ✅ Complete | Node/edge inspector sync, text parsing, markdown preview, pin/type/strength/kind updates |
| `markdownOverlay.js` | 328 | ✅ Complete | Markdown modal controller, editor/preview tabs, DOMPurify sanitization |
| `graph.js` | 251 | ✅ Complete | Node/edge CRUD: addNode, addEdge, removeNode, mergeNodes, findNode, findEdge, plane creation |
| `physics.js` | 151 | ✅ Complete | Force simulation: REPEL=98000, SPRING=0.0095, DAMPING=0.9, EDGE_LEN=290, CENTER_PULL=0.00042, MAX_SPEED=8.2, DRIFT_X/Y, FORCE_SCALE=0.06. Accepts dependency-injected findNode and edgeAnchorPair functions |
| `breadcrumbs.js` | 115 | ✅ Complete | Plane navigation breadcrumb rendering and click handlers |
| `heroController.js` | 110 | ✅ Complete | Hero → Canvas transition controller with scroll snap |
| `persistence.js` | 48 | ✅ Complete | localStorage load/save with debounced saveSoon() |
| `camera.js` | 33 | ✅ Complete | World ↔ screen coordinate transforms (projectToScreen, screenToWorld) |
| `hittest.js` | 24 | ✅ Complete | Hit testing: nodeAtPoint, edgeAtPoint, isPointOnNodeResizeHandle |
| `utils.js` | 21 | ✅ Complete | uid(), clamp(), rand(), dist(), trimText() |

### Svelte Components (`src/components/`)

| Component | Status | Contains |
|---|---|---|
| `canvas/GraphCanvas.svelte` | ✅ Complete | Canvas mount, rAF lifecycle, prototypeRuntime initialization |
| `canvas/Composer.svelte` | ✅ Complete | Floating prompt bar (draggable) |
| `canvas/NodeInspector.svelte` | ✅ Complete | Right panel: node text/type/pin editing |
| `canvas/EdgeInspector.svelte` | ✅ Complete | Right panel: edge label/kind/strength editing |
| `canvas/ContextMenu.svelte` | ✅ Complete | Right-click: fork/merge/pin/stargate/connect/delete |
| `canvas/Breadcrumbs.svelte` | ✅ Complete | Plane navigation trail |
| `canvas/HUD.svelte` | ✅ Complete | Top bar: brand + stats pills + mode toggle |
| `canvas/WarpOverlay.svelte` | ✅ Complete | Stargate transition flash animation |
| `canvas/Hint.svelte` | ✅ Complete | Contextual help text footer |
| `canvas/Legend.svelte` | ✅ Complete | Edge kind color reference |
| `canvas/MarkdownModal.svelte` | ✅ Complete | Full-screen markdown editor with preview |
| `hero/HeroSection.svelte` | ✅ Complete | Marketing hero section above fold |

### Stores (`src/lib/stores/`)

| Store | Status | Contains |
|---|---|---|
| `graphStore.js` | ✅ Complete | `state`, `planes`, `activePlaneId`, `rootPlaneId`, `activePlane` (derived) |
| `uiStore.js` | ✅ Complete | `selectedNodeId`, `selectedEdgeId`, `editMode`, `composerPos`, `mergeSourceNodeId`, `contextMenuState`, `hintText`, markdown modal state |
| `engineBridge.js` | ✅ Complete | Event bus: on(), dispatch(), rAF boundary guard (markRAFStart/End, assertNotInRAF) |

### Other Complete Files

| File | Status | Notes |
|---|---|---|
| `src/routes/+page.svelte` | ✅ 92 lines | Landing page: imports HeroSection + all canvas components, initializes heroController |
| `src/routes/+layout.svelte` | ✅ 5 lines | Imports app.css, renders slot |
| `src/routes/+layout.js` | ✅ 1 line | `export const prerender = true` for static generation |
| `src/app.css` | ✅ 935 lines | Complete design system: CSS variables, hero, canvas, HUD, inspectors, modals, responsive |
| `src/app.html` | ✅ 11 lines | Standard SvelteKit HTML template |
| `src/lib/markdown.js` | ✅ 26 lines | marked + DOMPurify wrapper |
| `AGENTS.md` | ✅ 110 lines | MCP agent interface spec (6 tools, 5 edge types, rate limits) |
| `README.md` | ✅ 600 lines | Full product spec with pricing, competitive positioning, roadmap |
| `package.json` | ✅ | name: "bendscript-web", deps: marked, dompurify |
| `svelte.config.js` | ✅ | adapter-static, vitePreprocess |
| `vite.config.js` | ✅ | SvelteKit plugin only |
| `wrangler.toml` | ✅ | name="bendscript-com", Cloudflare Pages config |
| `jsconfig.json` | ✅ | Extends .svelte-kit/tsconfig.json, allowJs: true |
| `build/` | ✅ | Pre-built static output (index.html + _app/ chunks) |

### What Does NOT Exist Yet

These directories/files are referenced in BUILD.md but have NOT been created:

| Missing | Status |
|---|---|
| `supabase/` directory | ❌ Does not exist — no migrations, no Edge Functions |
| `tests/` directory | ❌ Does not exist — zero tests |
| `.env` or `.env.example` | ❌ Does not exist |
| `src/hooks.server.js` | ❌ Does not exist |
| `src/lib/supabase/` | ❌ Does not exist — no client, queries, or realtime modules |
| `src/lib/ai/` | ❌ Does not exist — no AI client, prompts, or graphSynthesis |
| `src/lib/stores/workspaceStore.js` | ❌ Does not exist |
| `src/routes/(app)/` | ❌ Does not exist — no dashboard, graph/[id], or auth routes |
| `src/routes/auth/` | ❌ Does not exist |
| `src/routes/share/` | ❌ Does not exist |
| `src/routes/api/` | ❌ Does not exist |
| `src/components/workspace/` | ❌ Does not exist |
| `src/components/ui/` | ❌ Does not exist |
| `src/lib/export.js` | ❌ Does not exist |

### Stub Components (DOM placeholders only, logic lives in engine modules)

| Component | Status | Notes |
|---|---|---|
| `canvas/Breadcrumbs.svelte` | ⚠️ 1 line | Just `<div id="breadcrumbs"></div>` — the real logic is in `engine/breadcrumbs.js` which manipulates this DOM element directly |
| `canvas/WarpOverlay.svelte` | ⚠️ 1 line | Just `<div id="warp"></div>` — the real logic is in `prototypeRuntime.js` which adds/removes CSS class |

---

## Current Architecture: How the Prototype Works

**IMPORTANT:** The current app runs as a **monolithic prototype runtime**, NOT as a proper SvelteKit app. Understanding this is critical:

1. `prototypeRuntime.js` (1,558 lines) is the master controller. On mount, `GraphCanvas.svelte` calls `initPrototypeRuntime()` which:
   - Loads state from localStorage
   - Creates the seed graph if empty
   - Initializes all DOM controllers (inspectors, breadcrumbs, markdown overlay)
   - Calls `setupInputHandlers()` from `input.js`
   - Starts the rAF render loop
   - Provides `generateResponse()` as a dependency-injected keyword stub

2. **There are TWO copies of `spawnPromptFlow()`:**
   - One in `prototypeRuntime.js` (line 1008) — the "inner" version
   - One in `input.js` (line 322) — the "outer" version that gets actually used
   - Both call `generateResponse()` which is a keyword stub (not real AI)
   - When wiring real AI, you need to replace the one in `input.js` since that's what handles composer form submission (line 365-368)

3. **The Svelte stores exist but are NOT the primary state management.** The engine modules mutate plain JS objects directly. The stores (`graphStore.js`, `uiStore.js`) are reactive wrappers that sync on discrete events via `engineBridge.js`. The rAF loop reads engine state directly — never through stores.

4. **All Svelte components are thin wrappers around DOM IDs.** The engine modules (`inspectors.js`, `breadcrumbs.js`, etc.) find DOM elements by ID and manipulate them directly. The Svelte components just provide the DOM structure.

### Migration Strategy for Backend Integration

When adding Supabase persistence, the integration points are:
- **Load:** Replace `loadState()` from localStorage → `loadGraph()` from Supabase (in the graph route's `+page.server.js`)
- **Save:** Hook into `engineBridge.js` events (`node:moved`, `node:text`, etc.) → call `syncNode()` / `syncEdge()` to Supabase
- **AI:** Replace the `generateResponse()` keyword stub → real Claude API call via `/api/ai` endpoint
- **Auth:** Wrap the `(app)/` routes with a server-side auth guard

The prototype runtime can coexist with Supabase — just add persistence as a layer on top, don't rip out the engine.

---

## Critical Architecture Rules

### 1. Canvas ↔ Store Boundary (NEVER VIOLATE)

The engine mutates plane objects directly inside the rAF loop. Svelte stores are NEVER updated from inside requestAnimationFrame. The `engineBridge.js` enforces this with `assertNotInRAF()`.

```
Store updates ONLY happen on:
  ✅ Node drag END (pointerup)
  ✅ Node text change (debounced 500ms)
  ✅ Node/edge add/delete
  ✅ Stargate plane change

Store updates NEVER happen on:
  ❌ Physics tick (every frame)
  ❌ Node position during drag
  ❌ Render loop
```

### 2. Physics Constants (NEVER MODIFY)

These are tuned and exported from `src/lib/engine/physics.js`. Do not change them:
```javascript
export const REPEL = 98000;
export const SPRING = 0.0095;
export const EDGE_LEN = 290;       // rest length for edge springs
export const CENTER_PULL = 0.00042;
export const DAMPING = 0.9;
export const MAX_SPEED = 8.2;
export const DRIFT_X = 0.0007;     // deterministic drift (not "Brownian noise")
export const DRIFT_Y = 0.0006;
export const DRIFT_FORCE = 0.03;
export const EPSILON = 0.001;
export const FORCE_SCALE = 0.06;
```

Note: The BUILD.md used different names (REST, BROWNIAN, MAX_VEL) — the ACTUAL code uses the names above. Always reference the real code, not the spec.

### 3. State Shape (PRESERVE EXACTLY)

```javascript
{
  version: 1,
  rootPlaneId: "plane_abc123",
  activePlaneId: "plane_abc123",
  planes: {
    "plane_abc123": {
      id, name, parentPlaneId, parentNodeId,
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
  }
}
```

### 4. Edge Types (5 fixed kinds)

- `context` — definitional or descriptive
- `causal` — A causes or leads to B (rendered with arrowheads)
- `temporal` — A happens before/after B (rendered with arrowheads)
- `associative` — A is related to B (loose)
- `user` — user-defined custom

### 5. Node Types (2 fixed types)

- `normal` — standard knowledge node
- `stargate` — portal to nested sub-graph plane (prefixed with ⊛, has spinning dual-arc animation)

---

## YOUR TASKS: Complete the Backend and Integrations

Execute these phases in order. Each phase builds on the previous. Do not skip ahead.

---

### PHASE 1: Supabase Setup & Database Schema

**Create the Supabase migration and wire the client.**

#### 1A. Create `supabase/migrations/001_schema.sql`

```sql
-- Workspaces (tenants)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Workspace membership
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- Graph planes
create table graph_planes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  graph_id uuid not null,
  name text not null default 'Graph Plane',
  parent_plane_id uuid references graph_planes(id) on delete cascade,
  parent_node_id text,
  is_root boolean default false,
  created_at timestamptz default now()
);

-- Nodes
create table nodes (
  id text primary key,
  plane_id uuid references graph_planes(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  text text not null default '',
  type text not null default 'normal',
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
  kind text default 'context',
  strength integer default 1 check (strength between 1 and 5),
  created_at timestamptz default now()
);

-- AI generation log
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  graph_id uuid not null,
  prompt text not null,
  model text not null,
  tier integer not null,
  tokens_used integer,
  nodes_spawned integer,
  created_at timestamptz default now()
);

-- API keys for MCP/REST access
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  key_hash text not null,
  key_prefix text not null,
  name text not null default 'Default',
  scopes text[] default '{"read"}',
  rate_limit integer default 5000,
  created_by uuid references auth.users(id),
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Graphs (metadata table linking planes to a named graph)
create table graphs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null default 'Untitled Graph',
  description text default '',
  is_public boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index on nodes(plane_id);
create index on edges(plane_id);
create index on graph_planes(workspace_id);
create index on graph_planes(graph_id);
create index on workspace_members(user_id);
create index on graphs(workspace_id);
create index on api_keys(workspace_id);
create index idx_ai_gen_rate on ai_generations(workspace_id, tier, created_at);

-- Auto-update trigger
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
create trigger nodes_updated_at before update on nodes
  for each row execute function update_updated_at();
create trigger graphs_updated_at before update on graphs
  for each row execute function update_updated_at();

-- Cleanup orphaned edges when node deleted
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

#### 1B. Create `supabase/migrations/002_rls.sql`

Enable RLS on all tables. Workspace members can read/write their workspace's data. Use a `is_workspace_member(ws_id uuid)` helper function. See the RLS policies in the existing `prompts/BUILD.md` (lines 609-679) — implement those exactly.

#### 1C. Create `src/lib/supabase/client.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

#### 1D. Create `src/lib/supabase/queries.js`

Implement these functions that bridge the database rows to the existing engine state shape:

- `loadGraph(graphId)` → returns full state object matching the preserved state shape
- `syncNode(node, workspaceId)` → upserts a node to DB (called on drag end, text change)
- `syncEdge(edge, planeId, workspaceId)` → upserts an edge
- `deleteNode(nodeId)` → deletes node (trigger handles orphan edges)
- `deleteEdge(edgeId)` → deletes edge
- `createGraph(workspaceId, name)` → creates graph + root plane, returns graph_id
- `listGraphs(workspaceId)` → lists all graphs in workspace
- `makeDebouncedTextSync(workspaceId, delay=500)` → debounced node text persistence

Use converter functions `dbNodeToEngine(row)` and `dbEdgeToEngine(row)` to map DB columns to the exact engine state shape (add vx/vy/fx/fy=0, random pulse, flowOffset, etc.).

#### 1E. Create `.env.example`

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

---

### PHASE 2: Authentication & Multi-Tenancy

#### 2A. Create `src/hooks.server.js`

Set up `@supabase/ssr` server client with cookie handling. Expose `locals.supabase`, `locals.safeGetSession`, and `locals.getSession`. See `prompts/BUILD.md` lines 1214-1253 for the exact implementation.

#### 2B. Create Auth Routes

- `src/routes/auth/login/+page.svelte` — Email + Google OAuth login form
- `src/routes/auth/callback/+page.server.js` — Exchange code for session, auto-create personal workspace for new users (see BUILD.md lines 1143-1181)

#### 2C. Create App Shell with Auth Guard

- `src/routes/(app)/+layout.server.js` — Server-side auth guard (redirect to login if no session)
- `src/routes/(app)/+layout.svelte` — App shell with sidebar navigation
- `src/routes/(app)/dashboard/+page.svelte` — Workspace dashboard: list graphs, create new graph, workspace settings

#### 2D. Create Graph Page Route

- `src/routes/(app)/graph/[id]/+page.server.js` — Load graph from Supabase via `loadGraph()`
- `src/routes/(app)/graph/[id]/+page.svelte` — Mount the existing `GraphCanvas.svelte` with data from server load

**Key integration point:** When the graph page loads, it hydrates the engine state from Supabase instead of localStorage. The engine bridge events (`node:moved`, `node:text`, etc.) now also trigger `syncNode()` / `syncEdge()` calls to persist to the database.

#### 2E. Create `src/lib/stores/workspaceStore.js` (replace stub)

```javascript
export const currentWorkspace = writable(null);
// Shape: { id, name, slug, plan }
export const currentRole = writable(null);
// Shape: 'owner' | 'admin' | 'member' | 'viewer'
export const workspaceMembers = writable([]);
```

---

### PHASE 3: AI Integration (Replace Placeholder)

This is the core differentiator. The existing `input.js` has a `generateResponse()` stub that returns keyword-based dummy responses. Replace it with real Claude API calls.

**CRITICAL NOTE ON ADAPTER-STATIC:** The current project uses `@sveltejs/adapter-static` which means there are NO server-side routes (`+server.js`, `+page.server.js` files won't work at build time). You MUST switch to a server-capable adapter before adding API routes and auth:

```bash
# Option A: Switch to Cloudflare adapter (recommended — already deploying to CF Pages)
npm install -D @sveltejs/adapter-cloudflare
# Then update svelte.config.js:
# import adapter from '@sveltejs/adapter-cloudflare';

# Option B: Switch to auto adapter
npm install -D @sveltejs/adapter-auto

# Option C: Switch to node adapter (if self-hosting)
npm install -D @sveltejs/adapter-node
```

Also remove `export const prerender = true` from `src/routes/+layout.js` (or set it per-route instead of globally), since API routes and auth callbacks cannot be prerendered.

**The marketing landing page (`/`) can still be prerendered** — just add `export const prerender = true` to `src/routes/(marketing)/+page.js` instead of the root layout.

#### 3A. Create `supabase/functions/ai-proxy/index.ts`

A Deno Edge Function that:
1. Receives prompt, graphContext, tier, userId, workspaceId, graphId, plan
2. Rate-limits based on plan tier (see limits table below)
3. Selects model: Free → `claude-haiku-4-5-20251001`, Paid → `claude-sonnet-4-6`
4. Uses prompt caching (`cache_control: { type: 'ephemeral' }`) on system prompts
5. Logs generation to `ai_generations` table
6. Returns AI response

**Rate limits per plan per day:**

| Plan | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| free | 20 | 5 | 2 | 0 |
| pro | 80 | 15 | 5 | 0 |
| teams | unlimited | unlimited | unlimited | 0 |
| business | unlimited | unlimited | unlimited | unlimited |

**System prompts for each tier:**

- **Tier 1 (Contextual):** Single-node response. Returns `{ text, type, edgeLabel, edgeKind }`. No graph context sent.
- **Tier 2 (Graph-aware):** Multi-node synthesis. Returns `[{ text, type, edgeTo, edgeLabel, edgeKind }]` (2-4 nodes). Full graph context (nodes + edges) sent as input. AI must connect to existing nodes by exact text match.
- **Tier 3 (Topic-to-graph):** Full subgraph generation. Returns 8-12 nodes forming a tree. First node is root (edgeTo: null). Used for "generate a graph about X" from scratch.

See `prompts/BUILD.md` lines 891-935 for exact system prompt text.

#### 3B. Create `src/routes/api/ai/+server.js`

SvelteKit API route that:
1. Validates auth via `locals.getSession()`
2. Resolves workspace membership and plan
3. Forwards to the Edge Function with service role key
4. Returns AI response or 429 on rate limit

See `prompts/BUILD.md` lines 939-986 for exact implementation.

#### 3C. Create `src/lib/ai/graphSynthesis.js`

Client-side module that replaces the `generateResponse()` stub:

- `spawnPromptFlow(prompt, plane, targetNode, tier, workspaceId, graphId)` → calls `/api/ai`, parses response, validates node specs, returns sanitized array
- `safeParseAIResponse(raw)` → robust JSON extraction (handles markdown fences, mixed text, partial responses)
- `validateNodeSpec(spec)` → sanitizes individual node (text max 280 chars, valid type, valid edgeKind)
- `fallbackResponse(prompt)` → returns a single context node if AI fails

See `prompts/BUILD.md` lines 991-1078 for exact implementation.

#### 3D. Create `src/lib/ai/prompts.js`

Export the system prompts as constants for use in both the Edge Function and validation scripts.

#### 3E. Wire AI into Input Handler

In `src/lib/engine/input.js`, find the `generateResponse()` stub (or equivalent composer submit handler) and replace with a call to `spawnPromptFlow()`. The flow:

1. User types in Composer bar and hits Enter
2. Create a "user" node with the prompt text
3. Call `spawnPromptFlow(prompt, activePlane, userNode, tier, workspaceId, graphId)`
4. For each returned node spec:
   - Create a new node via `addNode()` with the AI text
   - Create edge from user node (Tier 1) or from `edgeTo` match (Tier 2-3)
   - If `edgeTo` is specified, find the matching node by text and connect to it
5. Trigger store sync + DB persistence

---

### PHASE 4: Real-Time Collaboration

#### 4A. Create `src/lib/supabase/realtime.js`

Supabase Realtime broadcast channel for graph-level collaboration:

- `joinGraphRoom(graphId, onRemoteUpdate)` → subscribes to broadcast events
- `broadcastNodeMove(nodeId, x, y)` → send on drag END only (not every frame)
- `broadcastNodeText(nodeId, text)` → send on text change (debounced)
- `broadcastNodeAdd(node)` / `broadcastNodeDelete(nodeId)` / `broadcastEdgeAdd(edge)`
- `leaveGraphRoom()` → cleanup

Events: `node_move`, `node_text`, `node_add`, `node_delete`, `edge_add`, `edge_delete`

**Critical rule:** Broadcast node positions on `pointerup` (drag end), NEVER on every `pointermove`. The canvas runs at 60fps; Supabase Realtime has rate limits.

#### 4B. Wire into Engine Bridge

When remote updates arrive:
- `node_move` → update node.x, node.y in engine state (let physics settle)
- `node_text` → update node.text
- `node_add` → call `addNode()` with received data
- `node_delete` → call `removeNode()`
- `edge_add` → call `addEdge()`

---

### PHASE 5: Public Sharing & Export

#### 5A. Create `src/routes/share/[id]/+page.svelte`

Public read-only graph view:
- Load graph by ID (check `graphs.is_public = true`)
- Mount GraphCanvas in preview mode (no editing, no auth required)
- Show graph name and description
- "Fork to my workspace" CTA for logged-in users

#### 5B. Add Export Functions

In `src/lib/engine/graph.js` or a new `src/lib/export.js`:

- `exportJSON(state)` → full state object as downloadable JSON
- `exportMarkdown(plane)` → flatten plane to markdown outline (headings = nodes, bullets = edges)
- `exportMermaid(plane)` → Mermaid graph syntax (nodes and edges)

Wire export buttons into the HUD or a settings menu.

---

### PHASE 6: MCP Server & REST API

#### 6A. Create REST API Routes

Under `src/routes/api/kag/`:

- `POST /api/kag/search` → `search_nodes({ query, workspace_id, limit? })` — semantic search across node text (use PostgreSQL full-text search initially; upgrade to pgvector in v1.1)
- `POST /api/kag/subgraph` → `get_subgraph({ node_id, depth?, edge_kinds? })` — BFS/DFS traversal returning node neighborhood
- `POST /api/kag/traverse` → `traverse_path({ from_query, to_query, workspace_id, max_hops? })` — find paths between concepts
- `POST /api/kag/query` → `query_graph({ question, workspace_id })` — NL question → graph traversal (uses Claude to convert question to graph operations)
- `POST /api/kag/build` → `build_from_text({ text, workspace_id, schema? })` — extract entities/relations from text, add to graph
- `GET /api/kag/planes` → `list_planes({ workspace_id })` — list all planes with node counts

**Authentication:** All KAG endpoints require an API key passed as `Authorization: Bearer bsk_...` header. Validate against `api_keys` table, check scopes, enforce rate limits.

#### 6B. Create API Key Management

In the dashboard (`src/routes/(app)/dashboard/`):
- Settings page with API key management
- Create key → generate `bsk_` prefixed key, store hash in DB, return full key once
- Revoke key → delete from DB
- Show key prefix + creation date + last used

#### 6C. MCP Server (Streamable HTTP)

Create an MCP-compatible endpoint at `POST /api/mcp` that:
- Accepts JSON-RPC 2.0 messages per the MCP spec
- Exposes the 6 tools from AGENTS.md as MCP tools
- Handles `initialize`, `tools/list`, `tools/call` methods
- Uses the same underlying query functions as the REST API
- Returns results in MCP-compliant format

This can be a SvelteKit server route or a standalone Supabase Edge Function.

---

### PHASE 7: Testing

#### 7A. Unit Tests (`tests/unit/engine/`)

Test the existing engine modules:

- `physics.test.js` — force simulation produces expected node positions
- `graph.test.js` — addNode/addEdge/removeNode/mergeNodes CRUD operations
- `topology.test.js` — Tarjan SCC finds correct components, κ computes correctly, risk assessment works
- `hittest.test.js` — nodeAtPoint/edgeAtPoint hit detection
- `camera.test.js` — coordinate transforms are invertible

#### 7B. Integration Tests

- `ai.test.js` — graphSynthesis.js parses valid/invalid/malformed AI responses correctly
- `queries.test.js` — Supabase query helpers produce correct state shape

#### 7C. E2E Tests (`tests/e2e/`)

- `graph.spec.js` — Create graph, add nodes, drag nodes, create edges, enter stargate, navigate breadcrumbs, export
- `auth.spec.js` — Login, create workspace, navigate to dashboard
- `ai.spec.js` — Submit prompt in composer, verify AI response nodes appear on canvas

---

### PHASE 8: Deploy

#### 8A. Cloudflare Pages

```bash
# Build
npm run build

# Deploy (wrangler.toml already exists)
npx wrangler pages deploy build/
```

Ensure `svelte.config.js` uses `adapter-static` (already configured).

#### 8B. Supabase

1. Create Supabase project
2. Run migrations: `supabase db push`
3. Deploy Edge Function: `supabase functions deploy ai-proxy`
4. Set secrets: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
5. Enable Google OAuth in Supabase Auth dashboard
6. Set redirect URLs for auth callback

#### 8C. Environment Variables

Set in Cloudflare Pages dashboard:
```
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (server-only)
```

---

## Pricing Tiers (Reference)

| Plan | Price | AI Limits | Features |
|---|---|---|---|
| Free | $0 | 20 T1/day, 5 T2/day, 2 T3/day | 1 workspace, 3 graphs, localStorage + cloud sync |
| Pro | $12/mo | 80 T1/day, 15 T2/day, 5 T3/day | Unlimited graphs, export (JSON/MD/Mermaid), priority AI |
| Teams | $22/seat/mo | Unlimited T1-T3 | Multi-user workspaces, real-time collaboration, shared graphs |
| Business | $18/seat/mo (10+ seats) | Unlimited all tiers | Admin controls, usage analytics, priority support |
| KAG API | $49/mo | 5,000 queries/mo | REST + MCP API access to graph data |
| KAG Teams | $99/mo | 20,000 queries/mo | Higher API limits + dedicated support |
| Enterprise | Custom | Custom | SSO, SLA, dedicated infrastructure |

---

## Design System Reference

```css
:root {
  --bg-0: #f4f6f8;
  --bg-1: #ffffff;
  --bg-2: #e0e4e8;
  --cyan: #ff6d5a;    /* Primary accent — coral/salmon, NOT cyan */
  --green: #10b981;
  --violet: #8b5cf6;
  --text: #222222;
  --muted: #666666;
  --warn: #f59e0b;
  --danger: #ef4444;
  --edge: #a3a8b0;
}
```

Font: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`

---

## Files You Need to CREATE (complete list)

### Backend & Infrastructure
- [ ] `supabase/migrations/001_schema.sql`
- [ ] `supabase/migrations/002_rls.sql`
- [ ] `supabase/functions/ai-proxy/index.ts`
- [ ] `src/hooks.server.js`
- [ ] `src/lib/supabase/client.js`
- [ ] `src/lib/supabase/queries.js`
- [ ] `src/lib/supabase/realtime.js`
- [ ] `.env.example`

### AI Integration
- [ ] `src/routes/api/ai/+server.js`
- [ ] `src/lib/ai/client.js`
- [ ] `src/lib/ai/prompts.js`
- [ ] `src/lib/ai/graphSynthesis.js`

### Auth & Routing
- [ ] `src/routes/auth/login/+page.svelte`
- [ ] `src/routes/auth/callback/+page.server.js`
- [ ] `src/routes/(app)/+layout.server.js`
- [ ] `src/routes/(app)/+layout.svelte`
- [ ] `src/routes/(app)/dashboard/+page.svelte`
- [ ] `src/routes/(app)/graph/[id]/+page.svelte`
- [ ] `src/routes/(app)/graph/[id]/+page.server.js`
- [ ] `src/routes/share/[id]/+page.svelte`
- [ ] `src/routes/share/[id]/+page.server.js`

### API & MCP
- [ ] `src/routes/api/kag/search/+server.js`
- [ ] `src/routes/api/kag/subgraph/+server.js`
- [ ] `src/routes/api/kag/traverse/+server.js`
- [ ] `src/routes/api/kag/query/+server.js`
- [ ] `src/routes/api/kag/build/+server.js`
- [ ] `src/routes/api/kag/planes/+server.js`
- [ ] `src/routes/api/mcp/+server.js`

### Export & Utilities
- [ ] `src/lib/export.js`

### Testing
- [ ] `tests/unit/engine/physics.test.js`
- [ ] `tests/unit/engine/graph.test.js`
- [ ] `tests/unit/engine/topology.test.js`
- [ ] `tests/unit/engine/hittest.test.js`
- [ ] `tests/unit/engine/camera.test.js`
- [ ] `tests/unit/ai/graphSynthesis.test.js`
- [ ] `tests/e2e/graph.spec.js`
- [ ] `tests/e2e/auth.spec.js`

### Workspace UI Components
- [ ] `src/components/workspace/WorkspaceNav.svelte`
- [ ] `src/components/workspace/GraphCard.svelte`
- [ ] `src/components/workspace/MemberList.svelte`
- [ ] `src/components/ui/Pill.svelte`
- [ ] `src/components/ui/Button.svelte`
- [ ] `src/components/ui/Modal.svelte`

---

## Files You Need to MODIFY (integration points only)

- [ ] `src/lib/engine/input.js` — Replace `generateResponse()` stub with `spawnPromptFlow()` import
- [ ] `src/lib/stores/graphStore.js` — Add graph loading from Supabase (hydrate from server data vs localStorage)
- [ ] `src/routes/+page.svelte` — Add login/signup CTAs, link to dashboard for authenticated users
- [ ] `package.json` — Install new dependencies and add scripts:
  ```bash
  # Production dependencies (add these)
  npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk

  # Dev dependencies (add these)
  npm install -D vitest @playwright/test
  ```
  Add scripts:
  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
  ```
  **Current deps (already installed):** marked ^12.0.2, dompurify ^3.1.7
  **Current devDeps (already installed):** @sveltejs/adapter-static ^3.0.3, @sveltejs/kit ^2.5.27, svelte ^5.0.0, vite ^5.4.2

---

## Validation Gates

Before considering each phase complete:

1. **Phase 1:** Run `supabase db push` — schema applies without errors
2. **Phase 2:** Login → auto-create workspace → see dashboard → create graph → canvas loads with empty graph
3. **Phase 3:** Type in composer → AI response nodes appear on canvas with correct edge types. Test all 3 tiers. Rate limiting returns 429 at threshold.
4. **Phase 4:** Open same graph in 2 browser tabs → drag node in tab A → see it move in tab B (on pointer release)
5. **Phase 5:** Mark graph as public → open `/share/[id]` in incognito → graph renders in preview mode
6. **Phase 6:** Create API key → `curl -H "Authorization: Bearer bsk_..." POST /api/kag/search` → returns matching nodes
7. **Phase 7:** `npm test` passes. `npx playwright test` passes.
8. **Phase 8:** `https://bendscript.com` loads, login works, AI works, collaboration works

---

## What NOT to Do

- ❌ Do not rewrite engine modules — they are complete and tuned
- ❌ Do not change physics constants (REPEL, SPRING, EDGE_LEN, etc. in `physics.js`)
- ❌ Do not modify the state shape (add fields if needed, never remove/rename existing ones)
- ❌ Do not add SSR — this is a static SvelteKit app (adapter-static, `prerender = true`)
- ❌ Do not use `@supabase/auth-helpers-sveltekit` — it's deprecated. Use `@supabase/ssr`
- ❌ Do not call Svelte store `.update()` or `.set()` from inside the rAF loop — `engineBridge.js` has `assertNotInRAF()` guard
- ❌ Do not send node positions on every pointermove via Realtime — only on pointerup (drag end)
- ❌ Do not expose `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the client
- ❌ Do not add Tailwind CSS — the project uses custom CSS in `app.css` (935 lines, already complete)
- ❌ Do not add TypeScript — this project uses JavaScript (`jsconfig.json` with `allowJs: true, checkJs: false`)
- ❌ Do not add component libraries (no shadcn, no skeleton, no flowbite)
- ❌ Do not break the DOM ID contract — engine modules find elements by ID (`#graph`, `#breadcrumbs`, `#warp`, `#composer`, `#ctx-menu`, etc.). These IDs must exist in the DOM when `prototypeRuntime.js` initializes
- ❌ Do not try to convert the engine to use Svelte reactivity — the engine is intentionally vanilla JS for portability. The stores are a sync layer on top, not a replacement

## Key Dependency Versions (as of March 2026)

```
@sveltejs/kit:               2.5.27
@sveltejs/adapter-static:    3.0.3
svelte:                      5.0.0
vite:                        5.4.2
marked:                      12.0.2
dompurify:                   3.1.7
```

## [&] Protocol Integration Notes

BendScript is part of the [&] Protocol ecosystem (Ampersand Box Design). Key connections:

- **κ topology** in `topology.js` is the JavaScript port of the κ invariant from the Graphonomous Elixir engine
- The MCP server tools (search_nodes, get_subgraph, traverse_path, query_graph, build_from_text, list_planes) should implement the `&memory.graph` capability contract from the [&] Protocol
- Edge types (context, causal, temporal, associative, user) are protocol-level type tokens
- Future integration: BendScript graphs can be queried by Graphonomous MCP for topology-aware deliberation
- The KAG (Knowledge Augmented Generation) API is BendScript's externally-facing product — it exposes the graph as a structured knowledge base for AI agents
