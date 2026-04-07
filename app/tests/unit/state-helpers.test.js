/**
 * state-helpers.test.js — Additional state.js coverage.
 *
 * Covers: getRotatingGroup, planeOf, getPlaneGroups, getAllDrawGroups,
 *         computeEditAxes, computeAddAxes, parseXYZ, parseMOL
 */

import {
  app,
  A, B,
  getAtom,
  rebuildAtomMap,
  getRotatingGroup,
  planeOf,
  getPlaneGroups,
  getAllDrawGroups,
  computeEditAxes,
  computeAddAxes,
  parseXYZ,
  parseMOL,
  PRESET_COL,
} from '../../state.js';

beforeEach(() => {
  app.atoms = [];
  app.bonds = [];
  app.aid   = 0;
  app.customGroups = [];
  app.history    = [];
  app.historyIdx = -1;
  app.atomById.clear();
  app.structureVersion = 0;
  app.drawGroupsCache  = null;
  app._drawGroupsCacheVersion = -1;
  app._drawGroupsCachePlane = null;
  app._drawGroupsCacheCustomLen = -1;
  app.activePlane = 'none';
});

// ─── getRotatingGroup ─────────────────────────────────────────────────────────

describe('getRotatingGroup', () => {
  test('returns atoms reachable from startId excluding pivotId', () => {
    //  pivot — a — b — c
    const pivot = A(0, 0, 0, 'Cu');
    const a     = A(1, 0, 0, 'O');
    const b     = A(2, 0, 0, 'C');
    const c     = A(3, 0, 0, 'C');
    B(pivot, a); B(a, b); B(b, c);

    const group = getRotatingGroup(pivot, a);
    expect(group).toContain(a);
    expect(group).toContain(b);
    expect(group).toContain(c);
    expect(group).not.toContain(pivot);
  });

  test('returns just startId when it has no further neighbours', () => {
    const pivot = A(0, 0, 0, 'Cu');
    const a     = A(1, 0, 0, 'O');
    B(pivot, a);
    const group = getRotatingGroup(pivot, a);
    expect(group).toEqual([a]);
  });
});

// ─── planeOf ─────────────────────────────────────────────────────────────────

describe('planeOf', () => {
  test('returns atom.plane when explicitly set', () => {
    const id = A(0, 0, 0, 'Cu', 'Cu', 'cu-o');
    expect(planeOf(getAtom(id))).toBe('cu-o');
  });

  test('Carbon bonded to Oxygen → carb', () => {
    const c = A(0, 0, 0, 'C', 'C_carb', '');
    const o = A(1, 0, 0, 'O', 'O_bridge', '');
    B(c, o);
    expect(planeOf(getAtom(c))).toBe('carb');
  });

  test('Carbon NOT bonded to Oxygen → ring', () => {
    const c1 = A(0, 0, 0, 'C', 'C_arom', '');
    const c2 = A(1, 0, 0, 'C', 'C_arom', '');
    B(c1, c2);
    expect(planeOf(getAtom(c1))).toBe('ring');
  });

  test('Cu with no explicit plane → cu-o via fallback', () => {
    const cu = A(0, 0, 0, 'Cu', 'Cu', '');
    expect(planeOf(getAtom(cu))).toBe('cu-o');
  });

  test('unknown element with no plane → empty string', () => {
    const xx = A(0, 0, 0, 'Xx', 'Xx', '');
    expect(planeOf(getAtom(xx))).toBe('');
  });
});

// ─── getPlaneGroups ───────────────────────────────────────────────────────────

describe('getPlaneGroups', () => {
  test('returns empty array when no matching atoms', () => {
    A(0, 0, 0, 'Cu', 'Cu', 'cu-o');
    expect(getPlaneGroups('ring')).toEqual([]);
  });

  test('returns one cluster for 6 connected ring atoms', () => {
    const ids = [];
    for (let i = 0; i < 6; i++) {
      ids.push(A(Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3), 0, 'C', 'C_arom', 'ring'));
    }
    for (let i = 0; i < 6; i++) B(ids[i], ids[(i + 1) % 6]);
    const groups = getPlaneGroups('ring');
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(6);
  });

  test('ignores clusters smaller than 3', () => {
    const a = A(0, 0, 0, 'C', 'C_arom', 'ring');
    const b = A(1, 0, 0, 'C', 'C_arom', 'ring');
    B(a, b);
    // 2 atoms → cluster size 2 → filtered out
    expect(getPlaneGroups('ring')).toEqual([]);
  });
});

// ─── getAllDrawGroups ─────────────────────────────────────────────────────────

describe('getAllDrawGroups', () => {
  test('returns empty array with activePlane="none" and no customGroups', () => {
    app.activePlane = 'none';
    expect(getAllDrawGroups()).toEqual([]);
  });

  test('uses cache on second call with same version', () => {
    app.activePlane = 'none';
    const g1 = getAllDrawGroups();
    const g2 = getAllDrawGroups();
    expect(g1).toBe(g2); // same reference
  });

  test('non-"none" plane path adds face groups for matching atoms', () => {
    // Build a 6-atom ring with plane='cu-o'
    const ids = [];
    for (let i = 0; i < 6; i++) {
      ids.push(A(Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3), 0, 'Cu', 'Cu', 'cu-o'));
    }
    for (let i = 0; i < 6; i++) B(ids[i], ids[(i + 1) % 6]);
    app.activePlane = 'cu-o';
    app.drawGroupsCache = null;
    const groups = getAllDrawGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('faces');
    expect(groups[0]).toHaveProperty('edges');
  });

  test('customGroup sphere is passed through as-is', () => {
    const sphere = { isSphere: true, cx: 0, cy: 0, cz: 0, r: 1, ids: [], color: '#fff' };
    app.customGroups = [sphere];
    app.drawGroupsCache = null;
    const groups = getAllDrawGroups();
    expect(groups).toContain(sphere);
  });

  test('non-sphere customGroup gets faces/edges computed', () => {
    const ids = [
      A(0, 0, 0, 'Cu'), A(1, 0, 0, 'O'), A(0.5, 1, 0, 'C'),
    ];
    app.customGroups = [{ ids, color: '#aabbcc' }];
    app.drawGroupsCache = null;
    const groups = getAllDrawGroups();
    expect(groups.length).toBe(1);
    expect(groups[0]).toHaveProperty('faces');
    expect(groups[0]).toHaveProperty('edges');
  });
});

// ─── computeEditAxes ─────────────────────────────────────────────────────────

describe('computeEditAxes', () => {
  test('returns empty array for empty selection', () => {
    expect(computeEditAxes([])).toEqual([]);
  });

  test('returns empty array for non-existent id', () => {
    expect(computeEditAxes([9999])).toEqual([]);
  });

  test('isolated atom gets cartesian axes', () => {
    const id = A(0, 0, 0, 'Cu');
    const axes = computeEditAxes([id]);
    expect(axes.length).toBeGreaterThan(0);
    expect(axes.every(a => a.type === 'translate')).toBe(true);
  });

  test('atom with 2 neighbours gets bond-direction + normal axes', () => {
    const cu = A(0, 0, 0, 'Cu');
    const o1 = A(1, 0, 0, 'O');
    const o2 = A(0, 1, 0, 'O');
    B(cu, o1); B(cu, o2);
    const axes = computeEditAxes([cu]);
    const dirs = axes.map(a => a.label);
    expect(dirs.some(d => d.startsWith('→'))).toBe(true);
    expect(dirs).toContain('⊥ normal');
  });

  test('two-atom selection adds rotate axes', () => {
    const a = A(0, 0, 0, 'Cu');
    const b = A(1, 0, 0, 'O');
    B(a, b);
    const axes = computeEditAxes([a, b]);
    expect(axes.some(ax => ax.type === 'rotate')).toBe(true);
  });
});

// ─── computeAddAxes ──────────────────────────────────────────────────────────

describe('computeAddAxes', () => {
  test('returns empty array for non-existent id', () => {
    expect(computeAddAxes(9999)).toEqual([]);
  });

  test('isolated atom returns cartesian axes', () => {
    const id = A(0, 0, 0, 'Cu');
    const axes = computeAddAxes(id);
    expect(axes.length).toBeGreaterThan(0);
  });

  test('atom with 2 neighbours gets bond-extension + perpendicular axes', () => {
    const cu = A(0, 0, 0, 'Cu');
    const o1 = A(1, 0, 0, 'O');
    const o2 = A(0, 1, 0, 'O');
    B(cu, o1); B(cu, o2);
    const axes = computeAddAxes(cu);
    expect(axes.some(a => a.label.startsWith('extend'))).toBe(true);
  });
});

// ─── parseXYZ ─────────────────────────────────────────────────────────────────

const MINIMAL_XYZ = `3
comment line
Cu 0.0 0.0 0.0
O  1.0 0.0 0.0
C  0.0 1.0 0.0
`.trim();

describe('parseXYZ', () => {
  test('throws on too-short input', () => {
    expect(() => parseXYZ('2\n')).toThrow('Invalid XYZ');
  });

  test('parses atom types from XYZ', () => {
    parseXYZ(MINIMAL_XYZ);
    const types = app.atoms.map(a => a.t);
    expect(types).toContain('Cu');
    expect(types).toContain('O');
    expect(types).toContain('C');
  });

  test('adds bonds for atoms within 2.0 Å', () => {
    parseXYZ(MINIMAL_XYZ);
    // Cu–O at 1.0 Å → bond; Cu–C at 1.0 Å → bond; O–C at ~1.41 Å → bond
    expect(app.bonds.length).toBeGreaterThan(0);
  });

  test('sets zoomVal to 40', () => {
    parseXYZ(MINIMAL_XYZ);
    expect(app.zoomVal).toBe(40);
  });
});

// ─── parseMOL ─────────────────────────────────────────────────────────────────

const MINIMAL_MOL = `
  molecule
  comment

  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 Cu  0  0  0  0  0  0  0  0  0  0  0  0
    1.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
`.trim();

describe('parseMOL', () => {
  test('throws on too-short input', () => {
    expect(() => parseMOL('line1\nline2\nline3')).toThrow('Invalid MOL');
  });

  test('parses atoms from MOL file', () => {
    parseMOL(MINIMAL_MOL);
    expect(app.atoms.length).toBe(2);
    const types = app.atoms.map(a => a.t);
    expect(types).toContain('Cu');
    expect(types).toContain('O');
  });

  test('parses bonds from MOL file', () => {
    parseMOL(MINIMAL_MOL);
    expect(app.bonds.length).toBe(1);
  });

  test('sets zoomVal to 40', () => {
    parseMOL(MINIMAL_MOL);
    expect(app.zoomVal).toBe(40);
  });
});
