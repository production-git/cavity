# Feature Plan: Multi-Origin Navigation

> Phase: 1
> Status: Planned
> Priority: P0 — foundational mechanic

---

## User Story

> "I want to have 2 origins with 2 molecules in the same scene, one at (0,0,0) and the other at (10,10,0), and switch between them using arrow keys — keeping the view locked to that particular origin."
> — User feedback #15

---

## Problem

The app currently has a single scene with a single camera. There is no concept of multiple independent spatial anchors. To tell a multi-step story, users would need to open multiple browser tabs and lose all spatial continuity.

---

## Goals

- Users can create named spatial anchors ("origins") on an infinite X-Y grid
- Arrow keys navigate between origins; camera glides smoothly to the target
- Each origin independently stores its molecule(s) and camera state
- No two origins share the same on-screen viewport (no overlap)

---

## Non-Goals

- Z-axis navigation (future)
- Collision-aware shifting (Phase 2)
- Annotations on origins (Phase 2)
- More than one molecule per origin (Phase 1 — keep simple)

---

## Design

### Data Model

```js
// Added to session state
origins: [
  {
    id: "origin-0",
    label: "Intro",
    gridX: 0,
    gridY: 0,
    molecule: { ...moleculeJSON },   // nullable
    camera: { angleY, angleX, zoomVal }
  },
  ...
]
activeOriginId: "origin-0"
```

Grid position `(gridX, gridY)` is in integer units. One grid unit = `GRID_STEP` world units (default: 30).

### Navigation

- `ArrowRight` → move to origin at `(activeGridX + 1, activeGridY)` if it exists
- `ArrowLeft`  → move to origin at `(activeGridX - 1, activeGridY)` if it exists
- `ArrowUp`    → move to origin at `(activeGridX, activeGridY + 1)` if it exists
- `ArrowDown`  → move to origin at `(activeGridX, activeGridY - 1)` if it exists
- If no origin exists at the target grid position, key press is a no-op

### Camera Transition

When navigating to a new origin:
1. Save current camera state to the departing origin
2. Lerp camera position and angles to the target origin's saved camera state over 400 ms
3. Set `activeOriginId` to target on transition complete

### Grid Constraint

When creating a new origin, it is placed at the first unoccupied grid position adjacent to the current active origin (preferring right → up → left → down).

Duplicate grid positions are rejected at creation time.

---

## Implementation Plan

### New files

| File | Purpose |
|---|---|
| `origins.js` | Origin store: `createOrigin`, `deleteOrigin`, `getOrigin`, `setActive`, `getNeighbour` |

### Changes to existing files

| File | Change |
|---|---|
| `state.js` | Add `origins[]` and `activeOriginId` to session state; update `saveState`/`restoreState` |
| `renderer.js` | Render only the active origin's molecule; pass camera override for transition |
| `ui.js` | Bind arrow keys to origin navigation; add origin tabs in top bar; bind "+ New Origin" |
| `index.html` | Add top bar with origin tabs and save button; add bottom navigation bar |

### `origins.js` interface

```js
export function createOrigin(label, gridX, gridY) {}   // returns new origin id
export function deleteOrigin(id) {}
export function renameOrigin(id, label) {}
export function getActiveOrigin() {}                    // returns origin object
export function setActiveOrigin(id) {}
export function getNeighbour(id, direction) {}         // direction: 'right'|'left'|'up'|'down'
export function saveCamera(id, cameraState) {}
export function setMolecule(id, moleculeJSON) {}
```

---

## UI

### Top Bar
```
[+ New Origin]  [Intro]  [Cu Unit ×]  [Pore ×]      [💾 Save]
```
- Active origin tab is highlighted
- `×` deletes origin (with confirmation if it has content)
- `+ New Origin` creates an empty origin adjacent to current

### Bottom Navigation Bar
```
← Prev    Cu Unit  [2 / 3]    Next →
```
- Mirrors arrow key behaviour
- Shows current origin label and position in sequence

---

## Acceptance Criteria

- [ ] Create 3 origins, navigate R/L/U/D with arrow keys; camera glides to each
- [ ] Each origin stores its own molecule independently
- [ ] Deleting an origin removes it from the grid; active origin shifts to nearest remaining
- [ ] Session save/load preserves all origins and their grid positions
- [ ] No two origins can be created at the same grid position
- [ ] Arrow key to empty grid position is a no-op (no camera movement)
