# Feature Plan: Scene Transition Export

> Phase: 3
> Status: Planned
> Priority: P1
> Depends on: multi-origin-navigation.md, scene-annotation.md
> Extends: `../../feature_plans/animation-export.md` (HCUST app)

---

## User Story

> "The animation-export feature should be part of this 3D Presentation Application."
> — User feedback #17

> "Shifting origins should look like shifting PPT slides but in 3D space."
> — User feedback #16

---

## Problem

Users can build a multi-origin presentation, but there is no way to capture the experience as a shareable file. A researcher needs to send a video that shows the camera gliding between scenes — the spatial transitions are as important as the content at each origin.

---

## Goals

- Record a camera sequence that visits each origin in order
- Hold at each origin for a configurable duration
- Export as WebM or GIF
- Export as self-contained HTML (viewer + data, offline-capable)
- Preview before export

---

## Non-Goals

- Per-object animations within an origin (e.g. atoms moving) — future
- Audio narration
- Non-linear playback (branches, interactive export)
- Custom easing curves on transitions (Phase 1: linear lerp only)

---

## Design

### Transition Model

```js
// Auto-generated from origins[] in sequence order
transitionSequence = [
  { originId: "origin-0", holdMs: 2000 },
  { originId: "origin-1", holdMs: 1500 },
  { originId: "origin-2", holdMs: 2000 },
]
```

- Default hold per origin: 2000 ms (configurable globally or per-origin)
- Transition between origins: 600 ms linear lerp on `angleY`, `angleX`, `zoomVal`
- Total duration auto-calculated and displayed before export

### Capture Process

1. User opens "Export Presentation" modal
2. Reviews sequence: origin order, hold times per origin
3. Configures: FPS (15 / 24 / 30), resolution (1× / 2×), format (WebM / GIF)
4. Clicks "Preview" — plays real-time in the canvas
5. Clicks "Export" — renders frames to `OffscreenCanvas`, encodes, downloads

Reuses the `OffscreenCanvas` + `MediaRecorder` approach from `animation-export.md`.
The existing `animator.js` (from that plan) is extended with origin-aware sequencing.

### Changes to `animator.js`

```js
// New exports added to animator.js
export function buildTransitionSequence(origins, activeOrder) {}
// Returns [{originId, fromCamera, toCamera, holdMs, transitionMs}]

export function previewTransition(sequence, draw, setOrigin) {}
// Drives the preview in real-time canvas

export function exportTransitionWebM(sequence, draw, setOrigin, fps, scale) {}
// Returns Promise<Blob>

export function exportTransitionGIF(sequence, draw, setOrigin, fps, scale) {}
// Returns Promise<Blob>
```

`setOrigin(id)` is a callback that switches the rendered origin mid-capture (so each scene's correct content is drawn).

### Self-Contained HTML Export

Bundles:
- The app's `index.html`, `index.js`, all JS modules (inlined)
- The full session JSON (inlined as a `<script>` data block)
- All image annotation data URIs (already embedded in session JSON)

Result: a single `.html` file the recipient opens in any browser with no server needed.

---

## UI

```
┌─────────────────────────────────────────────────────┐
│  Export Presentation                             ✕  │
├─────────────────────────────────────────────────────┤
│  Sequence                                           │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. Intro           hold: [2000] ms  [↑] [↓]  │  │
│  │ 2. Cu Unit         hold: [1500] ms  [↑] [↓]  │  │
│  │ 3. Pore Detail     hold: [2000] ms  [↑] [↓]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Settings                                           │
│  FPS:        ● 24  ○ 15  ○ 30                      │
│  Resolution: ● 1×  ○ 2×                            │
│  Format:     ● WebM  ○ GIF  ○ HTML                 │
│  Duration:   ~10.8 s  (auto-calculated)            │
│                                                     │
│       [Preview]       [Export]                      │
└─────────────────────────────────────────────────────┘
```

- Sequence rows are reorderable (up/down arrows)
- Hold time editable inline per origin
- Duration auto-updates as settings change

---

## Implementation Plan

| File | Change |
|---|---|
| `animator.js` | Add `buildTransitionSequence`, `previewTransition`, `exportTransitionWebM/GIF` |
| `exporter.js` (new) | Self-contained HTML bundler |
| `ui.js` | Bind "Export Presentation" modal |
| `index.html` | Add "Export" button in toolbar; add export modal |

---

## Acceptance Criteria

- [ ] Preview plays camera glide through 3 origins in correct order
- [ ] WebM export completes for a 3-origin sequence; smooth transitions visible
- [ ] GIF fallback works when WebM unavailable
- [ ] Hold times are respected: each origin is visible for configured duration
- [ ] Self-contained HTML export opens in Chrome/Firefox/Safari with no server
- [ ] Exported file shows annotations (text labels, image planes) from each origin
- [ ] Reordering sequence in modal changes export order (not the origin grid order)

---

## Open Questions

| # | Question | Proposed Answer |
|---|---|---|
| 1 | Should sequence order = grid order (left-right, then top-bottom) or user-defined? | User-defined in modal; default = grid reading order |
| 2 | What if an origin has no molecule (empty)? | Include it — annotations alone are valid content |
| 3 | Cap total export duration? | Warn at > 60 s; no hard cap |
| 4 | HTML export: inline all JS or link to CDN? | Fully inline — must be offline-capable |
