// Pure configuration shape and predicates. Must never import "vscode" — the
// vscode-coupled reader lives in src/config.ts and re-exports these.

export interface MarkConfig {
    enabled: boolean;
    keyword: string;
    languages: string[];
    borderColor: string;
    borderStyle: string;
    borderWidth: string;
    overviewRuler: boolean;
}

/** True when the language participates, honoring the "*" wildcard entry. */
export const languageEnabled = (
    config: MarkConfig,
    languageId: string,
): boolean =>
    config.languages.includes('*') || config.languages.includes(languageId);
