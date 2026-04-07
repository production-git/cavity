/** @type {import('jest').Config} */
export default {
  // Use Node VM module mode required for native ESM
  testEnvironment: 'node',
  transform: {},   // no Babel — source is plain ES modules

  // Run per-test setup (DOM mocks needed before module evaluation)
  setupFiles: ['./jest.setup.js'],

  // Only run unit + integration tests via `npm test`
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
  ],

  // Coverage
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'app/math3d.js',
    'app/state.js',
    'app/renderer.js',
  ],
  coverageThreshold: {
    // Global bar — renderer.js visual drawing paths are covered by Playwright E2E,
    // so we accept a slightly lower combined threshold here.
    global:             { lines: 75, functions: 75, branches: 60, statements: 75 },
    // Per-file guards for the pure-logic modules
    './app/math3d.js':  { lines: 90, functions: 100, branches: 80, statements: 90 },
    './app/state.js':   { lines: 80, functions: 80, branches: 70, statements: 80 },
  },
  coverageReporters: ['text', 'lcov'],
};
