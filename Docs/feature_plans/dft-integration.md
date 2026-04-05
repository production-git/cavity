# Feature Plan: DFT Results Integration & Visualization

> Status: Planned
> Priority: High
> Phase: 3 (partial) / Phase 4 (volumetric)
> Depends on: Phase 2b (Three.js WebGL) for isosurface rendering
> Related: [advanced-periodic-exploration.md](./advanced-periodic-exploration.md) (reciprocal space)

---

## User Story

> "I want comprehensive engineering capabilities — including Density Functional Theory (DFT) — to understand the electronic structure, vibrational properties, and charge distribution of HKUST-1 and its doped/functionalized variants."

---

## Problem

Researchers studying MOFs for engineering applications (CO₂ capture, heavy metal removal, doping) routinely run DFT calculations using VASP, Quantum ESPRESSO (QE), CP2K, or ORCA. These calculations produce rich data: optimized geometries, partial charges, atomic forces, vibrational modes, density of states, charge density maps. Currently, this data lives in text files or is viewed in heavyweight standalone software (VESTA, iRASPA, OVITO). There is no lightweight, browser-based tool that combines structural editing with DFT result visualization in one place.

The goal is to make the HKUST-1 editor a **result visualization layer** on top of DFT output — not a calculation engine. Users run the DFT externally, import the results, and use this tool to interpret and communicate them.

---

## Goals

- Import DFT output files from the four most common codes: VASP, Quantum ESPRESSO, CP2K, ORCA
- Visualize five categories of DFT results overlaid on the 3D structure:
  1. Optimized geometry (replace current atomic positions with DFT-relaxed ones)
  2. Partial charges → atom colour mapped by charge value
  3. Atomic forces → force vector arrows on each atom
  4. Vibrational modes → animated normal mode displacement
  5. Volumetric data (electron density, charge density difference, ESP) → isosurface (requires Phase 2b WebGL)
- Density of States (DOS/pDOS) as a 2D chart panel alongside the 3D view
- Stay fully client-side — all parsing done in the browser, no upload

---

## Non-Goals

- Running DFT calculations (requires a compute engine — use VASP, QE, etc. externally)
- Band structure visualization (complex k-path setup — Phase 4)
- NMR / EPR / XAS spectra simulation
- Force field / molecular mechanics

---

## Scope Split by Phase

| Capability | Phase | Requirement |
|-----------|-------|-------------|
| Geometry import (CONTCAR, POSCAR, .xyz) | 3 | Canvas 2D ✓ |
| Partial charges (Bader, Mulliken, Hirshfeld) | 3 | Canvas 2D ✓ |
| Atomic forces | 3 | Canvas 2D ✓ |
| Vibrational mode animation | 3 | Canvas 2D ✓ |
| DOS / pDOS chart | 3 | Canvas 2D ✓ |
| Electron density isosurface | 4 | Requires Phase 2b WebGL (marching cubes) |
| Charge density difference isosurface | 4 | Requires Phase 2b WebGL |
| Electrostatic potential (ESP) coloured surface | 4 | Requires Phase 2b WebGL |

This document covers Phase 3 capabilities in full and Phase 4 in outline.

---

## Supported File Formats

### VASP

| File | Contains | Parser |
|------|---------|--------|
| `POSCAR` / `CONTCAR` | Atomic positions (fractional or Cartesian), cell vectors | `parsePOSCAR()` |
| `OUTCAR` | Forces, charges (Bader after `bader` post-processing), vibrational frequencies and eigenvectors, total energy | `parseOUTCAR()` |
| `DOSCAR` | Total DOS and projected DOS per atom and orbital | `parseDOSCAR()` |
| `CHGCAR` | Charge density volumetric data (3D grid) | `parseCHGCAR()` — Phase 4 |
| `LOCPOT` | Local electrostatic potential (3D grid) | `parseLOCPOT()` — Phase 4 |

### Quantum ESPRESSO

| File | Contains | Parser |
|------|---------|--------|
| `.out` (pw.x output) | Optimized geometry (final coordinates section), forces, total energy, normal modes (if phonon calc) | `parseQEOut()` |
| `dos.dat` | Total DOS | `parseQEDOS()` |
| `pdos_atm_...` | Projected DOS per atom/orbital | `parseQEPDOS()` |
| `.cube` (pp.x output) | Volumetric density data (Gaussian cube format) | `parseCube()` — Phase 4 |

### CP2K

| File | Contains | Parser |
|------|---------|--------|
| `.xyz` (restart) | Optimized geometry | standard XYZ parser (already exists) |
| `.out` (main output) | Forces, Mulliken/Hirshfeld charges, Wiberg bond orders, total energy | `parseCP2KOut()` |
| `.cube` | Volumetric density | `parseCube()` — Phase 4 |

### ORCA

| File | Contains | Parser |
|------|---------|--------|
| `.out` | Mulliken/Loewdin charges, forces, vibrational frequencies and eigenvectors, NBO bond orders | `parseORCAOut()` |

All parsers run in the browser using `FileReader` API — no server needed. Files are read as text strings and parsed with regex/line-by-line logic.

---

## DFT Property Visualizations

### 1. Geometry Import

After import, the DFT-optimized atomic positions replace the current atom positions in `atoms[]`. Bond lengths are recalculated. A before/after toggle lets the user flip between the original and DFT-relaxed geometry:

```
[Original]  [DFT optimized]   Δmax = 0.12 Å  (max atomic displacement)
```

The difference vectors (original → optimized) can optionally be drawn as grey arrows on each atom to show where the structure relaxed.

### 2. Partial Charge Visualization

**Charge types supported**: Bader (VASP), Mulliken (QE/ORCA/CP2K), Hirshfeld (CP2K/ORCA), Natural Population Analysis (NPA, ORCA)

Atom colour is mapped through a **diverging colormap** from negative to positive charge:
- Blue → negative (excess electron density, electron-rich sites: O atoms typically −1.0 to −1.5 e)
- White → neutral
- Red → positive (electron-poor sites: Cu typically +1.0 to +1.5 e, C_carb +0.6 e)

A **charge legend** is drawn in the corner:

```
─────────────────────
  -1.5e   0   +1.5e
  [====|=====|====]
  Blue  White  Red
─────────────────────
Bader charges (VASP)
Range: -1.48e to +1.41e
```

Users can adjust the colour range endpoints with a min/max slider to reveal subtle variations.

Hovering an atom shows its charge value in the atom tooltip: `Cu (id:0): +1.32e (Bader)`

### 3. Atomic Forces

Force vectors are drawn as arrows on each atom, pointing in the direction of the DFT-computed force (negative gradient of energy):

- Arrow length = `|F| × scale_factor` (scale_factor adjustable via a slider)
- Arrow colour: red for large magnitude, yellow for medium, green for small (relative to the maximum force in the structure)
- A **force legend** shows the scale: `1 Å arrow = X eV/Å`
- Forces are typically shown for the un-relaxed geometry (initial structure) to illustrate where the structure wants to move — or for the relaxed geometry to confirm convergence (all forces ≈ 0)

```
Max force: 0.48 eV/Å (atom 3, Cu)
RMS force: 0.12 eV/Å
Conv. threshold: < 0.02 eV/Å  ✗ Not converged
```

### 4. Vibrational Mode Animation

From a frequency calculation (VASP OUTCAR `IBRION=5/6`, QE phonon output, ORCA `FREQ`):

- A mode list panel shows all N×3 modes sorted by frequency (cm⁻¹), grouped by IR-active / Raman-active / silent
- The user selects a mode → the atoms oscillate along the displacement eigenvector with a sinusoidal amplitude
- Animation: `atom.pos = equilibrium + A × eigenvector × sin(2π × t / period)` where A is adjustable (default 0.3 Å)
- Frequency annotation: `Mode 42: 1560 cm⁻¹ (IR active) — C=O stretch`

Mode identification: common functional groups have characteristic frequency ranges. The app labels modes automatically:
- < 200 cm⁻¹ → lattice / Cu–Cu torsion
- 200–500 cm⁻¹ → Cu–O stretch / deformation
- 500–1000 cm⁻¹ → ring deformation / C–C stretch
- 1000–1700 cm⁻¹ → C–O, C=O, C–N stretch
- > 2500 cm⁻¹ → C–H, O–H, N–H stretch

### 5. Density of States (DOS / pDOS)

A **2D chart panel** displayed as a slide-in drawer from the bottom edge of the viewport (does not obscure the 3D view):

```
┌──────────────────────────────────────────────────────────────┐
│  Density of States              [Total] [Projected] [Close]  │
│                                                              │
│  E                                                           │
│  (eV) │    ░░                ████                           │
│     2 │   ░░░░              ██████                          │
│     1 │  ░░░░░░    ████    ████████                         │
│  Eᶠ━━━│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│    -1 │  ░░░░░░░░ ████████████████████████                  │
│    -2 │  ░░░░░░░░ ████████████████████████                  │
│       └──────────────────────────────────────────── DOS      │
│       Legend:  ░ Total   █ Cu-d   ■ O-p   ▪ C-p            │
│       Band gap: 2.1 eV                                       │
└──────────────────────────────────────────────────────────────┘
```

- Drawn on a Canvas 2D element (separate from the 3D canvas) — zero chart library dependency
- X axis: DOS (states/eV), Y axis: Energy relative to Fermi level (eV)
- Total DOS (filled area) + projected DOS per species/orbital (coloured lines)
- Fermi level marked as horizontal dashed line
- Band gap annotation (for semiconductors/insulators)
- Hover on the chart: vertical crosshair + tooltip showing energy, DOS value, and orbital breakdown

**Projected DOS atom selection**: when the user clicks an atom in the 3D view while the DOS panel is open, the pDOS curve for that specific atom is highlighted in the chart. This enables comparison of Cu pDOS between a pure-Cu node and a doped-Fe node.

---

## Phase 4: Volumetric Data (Requires WebGL)

Outlined here for planning; implementation deferred to Phase 4.

### Isosurface Rendering

VASP `CHGCAR`, QE/CP2K `.cube` files contain 3D volumetric scalar fields on a regular grid. Visualized as isosurfaces using the **marching cubes algorithm** rendered as Three.js `BufferGeometry` meshes:

| Volume type | Isosurface interpretation |
|-------------|--------------------------|
| Electron density (`CHGCAR`) | Total electron density at isovalue 0.01 e/Å³ |
| Charge density difference (CHGCAR_diff = CHGCAR_complex − CHGCAR_MOF − CHGCAR_guest) | Shows electron transfer on adsorption: blue lobes = electron gain, red lobes = electron loss |
| Electrostatic potential (`LOCPOT`) | ESP coloured on the electron density isosurface: red = negative (nucleophilic), blue = positive (electrophilic) |

Controls:
- Isovalue slider: drag to increase/decrease the isosurface level
- Opacity: 0–100% for the isosurface mesh
- Dual isovalue: show both positive and negative isovalue surfaces simultaneously (standard for charge density difference)

The isosurface is rendered at a fixed resolution (the CHGCAR grid, typically 48×48×48 for HKUST-1) and is not interpolated. For large grids (>128³), render at half resolution with a toggle to full resolution.

---

## Implementation Plan (Phase 3)

### New files

| File | Purpose |
|------|---------|
| `app/dft-parsers.js` | All format-specific parsers: `parsePOSCAR`, `parseOUTCAR`, `parseDOSCAR`, `parseQEOut`, `parseQEDOS`, `parseCP2KOut`, `parseORCAOut` (~400 lines total) |
| `app/dft-viz.js` | Visualization state and draw helpers: charge colormap, force arrows, mode animation loop, DOS canvas renderer (~250 lines) |

### Changes to existing files

| File | Change |
|------|--------|
| `app/state.js` | Add `dftData` object: `{charges, forces, modes, dos, source}`; add mutators; add `dftVizMode` enum |
| `app/renderer.js` | Overlay charge colours when `dftVizMode === 'charges'`; draw force arrows when `dftVizMode === 'forces'`; pass atom position offsets for mode animation |
| `app/ui.js` | Bind DFT import button; bind mode list panel; bind DOS drawer; wire atom click → pDOS highlight |
| `app/index.html` | Add "Import DFT" button in top bar; add DOS drawer element; add mode list panel |

### `dft-parsers.js` parser contract

Each parser returns a normalized `DFTResult` object — the visualization layer never reads format-specific fields:

```js
// Normalized result schema — all fields optional
{
    source: 'VASP' | 'QE' | 'CP2K' | 'ORCA',
    geometry: [{ x, y, z, element }],           // optimized positions, same order as atoms[]
    charges:  [{ atomIndex, value, type }],     // e.g. [{atomIndex: 0, value: 1.32, type: 'Bader'}]
    forces:   [{ atomIndex, fx, fy, fz }],      // eV/Å
    modes:    [{ freq, irActive, ramanActive, displacements: [{dx, dy, dz}] }],
    dos:      { energies, total, projected: [{element, orbital, values}] },
    energy:   { total, fermi },                 // eV
}
```

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | How to handle atom index mismatch between DFT output and current `atoms[]`? | Match by element and proximity (nearest-neighbour mapping). If unambiguous match fails, show a dialog: "N atoms could not be matched — check that the DFT structure corresponds to the currently loaded model." |
| 2 | Should the charge colormap range be auto-scaled or fixed? | Auto-scaled to the actual charge range, with manual override sliders. |
| 3 | What if OUTCAR is very large (>100 MB for large supercell runs)? | Parse lazily — stream line by line, stop after finding the relevant sections. Use `FileReader.readAsText` in chunks. |
| 4 | Should DOS be shown for doped structures with different atom types? | Yes — pDOS naturally separates by atom type. Doped atoms (Fe, Zn etc.) get their own pDOS colour in the chart. |
| 5 | Should vibrational mode animation pause/continue supercell rendering? | Yes — during mode animation, supercell ghost positions are not recomputed (too expensive). Ghost display is temporarily suspended during animation. |

---

## Verification

Phase 3:
- [ ] Import VASP POSCAR for HKUST-1 — verify positions load correctly, bond lengths match
- [ ] Import OUTCAR with Bader charges — verify Cu atoms colour red, O atoms blue, charge values in tooltips
- [ ] Import forces — verify arrows appear on each atom, arrow length proportional to magnitude
- [ ] Import vibrational modes — verify mode list shows, animation plays on mode selection
- [ ] Import DOSCAR — verify DOS chart renders, Fermi level marked, band gap annotated
- [ ] Click atom while DOS open — verify pDOS for that atom highlighted
- [ ] Import QE `.out` file — verify geometry + charges load via QE parser
- [ ] Atom index mismatch scenario — verify error dialog appears with clear message
