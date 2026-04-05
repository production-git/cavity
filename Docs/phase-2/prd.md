# Phase 2 PRD — HKUST-1 MOF Editor

> Status: Phase 2a COMPLETE — 2b, 2c, 2d in planning
> Last updated: 2026-04-05

---

## Problem Statement

The current editor is built on a Canvas 2D painter's algorithm with a single monolithic script (~1500 lines). This foundation has two hard limits that block the next level of quality:

1. **Rendering ceiling**: Painter's algorithm produces visible artifacts when polyhedra intersect, fog is faked with alpha hacks, atoms are 2D gradient circles not 3D spheres, and lighting is non-existent. Users lose spatial orientation in complex structures.

2. **Code ceiling**: Adding new features to a dense monolithic file is increasingly risky. Global variables scattered across 1500 lines mean the UI and canvas can fall out of sync. The convex-hull and geometry functions are essentially unreadable, making correctness hard to verify.

Every planned feature (unit cell wireframe, distance measurement, inter-cell bonds, animation, supercell from real CIF params) touches the renderer. Building them now on Canvas 2D means doing the work twice — once now, once after the WebGL migration. The structural improvements must come first.

3. **Performance ceiling**: `hitTest` and `hitBondTest` iterate every atom and bond on every mouse movement — O(N) per frame. The draw loop recreates `projMap = {}` and `drawList = []` on every frame, generating constant GC pressure. At 5,000+ atoms (e.g. a realistic MOF unit cell or a 3×3×3 supercell) this causes dropped frames and micro-stutters regardless of the rendering backend.

---

## Goals

### G1 — Real 3D Rendering
Replace the Canvas 2D painter's algorithm with a WebGL renderer (Three.js). Users should see atoms as true 3D spheres with depth-correct rendering, real lighting, and no sorting artifacts.

### G2 — Clean Module Architecture
Split the monolithic `app.js` into ES6 modules with clear ownership boundaries. Each module should be independently readable and testable.

### G3 — Stable State Management
Replace scattered global variables with a single source-of-truth state object. The UI and renderer should always derive from the same state — no sync bugs.

### G4 — Scalable Performance
The editor must remain interactive at 5,000+ atoms. This requires sub-linear hit testing (O(log N) via BVH or spatial hash) and elimination of per-frame GC allocations in the render loop.

### G5 — Immersive Workspace UI/UX
Transform the application from a document-style tool (canvas pushed below controls) into a full-bleed immersive workspace where the molecule is always the hero. All UI elements float over the canvas using glassmorphism panels. The aesthetic is dark-first, spatially organised, and refined.

---

## Non-Goals (Phase 2)

- New user-visible features (distance measurement, XYZ export, etc.) — these come in Phase 3 on top of the new foundation
- Network/server functionality — app stays fully client-side
- Build tooling (Webpack, Vite) — ES6 modules work natively in modern browsers; no bundler required for now
- Full PBR materials or ray-traced shadows — Phong shading is sufficient for Phase 2

---

## User-Facing Requirements

### R1 — Visual parity or better
All existing visual features must work after migration: atom colours, bond rendering (solid and dashed), polyhedron faces and edges, axis gizmos, snap guides, world-axes widget, hover tooltips, fog, supercell ghosts.

### R2 — Improved depth rendering
Intersecting polyhedra and overlapping atoms at any camera angle must render without painter's algorithm artifacts. This is the single most visible quality improvement.

### R3 — Real lighting on atoms
Atoms must appear as lit 3D spheres (ambient + directional light, Phong or Lambert), not 2D gradient circles. Bonds must have round cross-section tubes or at minimum depth-correct cylinders.

### R4 — Same interaction model
All existing interactions (drag-rotate, scroll-zoom, click to select, axis gizmo drag, touch) must continue to work. The interaction model does not change in Phase 2.

### R5 — Same import/export
All existing import (JSON, XYZ, MOL, CIF) and export (JSON, PNG) must continue to work unchanged.

### R7 — Full-bleed canvas
The 3D canvas must occupy 100% of the viewport width and height at all times. No UI chrome may push or shrink the canvas. The molecule is always the full background of the application.

### R8 — Floating glassmorphism panels
All UI panels (toolbar, inspector, stats, status) must float over the canvas using `backdrop-filter: blur()`. Panels must not be opaque white boxes — the molecule must be visible through them.

### R9 — Spatial panel layout
UI elements must be spatially organised by function:
- **Left edge**: vertical icon toolbar for editing modes
- **Right edge**: collapsible inspector panel (view settings, colours, presets, supercell)
- **Top edge**: global app bar (title, undo/redo, import/export)
- **Bottom edge**: minimal status bar (atom/bond counts, distances, current mode)

### R10 — Dark-first aesthetic
The default and primary theme is dark. The canvas background must be deep slate (`#0a0b0f`). Atom and bond colours must be tuned to read clearly against this background. A light theme is available as a toggle but is not the primary experience.

### R11 — Micro-interactions and animation
All interactive elements must have smooth transitions (hover, active, panel open/close). Mode switches, panel collapse, and tooltip appearance must animate. No abrupt state changes without visual feedback.

### R6 — Performance at scale
The editor must remain interactive at 5,000+ atoms with no frame drops during rotation and hover:
- Hit testing must be O(log N) — not O(N). Implement a BVH or spatial hash for raycasting so that mouse-move cost does not grow linearly with atom count.
- The render loop must not allocate new objects per frame. `projMap`, `drawList`, and similar per-frame structures must be pre-allocated and updated in-place to eliminate GC micro-stutters.

---

## Success Metrics

| Metric | Target |
|---|---|
| No painter's algorithm artifacts visible at any rotation | 100% of test rotations |
| Frame rate at default SBU (~120 atoms) | ≥ 60 fps |
| Frame rate at 2×2×2 supercell (~1000 atoms) | ≥ 60 fps |
| Frame rate at 5,000+ atom import | ≥ 30 fps |
| Mouse-move hit test cost at 5,000 atoms | O(log N) |
| Per-frame heap allocations in render loop | 0 new objects |
| Canvas occupies 100% viewport at all times | ✓ |
| All panels use `backdrop-filter: blur()` | ✓ |
| Default theme is dark | ✓ |
| All panel open/close transitions ≤ 220 ms | ✓ |
| All hover/active transitions ≤ 150 ms | ✓ |
| All existing features functional after migration | 100% |
| `app.js` removed, replaced by ≥ 4 modules | ✓ |
| No module exceeds 400 lines | ✓ |
| Zero global variables outside of `state.js` | ✓ |

---

## Phasing

### Phase 2a — Modularization ✅ COMPLETE

Split `app.js` into ES6 modules. App behaviour is identical. This is a pure refactor — no new features, no rendering changes.

Deliverables:
- `app/state.js` ✅
- `app/math3d.js` ✅
- `app/renderer.js` (Canvas 2D) ✅
- `app/ui.js` ✅
- `app/index.js` (entry point / wiring) ✅
- App works identically in browser ✅

### Phase 2b — WebGL Renderer
Replace `renderer.js` (Canvas 2D) with a Three.js renderer. All other modules remain unchanged.

Deliverables:
- `app/renderer.js` rewritten using Three.js
- `app/index.html` loads Three.js (CDN or local)
- All R1–R5 requirements met
- Multi-HUD overlay (bond lengths, angles) reimplemented on top of Three.js canvas/CSS2D

### Phase 2d — UI/UX Redesign
Complete visual and layout overhaul. Runs in parallel with 2b/2c — it touches only `index.html`, `styles.css`, and `ui.js`. No rendering or state logic changes.

Deliverables:
- Redesigned `app/index.html` — full-bleed canvas layout, floating panel structure
- Redesigned `app/styles.css` — new design system (tokens, glassmorphism, dark-first)
- Updated `app/ui.js` — icon toolbar, collapsible inspector, bottom status bar
- All R7–R11 requirements met

### Phase 2c — Performance Optimization
Implement sub-linear hit testing and eliminate per-frame GC allocations. Applies to both the Canvas 2D (2a) and WebGL (2b) paths; can be developed in parallel with 2b.

Deliverables:
- `app/spatial.js` — BVH or 3D octree for atom/bond spatial queries
- Pre-allocated `projMap` (typed array or fixed object pool) in `renderer.js`
- Pre-allocated `drawList` (fixed-length array, updated by index) in `renderer.js`
- Hit test latency ≤ 2 ms at 5,000 atoms (measured via `performance.now()`)

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Three.js CSS2DRenderer performance for HUD labels | Medium | Batch label updates; only render on hover frame |
| Hit testing (raycasting vs. spatial grid) behaviour changes | Medium | Use Three.js Raycaster; keep spatial grid for non-WebGL fallback logic if needed |
| Axis gizmo rendering in Three.js | Low | Use TransformControls or hand-roll with Line/Mesh |
| Canvas 2D PNG export breaks with WebGL canvas | Low | `renderer.domElement.toDataURL()` works on WebGL canvas |
| Module splits introduce circular imports | Low | Enforce dependency direction: `math3d` ← `state` ← `renderer` ← `ui` |
| BVH rebuild cost on atom move | Medium | Rebuild BVH only on structure edit (not every frame); mark dirty flag on state mutation |
| Pre-allocated drawList size wrong for large imports | Low | Size pool to `atoms.length * 2 + bonds.length` on structure load; resize only when needed |
| Three.js built-in BVH vs. `three-mesh-bvh` library | Low | Use `three-mesh-bvh` — it is the standard solution and outperforms naive Three.js raycasting at scale |
| `backdrop-filter` not supported in older browsers | Low | Feature is supported in all modern browsers (Chrome 76+, Firefox 103+, Safari 9+); no polyfill needed |
| Glassmorphism panels obscure molecule in dense layouts | Medium | Panels must be ≤ 72% opaque; inspector collapses to icon-only strip; bottom bar stays ≤ 32 px tall |
| Icon-only toolbar usability for new users | Low | Every icon has a tooltip with name + hotkey; a "label mode" option shows text alongside icons |
| Right inspector too wide on small screens | Low | Below 1024 px viewport width, inspector collapses to hidden-by-default; toggled via top-bar button |
