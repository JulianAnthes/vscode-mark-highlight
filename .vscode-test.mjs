import { defineConfig } from '@vscode/test-cli';

// Thin real-host smoke suite: proves marks actually surface in a live VS Code
// Outline (the one thing unit tests can't reach). Compiled by tsconfig.test.json
// to out/ before this runs — see the pretest:integration script.
export default defineConfig({
    files: 'out/integration/**/*.test.js',
    version: 'stable',
    mocha: {
        ui: 'tdd',
        // tsserver has to start, load the bundled plugin, and answer a navtree
        // request, so give the slow TS case room before it's called a failure.
        timeout: 60000,
    },
});
