# Feature Plan: Guest Molecule Interaction & Ligand Functionalization

> Status: Planned
> Priority: High
> Phase: 3

---

## User Story

> "I am a researcher working on engineering Copper MOFs for a cleaner environment — ligand and metal ion modulation for CO₂ capture and heavy metal removal. I want to visualize ligand modification and the interaction of these molecules with other objects such as CO₂ or heavy metals."

---

## Problem

HKUST-1 and its derivatives are promising candidates for CO₂ capture and heavy metal remediation (Pb²⁺, Cd²⁺, Hg²⁺, As³⁺). The key design levers are:

1. **Ligand functionalization** — adding electron-donating or electron-withdrawing groups (-NH₂, -OH, -SO₃H) to the BTC aromatic ring changes the pore chemistry, selective affinity, and binding strength.
2. **Guest molecule interaction** — visualizing where and how CO₂ or heavy metal ions sit inside the pore, how close they get to the Cu node and carboxylate oxygens, and how many can fit per cavity.

Without these tools, researchers must either use heavyweight DFT software or rely on static literature figures. An interactive structural editor that shows the geometric picture — interaction distances, pore occupancy, cavity accessibility — closes the gap between raw CIF data and chemical intuition.

---

## Goals

- Let users add functional groups to BTC ligand ring carbons (ligand functionalization)
- Provide a built-in guest molecule library (CO₂, H₂O, N₂, CH₄, common heavy metal hydrated ions)
- Let users place guest molecules inside cavities and see interaction geometry
- Show interaction distances, potential coordination/H-bond sites, and cavity occupancy
- Remain fully client-side and zero-dependency

---

## Non-Goals

- Binding energy calculation (DFT/MM — requires a computational engine)
- Molecular dynamics or trajectory simulation
- Charge assignment or force field parameterisation

---

## Proposed Design

### Part 1 — Ligand Functionalization

#### Concept

The BTC linker has six unsubstituted ring carbons (positions 2, 4, 6 on three rings). A functional group is placed on a selected ring carbon, offset from the ring plane along the C–H direction. The app supports a fixed library of common substituents.

#### Substituent Library

| Group | Symbol | Atoms added | Key property |
|-------|--------|-------------|--------------|
| Amino | -NH₂ | N + 2H | H-bond donor; CO₂ chemisorption site |
| Hydroxyl | -OH | O + H | H-bond donor/acceptor |
| Sulfonate | -SO₃H | S + 3O + H | Strong acid; heavy metal chelator |
| Fluoro | -F | F | Electron-withdrawing; hydrophobic tuning |
| Methyl | -CH₃ | C + 3H | Electron-donating; pore size reduction |
| Nitro | -NO₂ | N + 2O | Electron-withdrawing; Lewis acid enhancement |
| Carboxyl | -COOH | C + 2O + H | Additional metal-binding site |

#### Interaction Model

1. User enters **Functionalize mode** (new mode or sub-panel of Edit Bonds)
2. Click a ring carbon atom (`C_arom` role) → a substituent picker appears
3. User selects a group from the library
4. App computes the attachment direction: normalized vector from ring centroid → selected carbon, extended past the carbon
5. App places substituent atoms at standard bond lengths from the selected carbon (C–N: 1.47 Å, C–O: 1.36 Å, C–S: 1.77 Å, etc.)
6. New atoms added with `role: "ligand_func"`, `plane: ""`, custom element type
7. Bonds auto-created between selected carbon and substituent root atom
8. `saveState()` called before placement → full undo support

Multiple substituents can be added to different ring carbons. The same ring carbon cannot have two substituents (validation check).

---

### Part 2 — Guest Molecule Library & Placement

#### Built-in Guest Molecule Library

Each molecule is defined as a small atom+bond template that can be instantiated at a target position.

| Guest | Formula | Representation | Research relevance |
|-------|---------|----------------|--------------------|
| Carbon dioxide | CO₂ | O=C=O, linear, C–O: 1.16 Å, angle: 180° | Primary CO₂ capture target |
| Water | H₂O | H–O–H, angle: 104.5°, O–H: 0.96 Å | Competing adsorbate; stability |
| Nitrogen | N₂ | N≡N, linear, N–N: 1.10 Å | Selectivity benchmark |
| Methane | CH₄ | tetrahedral, C–H: 1.09 Å | CH₄ storage |
| Lead(II) ion | Pb²⁺·6H₂O | octahedral aqua complex | Heavy metal remediation |
| Cadmium(II) ion | Cd²⁺·4H₂O | tetrahedral aqua complex | Heavy metal remediation |
| Mercury(II) ion | Hg²⁺·2H₂O | linear aqua complex | Heavy metal remediation |
| Copper(II) ion | Cu²⁺ | bare ion (competing metal) | Metal uptake |

Heavy metal ions are represented as their most common aqua complexes — the geometry the ion presents to the MOF pore wall.

#### Placement Workflow

1. User opens **Guest Molecules** panel
2. Selects a molecule from the library
3. A "ghost" preview of the molecule follows the cursor, attached to the mouse position inside the structure
4. Click to place — the molecule's centroid snaps to the nearest cavity centre (from `getCavitySpheres()`) or to the exact cursor position if no cavity is nearby
5. Guest atoms are added to `atoms[]` with `role: "guest"`, `plane: "guest"` — rendered with distinct styling (lower opacity, dashed outer border)
6. Multiple placements allowed

#### Interaction Geometry Display

When the cursor hovers near a placed guest molecule, the app draws:

- **Proximity lines** (dashed, cyan): from each guest atom to any MOF atom within 4 Å, labelled with distance in Å
- **Interaction type badge**: a small label at the midpoint classifying the interaction:
  - `coord` — within coordination distance of Cu (< 2.5 Å from Cu)
  - `H-bond` — H donor–acceptor pair within 3.5 Å with appropriate geometry
  - `vdW` — within van der Waals contact (< sum of vdW radii + 0.5 Å)
  - `π-stack` — guest centroid within 4 Å of ring centroid, near-parallel

#### Cavity Occupancy

When the Cavities preset is active, each cavity sphere shows a **fill indicator**: how many of the placed guest molecules have their centroid within the cavity radius. Displayed as a number badge on the cavity sphere.

A **pore occupancy panel** shows:

```
Central cavity (r = 4.21 Å)
  CO₂ molecules placed: 2
  Estimated max occupancy: ~3  (based on CO₂ kinetic diameter 3.3 Å vs. cavity diameter 8.42 Å)

Peripheral cavities (avg r = 3.87 Å, ×6)
  CO₂ molecules placed: 0
  Estimated max: ~2 each
```

Max occupancy is estimated geometrically: `floor((2r / d_kinetic)³ × packing_factor)` where packing factor = 0.64 (random close packing). This is a geometric estimate only, not a thermodynamic one.

---

## Visual Styling

| Element | Rendering |
|---------|-----------|
| Functionalized atoms (`ligand_func`) | Same colour as element, but with a small yellow triangle marker above the atom |
| Guest atoms (`guest`) | 60% opacity fill, dashed atom border (2px), distinct per-molecule hue tint |
| Proximity lines | Cyan dashed line, 1.5px, labelled with Å value |
| Interaction badge | Small rounded pill at line midpoint: `coord` blue, `H-bond` green, `vdW` grey, `π-stack` purple |
| Cavity occupancy badge | White number on the cavity sphere, centred |

---

## Implementation Plan

### New files

| File | Purpose |
|------|---------|
| `app/guests.js` | Guest molecule template library + instantiation logic (~100 lines) |

### Changes to existing files

| File | Change |
|------|--------|
| `app/state.js` | Add `addFunctionalGroup(atomId, groupKey)` and `placeGuest(moleculeKey, pos)` functions; add `guests[]` array to state; add `getInteractionLines(guestAtomId)` for proximity analysis |
| `app/renderer.js` | Render guest atoms with dashed border + reduced opacity; draw proximity lines and interaction badges on hover; draw cavity occupancy badge |
| `app/ui.js` | Bind Guest Molecules panel; bind Functionalize tool; wire interaction display on hover |
| `app/index.html` | Add guest molecule panel to inspector; add functionalize mode button |

### `guests.js` template format

```js
export const GUEST_TEMPLATES = {
  CO2: {
    label: 'CO₂',
    atoms: [
      { dx: -1.16, dy: 0, dz: 0, t: 'O', role: 'guest' },
      { dx:  0,    dy: 0, dz: 0, t: 'C', role: 'guest' },
      { dx:  1.16, dy: 0, dz: 0, t: 'O', role: 'guest' },
    ],
    bonds: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
    kineticDiameter: 3.3,  // Å
    color: '#f97316',       // orange tint for guest rendering
  },
  Pb_aqua: {
    label: 'Pb²⁺·6H₂O',
    atoms: [ /* octahedral water shell around Pb */ ],
    bonds: [],
    kineticDiameter: 4.8,
    color: '#6366f1',
  },
  // ...
};
```

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should guest molecules be included in JSON export? | Yes — serialise as atoms with `role: "guest"`. Flag in UI that these are non-structural. |
| 2 | What if the user places a guest that overlaps a MOF atom? | Show a red clash indicator (⚠ overlap < 1.0 Å) but do not block placement — researcher may want to explore forced configurations. |
| 3 | Should functionalization validate chemically correct substitution positions? | Minimal validation: block placement on Cu, O_bridge, C_carb (non-ring) atoms. Allow on C_arom only. |
| 4 | How to handle export for downstream DFT use? | XYZ export (already in backlog) will export the full structure including guests and functional groups. |

---

## Verification

Manual tests:
- [ ] Add -NH₂ to a BTC ring carbon — verify correct geometry and bond created
- [ ] Attempt to add substituent to Cu atom — verify blocked with clear error
- [ ] Place CO₂ inside central cavity — verify snaps to cavity centre, proximity lines appear on hover
- [ ] Place Pb²⁺ aqua complex — verify octahedral geometry renders correctly
- [ ] Verify cavity occupancy count increments as guests are placed
- [ ] Undo placement of functional group — verify atoms/bonds removed cleanly
- [ ] Export JSON with guests — verify guest atoms flagged in output
