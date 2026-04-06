# Feature Plan: Scene Annotation Layer

> Phase: 2
> Status: Planned
> Priority: P1

---

## User Story

> "I want to add custom objects in the scene, like texts and images, and create a PPT-like view where I could basically tell a story without leaving the application."
> — User feedback #16

---

## Problem

Origins contain only molecules. To present a narrative, users need to label structural features and include supporting visuals (diagrams, chemical equations, reference images) directly in the 3D scene — anchored to the structure, not floating on a 2D overlay.

---

## Goals

- Add text labels anchored to a position in 3D scene space
- Import images and place them as flat planes in the scene
- Annotations are per-origin and saved with the session
- Annotations are visible in export (WebM, GIF, HTML)

---

## Non-Goals

- Rich text formatting (bold, italic, lists) — Phase 3+
- Shapes / arrows / connectors — Phase 3+
- Slide templates
- Animations on individual annotations

---

## Design

### Annotation Types

#### Text Label
```js
{
  type: "text",
  id: "ann-0",
  text: "Cu Paddlewheel Unit",
  x: 2.0, y: 3.0, z: 0.0,   // 3D world position
  fontSize: 14,               // px, fixed screen-size (does not scale with zoom)
  color: "#ffffff",
  bold: false
}
```

#### Image Plane
```js
{
  type: "image",
  id: "ann-1",
  src: "data:image/png;base64,...",   // stored as data URI
  x: -4.0, y: 0.0, z: 0.0,
  width: 4.0, height: 3.0,           // world units
  opacity: 1.0
}
```

### Rendering

**Text labels:** Rendered as `fillText` on the 2D canvas after the 3D scene draw. Project the 3D anchor point to screen coordinates using the same projection matrix as `renderer.js`. Always face the camera (billboard).

**Image planes:** Rendered as a textured quad in the 3D scene. Four corners computed from position + width/height, projected and drawn as a `drawImage` call on the canvas.

### Adding Annotations

- **Text:** Click "+ Add Text" in the annotation panel → click in the 3D canvas to place anchor → type inline
- **Image:** Click "+ Add Image" → file picker → click in canvas to place → drag corners to resize

### Editing Annotations

- Click annotation to select (shows handles)
- Drag to reposition
- Double-click text to edit inline
- Delete key removes selected annotation

---

## Implementation Plan

### New files

| File | Purpose |
|---|---|
| `annotations.js` | Annotation store: add, remove, update, render |

### Changes to existing files

| File | Change |
|---|---|
| `state.js` | Add `annotations[]` to each origin object |
| `renderer.js` | Call `annotations.render(ctx, projectionFn)` after 3D scene draw |
| `ui.js` | Bind annotation panel: add/select/delete handlers; inline text editor |
| `index.html` | Add annotation panel in side bar |

### `annotations.js` interface

```js
export function addText(originId, text, x, y, z, opts) {}    // returns annotation id
export function addImage(originId, src, x, y, z, w, h) {}    // returns annotation id
export function updateAnnotation(id, patch) {}
export function removeAnnotation(id) {}
export function renderAnnotations(ctx, originId, projectFn) {}  // called by renderer
```

`projectFn(x, y, z)` converts world coords to `{sx, sy}` screen coords — provided by `renderer.js`.

---

## Collision-Aware Origin Shifting (Point 15 Full Spec)

When a user shifts an origin's grid position:
1. Compute the bounding box of the origin's content (molecule + annotations)
2. Check if any other origin occupies the target grid position or overlaps the bounding box
3. If occupied: push all origins in the shift direction by one grid step to make room
4. Apply the shift

This cascading push ensures no two origins ever overlap on screen.

---

## Acceptance Criteria

- [ ] Add a text label; it renders in the 3D canvas anchored to world position
- [ ] Text label does not scale with zoom (fixed screen size)
- [ ] Import an image; it renders as a plane at the placed position
- [ ] Annotations are saved and restored with the session
- [ ] Annotations are visible in WebM/GIF export (Phase 3 dependency)
- [ ] Collision-aware shift: moving an origin never causes overlap with a neighbour
