# Feature Plan: Animation Export (Video / GIF)

> Status: Planned
> Priority: High
> Phase: 3

---

## User Story

> "I want to export a high quality video/GIF of the molecule rotating, which I can use in my research presentation."

---

## Problem

The current app lets users rotate the molecule interactively, but there is no way to capture that motion as a file. For research presentations, a looping GIF or a short video clip of the rotating HKUST-1 structure is far more compelling than a static PNG. Researchers need this to drop into PowerPoint, Keynote, or a paper figure.

---

## Goals

- Capture a smooth rotation (or any camera path) as a high-quality exportable file
- Support intermediate orientation stops (keyframes) for custom animation paths
- Stay fully client-side — no server, no upload
- Output formats suitable for research presentations: GIF, WebM, or MP4

---

## Non-Goals

- Full timeline/keyframe editor UI (Phase 3 scope — keep it simple: start + optional stops + end)
- Editing atom positions during capture

---

## Proposed Design

### Keyframe Model

An animation is defined as an ordered list of keyframes:

```js
keyframes = [
  { angleY: 0.61,  angleX: 0.35, zoom: 72, hold: 0 },    // start
  { angleY: 1.57,  angleX: 0.35, zoom: 72, hold: 500 },   // intermediate stop (hold 500 ms)
  { angleY: 3.14,  angleX: 0.10, zoom: 80, hold: 0 },     // end
]
```

- `angleY`, `angleX`, `zoom`: camera state (already in `state.js`)
- `hold`: milliseconds to pause at this keyframe before continuing (default 0)
- Angles interpolated with SLERP (smooth constant-speed arc)
- Minimum: 2 keyframes (start + end). Maximum: no hard limit.

### Capture Process

1. User opens Animation Export modal
2. Sets keyframes by navigating to orientation → clicking "Add keyframe"
3. Configures settings: FPS (15 / 24 / 30), resolution (1× / 2×), export format
4. Clicks "Preview" — plays a real-time preview in the canvas
5. Clicks "Export" — renders all frames off-screen, encodes, downloads file

Off-screen rendering uses an `OffscreenCanvas` (same size as the live canvas × resolution scale) driven by the existing `renderer.draw()` function with overridden state angles — no duplicate rendering code.

### Export Format Strategy

| Format | Method | Dependencies | Quality | Notes |
|--------|--------|--------------|---------|-------|
| WebM | `MediaRecorder` API | None (native browser) | High | Best quality, widely supported, good for slides |
| GIF | `gif.js` library | ~50 KB CDN load | Medium | Universal compatibility, loops natively |
| MP4 | `MediaRecorder` (H.264) | None (Safari/Chrome) | High | May need codec check; fallback to WebM |

**Recommended default:** WebM via `MediaRecorder` — zero dependencies, native browser API, high quality, supported in Chrome/Firefox/Edge/Safari 14+. GIF is the fallback for maximum compatibility.

### `MediaRecorder` approach (WebM)

```js
const stream = offscreenCanvas.captureStream(fps);
const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
const chunks = [];

recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    downloadBlob(blob, 'HKUST-1_rotation.webm');
};

recorder.start();
// drive frame rendering at target FPS...
recorder.stop();
```

### `gif.js` approach (GIF fallback)

```js
// CDN: https://cdn.jsdelivr.net/npm/gif.js/dist/gif.js
const gif = new GIF({ workers: 2, quality: 8, width, height });
// For each frame:
gif.addFrame(offscreenCtx, { delay: 1000 / fps });
// On finish:
gif.on('finished', blob => downloadBlob(blob, 'HKUST-1_rotation.gif'));
gif.render();
```

---

## UI

### Modal Layout

```
┌─────────────────────────────────────────┐
│  Animation Export                    ✕  │
├─────────────────────────────────────────┤
│  Keyframes                              │
│  ┌──────────────────────────────────┐   │
│  │ 1. angleY=0.61  angleX=0.35  [×] │   │
│  │ 2. angleY=1.57  hold=500ms   [×] │   │
│  │ 3. angleY=3.14  angleX=0.10  [×] │   │
│  └──────────────────────────────────┘   │
│  [+ Add current view as keyframe]       │
│                                         │
│  Settings                               │
│  FPS:        ● 15  ○ 24  ○ 30          │
│  Resolution: ● 1×  ○ 2×                │
│  Format:     ● WebM  ○ GIF             │
│  Duration:   ~4.2 s  (auto-calculated) │
│                                         │
│       [Preview]    [Export]             │
└─────────────────────────────────────────┘
```

- **"Add current view as keyframe"**: captures current `state.angleY`, `state.angleX`, `state.zoomVal`
- **Duration**: auto-calculated from keyframe count × default inter-keyframe time (2 s) + hold times
- **Preview**: plays the animation live in the main canvas (no file written)

---

## Implementation Plan

### New files / modules

- `app/animator.js` — keyframe store, interpolation, frame rendering loop (lightweight, ~150 lines)

### Changes to existing files

| File | Change |
|------|--------|
| `app/index.html` | Add "Animation" button in export toolbar; add animation modal |
| `app/ui.js` | Bind animation modal open/close; wire "Add keyframe" button |
| `app/index.js` | Import `animator.js`; add `gif.js` script tag (loaded on demand) |

### `animator.js` interface

```js
export const keyframes = [];           // [{angleY, angleX, zoom, hold}]
export function addKeyframe(state) {}  // captures current view
export function removeKeyframe(i) {}
export function preview(draw) {}       // plays animation in real canvas
export function exportWebM(draw, fps, scale) {} // returns Promise<Blob>
export function exportGIF(draw, fps, scale) {}  // returns Promise<Blob>
```

`draw` is a callback that accepts `{angleY, angleX, zoomVal}` overrides and renders one frame to an `OffscreenCanvas`. This keeps `animator.js` decoupled from `renderer.js`'s internals.

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Load `gif.js` upfront or on demand? | On demand (only when user opens modal and selects GIF) — avoids ~50 KB hit for users who only use WebM |
| 2 | Max resolution for 2× export? | Cap at 4096×4096 px to prevent OOM on low-memory devices |
| 3 | What if `MediaRecorder` is unavailable (old Safari)? | Auto-fall back to GIF; show a banner "WebM not supported in this browser, exporting as GIF" |
| 4 | Loop count for GIF? | Default: infinite loop. Make configurable in settings. |

---

## Verification

Manual tests:
- [ ] Add 2 keyframes, export WebM — verify smooth interpolation, correct duration
- [ ] Add 3 keyframes with a hold, export GIF — verify pause at intermediate stop
- [ ] Export at 2× resolution — verify pixel dimensions
- [ ] Open WebM in PowerPoint / Keynote — verify playback
- [ ] Open GIF in browser — verify infinite loop
- [ ] Test on Safari — verify GIF fallback triggers if WebM unavailable
