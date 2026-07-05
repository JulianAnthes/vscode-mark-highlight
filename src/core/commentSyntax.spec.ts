import { describe, expect, it } from 'vitest';

import { parseCommentSyntax } from './commentSyntax';

describe('parseCommentSyntax', () => {
    it('extracts both line and block tokens (C-style)', () => {
        const text = `{
            "comments": {
                "lineComment": "//",
                "blockComment": ["/*", "*/"]
            }
        }`;
        expect(parseCommentSyntax(text)).toEqual({
            line: ['//'],
            block: [['/*', '*/']],
        });
    });

    it('extracts a block-only language (css)', () => {
        const text = `{ "comments": { "blockComment": ["/*", "*/"] } }`;
        expect(parseCommentSyntax(text)).toEqual({
            line: [],
            block: [['/*', '*/']],
        });
    });

    it('extracts a hash line comment (python, shell)', () => {
        const text = `{ "comments": { "lineComment": "#" } }`;
        expect(parseCommentSyntax(text)).toEqual({ line: ['#'], block: [] });
    });

    it('tolerates jsonc comments and trailing commas', () => {
        const text = `{
            // the language's own comment config, with a comment
            "comments": {
                "lineComment": "--", // lua/sql
            },
        }`;
        expect(parseCommentSyntax(text)).toEqual({ line: ['--'], block: [] });
    });

    it('returns null when the language declares no comments', () => {
        expect(parseCommentSyntax(`{ "comments": {} }`)).toBeNull();
        expect(parseCommentSyntax(`{ "brackets": [["(", ")"]] }`)).toBeNull();
    });

    it('ignores a malformed blockComment (wrong length or non-string)', () => {
        expect(
            parseCommentSyntax(
                `{ "comments": { "blockComment": ["/*", "*/", "extra"] } }`,
            ),
        ).toBeNull();
        expect(
            parseCommentSyntax(`{ "comments": { "blockComment": ["/*", 5] } }`),
        ).toBeNull();
    });

    it('ignores a non-string lineComment', () => {
        expect(
            parseCommentSyntax(`{ "comments": { "lineComment": 42 } }`),
        ).toBeNull();
    });

    it('returns null for unparseable text rather than throwing', () => {
        expect(parseCommentSyntax('not json at all @#$')).toBeNull();
        expect(parseCommentSyntax('')).toBeNull();
    });
});
