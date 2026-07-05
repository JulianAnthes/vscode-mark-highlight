import * as vscode from 'vscode';

import { MarkConfig, languageEnabled } from './core/config';

// The configuration shape and the pure predicate live in core so they can be
// unit tested without the extension host; re-exported here so callers keep a
// single import site.
export type { MarkConfig };
export { languageEnabled };

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
