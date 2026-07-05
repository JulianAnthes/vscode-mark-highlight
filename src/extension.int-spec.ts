import * as assert from 'assert';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import * as vscode from 'vscode';

// End-to-end smoke: open a document with a mark comment and confirm the mark
// actually reaches the Outline through the real provider pipeline. This is the
// product promise no unit test can verify — the pure logic is covered by the
// vitest specs; this proves the wiring in a live host.

/** Flattens a DocumentSymbol tree into a single list of names + kinds. */
const flatten = (
    symbols: vscode.DocumentSymbol[] | undefined,
): { name: string; kind: vscode.SymbolKind }[] => {
    const out: { name: string; kind: vscode.SymbolKind }[] = [];
    for (const symbol of symbols ?? []) {
        out.push({ name: symbol.name, kind: symbol.kind });
        out.push(...flatten(symbol.children));
    }
    return out;
};

/** Polls the document symbol provider until `predicate` holds or it times out.
 *  The Outline (and tsserver, for TS) populates asynchronously, so a single
 *  request right after opening the document can race ahead of it. */
const waitForSymbol = async (
    uri: vscode.Uri,
    name: string,
    timeoutMs: number,
): Promise<{ name: string; kind: vscode.SymbolKind }[]> => {
    const deadline = Date.now() + timeoutMs;
    let flat: { name: string; kind: vscode.SymbolKind }[] = [];
    while (Date.now() < deadline) {
        const symbols = await vscode.commands.executeCommand<
            vscode.DocumentSymbol[]
        >('vscode.executeDocumentSymbolProvider', uri);
        flat = flatten(symbols);
        if (flat.some((s) => s.name === name)) {
            return flat;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return flat;
};

suite('mark outline (integration)', () => {
    // The tsserver plugin matches files by extension, so the TS case needs a
    // real .ts file on disk (an untitled doc has no ".ts" name).
    let tempDir: string;

    suiteSetup(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'mark-highlight-'));
    });

    suiteTeardown(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    test('a MARK in a CSS document surfaces as a Key symbol', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'css',
            content: '/* MARK: - Layout */\n.a { color: red; }\n',
        });
        await vscode.window.showTextDocument(doc);

        const symbols = await waitForSymbol(doc.uri, 'Layout', 15000);
        const layout = symbols.find((s) => s.name === 'Layout');
        assert.ok(layout, 'expected a "Layout" symbol in the CSS outline');
        assert.strictEqual(
            layout!.kind,
            vscode.SymbolKind.Key,
            'mark symbols use SymbolKind.Key',
        );
    });

    test('a MARK in a TypeScript document surfaces via the tsserver plugin', async () => {
        const file = join(tempDir, 'sample.ts');
        writeFileSync(file, '// MARK: - Section\nexport const value = 1;\n');
        const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(file),
        );
        await vscode.window.showTextDocument(doc);

        // Generous timeout: tsserver must start and load the bundled plugin.
        const symbols = await waitForSymbol(doc.uri, 'Section', 45000);
        assert.ok(
            symbols.some((s) => s.name === 'Section'),
            'expected a "Section" mark injected into the TS outline',
        );
        // The real TS symbol should still be present alongside the mark.
        assert.ok(
            symbols.some((s) => s.name === 'value'),
            'the real TS symbols should remain in the outline',
        );
    });

    // Exercises onDidChangeTextDocument -> debounced decorator refresh: a mark
    // typed into an already-open document must surface without reopening it.
    test('editing a document picks up a newly typed mark', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'css',
            content: '.a { color: red; }\n',
        });
        const editor = await vscode.window.showTextDocument(doc);

        await editor.edit((builder) => {
            builder.insert(
                new vscode.Position(0, 0),
                '/* MARK: - Inserted */\n',
            );
        });

        const symbols = await waitForSymbol(doc.uri, 'Inserted', 15000);
        assert.ok(
            symbols.some((s) => s.name === 'Inserted'),
            'a mark typed into an open document should reach the outline',
        );
    });

    // Exercises onDidChangeConfiguration -> recreate + syncTsPlugin + provider
    // re-registration: a keyword change must be honored live, and the old
    // keyword must stop matching.
    test('changing the keyword setting is applied live', async () => {
        const settings = vscode.workspace.getConfiguration('markComments');
        const original = settings.inspect<string>('keyword')?.globalValue;
        await settings.update(
            'keyword',
            'SECTION:',
            vscode.ConfigurationTarget.Global,
        );

        try {
            const doc = await vscode.workspace.openTextDocument({
                language: 'css',
                content: '/* SECTION: Custom */\n.b { color: blue; }\n',
            });
            await vscode.window.showTextDocument(doc);

            const symbols = await waitForSymbol(doc.uri, 'Custom', 15000);
            assert.ok(
                symbols.some((s) => s.name === 'Custom'),
                'the custom keyword should be honored after a settings change',
            );
        } finally {
            await settings.update(
                'keyword',
                original,
                vscode.ConfigurationTarget.Global,
            );
        }
    });
});
