// Per-key debouncer. Must never import "vscode" — dispose(): void satisfies
// vscode.Disposable structurally, so it drops straight into the extension's
// subscription list.

/** Debounces per key, and drops pending timers on dispose so a late callback
 *  can never touch a disposed resource (e.g. a decoration type). */
export class Debouncer {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

    schedule(key: string, fn: () => void, delayMs: number): void {
        const pending = this.timers.get(key);
        if (pending !== undefined) {
            clearTimeout(pending);
        }
        this.timers.set(
            key,
            setTimeout(() => {
                this.timers.delete(key);
                fn();
            }, delayMs),
        );
    }

    dispose(): void {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
}
