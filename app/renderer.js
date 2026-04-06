/**
 * renderer.js — Canvas 2D renderer (Phase 2a).
 *
 * Reads from state.app and math3d. Owns the <canvas> element.
 * Replaced wholesale by the Three.js renderer in Phase 2b — all
 * other modules (state, ui, index) are unchanged across that swap.
 */

import { app, AXIS_COLORS, getAtom, getCOL, getRAD, getAllDrawGroups, getNeighbors } from './state.js';
import * as math from './math3d.js';

const dpr = window.devicePixelRatio || 1;
let canvas, ctx;

/* ── Public init ── */
export function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
}

export function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function getCanvas() { return canvas; }

/* ── Canvas helpers ── */
function varColor(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function hexRgb(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x+r,y); cx.lineTo(x+w-r,y);
    cx.quadraticCurveTo(x+w,y,x+w,y+r); cx.lineTo(x+w,y+h-r);
    cx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); cx.lineTo(x+r,y+h);
    cx.quadraticCurveTo(x,y+h,x,y+h-r); cx.lineTo(x,y+r);
    cx.quadraticCurveTo(x,y,x+r,y); cx.closePath(); cx.fill();
}

/* ── Spatial indexing (rebuilt each frame during draw) ── */
let globalProjMap = {}, spatialGrid = new Map();
const GRID_SZ = 40;
function getGridKey(x, y) { return Math.floor(x/GRID_SZ)+','+Math.floor(y/GRID_SZ); }

/* ── Projection wrapper (reads state, calls pure math.project) ── */
function proj(x, y, z) {
    return math.project(x, y, z, app.angleY, app.angleX, app.zoomVal, canvas.clientWidth, canvas.clientHeight);
}



/* ══════════════════════════════════════════════════════════
   HIT TESTS  (use the spatial grid built during draw())
   ══════════════════════════════════════════════════════════ */
export function hitTest(mx, my) {
    let hit = null, bestZ = -Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const key = Math.floor(mx/GRID_SZ+dx)+','+Math.floor(my/GRID_SZ+dy);
        const cell = spatialGrid.get(key); if (!cell) continue;
        for (const a of cell.atoms) {
            const r = getRAD(a.t) * app.atomScale * a.ps * (app.zoomVal/65);
            if ((mx-a.sx)**2+(my-a.sy)**2 <= r*r) { if (a.sz > bestZ) { bestZ=a.sz; hit=a; } }
        }
    }
    return hit;
}

export function hitBondTest(mx, my) {
    let bestDist = 7, hitIdx = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const key = Math.floor(mx/GRID_SZ+dx)+','+Math.floor(my/GRID_SZ+dy);
        const cell = spatialGrid.get(key); if (!cell) continue;
        for (const {b, i} of cell.bonds) {
            const p1 = globalProjMap[b.a], p2 = globalProjMap[b.b];
            if (!p1 || !p2) continue;
            const l2 = (p1.sx-p2.sx)**2+(p1.sy-p2.sy)**2; if (l2===0) continue;
            let t = ((mx-p1.sx)*(p2.sx-p1.sx)+(my-p1.sy)*(p2.sy-p1.sy))/l2;
            t = Math.max(0, Math.min(1, t));
            const dist = Math.sqrt((mx-p1.sx-t*(p2.sx-p1.sx))**2+(my-p1.sy-t*(p2.sy-p1.sy))**2);
            if (dist < bestDist) { bestDist=dist; hitIdx=i; }
        }
    }
    return hitIdx;
}

export function hitAxisTest(mx, my) {
    if (app.currentAxes.length === 0) return -1;
    for (let i = 0; i < app.currentAxes.length; i++) {
        const ax = app.currentAxes[i];
        if (ax.type === 'rotate') {
            const pHandle = proj(...ax.handlePos);
            if (Math.sqrt((mx-pHandle.sx)**2+(my-pHandle.sy)**2) < 15) return i;
        } else {
            const pOrig = proj(...ax.origin);
            const pEnd  = proj(ax.origin[0]+ax.dir[0]*1.5, ax.origin[1]+ax.dir[1]*1.5, ax.origin[2]+ax.dir[2]*1.5);
            const dx=pEnd.sx-pOrig.sx, dy=pEnd.sy-pOrig.sy, l2=dx*dx+dy*dy; if (l2<1) continue;
            let t = ((mx-pOrig.sx)*dx+(my-pOrig.sy)*dy)/l2; t=Math.max(0,Math.min(1,t));
            if (Math.sqrt((mx-pOrig.sx-t*dx)**2+(my-pOrig.sy-t*dy)**2) < 12) return i;
        }
    }
    return -1;
}

export function hitCavityTest(mx, my) {
    let hit = null, bestZ = -Infinity;
    if (app.activePlane === 'cavities') {
        getAllDrawGroups().forEach(gr => {
            if (!gr.isSphere) return;
            const pCenter = proj(gr.cx,gr.cy,gr.cz);
            const pr = gr.r * app.zoomVal * 1.15 * pCenter.ps;
            if ((mx-pCenter.sx)**2+(my-pCenter.sy)**2 <= pr*pr) {
                if (pCenter.sz > bestZ) { bestZ=pCenter.sz; hit=gr; }
            }
        });
    }
    return hit;
}

/* ══════════════════════════════════════════════════════════
   MAIN DRAW
   ══════════════════════════════════════════════════════════ */
export function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    spatialGrid.clear();
    globalProjMap = {};
    const projMap = globalProjMap;
    const { atoms, bonds, dark, faceAlpha, showBonds, showLabels, fogEnabled,
            atomScale, zoomVal, currentMode, addSubMode, addSourceAtom, addElement,
            editSelected, selectedAtoms, bondSelection, activeSnapGuides,
            hoveredAtom, hoveredBond, hoveredAxisIdx, currentAxes, editDragging,
            supercellEnabled, supercellNx, supercellNy, supercellNz,
            currentMX, currentMY, dragging } = app;

    /* — Project all atoms and populate spatial grid — */
    const projList = atoms.map((a, i) => {
        const p = proj(a.x, a.y, a.z);
        const mapped = { ...a, sx:p.sx, sy:p.sy, sz:p.sz, ps:p.ps, arrIndex:i };
        projMap[a.id] = mapped;
        const k = getGridKey(mapped.sx, mapped.sy);
        if (!spatialGrid.has(k)) spatialGrid.set(k, {atoms:[],bonds:[]});
        spatialGrid.get(k).atoms.push(mapped);
        return mapped;
    });

    /* — Depth range for fog — */
    let minSz=Infinity, maxSz=-Infinity;
    projList.forEach(p => { if (p.sz<minSz) minSz=p.sz; if (p.sz>maxSz) maxSz=p.sz; });
    if (!isFinite(minSz)) { minSz=-5; maxSz=5; }
    const szRange = Math.max(maxSz-minSz, 0.01);

    /* — Gather draw-groups (polyhedra, cavities, etc.) — */
    const groups = getAllDrawGroups();
    const anyGroup = groups.length > 0;
    const groupAtomSet = new Set();
    groups.forEach(g => g.ids.forEach(id => groupAtomSet.add(id)));
    selectedAtoms.forEach(id => groupAtomSet.add(id));
    if (currentMode === 'move') editSelected.forEach(id => groupAtomSet.add(id));

    /* — Build draw list — */
    const drawList = [];

    groups.forEach(gr => {
        if (gr.isSphere) {
            const pC = proj(gr.cx, gr.cy, gr.cz);
            const pr = gr.r * app.zoomVal * 1.15 * pC.ps;

            // Build two orientation rings with perspective projection so they
            // match the sphere's actual 3D position and give a correct depth cue.
            const N = 48;
            const ring1 = [], ring2 = [];
            for (let i = 0; i < N; i++) {
                const t = (i / N) * Math.PI * 2;
                ring1.push(proj(gr.cx + gr.r*Math.cos(t), gr.cy, gr.cz + gr.r*Math.sin(t)));
                ring2.push(proj(gr.cx + gr.r*Math.cos(t), gr.cy + gr.r*Math.sin(t), gr.cz));
            }

            drawList.push({ type:'cavityBack',  z: pC.sz - gr.r*0.9, cx:pC.sx, cy:pC.sy, r:pr, color:gr.color });
            drawList.push({ type:'cavityFront', z: pC.sz + gr.r*0.9, cx:pC.sx, cy:pC.sy, r:pr, color:gr.color, ring1, ring2 });
            return;
        }
        gr.faces.forEach(f => {
            if (f.some(id => !projMap[id])) return;
            const mz = f.reduce((s,id)=>s+projMap[id].sz,0)/f.length;
            drawList.push({ type:'face', z:mz-0.02, fIds:f, color:gr.color });
        });
        gr.edges.forEach(e => {
            const p1=projMap[e[0]], p2=projMap[e[1]]; if (!p1||!p2) return;
            drawList.push({ type:'edge', z:(p1.sz+p2.sz)/2-0.01, p1, p2, color:gr.color });
        });
        gr.ids.forEach(id => { if (projMap[id]) drawList.push({ type:'vtx', z:projMap[id].sz-0.005, id, color:gr.color }); });
    });

    if (showBonds) bonds.forEach((b, i) => {
        const a1=projMap[b.a], a2=projMap[b.b]; if (!a1||!a2) return;
        drawList.push({ type:'bond', z:(a1.sz+a2.sz)/2, a1, a2, dashed:b.dashed, isCu:a1.t==='Cu'||a2.t==='Cu', ai:b.a, bi:b.b, bIndex:i });
        const steps=3; let lastK='';
        for (let s=0; s<=steps; s++) {
            const bx=a1.sx+(a2.sx-a1.sx)*(s/steps), by=a1.sy+(a2.sy-a1.sy)*(s/steps);
            const k=getGridKey(bx,by);
            if (k!==lastK) { if (!spatialGrid.has(k)) spatialGrid.set(k,{atoms:[],bonds:[]}); spatialGrid.get(k).bonds.push({b,i}); lastK=k; }
        }
    });

    projList.forEach((a, i) => drawList.push({ type:'atom', z:a.sz, a, i }));

    /* — Preview polyhedron in poly mode — */
    if (currentMode==='poly' && selectedAtoms.length>=3) {
        const pf = math.decomposeFaces(selectedAtoms, getAtom);
        const pe = math.collectEdges(pf);
        pf.forEach(f => {
            if (f.some(id => !projMap[id])) return;
            const mz=f.reduce((s,id)=>s+projMap[id].sz,0)/f.length;
            drawList.push({ type:'prevface', z:mz-0.02, fIds:f });
        });
        pe.forEach(e => { const p1=projMap[e[0]],p2=projMap[e[1]]; if (p1&&p2) drawList.push({ type:'prevedge', z:(p1.sz+p2.sz)/2-0.01, p1, p2 }); });
    }

    /* — Ghost atom preview in add mode — */
    if (currentMode==='add' && addSubMode==='add' && addSourceAtom!==null && currentAxes.length>0 && hoveredAxisIdx>=0) {
        const ax = currentAxes[hoveredAxisIdx];
        const gpos = math.v3add(ax.origin, math.v3scale(ax.dir, 1.4));
        const p = proj(...gpos);
        drawList.push({ type:'ghost', z:p.sz, a:{t:addElement, sx:p.sx, sy:p.sy, sz:p.sz, ps:p.ps} });
    }

    /* — Snap guides — */
    activeSnapGuides.forEach(g => {
        if (!g||g.length<2) return;
        const p1=proj(...g[0]), p2=proj(...g[1]);
        drawList.push({ type:'guide', z:(p1.sz+p2.sz)/2, p1, p2 });
    });

    /* — Supercell ghost copies — */
    if (supercellEnabled) {
        const lv = math.getLatticeVectors(atoms);
        for (let i=0;i<supercellNx;i++) for (let j=0;j<supercellNy;j++) for (let k=0;k<supercellNz;k++) {
            if (i===0&&j===0&&k===0) continue;
            const ox=i*lv.ax, oy=j*lv.ay, oz=k*lv.az;
            atoms.forEach(a => { const p=proj(a.x+ox,a.y+oy,a.z+oz); drawList.push({ type:'sc_atom', z:p.sz, a:{t:a.t,sx:p.sx,sy:p.sy,sz:p.sz,ps:p.ps} }); });
            if (showBonds) bonds.forEach(b => {
                const aA=app.atomById.get(b.a), aB=app.atomById.get(b.b); if (!aA||!aB) return;
                const p1=proj(aA.x+ox,aA.y+oy,aA.z+oz), p2=proj(aB.x+ox,aB.y+oy,aB.z+oz);
                drawList.push({ type:'sc_bond', z:(p1.sz+p2.sz)/2, p1, p2, dashed:b.dashed, isCu:aA.t==='Cu'||aB.t==='Cu' });
            });
        }
    }

    /* — Painter's sort + render — */
    drawList.sort((a,b) => a.z-b.z);

    drawList.forEach(d => {
        switch (d.type) {
        case 'face': {
            const pts = d.fIds.map(id=>({sx:projMap[id].sx,sy:projMap[id].sy})); if (pts.length<3) break;
            const [r,g,b] = hexRgb(d.color);
            ctx.save(); ctx.beginPath();
            pts.forEach((p,i)=>{ i===0?ctx.moveTo(p.sx,p.sy):ctx.lineTo(p.sx,p.sy); });
            ctx.closePath(); ctx.fillStyle=`rgba(${r},${g},${b},${faceAlpha})`; ctx.fill(); ctx.restore(); break;
        }
        case 'edge': {
            const [r,g,bc] = hexRgb(d.color);
            ctx.beginPath(); ctx.moveTo(d.p1.sx,d.p1.sy); ctx.lineTo(d.p2.sx,d.p2.sy);
            ctx.strokeStyle=`rgba(${r},${g},${bc},${dark?0.7:0.55})`; ctx.lineWidth=2; ctx.stroke(); break;
        }
        case 'cavityBack': {
            // Back hemisphere — drawn before nearby atoms so those atoms
            // appear to sit inside the sphere volume.
            const [rv,gv,bv] = hexRgb(d.color);
            const cx=d.cx, cy=d.cy, rad=d.r;
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2);
            const bg = ctx.createRadialGradient(cx, cy, rad*0.25, cx, cy, rad);
            bg.addColorStop(0, `rgb(${Math.round(rv*0.25)},${Math.round(gv*0.25)},${Math.round(bv*0.25)})`);
            bg.addColorStop(1, `rgb(${Math.round(rv*0.55)},${Math.round(gv*0.55)},${Math.round(bv*0.55)})`);
            ctx.fillStyle = bg; ctx.fill();
            ctx.restore();
            break;
        }
        case 'cavityFront': {
            // Front hemisphere — drawn after nearby atoms, semi-transparent so
            // atoms inside the sphere remain visible through the front face.
            const [rv,gv,bv] = hexRgb(d.color);
            const cx=d.cx, cy=d.cy, rad=d.r;

            // Camera-relative light direction (world light rotated by current angles)
            const lx=-0.6, ly=0.8, lz=0.5;
            const aY=app.angleY, aX=app.angleX;
            const rlx = lx*Math.cos(aY) - lz*Math.sin(aY);
            const rlz = lx*Math.sin(aY) + lz*Math.cos(aY);
            const rly = -(ly*Math.cos(aX) - rlz*Math.sin(aX));
            const rll = Math.sqrt(rlx*rlx + rly*rly) || 1;
            const nlx = rlx/rll, nly = rly/rll;

            const fx  = cx + nlx*rad*0.30, fy  = cy + nly*rad*0.30;
            const shx = cx - nlx*rad*0.50, shy = cy - nly*rad*0.50;
            const spx = cx + nlx*rad*0.35, spy = cy + nly*rad*0.35;

            ctx.save();

            // Pass 1: diffuse body (semi-transparent — atoms show through)
            ctx.globalAlpha = 0.36;
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2);
            const bodyGrad = ctx.createRadialGradient(fx, fy, rad*0.02, cx, cy, rad);
            bodyGrad.addColorStop(0,   `rgb(${Math.min(255,rv+110)},${Math.min(255,gv+110)},${Math.min(255,bv+110)})`);
            bodyGrad.addColorStop(0.45,`rgb(${rv},${gv},${bv})`);
            bodyGrad.addColorStop(1,   `rgb(${Math.round(rv*0.30)},${Math.round(gv*0.30)},${Math.round(bv*0.30)})`);
            ctx.fillStyle = bodyGrad; ctx.fill();

            // Pass 2: shadow overlay
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.clip();
            ctx.globalAlpha = 0.22;
            const shadowGrad = ctx.createRadialGradient(shx, shy, rad*0.10, shx, shy, rad*1.15);
            shadowGrad.addColorStop(0, 'rgb(0,0,0)');
            shadowGrad.addColorStop(1, `rgb(${rv},${gv},${bv})`);
            ctx.fillStyle = shadowGrad;
            ctx.fillRect(cx-rad, cy-rad, rad*2, rad*2);

            // Pass 3: specular highlight (opaque white spot — always visible)
            ctx.globalAlpha = 0.85;
            const specGrad = ctx.createRadialGradient(spx, spy, 0, spx, spy, rad*0.28);
            specGrad.addColorStop(0,   'rgb(255,255,255)');
            specGrad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
            specGrad.addColorStop(1,   'rgba(255,255,255,0)');
            ctx.fillStyle = specGrad;
            ctx.fillRect(cx-rad, cy-rad, rad*2, rad*2);

            ctx.restore();

            // Pass 4: orientation rings — orthographic ellipses showing 3D rotation.
            // They narrow to a line when edge-on, widen to a circle when face-on,
            // giving a strong 3D depth cue through shape rather than size change.
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.clip();
            ctx.globalAlpha = 0.42;
            ctx.strokeStyle = `rgba(${Math.min(255,rv+50)},${Math.min(255,gv+50)},${Math.min(255,bv+50)},1)`;
            ctx.lineWidth = 1.0;
            ctx.setLineDash([5, 5]);
            [d.ring1, d.ring2].forEach(ring => {
                ctx.beginPath();
                ring.forEach((p, i) => { i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy); });
                ctx.closePath(); ctx.stroke();
            });
            ctx.setLineDash([]);
            ctx.restore();

            // Outline (outside clip so it draws the full circle edge)
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(${rv},${gv},${bv},0.55)`;
            ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
            break;
        }
        case 'vtx': {
            const p = projMap[d.id]; const [r,g,b] = hexRgb(d.color);
            ctx.beginPath(); ctx.arc(p.sx,p.sy,3.5,0,Math.PI*2);
            ctx.fillStyle=`rgba(${r},${g},${b},${dark?0.8:0.65})`; ctx.fill(); break;
        }
        case 'prevface': {
            const pts = d.fIds.map(id=>({sx:projMap[id].sx,sy:projMap[id].sy}));
            ctx.save(); ctx.beginPath();
            pts.forEach((p,i)=>{ i===0?ctx.moveTo(p.sx,p.sy):ctx.lineTo(p.sx,p.sy); });
            ctx.closePath(); ctx.fillStyle='rgba(123,94,198,0.1)'; ctx.fill(); ctx.restore(); break;
        }
        case 'prevedge': {
            ctx.save(); ctx.setLineDash([5,4]);
            ctx.beginPath(); ctx.moveTo(d.p1.sx,d.p1.sy); ctx.lineTo(d.p2.sx,d.p2.sy);
            ctx.strokeStyle='rgba(123,94,198,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
            ctx.setLineDash([]); ctx.restore(); break;
        }
        case 'guide': {
            const dx=d.p2.sx-d.p1.sx, dy=d.p2.sy-d.p1.sy;
            if (dx*dx+dy*dy < 4) break; // skip zero-length guides
            ctx.save();
            ctx.beginPath(); ctx.moveTo(d.p1.sx,d.p1.sy); ctx.lineTo(d.p2.sx,d.p2.sy);
            ctx.strokeStyle='#FFB300'; ctx.lineWidth=2; ctx.globalAlpha=0.85; ctx.stroke();
            ctx.restore(); break;
        }
        case 'bond': {
            const {a1,a2,dashed,isCu,ai,bi,bIndex} = d;
            ctx.beginPath(); ctx.setLineDash(dashed?[3,4]:[]);
            ctx.moveTo(a1.sx,a1.sy); ctx.lineTo(a2.sx,a2.sy);
            const dim = anyGroup && !groupAtomSet.has(ai) && !groupAtomSet.has(bi);
            const isHov = hoveredBond===bIndex;
            const fog = fogEnabled ? 0.15+(((a1.sz+a2.sz)/2-minSz)/szRange)*0.85 : 1;
            if (isHov) { ctx.strokeStyle=varColor('--red'); }
            else { const [br,bg,bb]=hexRgb(getCOL(isCu?'Cu':'C')); ctx.strokeStyle=`rgba(${br},${bg},${bb},${(dim?0.13:0.47)*fog})`; }
            ctx.lineWidth=(isCu?2.5:1.8)*((a1.ps+a2.ps)/2); if (isHov) ctx.lineWidth+=1.5;
            ctx.stroke(); ctx.setLineDash([]); break;
        }
        case 'atom': {
            const {a} = d;
            const col=getCOL(a.t), baseR=getRAD(a.t)*atomScale, r=Math.max(0.01,baseR*a.ps*(zoomVal/65));
            const dm=0.7+0.3*((a.sz+5)/10), [cr,cg,cb]=hexRgb(col);
            let isRotatingGroup = false;
            if (currentMode==='move' && currentAxes.length>0) {
                const rotAx=currentAxes.find(ax=>ax.type==='rotate');
                if (rotAx && rotAx.rotatingGroup.includes(a.id)) isRotatingGroup=true;
            }
            const inF=groupAtomSet.has(a.id), faded=anyGroup&&!inF;
            const isES=(currentMode==='move'&&editSelected.includes(a.id))||(currentMode==='add'&&addSubMode==='add'&&addSourceAtom===a.id);
            const isBondSel=(currentMode==='bonds'&&bondSelection.includes(a.id));
            const fog=fogEnabled?0.15+((a.sz-minSz)/szRange)*0.85:1;
            const baseAlpha=(faded&&!isES&&!isBondSel&&!isRotatingGroup)?0.15:1;
            ctx.save(); ctx.globalAlpha=baseAlpha*fog;
            const grad=ctx.createRadialGradient(a.sx-r*0.3,a.sy-r*0.3,r*0.05,a.sx,a.sy,r);
            grad.addColorStop(0,`rgb(${Math.min(255,cr+Math.round((255-cr)*0.5))},${Math.min(255,cg+Math.round((255-cg)*0.5))},${Math.min(255,cb+Math.round((255-cb)*0.5))})`);
            grad.addColorStop(0.5,`rgb(${Math.round(cr*dm)},${Math.round(cg*dm)},${Math.round(cb*dm)})`);
            grad.addColorStop(1,`rgb(${Math.round(cr*0.5*dm)},${Math.round(cg*0.5*dm)},${Math.round(cb*0.5*dm)})`);
            ctx.beginPath(); ctx.arc(a.sx,a.sy,r,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
            if (selectedAtoms.includes(a.id)) { ctx.strokeStyle=varColor('--purple'); ctx.lineWidth=2.5; ctx.stroke(); }
            else if (currentMode==='move'&&editSelected.length===2&&(editSelected.includes(a.id)||isRotatingGroup)) {
                if (a.id===editSelected[0]) { ctx.strokeStyle=varColor('--red'); ctx.lineWidth=3; ctx.stroke(); }
                else if (a.id===editSelected[1]) { ctx.strokeStyle=varColor('--amber'); ctx.lineWidth=3; ctx.stroke(); }
                else if (isRotatingGroup) { ctx.strokeStyle='rgba(186,117,23,0.7)'; ctx.lineWidth=1.5; ctx.stroke(); }
            }
            else if (isES) { ctx.strokeStyle=currentMode==='add'?varColor('--green'):varColor('--red'); ctx.lineWidth=2.5; ctx.stroke(); }
            else if (isBondSel) { ctx.strokeStyle=varColor('--amber'); ctx.lineWidth=2.5; ctx.stroke(); }
            else if (a.id===hoveredAtom) {
                ctx.strokeStyle=dark?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.5)';
                if (currentMode==='add'&&addSubMode==='delete') ctx.strokeStyle=varColor('--red');
                ctx.lineWidth=2.5; ctx.stroke();
            }
            else if (inF&&anyGroup) { ctx.strokeStyle=dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.18)'; ctx.lineWidth=1.5; ctx.stroke(); }
            ctx.restore();
            if (showLabels) {
                ctx.save(); ctx.font='500 9px "Syne",sans-serif';
                ctx.fillStyle=dark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.5)';
                ctx.textAlign='center'; ctx.textBaseline='bottom';
                ctx.fillText(a.t,a.sx,a.sy-r-2); ctx.restore();
            }
            break;
        }
        case 'ghost': {
            const {a} = d;
            const col=getCOL(a.t), baseR=getRAD(a.t)*atomScale, r=Math.max(0.01,baseR*a.ps*(zoomVal/65));
            const [cr,cg,cb]=hexRgb(col);
            ctx.save(); ctx.globalAlpha=0.4;
            ctx.beginPath(); ctx.arc(a.sx,a.sy,r,0,Math.PI*2); ctx.fillStyle=`rgb(${cr},${cg},${cb})`; ctx.fill();
            ctx.setLineDash([3,3]); ctx.strokeStyle=dark?'#fff':'#000'; ctx.lineWidth=1; ctx.stroke();
            ctx.restore(); break;
        }
        case 'sc_atom': {
            const {a} = d;
            const scFog=fogEnabled?0.15+((a.sz-minSz)/szRange)*0.85:1;
            const col=getCOL(a.t), baseR=getRAD(a.t)*atomScale, r=Math.max(0.01,baseR*a.ps*(zoomVal/65));
            const [cr,cg,cb]=hexRgb(col);
            ctx.save(); ctx.globalAlpha=0.32*scFog;
            ctx.beginPath(); ctx.arc(a.sx,a.sy,r,0,Math.PI*2);
            const grad=ctx.createRadialGradient(a.sx-r*0.3,a.sy-r*0.3,r*0.05,a.sx,a.sy,r);
            grad.addColorStop(0,`rgb(${Math.min(255,cr+Math.round((255-cr)*0.5))},${Math.min(255,cg+Math.round((255-cg)*0.5))},${Math.min(255,cb+Math.round((255-cb)*0.5))})`);
            grad.addColorStop(1,`rgb(${Math.round(cr*0.5)},${Math.round(cg*0.5)},${Math.round(cb*0.5)})`);
            ctx.fillStyle=grad; ctx.fill(); ctx.restore(); break;
        }
        case 'sc_bond': {
            const {p1,p2,dashed,isCu} = d;
            const scFog=fogEnabled?0.15+(((p1.sz+p2.sz)/2-minSz)/szRange)*0.85:1;
            ctx.save(); ctx.globalAlpha=0.22*scFog;
            ctx.setLineDash(dashed?[3,4]:[]);
            ctx.beginPath(); ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy);
            ctx.strokeStyle=dark?'#888':'#999';
            ctx.lineWidth=(isCu?2.5:1.8)*((p1.ps+p2.ps)/2);
            ctx.stroke(); ctx.setLineDash([]); ctx.restore(); break;
        }
        }
    });

    /* ── Axis gizmos ── */
    if (currentAxes.length > 0 && !editDragging) {
        currentAxes.forEach((ax, i) => {
            const isH = hoveredAxisIdx === i;
            if (ax.type === 'rotate') {
                const ptOnAxis = proj(...math.v3add(ax.axisOrigin, math.v3scale(ax.dir,0.7)));
                const pHandle  = proj(...ax.handlePos);
                ctx.beginPath(); ctx.setLineDash([2,2]);
                ctx.moveTo(ptOnAxis.sx,ptOnAxis.sy); ctx.lineTo(pHandle.sx,pHandle.sy);
                ctx.strokeStyle='rgba(186,117,23,0.5)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(pHandle.sx,pHandle.sy,isH?8:6,0,Math.PI*2);
                ctx.fillStyle=isH?'#BA7517':'rgba(186,117,23,0.8)'; ctx.fill();
                ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
            } else {
                const col=AXIS_COLORS[i%AXIS_COLORS.length], lw=isH?3.5:2, al=isH?1:0.6;
                const [rr,gg,bb]=hexRgb(col);
                const ap=proj(...ax.origin);
                const ep=proj(ax.origin[0]+ax.dir[0]*1.2, ax.origin[1]+ax.dir[1]*1.2, ax.origin[2]+ax.dir[2]*1.2);
                const sdx=ep.sx-ap.sx, sdy=ep.sy-ap.sy;
                const sl=Math.sqrt(sdx*sdx+sdy*sdy)||1, ux=sdx/sl, uy=sdy/sl, ext=isH?75:65;
                const epx=ap.sx+ux*ext, epy=ap.sy+uy*ext, nepx=ap.sx-ux*ext*0.1, nepy=ap.sy-uy*ext*0.1;
                ctx.save(); ctx.beginPath(); ctx.moveTo(nepx,nepy); ctx.lineTo(epx,epy);
                ctx.strokeStyle=`rgba(${rr},${gg},${bb},${al})`; ctx.lineWidth=lw; ctx.stroke();
                const as=isH?8:6;
                ctx.beginPath();
                ctx.moveTo(epx,epy); ctx.lineTo(epx-ux*as+uy*as*0.5, epy-uy*as-ux*as*0.5);
                ctx.moveTo(epx,epy); ctx.lineTo(epx-ux*as-uy*as*0.5, epy-uy*as+ux*as*0.5);
                ctx.stroke();
                ctx.beginPath(); ctx.arc(nepx,nepy,isH?4:3,0,Math.PI*2);
                ctx.fillStyle=`rgba(${rr},${gg},${bb},${al})`; ctx.fill(); ctx.restore();
            }
        });
    }

    /* ── Multi-HUD: bond lengths + bond angles (view mode only) ── */
    if (currentMode === 'view' && currentMX !== -1000 && currentMY !== -1000 && !dragging && !editDragging) {
        const mx=currentMX, my=currentMY;
        /* Bond lengths */
        bonds.forEach(b => {
            const p1=projMap[b.a], p2=projMap[b.b]; if (!p1||!p2) return;
            const l2=(p1.sx-p2.sx)**2+(p1.sy-p2.sy)**2; if (l2===0) return;
            let t=((mx-p1.sx)*(p2.sx-p1.sx)+(my-p1.sy)*(p2.sy-p1.sy))/l2; t=Math.max(0,Math.min(1,t));
            const dist=Math.sqrt((mx-p1.sx-t*(p2.sx-p1.sx))**2+(my-p1.sy-t*(p2.sy-p1.sy))**2);
            if (dist < 40) {
                const a1=app.atomById.get(b.a), a2=app.atomById.get(b.b); if (!a1||!a2) return;
                const d3d=(math.v3dist([a1.x,a1.y,a1.z],[a2.x,a2.y,a2.z])*2).toFixed(3);
                let ang=Math.atan2(p2.sy-p1.sy, p2.sx-p1.sx);
                if (ang>Math.PI/2||ang<-Math.PI/2) ang+=Math.PI;
                ctx.save();
                ctx.translate((p1.sx+p2.sx)/2,(p1.sy+p2.sy)/2);
                ctx.rotate(ang); ctx.translate(0,-6);
                ctx.font='600 10px var(--mono)'; ctx.textAlign='center'; ctx.textBaseline='middle';
                const txt=d3d+' Å', tw=ctx.measureText(txt).width;
                ctx.fillStyle=dark?'rgba(31,41,55,0.85)':'rgba(255,255,255,0.85)';
                drawRoundedRect(ctx,-tw/2-4,-8,tw+8,16,4);
                ctx.fillStyle=dark?'#4ade80':'#16a34a';
                ctx.fillText(txt,0,0); ctx.restore();
            }
        });
        /* Bond angles */
        atoms.forEach(a => {
            const p=projMap[a.id]; if (!p) return;
            const dist=Math.sqrt((mx-p.sx)**2+(my-p.sy)**2); if (dist>=50) return;
            const nbrs=getNeighbors(a.id); if (nbrs.length<2) return;
            const bondAngles2D=nbrs.map(nid=>{
                const pn=projMap[nid]; if (!pn) return null;
                return { nid, n:app.atomById.get(nid), pn, ang2d:Math.atan2(pn.sy-p.sy,pn.sx-p.sx) };
            }).filter(Boolean);
            bondAngles2D.sort((A,B)=>A.ang2d-B.ang2d);
            for (let i=0;i<bondAngles2D.length;i++) {
                const b1=bondAngles2D[i], b2=bondAngles2D[(i+1)%bondAngles2D.length];
                let diff=b2.ang2d-b1.ang2d; while (diff<0) diff+=Math.PI*2;
                if (bondAngles2D.length===2&&diff>Math.PI) continue;
                const v1_3d=math.v3norm(math.v3sub([b1.n.x,b1.n.y,b1.n.z],[a.x,a.y,a.z]));
                const v2_3d=math.v3norm(math.v3sub([b2.n.x,b2.n.y,b2.n.z],[a.x,a.y,a.z]));
                const ang3d=(Math.acos(Math.max(-1,Math.min(1,math.v3dot(v1_3d,v2_3d))))*180/Math.PI).toFixed(1);
                const arcR=18;
                ctx.save(); ctx.beginPath(); ctx.arc(p.sx,p.sy,arcR,b1.ang2d,b1.ang2d+diff);
                ctx.strokeStyle=dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
                const bisect=b1.ang2d+diff/2;
                const tx=p.sx+Math.cos(bisect)*(arcR+12), ty=p.sy+Math.sin(bisect)*(arcR+12);
                ctx.font='600 9px var(--mono)'; ctx.textAlign='center'; ctx.textBaseline='middle';
                const txt=ang3d+'°', tw=ctx.measureText(txt).width;
                ctx.fillStyle=dark?'rgba(31,41,55,0.85)':'rgba(255,255,255,0.9)';
                drawRoundedRect(ctx,tx-tw/2-3,ty-6,tw+6,12,3);
                ctx.fillStyle=dark?'#60a5fa':'#2563eb';
                ctx.fillText(txt,tx,ty); ctx.restore();
            }
        });
    }

    /* ── Header text ── */
    ctx.font='700 12px "Syne",sans-serif'; ctx.fillStyle=dark?'#c87533':'#b5651d'; ctx.textAlign='center';
    ctx.fillText(app.structureName, w/2, 20);
    ctx.font='400 10px "Syne",sans-serif'; ctx.fillStyle=dark?'#3a4d78':'#9aaace';
    let mt='Drag to rotate · scroll to zoom';
    if (currentMode==='move') mt='Move: Click atoms to select. 1st atom sets axes. 2nd atom enables Rotation handles.';
    else if (currentMode==='poly') mt='Select: click atoms to form polyhedron';
    else if (currentMode==='add') mt=addSubMode==='add'?'Add: click atom, drag axis handle to extrude':'Delete: click atoms or bonds to remove';
    else if (currentMode==='bonds') mt='Bonds: click two atoms to link/unlink';
    ctx.fillText(mt, w/2, 34);

    /* ── World axes widget ── */
    _drawWorldAxes(w, h);
}

function _drawWorldAxes(_w, h) {
    const cx=60, cy=h-60, size=35;
    const drawAxis=(x,y,z,col,label) => {
        const aY=app.angleY, aX=app.angleX;
        let x1=x*Math.cos(aY)-z*Math.sin(aY), z1=x*Math.sin(aY)+z*Math.cos(aY);
        let y2=y*Math.cos(aX)-z1*Math.sin(aX);
        const ex=cx+x1*size, ey=cy-y2*size;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ex,ey);
        ctx.strokeStyle=col; ctx.lineWidth=3; ctx.stroke();
        ctx.fillStyle=col; ctx.font='bold 12px var(--font)';
        ctx.fillText(label, ex+(x1>0?5:-12), ey+(y2>0?-5:12));
    };
    drawAxis(1,0,0,'#E24B4A','X');
    drawAxis(0,1,0,'#1D9E75','Y');
    drawAxis(0,0,1,'#3B6EE6','Z');
}
