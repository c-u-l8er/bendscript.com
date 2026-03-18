# BendScript — Script Bending Through Graph Space

BendScript is an interactive graph-based prompt interface where conversation flows through interconnected node graphs, and each node acts as a stargate portal to deeper graph contexts.

## Core Concept: Script Bending

"Script bending" is the manipulation of conversational and computational flows through graph topology. Instead of linear chat, users interact with a living graph where:

- **Nodes** are contexts — prompts, responses, ideas, code, or sub-worlds
- **Edges** are relationships — causal, associative, temporal, or user-defined
- **Stargates** are special nodes that portal into entirely new graph spaces, creating fractal depth
- **Bending** is the act of reshaping the graph — forking paths, merging contexts, warping connections

## Landing Page = The Interface

The landing page IS the product. Visitors land directly into a graph-based prompt environment:

1. **Central prompt node** — a glowing input field at the center of the graph canvas
2. **Response nodes** — when you submit a prompt, a new node spawns and connects
3. **Stargate nodes** — clicking a stargate zooms into a new graph plane (like entering a portal)
4. **Navigation** — pan, zoom, and traverse the graph; breadcrumb trail shows your depth
5. **Ambient graph** — seed nodes float in the background showing BendScript concepts, clickable to explore

## Visual Language

- Dark void background with deep purple/blue radial gradients
- Nodes are glowing circles with neon borders (cyan, magenta, green)
- Stargate nodes have a spinning ring animation (like an event horizon)
- Edges are animated particle streams flowing between nodes
- The graph breathes — subtle pulsing, orbital motion, depth-of-field blur on distant nodes
- When entering a stargate: zoom + warp transition into the new graph plane

## Interaction Model

- **Type in a node** → spawns a child node with the response, connected by a glowing edge
- **Click a stargate** → transitions into a sub-graph (new context plane)
- **Drag nodes** → rearrange the graph layout (force-directed with user overrides)
- **Right-click** → context menu: fork, merge, pin, convert to stargate, delete
- **Breadcrumbs** → show graph depth path, click to navigate back up

## Seed Graph (Initial State)

The landing page starts with a pre-built graph that serves as both demo and documentation:

```
[BendScript] ──── [What is Script Bending?]
     │                      │
     ├── [⊛ Stargates]     [Bend the flow of scripts]
     │        │
     │   [⊛ Examples]
     │
     ├── [Graph Prompting]
     │        │
     │   [⊛ Try It]
     │
     └── [The Protocol]
              │
         [⊛ Deep Dive]
```

Nodes marked `⊛` are stargates that open into deeper graph contexts.

## Technical Implementation

- Single-page HTML/CSS/JS application (no build step, no framework)
- HTML5 Canvas for graph rendering with requestAnimationFrame loop
- Force-directed graph layout (custom physics simulation)
- All state is client-side (localStorage for persistence across visits)
- Responsive: works on desktop (mouse) and mobile (touch)
- Keeps the cybergoth aesthetic: monospace fonts, neon glow, dark void

## Positioning

BendScript is where **prompts become topology**. Instead of flat chat, you navigate a living graph of interconnected ideas, and every node is a doorway to somewhere deeper. Script bending = thinking in graphs.

## Deployment

- Static site on Cloudflare Pages (same as current)
- No backend required — the graph interface is entirely client-side
- Future: optional WebSocket connection for AI-powered node responses
