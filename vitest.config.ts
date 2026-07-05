import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Spec files live next to the implementation they cover.
        include: ['src/**/*.spec.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            // Measure the whole extension, not just the unit-tested core.
            // The `include` glob reports every source file — including the
            // vscode-coupled layer (extension.ts, decorations, providers)
            // that can't run outside an extension host — so the numbers
            // reflect real coverage instead of a misleading 100%.
            include: ['src/**'],
            // *.spec.ts are the unit tests; *.int-spec.ts are the integration
            // smokes that run in a real VS Code host (see .vscode-test.mjs),
            // not under vitest — neither is product code to be measured.
            exclude: ['**/*.spec.{ts,tsx}', '**/*.int-spec.{ts,tsx}'],
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: 'coverage',
        },
    },
});
