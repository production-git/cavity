# Structural Analysis Panel

**Status:** Planned  
**Priority:** High  
**Phase:** 3

---

## Problem

Researchers need bond lengths, bond angles, coordination numbers, and coordination geometry for selected atoms to write papers and validate structures. These are currently scattered as low-priority backlog items (distance measurement, coordination number in tooltip, dihedral angle). Implemented together as a persistent analysis panel, they form a core research tool — the values are what goes into a paper's supplementary data tables.

## Goal

A collapsible side panel that shows live structural data for the current atom selection — no separate mode switching required.

## Panel Sections

### 1. Single-atom selected

- Element, label, coordinates (Cartesian + fractional)
- Coordination number (bond count)
- Bond lengths to each neighbor (Å), sorted ascending
- Coordination geometry classification: linear / trigonal-planar / tetrahedral / square-planar / octahedral / paddlewheel — based on angles between neighbor vectors
- Average bond length ± std dev

### 2. Two atoms selected

- Interatomic distance (Å) — bonded or non-bonded
- Whether a bond exists between them

### 3. Three atoms selected

- Bond angle at the middle atom (degrees)
- Labels: atom1–atom2(vertex)–atom3

### 4. Four atoms selected

- Dihedral / torsion angle (degrees)

### 5. Multiple atoms selected (>4)

- Count, element composition breakdown
- Center of mass coordinates
- Bounding box dimensions

## Implementation Plan

1. **`math3d.js`** — add pure geometry helpers
   - `bondAngle(p1, vertex, p2)` → degrees
   - `dihedralAngle(p1, p2, p3, p4)` → degrees
   - `classifyCoordGeometry(neighborVectors)` → string label + confidence

2. **`state.js`** — add `getSelectionAnalysis(selectedIds)`
   - Reads `app.atoms`, `app.bonds`
   - Returns the appropriate analysis object based on selection count
   - Pure function — no side effects

3. **`ui.js`** — add `AnalysisPanel` component
   - Renders inside a collapsible `<aside>` on the right side of the canvas
   - Subscribes to selection change events; calls `getSelectionAnalysis()` on every change
   - "Copy table" button: copies formatted Markdown table of values to clipboard
   - "Copy CSV" button: copies raw CSV for spreadsheet import

4. **`styles.css`** — panel layout
   - Collapsible side drawer, consistent with existing glassmorphism style (Phase 2d)
   - Monospace font for coordinate/measurement values

## Copy Format

**Markdown (for papers/notes):**
```
| Pair | Distance (Å) |
|------|-------------|
| Cu1–O1 | 1.943 |
| Cu1–O3 | 1.951 |
...
```

**CSV (for spreadsheets):**
```
pair,distance_angstrom
Cu1-O1,1.943
Cu1-O3,1.951
```

## Validation

- HKUST-1 Cu–O bond lengths should be 1.94–1.97 Å
- Cu–Cu paddlewheel distance should be ~2.63 Å
- O–Cu–O angles should be ~89–91° for square-planar coordination

## Replaces / Supersedes

This feature consolidates and closes the following backlog items:
- "Distance measurement mode"
- "Dihedral / torsion angle"
- "Coordination number in tooltip"

Those items can be removed from the backlog once this panel ships.

## Links

- `math3d.js` — geometry primitives to extend
- `state.js:app.selection` — current selection state
- `renderer.js:hitTest` (line 57) — selection entry point
- [application_design.md](../application_design.md) — module responsibilities
