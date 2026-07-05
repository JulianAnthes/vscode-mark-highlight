import * as vscode from 'vscode';

import { markRanges } from './adapter';
import { commentSyntaxFor } from './commentSyntax';
import { MarkConfig } from './config';
import { findMarks } from './core/findMarks';
import { TS_SERVER_LANGUAGES, shouldEmitMarkSymbols } from './core/symbolGate';

// Re-exported for callers that key off the TS family; the set and the gating
// predicate live in core so they can be unit tested without the extension host.
export { TS_SERVER_LANGUAGES };

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
            !shouldEmitMarkSymbols({
                enabled: config.enabled,
                hasSyntax: syntax !== null,
                languageId: document.languageId,
                tsExtensionPresent: tsExtensionPresent(),
            })
        ) {
            return [];
        }
        // For languages that have their own symbol provider (CSS, Python via
        // Pylance, ...) these marks render as a separate "MARK" tree next to
        // that provider's tree — VSCode cannot merge Outline trees, and a
        // separate tree was chosen over hiding the marks. Languages without
        // another provider get the marks as their only outline.
        // The gate above returned early unless syntax was non-null.
        return findMarks(document.getText(), config.keyword, syntax!).map(
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
