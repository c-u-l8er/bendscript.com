# Skill 02 — Graph Synthesis

> **What this teaches:** How BendScript uses AI to build graphs — the four
> synthesis tiers, model routing, prompt caching, and when to use each tier.

---

## Overview

BendScript does not use AI as a chat sidebar. AI generates **graph structure**
— nodes and typed edges that fit the existing topology. The model receives the
graph's shape as context and returns structured JSON that the engine inserts
directly into the canvas.

The Composer bar (floating input at the bottom of the canvas) is the entry
point for all AI synthesis.

---

## Tier 1 — Contextual Response

**Input:** User prompt text.
**Output:** 2 nodes — one for the user prompt, one for the AI response — connected by a `causal` edge.

This is the simplest tier. The model does not see the existing graph. It
produces a prompt/response pair as graph nodes.

```
Token budget: ~800 input / ~600 output
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid)
```

**When to use:** Quick Q&A, brainstorming seeds, starting a new topic on
the canvas.

---

## Tier 2 — Graph-Aware Synthesis

**Input:** User prompt + serialized graph context (current plane's nodes and
edges with types, labels, and positions).
**Output:** 2-4 new nodes with typed edges that semantically fit the existing
graph structure.

This is the core differentiator. The model sees the graph's topology — what
nodes exist, how they connect, what types of relationships are present — and
generates additions that extend the structure coherently.

```
Token budget: ~3,000 input / ~1,500 output
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid)
```

**When to use:** Extending an existing graph, asking follow-up questions in
context, adding detail to a topic that already has structure.

### Graph Context Format

The graph context sent to the model includes:

- All nodes on the current plane (id, text summary, type)
- All edges on the current plane (source, target, type, label)
- Currently selected node(s) and their immediate neighbors
- Plane name and position in the Stargate hierarchy

---

## Tier 3 — Topic-to-Graph

**Input:** A topic string (e.g., "Kubernetes networking").
**Output:** A full subgraph of 8-12 nodes with typed edges, optional Stargate
suggestions, and a depth hierarchy.

The graph IS the answer. Instead of a paragraph of text, the model returns a
knowledge structure that the user can explore, edit, and extend.

```
Token budget: ~4,000 input / ~4,000 output
Model: Haiku 4.5 (Free), Sonnet 4.6 (Paid)
```

**When to use:** Bootstrapping a new knowledge domain, creating a study map,
generating an architecture overview.

### Output Structure

The model returns JSON with:

```json
{
  "nodes": [
    { "text": "...", "type": "normal|stargate" }
  ],
  "edges": [
    { "source": 0, "target": 1, "type": "causal", "label": "causes" }
  ]
}
```

The engine inserts these into the current plane, runs physics to layout the
new nodes, and creates all edges.

---

## Tier 4 — Edge Inference

**Input:** A newly created node + the existing graph topology.
**Output:** Suggested connections to existing nodes, with edge types and
rationale.

This tier runs automatically (on paid plans) when a new node is created. It
analyzes the new node's content against the existing graph and suggests which
nodes it should connect to and why.

```
Token budget: ~2,500 input / ~800 output
Model: Sonnet 4.6 (Paid only)
```

**When to use:** After manual node creation, to discover connections you might
have missed. Paid plans only.

---

## Model Routing

| Plan | Tiers 1-3 | Tier 4 |
|------|-----------|--------|
| Free | Haiku 4.5 | not available |
| Paid | Sonnet 4.6 | Sonnet 4.6 |

All AI calls route through Supabase Edge Functions. The Anthropic API key is
stored server-side and never exposed to the client.

---

## Prompt Caching Strategy

For Tiers 2 and 3, the graph context can be large (dozens of nodes). BendScript
uses Anthropic's prompt caching to avoid resending the same graph context on
repeated synthesis calls within the same session.

The caching strategy:

1. Graph context is serialized as a stable JSON representation.
2. The context block is marked as cacheable in the API request.
3. Subsequent requests with the same graph state hit the cache.
4. When the graph changes (node added/removed), the cache is invalidated.

This reduces latency and cost for iterative graph building.

---

## Choosing the Right Tier

| Situation | Recommended Tier |
|-----------|-----------------|
| Quick question, no existing context | Tier 1 |
| Extending a graph with related content | Tier 2 |
| Bootstrapping a new knowledge domain | Tier 3 |
| Discovering missing connections | Tier 4 |
| Cost-sensitive, many queries | Tier 1 (lowest token usage) |
| Quality-sensitive, fewer queries | Tier 2-3 with Sonnet |

**Rule of thumb:** Start with Tier 1 for seeds, switch to Tier 2 as the graph
grows, use Tier 3 to bootstrap new branches, and let Tier 4 find connections
you missed.
