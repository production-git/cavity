# Roadmap: Crystal Structure Viewer (HCUST)

> Date: 2026-04-06
> Source: `/pm-strategy` session — updated to reflect architecture-first sequencing
> See also: [strategy.md](./strategy.md) for positioning and bets | [feature_plans/planned-features.md](./feature_plans/planned-features.md) for full feature backlog

---

## Sequencing Rationale

The app is not in production. There are no users to disrupt. Every Phase 1+ feature (precision editor, bulk select, analysis panels) touches the renderer and the UI layout. Building them on the Canvas 2D foundation means doing the work twice — once now, once after the WebGL migration. Architecture comes first.

```
Phase 0 (bugs)
    └── Phase A (architecture: WebGL + BVH + UI redesign)
            └── Phase 1 (editing UX — built on the real foundation)
                    └── Phase 2 (structural intelligence)
                            └── Phase 3 (platform features)
                                    └── Phase 4 (DFT visualization)
```

---

## Phase 0 — Bug Sprint

> **Goal:** Restore trust. Fix all known issues before any new work.
> **Scope:** 1–2 weeks
> **Strategic bet:** Bet 1 — Stability

| # | Item | Source |
|---|------|--------|
| 0.1 | Fix JSON export/import round-trip — `Cannot read properties of undefined (reading 'x')` | feedback #0 |
| 0.2 | Remove hardcoded default structure — load from `models/HKUST-1-Cu-2BTC-4.json` | feedback #0 |
| 0.3 | Fix phantom axis remaining after atom deletion | feedback #12 |
| 0.4 | Reduce snap threshold — current value is too restrictive, snaps don't show guide lines and snaps leaves guide residue in the UI | feedback #1 |
| 0.5 | Declutter tooltips — move bond/angle/coordinate info to bottom status bar | feedback #11 |

**Exit criterion:** All 5 items resolved; JSON import/export round-trip passes with existing test models.

---

## Phase A — Architecture Migration

> **Goal:** Replace the Canvas 2D foundation with a WebGL renderer, sub-linear hit testing, and an immersive UI. All Phase 1+ features are built on top of this — do not skip.
> **Scope:** 4–6 weeks
> **Strategic bet:** Bet 2 — Stickiness (enabler)
> **PRD:** [phase-2/prd.md](./phase-2/prd.md)

Phase A sub-tracks run in parallel:

### A1 — WebGL Renderer (3–5 weeks)
Replace `renderer.js` (Canvas 2D painter's algorithm) with Three.js. All other modules unchanged.

| Deliverable | Detail |
|---|---|
| `app/renderer.js` rewritten with Three.js | True 3D spheres, real lighting, depth-correct rendering |
| Three.js loaded via CDN | No bundler required |
| HUD overlay (bond lengths, angles) | Reimplemented via CSS2DRenderer |
| All existing features pass | Atoms, bonds, polyhedra, axis gizmo, fog, supercell ghosts, PNG export |

**Exit criterion:** All existing features work identically through Three.js; no painter's algorithm artifacts at any rotation; ≥ 60 fps at ~120 atoms (default SBU).

### A2 — Performance (parallel with A1)
Sub-linear hit testing and GC-free render loop. Can start during A1 using the Canvas 2D path; migrated to Three.js path when A1 lands.

| Deliverable | Detail |
|---|---|
| `app/spatial.js` | BVH or octree for O(log N) atom/bond spatial queries |
| Pre-allocated `projMap` + `drawList` | No heap allocations per frame |

**Exit criterion:** Hit test latency ≤ 2 ms at 5,000 atoms; ≥ 30 fps at 5,000+ atoms.

### A3 — UI/UX Redesign (parallel with A1/A2)
Full-bleed canvas, floating glassmorphism panels, dark-first aesthetic. Touches only `index.html`, `styles.css`, `ui.js` — no renderer or state changes.

| Deliverable | Detail |
|---|---|
| Full-bleed canvas | 100% viewport at all times; no chrome pushes the canvas |
| Floating panels | `backdrop-filter: blur()` glassmorphism; molecule visible through panels |
| Spatial layout | Left: toolbar; Right: collapsible inspector; Top: app bar; Bottom: status bar |
| Dark-first theme | Default background `#0a0b0f`; light theme toggle available |
| Micro-interactions | All hover/active/panel transitions animated ≤ 220 ms |

**Exit criterion:** All R7–R11 from the Phase 2 PRD met; inspector collapses on < 1024 px viewport.

---

## Phase 1 — Editing UX

> **Goal:** Make structural editing actually usable for research. Requires Phase A.
> **Scope:** 4–6 weeks
> **Strategic bet:** Bet 2 — Stickiness

| # | Feature | Detail |
|---|---------|--------|
| 1.1 | Scene pan — infinite x-y plane navigation | feedback #13 |
| 1.2 | Precision bond length + angle editor panel | feedback #3 |
| 1.3 | Bulk atom selection — double-click cascade, box-select | feedback #10 |
| 1.4 | Atom grouping + group operations (duplicate, delete, move) | feedback #8, #9 |
| 1.5 | Collapsible side panels for small screens | feedback #7 |
| 1.6 | Bond representation toggle (solid/dashed) in edit mode | feedback #4 |

**Exit criterion:** User can select a paddlewheel unit, duplicate it, and adjust bond lengths by typing values — without re-importing a CIF.

---

## Phase 2 — Structural Intelligence

> **Goal:** Make structures explain themselves. Requires Phase 1.
> **Scope:** 6–8 weeks
> **Strategic bet:** Bet 3 — Discovery

| # | Feature | Detail file |
|---|---------|------------|
| 2.1 | Structural analysis panel — bond stats, coordination numbers, geometry summary | [structural-analysis-panel.md](./feature_plans/structural-analysis-panel.md) |
| 2.2 | Geometric pore characterization — surface area, pore size distribution | [pore-characterization.md](./feature_plans/pore-characterization.md) |
| 2.3 | Layer visibility + group control — eye toggle, isolate, per-group color | [layer-visibility-control.md](./feature_plans/layer-visibility-control.md) |
| 2.4 | Session save/load — localStorage + `.json` file export/import | feedback #14 |
| 2.5 | CIF export — round-trip compatibility with VESTA, iRASPA | [cif-export.md](./feature_plans/cif-export.md) |

Phase 2.4 (session save) and Phase 2.5 (CIF export) can start in parallel with Phase 2.1–2.3.

**Exit criterion:** User can load a CIF, identify pore sizes, export back to CIF, and reload it in VESTA without data loss.

---

## Phase 3 — Platform Features

> **Goal:** Compete with desktop tools on capability. Requires Phase A WebGL + Phase 2.
> **Scope:** 8–12 weeks
> **Strategic bet:** Bet 4 — Platform

| # | Feature | Detail file |
|---|---------|------------|
| 3.1 | Animation export — rotation GIF/WebM | [animation-export.md](./feature_plans/animation-export.md) |
| 3.2 | Molecule library + curated presets beyond HKUST-1 | — |
| 3.3 | Doping simulation | [doping-simulation.md](./feature_plans/doping-simulation.md) |
| 3.4 | Guest molecule interaction + ligand functionalization | [guest-molecule-interaction.md](./feature_plans/guest-molecule-interaction.md) |
| 3.5 | Environmental stability visualization | [environmental-stability.md](./feature_plans/environmental-stability.md) |
| 3.6 | Large supercell support — InstancedMesh, >5,000 atoms (BVH already done in Phase A2) | [advanced-periodic-exploration.md](./feature_plans/advanced-periodic-exploration.md) |

Phase 3.1 (animation export) can start in parallel with Phase 3.2–3.6.

**Exit criterion:** A structure with 2,000+ atoms renders at ≥ 30 fps; animation export works for a full rotation sequence.

---

## Phase 4 — Advanced Visualization

> **Goal:** Research-grade volumetric and electronic structure data.
> **Scope:** TBD — hard dependency on Phase A WebGL renderer (marching cubes, isosurfaces)
> **Strategic bet:** Bet 4 continued

| # | Feature | Detail file |
|---|---------|------------|
| 4.1 | Volumetric DFT data — electron density and ESP isosurfaces | [dft-integration.md](./feature_plans/dft-integration.md) |
| 4.2 | Band structure visualization | — |
| 4.3 | Advanced periodic structure exploration | [advanced-periodic-exploration.md](./feature_plans/advanced-periodic-exploration.md) |

---

## Leading Indicators Per Phase

| Phase | Indicator | Target |
|-------|-----------|--------|
| 0 | Open bugs from `user_feedback/raw.md` | 0 remaining |
| A | All existing features pass through Three.js renderer | 100% |
| A | Frame rate at ~120 atoms (default SBU) | ≥ 60 fps |
| A | Hit test latency at 5,000 atoms | ≤ 2 ms |
| 1 | % of sessions that include a structural edit | Increasing trend |
| 2 | PNG exports + saved sessions per week | Increasing trend |
| 2 | Unique molecule types loaded per month | > 5 |
| 3 | Avg atoms in loaded structures | > 500 |
| 3 | % of sessions using animation export | > 20% |
| 4 | Sessions loading DFT-derived data | > 10/month |

---

## Backlog (Not Phased)

| Feature | Priority | Notes |
|---------|----------|-------|
| Distance measurement mode | Medium | Click 2 atoms → floating Å label |
| XYZ export | Medium | Write `atoms[]` to XYZ string |
| Dihedral / torsion angle | Low | 4-atom selection in Polyhedron mode |
| Coordination number in tooltip | Low | Count bonds per atom on hover |
| Symmetry colouring | Low | Detect C₄ equivalent atoms, colour-code |
