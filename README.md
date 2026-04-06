# HKUST-1 MOF Structure Editor

A zero-dependency, single-page browser tool for interactively visualising and editing Metal-Organic Framework (MOF) crystal structures. HKUST-1 (Cu₂(BTC)₄) is the primary reference system.

Runs entirely client-side — no build step, no server required.

---

## Quick Start

```bash
# Python (built-in)
python3 app/serve.py
# then open: http://localhost:8080/

# Node
npx serve app
```

Safari and Firefox can open `app/index.html` directly via `file://`.

---

## Project Structure

```
app/           — Browser application (ES6 modules)
  index.html   — UI layout
  index.js     — Entry point
  state.js     — All app state (atoms, bonds, undo/redo, CIF/JSON I/O)
  renderer.js  — Canvas 2D rendering and hit testing
  ui.js        — DOM events, modals, UI updates
  math3d.js    — Pure vector/geometry math
  styles.css   — CSS variables and component styles

models/        — JSON model files and source CIF files
scripts/       — Python CIF converter and tests
Docs/          — Project documentation
```

---

## Scripts

```bash
# Convert CIF to JSON
python scripts/cif_to_json.py <input.cif> <output.json>

# Run converter tests
cd scripts && python -m unittest test_cif_to_json -v
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Docs/application_design.md](Docs/application_design.md) | Architecture, modules, data model, rendering pipeline |
| [Docs/progress.md](Docs/progress.md) | Version history and progress log |
| [Docs/phase-2/prd.md](Docs/phase-2/prd.md) | Phase 2 product requirements (WebGL, performance, UI redesign) |
| [Docs/phase-2/design.md](Docs/phase-2/design.md) | Phase 2 technical design |
| [Docs/feature_plans/planned-features.md](Docs/feature_plans/planned-features.md) | Master feature tracking (all planned + backlog) |
| [Docs/feature_plans/](Docs/feature_plans/) | Individual feature plans |

---

## Current Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Monolithic canvas editor with all core features | Complete |
| Phase 2a | ES6 module split (state / renderer / ui / math3d) | **Complete** |
| Phase 2b | WebGL renderer (Three.js) | Planning |
| Phase 2c | Sub-linear hit testing (BVH), GC-free render loop | Planning |
| Phase 2d | Glassmorphism UI redesign, full-bleed canvas | Planning |
| Phase 3 | New user-facing features (measurement, export, animation) | Backlog |
