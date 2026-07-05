// Pure mark parser. This module must never import "vscode" — it is the
// unit tested by Vitest outside the extension host.

export interface Mark {
    /** Trimmed title text; "" for a mark with no title (e.g. `// MARK: -`). */
    title: string;
    /** 0-based line number. */
    line: number;
    /** Column where the title starts (equals endCol when the title is empty). */
    startCol: number;
    /** Column just past the end of the title. */
    endCol: number;
}

/** Comment tokens of the language being parsed. */
export interface CommentSyntax {
    /** Line-comment prefixes, e.g. ["//"] or ["#"]. */
    line?: string[];
    // Block-comment [open, close] pairs, e.g. the C-style pair — matched
    // only when a single line holds the whole comment.
    block?: [string, string][];
}

export const C_STYLE_COMMENTS: CommentSyntax = {
    line: ['//'],
    block: [['/*', '*/']],
};

const escapeRegExp = (s: string): string =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A trailing `-` in the keyword is treated as optional, so the default
 *  keyword `"MARK: -"` matches `// MARK: - Title`, `// MARK:- Title`, and
 *  `// MARK: Title` alike. */
const keywordPattern = (keyword: string): string => {
    const trimmed = keyword.trim();
    return trimmed.endsWith('-')
        ? `${escapeRegExp(trimmed.slice(0, -1).trimEnd())}\\s*(?:-\\s*)?`
        : `${escapeRegExp(trimmed)}\\s*`;
};

/**
 * Builds one regex per comment form. Only lines that contain nothing but the
 * comment can match — a line comment may have nothing but whitespace before
 * its prefix, and a block comment must open and close on that same line —
 * which keeps the keyword inside string literals or trailing comments from
 * producing false positives. The `d` flag exposes match indices so the title
 * range is exact for every comment form.
 */
export const buildMarkRegexes = (
    keyword: string,
    syntax: CommentSyntax = C_STYLE_COMMENTS,
): RegExp[] => {
    const body = keywordPattern(keyword);
    const regexes: RegExp[] = [];
    for (const prefix of syntax.line ?? []) {
        regexes.push(
            new RegExp(`^\\s*${escapeRegExp(prefix)}\\s*${body}(.*)$`, 'd'),
        );
    }
    for (const [open, close] of syntax.block ?? []) {
        regexes.push(
            new RegExp(
                `^\\s*${escapeRegExp(open)}\\s*${body}(.*?)\\s*${escapeRegExp(close)}\\s*$`,
                'd',
            ),
        );
    }
    return regexes;
};

// findMarks is the hot path: it runs on every (debounced) keystroke for
// decorations, every Outline pull, and every tsserver navigation-tree
// request. Compiled regexes are memoized per (keyword, syntax) — without
// /g they carry no state and are safe to share across calls.
const regexCache = new Map<string, RegExp[]>();
const REGEX_CACHE_LIMIT = 64;

const cachedRegexes = (keyword: string, syntax: CommentSyntax): RegExp[] => {
    // Control characters cannot appear in keywords or comment tokens, so
    // these separators cannot produce colliding keys for different inputs.
    const key = [
        keyword,
        ...(syntax.line ?? []),
        '\u0000',
        ...(syntax.block ?? []).flat(),
    ].join('\u0001');
    let regexes = regexCache.get(key);
    if (regexes === undefined) {
        if (regexCache.size >= REGEX_CACHE_LIMIT) {
            regexCache.clear();
        }
        regexes = buildMarkRegexes(keyword, syntax);
        regexCache.set(key, regexes);
    }
    return regexes;
};

/** The literal every match must contain (the keyword minus its optional
 *  trailing dash) — lets mark-free documents bail out on one substring scan
 *  instead of running the regexes line by line. */
const requiredLiteral = (keyword: string): string => {
    const trimmed = keyword.trim();
    return trimmed.endsWith('-') ? trimmed.slice(0, -1).trimEnd() : trimmed;
};

export const findMarks = (
    text: string,
    keyword: string,
    syntax: CommentSyntax = C_STYLE_COMMENTS,
): Mark[] => {
    const literal = requiredLiteral(keyword);
    if (!text.includes(literal)) {
        return [];
    }
    const regexes = cachedRegexes(keyword, syntax);
    const marks: Mark[] = [];
    const lines = text.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        // One substring check filters out ordinary lines before any regex runs.
        if (!lines[line].includes(literal)) {
            continue;
        }
        for (const regex of regexes) {
            const match = regex.exec(lines[line]);
            if (match === null || match.indices?.[1] === undefined) {
                continue;
            }
            const raw = match[1];
            const title = raw.trim();
            const leading = raw.length - raw.trimStart().length;
            const startCol = match.indices[1][0] + leading;
            marks.push({
                title,
                line,
                startCol,
                endCol: startCol + title.length,
            });
            break;
        }
    }
    return marks;
};
