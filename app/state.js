/**
 * state.js — Single source of truth for all mutable application state.
 *
 * Design: a single exported `app` object whose properties are freely
 * readable and writable by all modules. Functions exported here handle
 * mutations that require internal bookkeeping (atomById, structureVersion,
 * drawGroupsCache invalidation, history, etc.).
 *
 * Imports only math3d.js (pure functions, no DOM).
 */

import * as math from './math3d.js';

/* ══════════════════════════════════════════════════════════
   ELEMENT CATALOG
   ══════════════════════════════════════════════════════════ */
const _dark = matchMedia('(prefers-color-scheme:dark)').matches;

export const ELEMENTS = [
    { sym: 'Cu', name: 'Copper',   col: '#3B4D9E', rad: 10,  roles: { Cu: ['Copper (Cu²⁺)', 'Square pyramidal coordination'] } },
    { sym: 'O',  name: 'Oxygen',   col: '#A8B4D4', rad: 6.5, roles: { O_bridge: ['Oxygen (bridging)', 'Carboxylate O, syn-syn μ₂ bridge'], O_term: ['Oxygen (terminal)', 'Carboxylate O → adjacent SBU'] } },
    { sym: 'C',  name: 'Carbon',   col: _dark ? '#8a8a8a' : '#555555', rad: 5.2, roles: { C_carb: ['Carbon (carboxylate)', 'sp² C(=O)₂'], C_arom: ['Carbon (aromatic)', 'BTC ring, sp²'] } },
    { sym: 'H',  name: 'Hydrogen', col: _dark ? '#cccccc' : '#999999', rad: 3.5, roles: { H: ['Hydrogen', 'H atom'] } },
];

export const PCOLORS    = ['#D85A30','#1D9E75','#D4537E','#BA7517','#534AB7','#E24B4A','#378ADD'];
export const PRESET_COL = { 'cu-o':'#3B4D9E', 'carb':'#BA7517', 'ring':'#1D9E75', 'cavities':'#5cb8ff' };
export const AXIS_COLORS = ['#E24B4A','#1D9E75','#3B6EE6','#BA7517','#7B5EC6','#D4537E'];

// Color lookup (kept in sync with ELEMENTS.col via buildColorRow / loadStructureFromJSON)
export const COL = {};
ELEMENTS.forEach(e => COL[e.sym] = e.col);

export function getElem(sym) { return ELEMENTS.find(e => e.sym === sym); }
export function getCOL(sym)  { const e = getElem(sym); return e ? e.col : (app.dark ? '#aaa' : '#777'); }
export function getRAD(sym)  { const e = getElem(sym); return e ? e.rad : 5; }
export function getNAME(role) { for (const e of ELEMENTS) { if (e.roles[role]) return e.roles[role]; } return null; }

/* ══════════════════════════════════════════════════════════
   APPLICATION STATE OBJECT
   All mutable state lives here. Other modules read/write
   properties freely; complex mutations go through the
   helper functions below.
   ══════════════════════════════════════════════════════════ */
export const app = {
    /* ── Theme ── */
    dark: _dark,

    /* ── Atoms & bonds ── */
    atoms: [],
    bonds: [],
    aid: 0,
    atomById: new Map(),
    structureVersion: 0,
    drawGroupsCache: null,
    _drawGroupsCacheVersion: -1,
    _drawGroupsCachePlane: null,
    _drawGroupsCacheCustomLen: -1,

    /* ── Groups & polyhedra ── */
    customGroups: [],
    pcIdx: 0,

    /* ── Camera ── */
    angleY: 35 * Math.PI / 180,
    angleX: 20 * Math.PI / 180,
    zoomVal: 72,
    atomScale: 1,
    autoRotate: true,
    showBonds: true,
    showLabels: false,
    faceAlpha: 0.18,
    fogEnabled: false,
    snapEnabled: true,
    activePlane: 'none',

    /* ── Supercell ── */
    supercellEnabled: false,
    supercellNx: 2,
    supercellNy: 2,
    supercellNz: 1,

    /* ── Edit mode ── */
    currentMode: 'view',
    addSubMode: 'add',
    autoRelax: false,

    /* ── Interaction state ── */
    hoveredAtom: null,
    hoveredBond: -1,
    selectedAtoms: [],
    bondSelection: [],
    editSelected: [],
    editDragging: false,
    editAxis: null,
    editDragStart: null,
    dragStartAtomPositions: {},
    dragMockAxis: null,
    dragAtomId: null,
    addElement: 'Cu',
    addSourceAtom: null,
    activeSnapGuides: [],
    currentAxes: [],
    hoveredAxisIdx: -1,
    currentMX: -1000,
    currentMY: -1000,

    /* ── Mouse drag state ── */
    dragging: false,
    lastMX: 0,
    lastMY: 0,
    clickOk: false,
    cx0: 0,
    cy0: 0,

    /* ── Import/export ── */
    pbcEnabled: false,
    unitCell: { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 },

    /* ── History ── */
    history: [],
    historyIdx: -1,
};

/* ══════════════════════════════════════════════════════════
   ATOM MAP & STRUCTURE HELPERS
   ══════════════════════════════════════════════════════════ */
export function getAtom(id) { return app.atomById.get(id); }

export function rebuildAtomMap() {
    app.atomById.clear();
    app.atoms.forEach(a => app.atomById.set(a.id, a));
    app.structureVersion++;
    app.drawGroupsCache = null;
}

/** Add atom — returns new atom id */
export function A(x, y, z, t, role, plane) {
    const atom = { x, y, z, t, role: role || t, plane: plane || '', id: app.aid++ };
    app.atoms.push(atom);
    app.atomById.set(atom.id, atom);
    app.structureVersion++;
    app.drawGroupsCache = null;
    return atom.id;
}

/** Add bond */
export function B(a, b, d) {
    app.bonds.push({ a, b, dashed: !!d });
    app.structureVersion++;
    app.drawGroupsCache = null;
}

/* ══════════════════════════════════════════════════════════
   UNDO / REDO
   ══════════════════════════════════════════════════════════ */
export function saveState() {
    if (app.historyIdx < app.history.length - 1) app.history = app.history.slice(0, app.historyIdx + 1);
    app.history.push({
        atoms: JSON.parse(JSON.stringify(app.atoms)),
        bonds: JSON.parse(JSON.stringify(app.bonds)),
        customGroups: JSON.parse(JSON.stringify(app.customGroups)),
        aid: app.aid
    });
    if (app.history.length > 50) app.history.shift();
    app.historyIdx = app.history.length - 1;
}

export function restoreState(snap) {
    app.atoms = JSON.parse(JSON.stringify(snap.atoms));
    app.bonds = JSON.parse(JSON.stringify(snap.bonds));
    app.customGroups = JSON.parse(JSON.stringify(snap.customGroups));
    app.aid = snap.aid;
    rebuildAtomMap();
    app.editSelected = []; app.selectedAtoms = []; app.bondSelection = [];
    app.addSourceAtom = null; app.currentAxes = [];
    app.hoveredAtom = null; app.hoveredBond = -1;
    app.editDragging = false;
}

export function undo() {
    if (app.historyIdx > 0) { app.historyIdx--; restoreState(app.history[app.historyIdx]); }
}

export function redo() {
    if (app.historyIdx < app.history.length - 1) { app.historyIdx++; restoreState(app.history[app.historyIdx]); }
}

/* ══════════════════════════════════════════════════════════
   STRUCTURE OPERATIONS
   ══════════════════════════════════════════════════════════ */
export function getNeighbors(id) {
    const n = [];
    app.bonds.forEach(b => { if (b.a===id) n.push(b.b); if (b.b===id) n.push(b.a); });
    return n;
}

export function getRotatingGroup(pivotId, startId) {
    const visited = new Set([pivotId, startId]), group = [], queue = [startId];
    while (queue.length > 0) {
        const curr = queue.shift(); group.push(curr);
        getNeighbors(curr).forEach(n => { if (!visited.has(n)) { visited.add(n); queue.push(n); } });
    }
    return group;
}

export function deleteAtom(id, skipSave) {
    app.atoms = app.atoms.filter(a => a.id !== id);
    app.bonds = app.bonds.filter(b => b.a !== id && b.b !== id);
    app.customGroups = app.customGroups
        .map(cg => cg.isSphere ? cg : { ...cg, ids: cg.ids.filter(i => i !== id) })
        .filter(cg => cg.isSphere || cg.ids.length >= 3);
    rebuildAtomMap();
    if (app.editSelected.includes(id)) app.editSelected = app.editSelected.filter(i => i !== id);
    if (app.selectedAtoms.includes(id)) app.selectedAtoms = app.selectedAtoms.filter(i => i !== id);
    if (app.bondSelection.includes(id)) app.bondSelection = app.bondSelection.filter(i => i !== id);
    if (app.addSourceAtom === id) { app.addSourceAtom = null; app.currentAxes = []; }
}

export function toggleBond(aId, bId) {
    const existingIdx = app.bonds.findIndex(b => (b.a===aId&&b.b===bId)||(b.a===bId&&b.b===aId));
    if (existingIdx >= 0) app.bonds.splice(existingIdx, 1);
    else app.bonds.push({ a:aId, b:bId, dashed:false });
    app.structureVersion++; app.drawGroupsCache = null;
}

/* ══════════════════════════════════════════════════════════
   PLANE / GEOMETRY GROUPS
   ══════════════════════════════════════════════════════════ */
const ELEM_PLANE_FALLBACK = { Cu:'cu-o', O:'cu-o', C:'carb' };

export function planeOf(atom) {
    if (atom.plane) return atom.plane;
    if (atom.t === 'C') {
        const nbrs = getNeighbors(atom.id);
        const hasO = nbrs.some(nid => { const n = app.atomById.get(nid); return n && n.t === 'O'; });
        return hasO ? 'carb' : 'ring';
    }
    return ELEM_PLANE_FALLBACK[atom.t] || '';
}

export function getPlaneGroups(plane) {
    const adj = new Map();
    app.atoms.forEach(a => adj.set(a.id, []));
    app.bonds.forEach(b => { adj.get(b.a)?.push(b.b); adj.get(b.b)?.push(b.a); });
    const planeIds = new Set();
    app.atoms.forEach(a => { if (planeOf(a) === plane) planeIds.add(a.id); });
    const visited = new Set(), clusters = [];
    planeIds.forEach(id => {
        if (visited.has(id)) return;
        const cluster = [], queue = [id]; visited.add(id);
        while (queue.length) {
            const cur = queue.shift(); cluster.push(cur);
            adj.get(cur)?.forEach(nb => { if (planeIds.has(nb) && !visited.has(nb)) { visited.add(nb); queue.push(nb); } });
        }
        if (cluster.length >= 3) clusters.push(cluster);
    });
    return clusters;
}

export function getCavitySpheres() {
    let sumBondLen = 0;
    if (app.bonds.length > 0) {
        app.bonds.forEach(b => {
            const a1 = app.atomById.get(b.a), a2 = app.atomById.get(b.b);
            if (a1 && a2) sumBondLen += Math.sqrt((a1.x-a2.x)**2+(a1.y-a2.y)**2+(a1.z-a2.z)**2);
        });
    }
    const avgBondLen = app.bonds.length > 0 ? sumBondLen/app.bonds.length : 1.5;
    const clusterDist = avgBondLen * 2.0;
    const rings = getPlaneGroups('ring');

    // getPlaneGroups returns atoms in BFS order, not polygon order.
    // The Newell method requires cyclic polygon order — wrong order gives a
    // completely wrong normal direction.  Fix: walk the ring via bond adjacency.
    const sortToPolygonOrder = (ids) => {
        const ringSet = new Set(ids);
        const ringAdj = new Map();
        ids.forEach(id => ringAdj.set(id, []));
        app.bonds.forEach(b => {
            if (ringSet.has(b.a) && ringSet.has(b.b)) {
                ringAdj.get(b.a).push(b.b);
                ringAdj.get(b.b).push(b.a);
            }
        });
        const start = ids[0];
        const ordered = [start];
        let prev = -1, cur = start;
        while (ordered.length < ids.length) {
            const nbrs = (ringAdj.get(cur) || []).filter(n => n !== prev);
            if (!nbrs.length) break;
            const next = nbrs[0];
            if (next === start) break;
            ordered.push(next);
            prev = cur; cur = next;
        }
        return ordered.length === ids.length ? ordered : ids;
    };

    const ringData = rings.map(ids => {
        const orderedIds = sortToPolygonOrder(ids);
        let cx=0, cy=0, cz=0;
        orderedIds.forEach(id => { const a = app.atomById.get(id); cx+=a.x; cy+=a.y; cz+=a.z; });
        cx/=orderedIds.length; cy/=orderedIds.length; cz/=orderedIds.length;
        let nx=0, ny=0, nz=0;
        for (let i=0; i<orderedIds.length; i++) {
            const curr = app.atomById.get(orderedIds[i]), next = app.atomById.get(orderedIds[(i+1)%orderedIds.length]);
            nx += (curr.y-next.y)*(curr.z+next.z);
            ny += (curr.z-next.z)*(curr.x+next.x);
            nz += (curr.x-next.x)*(curr.y+next.y);
        }
        const len = Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
        return { cx, cy, cz, nx:nx/len, ny:ny/len, nz:nz/len, ids };
    });

    const rays = [];
    ringData.forEach((r,i) => {
        rays.push({ ringIdx:i, ox:r.cx, oy:r.cy, oz:r.cz, dx:r.nx, dy:r.ny, dz:r.nz });
        rays.push({ ringIdx:i, ox:r.cx, oy:r.cy, oz:r.cz, dx:-r.nx, dy:-r.ny, dz:-r.nz });
    });
    const converges = [];
    for (let i=0; i<rays.length; i++) for (let j=i+1; j<rays.length; j++) {
        const r1=rays[i], r2=rays[j]; if (r1.ringIdx===r2.ringIdx) continue;
        const p12x=r2.ox-r1.ox, p12y=r2.oy-r1.oy, p12z=r2.oz-r1.oz;
        const d1d2=r1.dx*r2.dx+r1.dy*r2.dy+r1.dz*r2.dz;
        const denom=1.0-d1d2*d1d2; if (denom<1e-6) continue;
        const pd1=p12x*r1.dx+p12y*r1.dy+p12z*r1.dz;
        const pd2=p12x*r2.dx+p12y*r2.dy+p12z*r2.dz;
        const t1=(pd1-pd2*d1d2)/denom, t2=(pd1*d1d2-pd2)/denom;
        if (t1>0 && t2>0) {
            const c1x=r1.ox+r1.dx*t1, c1y=r1.oy+r1.dy*t1, c1z=r1.oz+r1.dz*t1;
            const c2x=r2.ox+r2.dx*t2, c2y=r2.oy+r2.dy*t2, c2z=r2.oz+r2.dz*t2;
            const dist=Math.sqrt((c1x-c2x)**2+(c1y-c2y)**2+(c1z-c2z)**2);
            if (dist<clusterDist) converges.push({x:(c1x+c2x)/2,y:(c1y+c2y)/2,z:(c1z+c2z)/2,r1:r1.ringIdx,r2:r2.ringIdx});
        }
    }
    const clusters = [];
    converges.forEach(pt => {
        let added=false;
        for (const c of clusters) {
            if (Math.sqrt((c.x/c.count-pt.x)**2+(c.y/c.count-pt.y)**2+(c.z/c.count-pt.z)**2)<clusterDist) {
                c.x+=pt.x; c.y+=pt.y; c.z+=pt.z; c.count++;
                c.rings.add(pt.r1); c.rings.add(pt.r2); added=true; break;
            }
        }
        if (!added) clusters.push({x:pt.x,y:pt.y,z:pt.z,count:1,rings:new Set([pt.r1,pt.r2])});
    });
    const validCenters = clusters.filter(c=>c.rings.size>=4).map(c=>({x:c.x/c.count,y:c.y/c.count,z:c.z/c.count,rings:c.rings}));
    const finalCenters = [];
    validCenters.forEach(vc => {
        let merged=false;
        for (const fc of finalCenters) {
            if (Math.sqrt((fc.x-vc.x)**2+(fc.y-vc.y)**2+(fc.z-vc.z)**2)<clusterDist*1.5) {
                fc.x=(fc.x*fc.count+vc.x)/(fc.count+1); fc.y=(fc.y*fc.count+vc.y)/(fc.count+1); fc.z=(fc.z*fc.count+vc.z)/(fc.count+1);
                fc.count++; vc.rings.forEach(r=>fc.rings.add(r)); merged=true; break;
            }
        }
        if (!merged) finalCenters.push({x:vc.x,y:vc.y,z:vc.z,count:1,rings:new Set(vc.rings)});
    });
    const enclosedCenters = finalCenters.filter(center => {
        let sumX=0, sumY=0, sumZ=0;
        center.rings.forEach(rIdx => {
            const r=ringData[rIdx], dx=r.cx-center.x, dy=r.cy-center.y, dz=r.cz-center.z;
            const len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
            sumX+=dx/len; sumY+=dy/len; sumZ+=dz/len;
        });
        const N=center.rings.size;
        return Math.sqrt(sumX*sumX+sumY*sumY+sumZ*sumZ)/N < 0.45;
    });

    // For each enclosed center, refine using ONLY the enclosing ring atoms.
    // Using all atoms causes the sphere to be blocked by interior metal/bridge atoms
    // (e.g. Cu at 1.31 Å, O at 1.11 Å from origin) that are NOT cavity walls.
    // The cavity is geometrically defined by its enclosing rings, so only those
    // atoms should constrain the center position and radius.
    //
    // Gradient ascent: move away from the nearest enclosing-ring atom, accept
    // only if min-distance strictly improves.  Starting inside the cavity from
    // the ray-convergence estimate the center converges to the Chebyshev center
    // of the enclosing ring atoms (largest inscribed sphere w.r.t. ring walls).
    const refineCenterRingOnly = (cx, cy, cz, enclosingAtoms) => {
        let x=cx, y=cy, z=cz, step=avgBondLen*0.4;
        for (let iter=0; iter<200; iter++) {
            let minD=Infinity, ca=null;
            enclosingAtoms.forEach(a => { const d=Math.sqrt((a.x-x)**2+(a.y-y)**2+(a.z-z)**2); if (d<minD) { minD=d; ca=a; } });
            if (!ca) break;
            const vx=x-ca.x, vy=y-ca.y, vz=z-ca.z, vl=Math.sqrt(vx*vx+vy*vy+vz*vz)||1;
            const tx=x+vx/vl*step, ty=y+vy/vl*step, tz=z+vz/vl*step;
            let newMinD=Infinity;
            enclosingAtoms.forEach(a => { const d=Math.sqrt((a.x-tx)**2+(a.y-ty)**2+(a.z-tz)**2); if (d<newMinD) newMinD=d; });
            if (newMinD>=minD) { x=tx; y=ty; z=tz; } else { step*=0.6; }
            if (step<0.002) break;
        }
        return {x, y, z};
    };

    return enclosedCenters.map((center, index) => {
        // Gather atoms that belong to the enclosing rings
        const enclosingAtoms = [];
        center.rings.forEach(rIdx => {
            ringData[rIdx].ids.forEach(id => {
                const a = app.atomById.get(id);
                if (a) enclosingAtoms.push(a);
            });
        });

        const refined = refineCenterRingOnly(center.x, center.y, center.z, enclosingAtoms);

        // Radius = distance to nearest enclosing ring atom
        let minDist=Infinity;
        enclosingAtoms.forEach(a => {
            const d=Math.sqrt((a.x-refined.x)**2+(a.y-refined.y)**2+(a.z-refined.z)**2);
            if (d<minDist) minDist=d;
        });
        return { cx:refined.x, cy:refined.y, cz:refined.z, r:minDist, isSphere:true, ids:[], color:PRESET_COL['cavities'], cavityId:(index+1) };
    });
}

export function getAllDrawGroups() {
    const customKey = app.customGroups.length;
    if (app.drawGroupsCache !== null &&
        app._drawGroupsCacheVersion === app.structureVersion &&
        app._drawGroupsCachePlane === app.activePlane &&
        app._drawGroupsCacheCustomLen === customKey) {
        return app.drawGroupsCache;
    }
    const g = [];
    if (app.activePlane === 'cavities') {
        getCavitySpheres().forEach(s => g.push(s));
    } else if (app.activePlane !== 'none') {
        const color = PRESET_COL[app.activePlane] || '#888888';
        getPlaneGroups(app.activePlane).forEach(ids => {
            const f = math.decomposeFaces(ids, getAtom);
            g.push({ faces:f, edges:math.collectEdges(f), ids, color });
        });
    }
    app.customGroups.forEach(cg => {
        if (cg.isSphere) { g.push(cg); return; }
        const f = math.decomposeFaces(cg.ids, getAtom);
        g.push({ faces:f, edges:math.collectEdges(f), ids:cg.ids, color:cg.color });
    });
    app.drawGroupsCache = g;
    app._drawGroupsCacheVersion = app.structureVersion;
    app._drawGroupsCachePlane = app.activePlane;
    app._drawGroupsCacheCustomLen = customKey;
    return g;
}

/* ══════════════════════════════════════════════════════════
   EDIT AXIS COMPUTATION
   ══════════════════════════════════════════════════════════ */
export function computeEditAxes(selectedIds) {
    if (selectedIds.length === 0) return [];
    const id = selectedIds[0];
    const a = app.atomById.get(id); if (!a) return [];
    const origin = [a.x, a.y, a.z], axes = [], baseAxes = [];
    const nbrs = getNeighbors(id);
    nbrs.forEach(nid => {
        const n = app.atomById.get(nid);
        const dir = math.v3norm(math.v3sub([n.x,n.y,n.z], origin));
        if (!baseAxes.some(ax => Math.abs(math.v3dot(ax.dir,dir)) > 0.95))
            baseAxes.push({ dir, label:'→ '+n.t+'#'+nid, neighborId:nid });
    });
    if (nbrs.length >= 2) {
        const n1 = app.atomById.get(nbrs[0]), n2 = app.atomById.get(nbrs[1]);
        const d1 = math.v3sub([n1.x,n1.y,n1.z],origin), d2 = math.v3sub([n2.x,n2.y,n2.z],origin);
        const perp = math.v3norm(math.v3cross(d1, d2));
        if (math.v3len(perp) > 1e-6) baseAxes.push({ dir:perp, label:'⊥ normal', neighborId:-1 });
    }
    const cart = [{dir:[1,0,0],label:'+X'},{dir:[-1,0,0],label:'-X'},{dir:[0,1,0],label:'+Y'},{dir:[0,-1,0],label:'-Y'},{dir:[0,0,1],label:'+Z'},{dir:[0,0,-1],label:'-Z'}];
    cart.forEach(c => { if (!baseAxes.some(ax => Math.abs(math.v3dot(ax.dir,c.dir)) > 0.95)) baseAxes.push({ dir:c.dir, label:c.label, neighborId:-1 }); });
    let rotatingGroup = [];
    if (selectedIds.length === 2) {
        const Bt = app.atomById.get(selectedIds[1]);
        if (Bt) rotatingGroup = getRotatingGroup(id, Bt.id);
    }
    baseAxes.forEach(bAx => {
        axes.push({ type:'translate', origin, dir:bAx.dir, label:bAx.label });
        if (selectedIds.length === 2 && rotatingGroup.length > 0) {
            let perpRot = math.v3cross(bAx.dir, [0,1,0]);
            if (math.v3len(perpRot) < 0.1) perpRot = math.v3cross(bAx.dir, [1,0,0]);
            perpRot = math.v3norm(perpRot);
            const handlePos = math.v3add(origin, math.v3add(math.v3scale(bAx.dir,0.7), math.v3scale(perpRot,0.8)));
            axes.push({ type:'rotate', origin, axisOrigin:origin, dir:bAx.dir, handlePos, label:'Rot around '+bAx.label, rotatingGroup });
        }
    });
    return axes;
}

export function computeAddAxes(id) {
    const a = app.atomById.get(id); if (!a) return [];
    const pos = [a.x,a.y,a.z], nbrs = getNeighbors(id), axes = [];
    nbrs.forEach(nid => {
        const n = app.atomById.get(nid), dir = math.v3norm(math.v3sub(pos,[n.x,n.y,n.z]));
        axes.push({ type:'translate', dir, origin:pos, label:'extend from '+n.t, isNew:true });
    });
    if (nbrs.length >= 2) {
        const n1 = app.atomById.get(nbrs[0]), n2 = app.atomById.get(nbrs[1]);
        const d1 = math.v3sub([n1.x,n1.y,n1.z],pos), d2 = math.v3sub([n2.x,n2.y,n2.z],pos);
        const perp = math.v3norm(math.v3cross(d1, d2));
        if (math.v3len(perp) > 1e-6) {
            axes.push({ type:'translate', origin:pos, dir:perp, label:'⊥ normal +', isNew:true });
            axes.push({ type:'translate', origin:pos, dir:math.v3scale(perp,-1), label:'⊥ normal -', isNew:true });
        }
    }
    axes.push(
        {type:'translate',origin:pos,dir:[1,0,0],label:'+X'},
        {type:'translate',origin:pos,dir:[-1,0,0],label:'-X'},
        {type:'translate',origin:pos,dir:[0,1,0],label:'+Y'},
        {type:'translate',origin:pos,dir:[0,-1,0],label:'-Y'},
        {type:'translate',origin:pos,dir:[0,0,1],label:'+Z'},
        {type:'translate',origin:pos,dir:[0,0,-1],label:'-Z'}
    );
    const filtered = [];
    axes.forEach(ax => {
        let overlap = false;
        if (!ax.isNew) filtered.forEach(fax => { if (Math.abs(math.v3dot(fax.dir,ax.dir)) > 0.9) overlap=true; });
        nbrs.forEach(nid => {
            const n = app.atomById.get(nid), toNbr = math.v3norm(math.v3sub([n.x,n.y,n.z],pos));
            if (math.v3dot(toNbr,ax.dir) > 0.9) overlap = true;
        });
        if (!overlap) filtered.push(ax);
    });
    return filtered;
}

export function trySnap(movingId, pos, axDir) {
    if (!app.snapEnabled) return { pos, snapped:false };
    const THRESH = 0.05;

    // All atoms within 5Å, capped at 12 nearest for performance
    const refAtoms = app.atoms
        .filter(a => a.id !== movingId && math.v3dist([a.x,a.y,a.z], pos) < 5.0)
        .sort((a,b) => math.v3dist([a.x,a.y,a.z], pos) - math.v3dist([b.x,b.y,b.z], pos))
        .slice(0, 12);

    let best = { dist: THRESH, snap: null };

    // Propose axis-aligned snap: match one coordinate, project along axDir
    function tryAxis(target, i, label, guideEnd) {
        if (!axDir || Math.abs(axDir[i]) < 0.01) return;
        const diff = target - pos[i];
        if (Math.abs(diff) >= best.dist) return;
        const t = diff / axDir[i];
        const snapped = [pos[0]+axDir[0]*t, pos[1]+axDir[1]*t, pos[2]+axDir[2]*t];
        const p2 = [...pos]; p2[i] = target;
        best = { dist: Math.abs(diff), snap: { pos: snapped, label, guide: [snapped, guideEnd || p2] } };
    }

    // Propose 3D plane snap: normal N through point P, project pos onto plane along axDir
    function tryPlane(N, P, label, guideEnd) {
        const Nn = math.v3norm(N);
        const denom = math.v3dot(axDir, Nn);
        if (Math.abs(denom) < 0.05) return; // drag nearly parallel to plane — skip
        const dist = Math.abs(math.v3dot(math.v3sub(pos, P), Nn));
        if (dist >= best.dist) return;
        const t = -math.v3dot(math.v3sub(pos, P), Nn) / denom;
        const snapped = math.v3add(pos, math.v3scale(axDir, t));
        best = { dist, snap: { pos: snapped, label, guide: [snapped, guideEnd || P] } };
    }

    // 1. Axis-aligned: origin planes, coplanar with each nearby atom, midpoints of all pairs
    ['x','y','z'].forEach((ax, i) => {
        tryAxis(0, i, ax + '=0 plane');
        refAtoms.forEach(n => tryAxis(n[ax], i, 'coplanar ' + n.t + '#' + n.id, [n.x,n.y,n.z]));
        for (let j = 0; j < refAtoms.length; j++) {
            for (let k = j+1; k < refAtoms.length; k++) {
                const A = refAtoms[j], B = refAtoms[k];
                tryAxis((A[ax]+B[ax])/2, i, 'midpoint ' + A.t+'#'+A.id + '–' + B.t+'#'+B.id);
            }
        }
    });

    // 2. Best-fit plane of all nearby atoms ("plane of nearby atoms")
    if (refAtoms.length >= 2) {
        const pts = refAtoms.map(a => [a.x, a.y, a.z]);
        const cen = pts.reduce((s,p) => math.v3add(s,p), [0,0,0]).map(v => v/pts.length);
        let N = [0,0,0];
        for (let j = 0; j < pts.length-1; j++)
            N = math.v3add(N, math.v3cross(math.v3sub(pts[j], cen), math.v3sub(pts[j+1], cen)));
        if (math.v3len(N) > 0.01) tryPlane(N, cen, 'plane of nearby atoms', cen);
    }

    // 3. Equidistant from each pair (perpendicular bisector plane)
    for (let j = 0; j < refAtoms.length; j++) {
        for (let k = j+1; k < refAtoms.length; k++) {
            const A = refAtoms[j], B = refAtoms[k];
            const mid = math.v3scale(math.v3add([A.x,A.y,A.z],[B.x,B.y,B.z]), 0.5);
            const N = math.v3sub([B.x,B.y,B.z],[A.x,A.y,A.z]);
            if (math.v3len(N) < 0.1) continue;
            tryPlane(N, mid, 'equidistant ' + A.t+'#'+A.id + ' & ' + B.t+'#'+B.id, mid);
        }
    }

    if (best.snap) return { ...best.snap, snapped: true };
    return { pos, snapped: false };
}

/* ══════════════════════════════════════════════════════════
   IMPORT / EXPORT
   ══════════════════════════════════════════════════════════ */
export function parseXYZ(data) {
    const lines = data.trim().split('\n').map(l=>l.trim()).filter(l=>l);
    if (lines.length < 3) throw new Error('Invalid XYZ');
    const count = parseInt(lines[0]);
    app.atoms=[]; app.bonds=[]; app.aid=0; app.customGroups=[];
    for (let i=2; i<2+count && i<lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 4) A(parseFloat(parts[1]),parseFloat(parts[2]),parseFloat(parts[3]),parts[0]);
    }
    for (let i=0; i<app.atoms.length; i++) for (let j=i+1; j<app.atoms.length; j++) {
        const d = math.v3dist([app.atoms[i].x,app.atoms[i].y,app.atoms[i].z],[app.atoms[j].x,app.atoms[j].y,app.atoms[j].z]);
        if (d > 0.4 && d < 2.0) B(app.atoms[i].id, app.atoms[j].id);
    }
    app.zoomVal = 40;
}

export function parseMOL(data) {
    const lines = data.trim().split('\n');
    if (lines.length < 4) throw new Error('Invalid MOL');
    const counts = lines[3].trim().match(/\s*\d+/g);
    if (!counts || counts.length < 2) throw new Error('Invalid MOL counts');
    const numAtoms=parseInt(counts[0]), numBonds=parseInt(counts[1]);
    app.atoms=[]; app.bonds=[]; app.aid=0; app.customGroups=[];
    for (let i=4; i<4+numAtoms; i++) { const p=lines[i].trim().split(/\s+/); A(parseFloat(p[0]),parseFloat(p[1]),parseFloat(p[2]),p[3]); }
    for (let i=4+numAtoms; i<4+numAtoms+numBonds; i++) { const p=lines[i].match(/\s*\d+/g); B(app.atoms[parseInt(p[0])-1].id,app.atoms[parseInt(p[1])-1].id); }
    app.zoomVal = 40;
}

export function parseCIF(data) {
    const lines = data.trim().split('\n');
    app.atoms=[]; app.bonds=[]; app.aid=0; app.customGroups=[];
    const cell = { a:1,b:1,c:1,alpha:90,beta:90,gamma:90 };
    for (const l of lines) {
        const lt = l.trim();
        if (lt.startsWith('_cell_length_a')) cell.a=parseFloat(lt.split(/\s+/)[1]);
        else if (lt.startsWith('_cell_length_b')) cell.b=parseFloat(lt.split(/\s+/)[1]);
        else if (lt.startsWith('_cell_length_c')) cell.c=parseFloat(lt.split(/\s+/)[1]);
        else if (lt.startsWith('_cell_angle_alpha')) cell.alpha=parseFloat(lt.split(/\s+/)[1]);
        else if (lt.startsWith('_cell_angle_beta'))  cell.beta =parseFloat(lt.split(/\s+/)[1]);
        else if (lt.startsWith('_cell_angle_gamma')) cell.gamma=parseFloat(lt.split(/\s+/)[1]);
    }
    Object.assign(app.unitCell, cell);
    const symops = []; let inSym = false;
    for (const l of lines) {
        const lt = l.trim();
        if (lt.startsWith('_symmetry_equiv_pos_as_xyz')||lt.startsWith('_space_group_symop_operation_xyz')) { inSym=true; continue; }
        if (inSym) {
            if (lt.startsWith('_')||lt.startsWith('loop_')||lt.startsWith('data_')) { inSym=false; continue; }
            if (!lt||lt.startsWith('#')) continue;
            let op;
            if (lt.includes("'")) op=lt.split("'")[1];
            else if (lt.includes('"')) op=lt.split('"')[1];
            else { const p=lt.split(/\s+/); op=p.length>1?p.slice(1).join(''):p[0]; }
            symops.push(op.replace(/\s/g,'').toLowerCase());
        }
    }
    if (!symops.length) symops.push('x,y,z');
    const fractAtoms = [];
    const loopBlocks = data.split('loop_').slice(1);
    for (const block of loopBlocks) {
        const blines=block.trim().split('\n'), headers=[], dataRows=[];
        for (const line of blines) {
            const lt=line.trim();
            if (!lt||lt.startsWith('#')) continue;
            if (lt.startsWith('_')) headers.push(lt.split(/\s+/)[0]); else dataRows.push(lt.split(/\s+/));
        }
        if (!headers.includes('_atom_site_fract_x')) continue;
        const xIdx=headers.indexOf('_atom_site_fract_x'), yIdx=headers.indexOf('_atom_site_fract_y'), zIdx=headers.indexOf('_atom_site_fract_z');
        let tIdx=headers.indexOf('_atom_site_type_symbol'); if (tIdx<0) tIdx=headers.indexOf('_atom_site_label');
        for (const row of dataRows) {
            if (row.length<=Math.max(xIdx,yIdx,zIdx,tIdx)) continue;
            fractAtoms.push({ t:row[tIdx].replace(/[0-9]/g,''), fx:parseFloat(row[xIdx].split('(')[0]), fy:parseFloat(row[yIdx].split('(')[0]), fz:parseFloat(row[zIdx].split('(')[0]) });
        }
    }
    const applyOp = (op,fx,fy,fz) => {
        const s=op.replace(/x/g,`(${fx})`).replace(/y/g,`(${fy})`).replace(/z/g,`(${fz})`);
        const parts=s.split(',');
        const ev=expr=>Function('"use strict";return('+expr+')')(); // eslint-disable-line no-new-func
        let nx=((ev(parts[0])%1)+1)%1, ny=((ev(parts[1])%1)+1)%1, nz=((ev(parts[2])%1)+1)%1;
        if (nx>=0.999) nx=0; if (ny>=0.999) ny=0; if (nz>=0.999) nz=0;
        return [nx,ny,nz];
    };
    const expanded=[], seen=new Set();
    for (const a of fractAtoms) for (const op of symops) {
        try { const [nx,ny,nz]=applyOp(op,a.fx,a.fy,a.fz); const key=`${a.t}_${nx.toFixed(3)}_${ny.toFixed(3)}_${nz.toFixed(3)}`; if (!seen.has(key)) { seen.add(key); expanded.push({t:a.t,fx:nx,fy:ny,fz:nz}); } } catch(_) {}
    }
    const aR=cell.alpha*Math.PI/180, bR=cell.beta*Math.PI/180, gR=cell.gamma*Math.PI/180;
    const cosA=Math.cos(aR), cosB=Math.cos(bR), cosG=Math.cos(gR), sinG=Math.sin(gR);
    const vol=Math.sqrt(Math.max(0,1-cosA*cosA-cosB*cosB-cosG*cosG+2*cosA*cosB*cosG));
    const M=[[cell.a,cell.b*cosG,cell.c*cosB],[0,cell.b*sinG,cell.c*(cosA-cosB*cosG)/sinG],[0,0,cell.c*vol/sinG]];
    const cartAtoms=expanded.map(a=>({t:a.t,x:M[0][0]*a.fx+M[0][1]*a.fy+M[0][2]*a.fz,y:M[1][0]*a.fx+M[1][1]*a.fy+M[1][2]*a.fz,z:M[2][0]*a.fx+M[2][1]*a.fy+M[2][2]*a.fz}));
    if (cartAtoms.length) {
        const cx=cartAtoms.reduce((s,a)=>s+a.x,0)/cartAtoms.length;
        const cy=cartAtoms.reduce((s,a)=>s+a.y,0)/cartAtoms.length;
        const cz=cartAtoms.reduce((s,a)=>s+a.z,0)/cartAtoms.length;
        for (const a of cartAtoms) { a.x-=cx; a.y-=cy; a.z-=cz; }
    }
    const radii={H:0.31,C:0.76,O:0.73,N:0.71,Cu:1.32,Zn:1.22};
    const rawBonds=[];
    for (let i=0;i<cartAtoms.length;i++) for (let j=i+1;j<cartAtoms.length;j++) {
        const dx=cartAtoms[i].x-cartAtoms[j].x, dy=cartAtoms[i].y-cartAtoms[j].y, dz=cartAtoms[i].z-cartAtoms[j].z;
        const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
        const ri=radii[cartAtoms[i].t]??0.7, rj=radii[cartAtoms[j].t]??0.7;
        if (dist<ri+rj+0.4&&dist>0.4) rawBonds.push({i,j,dashed:cartAtoms[i].t==='Cu'&&cartAtoms[j].t==='Cu'});
    }
    const maxR=cartAtoms.reduce((m,a)=>Math.max(m,Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z)),0);
    if (maxR>10) { const sf=10/maxR; for (const a of cartAtoms) { a.x*=sf; a.y*=sf; a.z*=sf; } }
    for (const a of cartAtoms) A(a.x,a.y,a.z,a.t);
    for (const rb of rawBonds) B(app.atoms[rb.i].id,app.atoms[rb.j].id,rb.dashed);
    app.pbcEnabled=true; app.zoomVal=40;
}

export function serializeStructure(name) {
    return JSON.stringify({
        version:9, name:name||'Unnamed',
        atoms:app.atoms.map(a=>({x:a.x,y:a.y,z:a.z,t:a.t,role:a.role,plane:a.plane,id:a.id})),
        bonds:app.bonds.map(b=>({a:b.a,b:b.b,dashed:b.dashed})),
        customGroups:app.customGroups.map(cg=>({ids:cg.ids,color:cg.color})),
        elements:ELEMENTS.map(e=>({sym:e.sym,name:e.name,col:e.col,rad:e.rad})),
        viewState:{angleY:app.angleY,angleX:app.angleX,zoomVal:app.zoomVal,atomScale:app.atomScale,faceAlpha:app.faceAlpha,showBonds:app.showBonds,showLabels:app.showLabels,activePlane:app.activePlane,pbcEnabled:app.pbcEnabled,unitCell:app.unitCell},
        timestamp:new Date().toISOString()
    }, null, 2);
}

export function loadStructureFromJSON(input) {
    const d = (typeof input === 'string') ? JSON.parse(input) : input;
    if (!d.atoms || !d.bonds) throw new Error('Invalid file');
    app.atoms=[]; app.bonds=[]; app.aid=0;
    d.atoms.forEach(a => {
        const id = (a.id !== undefined) ? a.id : app.aid;
        app.atoms.push({x:a.x,y:a.y,z:a.z,t:a.t,role:a.role||a.t,plane:a.plane||'',id});
        if (id >= app.aid) app.aid = id + 1;
    });
    d.bonds.forEach(b => { app.bonds.push({a:b.a,b:b.b,dashed:!!b.dashed}); });
    rebuildAtomMap();
    if (d.customGroups) app.customGroups=d.customGroups.map(cg=>({ids:cg.ids,color:cg.color,idx:Date.now()}));
    if (d.elements) {
        d.elements.forEach(e => {
            if (!ELEMENTS.find(x=>x.sym===e.sym)) {
                ELEMENTS.push({sym:e.sym,name:e.name,col:e.col,rad:e.rad,roles:{[e.sym]:[e.name,'Custom element']}});
                COL[e.sym]=e.col;
            } else {
                const ex=ELEMENTS.find(x=>x.sym===e.sym); ex.col=e.col; COL[e.sym]=e.col;
            }
        });
    }
    if (d.viewState) {
        app.angleY=d.viewState.angleY??app.angleY;
        app.angleX=d.viewState.angleX??app.angleX;
        app.zoomVal=d.viewState.zoomVal||72;
        app.atomScale=d.viewState.atomScale||1;
        app.faceAlpha=d.viewState.faceAlpha??app.faceAlpha;
        app.showBonds=d.viewState.showBonds??true;
        app.showLabels=d.viewState.showLabels??false;
        app.activePlane=d.viewState.activePlane||'none';
        app.pbcEnabled=d.viewState.pbcEnabled||false;
        app.unitCell=d.viewState.unitCell||app.unitCell;
    }
    app.history=[]; app.historyIdx=-1;
}

export async function saveToStorage(name, json) {
    try {
        if (window.storage) await window.storage.set('struct:'+name, json);
        else localStorage.setItem('struct:'+name, json);
    } catch(e) {}
}

export async function listSaved() {
    try {
        if (window.storage) { const r=await window.storage.list('struct:'); return r?r.keys.map(k=>k.replace('struct:','')):[] }
        return Object.keys(localStorage).filter(k=>k.startsWith('struct:')).map(k=>k.replace('struct:',''));
    } catch(e) { return []; }
}

export async function loadFromStorage(name) {
    try {
        if (window.storage) { const r=await window.storage.get('struct:'+name); return r?r.value:null; }
        return localStorage.getItem('struct:'+name);
    } catch(e) { return null; }
}

export async function deleteFromStorage(name) {
    try {
        if (window.storage) await window.storage.delete('struct:'+name);
        else localStorage.removeItem('struct:'+name);
    } catch(e) {}
}
