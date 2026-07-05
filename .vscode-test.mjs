import { defineConfig } from '@vscode/test-cli';

// Thin real-host smoke suite: proves marks actually surface in a live VS Code
// Outline (the one thing unit tests can't reach). Compiled by tsconfig.test.json
// to out/ before this runs — see the pretest:integration script.
export default defineConfig({
    tests: [
        {
            files: 'out/**/*.int-spec.js',
            version: 'stable',
            mocha: {
                ui: 'tdd',
                // tsserver has to start, load the bundled plugin, and answer a
                // navtree request, so give the slow TS case room.
                timeout: 60000,
            },
        },
    ],
    // Coverage of the running extension. The host executes the bundled
    // dist/extension.js; c8 remaps it back to src/*.ts through the source map,
    // so this measures the vscode-coupled layer that vitest can't reach. Merged
    // with the vitest report at Codecov via separate flags. Output dir is set on
    // the CLI (--coverage-output). The raw report also picks up bundled
    // node_modules and the test file itself; those are dropped centrally by the
    // `ignore` list in codecov.yml (applied to every uploaded report).
    coverage: {
        reporter: ['lcov', 'text-summary'],
    },
});
