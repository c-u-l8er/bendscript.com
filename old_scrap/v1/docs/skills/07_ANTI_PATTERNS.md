# Skill 07 — Anti-Patterns

> **What this teaches:** Common mistakes when using BendScript and how to avoid
> them. These patterns reduce graph quality, degrade KAG performance, or waste
> resources.

---

## 1. Flat Graphs (No Typed Edges)

**Mistake:** Creating nodes and connecting them with generic "related" edges
(or no edges at all). The graph looks like a web of dots with no semantic
structure.

**Why it hurts:** KAG relies on edge types for multi-hop reasoning. If all
edges are untyped, the solver cannot distinguish causal chains from
associations. It degrades to bag-of-nodes similarity — no better than RAG.

**Fix:** Always set edge types deliberately.

| Question | Use Edge Type |
|----------|--------------|
| Does A cause B? | `causal` |
| Does A frame B? | `context` |
| Does A come before B? | `temporal` |
| Is A related to B by theme? | `associative` |
| Custom relationship? | `user-defined` with a descriptive label |

**Rule of thumb:** If you cannot name the relationship, the edge probably
should not exist.

---

## 2. Orphan Nodes

**Mistake:** Creating nodes that have no edges. They float disconnected on the
canvas.

**Why it hurts:** Orphan nodes are invisible to graph traversal. KAG's
`traverse_path` and `get_subgraph` will never find them. They only appear in
`search_nodes` via vector similarity — losing the structural advantage of KAG.

**Fix:** Every node should have at least one edge. When creating a node, always
connect it to the existing graph. Use Tier 4 (edge inference) to discover
connections you might have missed.

---

## 3. Too Many Nodes Per Plane

**Mistake:** Putting 100+ nodes on a single plane. The canvas becomes visually
overwhelming and the physics engine slows down.

**Why it hurts:** Users cannot find what they need visually. The force-directed
layout becomes chaotic with too many competing forces. Performance degrades
above ~500 nodes.

**Fix:** Use Stargates to decompose. A good rule of thumb:

| Plane Size | Action |
|-----------|--------|
| 5-20 nodes | Healthy — keep going |
| 20-50 nodes | Consider splitting subtopics into Stargates |
| 50+ nodes | Definitely decompose — create Stargates for clusters |

If a topic cluster has more than 10 nodes, it is a candidate for its own
sub-plane.

---

## 4. Ignoring Edge Types (All "related")

**Mistake:** Setting every edge to `associative` or a generic "related" label
because choosing a type feels like extra work.

**Why it hurts:** This is a special case of "flat graphs" that deserves its own
callout. When a KAG agent asks "what caused the outage?", the solver needs
`causal` edges to follow. If everything is "related", it returns the entire
neighborhood — noise, not signal.

**Fix:** Spend the 2 seconds to pick the right edge type. The five built-in
types cover most relationships. Use `user-defined` with a descriptive label
for anything else.

---

## 5. Overusing AI Tier 3

**Mistake:** Using Tier 3 (topic-to-graph) for every interaction. It generates
8-12 nodes per call — the graph grows fast and burns tokens.

**Why it hurts:**

- **Token cost:** ~4,000 input + ~4,000 output tokens per call.
- **Graph bloat:** Tier 3 generates many nodes that may not all be relevant.
  You end up pruning half of them manually.
- **Loss of intentionality:** Auto-generated graphs lack the human curation
  that makes knowledge graphs valuable.

**Fix:** Use the right tier for the situation.

| Situation | Recommended Tier |
|-----------|-----------------|
| Quick question | Tier 1 (~1,400 tokens total) |
| Extend existing graph | Tier 2 (~4,500 tokens total) |
| Bootstrap a new domain | Tier 3 (~8,000 tokens total) |
| Find missing connections | Tier 4 (~3,300 tokens total) |

Reserve Tier 3 for bootstrapping new knowledge domains. Use Tier 1-2 for
iterative building.

---

## 6. Not Exporting Regularly

**Mistake:** Building a large knowledge graph and never exporting it. The graph
exists only in BendScript's database.

**Why it hurts:** Data freedom requires action. If the service has an outage,
if you want to migrate, or if you want to version-control your knowledge, you
need exports.

**Fix:** Export JSON regularly. Treat it like backing up code.

- After major graph changes, export JSON.
- For documentation, export Markdown.
- For sharing, export Mermaid diagrams.
- Store exports in version control alongside related projects.

---

## 7. Deep Stargate Nesting Without Breadcrumbs

**Mistake:** Creating 5+ levels of Stargate nesting. Users (and agents) lose
track of where they are in the hierarchy.

**Why it hurts:** Navigation becomes confusing. The breadcrumb trail gets long.
Agents calling `list_planes` see a deep tree that is hard to reason about.

**Fix:** Limit nesting to 3-4 levels. If you need more depth, restructure:

```
Instead of:  Root > A > B > C > D > E
Prefer:      Root > A > {B, C}
             Root > D > E
```

Flatten sibling topics at the same level rather than nesting linearly.

---

## 8. Using BendScript as a Chat Interface

**Mistake:** Treating the Composer bar as a chatbot. Asking sequential questions
without building structure.

**Why it hurts:** You end up with a linear chain of prompt/response node pairs
— essentially a chat log rendered as a graph. This misses the entire point of
graph-based knowledge.

**Fix:** After each AI synthesis response, take a moment to:

1. Edit the generated node text (refine, add context).
2. Add edges to existing nodes (create cross-connections).
3. Set edge types (give the graph semantic structure).
4. Consider Stargates for subtopics (add depth).

The AI generates a starting point. Your curation is what makes it a
knowledge graph.

---

## Summary

| Anti-Pattern | Core Problem | Fix |
|-------------|-------------|-----|
| Flat graphs | No traversal semantics | Use typed edges |
| Orphan nodes | Invisible to KAG | Connect every node |
| Too many nodes/plane | Visual + performance chaos | Decompose with Stargates |
| All "related" edges | KAG cannot reason | Pick specific edge types |
| Tier 3 overuse | Token waste + graph bloat | Match tier to situation |
| No exports | No data freedom | Export JSON regularly |
| Deep nesting | Navigation confusion | Limit to 3-4 levels |
| Chat-as-graph | Linear chain, no structure | Curate after synthesis |
