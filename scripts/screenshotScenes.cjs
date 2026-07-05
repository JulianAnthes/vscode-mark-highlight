// Runs INSIDE the VSCode extension host (via --extensionTestsPath) and sets
// up one screenshot scene, selected through the MARK_SCENE env var. It then
// parks forever; the orchestrator (screenshots.mjs) captures the window and
// kills the process.
const path = require('path');
const vscode = require('vscode');

const EXAMPLES = path.resolve(__dirname, '..', 'examples');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const open = async (file, column) => {
    const doc = await vscode.workspace.openTextDocument(
        path.join(EXAMPLES, file),
    );
    await vscode.window.showTextDocument(doc, { viewColumn: column });
};

const cleanUi = async () => {
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('workbench.action.closePanel');
    await vscode.commands.executeCommand('notifications.clearAll');
};

const scenes = {
    // The headline shot: TS file with rules + the merged Outline tree.
    hero: async () => {
        await open('demo.ts', vscode.ViewColumn.One);
        await vscode.commands.executeCommand('outline.focus');
        // Give tsserver time to serve the merged navigation tree.
        await sleep(8000);
        await vscode.commands.executeCommand('outline.focus');
    },

    // The USP shot: marks mirrored into symbol navigation as ONE merged
    // list — the Go to Symbol overlay shows them big and centered, with the
    // marks interleaved between the real TS symbols.
    outline: async () => {
        await open('demo.ts', vscode.ViewColumn.One);
        // Give tsserver time to serve the merged navigation tree.
        await sleep(8000);
        await vscode.commands.executeCommand('workbench.action.gotoSymbol');
    },

    // Two non-TS languages side by side — the "every language" shot.
    languages: async () => {
        await open('demo.py', vscode.ViewColumn.One);
        await open('demo.sql', vscode.ViewColumn.Two);
    },

    // Customization: thick colored rule drawn above the mark line.
    thick: async () => {
        const config = vscode.workspace.getConfiguration('markComments');
        await config.update(
            'borderWidth',
            '4px 0 0 0',
            vscode.ConfigurationTarget.Global,
        );
        await config.update(
            'borderColor',
            '#7aa2f7',
            vscode.ConfigurationTarget.Global,
        );
        await open('demo.ts', vscode.ViewColumn.One);
    },
};

exports.run = async () => {
    const scene = scenes[process.env.MARK_SCENE];
    if (scene === undefined) {
        throw new Error(`unknown scene: ${process.env.MARK_SCENE}`);
    }
    await cleanUi();
    await scene();
    await cleanUi();
    // Park until the orchestrator kills us — resolving would close the window.
    await new Promise(() => {});
};
