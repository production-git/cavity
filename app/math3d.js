/**
 * math3d.js — Pure vector / geometry functions.
 * Zero imports. Zero side-effects. All geometry functions that previously
 * referenced global `atoms` now accept a `getAtomFn` parameter.
 */

/* ── Vector math ── */
export function v3sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
export function v3add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
export function v3scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
export function v3cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
export function v3dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
export function v3len(a) { return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }
export function v3norm(a) { const l = v3len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
export function v3dist(a, b) { return v3len(v3sub(a, b)); }

export function rotatePoint(p, origin, u, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const v = v3sub(p, origin);
    const cross = v3cross(u, v);
    const dot = v3dot(u, v);
    return v3add(v3add(v3add(v3scale(v, c), v3scale(cross, s)), v3scale(u, dot*(1-c))), origin);
}

/* ── 2D projection (Phase 2a — replaced by Three.js in Phase 2b) ── */
export function project(x, y, z, angleY, angleX, zoomVal, canvasW, canvasH) {
    let x1 = x*Math.cos(angleY) - z*Math.sin(angleY);
    let z1 = x*Math.sin(angleY) + z*Math.cos(angleY);
    let y2 = y*Math.cos(angleX) - z1*Math.sin(angleX);
    let z2 = y*Math.sin(angleX) + z1*Math.cos(angleX);
    const per = 14, ps = per/(per+z2), s = zoomVal*1.15;
    return { sx: canvasW/2 + x1*s*ps, sy: canvasH/2 - y2*s*ps, sz: z2, ps };
}

/* ── Geometry (getAtomFn keeps these pure) ── */
export function areCoplanar(ids, getAtomFn) {
    if (ids.length <= 3) return true;
    const pts = ids.map(id => { const a = getAtomFn(id); return [a.x, a.y, a.z]; });
    const cr = v3cross(v3sub(pts[1], pts[0]), v3sub(pts[2], pts[0]));
    if (v3len(cr) < 1e-9) return true;
    const n = v3norm(cr);
    for (let i = 3; i < pts.length; i++) { if (Math.abs(v3dot(n, v3sub(pts[i], pts[0]))) > 0.08) return false; }
    return true;
}

export function triangulatePlanar(ids, getAtomFn) {
    if (ids.length <= 3) return [ids.slice()];
    const pts = ids.map(id => { const a = getAtomFn(id); return [a.x, a.y, a.z]; });
    const c = [0,0,0];
    for (const p of pts) { c[0]+=p[0]; c[1]+=p[1]; c[2]+=p[2]; }
    c[0]/=pts.length; c[1]/=pts.length; c[2]/=pts.length;
    let bU = null, bV = null, nm = null;
    for (let i = 0; i < pts.length && !bV; i++) {
        for (let j = i+1; j < pts.length && !bV; j++) {
            const d = v3sub(pts[j], pts[i]);
            if (!bU && v3len(d) > 1e-9) { bU = v3norm(d); continue; }
            if (bU) { const cr = v3cross(bU, v3sub(pts[j], pts[i])); if (v3len(cr) > 1e-9) { nm = v3norm(cr); bV = v3norm(v3cross(nm, bU)); break; } }
        }
    }
    if (!bV) return [orderFace3D(ids, getAtomFn)];
    const co = pts.map(p => { const d = v3sub(p, c); return [v3dot(d, bU), v3dot(d, bV)]; });
    function hull2D(n, xy) {
        if (n <= 2) return Array.from({length:n}, (_,i) => i);
        let s = 0;
        for (let i = 1; i < n; i++) { const [sx,sy]=xy(i),[bx,by]=xy(s); if (sx<bx||(sx===bx&&sy<by)) s=i; }
        const h = []; let cur = s;
        do {
            h.push(cur); let nx = 0;
            for (let i = 0; i < n; i++) {
                if (i===cur) continue; if (nx===cur) { nx=i; continue; }
                const [cx,cy]=xy(cur),[nxx,ny]=xy(nx),[ix,iy]=xy(i);
                const cr = (nxx-cx)*(iy-cy)-(ny-cy)*(ix-cx);
                if (cr < -1e-10) nx = i;
                else if (Math.abs(cr) < 1e-10) { if ((nxx-cx)**2+(ny-cy)**2 < (ix-cx)**2+(iy-cy)**2) nx = i; }
            }
            cur = nx; if (h.length > n+1) break;
        } while (cur !== s);
        return h;
    }
    const hl = hull2D(ids.length, i => co[i]), hs = new Set(hl), ii = [];
    for (let i = 0; i < ids.length; i++) { if (!hs.has(i)) ii.push(i); }
    if (ii.length === 0) return [hl.map(i => ids[i])];
    const faces = [];
    if (ii.length === 1) {
        const ip = ii[0];
        for (let i = 0; i < hl.length; i++) { const j=(i+1)%hl.length; faces.push([ids[ip], ids[hl[i]], ids[hl[j]]]); }
        return faces;
    }
    const ip = ii[0], ipx = co[ip][0], ipy = co[ip][1], ot = [];
    for (let i = 0; i < ids.length; i++) { if (i !== ip) ot.push(i); }
    ot.sort((a,b) => Math.atan2(co[a][1]-ipy,co[a][0]-ipx) - Math.atan2(co[b][1]-ipy,co[b][0]-ipx));
    for (let i = 0; i < ot.length; i++) { const j=(i+1)%ot.length; faces.push([ids[ip], ids[ot[i]], ids[ot[j]]]); }
    return faces;
}

export function orderFace3D(ids, getAtomFn) {
    if (ids.length <= 2) return ids;
    const pts = ids.map(id => { const a = getAtomFn(id); return [a.x, a.y, a.z]; });
    const c = [0,0,0];
    for (const p of pts) { c[0]+=p[0]; c[1]+=p[1]; c[2]+=p[2]; }
    c[0]/=pts.length; c[1]/=pts.length; c[2]/=pts.length;
    const v1 = v3norm(v3sub(pts[0], c));
    const n = v3norm(v3cross(v1, v3sub(pts[1], c)));
    const v2 = v3cross(n, v1);
    const angles = ids.map((id,i) => { const d = v3sub(pts[i],c); return { id, ang: Math.atan2(v3dot(d,v2),v3dot(d,v1)) }; });
    angles.sort((a,b) => a.ang-b.ang);
    return angles.map(a => a.id);
}

export function convexHull3DFaces(ids, getAtomFn) {
    const pts = ids.map(id => { const a = getAtomFn(id); return [a.x,a.y,a.z]; });
    const n = pts.length; if (n < 4) return [ids.slice()];
    const faces = [], ct = [0,0,0];
    for (const p of pts) { ct[0]+=p[0]; ct[1]+=p[1]; ct[2]+=p[2]; }
    ct[0]/=n; ct[1]/=n; ct[2]/=n;
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let k = j+1; k < n; k++) {
        const v1 = v3sub(pts[j],pts[i]), v2 = v3sub(pts[k],pts[i]);
        const nm = v3cross(v1,v2); if (v3len(nm) < 1e-9) continue;
        const nn = v3norm(nm); const d = v3dot(nn,pts[i]);
        let ab = 0, bl = 0; const on = [];
        for (let m = 0; m < n; m++) {
            const val = v3dot(nn,pts[m])-d;
            if (Math.abs(val) < 0.05) on.push(m); else if (val > 0) ab++; else bl++;
        }
        if (ab === 0 || bl === 0) {
            const fi = on.map(m => ids[m]); let dom = false;
            for (let f = faces.length-1; f >= 0; f--) {
                const ex = new Set(faces[f]), nw = new Set(fi);
                if (fi.every(id => ex.has(id))) { dom = true; break; }
                if (faces[f].every(id => nw.has(id))) faces.splice(f, 1);
            }
            if (!dom) {
                const fc = [0,0,0];
                for (const id of fi) { const a = getAtomFn(id); fc[0]+=a.x; fc[1]+=a.y; fc[2]+=a.z; }
                fc[0]/=fi.length; fc[1]/=fi.length; fc[2]/=fi.length;
                const a0 = getAtomFn(fi[0]);
                const u = v3norm(v3sub([a0.x,a0.y,a0.z], fc));
                const w = v3norm(v3cross(nn, u));
                fi.sort((a,b) => {
                    const aA = getAtomFn(a), aB = getAtomFn(b);
                    const da = v3sub([aA.x,aA.y,aA.z],fc), db = v3sub([aB.x,aB.y,aB.z],fc);
                    return Math.atan2(v3dot(da,w),v3dot(da,u)) - Math.atan2(v3dot(db,w),v3dot(db,u));
                });
                faces.push(fi);
            }
        }
    }
    return faces.length ? faces : [ids.slice()];
}

export function decomposeFaces(ids, getAtomFn) {
    if (ids.length < 3) return [];
    if (ids.length === 3) return [ids.slice()];
    if (areCoplanar(ids, getAtomFn)) return triangulatePlanar(ids, getAtomFn);
    return convexHull3DFaces(ids, getAtomFn);
}

export function collectEdges(faces) {
    const es = new Set(), ed = [];
    faces.forEach(f => {
        for (let i = 0; i < f.length; i++) {
            const a = f[i], b = f[(i+1)%f.length];
            const k = Math.min(a,b)+'-'+Math.max(a,b);
            if (!es.has(k)) { es.add(k); ed.push([a,b]); }
        }
    });
    return ed;
}

export function describeGeom(ids, getAtomFn) {
    if (ids.length < 3) return '';
    if (areCoplanar(ids, getAtomFn)) {
        const f = triangulatePlanar(ids, getAtomFn);
        if (f.length === 1 && f[0].length === ids.length) {
            if (ids.length === 3) return 'Triangle';
            if (ids.length === 4) return 'Quadrilateral';
            return ids.length+'-gon';
        }
        return f.length+' triangular faces, '+ids.length+' vtx';
    }
    const f = convexHull3DFaces(ids, getAtomFn);
    const v = ids.length, fc = f.length;
    if (v===4&&fc===4) return 'Tetrahedron';
    if (v===5&&fc===5) return 'Sq. pyramid';
    if (v===6&&fc===8) return 'Octahedron';
    if (v===8&&fc===6) return 'Cube';
    return fc+'-face polyhedron';
}

export function getLatticeVectors(atoms) {
    if (!atoms.length) return { ax:10, ay:10, az:6 };
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity, z0=Infinity, z1=-Infinity;
    atoms.forEach(a => {
        x0=Math.min(x0,a.x); x1=Math.max(x1,a.x);
        y0=Math.min(y0,a.y); y1=Math.max(y1,a.y);
        z0=Math.min(z0,a.z); z1=Math.max(z1,a.z);
    });
    return { ax:x1-x0+1.5, ay:y1-y0+1.5, az:z1-z0+1.5 };
}
