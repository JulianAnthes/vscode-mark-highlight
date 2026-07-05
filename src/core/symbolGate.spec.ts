import { describe, expect, it } from 'vitest';

import { TS_SERVER_LANGUAGES, shouldEmitMarkSymbols } from './symbolGate';

const base = {
    enabled: true,
    hasSyntax: true,
    languageId: 'css',
    tsExtensionPresent: true,
};

describe('shouldEmitMarkSymbols', () => {
    it('emits for a non-TS language with comment syntax when enabled', () => {
        expect(shouldEmitMarkSymbols(base)).toBe(true);
    });

    it('does not emit when disabled', () => {
        expect(shouldEmitMarkSymbols({ ...base, enabled: false })).toBe(false);
    });

    it('does not emit when the language declares no comment syntax', () => {
        expect(shouldEmitMarkSymbols({ ...base, hasSyntax: false })).toBe(
            false,
        );
    });

    it('suppresses TS-family symbols while the TS extension is present (dedup)', () => {
        for (const languageId of TS_SERVER_LANGUAGES) {
            expect(shouldEmitMarkSymbols({ ...base, languageId })).toBe(false);
        }
    });

    it('emits for TS-family languages when the TS extension is absent', () => {
        expect(
            shouldEmitMarkSymbols({
                ...base,
                languageId: 'typescript',
                tsExtensionPresent: false,
            }),
        ).toBe(true);
    });
});
