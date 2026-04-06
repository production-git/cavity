# Project Progress Log — HKUST-1 MOF Structure Editor

> Last updated: 2026-04-06

---

## Completed (through 2026-04-05)

**v1–v6 + Phase 2a (ES6 modularization):** 3D canvas renderer, 5 editing modes, undo/redo, CIF/XYZ/MOL/JSON import, polyhedra, bond angles/lengths HUD, supercell tiling, depth fog, dark/light theme, PNG export. Split into `state.js`, `math3d.js`, `renderer.js`, `ui.js`, `index.js` modules.

**2026-04-04:** PNG export, depth fog toggle, supercell tiling with ghost atoms.

**2026-04-05:** Cavity detection (carbon ring normal convergence, 7 spheres for HKUST-1). Docs reorganised into `application_design.md`, `progress.md`, `phase-2/`, `feature_plans/`.
