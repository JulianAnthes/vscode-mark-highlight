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
    /** The line a full-line rule should attach to. Set only for a mark sitting
     *  on a `*`-gutter continuation line of a multi-line C-style block, where it
     *  points at the block opener (`/*` / `/**`) so the rule is drawn above the
     *  whole comment. Absent for every other mark — use `line`. */
    ruleLine?: number;
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

/** A compiled comment-form regex plus how its match must be validated:
 *  - `plain`   — self-contained on its line (line comment or single-line
 *                block); the match is a mark as-is.
 *  - `opener`  — the opening line of a C-style block whose close is on a later
 *                line; only a mark when the block actually closes below.
 *  - `gutter`  — a `*`-gutter continuation line; only a mark when an unclosed
 *                `/*` opener sits above it, and its rule attaches to that opener. */
interface MarkRegex {
    regex: RegExp;
    kind: 'plain' | 'opener' | 'gutter';
}

/**
 * Builds one regex per comment form. Only lines that contain nothing but the
 * comment can match — a line comment may have nothing but whitespace before
 * its prefix, and a block comment must open and close on that same line (or,
 * for C-style blocks, be a validated opener/gutter line of a multi-line
 * comment) — which keeps the keyword inside string literals or trailing
 * comments from producing false positives. The `d` flag exposes match indices
 * so the title range is exact for every comment form.
 */
export const buildMarkRegexes = (
    keyword: string,
    syntax: CommentSyntax = C_STYLE_COMMENTS,
): MarkRegex[] => {
    const body = keywordPattern(keyword);
    const regexes: MarkRegex[] = [];
    for (const prefix of syntax.line ?? []) {
        regexes.push({
            regex: new RegExp(
                `^\\s*${escapeRegExp(prefix)}\\s*${body}(.*)$`,
                'd',
            ),
            kind: 'plain',
        });
    }
    for (const [open, close] of syntax.block ?? []) {
        // C-style blocks (`/* */`) grow a `*` gutter in their JSDoc form:
        // extra asterisks after the open (`/** ... */`) and a leading `*` on
        // each continuation line. Detected narrowly so `<!-- -->` and friends
        // don't gain a spurious `*` gutter.
        const cStyle = open.endsWith('*') && close.startsWith('*');
        const stars = cStyle ? '\\**' : '';
        regexes.push({
            regex: new RegExp(
                `^\\s*${escapeRegExp(open)}${stars}\\s*${body}(.*?)\\s*${escapeRegExp(close)}\\s*$`,
                'd',
            ),
            kind: 'plain',
        });
        if (cStyle) {
            // The opening line of a multi-line block (`/** MARK: - x` with the
            // close on a later line). Tried after the single-line regex, so a
            // same-line close is consumed there first; reaching here means no
            // close on this line — validated by scanning downward for one.
            regexes.push({
                regex: new RegExp(
                    `^\\s*${escapeRegExp(open)}${stars}\\s*${body}(.*)$`,
                    'd',
                ),
                kind: 'opener',
            });
            // A mark on a multi-line block's `*`-gutter line — the block opens
            // and closes on other lines, so only the gutter and an optional
            // same-line close appear here. The gutter regex can't match the
            // open line (`/*`/`/**` start with `/`, not `*`).
            regexes.push({
                regex: new RegExp(
                    `^\\s*\\*\\s*${body}(.*?)(?:\\s*${escapeRegExp(close)})?\\s*$`,
                    'd',
                ),
                kind: 'gutter',
            });
        }
    }
    return regexes;
};

// findMarks is the hot path: it runs on every (debounced) keystroke for
// decorations, every Outline pull, and every tsserver navigation-tree
// request. Compiled regexes are memoized per (keyword, syntax) — without
// /g they carry no state and are safe to share across calls.
const regexCache = new Map<string, MarkRegex[]>();
const REGEX_CACHE_LIMIT = 64;

const cachedRegexes = (keyword: string, syntax: CommentSyntax): MarkRegex[] => {
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

// The gutter and opener validations below are specific to the C-style
// `/* ... */` family (the only blocks that grow a `*` gutter). They look for
// the literal `/*` / `*/` tokens rather than the general block pair, matching
// the gutter regex's own `/`-opener assumption.

/** The opener line of the C-style block that encloses a `*`-gutter mark, or
 *  `null` if the gutter line is not actually inside an open block. Scans
 *  upward from `markLine` through contiguous `*` continuation lines until it
 *  reaches an unclosed `/*` opener (match) — or a non-continuation line, a
 *  self-contained single-line block, or a stray close token (all reject). This
 *  keeps a stray `* MARK:` line (e.g. inside a template literal, or after a
 *  block that already closed) from producing a false positive. */
const blockOpenerLine = (lines: string[], markLine: number): number | null => {
    for (let i = markLine - 1; i >= 0; i--) {
        const trimmed = lines[i].trimStart();
        if (trimmed.startsWith('/*')) {
            // An opener that also closes on its own line (`/* ... */`) is a
            // self-contained block, not the opener of the mark's block.
            return trimmed.includes('*/') ? null : i;
        }
        if (!trimmed.startsWith('*')) {
            return null; // not a continuation line — no enclosing block
        }
        if (trimmed.includes('*/')) {
            return null; // the block closed above the mark
        }
    }
    return null; // reached the top with no opener
};

/** Whether a C-style block opened on `openerLine` is closed on a later line —
 *  the test that separates a genuine multi-line block opener (`/** MARK: - x`
 *  with its close below) from a truly unclosed `/* MARK: - x`, which stays
 *  ignored. */
const blockClosesBelow = (lines: string[], openerLine: number): boolean => {
    for (let i = openerLine + 1; i < lines.length; i++) {
        if (lines[i].includes('*/')) {
            return true;
        }
    }
    return false;
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
        for (const { regex, kind } of regexes) {
            const match = regex.exec(lines[line]);
            if (match === null || match.indices?.[1] === undefined) {
                continue;
            }
            // Block openers and gutter lines need cross-line context to tell a
            // real comment from a coincidental `/*`/`*` line (e.g. in a string).
            let ruleLine: number | undefined;
            if (kind === 'gutter') {
                const opener = blockOpenerLine(lines, line);
                if (opener === null) {
                    continue; // stray `* MARK:` — not inside an open block
                }
                ruleLine = opener;
            } else if (kind === 'opener' && !blockClosesBelow(lines, line)) {
                continue; // `/* MARK:` that never closes — left ignored
            }
            const raw = match[1];
            const title = raw.trim();
            const leading = raw.length - raw.trimStart().length;
            const startCol = match.indices[1][0] + leading;
            const mark: Mark = {
                title,
                line,
                startCol,
                endCol: startCol + title.length,
            };
            if (ruleLine !== undefined) {
                mark.ruleLine = ruleLine;
            }
            marks.push(mark);
            break;
        }
    }
    return marks;
};
