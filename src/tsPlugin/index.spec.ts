import { unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import * as ts from 'typescript/lib/tsserverlibrary';
import { afterEach, describe, expect, it } from 'vitest';

import init from './index';

// The plugin depends only on the TypeScript API, so it is driven here with a
// real ts.SourceFile (for accurate line/column -> position math) and a tiny
// fake LanguageService — no vscode, no mocking of anything meaningful.

interface PluginConfig {
    enabled?: boolean;
    keyword?: string;
    languages?: string[];
}

const span = (start: number, length: number): ts.TextSpan => ({
    start,
    length,
});

const emptyRoot = (): ts.NavigationTree => ({
    text: '<global>',
    kind: ts.ScriptElementKind.moduleElement,
    kindModifiers: '',
    spans: [span(0, 0)],
    nameSpan: undefined,
    childItems: undefined,
});

/** Runs the plugin's getNavigationTree override over `code` and returns the
 *  (mutated) navigation tree the Outline would receive. */
const run = (
    code: string,
    {
        fileName = 'file.ts',
        config,
        baseTree = emptyRoot(),
    }: {
        fileName?: string;
        config?: PluginConfig;
        baseTree?: ts.NavigationTree;
    } = {},
): { tree: ts.NavigationTree; sourceFile: ts.SourceFile } => {
    const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true,
    );
    const languageService = {
        getNavigationTree: (): ts.NavigationTree => baseTree,
        getProgram: () => ({
            getSourceFile: (name: string) =>
                name === fileName ? sourceFile : undefined,
        }),
    } as unknown as ts.LanguageService;

    const plugin = init({ typescript: ts });
    const proxy = plugin.create({
        config,
        languageService,
    } as unknown as ts.server.PluginCreateInfo);
    return { tree: proxy.getNavigationTree(fileName), sourceFile };
};

const titles = (node: ts.NavigationTree): string[] =>
    (node.childItems ?? []).map((c) => c.text);

describe('tsPlugin', () => {
    describe('language matching', () => {
        it('injects marks for .ts files under the default wildcard', () => {
            const { tree } = run('// MARK: - Section\nconst a = 1;\n');
            expect(titles(tree)).toContain('Section');
        });

        it('leaves non-configured extensions untouched', () => {
            const { tree } = run('# MARK: - Section\n', { fileName: 'a.py' });
            expect(tree.childItems ?? []).toHaveLength(0);
        });

        it('honors an explicit language list by extension', () => {
            const js = run('// MARK: - Section\n', {
                fileName: 'a.js',
                config: { languages: ['javascript'] },
            });
            expect(titles(js.tree)).toContain('Section');

            const tsFile = run('// MARK: - Section\n', {
                fileName: 'a.ts',
                config: { languages: ['javascript'] },
            });
            expect(tsFile.tree.childItems ?? []).toHaveLength(0);
        });
    });

    describe('gating', () => {
        it('returns the base tree unchanged when disabled', () => {
            const base = emptyRoot();
            const { tree } = run('// MARK: - Section\n', {
                config: { enabled: false },
                baseTree: base,
            });
            expect(tree).toBe(base);
            expect(tree.childItems).toBeUndefined();
        });
    });

    describe('injected node shape', () => {
        it('builds a node with correct text, kind and spans', () => {
            const code = '// MARK: - Setup\nconst a = 1;\n';
            const { tree, sourceFile } = run(code);
            const node = (tree.childItems ?? []).find(
                (c) => c.text === 'Setup',
            );
            expect(node).toBeDefined();
            expect(node!.kind).toBe(ts.ScriptElementKind.string);

            // The mark spans its whole comment line.
            const lineStart = sourceFile.getPositionOfLineAndCharacter(0, 0);
            const lineEnd = sourceFile.getLineEndOfPosition(lineStart);
            expect(node!.spans[0]).toEqual({
                start: lineStart,
                length: lineEnd - lineStart,
            });
            // nameSpan covers just the title text "Setup".
            const nameStart = sourceFile.getPositionOfLineAndCharacter(0, 11);
            expect(node!.nameSpan).toEqual({
                start: nameStart,
                length: 'Setup'.length,
            });
        });

        it('falls back to "MARK" for an empty title', () => {
            const { tree } = run('// MARK: -\nconst a = 1;\n');
            expect(titles(tree)).toContain('MARK');
        });
    });

    describe('sorted insertion', () => {
        it('orders injected marks by file position among existing children', () => {
            // A base tree with one real symbol on line 2 (the const).
            const code =
                '// MARK: - First\nconst a = 1;\n// MARK: - Second\nconst b = 2;\n';
            const sf = ts.createSourceFile(
                'file.ts',
                code,
                ts.ScriptTarget.Latest,
                true,
            );
            const aPos = sf.getPositionOfLineAndCharacter(1, 6); // "a"
            const base: ts.NavigationTree = {
                ...emptyRoot(),
                childItems: [
                    {
                        text: 'a',
                        kind: ts.ScriptElementKind.constElement,
                        kindModifiers: '',
                        spans: [span(aPos, 1)],
                        nameSpan: span(aPos, 1),
                    },
                ],
            };
            const { tree } = run(code, { baseTree: base });
            // First (line 0) before "a" (line 1) before Second (line 2).
            expect(titles(tree)).toEqual(['First', 'a', 'Second']);
        });

        it('appends a mark that comes after every existing child', () => {
            const code = 'const a = 1;\n// MARK: - Later\n';
            const sf = ts.createSourceFile(
                'file.ts',
                code,
                ts.ScriptTarget.Latest,
                true,
            );
            const aPos = sf.getPositionOfLineAndCharacter(0, 6);
            const base: ts.NavigationTree = {
                ...emptyRoot(),
                childItems: [
                    {
                        text: 'a',
                        kind: ts.ScriptElementKind.constElement,
                        kindModifiers: '',
                        spans: [span(aPos, 1)],
                        nameSpan: span(aPos, 1),
                    },
                ],
            };
            const { tree } = run(code, { baseTree: base });
            expect(titles(tree)).toEqual(['a', 'Later']);
        });
    });

    describe('nesting', () => {
        it('nests a mark under the enclosing symbol whose span contains it', () => {
            const code = [
                'class Foo {', // line 0
                '    // MARK: - Inner', // line 1
                '    bar() {}', // line 2
                '}', // line 3
                '// MARK: - Outer', // line 4
            ].join('\n');
            const sf = ts.createSourceFile(
                'file.ts',
                code,
                ts.ScriptTarget.Latest,
                true,
            );
            const classStart = sf.getPositionOfLineAndCharacter(0, 0);
            const classEnd = sf.getPositionOfLineAndCharacter(3, 1);
            const base: ts.NavigationTree = {
                ...emptyRoot(),
                childItems: [
                    {
                        text: 'Foo',
                        kind: ts.ScriptElementKind.classElement,
                        kindModifiers: '',
                        spans: [span(classStart, classEnd - classStart)],
                        nameSpan: span(classStart, classEnd - classStart),
                        childItems: [],
                    },
                ],
            };
            const { tree } = run(code, { baseTree: base });
            const foo = (tree.childItems ?? []).find((c) => c.text === 'Foo');
            // Inner mark nests inside Foo; Outer mark sits at the root.
            expect(titles(foo!)).toContain('Inner');
            expect(titles(tree)).toContain('Outer');
            expect(titles(tree)).not.toContain('Inner');
        });
    });

    describe('config precedence', () => {
        it('uses DEFAULTS when no config is supplied', () => {
            const { tree } = run('// MARK: - Default\n');
            expect(titles(tree)).toContain('Default');
        });

        it('applies a custom keyword from the channel (info.config)', () => {
            const { tree } = run('// SECTION: Networking\n', {
                config: { keyword: 'SECTION:' },
            });
            expect(titles(tree)).toContain('Networking');
            // The default keyword no longer matches.
            const def = run('// MARK: - Nope\n', {
                config: { keyword: 'SECTION:' },
            });
            expect(def.tree.childItems ?? []).toHaveLength(0);
        });

        it('picks up a keyword pushed through onConfigurationChanged', () => {
            const sourceFile = ts.createSourceFile(
                'file.ts',
                '// SECTION: Networking\n',
                ts.ScriptTarget.Latest,
                true,
            );
            const languageService = {
                getNavigationTree: (): ts.NavigationTree => emptyRoot(),
                getProgram: () => ({ getSourceFile: () => sourceFile }),
            } as unknown as ts.LanguageService;

            const plugin = init({ typescript: ts });
            const proxy = plugin.create({
                languageService,
            } as unknown as ts.server.PluginCreateInfo);
            // Default keyword: no match yet.
            expect(
                proxy.getNavigationTree('file.ts').childItems ?? [],
            ).toHaveLength(0);

            plugin.onConfigurationChanged!({ keyword: 'SECTION:' });
            expect(titles(proxy.getNavigationTree('file.ts'))).toContain(
                'Networking',
            );
        });

        it('lets a config.json on disk override the channel keyword', () => {
            const configFile = join(__dirname, 'config.json');
            try {
                writeFileSync(
                    configFile,
                    JSON.stringify({ keyword: 'SECTION:' }),
                );
                const { tree } = run('// SECTION: FromFile\n', {
                    // channel says MARK, file says SECTION — file wins.
                    config: { keyword: 'MARK: -' },
                });
                expect(titles(tree)).toContain('FromFile');
            } finally {
                unlinkSync(configFile);
            }
        });
    });
});

afterEach(() => {
    // config.json is written by one test only and removed in its finally; this
    // is a belt-and-suspenders guard so a failure there can't leak into others.
    try {
        unlinkSync(join(__dirname, 'config.json'));
    } catch {
        // not present — fine
    }
});
