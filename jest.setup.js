/**
 * jest.setup.js — Global browser-API stubs.
 *
 * Runs via `setupFiles` BEFORE any test module is imported, so top-level
 * side-effects in state.js (matchMedia, localStorage, window.storage) are
 * covered by the time the module evaluates.
 */

// matchMedia — not available in Node or jsdom by default.
// state.js reads matchMedia('...').matches at module-evaluation time.
global.matchMedia = function matchMedia(query) {
  return {
    matches: false,
    media: query,
    addListener: function () {},
    removeListener: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () { return false; },
  };
};

// localStorage stub (used by saveToStorage / listSaved / loadFromStorage)
const _store = {};
global.localStorage = {
  getItem:    function (k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem:    function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
  clear:      function () { Object.keys(_store).forEach(k => delete _store[k]); },
  get length() { return Object.keys(_store).length; },
  key:        function (i) { return Object.keys(_store)[i] ?? null; },
};

// window — some branches in state.js check window.storage
if (typeof global.window === 'undefined') {
  global.window = global;
}
