import { describe, expect, it } from 'vitest';

import { MarkConfig, languageEnabled } from './config';

const config = (languages: string[]): MarkConfig => ({
    enabled: true,
    keyword: 'MARK: -',
    languages,
    borderColor: 'rgba(128,128,128,0.45)',
    borderStyle: 'solid',
    borderWidth: '1px 0 0 0',
    overviewRuler: true,
});

describe('languageEnabled', () => {
    it('enables every language under the "*" wildcard', () => {
        expect(languageEnabled(config(['*']), 'typescript')).toBe(true);
        expect(languageEnabled(config(['*']), 'python')).toBe(true);
    });

    it('enables a language listed explicitly', () => {
        expect(languageEnabled(config(['typescript', 'go']), 'go')).toBe(true);
    });

    it('rejects a language that is neither listed nor wildcarded', () => {
        expect(languageEnabled(config(['typescript']), 'python')).toBe(false);
    });

    it('rejects everything for an empty language list', () => {
        expect(languageEnabled(config([]), 'typescript')).toBe(false);
    });
});
