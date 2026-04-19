# CLAUDE.md

## Run the app

Use the no-cache dev server (prevents stale module cache after edits):
```bash
python3 app/serve.py
# open http://localhost:8080/
```

## Tests

```bash
npm test                  # unit + integration (Jest)
npm run test:coverage     # same + coverage report (target ≥ 80%)
npm run test:e2e          # Playwright smoke tests (requires server on :8080)
npm run test:all          # Jest + Playwright
```

Test files live in `app/tests/`: `unit/`, `integration/`, `e2e/`.
CI runs on every push/PR via `.github/workflows/ci.yml`.

## Architecture

```
app/
  index.html   — UI layout
  index.js     — Entry point, animation loop
  state.js     — State, undo/redo, CIF/JSON I/O, cavity detection
  renderer.js  — Canvas 2D drawing, hit testing (no state mutation)
                 ⚠ Phase A: will be rewritten with Three.js WebGL
  ui.js        — DOM events, modal management
  math3d.js    — Pure vector/geometry (no side-effects, no imports)
  styles.css   — CSS variables + component styles
```

**Dependency direction (no cycles):**
```
math3d.js ← state.js ← renderer.js ← ui.js ← index.js
```

### Key functions
- `state.js` — `getCavitySpheres()`, `parseCIF()`, `serializeStructure()`, `loadStructureFromJSON()`, `saveState()`, `restoreState()`
- `renderer.js` — `draw()`, `hitTest()`, `hitBondTest()`, `hitCavityTest()`
- `ui.js` — `init()`
- `math3d.js` — `rotatePoint()`, `convexHull3DFaces()`, vector ops (`v3sub/add/scale/cross/dot/norm/dist`)

### JSON model format
```json
{
  "version": 9,
  "atoms": [{ "x": 0, "y": 0, "z": 0, "t": "Cu", "role": "Cu", "plane": "cu-o", "id": 0 }],
  "bonds": [{ "a": 0, "b": 1, "dashed": false }]
}
```
- `t` = element symbol; `role` = semantic role; `plane` = highlight group (`cu-o`, `carb`, `ring`, `""`)
- Coordinates: Cartesian, centred at origin, max radius ≤ 10

## Scripts
```bash
python scripts/cif_to_json.py <input.cif> <output.json>
cd scripts && python -m unittest test_cif_to_json -v
```

## Documentation

```
Docs/
  application_design.md     — Full architecture reference
  strategy.md / roadmap.md  — Product strategy and phased delivery
  progress.md               — Changelog
  feature_plans/
    planned-features.md     — Master feature tracking (add here first)
    user_feedback/raw.md
```

**New features:** add entry to `feature_plans/planned-features.md` first. Complex features get their own file.

**`Docs/progress.md` rules:**
- **Before starting:** add a dated entry with what's planned.
- **While working:** append bullets describing what shipped and key implementation details.
- **Phase complete:** compress daily entries into one summary line under "Completed".
- Keep it lean — scannable changelog, not a dev diary.

## MCP Tools: code-review-graph

**Use graph tools BEFORE Grep/Glob/Read.** Faster, cheaper, gives structural context.

| Tool | Use for |
|------|---------|
| `semantic_search_nodes` / `query_graph` | Exploring code, tracing callers/callees/imports/tests |
| `detect_changes` + `get_review_context` | Code review |
| `get_impact_radius` / `get_affected_flows` | Blast radius of a change |
| `get_architecture_overview` + `list_communities` | High-level structure |
| `refactor_tool` | Planning renames, finding dead code |

Fall back to Grep/Glob/Read only when the graph doesn't cover it.

## Skills

| Skill | When to use |
|-------|------------|
| `tdd` | New features, bug fixes, refactoring |
| `threejs` | Any work involving Three.js — Phase A renderer |
| `ui-ux-pro-max` | Frontend UI/UX — Phase A3 redesign |
| `shadertoy` | GLSL shaders, ray marching — Phase 4 DFT rendering |
| `scientific-visualization` | Charts with matplotlib/plotly — Phase 2 analysis |
