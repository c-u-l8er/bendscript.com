# BendScript — User Stories

Canonical user-story catalog. Used for Playwright tests + Claude Design input.

**Scope:** SvelteKit + Supabase knowledge-graph editor ("script bending through graph space"). Canvas-based node/edge editor + inspector + KAG server integration.

**Unit-test surface covered:** `tests/**` (5 tests).

---

## Story 1 · Visit landing + see live graph canvas

- **Persona:** First-time visitor evaluating BendScript as a knowledge-graph editor
- **Goal:** Understand that this is an editable, interactive graph tool in the first screen
- **Prerequisite:** None; static landing
- **Steps:**
  1. Visit `/`
  2. Hero + canvas + HUD (`#statNodes`, `#statEdges`) all visible above the fold
  3. Canvas shows sample graph — nodes render, edges animate
  4. Stats pills update as graph animates
- **Success:** Canvas visible; stats non-zero; zero errors
- **Covers:** SvelteKit hydration, canvas init, force-directed layout — ~3 unit tests
- **UI status:** exists-today (`tests/e2e/smoke.spec.js` covers a subset)
- **Claude Design hook:** Already-good landing; possible refinement on CTAs

## Story 2 · Create + edit a node

- **Persona:** Knowledge worker sketching a concept map
- **Goal:** Click canvas → create node → type label → save
- **Prerequisite:** Landing loaded
- **Steps:**
  1. Right-click empty canvas → context menu
  2. Choose "New node" → node appears at cursor
  3. Click node → inspector opens on right
  4. Type label; select type; optional: add properties
  5. Node persists (local IndexedDB OR Supabase `kag.*`)
- **Success:** Node round-trips a reload
- **Covers:** Canvas hit-testing, node/edge CRUD, persistence layer
- **UI status:** partial (canvas exists; inspector + persistence planned)
- **Claude Design hook:** Context menu + node inspector panel

## Story 3 · Connect two nodes with an edge

- **Persona:** Knowledge worker linking two concepts
- **Goal:** Drag from node A to node B → edge appears → label it
- **Prerequisite:** ≥2 nodes exist
- **Steps:**
  1. Hover node A until anchor point visible
  2. Drag anchor → cursor shows rubber-band line
  3. Drop onto node B → edge created
  4. Inspector prompts for edge type (causal / supports / contradicts / related)
- **Success:** Edge visible; type colored distinctly
- **Covers:** Drag handler, edge creation, edge type enum — ~2 unit tests
- **UI status:** planned
- **Claude Design hook:** Drag-to-connect affordance with rubber-band visual + type picker

## Story 4 · Node-mode toggle switches rendering style

- **Persona:** Power user switching between detail views
- **Goal:** Toggle between name-only / full-info / minimap rendering
- **Prerequisite:** Graph populated
- **Steps:**
  1. Click `#nodeModeToggle` button
  2. Rendering style cycles: labels → compact → minimap → labels
  3. Stats pill updates to reflect current mode
- **Success:** Visual mode change persistent across reload
- **Covers:** mode state, render mode dispatch — ~2 unit tests (currently tested in smoke)
- **UI status:** exists-today (tested in `spa/bendscript.spec.ts`)
- **Claude Design hook:** Already implemented; no design work needed

## Story 5 · Export graph as Ampersand spec

- **Persona:** Spec author wanting to snapshot a KAG into `.ampersand.json`
- **Goal:** Export current graph as an [&] Protocol ampersand.json
- **Prerequisite:** Graph has nodes + edges
- **Steps:**
  1. Click "Export" in header
  2. Choose format: `.ampersand.json` / `.kag.json` / `.dot`
  3. File downloads
- **Success:** Exported file validates against `@ampersand-protocol/validate`
- **Covers:** Exporter, schema conformance, format adapters
- **UI status:** planned
- **Claude Design hook:** Export dialog with format picker + preview pane

---

**Tests to implement first:** Stories 1 + 4 are covered by existing smoke/Playwright test. Story 2 (create node) is the highest-value next — opens the editor dimension.

**Note:** See `bendscript.com/docs/spec/README.md` (866 lines) for the full KAG editor spec.
