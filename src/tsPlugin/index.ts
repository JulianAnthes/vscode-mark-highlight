// tsserver plugin: injects mark comments into TypeScript's own navigation
// tree, so marks appear in the Outline interleaved with (and nested inside)
// the real TS symbols instead of in a separate per-provider tree.
//
// Runs inside tsserver, not the extension host — no vscode imports here.
//
// Configuration reaches this plugin through a config.json next to the built
// plugin, written by the extension on every settings change (see syncTsPlugin
// in src/extension.ts). A file is used because VSCode runs TWO tsserver
// processes and routes requests by command: "navtree" (document symbols) is
// always answered by the syntax server, while the configurePlugin request is
// only ever delivered to the semantic server — so the API alone can never
// update the instance of this plugin that actually serves the Outline. The
// configurePlugin channel is still honored as a secondary source.
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

import type * as ts from 'typescript/lib/tsserverlibrary';

import { C_STYLE_COMMENTS, findMarks } from '../core/findMarks';

interface PluginConfig {
    enabled?: boolean;
    keyword?: string;
    languages?: string[];
}

const DEFAULTS: Required<PluginConfig> = {
    enabled: true,
    keyword: 'MARK: -',
    languages: ['*'],
};

// tsserver only knows file names, so the configured VSCode language IDs are
// matched by extension.
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
    typescript: ['.ts', '.mts', '.cts'],
    typescriptreact: ['.tsx'],
    javascript: ['.js', '.mjs', '.cjs'],
    javascriptreact: ['.jsx'],
};

const CONFIG_FILE = join(__dirname, 'config.json');

const init = (modules: { typescript: typeof ts }): ts.server.PluginModule => {
    const tsModule = modules.typescript;
    let channelConfig: PluginConfig = {};
    let fileConfig: PluginConfig = {};
    let fileMtimeMs = -1;

    const currentConfig = (): Required<PluginConfig> => {
        try {
            const mtimeMs = statSync(CONFIG_FILE).mtimeMs;
            if (mtimeMs !== fileMtimeMs) {
                fileConfig = JSON.parse(
                    readFileSync(CONFIG_FILE, 'utf8'),
                ) as PluginConfig;
                fileMtimeMs = mtimeMs;
            }
        } catch {
            // Missing or mid-write file — keep the last good config. The
            // mtime cache is only advanced on a successful parse, so a torn
            // read is retried on the next call.
        }
        return { ...DEFAULTS, ...channelConfig, ...fileConfig };
    };

    const fileMatchesLanguages = (
        fileName: string,
        config: Required<PluginConfig>,
    ): boolean => {
        const lower = fileName.toLowerCase();
        const languages = config.languages.includes('*')
            ? Object.keys(LANGUAGE_EXTENSIONS)
            : config.languages;
        return languages.some((language) =>
            (LANGUAGE_EXTENSIONS[language] ?? []).some((ext) =>
                lower.endsWith(ext),
            ),
        );
    };

    const insertSortedByPosition = (
        parent: ts.NavigationTree,
        node: ts.NavigationTree,
        position: number,
    ): void => {
        const items = parent.childItems ? [...parent.childItems] : [];
        const index = items.findIndex(
            (child) => (child.spans[0]?.start ?? 0) > position,
        );
        if (index === -1) {
            items.push(node);
        } else {
            items.splice(index, 0, node);
        }
        parent.childItems = items;
    };

    /** Walks into the deepest original node whose span contains the mark, so a
     *  mark inside a class body nests under that class like in Xcode. */
    const findInsertionParent = (
        root: ts.NavigationTree,
        position: number,
    ): ts.NavigationTree => {
        let target = root;
        let descended = true;
        while (descended) {
            descended = false;
            for (const child of target.childItems ?? []) {
                if (
                    child.spans.some(
                        (s) =>
                            position >= s.start &&
                            position < s.start + s.length,
                    )
                ) {
                    target = child;
                    descended = true;
                    break;
                }
            }
        }
        return target;
    };

    const injectMarks = (
        tree: ts.NavigationTree,
        sourceFile: ts.SourceFile,
        keyword: string,
    ): void => {
        // Keep in sync with what the editor side discovers for TS files: the
        // decorations use the language-configuration tokens, which for the
        // whole TS family are the C-style pair.
        for (const mark of findMarks(
            sourceFile.getFullText(),
            keyword,
            C_STYLE_COMMENTS,
        )) {
            let lineStart: number;
            let nameStart: number;
            let nameEnd: number;
            try {
                lineStart = sourceFile.getPositionOfLineAndCharacter(
                    mark.line,
                    0,
                );
                nameStart = sourceFile.getPositionOfLineAndCharacter(
                    mark.line,
                    mark.startCol,
                );
                nameEnd = sourceFile.getPositionOfLineAndCharacter(
                    mark.line,
                    mark.endCol,
                );
            } catch {
                continue; // stale text vs. source file — skip rather than crash tsserver
            }
            const lineEnd = sourceFile.getLineEndOfPosition(lineStart);
            const node: ts.NavigationTree = {
                // VSCode drops navigation items with empty text, so keep the fallback
                // name in sync with the DocumentSymbol fallback in symbolProvider.ts.
                text: mark.title || 'MARK',
                // VSCode's navtree conversion maps unknown kinds (incl.
                // "string") to SymbolKind.Variable — there is no closer match
                // to a plain text label among the kinds tsserver can emit.
                kind: tsModule.ScriptElementKind.string,
                kindModifiers: '',
                spans: [{ start: lineStart, length: lineEnd - lineStart }],
                nameSpan: { start: nameStart, length: nameEnd - nameStart },
            };
            insertSortedByPosition(
                findInsertionParent(tree, lineStart),
                node,
                lineStart,
            );
        }
    };

    return {
        create(info: ts.server.PluginCreateInfo): ts.LanguageService {
            channelConfig = info.config ?? {};
            const languageService = info.languageService;
            const proxy: ts.LanguageService = Object.create(null);
            for (const key of Object.keys(
                languageService,
            ) as (keyof ts.LanguageService)[]) {
                const member = languageService[key];
                (proxy as unknown as Record<string, unknown>)[key] =
                    typeof member === 'function'
                        ? (member as (...args: unknown[]) => unknown).bind(
                              languageService,
                          )
                        : member;
            }

            proxy.getNavigationTree = (fileName: string): ts.NavigationTree => {
                const tree = languageService.getNavigationTree(fileName);
                const config = currentConfig();
                if (
                    !config.enabled ||
                    !fileMatchesLanguages(fileName, config)
                ) {
                    return tree;
                }
                const sourceFile = languageService
                    .getProgram()
                    ?.getSourceFile(fileName);
                if (tree !== undefined && sourceFile !== undefined) {
                    injectMarks(tree, sourceFile, config.keyword);
                }
                return tree;
            };

            return proxy;
        },

        onConfigurationChanged(newConfig: PluginConfig): void {
            channelConfig = newConfig ?? {};
        },
    };
};

export = init;
