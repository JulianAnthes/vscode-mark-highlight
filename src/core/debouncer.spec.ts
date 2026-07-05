import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Debouncer } from './debouncer';

describe('Debouncer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs the callback after the delay elapses', () => {
        const debouncer = new Debouncer();
        const fn = vi.fn();
        debouncer.schedule('a', fn, 150);

        vi.advanceTimersByTime(149);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('coalesces repeated scheduling of the same key to the latest callback', () => {
        const debouncer = new Debouncer();
        const first = vi.fn();
        const second = vi.fn();
        debouncer.schedule('a', first, 150);
        vi.advanceTimersByTime(100);
        debouncer.schedule('a', second, 150); // resets the timer

        vi.advanceTimersByTime(100); // 200ms since first, 100ms since second
        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('keeps distinct keys independent', () => {
        const debouncer = new Debouncer();
        const a = vi.fn();
        const b = vi.fn();
        debouncer.schedule('a', a, 150);
        debouncer.schedule('b', b, 300);

        vi.advanceTimersByTime(150);
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).not.toHaveBeenCalled();

        vi.advanceTimersByTime(150);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('drops pending callbacks on dispose so none fire afterward', () => {
        const debouncer = new Debouncer();
        const fn = vi.fn();
        debouncer.schedule('a', fn, 150);

        debouncer.dispose();
        vi.advanceTimersByTime(1000);
        expect(fn).not.toHaveBeenCalled();
    });
});
