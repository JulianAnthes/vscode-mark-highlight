// Pure helper — no vscode imports (unit tested by Vitest).

/** Pixel width of the top rule when borderWidth is a top-only shorthand
 *  ("5px", "5px 0 0 0", ...); undefined for anything else (side borders,
 *  non-px units), which callers render as plain CSS borders. */
export const topOnlyRuleWidthPx = (borderWidth: string): number | undefined => {
    // split always yields at least one element, even for the empty string.
    const tokens = borderWidth.trim().split(/\s+/);
    const top = /^(\d+(?:\.\d+)?)px$/.exec(tokens[0]);
    if (top === null || tokens.length > 4) {
        return undefined;
    }
    const others = tokens.slice(1);
    if (!others.every((token) => token === '0' || token === '0px')) {
        return undefined;
    }
    return Number(top[1]);
};
