/**
 * ui.js — DOM event handlers and UI update functions (Phase 2a).
 *
 * Imports: state.js, renderer.js, math3d.js
 * Exports: init(), setMode(), setAddSubMode(), toggleTheme(),
 *   updateUndoRedoUI(), updateModePill(), updateSelUI(), updateUIHints(),
 *   updateLegend(), updateStats(), buildColorRow(), buildElemPalette(),
 *   openExport(), doExport(), openImport(), loadSaved(), deleteSaved(),
 *   closeModals(), desel(), editDesel(), rmGroup(), openCustomElem(),
 *   addCustomElem(), setPlane(), commitPreset(), setView(),
 *   resetStructure(), exportPNG()
 */

import {
    app, ELEMENTS, PCOLORS, PRESET_COL, AXIS_COLORS, COL,
    getCOL, getNAME,
    saveState, undo, redo,
    getNeighbors, deleteAtom, toggleBond,
    computeEditAxes, computeAddAxes, trySnap,
    getPlaneGroups, getCavitySpheres,
    parseXYZ, parseMOL, parseCIF, loadStructureFromJSON,
    serializeStructure, saveToStorage, listSaved, loadFromStorage, deleteFromStorage,
} from './state.js';
import { draw, getCanvas, hitTest, hitBondTest, hitAxisTest, hitCavityTest } from './renderer.js';
import * as math from './math3d.js';

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
export function init() {
    const canvas = getCanvas();
    const tip = document.getElementById('tip');

    /* ── View settings sliders & checkboxes ── */
    document.getElementById('zoom').oninput = e => {
        app.zoomVal = +e.target.value;
        document.getElementById('zv').textContent = Math.round(app.zoomVal);
        draw();
    };
    document.getElementById('asize').oninput = e => {
        app.atomScale = e.target.value / 100;
        document.getElementById('asv').textContent = Math.round(e.target.value) + '%';
        draw();
    };
    document.getElementById('faceOpac').oninput = e => {
        app.faceAlpha = e.target.value / 100;
        document.getElementById('fov').textContent = Math.round(e.target.value) + '%';
        draw();
    };
    document.getElementById('autoRot').onchange   = e => { app.autoRotate = e.target.checked; };
    document.getElementById('showBonds').onchange  = e => { app.showBonds  = e.target.checked; draw(); };
    document.getElementById('showLabels').onchange = e => { app.showLabels = e.target.checked; draw(); };
    document.getElementById('snapEnabled').onchange = e => { app.snapEnabled = e.target.checked; };
    document.getElementById('fogEnabled').onchange  = e => { app.fogEnabled  = e.target.checked; draw(); };
    document.getElementById('supercellEnabled').onchange = e => { app.supercellEnabled = e.target.checked; draw(); };
    document.getElementById('sc-nx').onchange = e => { app.supercellNx = +e.target.value; draw(); };
    document.getElementById('sc-ny').onchange = e => { app.supercellNy = +e.target.value; draw(); };
    document.getElementById('sc-nz').onchange = e => { app.supercellNz = +e.target.value; draw(); };

    /* ── Poly-mode selection bar ── */
    document.getElementById('sel-clear').onclick = () => { app.selectedAtoms = []; updateSelUI(); draw(); };
    document.getElementById('sel-plane').onclick = () => {
        if (app.selectedAtoms.length < 3) return;
        app.customGroups.push({ ids: [...app.selectedAtoms], color: PCOLORS[app.pcIdx++ % PCOLORS.length], idx: Date.now() });
        app.selectedAtoms = [];
        updateSelUI(); updateLegend(); draw(); saveState();
    };

    /* ── Tab switching ── */
    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.getElementById('tp-' + t.dataset.tab).classList.add('active');
        });
    });

    /* ── Modal backdrop click to close ── */
    document.querySelectorAll('.modal-bg').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeModals(); });
    });

    /* ── Canvas mouse events ── */
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    /* ── Touch events ── */
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchend',  onTouchEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    /* ── Keyboard ── */
    window.addEventListener('keydown', onKeyDown);
}

/* ══════════════════════════════════════════════════════════
   MODE MANAGEMENT
   ══════════════════════════════════════════════════════════ */
export function setMode(m) {
    const canvas = getCanvas();
    app.currentMode = m;
    app.autoRotate  = false;
    document.getElementById('autoRot').checked = false;

    app.editSelected   = []; app.selectedAtoms = []; app.bondSelection = [];
    app.currentAxes    = []; app.hoveredAxisIdx = -1;
    app.addSourceAtom  = null;
    app.hoveredAtom    = null; app.hoveredBond = -1;
    if (app.editDragging) { app.editDragging = false; canvas.style.cursor = 'grab'; }

    const isView = (m === 'view');
    const tabToolsBtn = document.getElementById('tab-btn-tools');

    if (isView) {
        tabToolsBtn.classList.add('ui-hidden');
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-btn-view').classList.add('active');
        document.getElementById('tp-view').classList.add('active');
        const returnBtn = document.getElementById('btn-view-only-mode');
        if (returnBtn) {
            returnBtn.innerHTML = '<b>[E]</b> Return to Move Mode';
            returnBtn.setAttribute('onclick', "setMode('move')");
        }
    } else {
        tabToolsBtn.classList.remove('ui-hidden');
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tabToolsBtn.classList.add('active');
        document.getElementById('tp-tools').classList.add('active');
        const returnBtn = document.getElementById('btn-view-only-mode');
        if (returnBtn) {
            returnBtn.innerHTML = '<b>[V]</b> Return to View Only Mode';
            returnBtn.setAttribute('onclick', "setMode('view')");
        }
    }

    document.getElementById('btn-view').className  = 'btn' + (m === 'view'  ? ' on on-view selected' : '');
    document.getElementById('btn-move').className  = 'btn' + (m === 'move'  ? ' on on-edit'  : '');
    document.getElementById('btn-poly').className  = 'btn' + (m === 'poly'  ? ' on on-poly'  : '');
    document.getElementById('btn-add').className   = 'btn' + (m === 'add'   ? ' on on-add'   : '');
    document.getElementById('btn-bonds').className = 'btn' + (m === 'bonds' ? ' on on-amber' : '');

    document.getElementById('add-panel').style.display  = (m === 'add')  ? 'block' : 'none';
    document.getElementById('move-panel').style.display = (m === 'move') ? 'block' : 'none';
    if (m === 'add') buildElemPalette();

    updateSelUI(); updateUIHints(); updateModePill(); draw();
}

export function setAddSubMode(sm) {
    app.addSubMode = sm;
    document.getElementById('btn-sub-add').className = 'btn sm' + (sm === 'add'    ? ' on'         : '');
    document.getElementById('btn-sub-del').className = 'btn sm' + (sm === 'delete' ? ' on on-red'  : '');
    document.getElementById('palette-container').style.display = (sm === 'add') ? 'block' : 'none';
    app.addSourceAtom = null; app.currentAxes = []; app.hoveredAtom = null; app.hoveredBond = -1;
    updateUIHints(); updateModePill(); draw();
}

export function toggleTheme() {
    app.dark = !app.dark;
    document.documentElement.setAttribute('data-theme', app.dark ? 'dark' : 'light');
    // Update C and H colors that depend on theme
    const cElem = ELEMENTS.find(e => e.sym === 'C');
    const hElem = ELEMENTS.find(e => e.sym === 'H');
    if (cElem) { cElem.col = app.dark ? '#8a8a8a' : '#555555'; COL['C'] = cElem.col; }
    if (hElem) { hElem.col = app.dark ? '#cccccc' : '#999999'; COL['H'] = hElem.col; }
    draw();
}

/* ══════════════════════════════════════════════════════════
   UI UPDATE FUNCTIONS
   ══════════════════════════════════════════════════════════ */
export function updateUndoRedoUI() {
    document.getElementById('btn-undo').disabled = app.historyIdx <= 0;
    document.getElementById('btn-redo').disabled = app.historyIdx >= app.history.length - 1;
}

export function updateModePill() {
    const p = document.getElementById('mode-pill'), t = p.querySelector('.mode-text');
    p.className = ''; p.id = 'mode-pill';
    if (app.currentMode === 'move')       { p.classList.add('vis','mp-edit');   t.textContent = 'MOVE / ROTATE'; }
    else if (app.currentMode === 'poly')  { p.classList.add('vis','mp-select'); t.textContent = 'POLYHEDRON'; }
    else if (app.currentMode === 'add') {
        if (app.addSubMode === 'delete')  { p.classList.add('vis','mp-edit');   t.textContent = 'DELETE TOOL'; }
        else                              { p.classList.add('vis','mp-add');    t.textContent = 'ADD ' + app.addElement; }
    }
    else if (app.currentMode === 'bonds') { p.classList.add('vis','mp-bonds'); t.textContent = 'EDIT BONDS'; }
    else p.classList.remove('vis');
}

export function updateSelUI() {
    const bar = document.getElementById('sel-bar'), chips = document.getElementById('sel-chips');
    const pb  = document.getElementById('sel-plane');
    const selStatus = document.getElementById('status-sel');
    if (app.currentMode !== 'poly' && app.currentMode !== 'move') {
        bar.classList.remove('vis'); selStatus.textContent = ''; return;
    }
    if (app.currentMode === 'poly') {
        bar.classList.add('vis'); chips.innerHTML = '';
        app.selectedAtoms.forEach((id, i) => {
            const a = app.atoms.find(x => x.id === id); if (!a) return;
            const c = document.createElement('span'); c.className = 'sel-chip';
            c.innerHTML = `<span class="dot" style="background:${getCOL(a.t)}"></span>${a.t}#${id}<button onclick="desel(${i})">×</button>`;
            chips.appendChild(c);
        });
        document.getElementById('sel-label').textContent = app.selectedAtoms.length < 3 ? `Select ${3 - app.selectedAtoms.length} more:` : 'Atoms:';
        pb.style.display = app.selectedAtoms.length >= 3 ? '' : 'none';
        if (app.selectedAtoms.length >= 3) {
            selStatus.textContent = math.describeGeom(app.selectedAtoms, id => app.atomById.get(id)) + ` (${app.selectedAtoms.length} atoms)`;
        } else selStatus.textContent = '';
    }
    if (app.currentMode === 'move') {
        if (app.editSelected.length > 0) {
            bar.classList.add('vis'); chips.innerHTML = '';
            app.editSelected.forEach((id, i) => {
                const a = app.atoms.find(x => x.id === id); if (!a) return;
                const c = document.createElement('span'); c.className = 'sel-chip';
                let bgCol = getCOL(a.t);
                if (app.editSelected.length === 2) bgCol = (i === 0) ? _varColor('--red') : _varColor('--amber');
                c.innerHTML = `<span class="dot" style="background:${bgCol}"></span>${a.t}#${id}<button onclick="editDesel(${i})">×</button>`;
                chips.appendChild(c);
            });
            document.getElementById('sel-label').textContent = 'Selected:';
            pb.style.display = 'none'; selStatus.textContent = '';
        } else { bar.classList.remove('vis'); selStatus.textContent = ''; }
    }
}

export function updateUIHints() {
    const hint = document.getElementById('edit-hint');
    document.getElementById('edit-bar').classList.add('vis');
    if (app.currentMode === 'view') {
        document.getElementById('edit-bar').classList.remove('vis');
    } else if (app.currentMode === 'move') {
        if (app.editSelected.length === 0)
            hint.innerHTML = 'Click an atom (Pivot) to translate. Click a second (Target) to enable rotation.';
        else if (app.editSelected.length === 1)
            hint.innerHTML = 'Drag line handles to translate. Click another atom to calculate fragment and show rotation handles.';
        else if (app.editSelected.length === 2)
            hint.innerHTML = 'Drag line handles to translate, or the <b>Amber Ring</b> handles to rotate fragment.';
        else
            hint.innerHTML = 'Drag axis line handles to translate the entire selected group.';
    } else if (app.currentMode === 'poly') {
        document.getElementById('edit-bar').classList.remove('vis');
    } else if (app.currentMode === 'add') {
        if (app.addSubMode === 'delete') {
            hint.innerHTML = 'Click an atom or a bond line to delete it.';
        } else {
            if (app.addSourceAtom !== null)
                hint.innerHTML = `Drag an axis handle outwards to extrude a new ${app.addElement} atom.`;
            else
                hint.innerHTML = 'Click an existing atom to reveal extrusion axes.';
        }
    } else if (app.currentMode === 'bonds') {
        if (app.bondSelection.length === 1) hint.innerHTML = 'Click another atom to toggle the link.';
        else hint.innerHTML = 'Click two atoms to link or unlink them.';
    }
}

export function updateLegend() {
    const el = document.getElementById('plegend');
    if (!app.customGroups.length) { el.innerHTML = ''; return; }
    el.innerHTML = app.customGroups.map((cg, i) =>
        `<div class="pl-group"><span class="ps" style="background:${cg.color}33;border-color:${cg.color}"></span>` +
        `<span>${cg.isSphere ? `Cavity #${cg.cavityId} (r=${cg.r.toFixed(2)}Å)` : math.describeGeom(cg.ids, id => app.atomById.get(id))}</span>` +
        `<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--txt3);padding:0" onclick="rmGroup(${i})">×</button></div>`
    ).join('');
}

export function updateStats() {
    document.getElementById('s-natoms').textContent = app.atoms.length;
    document.getElementById('s-nbonds').textContent = app.bonds.length;

    const counts = {};
    app.atoms.forEach(a => { counts[a.t] = (counts[a.t] || 0) + 1; });
    const countsDiv = document.getElementById('s-element-counts');
    if (countsDiv) {
        countsDiv.innerHTML = Object.entries(counts)
            .map(([kind, num]) => `<span style="font-weight:600;color:${getCOL(kind)}">${kind}:${num}</span>`)
            .join(' &middot; ');
    }

    const cu = app.atoms.filter(a => a.t === 'Cu');
    if (cu.length >= 2) {
        document.getElementById('s-cucu').textContent =
            (math.v3dist([cu[0].x,cu[0].y,cu[0].z],[cu[1].x,cu[1].y,cu[1].z]) * 2).toFixed(2) + ' Å';
    } else {
        document.getElementById('s-cucu').textContent = '—';
    }

    const cuO = [];
    app.bonds.forEach(b => {
        const aA = app.atomById.get(b.a), aB = app.atomById.get(b.b); if (!aA || !aB) return;
        if ((aA.t==='Cu'&&aB.t==='O')||(aB.t==='Cu'&&aA.t==='O'))
            cuO.push(math.v3dist([aA.x,aA.y,aA.z],[aB.x,aB.y,aB.z]));
    });
    document.getElementById('s-cuo').textContent = cuO.length
        ? (cuO.reduce((s,v)=>s+v,0)/cuO.length*2).toFixed(2)+' Å' : '—';
}

export function buildColorRow() {
    const row = document.getElementById('color-row'); row.innerHTML = '';
    ELEMENTS.forEach(e => {
        const l = document.createElement('label'); l.className = 'cr';
        l.innerHTML = `<input type="color" value="${e.col}"><span>${e.sym}</span>`;
        l.querySelector('input').oninput = ev => { e.col = ev.target.value; COL[e.sym] = ev.target.value; draw(); };
        row.appendChild(l);
    });
}

export function buildElemPalette() {
    const pal = document.getElementById('elem-palette'); if (!pal) return;
    pal.innerHTML = '';
    ELEMENTS.forEach(e => {
        const d = document.createElement('div');
        d.className = 'elem-btn' + (app.addElement === e.sym ? ' selected' : '');
        d.innerHTML = `<span class="sym" style="color:${e.col}">${e.sym}</span><span class="num">${e.name.slice(0,4)}</span>`;
        d.onclick = () => { app.addElement = e.sym; buildElemPalette(); updateModePill(); updateUIHints(); };
        pal.appendChild(d);
    });
}

/* ══════════════════════════════════════════════════════════
   EXPORT / IMPORT / STORAGE
   ══════════════════════════════════════════════════════════ */
export function openExport() {
    document.getElementById('export-name').value = '';
    document.getElementById('modal-export').classList.add('open');
    setTimeout(() => document.getElementById('export-name').focus(), 80);
}

export function doExport() {
    const name = document.getElementById('export-name').value.trim() || 'HKUST-1 model';
    const json = serializeStructure(name);
    saveToStorage(name, json);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    a.click();
    closeModals();
}

export async function openImport() {
    document.getElementById('file-input').value = '';
    const list = document.getElementById('saved-list');
    const saved = await listSaved();
    if (saved.length) {
        list.innerHTML = saved.map(n =>
            `<div class="saved-item" onclick="loadSaved('${n.replace(/'/g,"\\'")}')">` +
            `<span class="si-name">${n}</span>` +
            `<button class="si-del" onclick="event.stopPropagation();deleteSaved('${n.replace(/'/g,"\\'")}')">×</button></div>`
        ).join('');
        document.getElementById('import-saved-section').style.display = '';
    } else {
        list.innerHTML = '<div style="font:400 11px/1.3 var(--font);color:var(--txt3);padding:6px 0">No saved structures yet.</div>';
        document.getElementById('import-saved-section').style.display = '';
    }
    document.getElementById('import-status').textContent = '';
    document.getElementById('import-status').classList.remove('show');
    document.getElementById('modal-import').classList.add('open');

    document.getElementById('file-input').onchange = function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                if (ext === '.xyz')       parseXYZ(ev.target.result);
                else if (ext === '.mol')  parseMOL(ev.target.result);
                else if (ext === '.cif')  parseCIF(ev.target.result);
                else                      loadStructureFromJSON(ev.target.result);
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                setStructureName(baseName);
                afterImport();
            } catch(err) {
                const st = document.getElementById('import-status');
                st.textContent = 'Error: ' + err.message;
                st.style.color = 'var(--red)';
                st.classList.add('show');
            }
        };
        reader.readAsText(file);
    };
}

export async function loadSaved(name) {
    const json = await loadFromStorage(name); if (!json) return;
    try { loadStructureFromJSON(json); setStructureName(name); afterImport(); closeModals(); } catch(e) {}
}

export async function deleteSaved(name) {
    await deleteFromStorage(name);
    openImport();
}

export function closeModals() {
    document.querySelectorAll('.modal-bg').forEach(m => m.classList.remove('open'));
}

const DEFAULT_STRUCTURE_NAME = '';

function setStructureName(name) {
    app.structureName = name || DEFAULT_STRUCTURE_NAME;
}

/* Called after any import (file, saved, CIF, XYZ, MOL) */
function afterImport() {
    syncSlidersFromState();
    setMode('view');
    buildColorRow(); updateLegend(); updateStats(); draw();
    app.history = []; app.historyIdx = -1;
    saveState(); updateUndoRedoUI();
    closeModals();
}

/* Called after undo / redo */
export function afterUndoRedo() {
    updateSelUI(); updateUIHints(); updateLegend(); updateStats(); draw(); updateUndoRedoUI();
}

/** Sync all DOM slider values from current app state */
function syncSlidersFromState() {
    document.getElementById('zoom').value     = app.zoomVal;
    document.getElementById('zv').textContent = Math.round(app.zoomVal);
    document.getElementById('asize').value    = app.atomScale * 100;
    document.getElementById('asv').textContent = Math.round(app.atomScale * 100) + '%';
    document.getElementById('faceOpac').value  = app.faceAlpha * 100;
    document.getElementById('fov').textContent  = Math.round(app.faceAlpha * 100) + '%';
    document.getElementById('showBonds').checked  = app.showBonds;
    document.getElementById('showLabels').checked = app.showLabels;
    document.getElementById('autoRot').checked    = false;
    app.autoRotate = false;
}

/* ══════════════════════════════════════════════════════════
   POLY-MODE / GROUP ACTIONS
   ══════════════════════════════════════════════════════════ */
export function desel(i) { app.selectedAtoms.splice(i, 1); updateSelUI(); draw(); }

export function editDesel(i) {
    app.editSelected.splice(i, 1);
    app.currentAxes = app.editSelected.length ? computeEditAxes(app.editSelected) : [];
    app.hoveredAxisIdx = -1;
    updateSelUI(); updateUIHints(); draw();
}

export function rmGroup(i) { app.customGroups.splice(i, 1); updateLegend(); draw(); saveState(); }

/* ══════════════════════════════════════════════════════════
   CUSTOM ELEMENT
   ══════════════════════════════════════════════════════════ */
export function openCustomElem() {
    document.getElementById('ce-sym').value = '';
    document.getElementById('ce-name').value = '';
    document.getElementById('modal-elem').classList.add('open');
}

export function addCustomElem() {
    const sym  = document.getElementById('ce-sym').value.trim();
    const name = document.getElementById('ce-name').value.trim() || sym;
    const col  = document.getElementById('ce-col').value;
    const rad  = parseFloat(document.getElementById('ce-rad').value) || 7;
    if (!sym) return;
    if (ELEMENTS.find(e => e.sym === sym)) { closeModals(); return; }
    ELEMENTS.push({ sym, name, col, rad, roles: { [sym]: [name, 'Custom element'] } });
    COL[sym] = col;
    buildColorRow();
    if (app.currentMode === 'add') buildElemPalette();
    closeModals();
}

/* ══════════════════════════════════════════════════════════
   PLANES / PRESETS / VIEW
   ══════════════════════════════════════════════════════════ */
export function setPlane(p) {
    app.activePlane = p;
    document.querySelectorAll('#tp-presets .btn[id^="v-"]').forEach(b => b.classList.remove('on'));
    const el = document.getElementById('v-' + p); if (el) el.classList.add('on');
    document.getElementById('commit-preset-row').style.display = (p !== 'none') ? '' : 'none';
    draw();
}

export function commitPreset() {
    if (app.activePlane === 'none') return;
    if (app.activePlane === 'cavities') {
        getCavitySpheres().forEach(s => { app.customGroups.push({ ...s, idx: Date.now() }); });
    } else {
        const color = PRESET_COL[app.activePlane];
        getPlaneGroups(app.activePlane).forEach(ids => {
            app.customGroups.push({ ids, color, idx: Date.now() });
        });
    }
    setPlane('none');
    updateLegend(); draw(); saveState();
}

export function setView(yD, xD) {
    app.angleY = yD * Math.PI / 180;
    app.angleX = xD * Math.PI / 180;
    app.autoRotate = false;
    document.getElementById('autoRot').checked = false;
    draw();
}

export async function resetStructure() {
    if (!confirm('Reset to default HKUST-1?')) return;
    const resp = await fetch('model/HKUST-1-Cu-2BTC-4.json');
    if (resp.ok) loadStructureFromJSON(await resp.text());
    setStructureName(DEFAULT_STRUCTURE_NAME);
    app.customGroups = [];
    app.angleY    = 35 * Math.PI / 180;
    app.angleX    = 20 * Math.PI / 180;
    app.zoomVal   = 72;
    app.atomScale = 1;
    app.autoRotate = true;
    app.showBonds  = true;
    app.showLabels = false;
    app.faceAlpha  = 0.18;
    app.activePlane = 'none';
    document.getElementById('zoom').value       = 72;
    document.getElementById('zv').textContent   = '72';
    document.getElementById('asize').value      = 100;
    document.getElementById('asv').textContent  = '100%';
    document.getElementById('faceOpac').value   = 18;
    document.getElementById('fov').textContent   = '18%';
    document.getElementById('autoRot').checked   = true;
    document.getElementById('showBonds').checked  = true;
    document.getElementById('showLabels').checked = false;
    buildColorRow();
    setPlane('none');
    setMode('view');
    updateLegend(); updateStats(); draw(); saveState();
}

/* ══════════════════════════════════════════════════════════
   PNG EXPORT
   ══════════════════════════════════════════════════════════ */
export function exportPNG() {
    const canvas = getCanvas();
    const wasAutoRotate = app.autoRotate;
    app.autoRotate = false;
    draw();
    const off = document.createElement('canvas');
    off.width  = canvas.width;
    off.height = canvas.height;
    const offCtx = off.getContext('2d');
    offCtx.fillStyle = app.dark ? '#1f2937' : '#f9f9fa';
    offCtx.fillRect(0, 0, off.width, off.height);
    offCtx.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = 'HKUST-1_structure.png';
    link.href = off.toDataURL('image/png');
    link.click();
    app.autoRotate = wasAutoRotate;
}

/* ══════════════════════════════════════════════════════════
   CANVAS EVENT HANDLERS
   ══════════════════════════════════════════════════════════ */
function onMouseDown(e) {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const atomHit = hitTest(mx, my);

    /* ── Edit-mode axis drag start ── */
    if (app.currentMode === 'move' && app.currentAxes.length > 0) {
        const ai = hitAxisTest(mx, my);
        if (ai >= 0 && (!atomHit || app.editSelected.includes(atomHit.id))) {
            app.editDragging = true; app.editAxis = ai; app.editDragStart = { mx, my };
            app.dragStartAtomPositions = {};
            if (app.currentAxes[ai].type === 'translate') {
                app.editSelected.forEach(id => {
                    const a = app.atomById.get(id); if (a) app.dragStartAtomPositions[id] = { x:a.x, y:a.y, z:a.z };
                });
            } else if (app.currentAxes[ai].type === 'rotate') {
                app.currentAxes[ai].rotatingGroup.forEach(id => {
                    const a = app.atomById.get(id); if (a) app.dragStartAtomPositions[id] = { x:a.x, y:a.y, z:a.z };
                });
            }
            app.autoRotate = false; document.getElementById('autoRot').checked = false;
            canvas.style.cursor = 'none'; return;
        }
    }

    /* ── Add-mode axis drag / extrude start ── */
    if (app.currentMode === 'add' && app.addSubMode === 'add' && app.addSourceAtom !== null) {
        const ai = hitAxisTest(mx, my);
        if (ai >= 0 && (!atomHit || atomHit.id === app.addSourceAtom)) {
            const src = app.atomById.get(app.addSourceAtom);
            const ax  = app.currentAxes[ai];
            const newId = app.aid;
            const newAtom = {
                x: src.x + ax.dir[0]*1.4, y: src.y + ax.dir[1]*1.4, z: src.z + ax.dir[2]*1.4,
                t: app.addElement, role: app.addElement, plane: '', id: app.aid++
            };
            app.atoms.push(newAtom);
            app.atomById.set(newId, newAtom);
            app.bonds.push({ a: app.addSourceAtom, b: newId, dashed: false });
            app.structureVersion++; app.drawGroupsCache = null;
            updateStats();

            app.editDragging = true; app.dragMockAxis = { dir: ax.dir };
            app.dragAtomId = newId; app.editDragStart = { mx, my };
            app.dragStartAtomPositions = {};
            app.dragStartAtomPositions[newId] = { x: newAtom.x, y: newAtom.y, z: newAtom.z };
            app.autoRotate = false; document.getElementById('autoRot').checked = false;
            canvas.style.cursor = 'none'; return;
        }
    }

    app.clickOk = true; app.cx0 = e.clientX; app.cy0 = e.clientY;
    app.dragging = true; app.lastMX = e.clientX; app.lastMY = e.clientY;
    document.getElementById('tip').style.opacity = '0';
}

function onMouseUp(e) {
    const canvas = getCanvas();
    const wc = app.clickOk && Math.abs(e.clientX - app.cx0) < 4 && Math.abs(e.clientY - app.cy0) < 4;

    if (app.editDragging) {
        if (wc && app.currentMode === 'move') {
            /* click on axis handle without drag — restore positions */
            for (const id in app.dragStartAtomPositions) {
                const sp = app.dragStartAtomPositions[id];
                const aT = app.atomById.get(parseInt(id));
                if (aT) { aT.x = sp.x; aT.y = sp.y; aT.z = sp.z; }
            }
            app.editDragging = false; app.editAxis = null; app.editDragStart = null;
            canvas.style.cursor = app.currentMode === 'view' ? 'grab' : 'crosshair';
            document.getElementById('axis-tip').style.opacity = '0';
            document.getElementById('snap-indicator').style.opacity = '0';
            draw();
        } else {
            app.editDragging = false; app.editAxis = null; app.editDragStart = null;
            app.activeSnapGuides = [];
            canvas.style.cursor = app.currentMode === 'view' ? 'grab' : 'crosshair';
            document.getElementById('axis-tip').style.opacity = '0';
            document.getElementById('snap-indicator').style.opacity = '0';

            if (app.currentMode === 'add') {
                app.addSourceAtom = app.dragAtomId;
                app.currentAxes = computeAddAxes(app.addSourceAtom);
            } else if (app.currentMode === 'move') {
                app.currentAxes = computeEditAxes(app.editSelected);
            }
            updateStats(); updateUIHints(); draw();
            saveState(); updateUndoRedoUI();
        }
        app.dragging = false; app.clickOk = false;
        return;
    }

    app.dragging = false; app.clickOk = false;
    if (wc) {
        const rect = getCanvas().getBoundingClientRect();
        handleHitClick(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey);
    }
}

function onMouseMove(e) {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    // `rect` is also used below for tooltip overflow guards — it is defined above.
    app.currentMX = mx; app.currentMY = my;

    /* ── Axis drag: translate or rotate ── */
    if (app.editDragging) {
        const isAdd = app.currentMode === 'add';
        const isTranslate = isAdd || app.currentAxes[app.editAxis].type === 'translate';

        if (isTranslate) {
            const axDir   = isAdd ? app.dragMockAxis.dir : app.currentAxes[app.editAxis].dir;
            const dragIds = isAdd ? [app.dragAtomId] : app.editSelected;
            const origin  = isAdd
                ? [app.dragStartAtomPositions[app.dragAtomId].x, app.dragStartAtomPositions[app.dragAtomId].y, app.dragStartAtomPositions[app.dragAtomId].z]
                : app.currentAxes[app.editAxis].origin;

            const { project } = _projFn();
            const p0   = project(...origin);
            const pEnd = project(origin[0]+axDir[0], origin[1]+axDir[1], origin[2]+axDir[2]);
            const sdx  = pEnd.sx-p0.sx, sdy = pEnd.sy-p0.sy;
            const slen = Math.sqrt(sdx*sdx+sdy*sdy)||1;
            const dirX = sdx/slen, dirY = sdy/slen;

            const mdx = mx - app.editDragStart.mx, mdy = my - app.editDragStart.my;
            const prj  = mdx*dirX + mdy*dirY, speed = 0.012;
            const delta3d = math.v3scale(axDir, prj*speed);

            let anySnapped = false, lastSnapLabel = '';
            let finalDelta = [...delta3d];
            app.activeSnapGuides = [];

            for (const id of dragIds) {
                const sp = app.dragStartAtomPositions[id]; if (!sp) continue;
                const snap = trySnap(id, [sp.x+delta3d[0], sp.y+delta3d[1], sp.z+delta3d[2]], axDir);
                if (snap.snapped) {
                    finalDelta = math.v3sub(snap.pos, [sp.x, sp.y, sp.z]);
                    anySnapped = true; lastSnapLabel = snap.label;
                    if (snap.guide) app.activeSnapGuides.push(snap.guide);
                    break;
                }
            }

            dragIds.forEach(id => {
                const sp = app.dragStartAtomPositions[id]; if (!sp) return;
                const aT = app.atomById.get(id);
                if (aT) { aT.x = sp.x+finalDelta[0]; aT.y = sp.y+finalDelta[1]; aT.z = sp.z+finalDelta[2]; }
            });

            /* Auto-relaxation */
            if (app.autoRelax && app.currentMode === 'move') {
                const K = 0.5, damping = 0.5;
                const neighborsToRelax = new Set();
                dragIds.forEach(id => getNeighbors(id).forEach(n => { if (!dragIds.includes(n)) neighborsToRelax.add(n); }));
                neighborsToRelax.forEach(nid => {
                    const nAtom = app.atomById.get(nid); if (!nAtom) return;
                    if (!nAtom.vel) nAtom.vel = [0,0,0];
                    if (!nAtom.origNeighborsDist) {
                        nAtom.origNeighborsDist = {};
                        getNeighbors(nid).forEach(nn => {
                            const nnAtom = app.atomById.get(nn); if (!nnAtom) return;
                            nAtom.origNeighborsDist[nn] = app.dragStartAtomPositions[nn]
                                ? math.v3dist([app.dragStartAtomPositions[nn].x, app.dragStartAtomPositions[nn].y, app.dragStartAtomPositions[nn].z], [nAtom.x, nAtom.y, nAtom.z])
                                : math.v3dist([nnAtom.x, nnAtom.y, nnAtom.z], [nAtom.x, nAtom.y, nAtom.z]);
                        });
                    }
                    let force = [0,0,0];
                    getNeighbors(nid).forEach(nn => {
                        const nnAtom = app.atomById.get(nn); if (!nnAtom) return;
                        const dVec = math.v3sub([nnAtom.x,nnAtom.y,nnAtom.z],[nAtom.x,nAtom.y,nAtom.z]);
                        const dLen = math.v3len(dVec)||0.001;
                        const targetLen = nAtom.origNeighborsDist[nn]||1.5;
                        const fMag = (dLen-targetLen)*K;
                        force = math.v3add(force, math.v3scale(math.v3norm(dVec), fMag));
                    });
                    nAtom.vel = math.v3scale(math.v3add(nAtom.vel, force), damping);
                    nAtom.x += nAtom.vel[0]; nAtom.y += nAtom.vel[1]; nAtom.z += nAtom.vel[2];
                });
            }

            const si = document.getElementById('snap-indicator');
            if (anySnapped) {
                si.textContent = '⊙ '+lastSnapLabel; si.style.opacity = '1';
                si.style.left = (mx+20)+'px'; si.style.top = (my+16)+'px';
            } else si.style.opacity = '0';

            const atip = document.getElementById('axis-tip');
            const col = AXIS_COLORS[(isAdd ? 0 : app.editAxis) % AXIS_COLORS.length];
            atip.style.background = col; atip.style.color = '#fff'; atip.style.opacity = '1';
            atip.style.left = (mx+16)+'px'; atip.style.top = (my-8)+'px';
            atip.textContent = 'Δ'+(math.v3len(finalDelta)).toFixed(3)+' Å';

        } else {
            /* Rotate */
            const ax = app.currentAxes[app.editAxis];
            const angle = ((mx - app.editDragStart.mx) - (my - app.editDragStart.my)) * 0.015;
            ax.rotatingGroup.forEach(id => {
                const sp = app.dragStartAtomPositions[id]; if (!sp) return;
                const newPos = math.rotatePoint([sp.x,sp.y,sp.z], ax.axisOrigin, ax.dir, angle);
                const aT = app.atomById.get(id);
                if (aT) { aT.x = newPos[0]; aT.y = newPos[1]; aT.z = newPos[2]; }
            });
            const atip = document.getElementById('axis-tip');
            atip.style.background = _varColor('--amber'); atip.style.color = '#fff'; atip.style.opacity = '1';
            atip.style.left = (mx+16)+'px'; atip.style.top = (my-8)+'px'; atip.textContent = 'Rotated';
        }
        draw(); return;
    }

    /* ── Orbit drag ── */
    if (app.dragging && (Math.abs(e.clientX-app.cx0) > 3 || Math.abs(e.clientY-app.cy0) > 3)) app.clickOk = false;
    if (app.dragging) {
        app.angleY += (e.clientX - app.lastMX) * 0.008;
        app.angleX += (e.clientY - app.lastMY) * 0.008;
        app.angleX = Math.max(-Math.PI/2, Math.min(Math.PI/2, app.angleX));
        app.lastMX = e.clientX; app.lastMY = e.clientY;
        draw(); return;
    }

    /* ── Hover / tooltip ── */
    app.hoveredAtom = null; app.hoveredBond = -1;

    if (app.currentMode === 'move' || (app.currentMode === 'add' && app.addSubMode === 'add')) {
        const ai = hitAxisTest(mx, my);
        if (ai !== app.hoveredAxisIdx) { app.hoveredAxisIdx = ai; draw(); }
        if (ai >= 0) {
            const atomHit = hitTest(mx, my);
            if (!atomHit
                || (app.currentMode === 'move' && app.editSelected.includes(atomHit.id))
                || (app.currentMode === 'add'  && app.addSourceAtom === atomHit.id)) {
                canvas.style.cursor = 'pointer';
                document.getElementById('tip').style.opacity = '0';
                const atip = document.getElementById('axis-tip');
                const col = app.currentAxes[ai].type === 'rotate' ? _varColor('--amber') : AXIS_COLORS[ai % AXIS_COLORS.length];
                atip.style.background = col; atip.style.color = '#fff'; atip.style.opacity = '1';
                atip.style.left = (mx+14)+'px'; atip.style.top = (my-8)+'px';
                atip.textContent = app.currentAxes[ai].label;
                return;
            }
        } else document.getElementById('axis-tip').style.opacity = '0';
    }

    const hit    = hitTest(mx, my);
    const hBond  = hit ? -1 : hitBondTest(mx, my);
    const hCav   = (hit === null && hBond === -1) ? hitCavityTest(mx, my) : null;

    const tip = document.getElementById('tip');
    if (hit) {
        app.hoveredAtom = hit.id; app.hoveredBond = -1;
        const info = getNAME(hit.role) || [hit.t, ''];
        tip.innerHTML = `<div class="en">${info[0]||hit.t} #${hit.id}</div>`;
        tip.style.opacity = '1';
        let tx = mx+14, ty = my-10;
        if (tx + 180 > rect.width) tx = mx-120; if (ty < 0) ty = 10;
        tip.style.left = tx+'px'; tip.style.top = ty+'px';
        const parts = [`${info[0]||hit.t} #${hit.id}`];
        if (info[1]) parts.push(info[1]);
        parts.push(`(${hit.x.toFixed(3)}, ${hit.y.toFixed(3)}, ${hit.z.toFixed(3)}) Å`);
        document.getElementById('status-hover').textContent = parts.join(' · ');
    } else if (hBond >= 0) {
        app.hoveredAtom = null; app.hoveredBond = hBond;
        const b = app.bonds[hBond];
        const a1 = app.atomById.get(b.a), a2 = app.atomById.get(b.b);
        if (a1 && a2) {
            tip.innerHTML = `<div class="en">${a1.t}#${a1.id} – ${a2.t}#${a2.id}</div>`;
            tip.style.opacity = '1';
            let tx = mx+14, ty = my-10;
            if (tx+180 > rect.width) tx = mx-150; if (ty < 0) ty = 10;
            tip.style.left = tx+'px'; tip.style.top = ty+'px';
            const len = math.v3dist([a1.x,a1.y,a1.z],[a2.x,a2.y,a2.z]);
            document.getElementById('status-hover').textContent = `Bond ${a1.t}#${a1.id} – ${a2.t}#${a2.id} · ${len.toFixed(3)} Å`;
        }
    } else if (hCav) {
        app.hoveredAtom = null; app.hoveredBond = -1;
        tip.innerHTML = `<div class="en">Cavity #${hCav.cavityId}</div>`;
        tip.style.opacity = '1';
        let tx = mx+14, ty = my-10;
        if (tx+180 > rect.width) tx = mx-150; if (ty < 0) ty = 10;
        tip.style.left = tx+'px'; tip.style.top = ty+'px';
        document.getElementById('status-hover').textContent = `Cavity #${hCav.cavityId} · r = ${hCav.r.toFixed(2)} Å · center (${hCav.cx.toFixed(2)}, ${hCav.cy.toFixed(2)}, ${hCav.cz.toFixed(2)}) Å`;
    } else {
        tip.style.opacity = '0';
        document.getElementById('status-hover').textContent = '';
    }

    let cursor = 'grab';
    if (app.currentMode === 'view')
        cursor = (hit || hBond >= 0 || hCav) ? 'pointer' : 'grab';
    else if (app.currentMode === 'add' && app.addSubMode === 'delete')
        cursor = (hit || hBond >= 0) ? 'pointer' : 'crosshair';
    else
        cursor = hit ? 'pointer' : 'crosshair';
    canvas.style.cursor = cursor;

    draw();
}

function onMouseLeave() {
    const canvas = getCanvas();
    app.currentMX = -1000; app.currentMY = -1000;
    app.hoveredAtom = null; app.hoveredAxisIdx = -1; app.hoveredBond = -1;
    document.getElementById('tip').style.opacity = '0';
    document.getElementById('axis-tip').style.opacity = '0';
    document.getElementById('status-hover').textContent = '';
    draw();
}

function onWheel(e) {
    e.preventDefault();
    app.zoomVal = Math.max(30, Math.min(160, app.zoomVal - e.deltaY * 0.08));
    document.getElementById('zoom').value      = app.zoomVal;
    document.getElementById('zv').textContent  = Math.round(app.zoomVal);
    draw();
}

/* ── Touch ── */
function onTouchStart(e) {
    e.preventDefault();
    app.dragging = true;
    app.lastMX = e.touches[0].clientX; app.lastMY = e.touches[0].clientY;
    app.clickOk = true; app.cx0 = app.lastMX; app.cy0 = app.lastMY;
}

function onTouchEnd(e) {
    const wc = app.clickOk && e.changedTouches
        && Math.abs(e.changedTouches[0].clientX - app.cx0) < 10
        && Math.abs(e.changedTouches[0].clientY - app.cy0) < 10;
    app.dragging = false; app.clickOk = false;
    if (wc) {
        const rect = getCanvas().getBoundingClientRect();
        handleHitClick(e.changedTouches[0].clientX - rect.left, e.changedTouches[0].clientY - rect.top, false);
    }
}

function onTouchMove(e) {
    if (!app.dragging) return;
    app.clickOk = false;
    app.angleY += (e.touches[0].clientX - app.lastMX) * 0.008;
    app.angleX += (e.touches[0].clientY - app.lastMY) * 0.008;
    app.angleX = Math.max(-Math.PI/2, Math.min(Math.PI/2, app.angleX));
    app.lastMX = e.touches[0].clientX; app.lastMY = e.touches[0].clientY;
    draw();
}

/* ── Keyboard ── */
function onKeyDown(e) {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
        afterUndoRedo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); afterUndoRedo(); return; }

    if (e.key === 'Escape') {
        const anyModal = document.querySelector('.modal-bg.open');
        if (anyModal) { closeModals(); return; }
        if (app.currentMode !== 'view') setMode('view');
    }

    if (e.key.toLowerCase() === 'v') setMode('view');
    if (e.key.toLowerCase() === 'e') setMode('move');
    if (e.key.toLowerCase() === 's') setMode('poly');
    if (e.key.toLowerCase() === 'a') { setMode('add'); setAddSubMode('add'); }
    if (e.key.toLowerCase() === 'd') { setMode('add'); setAddSubMode('delete'); }
    if (e.key.toLowerCase() === 'b') setMode('bonds');

    if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = [...(app.currentMode === 'move' ? app.editSelected : app.selectedAtoms)];
        if (sel.length > 0) {
            sel.forEach(id => deleteAtom(id, true));
            app.currentAxes = app.editSelected.length ? computeEditAxes(app.editSelected) : [];
            updateStats(); updateSelUI(); updateLegend(); draw();
            saveState(); updateUndoRedoUI();
        }
    }
}

/* ══════════════════════════════════════════════════════════
   HIT-CLICK DISPATCH
   ══════════════════════════════════════════════════════════ */
function handleHitClick(mx, my, isShift) {
    const hit = hitTest(mx, my);

    if (app.currentMode === 'add') {
        if (app.addSubMode === 'delete') {
            if (hit) { deleteAtom(hit.id); updateStats(); updateSelUI(); updateLegend(); saveState(); updateUndoRedoUI(); }
            else {
                const bIdx = hitBondTest(mx, my);
                if (bIdx >= 0) {
                    app.bonds.splice(bIdx, 1); app.structureVersion++; app.drawGroupsCache = null;
                    app.hoveredBond = -1;
                    updateStats(); saveState(); updateUndoRedoUI();
                }
            }
        } else {
            if (hit) { app.addSourceAtom = hit.id; app.currentAxes = computeAddAxes(app.addSourceAtom); }
            else { app.addSourceAtom = null; app.currentAxes = []; }
            updateUIHints();
        }
    } else if (app.currentMode === 'bonds') {
        if (hit) {
            const idx = app.bondSelection.indexOf(hit.id);
            if (idx >= 0) { app.bondSelection.splice(idx, 1); }
            else {
                app.bondSelection.push(hit.id);
                if (app.bondSelection.length === 2) {
                    toggleBond(app.bondSelection[0], app.bondSelection[1]);
                    app.bondSelection = [];
                    updateStats(); saveState(); updateUndoRedoUI();
                }
            }
        } else { app.bondSelection = []; }
        updateUIHints();
    } else if (app.currentMode === 'move') {
        if (hit) {
            const idx = app.editSelected.indexOf(hit.id);
            if (idx >= 0) app.editSelected.splice(idx, 1);
            else app.editSelected.push(hit.id);
            app.currentAxes = app.editSelected.length ? computeEditAxes(app.editSelected) : [];
        } else { app.editSelected = []; app.currentAxes = []; }
        app.hoveredAxisIdx = -1;
        updateSelUI(); updateUIHints();
    } else if (app.currentMode === 'poly') {
        if (hit) {
            const idx = app.selectedAtoms.indexOf(hit.id);
            if (idx >= 0) app.selectedAtoms.splice(idx, 1); else app.selectedAtoms.push(hit.id);
            updateSelUI();
        }
    }
    draw();
}

/* ══════════════════════════════════════════════════════════
   PRIVATE HELPERS
   ══════════════════════════════════════════════════════════ */
function _varColor(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

/**
 * Returns a project() fn that uses current app state.
 * renderer.js owns the actual implementation; we replicate here only for
 * the drag-direction calculation in onMouseMove, which needs to project
 * a world-space axis to screen-space.
 */
function _projFn() {
    const canvas = getCanvas();
    return {
        project: (x, y, z) => math.project(x, y, z, app.angleY, app.angleX, app.zoomVal, canvas.clientWidth, canvas.clientHeight)
    };
}
