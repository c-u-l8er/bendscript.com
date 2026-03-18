# BendScript — Coding Agent Build Prompt
**Version:** 1.0 | **Date:** March 2026 | **Type:** Full Migration + Feature Build

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
AI:         Anthropic Claude API (claude-sonnet-4-5 via Edge Function proxy)
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
├── supabase/
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

## Phase 1 — Scaffold & Extract (Days 1–3)

### 1.1 Init SvelteKit

```bash
npm create svelte@latest bendscript
# Choose: Skeleton project, TypeScript: No (use JS), ESLint + Prettier: Yes
cd bendscript
npm install
npm install @supabase/supabase-js @supabase/auth-helpers-sveltekit
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
    const t = performance.now();
    const dt = Math.min(33, t - lastT);
    lastT = t;
    const plane = $activePlane;
    if (!plane) { rafId = requestAnimationFrame(tick); return; }
    const W = window.innerWidth;
    const H = window.innerHeight;
    simulate(plane, dt);
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, W, H, t);
    drawEdges(ctx, plane, W, H, t);
    drawNodes(ctx, plane, W, H, t);
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

create policy "workspace members can write nodes" on nodes
  for all using (is_workspace_member(workspace_id));

create policy "workspace members can read edges" on edges
  for select using (is_workspace_member(workspace_id));

create policy "workspace members can write edges" on edges
  for all using (is_workspace_member(workspace_id));
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

Create `supabase/functions/ai-proxy/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { prompt, graphContext, tier } = await req.json();

  const systemPrompt = tier === 3
    ? TOPIC_TO_GRAPH_SYSTEM
    : tier === 2
    ? GRAPH_AWARE_SYSTEM
    : CONTEXTUAL_RESPONSE_SYSTEM;

  const userMessage = tier >= 2
    ? `Current graph context:\n${JSON.stringify(graphContext, null, 2)}\n\nUser prompt: ${prompt}`
    : prompt;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return new Response(JSON.stringify({ content: msg.content }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

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
// This is the client-facing endpoint — it validates auth then calls the Edge Function

import { json, error } from '@sveltejs/kit';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '$env/static/private';

export async function POST({ request, locals }) {
  const session = await locals.getSession();
  if (!session) throw error(401, 'Unauthorized');

  const body = await request.json();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return json(data);
}
```

### 3.3 Graph Synthesis Client

```js
// src/lib/ai/graphSynthesis.js
// Replaces generateResponse() with real AI

export async function spawnPromptFlow(prompt, plane, currentTargetNode, tier = 1) {
  const graphContext = tier >= 2 ? {
    nodes: plane.nodes.map(n => ({ id: n.id, text: n.text, type: n.type })),
    edges: plane.edges.map(e => ({ a: e.a, b: e.b, label: e.props.label, kind: e.props.kind }))
  } : null;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, graphContext, tier }),
  });

  const data = await res.json();
  const text = data.content.find(b => b.type === 'text')?.text || '';

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  if (!parsed) return fallbackResponse(prompt);

  // Tier 1: single object → wrap in array for uniform handling
  const nodeSpecs = Array.isArray(parsed) ? parsed : [parsed];
  return nodeSpecs;
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

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script>
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase/client';
  import { onMount } from 'svelte';

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) goto('/auth/login');
  });
</script>

<slot />
```

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
- [ ] RLS: user cannot read graphs from another workspace

### Phase 3 (AI)
- [ ] Submitting a prompt spawns a user node + AI response node (Tier 1)
- [ ] AI response is real Claude output, not keyword stubs
- [ ] Edge label and kind from AI response are applied to the spawned edge
- [ ] Stargate nodes are spawned when AI sets `type: "stargate"`
- [ ] API key is NOT present in any client-side bundle (verify with `grep -r "sk-ant" .svelte-kit/`)
- [ ] `/api/ai` returns 401 for unauthenticated requests

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
feat: scaffold SvelteKit project with Tailwind
feat: extract engine modules from index.html (no logic changes)
feat: create Svelte stores mirroring existing state shape
feat: GraphCanvas component with rAF loop
feat: port all HUD, Inspector, Composer, ContextMenu components
feat: Supabase schema migrations + RLS policies
feat: graph load/save via Supabase queries
feat: auth flow (email + Google OAuth) + workspace auto-creation
feat: realtime collaboration via Supabase broadcast
feat: Claude API Edge Function (ai-proxy)
feat: SvelteKit /api/ai proxy route
feat: wire AI synthesis into Composer — replace generateResponse() stub
feat: Tier 2 graph-aware AI synthesis
feat: Tier 3 topic-to-graph full subgraph generation
feat: public graph sharing via /share/[id] route
chore: Playwright e2e tests for core graph interactions
chore: deploy to Cloudflare Pages + Supabase cloud
```

---

## Resources

- Existing prototype: `index.html` (read this first — it is the source of truth)
- Product spec: `README.md`
- Supabase SvelteKit guide: https://supabase.com/docs/guides/auth/auth-helpers/sveltekit
- Supabase Realtime broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Anthropic Claude API: https://docs.anthropic.com/en/api/messages
- SvelteKit docs: https://kit.svelte.dev/docs

---

*This prompt was generated for BendScript v2.0 — March 2026*
*Source prototype: `index.html` (~3,500 lines) | Target: SvelteKit + Supabase + Claude API*
