# Planned Features — Master Tracking

> Last updated: 2026-04-05 (added layer-visibility, advanced-periodic, dft-integration, cif-export, pore-characterization, structural-analysis-panel)
> For completed features see individual files tagged `Status: COMPLETED`.

---

## Status Key

| Status | Meaning |
|--------|---------|
| `Planned` | Approved, not yet started |
| `In Progress` | Active development |
| `Completed` | Shipped |
| `Backlog` | Considered but not prioritised |

---

## Phase 2 — Architecture Migration

These are engineering-level improvements with no new user-visible features. See [Docs/phase-2/prd.md](../phase-2/prd.md) for full requirements.

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| ES6 module split | 2a | **Completed** | state / renderer / ui / math3d |
| WebGL renderer (Three.js) | 2b | Planned | True 3D spheres, real lighting, no painter artifacts |
| Sub-linear hit testing (BVH) | 2c | Planned | O(log N); required at 5,000+ atoms |
| GC-free render loop | 2c | Planned | Pre-allocated projMap + drawList |
| Glassmorphism UI redesign | 2d | Planned | Full-bleed canvas, floating panels, dark-first |

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
