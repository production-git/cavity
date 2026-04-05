# CIF Export

**Status:** Planned  
**Priority:** High  
**Phase:** 3

---

## Problem

The app can import CIF files (`state.js:parseCIF`) but has no export path back to CIF. Every structure built or edited here is a dead end — it cannot be submitted to crystallographic databases (CCDC/CSD), fed into simulation codes (RASPA, VASP, LAMMPS), or shared with collaborators using standard crystallography tools.

## Goal

Write a `serializeCIF()` function in `state.js` that converts the current `atoms[]` / `bonds[]` state into a valid CIF string, and expose it as a download button in the UI.

## CIF Output Requirements

- Standard `data_` block header with compound name
- `_cell_*` parameters: `a`, `b`, `c`, `alpha`, `beta`, `gamma` — derived from the bounding box of atom coordinates or stored if parsed from an original CIF
- `_symmetry_space_group_name_H-M` — default `'P 1'` (no symmetry assumed unless known)
- `_atom_site_*` loop: `label`, `type_symbol`, `fract_x`, `fract_y`, `fract_z`
- Fractional coordinates computed from Cartesian via the stored unit cell matrix (or an identity mapping if no cell is set)

## Implementation Plan

1. **`state.js`** — add `serializeCIF()`
   - If a unit cell was parsed from the source CIF, store `app.cell = { a, b, c, alpha, beta, gamma, matrix }` during `parseCIF()`
   - Convert Cartesian → fractional using the inverse cell matrix
   - If no cell is stored, output a cubic cell sized to the atom bounding box
   - Generate the CIF string with correct loop_ syntax

2. **`ui.js`** — Convert the existing "Export" to a drop down with "CIF", "JSON" and "PNG" replacing existing "Export PNG" & "Export"(Json)
   - Calls `serializeCIF()`, creates a Blob, triggers download as `structure.cif`

3. **`scripts/cif_to_json.py`** — optionally add a `json_to_cif.py` mirror for batch conversion

## Validation

- Export HKUST-1 default → re-import → atom count and positions match within 0.001 Å
- Exported CIF passes CIF validator (e.g. `checkCIF` or `enCIFer`)
- Works for structures parsed from `models/CIF/2300380.cif` and manually built structures

## Non-Goals

- Symmetry reduction (SHELX-style) — output P1 only
- Bond section in CIF (`_geom_bond_*`) — out of scope for v1

## Links

- `state.js:parseCIF` (line 621) — the import counterpart
- `state.js:serializeStructure` (line 705) — JSON serialization pattern to follow
- [application_design.md](../application_design.md) — CIF pipeline section
