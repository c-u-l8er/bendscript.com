# BendScript Quickstart

Zero to a working knowledge graph in minutes.

---

## Prerequisites

- **Node.js** 20+ and npm
- **Supabase CLI** (`npm install -g supabase`)
- **Docker** running (for local Supabase)

---

## 1. Clone and Install

```sh
git clone <repo-url>
cd bendscript.com
npm install
```

---

## 2. Start Local Supabase

BendScript uses Supabase for everything: database, auth, realtime, edge functions.

```sh
npm run supabase:start
```

This starts local Postgres, Auth, Realtime, Studio, and Inbucket (email testing).

Apply the schema and RLS migrations:

```sh
npm run supabase:db:reset
```

Get your local keys:

```sh
npm run supabase:status
```

---

## 3. Configure Environment

Create `.env.local` in the project root:

```env
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>
PUBLIC_AUTH_REDIRECT_ORIGIN=http://localhost:5173
```

For AI synthesis, add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 4. Start the Dev Server

```sh
npm run dev
```

Open your browser:

| Service | URL |
|---------|-----|
| App | `http://localhost:5173` |
| Supabase Studio | `http://localhost:54323` |
| Inbucket (email) | `http://localhost:54324` |

---

## 5. Create Your First Graph

1. **Sign up** — go to `/auth/login`, enter an email. In local dev, email
   confirmation is disabled so you are signed in immediately.
2. **Personal workspace** — a workspace is auto-created on first sign-in.
3. **New graph** — you land on an empty canvas. This is your root plane.

---

## 6. Add Nodes

- **Click the canvas** to create a node at that position.
- **Type text** into the node card that appears.
- **Drag nodes** to reposition them. The physics engine applies force-directed
  layout automatically.
- **Pin a node** to lock it in place (right-click or inspector toggle).

---

## 7. Create Edges

- **Drag from a node's edge handle** to another node to create a connection.
- **Choose the edge type** from the inspector: `causal`, `context`, `temporal`,
  `associative`, or a custom label.
- Edge types matter — they determine how KAG traverses your graph.

---

## 8. Use Stargates

Stargates create fractal depth — nested sub-graphs inside your graph.

1. **Create a Stargate** — select "Stargate" as the node type in the inspector.
2. **Click the Stargate** — you warp into a new, empty plane.
3. **Build inside** — add nodes and edges in the sub-plane.
4. **Navigate back** — use the breadcrumb trail at the top of the canvas.

Use Stargates to decompose complex topics, create detail layers, or organize
branches of thought.

---

## 9. Try AI Synthesis

Open the **Composer bar** (floating input at the bottom of the canvas).

- **Type a prompt** and press Enter — Tier 1 synthesis creates a user node and
  an AI response node, connected by a causal edge.
- **With nodes selected**, prompt again — Tier 2 synthesis uses your graph
  context to generate nodes that fit the existing topology.
- **Type a topic** and select "Generate subgraph" — Tier 3 synthesis creates
  an 8-12 node knowledge structure with typed edges.

AI synthesis requires an `ANTHROPIC_API_KEY` in your environment. Free tier
uses Haiku; paid tier uses Sonnet.

---

## 10. Export Your Graph

From the graph menu:

- **JSON** — full graph state (nodes, edges, planes, metadata). Re-importable.
- **Markdown** — flattened outline following edge hierarchy.
- **Mermaid** — diagram format compatible with GitHub, Notion, Obsidian.

---

## Next Steps

- Read [architecture.md](architecture.md) to understand the system design.
- Read [skills/SKILLS.md](skills/SKILLS.md) for the full tool inventory.
- Read [local-supabase.md](local-supabase.md) for detailed local dev workflow.
- Read [skills/04_KAG_SERVER.md](skills/04_KAG_SERVER.md) to connect agents.
