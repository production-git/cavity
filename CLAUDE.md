# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the app
Phase 2 uses ES6 modules (`type="module"`), which require HTTP — Chrome blocks module
loading from `file://` due to CORS policy. Start a local server first:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8080 --directory app
# then open: http://localhost:8080/

# Node (if you prefer)
npx serve app
# then open the printed URL
```

Safari and Firefox can still open `app/index.html` directly via `file://`.

## Architecture

The app is a single-page, zero-dependency browser tool for editing 3D MOF crystal structures. It uses ES6 modules loaded via `<script type="module" src="index.js">`.

```
app/
  index.html   — UI layout (canvas, modals, control panels)
  index.js     — Entry point: init renderer + UI, animation loop
  state.js     — All data state: atoms[], bonds[], undo/redo, ELEMENTS, CIF/JSON I/O, cavity
  renderer.js  — Canvas rendering, 3D projection, hit testing
  ui.js        — Event handlers (mouse/keyboard/touch), modal management, UI update fns
  math3d.js    — Pure vector math and geometry (no side-effects, no imports)
  styles.css   — CSS variables + component styles
  app.js       — Legacy monolithic script (not loaded; kept for reference only)
```

**Module dependency direction (strict, no cycles):**
```
math3d.js  ←  state.js  ←  renderer.js  ←  ui.js  ←  index.js
```

### Key entry points

**[state.js](app/state.js)** — single source of truth
- **`getCavitySpheres()`** (line 290): computes cavity sphere positions and radii
- **`parseCIF()`** (line 621): in-browser CIF → structure pipeline
- **`serializeStructure()`** / **`loadStructureFromJSON()`** (lines 705/717): JSON I/O
- **`saveState()` / `restoreState()`** (lines 186/198): 50-entry undo/redo stack

**[renderer.js](app/renderer.js)** — pure drawing, no state mutation
- **`draw()`** (line 124): full scene redraw
- **`hitTest()` / `hitBondTest()` / `hitCavityTest()`** (lines 57/70/106): pick-ray intersection

**[ui.js](app/ui.js)** — all DOM interaction
- **`init()`** (line 31): binds all canvas and DOM events

**[math3d.js](app/math3d.js)** — stateless geometry primitives
- Vector ops: `v3sub`, `v3add`, `v3scale`, `v3cross`, `v3dot`, `v3norm`, `v3dist`
- `rotatePoint()` (line 17), `convexHull3DFaces()` (line 110)

For full architecture detail see [Docs/application_design.md](Docs/application_design.md).

### JSON model format
```json
{
  "version": 9,
  "atoms": [{ "x": 0, "y": 0, "z": 0, "t": "Cu", "role": "Cu", "plane": "cu-o", "id": 0 }],
  "bonds": [{ "a": 0, "b": 1, "dashed": false }]
}
```
- Coordinates: Cartesian, centred at origin, max radius ≤ 10
- `t` = element symbol; `role` = semantic role; `plane` = highlight group (`cu-o`, `carb`, `ring`, `""`)

## Documentation

```
Docs/
  strategy.md               — Product strategy: positioning, bets, tradeoffs
  roadmap.md                — Phased delivery plan (Phase 0–4) with exit criteria
  application_design.md     — Architecture, modules, data model, rendering pipeline
  progress.md               — Version history and progress log
  phase-2/
    prd.md                  — Phase 2 product requirements (WebGL, perf, UI redesign)
    design.md               — Phase 2 technical design
  feature_plans/
    planned-features.md     — Master feature tracking (all planned + backlog features)
    animation-export.md     — Video/GIF animation export feature plan
    doping-simulation.md    — Metal doping simulation feature plan
    dft-integration.md      — DFT results visualization feature plan
    cif-export.md           — CIF export feature plan
    pore-characterization.md — Geometric pore characterization feature plan
    structural-analysis-panel.md — Structural analysis panel feature plan
    layer-visibility-control.md  — Layer visibility and group control feature plan
    advanced-periodic-exploration.md — Advanced periodic structure exploration
    guest-molecule-interaction.md    — Guest molecule and ligand functionalization
    environmental-stability.md      — Environmental stability visualization
    cavity-preset-plan.md   — Cavity detection (COMPLETED)
    user_feedback/
      raw.md                — Raw user feedback log
  3d-presentation-app/      — Separate application: spatial 3D presentation tool
    strategy.md             — Positioning and strategic bets
    roadmap.md              — Phased delivery plan
    prd.md                  — Product requirements
    feature_plans/          — Feature specs (multi-origin nav, annotations, export)
```

**When planning new features:** add an entry to `feature_plans/planned-features.md` first. Complex features get their own file in `feature_plans/`.

**Note:** `3d-presentation-app/` documents a **separate future application** (spatial slide-deck tool for scientists) — not part of this codebase.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.


### CIF → JSON conversion
```bash
python scripts/cif_to_json.py <input.cif> <output.json>
# Example:
python scripts/cif_to_json.py models/CIF/2300380.cif models/HKUST_CIF.json
```

Implemented in both `scripts/cif_to_json.py` and `state.js:parseCIF` — see [Docs/application_design.md](Docs/application_design.md) for the full pipeline.

Reference test pair: `models/CIF/2300380.cif` ↔ `models/HKUST_CIF.json`

### Run tests
```bash
cd scripts && python -m unittest test_cif_to_json -v
```
