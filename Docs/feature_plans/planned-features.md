# Planned Features — Master Tracking

> Last updated: 2026-04-06
> For completed features see individual files tagged `Status: COMPLETED`.
> See [strategy.md](../strategy.md) for positioning and bets | [roadmap.md](../roadmap.md) for phased delivery plan.
> **Phase naming:** Phase 0 (bugs) → Phase A (architecture: WebGL + BVH + UI) → Phase 1 (editing UX) → Phase 2 (structural intelligence) → Phase 3 (platform) → Phase 4 (DFT viz)

---

## Status Key

| Status | Meaning |
|--------|---------|
| `Planned` | Approved, not yet started |
| `In Progress` | Active development |
| `Completed` | Shipped |
| `Backlog` | Considered but not prioritised |

---

## Phase A — Architecture Migration

> Sequenced **after Phase 0 bugs, before Phase 1 features.** Building features on Canvas 2D means rewriting them after WebGL migration. Do not skip.
> See [Docs/phase-2/prd.md](../phase-2/prd.md) for full requirements.

| Feature | Track | Status | Notes |
|---------|-------|--------|-------|
| ES6 module split | A0 (was 2a) | **Completed** | state / renderer / ui / math3d |
| WebGL renderer (Three.js) | A1 | Planned | True 3D spheres, real lighting, no painter artifacts |
| Sub-linear hit testing (BVH) | A2 | Planned | O(log N); required at 5,000+ atoms; parallel with A1 |
| GC-free render loop | A2 | Planned | Pre-allocated projMap + drawList; parallel with A1 |
| Glassmorphism UI redesign | A3 | Planned | Full-bleed canvas, floating panels, dark-first; parallel with A1/A2 |

---

## Phase 3 — New User Features

Features to build on top of the Phase 2 foundation.

| Feature | Priority | Status | Detail file |
|---------|----------|--------|-------------|
| Animation export (video/GIF) | High | Planned | [animation-export.md](./animation-export.md) |
| Doping simulation | High | Planned | [doping-simulation.md](./doping-simulation.md) |
| Guest molecule interaction & ligand functionalization | High | Planned | [guest-molecule-interaction.md](./guest-molecule-interaction.md) |
| Environmental stability visualization | High | Planned | [environmental-stability.md](./environmental-stability.md) |
| Layer visibility & group control | High | Planned | [layer-visibility-control.md](./layer-visibility-control.md) |
| Advanced periodic structure exploration | High | Planned | [advanced-periodic-exploration.md](./advanced-periodic-exploration.md) |
| DFT results integration & visualization | High | Planned | [dft-integration.md](./dft-integration.md) |
| CIF export | High | Planned | [cif-export.md](./cif-export.md) |
| Geometric pore characterization | High | Planned | [pore-characterization.md](./pore-characterization.md) |
| Structural analysis panel | High | Planned | [structural-analysis-panel.md](./structural-analysis-panel.md) |
| Distance measurement mode | Medium | Backlog | Click 2 atoms → floating Å label (non-bonded) |
| XYZ export | Medium | Backlog | Write `atoms[]` to XYZ string format |
| Dihedral / torsion angle | Low | Backlog | 4-atom selection in Polyhedron mode |
| Coordination number in tooltip | Low | Backlog | Count bonds per atom on hover |
| Symmetry colouring | Low | Backlog | Detect C₄ equivalent atoms, colour-code them |

---

## Phase 4 — Advanced Visualization (Requires Phase 2b WebGL)

Features that require the Three.js WebGL renderer (marching cubes isosurface, large instanced supercells).

| Feature | Priority | Status | Detail file |
|---------|----------|--------|-------------|
| Volumetric DFT data (electron density, ESP isosurfaces) | High | Backlog | [dft-integration.md](./dft-integration.md) — Phase 4 section |
| Band structure visualization | Medium | Backlog | — |
| Large supercell (>5,000 atoms) with InstancedMesh | High | Backlog | [advanced-periodic-exploration.md](./advanced-periodic-exploration.md) |

---

## Completed Features (Archive)

| Feature | Completed | Detail file |
|---------|-----------|-------------|
| Cavity detection preset | 2026-04-05 | [cavity-preset-plan.md](./cavity-preset-plan.md) |
| PNG export | 2026-04-04 | — |
| Depth fog | 2026-04-04 | — |
| Supercell tiling | 2026-04-04 | — |
