# BendScript Documentation

> **Script bending = thinking in graphs.**

Welcome to the documentation hub for **BendScript** — a multi-tenant, AI-powered
knowledge graph editor and KAG (Knowledge Augmented Generation) server.

BendScript serves two surfaces:

- **Visual canvas for humans** — build knowledge interactively on an HTML5 Canvas
  with force-directed physics, Stargates (fractal depth), and AI synthesis.
- **KAG API for agents** — query, traverse, and extend knowledge graphs via MCP
  tools and REST endpoints.

BendScript is the only non-Elixir product in the [&] Protocol ecosystem. Built
entirely on SvelteKit + TypeScript + Supabase.

---

## Documentation Map


```{toctree}
:maxdepth: 1
:caption: Homepages

[&] Ampersand Box <https://ampersandboxdesign.com>
Graphonomous <https://graphonomous.com>
BendScript <https://bendscript.com>
WebHost.Systems <https://webhost.systems>
```

```{toctree}
:maxdepth: 1
:caption: Root Docs

[&] Protocol Docs <https://docs.ampersandboxdesign.com>
Graphonomous Docs <https://docs.graphonomous.com>
BendScript Docs <https://docs.bendscript.com>
WebHost.Systems Docs <https://docs.webhost.systems>
```

```{toctree}
:maxdepth: 2
:caption: BendScript Docs

quickstart
architecture
local-supabase
faq
```

```{toctree}
:maxdepth: 1
:caption: Skills

skills/SKILLS
skills/01_CANVAS_ENGINE
skills/02_GRAPH_SYNTHESIS
skills/03_STARGATES_AND_PLANES
skills/04_KAG_SERVER
skills/05_COLLABORATION
skills/06_EXPORT_AND_INTEGRATION
skills/07_ANTI_PATTERNS
```

---

## Suggested Reading Order

If you are new to BendScript, follow this path:

1. **quickstart** — clone, install, create your first graph
2. **architecture** — understand how the pieces fit together
3. **skills/SKILLS** — learn the core loop and tool inventory
4. **skills/01_CANVAS_ENGINE** — master the visual canvas
5. **skills/02_GRAPH_SYNTHESIS** — use AI to build graphs
6. **skills/03_STARGATES_AND_PLANES** — navigate fractal depth
7. **skills/04_KAG_SERVER** — expose graphs to agents
8. **faq** — fill in remaining gaps

For agent developers integrating with BendScript, start at **skills/04_KAG_SERVER**
and **skills/SKILLS**.

---

## Core Concepts

### Nodes

The atomic unit of knowledge. A node holds text content, a type (`normal` or
`stargate`), a position on the canvas, and metadata. Nodes are contexts — prompts,
responses, ideas, code, or sub-worlds.

### Edges

Typed, directed relationships between nodes. Five built-in edge types:

| Type | Semantics |
|------|-----------|
| `context` | Frames or scopes another node |
| `causal` | One node causes or leads to another |
| `temporal` | Sequence in time |
| `associative` | Related by theme or similarity |
| `user-defined` | Custom relationship label |

Typed edges are what make KAG possible. Without them, you just have a blob.

### Planes

A plane is a canvas — a 2D space containing nodes and edges. Every graph has a
root plane. Planes can be nested via Stargates, creating a hierarchy.

### Stargates

Portal nodes that open into nested sub-graph planes. Clicking a Stargate triggers
a warp transition into a new plane with its own nodes, edges, and potentially
more Stargates. This creates **fractal depth** — knowledge has spatial dimension.

```
Root Plane
├── [Node A]
├── [⊛ Stargate X] ─── opens ──► Sub-Plane X
│                                  ├── [Node X1]
│                                  └── [⊛ Stargate Y] ──► Sub-Plane Y
├── [Node B]
└── [Node C]

Breadcrumbs: Root > Stargate X > Stargate Y
```

### KAG vs RAG

**RAG** (Retrieval-Augmented Generation) retrieves text chunks by vector
similarity. It is blind to the causal, temporal, and associative relationships
between those chunks.

**KAG** (Knowledge Augmented Generation) combines graph traversal + vector
search + logical forms. It follows typed edges across multiple hops, assembles
reasoning paths, and returns structured provenance — not just similar text.

KAG beats flat RAG for multi-hop reasoning because it preserves the *shape*
of knowledge, not just the *content*.

---

## Project Links

- **Spec:** `bendscript.com/project_spec/README.md`
- **Build prompts:** `bendscript.com/prompts/BUILD.md`
- **Agent interface:** `bendscript.com/AGENTS.md`
- **[&] Protocol ecosystem:** `AmpersandBoxDesign/`
