# Phase 2 Design Doc — Graphics & Architecture

> Status: Phase 2a COMPLETE — 2b, 2c, 2d in planning
> Last updated: 2026-04-05
> Companion: [prd.md](./prd.md)

---

## Overview

Phase 2 is split into three sub-phases:

- **2a — Modularize**: Split the monolithic `app.js` into ES6 modules with no behaviour change
- **2b — WebGL**: Replace the Canvas 2D renderer with Three.js
- **2c — Performance**: Sub-linear hit testing (BVH/spatial hash) and GC-free render loop

The split matters: modularizing first means the Three.js migration only touches `renderer.js`, and the performance work only touches `renderer.js` + a new `spatial.js`. All state, math, and UI code stays unchanged throughout.

---

## Phase 2a — ES6 Module Architecture

### Module Map

```
app/
  index.html          — unchanged; adds type="module" to script tag
  index.js            — entry point: imports all modules, calls init()
  state.js            — single source-of-truth for all mutable state
  math3d.js           — pure vector/geometry functions (no DOM, no state)
  spatial.js          — BVH / spatial hash for O(log N) hit testing  [added in 2c]
  renderer.js         — reads from state, draws to canvas (Canvas 2D in 2a)
  ui.js               — DOM event listeners, modal logic, panel updates
  styles.css          — unchanged
```

### Dependency Direction (strict, no cycles)

```
math3d.js  ←  state.js  ←  renderer.js  ←  ui.js  ←  index.js
                    ↑
               spatial.js
```

- `math3d.js` has zero imports (pure functions)
- `state.js` imports only from `math3d.js`
- `renderer.js` imports from `state.js` and `math3d.js`
- `ui.js` imports from `state.js` and `renderer.js`
- `index.js` imports everything and wires it together

---

### `state.js` — Mutable State

All global variables currently scattered across `app.js` move here.

```js
// Structure data
export let atoms = [];
export let bonds = [];
export let aid = 0;
export let customGroups = [];

// Camera
export let angleY = 35 * Math.PI / 180;
export let angleX = 20 * Math.PI / 180;
export let zoomVal = 72;
export let atomScale = 1;

// View flags
export let autoRotate = true;
export let showBonds = true;
export let showLabels = false;
export let faceAlpha = 0.18;
export let fogEnabled = false;
export let snapEnabled = true;
export let activePlane = 'none';

// Supercell
export let supercellEnabled = false;
export let supercellNx = 2;
export let supercellNy = 2;
export let supercellNz = 1;

// Edit mode
export let currentMode = 'view';
export let addSubMode = 'add';
export let addElement = 'Cu';
// ... (editSelected, selectedAtoms, bondSelection, etc.)

// History (undo/redo)
export let history = [];
export let historyIdx = -1;

// Mutators — all state changes go through these
export function setAtoms(next) { atoms = next; }
export function setMode(m) { currentMode = m; }
// ... etc.
```

**Why mutators?** Direct export mutation works in JS but is hard to trace. Named mutators make every state change grep-able.

---

### `math3d.js` — Pure Geometry

All vector math, projection, geometry functions. Currently these are inline in `app.js` — they extract cleanly because they have no side effects.

```js
// Vectors
export function v3sub(a, b) { ... }
export function v3add(a, b) { ... }
export function v3scale(a, s) { ... }
export function v3cross(a, b) { ... }
export function v3dot(a, b) { ... }
export function v3len(a) { ... }
export function v3norm(a) { ... }
export function v3dist(a, b) { ... }
export function rotatePoint(p, origin, u, angle) { ... }

// Projection (2D — stays for Phase 2a; replaced in 2b)
export function project(x, y, z, angleY, angleX, zoomVal, canvasW, canvasH) { ... }

// Geometry
export function areCoplanar(ids, atoms) { ... }
export function triangulatePlanar(ids, atoms) { ... }
export function convexHull3DFaces(ids, atoms) { ... }
export function decomposeFaces(ids, atoms) { ... }
export function collectEdges(faces) { ... }
export function describeGeom(ids, atoms) { ... }

// Lattice
export function getLatticeVectors(atoms) { ... }
```

Note: functions that currently reference global `atoms` take it as a parameter instead. This is the main mechanical change in the extraction.

---

### `renderer.js` — Drawing (Canvas 2D for Phase 2a)

Reads from `state.js` and `math3d.js`. Owns the canvas element.

```js
import * as state from './state.js';
import * as math from './math3d.js';

export let canvas, ctx;

export function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
}

export function resize() { ... }

// Main entry point called by animation loop and state changes
export function draw() { ... }

// Internal helpers (not exported)
function buildDrawList(projMap) { ... }
function renderAtom(d, projMap) { ... }
function renderBond(d) { ... }
function renderSupercellGhosts(drawList, projMap) { ... }
function drawMultiHUD(projMap) { ... }
function drawWorldAxes() { ... }
```

The spatial grid (`spatialGrid`, `globalProjMap`) lives inside `renderer.js` — it is a rendering implementation detail, not state.

---

### `ui.js` — DOM & Events

Owns all event listeners and DOM updates. Calls `state` mutators and `renderer.draw()`.

```js
import * as state from './state.js';
import * as renderer from './renderer.js';

export function init() {
    bindModeButtons();
    bindViewSliders();
    bindCanvasEvents();
    bindKeyboard();
    bindModals();
    bindSupercellControls();
}

// Separate functions per concern (not one giant addEventListener block)
function bindModeButtons() { ... }
function bindViewSliders() { ... }
function bindCanvasEvents() { ... }   // mousedown, mousemove, mouseup, wheel, touch
function bindKeyboard() { ... }
function bindModals() { ... }
function bindSupercellControls() { ... }

// DOM update functions (currently updateSelUI, updateUIHints, etc.)
export function updateSelUI() { ... }
export function updateModePill() { ... }
export function updateStats() { ... }
export function updateLegend() { ... }
export function buildColorRow() { ... }
export function buildElemPalette() { ... }
```

---

### `index.js` — Entry Point

```js
import { ELEMENTS } from './state.js';
import { init as initRenderer, draw } from './renderer.js';
import { init as initUI } from './ui.js';
import { buildDefault } from './state.js';

const canvas = document.getElementById('mol');
initRenderer(canvas);
initUI();
buildDefault();
draw();

// Animation loop
(function animate() {
    if (state.autoRotate) { state.angleY += 0.004; draw(); }
    requestAnimationFrame(animate);
})();
```

---

### `index.html` change for modules

```html
<!-- Before -->
<script src="app.js"></script>

<!-- After -->
<script type="module" src="index.js"></script>
```

No bundler needed. Native ES modules work in all modern browsers.

---

## Phase 2b — Three.js WebGL Renderer

Only `renderer.js` is replaced. All other modules are unchanged.

### Three.js Scene Structure

```
THREE.Scene
  ├── THREE.PerspectiveCamera       — replaces project() math
  ├── THREE.AmbientLight            — base fill light
  ├── THREE.DirectionalLight        — primary light (top-right-front)
  ├── THREE.DirectionalLight        — secondary fill (bottom-left-back, dimmer)
  ├── atomsGroup (THREE.Group)      — one Mesh per atom
  ├── bondsGroup (THREE.Group)      — one Mesh per bond (cylinder)
  ├── supercellGroup (THREE.Group)  — ghost copies (separate opacity)
  ├── polyhGroup (THREE.Group)      — polyhedron face meshes
  └── gizmoGroup (THREE.Group)      — axis gizmos (Line/ArrowHelper)
```

### Geometry Strategy

**Atoms**: `THREE.SphereGeometry` with `widthSegments=24, heightSegments=16`. One `MeshPhongMaterial` per element (colour from ELEMENTS catalog). Reuse geometry instance across atoms of the same element.

```js
const sphereGeo = new THREE.SphereGeometry(1, 24, 16); // radius 1, scaled per atom
const materials = {}; // keyed by element symbol

function getAtomMaterial(sym) {
    if (!materials[sym]) {
        materials[sym] = new THREE.MeshPhongMaterial({
            color: new THREE.Color(getCOL(sym)),
            shininess: 60,
            specular: new THREE.Color(0x444444),
        });
    }
    return materials[sym];
}
```

**Bonds**: `THREE.CylinderGeometry(r, r, 1, 8)` scaled and oriented between atom pair. Dashed bonds use `THREE.LineDashedMaterial` on a `THREE.Line` (not a cylinder) to match the existing dashed visual.

**Polyhedra faces**: `THREE.BufferGeometry` built from triangulated face data (same triangulation from `math3d.js`). `MeshBasicMaterial` with `transparent: true, opacity: faceAlpha, side: THREE.DoubleSide`.

---

### Camera & Controls

Replace custom `angleY`/`angleX`/`zoomVal` with Three.js built-ins:

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 1000);
camera.position.set(0, 0, 20);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = state.autoRotate;
controls.autoRotateSpeed = 1.5;
```

**State bridge**: `state.angleY/angleX/zoomVal` are kept in sync with the Three.js camera for serialisation (export/import JSON must preserve view state). On load, reconstruct `camera.position` and `controls` from saved state; on save, extract spherical coordinates back to `angleY/angleX/zoomVal`.

---

### Hit Testing — Raycasting

Replace the spatial grid with `THREE.Raycaster`:

```js
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function hitTest(mx, my) {
    pointer.x = (mx / canvas.clientWidth) * 2 - 1;
    pointer.y = -(my / canvas.clientHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(atomsGroup.children);
    return hits.length ? hits[0].object.userData.atomId : null;
}
```

Each atom mesh stores `mesh.userData.atomId = atom.id`. Bond hit-testing uses the same approach on `bondsGroup`.

The spatial grid in `renderer.js` is removed in Phase 2b.

---

### Multi-HUD Overlay (Bond Lengths & Angles)

Three.js's `CSS2DRenderer` renders HTML labels anchored to 3D positions — no manual canvas text drawing needed.

```js
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(w, h);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
canvasContainer.appendChild(labelRenderer.domElement);
```

Bond length label: create one `CSS2DObject` per hovered bond, position at bond midpoint. Bond angle arcs: draw as `THREE.Line` arcs in `gizmoGroup` + `CSS2DObject` for the text.

---

### Depth Fog

Three.js has built-in fog — zero manual implementation needed:

```js
// Linear fog
scene.fog = new THREE.Fog(bgColor, 10, 40); // near, far distances

// Toggle
scene.fog = state.fogEnabled ? new THREE.Fog(bgColor, 10, 40) : null;
```

This replaces the manual `szRange`/fog-factor implementation entirely.

---

### Supercell Tiling

`supercellGroup` contains instanced meshes for ghost copies. Use `THREE.InstancedMesh` for performance (one draw call per element type, N instances):

```js
const instancedMesh = new THREE.InstancedMesh(sphereGeo, ghostMaterial, instanceCount);
instancedMesh.setMatrixAt(i, matrix); // position + scale per ghost atom
supercellGroup.add(instancedMesh);
```

Ghost material: `MeshPhongMaterial` with `transparent: true, opacity: 0.32`.

---

### PNG Export in WebGL

```js
window.exportPNG = function() {
    renderer.render(scene, camera); // ensure frame is current
    const link = document.createElement('a');
    link.download = 'HKUST-1_structure.png';
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
};
```

WebGL canvas `toDataURL` requires `preserveDrawingBuffer: true` in the renderer:

```js
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
});
```

---

### Axis Gizmos

Two options in order of effort:

1. **`THREE.TransformControls`** (built-in addon) — handles translate and rotate gizmos out of the box. Requires adapting the existing 2-atom selection model to drive `TransformControls.attach(object)`.
2. **Hand-rolled** — `THREE.ArrowHelper` for translate axes, `THREE.TorusGeometry` for rotate rings. Closer to the existing visual style.

Recommendation: start with `TransformControls` and adapt the selection model to drive it. Fall back to hand-rolled if the interaction model diverges too much.

---

### Migration Sequence (Phase 2b Steps)

1. Add Three.js to `index.html` (CDN: `importmap` or `<script type="importmap">`)
2. Create new `renderer.js` alongside old one; keep old as `renderer-2d.js` during transition
3. Build static scene (atoms + bonds, no interaction) — verify lighting and materials
4. Wire `OrbitControls` — verify rotate/zoom
5. Wire raycasting hit test — verify atom/bond hover and click
6. Port axis gizmos — verify translate and rotate drag
7. Port polyhedra rendering
8. Port supercell group
9. Port Multi-HUD with `CSS2DRenderer`
10. Wire fog toggle (`scene.fog`)
11. Verify PNG export (`preserveDrawingBuffer`)
12. Delete `renderer-2d.js`

---

## Phase 2c — Performance Optimization

### Problem: O(N) Hit Testing

**Current code** (`app.js:hitTest`, `hitBondTest`): iterates the spatial grid on every `mousemove`. The grid cell size is fixed at 40 px and is rebuilt every frame in `draw()` by re-inserting every atom and bond into `spatialGrid`. This is already O(N) per frame for the rebuild, and O(k) per lookup where k is atoms per cell — which degrades to O(N) in dense projections.

At 5,000 atoms this means ~10,000 operations on every single mouse move event.

**Fix**: A **3D Axis-Aligned Bounding Box (AABB) tree (BVH)** built once over world-space atom positions, queried via Three.js raycasting.

For the Canvas 2D path (Phase 2a), use a **2D screen-space grid hash** that is rebuilt only when the structure changes or the camera moves, not every frame.

---

### `spatial.js` — Spatial Index Module

```js
// 3D octree / BVH over atom positions in world space
// Rebuilt only when atoms[] changes (dirty flag)

export class AtomBVH {
    constructor() {
        this._dirty = true;
        this._nodes = null;
    }

    // Call after any atoms[] mutation
    markDirty() { this._dirty = true; }

    // Rebuild if dirty, then query
    // Returns atomId of nearest atom within screenRadius, or null
    query(raycaster, atoms) {
        if (this._dirty) this._rebuild(atoms);
        return this._raycast(raycaster);
    }

    _rebuild(atoms) {
        // Build AABB tree over [atom.x, atom.y, atom.z] positions
        // Use three-mesh-bvh for the WebGL path, or a simple
        // recursive median-split octree for the Canvas 2D path
        this._dirty = false;
    }

    _raycast(raycaster) { ... }
}

export class BondSpatialHash {
    // 3D grid hash, cell size = max bond length (~2.5 Å)
    // Rebuilt only when bonds[] changes
    constructor() { this._dirty = true; }
    markDirty() { this._dirty = true; }
    query(ray, bonds, atoms) { ... }
}
```

**Dirty flag pattern**: `state.js` mutators call `bvh.markDirty()` after any `atoms[]` or `bonds[]` change. The BVH rebuilds lazily on the next query, not on every state mutation. Rebuild cost at 5,000 atoms is ~2–5 ms (one-time); query cost is O(log N) ≈ 0.05 ms.

---

### Three.js Path: `three-mesh-bvh`

In the WebGL renderer, use the [`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh) library — the standard solution for high-performance BVH raycasting on Three.js geometry.

```js
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// Patch THREE.Mesh to use BVH-accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// After building atom meshes:
atomMesh.geometry.boundsTree = new MeshBVH(atomMesh.geometry);
```

For `InstancedMesh` (used for supercell ghost atoms), use `three-mesh-bvh`'s instanced mesh support to cast rays against all instances in one call.

The Three.js `Raycaster` then automatically uses the BVH when `.intersectObject()` is called — no other changes needed.

---

### Problem: GC Pressure in the Render Loop

**Current code**: every call to `draw()` executes:

```js
globalProjMap = {};          // new Object — GC
const projMap = globalProjMap;
spatialGrid.clear();         // OK (Map.clear is in-place)
const proj = atoms.map(...); // new Array — GC
const drawList = [];         // new Array — GC
```

At 60 fps this creates ~180 new objects per second. Each one is a collection of further nested objects (the atom projection entries). The JS engine's short-lived object allocator handles this efficiently up to a point, but at 5,000+ atoms the total allocation per frame exceeds the minor GC threshold, causing stop-the-world micro-pauses that manifest as visible frame stutters.

---

### Fix: Pre-allocate and Reuse

**`projMap` — typed flat array instead of object**

Replace the keyed object with a flat `Float32Array` indexed by atom array index:

```js
// Allocated once at structure load, sized to atoms.length
// Layout per atom: [sx, sy, sz, ps]  (4 floats)
let projBuffer = new Float32Array(0);

function ensureProjBuffer() {
    const needed = atoms.length * 4;
    if (projBuffer.length < needed) {
        projBuffer = new Float32Array(needed * 2); // 2x growth factor
    }
}

// In draw(), fill by index — zero allocation
function buildProjMap() {
    ensureProjBuffer();
    for (let i = 0; i < atoms.length; i++) {
        const p = project(atoms[i].x, atoms[i].y, atoms[i].z);
        projBuffer[i * 4 + 0] = p.sx;
        projBuffer[i * 4 + 1] = p.sy;
        projBuffer[i * 4 + 2] = p.sz;
        projBuffer[i * 4 + 3] = p.ps;
    }
}

// Lookup by atom array index (O(1), no hashing)
function getProjSx(i) { return projBuffer[i * 4 + 0]; }
// etc.
```

A secondary `idToIndex` `Int32Array` (sized to `max atom.id`) maps `atom.id → array index` for the cases where lookup by id is needed (bond rendering, hit test).

**`drawList` — fixed-length array, updated by write index**

```js
// Allocated once, grown only when needed
let drawList = new Array(4096);
let drawListLen = 0;

function resetDrawList() { drawListLen = 0; }

function pushDrawItem(item) {
    if (drawListLen >= drawList.length) {
        // Grow: copy into a new array (rare, only on large imports)
        drawList = [...drawList, ...new Array(drawList.length)];
    }
    drawList[drawListLen++] = item; // reuse existing slot
}

// Sort only the live portion
drawList.slice(0, drawListLen).sort((a, b) => a.z - b.z);
// Or: maintain a separate sorted index array to avoid creating a new array
```

In the Three.js path (2b), `drawList` is replaced entirely by the Three.js scene graph — this GC fix only applies to the Canvas 2D renderer in Phase 2a.

---

### Dirty-Driven Rendering

Currently `draw()` is called on every `mousemove`, even when only the hover state changes. Split rendering into two tiers:

```js
// Tier 1: Full scene redraw (atoms, bonds, polyhedra)
// Only when: structure changes, camera moves, mode changes
let sceneDirty = true;

// Tier 2: HUD-only redraw (bond lengths, angle labels, tooltip)
// On every mousemove — but only redraws the HUD overlay, not the full scene
let hudDirty = true;

function animate() {
    if (sceneDirty) { renderScene(); sceneDirty = false; }
    if (hudDirty)   { renderHUD();   hudDirty = false; }
    requestAnimationFrame(animate);
}
```

In the Canvas 2D path this means caching the molecule render to an `OffscreenCanvas` and compositing it with the HUD layer. In the Three.js path (2b), `renderer.render(scene, camera)` is only called when `sceneDirty` is true; the CSS2D labels update independently.

This alone reduces full-scene draw calls from 60/s (every mousemove) to camera-move events only, cutting GPU/CPU work by ~10× during hover-only interaction.

---

### Performance Budget

| Operation | Current (5k atoms) | Target (5k atoms) |
|---|---|---|
| `draw()` frame time | ~80 ms (dropped frames) | ≤ 16 ms |
| Hit test per mousemove | ~8 ms (O(N) grid) | ≤ 0.5 ms (O(log N) BVH) |
| BVH rebuild on edit | N/A | ≤ 5 ms (one-time) |
| Per-frame heap allocation | ~500 KB/s | 0 (zero alloc) |
| GC pause frequency | Every ~2 s | None |

---

### Migration Sequence (Phase 2c Steps)

1. Add `spatial.js` with `AtomBVH` and `BondSpatialHash` classes
2. Wire dirty flag: call `markDirty()` from all `state.js` mutators that touch `atoms[]` or `bonds[]`
3. Replace `hitTest` / `hitBondTest` in `renderer.js` to use `AtomBVH.query()` / `BondSpatialHash.query()`
4. Replace `projMap = {}` with `Float32Array` buffer in `renderer.js`
5. Replace `drawList = []` with pre-allocated pool in `renderer.js`
6. Implement dirty-driven `animate()` loop; wire `sceneDirty = true` on camera change and structure mutation
7. Benchmark at 5,000 atoms: verify hit test ≤ 0.5 ms, frame time ≤ 16 ms, zero GC pauses
8. For WebGL path (after 2b): integrate `three-mesh-bvh` into `renderer.js`

---

## Phase 2d — UI/UX Redesign

### Design Principles

1. **Canvas is sovereign** — the molecule is never cropped or pushed. Every pixel of the viewport belongs to the 3D scene.
2. **UI floats, never interrupts** — panels hover over the canvas at reduced opacity. The molecule is always visible through them.
3. **Dark is the default** — deep space backgrounds make atom colours pop. Light mode is an option, not the target.
4. **Spatial hierarchy** — function determines position. Editing tools live left. Inspection lives right. Globals live top. Status lives bottom.
5. **Motion communicates** — every state change has a transition. Nothing snaps without reason.

---

### Design Token System

All visual values are defined as CSS custom properties on `:root`. No hardcoded colours anywhere in the CSS.

```css
:root {
  /* Canvas background — deep space slate */
  --bg-canvas:       #0a0b0f;

  /* Glass panel surfaces */
  --glass-bg:        rgba(10, 12, 18, 0.72);
  --glass-bg-hover:  rgba(14, 16, 24, 0.82);
  --glass-blur:      24px;
  --glass-saturate:  180%;
  --glass-border:    rgba(255, 255, 255, 0.07);
  --glass-border-hi: rgba(255, 255, 255, 0.14);
  --glass-shadow:    0 8px 32px rgba(0, 0, 0, 0.5),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05);

  /* Text */
  --txt-primary:     #f0f2f7;
  --txt-secondary:   rgba(240, 242, 247, 0.55);
  --txt-tertiary:    rgba(240, 242, 247, 0.28);
  --txt-mono:        'JetBrains Mono', monospace;

  /* Accent palette */
  --accent:          #4f8ef7;   /* electric blue — primary action */
  --accent-dim:      rgba(79, 142, 247, 0.14);
  --accent-glow:     rgba(79, 142, 247, 0.35);
  --purple:          #7c6ff7;   /* selection state */
  --green:           #22d3a5;   /* add / confirm */
  --amber:           #f59e0b;   /* snap / rotate handles */
  --red:             #f05252;   /* delete / danger */

  /* Atom element colours (tuned for dark canvas) */
  --atom-cu:         #5b73d4;   /* brighter than current #3B4D9E */
  --atom-o:          #c0cdee;
  --atom-c:          #9ca3af;
  --atom-h:          #6b7280;

  /* Surfaces & structure */
  --radius-sm:       6px;
  --radius-md:       10px;
  --radius-lg:       16px;
  --radius-pill:     999px;

  /* Layout dimensions */
  --topbar-h:        48px;
  --toolbar-w:       52px;
  --inspector-w:     272px;
  --statusbar-h:     32px;

  /* Motion */
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast:   120ms;
  --duration-panel:  210ms;
}
```

**Light theme** overrides only the surface tokens — atom colours and accent are unchanged:

```css
[data-theme='light'] {
  --bg-canvas:       #f0f2f8;
  --glass-bg:        rgba(248, 249, 252, 0.78);
  --glass-bg-hover:  rgba(255, 255, 255, 0.88);
  --glass-border:    rgba(0, 0, 0, 0.07);
  --glass-border-hi: rgba(0, 0, 0, 0.14);
  --glass-shadow:    0 4px 24px rgba(0, 0, 0, 0.12),
                     inset 0 1px 0 rgba(255, 255, 255, 0.8);
  --txt-primary:     #0f1117;
  --txt-secondary:   rgba(15, 17, 23, 0.55);
  --txt-tertiary:    rgba(15, 17, 23, 0.30);
}
```

---

### Layout Architecture

The entire UI is a CSS Grid overlay on top of a full-bleed canvas:

```css
body {
  margin: 0;
  overflow: hidden;
  background: var(--bg-canvas);
}

/* Canvas fills viewport exactly */
#mol {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}

/* UI shell floats above canvas */
#ui-shell {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template:
    "topbar  topbar    topbar"    var(--topbar-h)
    "toolbar .         inspector" 1fr
    "toolbar statusbar statusbar" var(--statusbar-h)
  / var(--toolbar-w) 1fr var(--inspector-w);
  pointer-events: none; /* shell is invisible — only children capture events */
}

#ui-shell > * {
  pointer-events: auto;
}
```

When the inspector is collapsed, `--inspector-w` transitions to `52px` (icon strip only):

```css
#ui-shell.inspector-collapsed {
  grid-template-columns: var(--toolbar-w) 1fr 52px;
  transition: grid-template-columns var(--duration-panel) var(--ease-out-expo);
}
```

---

### Glassmorphism Panel Mixin

Applied to every floating surface:

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.glass:hover {
  border-color: var(--glass-border-hi);
  background: var(--glass-bg-hover);
  transition: background var(--duration-fast) var(--ease-in-out),
              border-color var(--duration-fast) var(--ease-in-out);
}
```

---

### Top App Bar

```
┌─────────────────────────────────────────────────────────────┐
│  ⬡ HKUST-1          ↶  ↷     │  ↓ PNG   ↓ JSON   ↑ Import │
└─────────────────────────────────────────────────────────────┘
```

- Height: `var(--topbar-h)` = 48 px
- Full-width glass panel, no border-radius (flush to top edge)
- Left: molecule icon + app name in `--txt-secondary` (subtle, not dominant)
- Center: empty — canvas wins
- Right: undo/redo group (pill-shaped button group with divider), then PNG/JSON export, then Import
- Border-bottom only: `1px solid var(--glass-border)`

**Button group styling**:
```css
.btn-group {
  display: flex;
  border: 1px solid var(--glass-border-hi);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.btn-group .btn + .btn {
  border-left: 1px solid var(--glass-border);
}
```

---

### Left Vertical Toolbar

```
┌──┐
│⊙ │  View       [V]
│✎ │  Move       [E]
│⬡ │  Poly       [S]
│+ │  Add        [A]
│× │  Delete     [D]
│▬ │  Bonds      [B]
└──┘
```

- Width: `var(--toolbar-w)` = 52 px, full viewport height minus topbar and statusbar
- Glass panel, no border-radius (flush to left edge), right border only
- Each mode button: 44×44 px touch target, centred SVG icon (20×20 px)
- Active state: accent-coloured left border (3 px) + `--accent-dim` background
- Hover state: `--glass-bg-hover` background, 150 ms transition
- Tooltip: appears to the right of the hovered button after 400 ms delay

```css
.tool-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--txt-secondary);
  transition: background var(--duration-fast) var(--ease-in-out),
              color var(--duration-fast) var(--ease-in-out);
  position: relative;
}
.tool-btn:hover { background: rgba(255,255,255,0.06); color: var(--txt-primary); }
.tool-btn.active {
  background: var(--accent-dim);
  color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}
```

**Tooltip** (appears on hover, 400 ms delay):
```css
.tool-tooltip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-in-out),
              transform var(--duration-fast) var(--ease-in-out);
  white-space: nowrap;
}
.tool-btn:hover .tool-tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
  transition-delay: 400ms;
}
```

Tooltip content: `<span class="tt-name">Move</span> <kbd>[E]</kbd>`

---

### Right Inspector Panel

Collapsible panel, 272 px wide when open, 52 px when collapsed (shows section icons only).

```
┌────────────────────────────┐
│ ⚙ View Settings         ‹  │  ← collapse toggle
├────────────────────────────┤
│  Zoom          ───●─── 72  │
│  Atom size     ──●──── 100%│
│  Face α        ─●───── 18% │
│  ☑ Auto-rotate  ☑ Bonds   │
│  ☑ Labels       ☑ Fog     │
│  [Toggle Theme]            │
├────────────────────────────┤
│ 🎨 Colours              ▾  │  ← section header (collapsible)
├────────────────────────────┤
│  Cu ■  O ■  C ■  H ■      │
├────────────────────────────┤
│ ◈ Presets               ▾  │
├────────────────────────────┤
│  Planes: [None][Cu–O]...   │
│  Camera: [Top][Side][¾]    │
├────────────────────────────┤
│ ⊞ Supercell             ▾  │
├────────────────────────────┤
│  ☐ Enable  X[2] Y[2] Z[1] │
└────────────────────────────┘
```

- Glass panel, no border-radius (flush to right edge), left border only
- Each section uses `<details>` with custom marker replaced by chevron icon
- Collapse animation: `max-height` transition with `overflow: hidden`
- Full collapse to icon strip: inspector slides right by `(272 - 52)px`

```css
#inspector {
  width: var(--inspector-w);
  transition: width var(--duration-panel) var(--ease-out-expo);
  overflow: hidden;
}
#inspector.collapsed { width: 52px; }
```

**Section headers**:
```css
.inspector-section summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font: 600 11px/1 var(--font);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--txt-tertiary);
  cursor: pointer;
  border-top: 1px solid var(--glass-border);
  user-select: none;
}
.inspector-section summary:hover { color: var(--txt-secondary); }
```

**Sliders** — refined style:
```css
input[type='range'] {
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--accent) 0% var(--pct, 50%),
    rgba(255,255,255,0.12) var(--pct, 50%) 100%
  );
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
  transition: box-shadow var(--duration-fast);
}
input[type='range']:hover::-webkit-slider-thumb {
  box-shadow: 0 0 0 6px var(--accent-glow);
}
```

**Checkboxes** — pill-toggle style:
```css
.toggle {
  width: 32px; height: 18px;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.12);
  position: relative;
  cursor: pointer;
  transition: background var(--duration-fast);
}
.toggle.on { background: var(--accent); }
.toggle::after {
  content: '';
  position: absolute;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: white;
  top: 2px; left: 2px;
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.toggle.on::after { transform: translateX(14px); }
```

---

### Bottom Status Bar

```
┌─────────────────────────────────────────────────────────────┐
│  ⬡ 120 atoms  · ▬ 150 bonds  · Cu–Cu 2.62Å  · Cu–O 1.97Å  │   ● VIEW MODE
└─────────────────────────────────────────────────────────────┘
```

- Height: `var(--statusbar-h)` = 32 px
- Glass panel, no border-radius (flush to bottom), top border only
- Left: molecular stats in `--txt-tertiary`, `10px` mono font, `·` separator
- Right: current mode pill — coloured dot + mode name (replaces the floating mode pill)
- Stats update only on structure change (not every frame)

The existing floating `#mode-pill` is removed; its content moves into the status bar right side.

---

### Floating Tooltips & Overlays

**Atom/bond HTML tooltip** — replaced with a more refined floating card:

```css
#tip {
  background: var(--glass-bg-hover);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border-hi);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  padding: 8px 12px;
  font: 400 12px/1.5 var(--font);
  color: var(--txt-primary);
  /* Entry animation */
  transform: translateY(4px);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-in-out),
              transform var(--duration-fast) var(--ease-in-out);
}
#tip.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Suppressed in edit modes** (R11 from planned features): when `currentMode !== 'view'`, the tooltip is not shown. This reduces noise during active editing.

**Snap indicator** — pill badge, bottom-centre of canvas:

```css
#snap-indicator {
  background: var(--green);
  color: #fff;
  font: 600 10px/1 var(--txt-mono);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  box-shadow: 0 2px 12px rgba(34, 211, 165, 0.4);
}
```

**Axis measurement tip** — same pill style but coloured to match the active axis.

---

### Mode-Driven Context Bar

The bottom selection/edit bar (currently `#sel-bar`, `#edit-bar`) moves to a floating card that appears above the status bar only when relevant:

```
┌──────────────────────────────────────────────┐
│  Selected: ● Cu#0   ● O#1      [Clear]       │
└──────────────────────────────────────────────┘
```

```css
.ctx-card {
  position: fixed;
  bottom: calc(var(--statusbar-h) + 12px);
  left: calc(var(--toolbar-w) + 12px);
  right: calc(var(--inspector-w) + 12px);
  /* glass */
  padding: 8px 14px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 8px;
  /* entry/exit */
  transform: translateY(8px);
  opacity: 0;
  transition: opacity var(--duration-panel) var(--ease-out-expo),
              transform var(--duration-panel) var(--ease-out-expo);
}
.ctx-card.visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

### World Axes Widget

Moves from bottom-left corner to bottom-left corner of the canvas with padding:

```
Bottom-left of canvas:
  X → (red)
  Y ↑ (green)
  Z ↗ (blue)
  [52px × 52px box]
```

Positioned at `left: calc(var(--toolbar-w) + 12px); bottom: calc(var(--statusbar-h) + 12px)` — always clear of the toolbar and status bar.

---

### SVG Icon Set

Inline SVGs used for the toolbar (no icon font dependency). All icons are 20×20 px, `stroke: currentColor`, `stroke-width: 1.5`, `fill: none`:

| Mode | Icon description |
|---|---|
| View | Eye outline |
| Move | Four-directional arrow |
| Polyhedron | Hexagon outline |
| Add | Plus circle |
| Delete | Trash outline |
| Edit Bonds | Two dots connected by a line |

---

### Animation Inventory

| Element | Trigger | Animation |
|---|---|---|
| Tool button hover | `mouseenter` | Background fade-in, 120 ms |
| Tool button active | Mode switch | Left accent border slides in + bg, 150 ms |
| Inspector open/close | Toggle button | `width` transition, 210 ms ease-out-expo |
| Inspector section | `<details>` toggle | `max-height` transition, 180 ms ease |
| Atom hover | `mousemove` over atom | Ring appears (CSS outline on Three.js CSS2D object), 80 ms |
| Tooltip show | Hover starts | `opacity` + `translateY(4px→0)`, 120 ms after 80 ms delay |
| Tooltip hide | `mouseleave` | `opacity` → 0, 80 ms |
| Context card show | Selection changes | `opacity` + `translateY(8px→0)`, 210 ms |
| Context card hide | Selection clears | `opacity` → 0 + slide down, 150 ms |
| Mode pill (status bar) | Mode switch | Colour cross-fade, 150 ms |
| Snap indicator show | Snap activates | Scale `0.8 → 1` + fade, 100 ms |
| Panel entry (import/export modal) | `modal-open` | Scale `0.96 → 1` + fade, 180 ms |

---

### HTML Structure (Phase 2d)

```html
<body>
  <!-- Full-bleed canvas — always behind everything -->
  <canvas id="mol"></canvas>

  <!-- Floating UI shell — CSS grid overlay -->
  <div id="ui-shell">

    <!-- Top app bar -->
    <header id="topbar" class="glass" style="grid-area: topbar">
      <div class="topbar-left">
        <span class="app-icon">⬡</span>
        <span class="app-name">HKUST-1</span>
      </div>
      <div class="topbar-right">
        <div class="btn-group">
          <button id="btn-undo" class="btn sm" title="Undo (Ctrl+Z)">↶</button>
          <button id="btn-redo" class="btn sm" title="Redo (Ctrl+Y)">↷</button>
        </div>
        <button class="btn" onclick="exportPNG()">↓ PNG</button>
        <button class="btn" onclick="openExport()">↓ JSON</button>
        <button class="btn" onclick="openImport()">↑ Import</button>
      </div>
    </header>

    <!-- Left vertical toolbar -->
    <nav id="toolbar" class="glass" style="grid-area: toolbar">
      <button class="tool-btn active" data-mode="view" title="View [V]">
        <!-- SVG eye icon -->
        <span class="tool-tooltip">View <kbd>V</kbd></span>
      </button>
      <button class="tool-btn" data-mode="move" title="Move [E]">
        <!-- SVG move icon -->
        <span class="tool-tooltip">Move <kbd>E</kbd></span>
      </button>
      <!-- ... other modes ... -->
      <div class="toolbar-divider"></div>
      <button class="tool-btn" onclick="resetStructure()" title="Reset SBU">
        <!-- SVG refresh icon -->
        <span class="tool-tooltip">Reset SBU</span>
      </button>
    </nav>

    <!-- Right inspector panel -->
    <aside id="inspector" class="glass" style="grid-area: inspector">
      <div class="inspector-header">
        <button id="inspector-toggle" class="tool-btn" title="Collapse">‹</button>
      </div>

      <details class="inspector-section" open>
        <summary>⚙ View Settings</summary>
        <div class="inspector-body">
          <!-- sliders, toggles -->
        </div>
      </details>

      <details class="inspector-section">
        <summary>🎨 Colours</summary>
        <div class="inspector-body" id="color-row"></div>
      </details>

      <details class="inspector-section">
        <summary>◈ Presets</summary>
        <div class="inspector-body"><!-- planes, camera presets --></div>
      </details>

      <details class="inspector-section">
        <summary>⊞ Supercell</summary>
        <div class="inspector-body"><!-- supercell controls --></div>
      </details>
    </aside>

    <!-- Bottom status bar -->
    <footer id="statusbar" class="glass" style="grid-area: statusbar">
      <div class="status-stats">
        <span>⬡ <span id="s-natoms">—</span></span>
        <span class="sep">·</span>
        <span>▬ <span id="s-nbonds">—</span></span>
        <span class="sep">·</span>
        <span>Cu–Cu <span id="s-cucu">—</span></span>
        <span class="sep">·</span>
        <span>Cu–O <span id="s-cuo">—</span></span>
      </div>
      <div id="mode-badge" class="mode-badge">
        <span class="mode-dot"></span>
        <span class="mode-label">VIEW</span>
      </div>
    </footer>

  </div><!-- end #ui-shell -->

  <!-- Floating overlays (outside grid, position:fixed) -->
  <div id="tip" role="tooltip" aria-hidden="true"></div>
  <div id="axis-tip" aria-hidden="true"></div>
  <div id="snap-indicator" aria-hidden="true"></div>
  <div class="ctx-card" id="sel-bar">...</div>
  <div class="ctx-card" id="edit-bar">...</div>

  <!-- Modals (unchanged structure, updated styles) -->
  <!-- ... -->

  <script type="module" src="index.js"></script>
</body>
```

---

### `ui.js` Changes (Phase 2d)

- `buildToolbar()`: wire `data-mode` buttons, handle active state via CSS class swap
- `initInspector()`: wire collapse toggle, sync `--inspector-w` CSS var, persist collapsed state in `localStorage`
- `updateModeBadge()`: replaces `updateModePill()` — updates `.mode-dot` colour + `.mode-label` text in status bar
- `updateStats()`: now targets status bar `#s-natoms` etc. — no positional change, just new element locations
- All `ctx-bar` → `ctx-card` class renames
- Tooltip suppression: `if (currentMode !== 'view') { tip.style.display = 'none'; return; }` added to mousemove handler

---

### Migration Sequence (Phase 2d Steps)

1. Add all new CSS tokens to `styles.css`; smoke-test dark token values in isolation
2. Rewrite `index.html` body structure (canvas + `#ui-shell` grid + new section elements)
3. Remove old panel `div` structure (`.app-bar`, `.wrap`, in-canvas overlay panels)
4. Implement toolbar icon buttons with tooltips; wire mode switching
5. Implement inspector panel with `<details>` sections; wire collapse toggle
6. Implement status bar; move stats + mode pill content
7. Implement `ctx-card` context cards; wire show/hide animations via `.visible` class
8. Implement glass modals (export/import/custom elem) with entry animation
9. Verify all keyboard shortcuts still function (none are changing)
10. Test tooltip suppression in all edit modes

---

### Testing Plan (Phase 2d)

- Canvas occupies `window.innerWidth × window.innerHeight` exactly (verify via `canvas.getBoundingClientRect()`) ✓
- All panels have `backdrop-filter` applied (verify via DevTools computed styles) ✓
- Default load theme is dark (`data-theme="dark"` on `<html>`) ✓
- Inspector collapses and expands with animation (no flash/jump) ✓
- All 6 toolbar mode buttons switch mode and update active styling correctly ✓
- Status bar mode badge updates on every mode change ✓
- Tooltip hidden in all non-view modes ✓
- All existing keyboard shortcuts (V, E, S, A, D, B, Ctrl+Z, Escape) work ✓
- Viewport resize: canvas and all panels resize correctly ✓
- Below 1024 px width: inspector starts collapsed ✓

---


- Load app in browser: default SBU renders identically ✓
- All 5 edit modes work ✓
- Import JSON, XYZ, MOL, CIF ✓
- Export JSON, PNG ✓
- Undo/redo ✓
- Supercell + fog toggles ✓

### Phase 2b (WebGL)
- Same checklist as 2a
- Visual: atoms appear as lit 3D spheres (not flat gradient circles) ✓
- Visual: intersecting polyhedra render without Z-fighting ✓
- Performance: 60 fps at default SBU ✓
- Performance: ≥ 30 fps at 2×2×2 supercell tiling ✓
- PNG export produces correct image with background ✓

### Phase 2c (Performance)
- `hitTest` measured via `performance.now()` at 5,000 atoms: ≤ 0.5 ms ✓
- `draw()` frame time at 5,000 atoms: ≤ 16 ms ✓
- Chrome DevTools Memory panel: flat heap during rotation (no sawtooth GC pattern) ✓
- Chrome DevTools Performance panel: no frames > 16 ms during hover-only interaction ✓
- BVH rebuild after atom edit: ≤ 5 ms ✓
- All hit testing (atom click, bond click, axis gizmo) still correct after BVH switch ✓

---

## File Size Budget

| Module | Estimated lines |
|---|---|
| `state.js` | ~150 |
| `math3d.js` | ~200 |
| `spatial.js` | ~150 |
| `renderer.js` (2a, Canvas 2D) | ~350 |
| `renderer.js` (2b, Three.js) | ~300 |
| `ui.js` | ~350 |
| `index.js` | ~30 |
| **Total** | **~1180–1230** |

The current monolith is ~1500 lines. The modular version is shorter because Three.js replaces ~300 lines of custom projection, hit-test, and fog math. `spatial.js` adds ~150 lines but replaces the per-frame spatial grid rebuild that was inline in `draw()`.
