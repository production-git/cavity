# Geometric Pore Characterization

**Status:** Planned  
**Priority:** High  
**Phase:** 3

---

## Problem

Surface area and pore size are the two primary metrics reported in every MOF publication. Researchers currently must export the structure and run external tools (Zeo++, RASPA, iRASPA) to get these numbers. The cavity detection is already implemented (`state.js:getCavitySpheres`) — this feature adds the analytical layer on top.

## Goal

Compute and display key pore geometry metrics directly in the browser, derived from the existing atom positions and cavity spheres. Values should be copyable for use in papers.

## Metrics to Compute

| Metric | Symbol | Method |
|--------|--------|--------|
| Geometric surface area | SA | Sum of exposed atom surface patches (probe radius 1.82 Å for N₂) |
| Pore limiting diameter | PLD | Diameter of the largest sphere that fits through the narrowest channel |
| Largest cavity diameter | LCD | Diameter of the largest sphere that fits anywhere in the pore |
| Accessible pore volume | PV | Fraction of unit cell volume accessible to a probe sphere |
| Void fraction | ε | PV / unit cell volume |

**Accuracy note:** These are fast geometric estimates, not grand-canonical MC results. Suitable for screening and cross-checking, not for publication-grade isotherms.

## Implementation Plan

1. **`math3d.js`** — add probe-accessible surface helpers
   - `probeAccessibleSurface(atoms, probeR)` — Monte Carlo point sampling on each atom's van der Waals surface, counting exposed fraction
   - `largestEmptySphere(atoms, vdwR, cellBounds)` — grid search for max-radius empty sphere (LCD)
   - `channelDiameter(cavitySpheres)` — min diameter along connected cavity path (PLD)

2. **`state.js`** — add `getPoreMetrics()`
   - Calls `getCavitySpheres()` for cavity geometry
   - Calls math3d helpers with element radii from `ELEMENTS`
   - Returns `{ sa, pld, lcd, pv, voidFraction }` object

3. **`ui.js`** — add "Pore Analysis" section to the control panel
   - "Calculate" button triggers `getPoreMetrics()` (may take ~1s for large cells)
   - Display results in a small table with units (Å, Å², cm³/g)
   - "Copy as CSV" copies all values for pasting into spreadsheets/papers

4. **`renderer.js`** — optionally highlight the LCD sphere in the viewport (reuse cavity sphere rendering)

## Probe Radii (defaults)

| Probe | Radius |
|-------|--------|
| N₂ (BET) | 1.82 Å |
| CO₂ | 1.65 Å |
| H₂O | 1.40 Å |
| H₂ | 1.45 Å |

User-selectable from a dropdown.

## Validation

- HKUST-1 known values: SA ≈ 1850 m²/g, PLD ≈ 6.9 Å, LCD ≈ 13.2 Å, ε ≈ 0.49
- Computed values should be within 10% of literature for the default HKUST-1 structure

## Non-Goals

- Grand-canonical Monte Carlo adsorption isotherms (requires RASPA)
- Helium void fraction (requires force fields)
- Multi-component pore networks

## Links

- `state.js:getCavitySpheres` (line 290) — existing cavity computation
- `math3d.js:convexHull3DFaces` (line 110) — geometry primitive to reuse
- [cavity-preset-plan.md](./cavity-preset-plan.md) — completed cavity detection
