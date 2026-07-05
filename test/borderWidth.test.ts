import { describe, expect, it } from 'vitest';

import { topOnlyRuleWidthPx } from '../src/core/borderWidth';

describe('topOnlyRuleWidthPx', () => {
    it('parses the default top-only shorthand', () => {
        expect(topOnlyRuleWidthPx('1px 0 0 0')).toBe(1);
    });

    it('parses a bare pixel value as top-only', () => {
        expect(topOnlyRuleWidthPx('5px')).toBe(5);
    });

    it('parses thick top-only values with 0px fillers', () => {
        expect(topOnlyRuleWidthPx('5px 0px 0px 0px')).toBe(5);
    });

    it('parses fractional widths', () => {
        expect(topOnlyRuleWidthPx('2.5px 0 0 0')).toBe(2.5);
    });

    it('rejects rules with other sides set', () => {
        expect(topOnlyRuleWidthPx('1px 0 1px 0')).toBeUndefined();
        expect(topOnlyRuleWidthPx('0 0 5px 0')).toBeUndefined();
    });

    it('rejects non-px units and malformed input', () => {
        expect(topOnlyRuleWidthPx('1em 0 0 0')).toBeUndefined();
        expect(topOnlyRuleWidthPx('thick')).toBeUndefined();
        expect(topOnlyRuleWidthPx('')).toBeUndefined();
        expect(topOnlyRuleWidthPx('1px 0 0 0 0')).toBeUndefined();
    });
});
