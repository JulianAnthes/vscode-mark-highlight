import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Spec files live next to the implementation they cover.
        include: ['src/**/*.spec.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            // Measure the whole extension, not just the unit-tested core.
            // `all: true` reports every source file — including the
            // vscode-coupled layer (extension.ts, decorations, providers)
            // that can't run outside an extension host — so the numbers
            // reflect real coverage instead of a misleading 100%.
            include: ['src/**'],
            exclude: ['**/*.spec.{ts,tsx}'],
            all: true,
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: 'coverage',
        },
    },
});
