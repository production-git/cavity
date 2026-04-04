# HKUST-1 MOF Structure Editor — Design & Progress

> Last updated: 2026-04-04

---

## Project Overview

A zero-dependency, single-page browser tool for interactively visualising and editing Metal-Organic Framework (MOF) crystal structures, with HKUST-1 (Cu₂(BTC)₄) as the primary reference system.

**Goals:**
- Provide an intuitive 3D editor for the HKUST-1 paddle-wheel SBU
- Support import from standard crystallographic formats (CIF, XYZ, MOL, JSON)
- Export clean PNG images and JSON model files
- Run entirely client-side — no build step, no server

---

## Architecture

```
app/
  index.html     — UI layout (canvas, overlay panels, modals)
  app.js         — All application logic (~1500 lines, vanilla JS)
  styles.css     — CSS variables, component styles, dark/light themes

models/
  *.json         — Native model format (hand-authored or exported)
  HKUST_CIF.json — Converted from reference CIF via cif_to_json.py
  CIF/           — Source crystallographic files (.cif)

scripts/
  cif_to_json.py      — Python CIF parser + converter
  test_cif_to_json.py — Unit/integration tests for the converter

Docs/
  design-and-progress.md  — This file
```

### Data Model

All structure state lives in two global arrays:

| Array | Shape | Key fields |
|---|---|---|
| `atoms[]` | `{x, y, z, t, role, plane, id}` | Cartesian coords, element symbol, semantic role, highlight group |
| `bonds[]` | `{a, b, dashed}` | Atom id pair, dashed flag (Cu–Cu axial bond) |

Coordinates are centred at the origin. The perspective divide uses `per = 14`, so max atom radius is capped at 10 to avoid divide-by-zero artefacts.

### Rendering Pipeline (per frame)

1. Build `projMap` — project every atom through perspective to screen XY + depth Z
2. Build `spatialGrid` — 40 px cell spatial hash for O(1) hit testing
3. Build `drawList` — collect faces, edges, bonds, atoms, ghosts, guides
4. (If supercell enabled) append ghost atom/bond copies for each offset cell
5. Sort `drawList` by Z (painter's algorithm)
6. Render sorted list: faces → edges → bonds → atoms → overlays
7. Draw Multi-HUD (bond lengths, bond angles) on hover
8. Draw world axes and header text

### Coordinate System

```
     Y
     |   Z (depth)
     |  /
     | /
     +------ X

Projection: per-divide perspective
  sx = W/2 + x_rot * zoom * (per / (per + z_rot))
  sy = H/2 - y_rot * zoom * (per / (per + z_rot))
```

---

## Feature Set

### Core Editing Modes

| Mode | Hotkey | Description |
|---|---|---|
| View | V | Rotate/zoom only, no editing |
| Move | E | Click atom(s) → drag axis gizmos to translate; 2-atom select enables rotation handles |
| Polyhedron | S | Select 3+ atoms → commit as shaded polyhedron group |
| Add/Delete | A / D | Extrude new atoms along axis handles, or click to delete |
| Edit Bonds | B | Click two atoms to toggle bond |

### View Controls

| Control | Description |
|---|---|
| Auto-rotate | Continuous Y-axis spin |
| Zoom | Mouse wheel or slider (30–160) |
| Atom size | Scale factor for all atom radii |
| Face alpha | Polyhedron face transparency |
| Show labels | Element symbol above each atom |
| Show bonds | Toggle bond rendering |
| Dark/Light theme | CSS variable swap |
| **Depth fog** | Fade distant atoms/bonds toward background colour |

### Preset Planes

| Preset | Atoms highlighted |
|---|---|
| Cu–O | Copper and bridging-oxygen square plane |
| Carb | Carboxylate carbons |
| Rings | Aromatic BTC ring carbons |
| Cavities | Enclosed cavities within the molecule formed by chains of multiple atoms |

### Import / Export

| Format | Import | Export |
|---|---|---|
| JSON (v9) | ✓ (file + localStorage) | ✓ (download) |
| XYZ | ✓ (auto-bond by distance) | — |
| MOL | ✓ | — |
| CIF | ✓ (basic fractional coords) | — |
| **PNG** | — | ✓ (canvas snapshot with background) |

### Interaction Details

- **Snap guides**: while dragging, snaps to coplanar planes of nearby atoms; amber guide line + indicator badge
- **Auto-relax**: optional spring-layout on immediate neighbours during drag
- **Undo/Redo**: 50-state deep-copy history stack (Ctrl+Z / Ctrl+Y)
- **Multi-HUD**: hover over bond → inline Å label rotated along bond; hover near atom → arc angle labels for all bond pairs
- **Spatial indexing**: 40 px grid hash for atom and bond hit testing at O(1)

---

## Supercell Tiling

Extends the visualisation beyond the single SBU by tiling ghost copies along computed lattice vectors.

**Lattice vector computation** (`getLatticeVectors`):  
Derives repeat distances from the bounding box of the base structure with a 1.5 Å padding on each axis.  
For CIF-imported structures, the actual unit cell parameters (`unitCell.a/b/c`) should be used instead — this is a planned improvement.

**Rendering**:  
Ghost copies are drawn at 32 % atom / 22 % bond opacity, interleaved in the depth-sorted draw list alongside the base structure. Fog applies to ghost copies when both features are active.

**Current limits**:  
- X: 1–4, Y: 1–4, Z: 1–3
- Ghost copies are view-only (no editing, no hit testing)
- Bond detection across cell boundaries is not yet implemented

---

## CIF Conversion Pipeline

Both `scripts/cif_to_json.py` and `app.js:parseCIF()` implement the same pipeline:

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

## Progress Log

### v1–v5 (pre-refactor, single HTML file)
- Basic 3D canvas renderer with painter's algorithm depth sort
- Default HKUST-1 SBU procedural construction
- Drag-to-rotate, scroll-to-zoom
- Atom hover tooltips
- Basic export/import (JSON only)

### v6 (HKUST-1_v6.html — monolithic)
- Refactored renderer: spatial grid, radial gradient atoms, perspective depth cueing via `dm`
- 5 editing modes with mode pill + hotkeys
- Axis gizmos for translate and rotate (2-atom fragment rotation)
- Polyhedron groups: coplanar + convex hull decomposition, triangulation
- Multi-HUD: real-time bond lengths and bond angles on canvas hover
- Snap guides + auto-relax
- Undo/redo (50 states)
- Import: XYZ, MOL, CIF (basic), JSON
- Custom element palette
- Preset plane highlighting (Cu–O, Carb, Rings)
- Dark/light theme with CSS variables
- localStorage persistence

### v7 (app/ folder — split into 3 files)
- Moved to `app/index.html` + `app.js` + `styles.css`
- No functional changes from v6 at split point

### 2026-04-04
- **PNG export** (`↓ PNG` button): off-screen canvas composite with theme-correct background, downloads as `HKUST-1_structure.png`
- **Depth fog toggle** (View Settings → "Depth fog"): per-frame Z-range normalisation, fog factor `0.15 → 1.0` applied to atom `globalAlpha` and bond rgba; works on base + supercell ghosts
- **Supercell tiling** (Presets → "Supercell tiling"): enable toggle + X/Y/Z repeat selectors; ghost copies at reduced opacity, depth-sorted, fog-aware

---

## Known Issues / Limitations

| # | Issue | Severity |
|---|---|---|
| 1 | Supercell uses bounding-box vectors, not actual CIF unit cell params | Medium |
| 2 | No inter-cell bonds in supercell view | Low |
| 3 | Ghost supercell atoms are not hit-testable (view only) | Low |
| 4 | `parseCIF` in browser uses simple fractional scaling, not full triclinic matrix | Medium |
| 5 | Auto-rotation speed is fixed (no slider) | Low |
| 6 | No XYZ / MOL export | Low |

---

## Planned Features

| Feature | Priority | Notes |
|---|---|---|
| Cavity detection preset | High | Detects enclosed cavities. Strategy: The Carbon rings (from 'Rings' preset) collectively form cavities on both sides. Test using `HKUST_CIF.json` (7 cavities: 1 at the centre and 6 at the peripherals) |
| XYZ export | Medium | Write `atoms[]` to XYZ string format |
| Unit cell wireframe box | Medium | Use `unitCell` params to draw 12-edge lattice box |
| Distance measurement mode | Medium | Click 2 atoms → floating Å label (non-bonded) |
| Dihedral / torsion angle | Low | 4-atom selection in poly mode |
| Coordination number in tooltip | Low | Count bonds per atom on hover |
| Supercell uses real unit cell | Medium | Use `pbcEnabled + unitCell` instead of bounding box |
| Inter-cell bond detection | Low | Connect terminal oxygens across cell boundaries |
| Animation (GIF/WebM) | Low | Capture auto-rotation frames |
| Symmetry colouring | Low | Detect C₄ equivalent atoms, colour-code them |
| Suppress tooltip in edit modes | Low | Hide atom/bond HTML tooltip when in Move, Add, Delete, or Bonds mode to reduce noise during editing |
