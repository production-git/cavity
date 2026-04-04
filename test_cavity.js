const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/Users/mrinalmahato/Projects/Personal/HCUST/models/HKUST_CIF.json'));
const atoms = data.atoms;
const bonds = data.bonds || [];

const adj = new Map();
atoms.forEach(a => adj.set(a.id, []));
bonds.forEach(b => { adj.get(b.a)?.push(b.b); adj.get(b.b)?.push(b.a); });

function planeOf(atom) {
    if (atom.plane) return atom.plane;
    if (atom.t === 'C') {
        const hasO = adj.get(atom.id).some(nid => atoms.find(a => a.id === nid)?.t === 'O');
        return hasO ? 'carb' : 'ring';
    }
    return '';
}

const planeIds = new Set();
atoms.forEach(a => { if (planeOf(a) === 'ring') planeIds.add(a.id); });

const ringClusters = [];
const visited = new Set();
planeIds.forEach(id => {
    if (visited.has(id)) return;
    const cluster = [], queue = [id]; visited.add(id);
    while (queue.length) {
        const cur = queue.shift(); cluster.push(cur);
        adj.get(cur)?.forEach(nb => {
            if (planeIds.has(nb) && !visited.has(nb)) { visited.add(nb); queue.push(nb); }
        });
    }
    if (cluster.length >= 3) ringClusters.push(cluster);
});

function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function v3scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function v3cross(a, b) { return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]]; }
function v3dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function v3norm(a) { const len = Math.sqrt(v3dot(a,a)); return len > 1e-6 ? [a[0]/len, a[1]/len, a[2]/len] : [0,0,0]; }
function v3dist(a, b) { const d = v3sub(a,b); return Math.sqrt(v3dot(d,d)); }

const rings = ringClusters.map(ids => {
    let center = [0,0,0];
    const ringAtoms = ids.map(id => atoms.find(a => a.id === id));
    ringAtoms.forEach(a => { center[0] += a.x; center[1] += a.y; center[2] += a.z; });
    center[0] /= ids.length; center[1] /= ids.length; center[2] /= ids.length;
    
    let n = [0,0,0];
    for (let i = 0; i < ringAtoms.length; i++) {
        const a0 = ringAtoms[i], a1 = ringAtoms[(i+1)%ringAtoms.length], a2 = ringAtoms[(i+2)%ringAtoms.length];
        const cross = v3cross(v3sub([a1.x, a1.y, a1.z], [a0.x, a0.y, a0.z]), v3sub([a2.x, a2.y, a2.z], [a1.x, a1.y, a1.z]));
        n = v3add(n, cross);
    }
    return { ids, center, normal: v3norm(n) };
});

const intersections = [];
for (let i=0; i<rings.length; i++) {
    for (let j=i+1; j<rings.length; j++) {
        const r1 = rings[i], r2 = rings[j];
        const p1 = r1.center, d1 = r1.normal;
        const p2 = r2.center, d2 = r2.normal;
        
        const n = v3cross(d1, d2);
        const n_len = Math.sqrt(v3dot(n, n));
        if (n_len < 1e-3) continue; // nearly parallel
        
        const n1 = v3cross(d1, n);
        const n2 = v3cross(d2, n);
        
        const c1 = v3add(p1, v3scale(d1, v3dot(v3sub(p2, p1), n2) / v3dot(d1, n2)));
        const c2 = v3add(p2, v3scale(d2, v3dot(v3sub(p1, p2), n1) / v3dot(d2, n1)));
        
        const dist = v3dist(c1, c2);
        if (dist < 4.0) { // arbitrary threshold for skew lines intersection
            const midpoint = v3scale(v3add(c1, c2), 0.5);
            // Must be reasonable size
            if (v3dist(p1, midpoint) > 2.0 && v3dist(p1, midpoint) < 10.0) {
                intersections.push({ p: midpoint, r1, r2 });
            }
        }
    }
}

// Cluster intersections
const clusters = [];
intersections.forEach(ix => {
    let merged = false;
    for (let cl of clusters) {
        if (v3dist(ix.p, cl.center) < 3.0) { // 3A radius
            cl.points.push(ix.p);
            cl.rings.add(ix.r1);
            cl.rings.add(ix.r2);
            
            // Recompute center
            let sum = [0,0,0];
            cl.points.forEach(pt => { sum = v3add(sum, pt); });
            cl.center = v3scale(sum, 1.0 / cl.points.length);
            
            merged = true; break;
        }
    }
    if (!merged) {
        const nr = new Set(); nr.add(ix.r1); nr.add(ix.r2);
        clusters.push({ center: ix.p, points: [ix.p], rings: nr });
    }
});

const cavities = clusters.filter(c => c.rings.size >= 4);
console.log(`Found ${cavities.length} cavities`);
cavities.forEach((c, idx) => {
    console.log(`Cavity ${idx}: ${c.rings.size} rings, center=[${c.center[0].toFixed(2)}, ${c.center[1].toFixed(2)}, ${c.center[2].toFixed(2)}]`);
});
