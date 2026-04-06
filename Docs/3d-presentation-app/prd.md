# PRD: 3D Presentation Application

> Status: Draft
> Version: 0.1
> Date: 2026-04-06

---

## Overview

A spatial presentation tool for scientists and researchers. Users arrange 3D molecular structures and annotations across an infinite X-Y plane, navigate between them like slides, and export the result as an animated video or self-contained HTML file.

---

## Problem

Researchers flatten 3D structures into 2D slides to present them, losing interactivity and spatial understanding. No existing tool lets them author and deliver a spatial narrative *inside* a live 3D environment.

---

## Goals

- G1: Users can create multiple named "origins" on an infinite X-Y plane
- G2: Users can navigate between origins with arrow keys (slide-like UX)
- G3: Users can place molecules, text, and images on each origin
- G4: Users can export an animated transition sequence as WebM/GIF
- G5: Sessions can be saved and reloaded from a local file

## Non-Goals

- Real-time collaboration
- Cloud sync or accounts
- Z-axis navigation
- Audio narration
- PPTX import (Phase 4)

---

## User Stories

### Navigation
- As a researcher, I can press the right arrow key to navigate to the next origin, so I can advance my presentation without touching the mouse.
- As a researcher, I can create a new origin from a toolbar button, so I can add a new scene/slide to my presentation.
- As a researcher, I can rename an origin, so I can label each scene meaningfully (e.g. "Intro", "Cu Paddlewheel", "Pore Detail").

### Content
- As a researcher, I can load a `.json` molecule file onto an origin, so I can show different structures in different scenes.
- As a researcher, I can add a text label anchored to a position in the scene, so I can annotate structural features.
- As a researcher, I can import an image and place it as a flat plane in the scene, so I can include diagrams or references.

### Export & Save
- As a researcher, I can record a camera transition from origin A → B → C and export it as a WebM file, so I can embed it in a conference talk.
- As a researcher, I can save my session to a `.json` file and reload it later, so I can continue where I left off.
- As a researcher, I can export my session as a self-contained `.html` file, so I can share it with colleagues who don't have the app.

---

## Data Model

```js
// Session
{
  "version": 1,
  "origins": [
    {
      "id": "origin-0",
      "label": "Intro",
      "gridX": 0,          // position on infinite grid (integer units)
      "gridY": 0,
      "molecules": [       // array of molecule JSON objects
        { ...moleculeJSON }
      ],
      "annotations": [
        {
          "type": "text",
          "text": "Cu Paddlewheel Unit",
          "x": 2.0, "y": 3.0, "z": 0.0,
          "fontSize": 14,
          "color": "#ffffff"
        },
        {
          "type": "image",
          "src": "data:image/png;base64,...",
          "x": -4.0, "y": 0.0, "z": 0.0,
          "width": 4.0,
          "height": 3.0
        }
      ],
      "notes": "Presenter notes for this origin (not exported)"
    }
  ],
  "activeOriginId": "origin-0",
  "camera": { "angleY": 0.61, "angleX": 0.35, "zoomVal": 72 }
}
```

---

## Navigation Model

- Origins exist on an infinite X-Y plane, addressed by integer grid coordinates `(gridX, gridY)`.
- Arrow keys move the active origin by `(±1, 0)` or `(0, ±1)`.
- If no origin exists at the target grid position, the camera stays at the current origin.
- Camera glides smoothly to the new origin's saved camera state over ~400 ms.
- Grid spacing is set so no two origins share the same screen viewport (no overlap guarantee).

---

## UI Layout (Phase 1)

```
┌──────────────────────────────────────────────────────────┐
│ [+ New Origin]  [Origins: Intro | Cu Unit | Pore]  [💾]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                  3D Canvas (main view)                   │
│            (current origin content rendered)             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Origin: Cu Unit  │  ← Prev  [1/3]  Next →              │
└──────────────────────────────────────────────────────────┘
```

- Top bar: origin tabs + save button
- Bottom bar: current origin label + prev/next navigation (mirrors arrow keys)
- Side panel (Phase 2): annotations list, presenter notes

---

## Acceptance Criteria

### Phase 1
- [ ] Create 3 origins, navigate between them with arrow keys, camera glides smoothly
- [ ] Load a `.json` molecule on each origin; molecules are independent per origin
- [ ] Save session to file; reload session and all origins restore correctly
- [ ] No two origins are ever at the same grid position

### Phase 2
- [ ] Add a text annotation to an origin; it renders in the 3D canvas
- [ ] Import an image; it renders as a plane in the scene
- [ ] Shift an origin; neighbouring origins move to avoid overlap

### Phase 3
- [ ] Record origin A → B → C transition; export as WebM < 30 s for 3 origins
- [ ] Export as self-contained HTML; opens in Chrome/Firefox/Safari with no server

---

## Open Questions

| # | Question | Status |
|---|---|---|
| 1 | What unit does one grid step represent in world space? Fixed (e.g. 30 units) or derived from molecule bounding box? | Open |
| 2 | Should molecules on different origins be independently rotatable, or share a global camera rotation? | Open — lean toward per-origin saved camera state |
| 3 | Maximum number of origins before performance degrades? | Open — needs profiling |
| 4 | Should annotations scale with zoom, or stay fixed-size on screen? | Open — scientists likely prefer fixed-size labels |
