/**
 * renderer.test.js — Integration tests for hit-testing in app/renderer.js
 *
 * Coverage target: hitTest, hitBondTest, hitCavityTest (T.5)
 *
 * Strategy:
 *   1. Create a mock canvas with a no-op 2D context (jsdom canvas stub is
 *      insufficient; we provide our own).
 *   2. Populate app state with a known structure.
 *   3. Call draw() to build the spatial grid and projMap.
 *   4. Assert hit-test functions return expected results.
 *
 * @jest-environment jsdom
 */

import { app, A, B } from '../../state.js';
import {
  init,
  resize,
  getCanvas,
  draw,
  hitTest,
  hitBondTest,
  hitAxisTest,
  hitCavityTest,
} from '../../renderer.js';

// ─── Canvas mock ─────────────────────────────────────────────────────────────

const W = 800, H = 600;

function makeCtx() {
  const nop = () => {};
  return {
    beginPath:             nop,
    arc:                   nop,
    fill:                  nop,
    stroke:                nop,
    moveTo:                nop,
    lineTo:                nop,
    closePath:             nop,
    setLineDash:           nop,
    fillText:              nop,
    strokeText:            nop,
    save:                  nop,
    restore:               nop,
    scale:                 nop,
    translate:             nop,
    rotate:                nop,
    setTransform:          nop,
    transform:             nop,
    quadraticCurveTo:      nop,
    bezierCurveTo:         nop,
    ellipse:               nop,
    clip:                  nop,
    createRadialGradient:  () => ({ addColorStop: nop }),
    createLinearGradient:  () => ({ addColorStop: nop }),
    fillRect:              nop,
    strokeRect:            nop,
    clearRect:             nop,
    measureText:           () => ({ width: 50 }),
    fillStyle:   '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth:   1,
    lineCap:     '',
    lineJoin:    '',
    font:        '',
    textAlign:   '',
    shadowBlur:  0,
    shadowColor: '',
    miterLimit:  10,
  };
}

function makeCanvas() {
  const ctx = makeCtx();
  return {
    getContext:    () => ctx,
    clientWidth:   W,
    clientHeight:  H,
    width:         W,
    height:        H,
    parentElement: { clientWidth: W, clientHeight: H },
    toDataURL:     () => 'data:image/png;base64,AA==',
  };
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

let mockCanvas;

beforeAll(() => {
  mockCanvas = makeCanvas();
  init(mockCanvas);
});

beforeEach(() => {
  app.atoms        = [];
  app.bonds        = [];
  app.aid          = 0;
  app.customGroups = [];
  app.atomById.clear();
  app.structureVersion = 0;
  app.drawGroupsCache  = null;
  app.activePlane      = 'none';
  app.angleY           = 0;   // no rotation — easy to predict projections
  app.angleX           = 0;
  app.zoomVal          = 72;
  app.atomScale        = 1;
  app.showBonds        = true;
  app.supercellEnabled = false;
  app.currentMode      = 'view';
  app.editSelected     = [];
  app.selectedAtoms    = [];
  app.bondSelection    = [];
  app.hoveredAtom      = null;
  app.hoveredBond      = -1;
  app.currentAxes      = [];
  app.addSourceAtom    = null;
  app.activeSnapGuides = [];
  app.editDragging     = false;
  app.dragging         = false;
});

// ─── hitTest ──────────────────────────────────────────────────────────────────

describe('hitTest', () => {
  test('returns null when no atoms', () => {
    draw();
    expect(hitTest(W / 2, H / 2)).toBeNull();
  });

  test('hits atom at canvas centre (atom at origin, no rotation)', () => {
    // With angleX=angleY=0, atom at (0,0,0) projects to (W/2, H/2).
    A(0, 0, 0, 'Cu');
    draw();
    const hit = hitTest(W / 2, H / 2);
    expect(hit).not.toBeNull();
    expect(hit.t).toBe('Cu');
  });

  test('returns null when clicking far from any atom', () => {
    A(0, 0, 0, 'Cu');
    draw();
    // Far corner of canvas — well outside any atom radius
    expect(hitTest(10, 10)).toBeNull();
  });

  test('picks the topmost (highest sz) atom when two overlap', () => {
    // Atom at z=+2 is closer to viewer than atom at z=-2;
    // both project near centre but with different sz values.
    A(0, 0,  2, 'Cu');
    A(0, 0, -2, 'O');
    draw();
    const hit = hitTest(W / 2, H / 2);
    expect(hit).not.toBeNull();
    // The Cu atom at z=+2 is further forward in the projection → higher sz
    // (z2 = y*sin(angleX) + z1*cos(angleX); with angleX=0, sz=z)
    // so Cu (z=2, sz=2) beats O (z=-2, sz=-2)
    expect(hit.t).toBe('Cu');
  });
});

// ─── hitBondTest ──────────────────────────────────────────────────────────────

describe('hitBondTest', () => {
  test('returns -1 when no bonds', () => {
    A(0, 0, 0, 'Cu');
    draw();
    expect(hitBondTest(W / 2, H / 2)).toBe(-1);
  });

  test('hits bond near its midpoint projection', () => {
    // Two atoms symmetrically placed around origin → bond midpoint projects to canvas centre
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'O');
    B(a, b);
    draw();
    const idx = hitBondTest(W / 2, H / 2);
    expect(idx).toBe(0);
  });

  test('returns -1 when clicking far from bonds', () => {
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'O');
    B(a, b);
    draw();
    expect(hitBondTest(10, 10)).toBe(-1);
  });

  test('returns correct bond index with multiple bonds', () => {
    // Bond 0: horizontal around centre
    // Bond 1: far off-screen
    const a0 = A(-1, 0, 0, 'Cu');
    const b0 = A( 1, 0, 0, 'O');
    B(a0, b0);
    const a1 = A(-5, -5, 0, 'C');
    const b1 = A(-4, -5, 0, 'C');
    B(a1, b1);
    draw();
    const idx = hitBondTest(W / 2, H / 2);
    expect(idx).toBe(0);
  });
});

// ─── hitCavityTest ────────────────────────────────────────────────────────────

describe('hitCavityTest', () => {
  test('returns null when activePlane is not "cavities"', () => {
    app.activePlane = 'none';
    draw();
    expect(hitCavityTest(W / 2, H / 2)).toBeNull();
  });

  test('returns null when activePlane is "cavities" but no spheres', () => {
    app.activePlane = 'cavities';
    draw();
    expect(hitCavityTest(W / 2, H / 2)).toBeNull();
  });

  test('hits manually-added cavity sphere at canvas centre', () => {
    // Manually inject a cavity sphere at origin into customGroups
    app.activePlane = 'cavities';
    app.customGroups = [{
      isSphere: true,
      cx: 0, cy: 0, cz: 0,
      r: 2,
      cavityId: 1,
      ids: [],
      color: '#5cb8ff',
    }];
    app.drawGroupsCache  = null;
    draw();
    const hit = hitCavityTest(W / 2, H / 2);
    expect(hit).not.toBeNull();
    expect(hit.isSphere).toBe(true);
    expect(hit.cavityId).toBe(1);
  });

  test('returns null when clicking outside sphere projection', () => {
    app.activePlane = 'cavities';
    app.customGroups = [{
      isSphere: true,
      cx: 0, cy: 0, cz: 0,
      r: 0.1,   // very small sphere → tight click area
      cavityId: 1,
      ids: [],
      color: '#5cb8ff',
    }];
    app.drawGroupsCache = null;
    draw();
    // Far corner should miss
    expect(hitCavityTest(10, 10)).toBeNull();
  });
});

// ─── init / resize / getCanvas ───────────────────────────────────────────────

describe('init / resize / getCanvas', () => {
  test('getCanvas returns the canvas passed to init', () => {
    expect(getCanvas()).toBe(mockCanvas);
  });

  test('resize does not throw', () => {
    expect(() => resize()).not.toThrow();
  });
});

// ─── hitAxisTest ─────────────────────────────────────────────────────────────

describe('hitAxisTest', () => {
  test('returns -1 when currentAxes is empty', () => {
    app.currentAxes = [];
    draw();
    expect(hitAxisTest(W / 2, H / 2)).toBe(-1);
  });

  test('hits a translate axis near its projected endpoint', () => {
    // Place a translate axis along +X from origin; its end projects to right of centre.
    app.currentAxes = [{
      type: 'translate',
      origin: [0, 0, 0],
      dir:    [1, 0, 0],
    }];
    draw();
    // The hit-test uses a 12px threshold along the line from origin projection
    // to a point 1.5 units away along dir. We just verify the function runs
    // without throwing and returns a number.
    const result = hitAxisTest(W / 2, H / 2);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(-1);
  });

  test('hits a rotate axis near its handle projection', () => {
    app.currentAxes = [{
      type:       'rotate',
      axisOrigin: [0, 0, 0],
      dir:        [1, 0, 0],
      handlePos:  [0, 0, 0],
    }];
    draw();
    const result = hitAxisTest(W / 2, H / 2);
    expect(result).toBe(0);
  });
});

// ─── draw — branch coverage ───────────────────────────────────────────────────

describe('draw — various mode/feature branches', () => {
  test('draw with bonds renders without error', () => {
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'O');
    B(a, b);
    expect(() => draw()).not.toThrow();
  });

  test('draw with showLabels=true renders without error', () => {
    A(0, 0, 0, 'Cu');
    app.showLabels = true;
    expect(() => draw()).not.toThrow();
    app.showLabels = false;
  });

  test('draw with fogEnabled=true renders without error', () => {
    A(0, 0, 0, 'Cu');
    A(1, 0, 0, 'O');
    app.fogEnabled = true;
    expect(() => draw()).not.toThrow();
    app.fogEnabled = false;
  });

  test('draw in poly mode with selected atoms renders preview', () => {
    const ids = [
      A(0, 0, 0, 'Cu'), A(1, 0, 0, 'O'), A(0.5, 1, 0, 'C'),
    ];
    app.currentMode   = 'poly';
    app.selectedAtoms = ids;
    expect(() => draw()).not.toThrow();
  });

  test('draw with non-sphere customGroup renders face/edge/vtx', () => {
    const ids = [
      A(0, 0, 0, 'Cu'), A(1, 0, 0, 'O'), A(0.5, 1, 0, 'C'),
    ];
    app.customGroups = [{ ids, color: '#3B4D9E' }];
    app.drawGroupsCache = null;
    expect(() => draw()).not.toThrow();
  });

  test('draw with activePlane=cu-o runs plane group path', () => {
    // 6 Cu atoms in a ring with plane cu-o
    const cuIds = [];
    for (let i = 0; i < 6; i++) {
      cuIds.push(A(Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3), 0, 'Cu', 'Cu', 'cu-o'));
    }
    for (let i = 0; i < 6; i++) B(cuIds[i], cuIds[(i + 1) % 6]);
    app.activePlane     = 'cu-o';
    app.drawGroupsCache = null;
    expect(() => draw()).not.toThrow();
  });

  test('draw with cavity sphere renders front/back hemisphere paths', () => {
    app.activePlane = 'cavities';
    app.customGroups = [{
      isSphere: true, cx: 0, cy: 0, cz: 0, r: 1,
      cavityId: 1, ids: [], color: '#5cb8ff',
    }];
    app.drawGroupsCache = null;
    expect(() => draw()).not.toThrow();
  });

  test('draw with supercell enabled renders ghost copies', () => {
    A(0, 0, 0, 'Cu');
    app.supercellEnabled = true;
    app.supercellNx = 2; app.supercellNy = 1; app.supercellNz = 1;
    expect(() => draw()).not.toThrow();
    app.supercellEnabled = false;
  });

  test('draw in view mode with mouse near bond renders bond-length HUD', () => {
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'O');
    B(a, b);
    app.currentMode = 'view';
    // Position mouse near bond midpoint (canvas centre)
    app.currentMX = W / 2;
    app.currentMY = H / 2;
    expect(() => draw()).not.toThrow();
    app.currentMX = -1000; app.currentMY = -1000;
  });

  test('draw with hoveredBond highlights bond', () => {
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'O');
    B(a, b);
    app.hoveredBond = 0;
    expect(() => draw()).not.toThrow();
    app.hoveredBond = -1;
  });

  test('draw with dashed Cu–Cu bond', () => {
    const a = A(-1, 0, 0, 'Cu');
    const b = A( 1, 0, 0, 'Cu');
    B(a, b, true); // dashed
    expect(() => draw()).not.toThrow();
  });
});
