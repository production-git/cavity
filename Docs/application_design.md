# Application Design — HKUST-1 MOF Structure Editor

> Last updated: 2026-04-05

---

## Overview

A zero-dependency, single-page browser tool for interactively visualising and editing Metal-Organic Framework (MOF) crystal structures. HKUST-1 (Cu₂(BTC)₄) is the primary reference system. Runs entirely client-side — no build step, no server required.

---

## Module Architecture

Phase 2a (ES6 modularization) is complete. The application is split into focused ES6 modules with a strict one-way dependency chain.

```
app/
  index.html     — UI layout (canvas, modals, control panels)
  index.js       — Entry point: imports all modules, calls init(), animation loop
  state.js       — All data state: atoms[], bonds[], undo/redo, ELEMENTS, CIF/JSON I/O, cavity
  renderer.js    — Canvas rendering, 3D projection, hit testing, cavity sphere rendering
  ui.js          — Event handlers (mouse/keyboard/touch), modal management, UI update fns
  math3d.js      — Pure vector math and geometry (no side-effects, no imports)
  styles.css     — CSS variables + component styles
  app.js         — Legacy monolithic script (no longer loaded; kept for reference only)
```

### Dependency Direction (strict, no cycles)

```
math3d.js  ←  state.js  ←  renderer.js  ←  ui.js  ←  index.js
```

- `math3d.js` — zero imports (pure functions)
- `state.js` — imports only from `math3d.js`
- `renderer.js` — imports from `state.js` and `math3d.js`
- `ui.js` — imports from `state.js` and `renderer.js`
- `index.js` — imports everything and wires it together

---

## Module Responsibilities

### [state.js](../app/state.js) — Single Source of Truth

All mutable application state. Every state change goes through named mutators.

| Symbol | Location | Description |
|--------|----------|-------------|
| `ELEMENTS` | line 19 | Array defining symbol, display color, radius, and semantic roles |
| `app` object | line ~1 | Global mutable state: `atoms[]`, `bonds[]`, `customGroups`, view angles, zoom, selection |
| `A()` / `B()` | lines 138/148 | Shorthand atom/bond adders |
| `buildDefault()` | line 154 | Procedurally constructs the default HKUST-1 SBU |
| `saveState()` / `restoreState()` | lines 186/198 | Deep-copies into a 50-entry undo/redo stack |
| `getCavitySpheres()` | line 290 | Computes cavity sphere positions and radii |
| `parseCIF()` | line 621 | In-browser CIF → structure pipeline (mirrors `cif_to_json.py`) |
| `serializeStructure()` | line 705 | Serialises current state to version-9 JSON |
| `loadStructureFromJSON()` | line 717 | Deserialises a JSON model into `atoms`/`bonds` |

### [renderer.js](../app/renderer.js) — Pure Drawing, No State Mutation

Reads from `state.js` and `math3d.js`. Owns the canvas element.

| Symbol | Location | Description |
|--------|----------|-------------|
| `draw()` | line 124 | Full scene redraw (atoms, bonds, cavities, axes, UI overlays) |
| `proj()` | line 48 | 3D → 2D perspective projection |
| `hitTest()` / `hitBondTest()` / `hitCavityTest()` | lines 57/70/106 | Pick-ray intersection |

### [ui.js](../app/ui.js) — All DOM Interaction

Owns all event listeners and DOM updates. Calls `state` mutators and `renderer.draw()`.

| Symbol | Location | Description |
|--------|----------|-------------|
| `init()` | line 31 | Binds all canvas and DOM events |
| `onMouseDown/Up/Move` | lines 556/613/656 | Drag rotation, atom placement, bond toggling |
| `updateSelUI()` / `updateStats()` | lines 197/276 | Reflect state changes in the DOM |

### [math3d.js](../app/math3d.js) — Stateless Geometry Primitives

Zero dependencies. Pure functions only.

- **Vector ops**: `v3sub`, `v3add`, `v3scale`, `v3cross`, `v3dot`, `v3norm`, `v3dist`
- **`rotatePoint()`** (line 17): rotate a point around an axis
- **`project()`** (line 26): 3D → 2D perspective project
- **`convexHull3DFaces()`** (line 110): 3D convex hull triangulation

---

## Data Model

### JSON Model Format

Both the app and the CIF converter produce/consume this schema:

```json
{
  "version": 9,
  "name": "...",
  "atoms": [{ "x": 0, "y": 0, "z": 0, "t": "Cu", "role": "Cu", "plane": "cu-o", "id": 0 }],
  "bonds": [{ "a": 0, "b": 1, "dashed": false }],
  "customGroups": [],
  "elements": [...],
  "viewState": {}
}
```

Field glossary:
- `t` = element symbol
- `role` = semantic role: `Cu`, `O_bridge`, `O_term`, `C_carb`, `C_arom`, `H`
- `plane` = highlight group: `cu-o`, `carb`, `ring`, or `""`
- Coordinates are Cartesian, centred at origin, scaled to max radius ≤ 10

### Runtime State Arrays

| Array | Shape | Key fields |
|---|---|---|
| `atoms[]` | `{x, y, z, t, role, plane, id}` | Cartesian coords, element, semantic role, highlight group |
| `bonds[]` | `{a, b, dashed}` | Atom id pair, dashed flag (Cu–Cu axial bond) |

---

## Rendering Pipeline

Per-frame execution order in `renderer.js:draw()`:

1. Build `projMap` — project every atom through perspective to screen XY + depth Z
2. Build `spatialGrid` — 40 px cell spatial hash for O(1) hit testing
3. Build `drawList` — collect faces, edges, bonds, atoms, ghosts, guides, cavity spheres
4. (If supercell enabled) append ghost atom/bond copies for each offset cell
5. Sort `drawList` by Z (painter's algorithm)
6. Render sorted list: faces → edges → bonds → atoms → cavity spheres → overlays
7. Draw Multi-HUD (bond lengths, bond angles) on hover
8. Draw world axes and header text

### Coordinate System

```
     Y
     |   Z (depth)
     |  /
     | /
     +------ X

Projection: perspective divide
  sx = W/2 + x_rot * zoom * (per / (per + z_rot))
  sy = H/2 - y_rot * zoom * (per / (per + z_rot))
```

The perspective constant `per = 14` means any atom with `|z_screen| ≥ 14` produces division-by-zero artefacts — hence max-radius-10 scaling in both importers.

---

## CIF Conversion Pipeline

Both `scripts/cif_to_json.py` and `state.js:parseCIF()` implement the same pipeline:

1. Parse unit cell parameters (a, b, c, α, β, γ)
2. Extract symmetry operations from `_symmetry_equiv_pos_as_xyz` or `_space_group_symop_operation_xyz`
3. Parse fractional coordinates; strip uncertainty notation `0.1(5)` → `0.1`
4. Apply each symmetry op, wrap to `[0, 1)`, deduplicate at 3 decimal places
5. Convert fractional → Cartesian via full triclinic transformation matrix
6. Centre at geometric centroid
7. Auto-bond: distance < (rᵢ + rⱼ + 0.4 Å) and > 0.4 Å; Cu–Cu bonds → dashed
8. Scale if max radius > 10

Reference test pair: `models/CIF/2300380.cif` ↔ `models/HKUST_CIF.json`

---

## Subsystems

### Cavity Detection

`state.js:getCavitySpheres()` implements:

1. Find all Carbon 6-cycles (rings) in the bond graph
2. Compute 2 face-normal vectors per ring
3. Cluster converging normals (4+ convergent → cavity centre)
4. For each centre, grow the largest sphere that contains no atoms
5. Return `[{x, y, z, r}, ...]` — rendered in `renderer.js` as semi-transparent circles

HKUST-1 yields 7 cavities: 1 central + 6 peripheral.

### Supercell Tiling

Ghost copies tiled along computed lattice vectors derived from the bounding box (with 1.5 Å padding per axis). Ghost atoms rendered at 32% opacity, bonds at 22%, both depth-sorted alongside base structure. Fog applies to ghost copies when enabled.

Current limits: X: 1–4, Y: 1–4, Z: 1–3. Ghost copies are view-only (no hit testing, no inter-cell bonds).

### Undo/Redo

50-state deep-copy stack in `state.js`. `saveState()` deep-clones `atoms[]`, `bonds[]`, and `customGroups` into the history ring. `restoreState()` reverses. All editing operations must call `saveState()` before mutation.

### Import/Export

| Format | Import | Export | Handler |
|--------|--------|--------|---------|
| JSON v9 | ✓ (file + localStorage) | ✓ | `state.js:loadStructureFromJSON` / `serializeStructure` |
| XYZ | ✓ (auto-bond by distance) | — | `ui.js` |
| MOL | ✓ | — | `ui.js` |
| CIF | ✓ (full triclinic matrix) | — | `state.js:parseCIF` |
| PNG | — | ✓ | `renderer.js` (off-screen canvas composite) |
