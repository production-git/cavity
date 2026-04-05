# Feature Plan: Layer Visibility & Group Control

> Status: Planned
> Priority: High
> Phase: 3

---

## User Story

> "I want to hide/show atoms, grouped structures, polyhedron structures, and cavities independently so I can focus on specific parts of the structure."

---

## Problem

As the structure grows in complexity — multiple atom types, polyhedra, cavity spheres, supercell ghosts, guest molecules, functional groups, and DFT overlays all coexist in the same scene — the canvas becomes visually overloaded. There is currently no way to isolate a subset of the scene. A researcher studying the Cu paddlewheel node wants to hide the BTC linker. A researcher studying the pore geometry wants to hide atoms entirely and see only cavities. A researcher preparing a figure wants to hide the axis gizmo and labels.

The missing primitive is **independent visibility and opacity control per named layer**.

---

## Goals

- Toggle visibility and opacity for every major visual category independently
- Support named user-defined groups (extend the existing `customGroups`)
- Persist visibility state in JSON export/import
- Zero code changes to rendering logic — the layer system is a filter on top of the existing draw pipeline

---

## Non-Goals

- Layer ordering / Z-compositing (the existing depth sort handles this)
- Per-atom visibility outside of group membership (impractical UI; use selection modes instead)

---

## Layer Model

### System Layers (always present)

These map directly to existing draw list categories in `renderer.js`:

| Layer ID | Label | Controls |
|----------|-------|----------|
| `atoms.Cu` | Cu atoms | Visible / Opacity |
| `atoms.O` | O atoms | Visible / Opacity |
| `atoms.C` | C atoms | Visible / Opacity |
| `atoms.H` | H atoms | Visible / Opacity |
| `atoms.{X}` | Any imported element | Visible / Opacity |
| `bonds.solid` | Solid bonds | Visible / Opacity |
| `bonds.dashed` | Dashed bonds (Cu–Cu axial) | Visible / Opacity |
| `polyhedra.faces` | Polyhedron faces | Visible / Opacity |
| `polyhedra.edges` | Polyhedron edges | Visible / Opacity |
| `cavities` | Cavity spheres | Visible / Opacity |
| `supercell` | Supercell ghost copies | Visible / Opacity |
| `guests` | Guest molecules | Visible / Opacity |
| `labels` | Atom element labels | Visible |
| `axes` | World axes widget | Visible |
| `hud` | Multi-HUD (bond lengths, angles) | Visible |

Atom layers are generated dynamically from the `ELEMENTS` catalog — any element present in `atoms[]` gets its own layer entry.

### User-Defined Group Layers

The existing `customGroups` array (from the Polyhedron mode) is extended to support arbitrary named selection sets with a visibility flag:

```js
customGroups = [
    { id: 'grp0', label: 'BTC Ring 1', atomIds: [12, 13, 14, 15, 16, 17], visible: true, opacity: 1.0 },
    { id: 'grp1', label: 'Cu paddlewheel', atomIds: [0, 1], visible: true, opacity: 1.0 },
];
```

Any atom can belong to multiple groups. When an atom belongs to a hidden group, it is not rendered regardless of its element layer visibility. Element layer visibility takes precedence over group visibility — if `atoms.Cu` is hidden, Cu atoms in visible groups are also hidden.

### Preset Scene Configurations

Saved as named snapshots of the full layer state, one-click recall:

| Preset | Description |
|--------|-------------|
| **All visible** | Default — every layer on at 100% |
| **Metal nodes only** | Only Cu/dopant atoms + Cu–O bonds visible; hides C, H, linker bonds |
| **Pore geometry** | Cavities + supercell, no atoms, no bonds |
| **Linker only** | C_arom + C_carb + H atoms, organic bonds only; hides Cu, O |
| **Publication figure** | Hides axes, HUD, labels; atoms + bonds + polyhedra at full opacity |
| **Custom** | User-saved; prompts for a name |

---

## UI

### Layers Panel

A collapsible section in the inspector, below the existing Presets section:

```
┌─────────────────────────────────────────────┐
│  Layers                          [+ Group]  │
├─────────────────────────────────────────────┤
│  Scene Presets:                             │
│  [All]  [Metal nodes]  [Pore]  [Linker]     │
│  [Figure]  [Custom ▼]                       │
├─────────────────────────────────────────────┤
│  ● Cu atoms          ████████░░  85%        │
│  ● O atoms           ██████████ 100%        │
│  ● C atoms           ██████████ 100%        │
│  ○ H atoms           (hidden)               │
│  ─────────────────────────────────          │
│  ● Bonds (solid)     ██████████ 100%        │
│  ● Bonds (dashed)    ██████████ 100%        │
│  ─────────────────────────────────          │
│  ● Polyhedra faces   ████░░░░░░  40%        │
│  ● Polyhedra edges   ██████████ 100%        │
│  ─────────────────────────────────          │
│  ● Cavities          ██████░░░░  60%        │
│  ○ Supercell ghosts  (hidden)               │
│  ─────────────────────────────────          │
│  ● Labels            (on/off only)          │
│  ● Axes              (on/off only)          │
│  ● HUD               (on/off only)          │
│  ─────────────────────────────────          │
│  User Groups                                │
│  ● BTC Ring 1        ██████████ 100%  [×]  │
│  ○ Cu paddlewheel    (hidden)         [×]  │
└─────────────────────────────────────────────┘
```

- **Dot** (●/○): click to toggle visible/hidden
- **Slider**: opacity for layers that support it (atoms, bonds, polyhedra, cavities)
- **[× ]**: delete user-defined group
- **[+ Group]**: create a new group from current selection

### Creating a User Group

1. Select atoms using existing selection tools (click, multi-select)
2. Click `[+ Group]` in the Layers panel → prompt for group name
3. Current selection becomes the group's `atomIds`
4. Group appears in the Layers panel with full visibility controls

---

## Implementation Plan

### State changes (`state.js`)

```js
// New top-level state
export let layers = {
    'atoms.Cu':         { visible: true,  opacity: 1.0 },
    'atoms.O':          { visible: true,  opacity: 1.0 },
    'atoms.C':          { visible: true,  opacity: 1.0 },
    'atoms.H':          { visible: true,  opacity: 1.0 },
    'bonds.solid':      { visible: true,  opacity: 1.0 },
    'bonds.dashed':     { visible: true,  opacity: 1.0 },
    'polyhedra.faces':  { visible: true,  opacity: 0.18 },  // matches faceAlpha default
    'polyhedra.edges':  { visible: true,  opacity: 1.0 },
    'cavities':         { visible: true,  opacity: 0.22 },
    'supercell':        { visible: true,  opacity: 0.32 },
    'guests':           { visible: true,  opacity: 0.80 },
    'labels':           { visible: false },
    'axes':             { visible: true  },
    'hud':              { visible: true  },
};

export function setLayerVisibility(id, visible) { layers[id].visible = visible; }
export function setLayerOpacity(id, opacity)    { layers[id].opacity = opacity; }
```

The existing `showLabels`, `showBonds`, `faceAlpha`, `fogEnabled` state vars are migrated into `layers` — they are the same logical concept. Backward-compatible: old JSON loads without `layers` continue to use defaults.

### Renderer changes (`renderer.js`)

The draw pipeline already conditionally renders each category. Replace the existing boolean flags with layer lookups:

```js
// Before:
if (state.showLabels) { drawLabels(); }

// After:
if (state.layers['labels'].visible) { drawLabels(); }

// Before:
ctx.globalAlpha = state.faceAlpha;

// After:
ctx.globalAlpha = state.layers['polyhedra.faces'].opacity;
```

For element-level atom visibility, add a lookup in the atom draw step:

```js
function shouldDrawAtom(atom) {
    const layerId = `atoms.${atom.t}`;
    const layer = state.layers[layerId];
    if (layer && !layer.visible) return false;
    // Check user groups: if atom is in ANY hidden group, skip it
    const inHiddenGroup = state.customGroups.some(
        g => !g.visible && g.atomIds.includes(atom.id)
    );
    return !inHiddenGroup;
}
```

Bond visibility: a bond is drawn only if both endpoint atoms pass `shouldDrawAtom`. This means hiding Cu atoms automatically hides Cu–O bonds connected to hidden Cu atoms.

### JSON serialization

`serializeStructure()` gains two new top-level fields:

```json
{
  "version": 10,
  "layers": { "atoms.Cu": { "visible": true, "opacity": 1.0 }, ... },
  "customGroups": [{ "id": "grp0", "label": "BTC Ring 1", "atomIds": [...], "visible": true, "opacity": 1.0 }]
}
```

Older JSON (version ≤ 9) loads with all layers defaulting to visible/full opacity.

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should group opacity override element opacity or multiply? | Multiply — element opacity × group opacity. Allows fine-grained compositing. |
| 2 | What happens when an atom is in multiple groups with different opacities? | Use the minimum opacity (most transparent wins) to avoid accidentally hiding atoms in a mix. |
| 3 | Should scene preset snapshots be persisted in JSON? | Yes — save active preset name + any custom preset definitions in `viewState`. |
| 4 | When H is hidden, should H-bond interaction lines (from guest feature) also hide? | Yes — if either endpoint atom is hidden, the interaction line is hidden. |

---

## Verification

- [ ] Hide `H atoms` layer — verify all H atoms disappear, bonds to H also hide
- [ ] Set `Cu atoms` opacity to 40% — verify Cu renders at 40%, Cu–O bonds also dim proportionally
- [ ] Create user group from selection, hide it — verify only those atoms hide
- [ ] Apply "Metal nodes only" preset — verify only Cu + O atoms + Cu–O bonds visible
- [ ] Apply "Publication figure" — verify axes, HUD, labels hidden
- [ ] Export JSON, reload — verify layer state restored exactly
- [ ] Load a v9 JSON — verify all layers default to visible
