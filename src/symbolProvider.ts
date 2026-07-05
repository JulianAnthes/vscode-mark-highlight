import * as vscode from 'vscode';

import { markRanges } from './adapter';
import { commentSyntaxFor } from './commentSyntax';
import { MarkConfig } from './config';
import { findMarks } from './core/findMarks';

/** Languages whose outline comes from the built-in TS extension. For these,
 *  marks are injected into the TypeScript symbol tree by the bundled tsserver
 *  plugin — emitting symbols here as well would duplicate them and split the
 *  Outline into one tree per provider (microsoft/vscode#60641). */
export const TS_SERVER_LANGUAGES = new Set([
    'typescript',
    'typescriptreact',
    'javascript',
    'javascriptreact',
]);

const tsExtensionPresent = (): boolean =>
    vscode.extensions.getExtension('vscode.typescript-language-features') !==
    undefined;

class MarkSymbolProvider implements vscode.DocumentSymbolProvider {
    constructor(private readonly getConfig: () => MarkConfig) {}

    provideDocumentSymbols(
        document: vscode.TextDocument,
    ): vscode.DocumentSymbol[] {
        const config = this.getConfig();
        const syntax = commentSyntaxFor(document.languageId);
        if (
            !config.enabled ||
            syntax === null ||
            (tsExtensionPresent() &&
                TS_SERVER_LANGUAGES.has(document.languageId))
        ) {
            return [];
        }
        // For languages that have their own symbol provider (CSS, Python via
        // Pylance, ...) these marks render as a separate "MARK" tree next to
        // that provider's tree — VSCode cannot merge Outline trees, and a
        // separate tree was chosen over hiding the marks. Languages without
        // another provider get the marks as their only outline.
        return findMarks(document.getText(), config.keyword, syntax).map(
            (mark) => {
                const { lineRange, titleRange } = markRanges(mark, document);
                return new vscode.DocumentSymbol(
                    mark.title || 'MARK',
                    '',
                    vscode.SymbolKind.Key,
                    lineRange,
                    titleRange,
                );
            },
        );
    }
}

/** Registers for ALL configured languages, including the TS family for which
 *  provideDocumentSymbols returns []. That empty registration is deliberate:
 *  VSCode caches outline models per document keyed by (version + identities
 *  of the providers registered for it). Being in that provider set is what
 *  lets a dispose + re-register on config change invalidate the cached
 *  outline of TS documents, whose mark symbols come from the tsserver plugin
 *  and would otherwise stay stale until the next edit. */
export const registerMarkSymbolProvider = (
    getConfig: () => MarkConfig,
): vscode.Disposable => {
    const languages = getConfig().languages;
    const selector: vscode.DocumentSelector = languages.includes('*')
        ? '*'
        : languages.map((language) => ({ language }));
    return vscode.languages.registerDocumentSymbolProvider(
        selector,
        new MarkSymbolProvider(getConfig),
        { label: 'MARK' },
    );
};
