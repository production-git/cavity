/**
 * math3d.test.js — Unit tests for app/math3d.js
 *
 * Coverage target: 100% function coverage (T.2)
 * All functions are pure (zero imports, zero side-effects).
 */

import {
  v3sub, v3add, v3scale, v3cross, v3dot, v3len, v3norm, v3dist,
  rotatePoint,
  project,
  areCoplanar,
  triangulatePlanar,
  orderFace3D,
  convexHull3DFaces,
  decomposeFaces,
  collectEdges,
  describeGeom,
  getLatticeVectors,
} from '../../math3d.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function v3approx(a, b, eps = 1e-9) {
  return approx(a[0], b[0], eps) && approx(a[1], b[1], eps) && approx(a[2], b[2], eps);
}

// Simple atom lookup fixture: id → {x,y,z}
function makeGetAtom(atoms) {
  const map = new Map(atoms.map(a => [a.id, a]));
  return id => map.get(id);
}

// ─── Vector primitives ───────────────────────────────────────────────────────

describe('v3sub', () => {
  test('subtracts two vectors', () => {
    expect(v3sub([3, 2, 1], [1, 1, 1])).toEqual([2, 1, 0]);
  });
  test('handles negatives', () => {
    const r = v3sub([0, 0, 0], [1, 2, 3]);
    expect(r).toEqual([-1, -2, -3]);
  });
});

describe('v3add', () => {
  test('adds two vectors', () => {
    expect(v3add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });
});

describe('v3scale', () => {
  test('scales by positive scalar', () => {
    expect(v3scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
  test('scales by zero', () => {
    expect(v3scale([5, 5, 5], 0)).toEqual([0, 0, 0]);
  });
  test('scales by negative scalar', () => {
    expect(v3scale([1, 1, 1], -1)).toEqual([-1, -1, -1]);
  });
});

describe('v3cross', () => {
  test('x × y = z', () => {
    expect(v3cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });
  test('y × x = −z', () => {
    expect(v3cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
  });
  test('parallel vectors give zero', () => {
    const r = v3cross([2, 0, 0], [3, 0, 0]);
    expect(r).toEqual([0, 0, 0]);
  });
});

describe('v3dot', () => {
  test('orthogonal vectors → 0', () => {
    expect(v3dot([1, 0, 0], [0, 1, 0])).toBe(0);
  });
  test('parallel unit vectors → 1', () => {
    expect(v3dot([1, 0, 0], [1, 0, 0])).toBe(1);
  });
  test('general case', () => {
    expect(v3dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('v3len', () => {
  test('unit vector has length 1', () => {
    expect(v3len([1, 0, 0])).toBe(1);
  });
  test('(3,4,0) has length 5', () => {
    expect(v3len([3, 4, 0])).toBe(5);
  });
  test('zero vector has length 0', () => {
    expect(v3len([0, 0, 0])).toBe(0);
  });
});

describe('v3norm', () => {
  test('normalises a vector to unit length', () => {
    const n = v3norm([3, 4, 0]);
    expect(approx(v3len(n), 1)).toBe(true);
  });
  test('zero vector does not produce NaN (returns [0,0,0])', () => {
    const n = v3norm([0, 0, 0]);
    expect(n.every(x => !isNaN(x))).toBe(true);
    expect(approx(v3len(n), 1, 1e-6)).toBe(false); // zero in, zero out (len=0)
    // Specifically: 0/1 = 0 for each component
    expect(n).toEqual([0, 0, 0]);
  });
});

describe('v3dist', () => {
  test('distance between identical points is 0', () => {
    expect(v3dist([1, 2, 3], [1, 2, 3])).toBe(0);
  });
  test('unit step along x gives distance 1', () => {
    expect(v3dist([0, 0, 0], [1, 0, 0])).toBe(1);
  });
  test('(3,4,0) gives distance 5', () => {
    expect(v3dist([3, 4, 0], [0, 0, 0])).toBe(5);
  });
});

// ─── rotatePoint ─────────────────────────────────────────────────────────────

describe('rotatePoint', () => {
  test('180° rotation about z-axis flips (1,0,0) to (-1,0,0)', () => {
    const r = rotatePoint([1, 0, 0], [0, 0, 0], [0, 0, 1], Math.PI);
    expect(approx(r[0], -1)).toBe(true);
    expect(approx(r[1], 0, 1e-9)).toBe(true);
  });

  test('0° rotation returns the same point', () => {
    const p = [2, 3, 4];
    const r = rotatePoint(p, [0, 0, 0], [0, 1, 0], 0);
    expect(v3approx(r, p)).toBe(true);
  });

  test('rotation about non-origin pivot preserves distance from pivot', () => {
    const pivot = [1, 1, 0];
    const p = [3, 1, 0];
    const distBefore = v3dist(p, pivot);
    const r = rotatePoint(p, pivot, [0, 0, 1], Math.PI / 3);
    const distAfter = v3dist(r, pivot);
    expect(approx(distBefore, distAfter, 1e-9)).toBe(true);
  });
});

// ─── project ─────────────────────────────────────────────────────────────────

describe('project', () => {
  test('origin projects to canvas centre', () => {
    const p = project(0, 0, 0, 0, 0, 72, 800, 600);
    expect(p.sx).toBe(400);
    expect(p.sy).toBe(300);
  });

  test('returns finite values for all fields', () => {
    const p = project(1, 2, 3, 0.5, 0.3, 72, 800, 600);
    expect(isFinite(p.sx)).toBe(true);
    expect(isFinite(p.sy)).toBe(true);
    expect(isFinite(p.sz)).toBe(true);
    expect(isFinite(p.ps)).toBe(true);
  });

  test('positive z moves point forward (larger ps)', () => {
    const near = project(0, 0, -3, 0, 0, 72, 800, 600); // towards viewer
    const far  = project(0, 0,  3, 0, 0, 72, 800, 600);
    expect(near.ps).toBeGreaterThan(far.ps);
  });
});

// ─── areCoplanar ─────────────────────────────────────────────────────────────

describe('areCoplanar', () => {
  test('≤3 atoms are always coplanar', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
    ]);
    expect(areCoplanar([0, 1, 2], getAtom)).toBe(true);
  });

  test('4 atoms in xy-plane are coplanar', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 1, y: 1, z: 0 },
      { id: 3, x: 0, y: 1, z: 0 },
    ]);
    expect(areCoplanar([0, 1, 2, 3], getAtom)).toBe(true);
  });

  test('4 atoms forming a tetrahedron are NOT coplanar', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
      { id: 3, x: 0, y: 0, z: 1 },
    ]);
    expect(areCoplanar([0, 1, 2, 3], getAtom)).toBe(false);
  });
});

// ─── orderFace3D ─────────────────────────────────────────────────────────────

describe('orderFace3D', () => {
  test('returns the same ids for ≤2 atoms', () => {
    const getAtom = makeGetAtom([{ id: 0, x: 0, y: 0, z: 0 }, { id: 1, x: 1, y: 0, z: 0 }]);
    expect(orderFace3D([0, 1], getAtom)).toEqual([0, 1]);
  });

  test('returns all ids for a square in xy-plane', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  0, z: 0 },
      { id: 1, x:  0, y:  1, z: 0 },
      { id: 2, x: -1, y:  0, z: 0 },
      { id: 3, x:  0, y: -1, z: 0 },
    ]);
    const ordered = orderFace3D([0, 1, 2, 3], getAtom);
    expect(new Set(ordered)).toEqual(new Set([0, 1, 2, 3]));
    expect(ordered.length).toBe(4);
  });
});

// ─── triangulatePlanar ────────────────────────────────────────────────────────

describe('triangulatePlanar', () => {
  test('3-atom face returns single triangle unchanged', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
    ]);
    const faces = triangulatePlanar([0, 1, 2], getAtom);
    expect(faces.length).toBe(1);
    expect(faces[0].length).toBe(3);
  });

  test('4-atom planar square returns at least one face', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  0, z: 0 },
      { id: 1, x:  0, y:  1, z: 0 },
      { id: 2, x: -1, y:  0, z: 0 },
      { id: 3, x:  0, y: -1, z: 0 },
    ]);
    const faces = triangulatePlanar([0, 1, 2, 3], getAtom);
    expect(faces.length).toBeGreaterThanOrEqual(1);
    // All atom ids should be covered
    const covered = new Set(faces.flat());
    expect(covered).toEqual(new Set([0, 1, 2, 3]));
  });
});

// ─── convexHull3DFaces ────────────────────────────────────────────────────────

describe('convexHull3DFaces', () => {
  test('<4 atoms returns single face', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
    ]);
    const faces = convexHull3DFaces([0, 1, 2], getAtom);
    expect(faces.length).toBe(1);
  });

  test('tetrahedron (4 atoms) returns 4 faces', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  1, z:  1 },
      { id: 1, x: -1, y: -1, z:  1 },
      { id: 2, x: -1, y:  1, z: -1 },
      { id: 3, x:  1, y: -1, z: -1 },
    ]);
    const faces = convexHull3DFaces([0, 1, 2, 3], getAtom);
    expect(faces.length).toBe(4);
  });
});

// ─── decomposeFaces ───────────────────────────────────────────────────────────

describe('decomposeFaces', () => {
  test('<3 atoms returns empty array', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
    ]);
    expect(decomposeFaces([0, 1], getAtom)).toEqual([]);
  });

  test('3-atom triangle returns one face', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
    ]);
    const faces = decomposeFaces([0, 1, 2], getAtom);
    expect(faces.length).toBe(1);
  });

  test('planar quad uses triangulatePlanar path', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  0, z: 0 },
      { id: 1, x:  0, y:  1, z: 0 },
      { id: 2, x: -1, y:  0, z: 0 },
      { id: 3, x:  0, y: -1, z: 0 },
    ]);
    const faces = decomposeFaces([0, 1, 2, 3], getAtom);
    expect(faces.length).toBeGreaterThanOrEqual(1);
  });

  test('tetrahedron uses convexHull3DFaces path', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  1, z:  1 },
      { id: 1, x: -1, y: -1, z:  1 },
      { id: 2, x: -1, y:  1, z: -1 },
      { id: 3, x:  1, y: -1, z: -1 },
    ]);
    const faces = decomposeFaces([0, 1, 2, 3], getAtom);
    expect(faces.length).toBe(4);
  });
});

// ─── collectEdges ─────────────────────────────────────────────────────────────

describe('collectEdges', () => {
  test('triangle has 3 edges', () => {
    const edges = collectEdges([[0, 1, 2]]);
    expect(edges.length).toBe(3);
  });

  test('shared edges between faces are deduplicated', () => {
    // Two triangles sharing edge 1-2
    const edges = collectEdges([[0, 1, 2], [1, 3, 2]]);
    // Triangle1: 0-1, 1-2, 2-0  → Triangle2: 1-3, 3-2, 2-1(dupe)
    // Unique edges: 0-1, 1-2, 2-0, 1-3, 3-2 = 5
    expect(edges.length).toBe(5);
  });

  test('empty faces array returns empty edges', () => {
    expect(collectEdges([])).toEqual([]);
  });
});

// ─── describeGeom ─────────────────────────────────────────────────────────────

describe('describeGeom', () => {
  test('<3 atoms returns empty string', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
    ]);
    expect(describeGeom([0, 1], getAtom)).toBe('');
  });

  test('3 coplanar atoms → Triangle', () => {
    const getAtom = makeGetAtom([
      { id: 0, x: 0, y: 0, z: 0 },
      { id: 1, x: 1, y: 0, z: 0 },
      { id: 2, x: 0, y: 1, z: 0 },
    ]);
    expect(describeGeom([0, 1, 2], getAtom)).toBe('Triangle');
  });

  test('4 coplanar atoms → Quadrilateral', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  0, z: 0 },
      { id: 1, x:  0, y:  1, z: 0 },
      { id: 2, x: -1, y:  0, z: 0 },
      { id: 3, x:  0, y: -1, z: 0 },
    ]);
    expect(describeGeom([0, 1, 2, 3], getAtom)).toBe('Quadrilateral');
  });

  test('tetrahedron → Tetrahedron', () => {
    const getAtom = makeGetAtom([
      { id: 0, x:  1, y:  1, z:  1 },
      { id: 1, x: -1, y: -1, z:  1 },
      { id: 2, x: -1, y:  1, z: -1 },
      { id: 3, x:  1, y: -1, z: -1 },
    ]);
    expect(describeGeom([0, 1, 2, 3], getAtom)).toBe('Tetrahedron');
  });

  test('6-gon polygon', () => {
    // 6 atoms in a circle in the xy-plane
    const atoms = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: Math.cos(i * Math.PI / 3),
      y: Math.sin(i * Math.PI / 3),
      z: 0,
    }));
    const getAtom = makeGetAtom(atoms);
    expect(describeGeom(atoms.map(a => a.id), getAtom)).toBe('6-gon');
  });
});

// ─── getLatticeVectors ────────────────────────────────────────────────────────

describe('getLatticeVectors', () => {
  test('returns defaults for empty atom list', () => {
    const lv = getLatticeVectors([]);
    expect(lv).toEqual({ ax: 10, ay: 10, az: 6 });
  });

  test('bounding-box + 1.5 padding', () => {
    const atoms = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 2 },
    ];
    const lv = getLatticeVectors(atoms);
    expect(lv.ax).toBeCloseTo(3 + 1.5);
    expect(lv.ay).toBeCloseTo(4 + 1.5);
    expect(lv.az).toBeCloseTo(2 + 1.5);
  });

  test('single atom gives 1.5 padding in all dimensions', () => {
    const lv = getLatticeVectors([{ x: 5, y: 5, z: 5 }]);
    expect(lv).toEqual({ ax: 1.5, ay: 1.5, az: 1.5 });
  });
});
