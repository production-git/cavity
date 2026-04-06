# Cavity

A zero-dependency, browser-based tool for interactively visualising and editing crystal structures — Metal-Organic Frameworks (MOFs), coordination cages, and beyond.

**No build step. No server. Runs entirely in the browser.**

[**Try it live →**](https://production-git.github.io/cavity/)

---

## Quick Start

```bash
git clone https://github.com/production-git/cavity.git
cd cavity
python3 app/serve.py
```

Open [http://localhost:8080](http://localhost:8080)

> **Why `serve.py`?** It disables browser caching so edits to JS/CSS are picked up immediately. You can also use `npx serve app` or open `app/index.html` directly in Safari/Firefox via `file://`.

---

## Project Structure

```
app/
  index.html    — UI layout
  index.js      — Entry point, animation loop
  state.js      — App state, undo/redo, CIF/JSON I/O, cavity detection
  renderer.js   — Canvas 2D drawing and hit testing
  ui.js         — DOM events, modals, UI updates
  math3d.js     — Pure vector/geometry math (no side-effects)
  styles.css    — CSS variables and component styles

models/         — JSON model files and source CIF files
scripts/        — CIF → JSON converter and tests
Docs/           — Architecture, roadmap, feature plans
```

---

## Scripts

```bash
# Convert a CIF file to the app's JSON format
python scripts/cif_to_json.py <input.cif> <output.json>

# Run converter tests
cd scripts && python -m unittest test_cif_to_json -v
```

---

## What's Coming

### Phase A — Architecture (Next)
Replacing the Canvas 2D renderer with **Three.js** for true 3D rendering, alongside a full UI redesign and sub-linear hit testing.

- Real 3D spheres with lighting and depth-correct rendering
- BVH spatial index — O(log N) hit testing at 5,000+ atoms
- Glassmorphism UI — full-bleed canvas, floating panels, dark-first theme

### Phase 1 — Editing UX
Making structural editing actually useful for research.

- Infinite pan navigation
- Precision bond length + angle editor
- Bulk atom selection and group operations

### Phase 2 — Structural Intelligence
Making structures explain themselves.

- Structural analysis panel — bond stats, coordination numbers, geometry
- Geometric pore characterisation — surface area, pore size distribution
- CIF export — round-trip compatible with VESTA and iRASPA

### Phase 3 — Platform Features
Competing with desktop tools on capability.

- Animation export — rotation GIF / WebM
- Molecule library with curated structure presets
- Doping simulation and guest molecule interactions

### Phase 4 — Advanced Visualisation
Research-grade volumetric data rendering.

- DFT electron density and ESP isosurfaces
- Band structure visualisation

---

## Current Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Bug sprint — stability and round-trip I/O | **Complete** |
| Phase A | WebGL renderer, BVH hit testing, UI redesign | Planning |
| Phase 1 | Editing UX — pan, precision editor, bulk select | Backlog |
| Phase 2 | Structural intelligence — analysis, pore metrics, CIF export | Backlog |
| Phase 3 | Platform features — animation, molecule library, doping | Backlog |
| Phase 4 | Advanced visualisation — DFT isosurfaces, band structure | Backlog |

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Docs/application_design.md](Docs/application_design.md) | Architecture, modules, data model, rendering pipeline |
| [Docs/roadmap.md](Docs/roadmap.md) | Full phased roadmap with exit criteria |
| [Docs/progress.md](Docs/progress.md) | Changelog |
| [Docs/feature_plans/planned-features.md](Docs/feature_plans/planned-features.md) | Master feature tracking |
