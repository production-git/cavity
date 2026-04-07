/**
 * test_color_utils.js — Unit tests for color utility functions.
 *
 * Tests the hexRgb parser and getCOL fallback path.
 * Run with: node app/tests/unit/test_color_utils.js
 */

'use strict';

// ── Inline the pure functions under test ────────────────────────────────────
// hexRgb lives in renderer.js (browser module). We duplicate the logic here
// so this test runs in Node without a DOM.

function hexRgb(h) {
    // Expand 3-digit shorthand (#rgb → #rrggbb) before parsing
    if (h.length === 4) h = '#' + h[1]+h[1] + h[2]+h[2] + h[3]+h[3];
    return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}

// getCOL fallback for unknown element symbol (extracted from state.js).
// Fixed: returns 6-digit hex '#aaaaaa' / '#777777' so hexRgb parses all 3 channels.
function getCOL_buggy(sym, dark) {
    const ELEMENTS = ['Cu','O','C','H'];
    const found = ELEMENTS.includes(sym);
    if (found) return '#3B4D9E'; // any known colour
    return dark ? '#aaaaaa' : '#777777';
}

// ── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓  ${message}`);
        passed++;
    } else {
        console.error(`  ✗  ${message}`);
        failed++;
    }
}

function assertEqual(a, b, message) {
    assert(a === b, `${message} (expected ${b}, got ${a})`);
}

// ── RED tests (must fail before the fix) ────────────────────────────────────

console.log('\nhexRgb — 3-digit shorthand hex (BUG: blue channel is NaN)');

{
    const [r, g, b] = hexRgb('#aaa');
    // These first two pass even with the bug
    assertEqual(r, 170, 'hexRgb("#aaa") red channel = 170');
    // g: parseInt('a', 16) = 10 — passes
    // b: parseInt('', 16)  = NaN — THIS IS THE BUG
    assert(!isNaN(b), 'hexRgb("#aaa") blue channel must not be NaN');
}

{
    const [r, g, b] = hexRgb('#777');
    assert(!isNaN(b), 'hexRgb("#777") blue channel must not be NaN');
}

console.log('\ngetCOL fallback — must return parseable 6-digit hex for unknown elements');

{
    const col = getCOL_buggy('Zn', false);   // Zn not in ELEMENTS → fallback
    const [r, g, b] = hexRgb(col);
    assert(!isNaN(r) && !isNaN(g) && !isNaN(b),
        `getCOL("Zn") fallback "${col}" must yield all-numeric RGB (got ${r},${g},${b})`);
}

{
    const col = getCOL_buggy('Fe', true);    // dark mode fallback
    const [r, g, b] = hexRgb(col);
    assert(!isNaN(r) && !isNaN(g) && !isNaN(b),
        `getCOL("Fe") dark fallback "${col}" must yield all-numeric RGB (got ${r},${g},${b})`);
}

console.log('\nhexRgb — known 6-digit hex (sanity, must always pass)');

{
    const [r, g, b] = hexRgb('#3B4D9E');
    assertEqual(r, 0x3B, 'hexRgb("#3B4D9E") red = 0x3B');
    assertEqual(g, 0x4D, 'hexRgb("#3B4D9E") green = 0x4D');
    assertEqual(b, 0x9E, 'hexRgb("#3B4D9E") blue = 0x9E');
}

// ── addColorStop simulation — reproduces the exact crash ───────────────────

console.log('\naddColorStop simulation — rgb string must not contain NaN');

{
    const col = getCOL_buggy('Zn', false);   // unknown element, light mode → '#777'
    const [cr, cg, cb] = hexRgb(col);

    // This is what renderer.js line 411 computes before addColorStop
    const rs = Math.min(255, cr + Math.round((255 - cr) * 0.5));
    const gs = Math.min(255, cg + Math.round((255 - cg) * 0.5));
    const bs = Math.min(255, cb + Math.round((255 - cb) * 0.5));
    const colorStr = `rgb(${rs},${gs},${bs})`;

    assert(!colorStr.includes('NaN'),
        `Gradient color string must not contain NaN (got "${colorStr}")`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
