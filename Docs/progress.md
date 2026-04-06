# Project Progress Log — HKUST-1 MOF Structure Editor

> Last updated: 2026-04-06

---

## Completed (through 2026-04-05)

**v1–v6 + Phase 2a (ES6 modularization):** 3D canvas renderer, 5 editing modes, undo/redo, CIF/XYZ/MOL/JSON import, polyhedra, bond angles/lengths HUD, supercell tiling, depth fog, dark/light theme, PNG export. Split into `state.js`, `math3d.js`, `renderer.js`, `ui.js`, `index.js` modules.

**2026-04-04:** PNG export, depth fog toggle, supercell tiling with ghost atoms.

**2026-04-05:** Cavity detection (carbon ring normal convergence, 7 spheres for HKUST-1). Docs reorganised into `application_design.md`, `progress.md`, `phase-2/`, `feature_plans/`.

## Phase 0 — Bug Sprint (2026-04-06)

- **0.1 Fixed:** JSON import now preserves atom IDs from file (`a.id`), keeping bond references valid after round-trip. Previously atoms got sequential IDs on load, breaking any bonds referencing IDs from structures with deletions (`Cannot read properties of undefined (reading 'x')`). (`state.js::loadStructureFromJSON`)
- **0.2 Fixed:** Removed `buildDefault()` entirely from `state.js`. Startup and reset now `fetch` from `app/model/HKUST-1-Cu-2BTC-4.json`. Added `app/serve.py` (no-cache dev server) to prevent stale module cache after edits. (`state.js`, `index.js`, `ui.js::resetStructure`)
- **0.3 Fixed:** Phantom axis after atom deletion. In move mode, selecting an atom sets `editSelected` and computes `currentAxes`; pressing Delete removed the atom but never cleared the axes. Added one line after the delete loop to recompute `currentAxes` from the updated `editSelected`. (`ui.js` keyboard handler)
