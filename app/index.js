/**
 * index.js — Application entry point (Phase 2a).
 *
 * Responsibilities:
 *  1. Init renderer (canvas + resize listener)
 *  2. Init UI (event bindings)
 *  3. Attach all functions called from HTML onclick attributes to window
 *  4. Run initial build + first draw
 *  5. Start the animation loop
 */

import { app, loadStructureFromJSON, saveState } from './state.js';
import { init as rendererInit, resize, draw } from './renderer.js';
import {
    init as uiInit,
    setMode, setAddSubMode,
    toggleTheme,
    updateUndoRedoUI, updateModePill, updateSelUI, updateUIHints,
    updateLegend, updateStats,
    buildColorRow, buildElemPalette,
    openExport, doExport, openImport, loadSaved, deleteSaved, closeModals,
    desel, editDesel, rmGroup,
    openCustomElem, addCustomElem,
    setPlane, commitPreset, setView,
    resetStructure, exportPNG,
    afterUndoRedo, toggleMobileStats,
} from './ui.js';
import { undo, redo } from './state.js';

/* ══════════════════════════════════════════════════════════
   RENDERER INIT
   ══════════════════════════════════════════════════════════ */
const canvas = document.getElementById('mol');
rendererInit(canvas);
resize();
window.addEventListener('resize', () => { resize(); draw(); });

/* ══════════════════════════════════════════════════════════
   UI INIT (binds all canvas + DOM events)
   ══════════════════════════════════════════════════════════ */
uiInit();

/* ══════════════════════════════════════════════════════════
   WINDOW GLOBALS  (called from HTML onclick="..." attributes)
   ══════════════════════════════════════════════════════════ */
window.setMode        = setMode;
window.setAddSubMode  = setAddSubMode;
window.toggleTheme    = toggleTheme;

window.undo = function() { undo(); afterUndoRedo(); };
window.redo = function() { redo(); afterUndoRedo(); };

window.openExport  = openExport;
window.doExport    = doExport;
window.openImport  = openImport;
window.loadSaved   = loadSaved;
window.deleteSaved = deleteSaved;
window.closeModals = closeModals;

window.desel        = desel;
window.editDesel    = editDesel;
window.rmGroup      = rmGroup;

window.openCustomElem = openCustomElem;
window.addCustomElem  = addCustomElem;

window.setPlane      = setPlane;
window.commitPreset  = commitPreset;
window.setView       = setView;
window.resetStructure = resetStructure;
window.exportPNG     = exportPNG;
window.toggleMobileStats = toggleMobileStats;

/* ══════════════════════════════════════════════════════════
   INITIAL STATE
   ══════════════════════════════════════════════════════════ */
// Apply saved theme preference
document.documentElement.setAttribute('data-theme', app.dark ? 'dark' : 'light');

/* ══════════════════════════════════════════════════════════
   ANIMATION LOOP
   ══════════════════════════════════════════════════════════ */
(function animate() {
    if (app.autoRotate) { app.angleY += 0.004; draw(); }
    requestAnimationFrame(animate);
})();

(async () => {
    const resp = await fetch('model/HKUST-1-Cu-2BTC-4.json');
    if (resp.ok) loadStructureFromJSON(await resp.text());
    saveState();
    setMode('view');
    buildColorRow();
    updateLegend();
    updateStats();
    setPlane('none');
    updateUndoRedoUI();
    draw();
})();
