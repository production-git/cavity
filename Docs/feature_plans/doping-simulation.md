# Feature Plan: Doping Simulation

> Status: Planned
> Priority: High
> Phase: 3

---

## User Story

> "I want to see what happens when I introduce doping in the HKUST molecule — for example, replacing Cu atom(s) with Fe."

---

## Problem

HKUST-1 is a Cu-based MOF, but researchers commonly study the effect of replacing metal nodes with other transition metals (Fe, Zn, Co, Ni, Cr) — a process called **metal doping** or **mixed-metal synthesis**. Currently the editor supports manual atom editing (Add/Delete mode) but has no systematic way to substitute one element type for another, analyse the structural impact, or visualise the doped sites distinctly. Without this, studying doping requires tedious manual work and provides no immediate structural feedback.

---

## Goals

- Let users substitute one element type for another — selectively or systematically
- Immediately visualise which atoms are doped (distinct highlight)
- Show structural impact: bond length changes, coordination environment shifts, cavity size changes
- Support undo (uses existing stack — non-destructive)
- Export the doped structure for computational chemistry downstream

---

## Non-Goals

- DFT/energy calculations — this is a geometric/structural tool, not a quantum chemistry engine
- Charge balancing or oxidation state validation
- Multi-element simultaneous doping in a single operation (can be done sequentially)

---

## Proposed Design

### Doping Modes

Three substitution scopes, selectable in the doping panel:

| Mode | Description |
|------|-------------|
| **Selected atoms** | Replace only the currently selected atom(s). Fine-grained control. |
| **All of type** | Replace every atom of a given element (e.g. all Cu → Fe). One-click full substitution. |
| **Random N%** | Replace a random N% of atoms of a given element. Simulates partial doping concentration. |

### Structural Recalculation After Substitution

When an atom's element is changed:
1. Update `atom.t` (element symbol) and `atom.role`
2. Recalculate covalent radius for the new element from `ELEMENTS`
3. Re-evaluate bonds touching this atom: drop bonds where distance > (rᵢ + rⱼ + 0.4 Å); add bonds where distance < threshold and none existed
4. Recalculate cavity spheres if the Cavities preset is active (call `getCavitySpheres()`)
5. Push to undo stack (`saveState()` before the operation)

Bond recalculation is already implemented in `state.js` — the same distance-threshold logic from `parseCIF` applies here. Doping just re-runs it on the affected atom's neighbourhood.

### Visual Differentiation of Doped Sites

Doped atoms get a `dopant: true` flag in their atom object. `renderer.js` draws these atoms with an additional outer ring (a second circle at `radius + 3px` in a contrasting highlight colour). This makes doped sites immediately identifiable without changing the base colour scheme.

The ring colour follows the semantic colour of the replacement element — so Fe dopants get the Fe colour ring, while the atom body colour transitions to Fe's colour normally.

### Doping Analysis Panel

A read-only stats section that updates live after any substitution:

```
Composition
  Cu  12  (85.7%)   →  originally 14
  Fe   2  (14.3%)   →  doped sites

Affected bonds
  Cu–O → Fe–O: avg Δ = +0.12 Å (Fe–O longer than Cu–O)
  New bonds formed: 0
  Bonds broken: 0

Cavity impact
  Central cavity: r = 4.21 Å  (was 4.18 Å)
  Peripheral cavities: avg r = 3.87 Å (was 3.89 Å)
```

Bond length changes are computed by comparing the pre-doping snapshot (from the undo stack entry) against the post-doping state. Cavity impact is shown only when the Cavities preset is active.

---

## UI

### Doping Panel (inside Inspector, collapsible section)

```
┌─────────────────────────────────────┐
│  Doping Simulation                  │
├─────────────────────────────────────┤
│  Replace   [Cu ▼]  with  [Fe ▼]    │
│                                     │
│  Scope                              │
│  ○ Selected atoms only              │
│  ● All Cu atoms                     │
│  ○ Random  [25]%  of Cu             │
│                                     │
│  [Apply Doping]    [Reset All]      │
│                                     │
│  ── Analysis ─────────────────────  │
│  Cu 12 (85.7%)  Fe 2 (14.3%)       │
│  Fe–O avg: 2.04 Å  (Cu–O: 1.93 Å)  │
│  Δ cavity r: +0.03 Å               │
└─────────────────────────────────────┘
```

- **"Apply Doping"**: calls `saveState()` then performs substitution + bond recalc
- **"Reset All"**: calls `restoreState()` back to the pre-doping snapshot (or just uses Ctrl+Z)
- Element dropdowns are populated from `ELEMENTS` — same list as the custom element palette

### Doped atom visual in canvas

```
  ╔═══╗       <- outer ring (Fe colour, 2px stroke, radius + 3px)
  ║ Fe ║      <- atom body (normal Fe colour fill)
  ╚═══╝
```

A small doping indicator badge (element symbol of the dopant) is drawn above the atom when labels are enabled.

---

## Implementation Plan

### Changes to existing files

| File | Change |
|------|--------|
| `app/state.js` | Add `substituteAtoms(sourceEl, targetEl, mode, pct)` function; add `dopant` flag to atom objects; add `getDopingStats()` returning composition diff + bond length changes |
| `app/renderer.js` | Draw outer ring for atoms where `atom.dopant === true`; add dopant badge in label mode |
| `app/ui.js` | Bind doping panel controls; call `substituteAtoms()`; update analysis panel on change |
| `app/index.html` | Add doping section to inspector panel |

### `state.js` new functions

```js
// Core substitution — all modes route through here
// saveState() is called internally before mutation
export function substituteAtoms(sourceEl, targetEl, mode, pct = 100) {
    // mode: 'selected' | 'all' | 'random'
    saveState();
    const targets = selectTargets(sourceEl, mode, pct);
    targets.forEach(atom => {
        atom.t = targetEl;
        atom.role = inferRole(atom, targetEl);  // e.g. Cu → Fe keeps metal-node role
        atom.dopant = true;
    });
    rebuildBondsForAtoms(targets);   // re-run bond distance check on affected atoms
    rebuildAtomMap();
}

// Returns {composition, bondLengthChanges, cavityImpact}
export function getDopingStats(snapshot) { ... }

// Clear all dopant flags (visual reset without structural change)
export function clearDopantFlags() { ... }
```

### `inferRole()` logic

When substituting a metal (Cu) with another metal (Fe, Zn, Co, Ni):
- Preserve the `role` as `Cu` is the metal-node semantic. Update to `Fe` (or the new symbol) only if a matching role exists in `ELEMENTS`. Default: use the new element symbol as the role.
- This keeps the Cu–O preset highlighting consistent for the new metal node.

---

## Design Rationale

**Why not use the existing Add/Delete mode?**
Add/Delete requires manually deleting the old atom and placing a new one at exactly the same position, which is imprecise and loses bond connectivity. `substituteAtoms` is atomic: it swaps element identity in-place with zero positional error and automatically recalculates affected bonds.

**Why a random N% mode?**
Real MOF doping is statistical — synthesising "20% Fe-doped HKUST-1" means Fe is distributed randomly among the Cu sites, not placed by the researcher. The random mode lets users explore what a given doping concentration looks like structurally.

**Why show cavity impact?**
The defining property of HKUST-1 for gas storage applications is its pore geometry. When metal nodes are substituted, the node geometry changes slightly (different M–O bond lengths), which shifts cavity positions and sizes. Showing this directly connects the doping operation to the application-relevant structural property.

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | What if the dopant element has a very different radius and causes bond breakage? | Show a warning count in the analysis panel ("2 bonds broken"). No automatic bond creation — let the user inspect and manually edit if needed. |
| 2 | Should `dopant` flag persist in exported JSON? | Yes — include `"dopant": true` in the JSON schema so doped structures can be reloaded with doping visualisation intact. |
| 3 | Should there be a "compare" mode showing original alongside doped? | Out of scope for Phase 3. Could be a Phase 4 feature (split-screen or overlay diff view). |
| 4 | How to handle doping HKUST's Cu₂ paddlewheel — should both Cu atoms in a paddlewheel pair be doped together? | Default: treat each Cu independently. Add a "pair mode" toggle if user feedback requests it. |

---

## Verification

Manual tests:
- [ ] Replace 1 selected Cu with Fe — verify outer ring drawn, bond lengths updated
- [ ] Replace all Cu with Zn — verify all atoms updated, composition panel shows 100% Zn
- [ ] Replace 25% random Cu with Fe — verify ~25% of Cu sites are substituted (within ±1)
- [ ] Undo after doping — verify full structural revert including `dopant` flags cleared
- [ ] Export JSON after doping — verify `dopant: true` present on substituted atoms
- [ ] Reload doped JSON — verify doping visualisation re-renders correctly
- [ ] Cavity preset active during doping — verify cavity spheres recalculate
