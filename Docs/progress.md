# Project Progress Log — HKUST-1 MOF Structure Editor

> Last updated: 2026-04-05

---

## v1–v5 — Prototype (Single HTML File)

- Basic 3D canvas renderer with painter's algorithm depth sort
- Default HKUST-1 SBU procedural construction
- Drag-to-rotate, scroll-to-zoom
- Atom hover tooltips
- Basic JSON export/import

---

## v6 — Full Feature Monolith (`HKUST-1_v6.html`)

- Refactored renderer: spatial grid, radial gradient atoms, perspective depth cueing via `dm`
- 5 editing modes with mode pill + hotkeys (View, Move, Polyhedron, Add/Delete, Edit Bonds)
- Axis gizmos for translate and rotate (2-atom fragment rotation)
- Polyhedron groups: coplanar + convex hull decomposition, triangulation
- Multi-HUD: real-time bond lengths and bond angles on canvas hover
- Snap guides + auto-relax (spring-layout on immediate neighbours during drag)
- Undo/redo (50-state deep-copy stack)
- Import: XYZ, MOL, CIF (basic fractional), JSON
- Custom element palette
- Preset plane highlighting: Cu–O, Carb, Rings
- Dark/light theme with CSS variables
- localStorage persistence

---

## Phase 2a — ES6 Modularization ✅ COMPLETE

**Goal:** Split monolithic `app.js` into focused ES6 modules with no behaviour change.

**Deliverables completed:**
- `app/state.js` — all mutable state, undo/redo, CIF/JSON I/O
- `app/math3d.js` — pure vector/geometry functions
- `app/renderer.js` — Canvas 2D drawing, hit testing
- `app/ui.js` — all DOM events and UI updates
- `app/index.js` — entry point, animation loop
- `app/index.html` — uses `<script type="module" src="index.js">`
- `app/app.js` retained as reference (not loaded)

---

## 2026-04-04

- **PNG export** (`↓ PNG` button): off-screen canvas composite with theme-correct background, downloads as `HKUST-1_structure.png`
- **Depth fog toggle** (View Settings → "Depth fog"): per-frame Z-range normalisation, fog factor `0.15 → 1.0` applied to atom `globalAlpha` and bond rgba; works on base + supercell ghosts
- **Supercell tiling** (Presets → "Supercell tiling"): enable toggle + X/Y/Z repeat selectors; ghost copies at reduced opacity, depth-sorted, fog-aware

---

## 2026-04-05

- **Cavity detection** (Presets → "Cavities"): Carbon ring normal convergence algorithm (`state.js:getCavitySpheres`); renders 7 maximal empty spheres for HKUST-1 (1 central, 6 peripheral)
- Multiple tuning fixes to cavity sphere calculations
- **Documentation reorganisation**: split `design-and-progress.md` into `application_design.md` + `progress.md`; moved phase-2 docs into `Docs/phase-2/`; created `feature_plans/planned-features.md`
