// Automated marketplace/README screenshots.
//
// Launches the @vscode/test-electron-managed VSCode with this extension in
// development mode, drives one scene per run (scripts/screenshotScenes.cjs),
// captures the window, trims the desktop border, and writes docs/*.png.
//
// Linux (headless, CI-friendly):  xvfb-run -a npm run screenshots
//   requires: imagemagick (import/convert), xvfb
// macOS (best effort, visible window): npm run screenshots
//   uses the built-in `screencapture`; keep the VSCode window unobstructed.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const ROOT = resolve(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const RENDER_WAIT_MS = 25_000;

const SCENES = ['hero', 'outline', 'languages', 'thick'];

const BASE_SETTINGS = {
    'workbench.colorTheme': 'Default Dark Modern',
    'workbench.startupEditor': 'none',
    'editor.fontSize': 14,
    'editor.minimap.enabled': true,
    'window.zoomLevel': 0,
    'chat.commandCenter.enabled': false,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const capture = (outFile) => {
    if (process.platform === 'darwin') {
        execFileSync('screencapture', ['-x', outFile]);
    } else {
        execFileSync('import', ['-window', 'root', outFile]);
    }
};

const postProcess = (file) => {
    try {
        // Trim the black desktop around the window, cap width for the README.
        execFileSync('convert', [
            file,
            '-trim',
            '+repage',
            '-resize',
            '1280>',
            file,
        ]);
    } catch {
        console.warn(`imagemagick 'convert' unavailable — ${file} left as-is`);
    }
};

const shoot = async (codeBinary, scene) => {
    const userDataDir = join(ROOT, '.vscode-test', `screenshot-${scene}`);
    rmSync(userDataDir, { recursive: true, force: true });
    mkdirSync(join(userDataDir, 'User'), { recursive: true });
    writeFileSync(
        join(userDataDir, 'User', 'settings.json'),
        JSON.stringify(BASE_SETTINGS, null, 4),
    );

    const child = spawn(
        codeBinary,
        [
            `--extensionDevelopmentPath=${ROOT}`,
            `--extensionTestsPath=${join(ROOT, 'scripts', 'screenshotScenes.cjs')}`,
            `--user-data-dir=${userDataDir}`,
            '--no-sandbox',
            '--disable-gpu',
            '--disable-workspace-trust',
            '--skip-welcome',
            '--skip-release-notes',
            join(ROOT, 'examples'),
        ],
        {
            env: { ...process.env, MARK_SCENE: scene },
            stdio: 'ignore',
            detached: true,
        },
    );

    await sleep(RENDER_WAIT_MS);
    const outFile = join(DOCS, `${scene}.png`);
    capture(outFile);
    try {
        process.kill(-child.pid, 'SIGKILL');
    } catch {
        child.kill('SIGKILL');
    }
    postProcess(outFile);
    console.log(`captured ${outFile}`);
};

if (process.platform === 'linux' && !process.env.DISPLAY) {
    console.error('No DISPLAY — run via: xvfb-run -a npm run screenshots');
    process.exit(1);
}

mkdirSync(DOCS, { recursive: true });
const codeBinary = await downloadAndUnzipVSCode();
if (!existsSync(codeBinary)) {
    throw new Error(`VSCode binary not found at ${codeBinary}`);
}
for (const scene of SCENES) {
    await shoot(codeBinary, scene);
}
console.log('done — review docs/*.png');
