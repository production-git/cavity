# Roadmap: 3D Presentation Application

---

## Phase 1 — Foundation
> Goal: Core multi-origin loop working end-to-end. A user can create origins, place molecules, and navigate between them with arrow keys.

### Deliverables

| # | Feature | Notes |
|---|---|---|
| 1.1 | Multi-origin data model | `origins[]` — each with `{id, label, x, y, molecules[]}` |
| 1.2 | Arrow-key navigation | Camera snaps + smoothly glides to selected origin |
| 1.3 | Origin creation / deletion / rename UI | Panel or right-click context menu |
| 1.4 | Fixed-grid layout | Origins placed on a regular grid; no collision detection yet |
| 1.5 | HKUST molecule JSON loading into origin slot | Port from existing HCUST viewer |
| 1.6 | Session save / load | Persist origins + content to a `.json` file (addresses feedback #14) |

### Success criteria
- User can create 3+ origins and navigate between them in < 5 keystrokes
- Session survives a page refresh

---

## Phase 2 — Story Layer
> Goal: Users can annotate scenes with text and images to tell a story.

### Deliverables

| # | Feature | Notes |
|---|---|---|
| 2.1 | Text overlay objects | Anchored to origin, editable in-place |
| 2.2 | Image import + plane rendering | Drag-drop or file picker; renders as a 3D plane in scene |
| 2.3 | Per-origin presenter notes | Off-canvas panel, not rendered in export |
| 2.4 | Collision-aware origin shifting | Shift origin without overlapping neighbours (Point 15 full spec) |
| 2.5 | Origin rearrangement | Drag origins to reorder/reposition on the X-Y plane |

### Success criteria
- Annotations visible in ≥ 40% of test sessions
- Origin shift never causes two origins to share the same screen view

---

## Phase 3 — Export & Share
> Goal: Users can export a recorded transition sequence to share with others.

### Deliverables

| # | Feature | Notes |
|---|---|---|
| 3.1 | Scene transition animation | Camera glides origin A → B → C; hold duration configurable per origin |
| 3.2 | WebM/GIF export of transition | Extends `animation-export.md` design |
| 3.3 | Export as self-contained HTML | Packages viewer + data as a single `.html` file; works offline |
| 3.4 | Transition preview | Plays in-canvas before export commit |

### Success criteria
- Export of a 3-origin sequence completes in < 30 s on mid-range hardware
- Output HTML file opens in Chrome/Safari/Firefox with no server

---

## Phase 4 — Import & Interop
> Goal: Interoperability with existing workflows and file formats.

### Deliverables

| # | Feature | Notes |
|---|---|---|
| 4.1 | PPTX import | Distribute slides to origins; basic editing post-import |
| 4.2 | GLTF / OBJ import | Place arbitrary 3D objects on origins |
| 4.3 | Multi-user session sharing | URL-based state (read-only) |
| 4.4 | Z-axis origins (optional) | Extend navigation to 3D grid if demand exists |

---

## Dependency Map

```
Phase 1 (data model + nav)
    └── Phase 2 (annotations + collision)
            └── Phase 3 (export)
                    └── Phase 4 (interop)
```

Phase 3.3 (self-contained HTML export) can start in parallel with Phase 3.1.
Phase 4 items are independent of each other.
