import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import * as vscode from 'vscode';

import { registerCommentSyntaxCacheReset } from './commentSyntax';
import { MarkConfig, languageEnabled, readConfig } from './config';
import { Debouncer } from './core/debouncer';
import { MarkDecorator } from './decorations';
import { registerMarkSymbolProvider } from './symbolProvider';

const DEBOUNCE_MS = 150;
const TS_PLUGIN_ID = 'vscode-mark-highlight-ts-plugin';

/** The tsserver plugin ships inside dist/ (vsce packages no node_modules),
 *  but tsserver only loads plugins from <extensionRoot>/node_modules/<name>.
 *  Copy it there on activation; when the copy was missing or stale (first run
 *  after install or update), tsserver has already started without it, so
 *  restart it once. The F5 dev host is pre-seeded by the build script and
 *  skips both the copy and the restart. */
const ensureTsPluginInstalled = async (
    extensionPath: string,
): Promise<void> => {
    const source = join(extensionPath, 'dist', 'ts-plugin');
    const target = join(extensionPath, 'node_modules', TS_PLUGIN_ID);
    try {
        const built = await readFile(join(source, 'index.js'), 'utf8');
        const installed = await readFile(
            join(target, 'index.js'),
            'utf8',
        ).catch(() => undefined);
        if (installed === built) {
            return;
        }
        await mkdir(target, { recursive: true });
        await copyFile(
            join(source, 'package.json'),
            join(target, 'package.json'),
        );
        await copyFile(join(source, 'index.js'), join(target, 'index.js'));
        if (
            vscode.extensions.getExtension(
                'vscode.typescript-language-features',
            ) !== undefined
        ) {
            await vscode.commands.executeCommand('typescript.restartTsServer');
        }
    } catch {
        // Read-only install dir — TS outline marks stay unavailable, the
        // decorations and other languages still work.
    }
};

/** Pushes the current settings into the tsserver plugin that injects marks
 *  into TypeScript's navigation tree.
 *
 *  The primary channel is a config.json written next to the installed plugin,
 *  which the plugin re-reads per request: VSCode's syntax tsserver answers
 *  all navtree (document symbol) requests but never receives the
 *  configurePlugin request — that one is routed only to the semantic server.
 *  configurePlugin is still sent as a secondary channel. */
const syncTsPlugin = async (
    extensionPath: string,
    config: MarkConfig,
): Promise<void> => {
    const tsExtension = vscode.extensions.getExtension(
        'vscode.typescript-language-features',
    );
    if (tsExtension === undefined) {
        return;
    }
    const pluginConfig = {
        enabled: config.enabled,
        keyword: config.keyword,
        languages: config.languages,
    };
    try {
        await writeFile(
            join(extensionPath, 'node_modules', TS_PLUGIN_ID, 'config.json'),
            JSON.stringify(pluginConfig),
        );
    } catch {
        // Read-only install dir — the configurePlugin channel below still
        // covers setups where navtree is served by the semantic server.
    }
    await tsExtension.activate();
    const api = tsExtension.exports?.getAPI?.(0);
    api?.configurePlugin(TS_PLUGIN_ID, pluginConfig);

    // The TS extension serves document symbols from a single-slot cache keyed
    // by (uri, version), so without an edit the new plugin config would not
    // show in the Outline until the next keystroke. Requesting symbols for a
    // throwaway untitled document evicts that slot; the outline re-pull that
    // follows (provider re-registration) then reaches tsserver again.
    try {
        const throwaway = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: '',
        });
        await vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            throwaway.uri,
        );
    } catch {
        // Best effort — worst case the Outline refreshes on the next edit.
    }
};

export const activate = (context: vscode.ExtensionContext): void => {
    let config: MarkConfig = readConfig();
    const getConfig = (): MarkConfig => config;

    const decorator = new MarkDecorator();
    decorator.recreate(config);

    let providerRegistration = registerMarkSymbolProvider(getConfig);
    const debouncer = new Debouncer();
    void ensureTsPluginInstalled(context.extensionPath).then(() =>
        syncTsPlugin(context.extensionPath, config),
    );

    context.subscriptions.push(
        decorator,
        debouncer,
        { dispose: () => providerRegistration.dispose() },

        registerCommentSyntaxCacheReset(),

        vscode.workspace.onDidChangeTextDocument((event) => {
            // Fires for output channels, settings editors, etc. — filter early.
            if (!languageEnabled(config, event.document.languageId)) {
                return;
            }
            debouncer.schedule(
                event.document.uri.toString(),
                // Look editors up at fire time; one may have closed meanwhile.
                () => decorator.refreshEditorsShowing(event.document, config),
                DEBOUNCE_MS,
            );
        }),

        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor !== undefined) {
                decorator.refreshEditor(editor, config);
            }
        }),

        vscode.window.onDidChangeVisibleTextEditors(() => {
            decorator.refreshVisibleEditors(config);
        }),

        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration('markComments')) {
                return;
            }
            config = readConfig();
            decorator.recreate(config);
            const applied = config;
            void syncTsPlugin(context.extensionPath, applied).finally(() => {
                if (config !== applied) {
                    return; // superseded by a newer change
                }
                // DocumentSymbolProvider has no change event; re-registering
                // is the only way to make the Outline re-pull symbols for the
                // new config. It also invalidates VSCode's cached outline
                // models for TS documents, whose marks come from the tsserver
                // plugin — which is why it must happen only after the plugin
                // config file has been written.
                providerRegistration.dispose();
                providerRegistration = registerMarkSymbolProvider(getConfig);
            });
        }),
    );
};

export const deactivate = (): void => {
    // Cleanup happens via context.subscriptions.
};
