import { describe, expect, it } from 'vitest';

import { MarkConfig } from './config';
import { ruleRenderOptions } from './ruleRenderOptions';

const config = (overrides: Partial<MarkConfig>): MarkConfig => ({
    enabled: true,
    keyword: 'MARK: -',
    languages: ['*'],
    borderColor: 'rgba(128,128,128,0.45)',
    borderStyle: 'solid',
    borderWidth: '1px 0 0 0',
    overviewRuler: true,
    ...overrides,
});

describe('ruleRenderOptions', () => {
    it('uses a plain border for the default 1px top-only rule', () => {
        const options = ruleRenderOptions(config({ borderWidth: '1px 0 0 0' }));
        expect(options).toEqual({
            borderWidth: '1px 0 0 0',
            borderStyle: 'solid',
            borderColor: 'rgba(128,128,128,0.45)',
        });
        expect(options.before).toBeUndefined();
    });

    it('uses a plain border when the width is not top-only', () => {
        // Not a top-only rule -> topOnlyRuleWidthPx returns undefined -> no band.
        const options = ruleRenderOptions(
            config({ borderWidth: '1px 0 1px 0' }),
        );
        expect(options.before).toBeUndefined();
        expect(options.borderWidth).toBe('1px 0 1px 0');
    });

    it('draws an absolutely-positioned band for a thick top-only rule', () => {
        const options = ruleRenderOptions(
            config({ borderWidth: '4px 0 0 0', borderColor: 'red' }),
        );
        expect(options.borderWidth).toBeUndefined();
        expect(options.before?.contentText).toBe('');
        const decoration = options.before!.textDecoration;
        expect(decoration).toContain('position: absolute');
        expect(decoration).toContain('width: 100vw');
        expect(decoration).toContain('top: -4px;');
        expect(decoration).toContain('border-top: 4px solid red;');
    });

    it('rounds the upward offset but keeps the fractional rule width', () => {
        const options = ruleRenderOptions(config({ borderWidth: '2.5px' }));
        const decoration = options.before!.textDecoration;
        expect(decoration).toContain('top: -3px;'); // Math.round(2.5)
        expect(decoration).toContain('border-top: 2.5px solid');
    });
});
