// Pure predicate deciding whether the mark DocumentSymbolProvider should emit
// symbols for a document. Must never import "vscode" — the provider in
// src/symbolProvider.ts supplies the runtime facts.

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

export interface SymbolGateInput {
    enabled: boolean;
    /** Whether the language declares comment syntax (null discovery => false). */
    hasSyntax: boolean;
    languageId: string;
    /** Whether the built-in TS language feature extension is present. */
    tsExtensionPresent: boolean;
}

export const shouldEmitMarkSymbols = ({
    enabled,
    hasSyntax,
    languageId,
    tsExtensionPresent,
}: SymbolGateInput): boolean =>
    enabled &&
    hasSyntax &&
    !(tsExtensionPresent && TS_SERVER_LANGUAGES.has(languageId));
