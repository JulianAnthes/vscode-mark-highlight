import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            // Only the pure core runs under Vitest — the vscode-coupled layer
            // (extension.ts, decorations, providers) needs an extension host
            // and is exercised by the integration suite instead. Scoping
            // coverage here keeps the numbers meaningful.
            include: ['src/core/**'],
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: 'coverage',
        },
    },
});
