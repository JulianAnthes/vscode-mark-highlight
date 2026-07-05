// Pure parser for a language-configuration.json's comment tokens. Must never
// import "vscode" — the vscode-coupled discovery (which locates and reads the
// files) lives in src/commentSyntax.ts and calls this.
import { parse as parseJsonc } from 'jsonc-parser';

import { CommentSyntax } from './findMarks';

/** Extracts the line/block comment tokens from the text of a
 *  language-configuration.json. Returns null when the language declares no
 *  usable comments (plaintext, markdown, ...) or the text can't be parsed. */
export const parseCommentSyntax = (
    configText: string,
): CommentSyntax | null => {
    let comments: unknown;
    try {
        comments = parseJsonc(configText)?.comments;
    } catch {
        return null;
    }
    const c = comments as
        { lineComment?: unknown; blockComment?: unknown } | undefined;
    const line = typeof c?.lineComment === 'string' ? [c.lineComment] : [];
    const block: [string, string][] =
        Array.isArray(c?.blockComment) &&
        c.blockComment.length === 2 &&
        c.blockComment.every((token: unknown) => typeof token === 'string')
            ? [[c.blockComment[0], c.blockComment[1]]]
            : [];
    if (line.length > 0 || block.length > 0) {
        return { line, block };
    }
    return null;
};
