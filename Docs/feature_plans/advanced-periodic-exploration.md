# Feature Plan: Advanced Periodic Structure Exploration

> Status: Planned
> Priority: High
> Phase: 3
> Absorbs backlog items: "Unit cell wireframe box", "Supercell uses real unit cell", "Inter-cell bond detection"

---

## User Story

> "I want to expand the structure n-folds in all directions — from a basic SBU view all the way up to a large periodic crystal — and navigate between levels of structural hierarchy."

---

## Problem

The current supercell implementation has three hard limits that block serious periodic structure work:

1. **Fake lattice vectors**: The repeat vectors are derived from the bounding box of the base structure (with 1.5 Å padding) — not from the real CIF unit cell parameters. For HKUST-1 the bounding box approximation is close, but for lower-symmetry MOFs or distorted unit cells it produces systematically wrong tiling.

2. **Hard range limits**: X: 1–4, Y: 1–4, Z: 1–3. A researcher wanting a 6×6×6 supercell for a surface slab model or a nanopore simulation box cannot do it.

3. **Ghost-only copies**: Tiled copies are view-only with no inter-cell bonds. The bonding network is broken at cell boundaries — carboxylate oxygens at the cell edge don't connect to the Cu at the cell origin of the adjacent cell. This makes the periodic structure look chemically incorrect.

Additionally, there is no way to visualize the unit cell itself — no wireframe box, no lattice vector arrows. Researchers cannot tell at a glance where the cell boundaries are or what the cell geometry is.

---

## Goals

- Use **real unit cell vectors** (from CIF `unitCell` params) for all tiling
- Remove supercell range limits — support **arbitrary n in all directions**
- Detect and draw **inter-cell bonds** across periodic boundaries
- Draw a **unit cell wireframe box** and lattice vector arrows
- Add **structural hierarchy navigation** — move between SBU view, asymmetric unit, unit cell, and n×n×n supercell
- Keep the view interactive and smooth at realistic supercell sizes (up to ~10,000 atoms)

---

## Non-Goals

- Periodic boundary conditions in hit testing for ghost copies (ghost atoms remain non-editable)
- Defect introduction across cell boundaries
- Reciprocal space / k-point visualization (covered in DFT integration feature)

---

## Proposed Design

### 1. Real Unit Cell Vectors

#### Current state

`state.js:getLatticeVectors()` computes:

```js
const dx = maxX - minX + 3.0;  // bounding box + 2×1.5 Å padding
```

#### New implementation

When a structure was imported from CIF, `state.unitCell` contains `{a, b, c, alpha, beta, gamma}`. Convert these to 3 Cartesian lattice vectors using the same triclinic transformation matrix as `parseCIF`:

```js
export function getRealLatticeVectors() {
    const { a, b, c, alpha, beta, gamma } = state.unitCell;
    // Convert angles to radians
    const α = alpha * Math.PI / 180;
    const β = beta  * Math.PI / 180;
    const γ = gamma * Math.PI / 180;
    // Standard triclinic Cartesian transformation
    const cosα = Math.cos(α), cosβ = Math.cos(β), cosγ = Math.cos(γ);
    const sinγ = Math.sin(γ);
    const v = Math.sqrt(1 - cosα*cosα - cosβ*cosβ - cosγ*cosγ + 2*cosα*cosβ*cosγ);
    return {
        a: [a, 0, 0],
        b: [b * cosγ, b * sinγ, 0],
        c: [c * cosβ, c * (cosα - cosβ*cosγ) / sinγ, c * v / sinγ],
    };
}
```

For structures without CIF unit cell data (manually built, XYZ/MOL imports), fall back to the existing bounding-box method with a visible warning in the UI: "Unit cell not defined — using approximate bounding box. Import a CIF for exact tiling."

#### State change

Add `state.usePBCVectors: true/false` (true when `unitCell` is present and valid). The supercell rendering path uses `getRealLatticeVectors()` when `usePBCVectors` is true.

---

### 2. Unlimited Supercell Expansion

#### Controls

Replace the current fixed dropdown selectors (1–4 × 1–4 × 1–3) with integer input fields with no hard upper limit, but with a **performance warning** beyond a threshold:

```
Supercell:  [2] × [2] × [2]   ← integer inputs, min 1
            ~960 atoms  ✓

Supercell:  [8] × [8] × [8]
            ~61,440 atoms  ⚠ Large — rendering may be slow. Enable "Low-detail mode"?
```

The warning threshold is 5,000 atoms (matching the Phase 2c performance target). Above this, offer a **low-detail mode** that renders ghost atoms as small dots (radius = 2 px, no gradient) and ghost bonds as 1px lines — trades quality for framerate.

#### InstancedMesh optimization (Phase 2b dependency)

In the Canvas 2D renderer (current), large supercells are rendered atom-by-atom — O(N) per frame. This works up to ~2,000 ghost atoms before frame drops.

When Phase 2b (Three.js WebGL) lands, ghost copies switch to `THREE.InstancedMesh` — all ghost atoms of the same element type are rendered in a single GPU draw call, regardless of count. The code path is already noted in [phase-2/design.md](../phase-2/design.md). The unlimited supercell feature is designed for the WebGL backend; Canvas 2D is limited to ~2,000 ghost atoms before the low-detail warning fires.

---

### 3. Inter-Cell Bond Detection

#### Problem

At the boundary between periodic images, terminal oxygen atoms (O_term) of one cell should bond to Cu atoms of the adjacent cell. Currently these bonds are missing, making the periodic structure look like disconnected fragments at the cell boundaries.

#### Algorithm

After computing the ghost atom positions for all periodic images, run a bond detection pass across all atom pairs that span a cell boundary:

```js
function detectInterCellBonds(baseAtoms, ghostAtoms, bondThreshold = 0.4) {
    const interCellBonds = [];
    for (const ghost of ghostAtoms) {
        for (const base of baseAtoms) {
            // Only look at base Cu atoms and ghost O_term atoms (and vice versa)
            if (!isBondCandidate(base, ghost)) continue;
            const dist = v3dist(base, ghost);
            const thresh = getRAD(base.t) + getRAD(ghost.t) + bondThreshold;
            if (dist < thresh && dist > 0.4) {
                interCellBonds.push({ a: base.id, b: ghost.id, dashed: false, interCell: true });
            }
        }
    }
    return interCellBonds;
}
```

`isBondCandidate` limits the search to chemically meaningful pairs: Cu ↔ O_term, Cu ↔ O_bridge. This avoids the O(N²) all-pairs cost — with the role filter it reduces to O(N_Cu × N_O) which for HKUST-1 is ~14 × ~24 = 336 comparisons per cell pair.

Inter-cell bonds are rendered as solid bonds with a slightly different style (lighter opacity, optional dotted pattern) to distinguish them from intra-cell bonds.

---

### 4. Unit Cell Wireframe Box

#### Visual

The unit cell is rendered as a 12-edge wireframe box using the 3 real lattice vectors **a**, **b**, **c** and the 8 corners they define:

```
Corners = { origin + n_a·a + n_b·b + n_c·c | n_a, n_b, n_c ∈ {0, 1} }
```

Rendered as:
- Thin lines (1.5 px) in a neutral colour (default: `--glass-border` from the design token system)
- Corner labels: **a**, **b**, **c** arrows drawn from the origin with element-colour coding (a=red, b=green, c=blue — matching crystallographic convention)
- Optional toggle in Layers panel: `Unit cell box` / `Lattice vectors`

For non-orthogonal cells (triclinic, monoclinic), the box correctly renders as a parallelepied, not a cuboid.

For supercell views (2×2×2 etc.), the wireframe shows the **primitive** unit cell by default, with an option to show only the supercell boundary box instead.

---

### 5. Structural Hierarchy Navigation

A **hierarchy selector** in the top bar:

```
View:  [SBU]  [Asymm. Unit]  [Unit Cell]  [2×2×2 ▼]  [Custom]
```

| Level | Description |
|-------|-------------|
| **SBU** | The paddle-wheel secondary building unit (hand-built default or user-defined selection) |
| **Asymm. Unit** | The crystallographic asymmetric unit — the minimal set of atoms from which the full structure is generated by symmetry operations. Loaded from CIF data. |
| **Unit Cell** | Full unit cell — all symmetry-equivalent atoms in the primitive cell (what `parseCIF` currently produces) |
| **n×n×n** | Arbitrary supercell. Drives the supercell expansion controls. |
| **Custom** | User-defined view state (saved viewport + layer config) |

Switching levels is non-destructive: it changes the rendering scope but does not modify `atoms[]`. The base `atoms[]` always represents the asymmetric unit; symmetry expansion and supercell tiling are rendering operations.

This requires tracking which atoms belong to the asymmetric unit (flagged during CIF import as `asymm: true`) vs. which are symmetry-generated copies. CIF-imported structures already have this information available during `parseCIF` — it just needs to be persisted.

---

## Implementation Plan

### New files

| File | Purpose |
|------|---------|
| `app/periodic.js` | Real lattice vector math, inter-cell bond detection, supercell atom generation, asymmetric unit filtering (~200 lines) |

### Changes to existing files

| File | Change |
|------|--------|
| `app/state.js` | Add `unitCellVectors` (computed from `unitCell` on CIF load); add `usePBCVectors` flag; extend `supercellNx/Ny/Nz` range from fixed dropdowns to arbitrary integers; add `showUnitCellBox` flag; add `asymmUnitOnly` flag |
| `app/renderer.js` | Draw unit cell wireframe box when `showUnitCellBox`; use `periodic.js:getSupercellAtoms()` for ghost rendering; draw inter-cell bonds; draw lattice vector arrows |
| `app/ui.js` | Replace supercell dropdowns with integer inputs + performance warning; add hierarchy selector buttons; wire unit cell box toggle |
| `app/index.html` | Add hierarchy selector to top bar; update supercell controls in inspector |
| `app/state.js:parseCIF` | Tag asymmetric unit atoms with `asymm: true` before applying symmetry ops |

### Performance budget for Canvas 2D renderer

| Supercell size | Ghost atoms (HKUST-1 ~120 base) | Canvas 2D feasibility |
|---|---|---|
| 2×2×2 | ~840 | ✓ Smooth |
| 3×3×3 | ~2,940 | ✓ With low-detail mode |
| 4×4×4 | ~6,960 | ⚠ Requires low-detail + Phase 2c |
| 6×6×6 | ~23,400 | ✗ Requires Phase 2b WebGL InstancedMesh |
| 10×10×10 | ~118,800 | ✗ Requires Phase 2b + 2c |

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | What if `unitCell` is not present (XYZ/MOL import)? | Fall back to bounding-box vectors with a warning banner. Supercell range capped at 4×4×3 in this mode. |
| 2 | Should inter-cell bonds be editable? | No — they are ghost bonds computed from tiling, not stored in `bonds[]`. Editing is only for the base cell. |
| 3 | How to define the SBU view for non-HKUST structures? | Default: the asymmetric unit. User can save any selection as "SBU" in a named view state. |
| 4 | Should the unit cell wireframe rotate with the molecule? | Yes — it is part of the 3D scene, transforms with the same rotation matrix as atoms. |
| 5 | For very large supercells, should atoms be culled off-screen? | Yes (Phase 2b) — Three.js frustum culling handles this automatically. For Canvas 2D, add a bounding sphere check per ghost atom. |

---

## Verification

- [ ] Import HKUST_CIF.json, enable 2×2×2 supercell — verify tiling uses real `unitCell` vectors, not bounding box
- [ ] Enable unit cell wireframe — verify correct parallelpiped shape for HKUST-1 (cubic, should look like a cube)
- [ ] Enable inter-cell bonds — verify Cu–O connections appear at cell boundaries
- [ ] Set supercell to 6×6×6 — verify performance warning fires, low-detail mode available
- [ ] Switch hierarchy to "Asymm. Unit" — verify only asymmetric unit atoms shown (no symmetry copies)
- [ ] Switch hierarchy to "Unit Cell" — verify full cell renders correctly
- [ ] Import a triclinic CIF — verify unit cell wireframe renders as correct parallelpiped, not a cuboid
