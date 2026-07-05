import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

// The plugin ships inside dist/ (that's what the vsix packages — vsce
// excludes node_modules with --no-dependencies). tsserver, however, resolves
// a typescriptServerPlugins contribution strictly from
// <extensionRoot>/node_modules/<pluginName>: at runtime the extension copies
// dist/ts-plugin there on activation (see ensureTsPluginInstalled), and this
// build step does the same for the F5 dev host so no restart is needed
// there. A rebuilt plugin is only picked up after "TypeScript: Restart TS
// Server".
const installPluginIntoNodeModules = () => {
    cpSync('plugin/package.json', 'dist/ts-plugin/package.json');
    const dest = 'node_modules/vscode-mark-highlight-ts-plugin';
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync('plugin/package.json', `${dest}/package.json`);
    cpSync('dist/ts-plugin/index.js', `${dest}/index.js`);
    if (existsSync('dist/ts-plugin/index.js.map')) {
        cpSync('dist/ts-plugin/index.js.map', `${dest}/index.js.map`);
    }
};

const common = {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    minify: production,
    // Prefer ESM entry points: jsonc-parser's default "main" is a UMD build
    // whose define()-detection misfires inside the VSCode extension host.
    mainFields: ['module', 'main'],
};

const contexts = await Promise.all([
    esbuild.context({
        ...common,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        external: ['vscode'],
    }),
    esbuild.context({
        ...common,
        entryPoints: ['src/tsPlugin/index.ts'],
        outfile: 'dist/ts-plugin/index.js',
        external: ['typescript'],
        plugins: [
            {
                name: 'install-ts-plugin',
                setup(build) {
                    build.onEnd((result) => {
                        if (result.errors.length === 0) {
                            installPluginIntoNodeModules();
                        }
                    });
                },
            },
        ],
    }),
]);

if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('esbuild: watching...');
} else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
