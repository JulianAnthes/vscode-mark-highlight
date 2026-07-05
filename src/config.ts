import * as vscode from 'vscode';

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

export const readConfig = (): MarkConfig => {
    const config = vscode.workspace.getConfiguration('markComments');
    return {
        enabled: config.get<boolean>('enabled', true),
        keyword: config.get<string>('keyword', 'MARK: -'),
        languages: config.get<string[]>('languages', ['*']),
        borderColor: config.get<string>(
            'borderColor',
            'rgba(128,128,128,0.45)',
        ),
        borderStyle: config.get<string>('borderStyle', 'solid'),
        borderWidth: config.get<string>('borderWidth', '1px 0 0 0'),
        overviewRuler: config.get<boolean>('overviewRuler', true),
    };
};
