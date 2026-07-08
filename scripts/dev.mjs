// Launches an isolated Extension Development Host with this extension loaded
// and the examples/ folder open — for a quick manual check after a build.
//
//   npm run dev
//
// It reuses the @vscode/test-electron-managed VS Code (cached under
// .vscode-test/), and runs it against its OWN --user-data-dir and
// --extensions-dir, so it shares nothing with your main VS Code: no settings,
// and — crucially — none of your installed extensions. That means a published
// copy of THIS extension in your main editor won't load alongside the dev
// build, so there is nothing to uninstall first.
//
// The window does not hot-reload: after `npm run build` (or while `npm run
// watch` rebuilds), press Cmd/Ctrl+R in the dev host — or run "Developer:
// Reload Window" — to pick up changes. For a TS Outline change, also run
// "TypeScript: Restart TS Server", since tsserver caches the bundled plugin.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const ROOT = resolve(import.meta.dirname, '..');
const USER_DATA_DIR = join(ROOT, '.vscode-test', 'dev-user-data');
const EXTENSIONS_DIR = join(ROOT, '.vscode-test', 'dev-extensions');

if (process.platform === 'linux' && !process.env.DISPLAY) {
    console.error(
        'No DISPLAY — a GUI is required. On a headless box: xvfb-run -a npm run dev',
    );
    process.exit(1);
}

mkdirSync(USER_DATA_DIR, { recursive: true });
mkdirSync(EXTENSIONS_DIR, { recursive: true });

const codeBinary = await downloadAndUnzipVSCode();
if (!existsSync(codeBinary)) {
    throw new Error(`VS Code binary not found at ${codeBinary}`);
}

const child = spawn(
    codeBinary,
    [
        `--extensionDevelopmentPath=${ROOT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        `--extensions-dir=${EXTENSIONS_DIR}`,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--new-window',
        join(ROOT, 'examples'),
    ],
    { stdio: 'inherit' },
);

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
    console.error(err);
    process.exit(1);
});
