import { describe, expect, it } from 'vitest';

import { findMarks } from './findMarks';

const KEYWORD = 'MARK: -';

describe('findMarks', () => {
    it('matches the default keyword with the dash', () => {
        const marks = findMarks('// MARK: - Setup', KEYWORD);
        expect(marks).toEqual([
            { title: 'Setup', line: 0, startCol: 11, endCol: 16 },
        ]);
    });

    it('matches when the dash is dropped', () => {
        const marks = findMarks('// MARK: Setup', KEYWORD);
        expect(marks).toEqual([
            { title: 'Setup', line: 0, startCol: 9, endCol: 14 },
        ]);
    });

    it('matches a dash with no space before the title', () => {
        const marks = findMarks('// MARK:- Tight', KEYWORD);
        expect(marks).toEqual([
            { title: 'Tight', line: 0, startCol: 10, endCol: 15 },
        ]);
    });

    it('matches indented marks and reports the correct columns', () => {
        const marks = findMarks('    // MARK: - Private helpers', KEYWORD);
        expect(marks).toEqual([
            { title: 'Private helpers', line: 0, startCol: 15, endCol: 30 },
        ]);
    });

    it('returns an empty title for a bare mark', () => {
        const marks = findMarks('// MARK: -', KEYWORD);
        expect(marks).toHaveLength(1);
        expect(marks[0].title).toBe('');
        expect(marks[0].startCol).toBe(marks[0].endCol);
    });

    it('finds multiple marks with 0-based line numbers', () => {
        const text = [
            '// MARK: - First',
            'const a = 1;',
            '',
            '// MARK: - Second',
            'const b = 2;',
        ].join('\n');
        const marks = findMarks(text, KEYWORD);
        expect(marks.map((m) => [m.title, m.line])).toEqual([
            ['First', 0],
            ['Second', 3],
        ]);
    });

    it('supports a custom keyword', () => {
        const marks = findMarks('// SECTION: Networking', 'SECTION:');
        expect(marks).toEqual([
            { title: 'Networking', line: 0, startCol: 12, endCol: 22 },
        ]);
    });

    it('escapes regex metacharacters in the keyword', () => {
        const marks = findMarks('// TODO(x): fix later', 'TODO(x):');
        expect(marks).toEqual([
            { title: 'fix later', line: 0, startCol: 12, endCol: 21 },
        ]);
    });

    it('ignores ordinary comments', () => {
        expect(findMarks('// just a regular comment', KEYWORD)).toEqual([]);
    });

    it('ignores the keyword inside a string literal', () => {
        expect(findMarks('const s = "// MARK: - nope";', KEYWORD)).toEqual([]);
    });

    it('ignores trailing comments after code', () => {
        expect(findMarks('foo(); // MARK: - nope', KEYWORD)).toEqual([]);
    });

    it('ignores the keyword outside a line comment', () => {
        expect(findMarks('MARK: - not a comment', KEYWORD)).toEqual([]);
    });

    it('stays correct when the regex cache evicts (many distinct keywords)', () => {
        for (let i = 0; i < 100; i++) {
            expect(findMarks(`// KW${i}: Title`, `KW${i}:`)).toEqual([
                {
                    title: 'Title',
                    line: 0,
                    startCol: 3 + `KW${i}:`.length + 1,
                    endCol: 3 + `KW${i}:`.length + 1 + 5,
                },
            ]);
        }
        // The first keyword was evicted; recompilation must yield the same result.
        expect(findMarks('// KW0: Title', 'KW0:')).toHaveLength(1);
    });

    it('handles CRLF line endings like LF', () => {
        const lf = '// MARK: - A\nconst x = 1;\n// MARK: - B';
        const crlf = lf.replace(/\n/g, '\r\n');
        expect(findMarks(crlf, KEYWORD)).toEqual(findMarks(lf, KEYWORD));
    });

    describe('per-language comment syntax', () => {
        it('matches hash line comments (python, shell, yaml)', () => {
            const marks = findMarks('# MARK: - Setup', KEYWORD, {
                line: ['#'],
            });
            expect(marks).toEqual([
                { title: 'Setup', line: 0, startCol: 10, endCol: 15 },
            ]);
        });

        it('matches double-dash line comments (lua, sql, haskell)', () => {
            const marks = findMarks('-- MARK: - Queries', KEYWORD, {
                line: ['--'],
            });
            expect(marks).toEqual([
                { title: 'Queries', line: 0, startCol: 11, endCol: 18 },
            ]);
        });

        it('matches whole-line block comments (css)', () => {
            const marks = findMarks('/* MARK: - Layout */', KEYWORD, {
                block: [['/*', '*/']],
            });
            expect(marks).toEqual([
                { title: 'Layout', line: 0, startCol: 11, endCol: 17 },
            ]);
        });

        it('matches html comments', () => {
            const marks = findMarks('<!-- MARK: - Header -->', KEYWORD, {
                block: [['<!--', '-->']],
            });
            expect(marks).toEqual([
                { title: 'Header', line: 0, startCol: 13, endCol: 19 },
            ]);
        });

        it('ignores an unclosed block comment line', () => {
            expect(
                findMarks('/* MARK: - Layout', KEYWORD, {
                    block: [['/*', '*/']],
                }),
            ).toEqual([]);
        });

        it('does not match hash comments under the default C-style syntax', () => {
            expect(findMarks('# MARK: - Setup', KEYWORD)).toEqual([]);
        });

        it('matches C-style block comments by default', () => {
            const marks = findMarks('/* MARK: - Styles */', KEYWORD);
            expect(marks).toEqual([
                { title: 'Styles', line: 0, startCol: 11, endCol: 17 },
            ]);
        });

        it('matches a single-line JSDoc block (extra asterisk)', () => {
            const marks = findMarks('/** MARK: - Section */', KEYWORD);
            expect(marks).toEqual([
                { title: 'Section', line: 0, startCol: 12, endCol: 19 },
            ]);
        });

        it('matches a JSDoc block with several leading asterisks', () => {
            const marks = findMarks('/*** MARK: - Section */', KEYWORD);
            expect(marks).toEqual([
                { title: 'Section', line: 0, startCol: 13, endCol: 20 },
            ]);
        });

        it('matches a mark on a JSDoc star-gutter line', () => {
            const marks = findMarks('/**\n * MARK: - Section\n */', KEYWORD);
            expect(marks).toEqual([
                {
                    title: 'Section',
                    line: 1,
                    startCol: 11,
                    endCol: 18,
                    ruleLine: 0,
                },
            ]);
        });

        it('matches a star-gutter line inside a plain block comment', () => {
            const marks = findMarks('/*\n * MARK: - Section\n */', KEYWORD);
            expect(marks).toEqual([
                {
                    title: 'Section',
                    line: 1,
                    startCol: 11,
                    endCol: 18,
                    ruleLine: 0,
                },
            ]);
        });

        it('points the rule past intermediate description gutter lines', () => {
            const marks = findMarks(
                '/**\n * Docs\n * MARK: - Section\n */',
                KEYWORD,
            );
            expect(marks).toEqual([
                {
                    title: 'Section',
                    line: 2,
                    startCol: 11,
                    endCol: 18,
                    ruleLine: 0,
                },
            ]);
        });

        it('strips a trailing close on the last gutter line of a block', () => {
            const marks = findMarks('/*\n * MARK: - Section */', KEYWORD);
            expect(marks).toEqual([
                {
                    title: 'Section',
                    line: 1,
                    startCol: 11,
                    endCol: 18,
                    ruleLine: 0,
                },
            ]);
        });

        it('rejects a star-gutter mark with no block opener above it', () => {
            expect(findMarks(' * MARK: - x', KEYWORD)).toEqual([]);
            expect(findMarks('code();\n * MARK: - x', KEYWORD)).toEqual([]);
        });

        it('rejects a star-gutter mark after the block already closed', () => {
            expect(findMarks('/* done */\n * MARK: - x', KEYWORD)).toEqual([]);
        });

        it('rejects a star-gutter mark inside a string literal', () => {
            const text = 'const banner = `\n * MARK: - x\n`;';
            expect(findMarks(text, KEYWORD)).toEqual([]);
        });

        it('matches a mark on the opening line of a multi-line block', () => {
            expect(findMarks('/** MARK: - A\n */', KEYWORD)).toEqual([
                { title: 'A', line: 0, startCol: 12, endCol: 13 },
            ]);
            expect(findMarks('/* MARK: - A\n */', KEYWORD)).toEqual([
                { title: 'A', line: 0, startCol: 11, endCol: 12 },
            ]);
        });

        it('does not treat a star gutter as a comment for non-C block syntax', () => {
            expect(
                findMarks(' * MARK: - x', KEYWORD, {
                    block: [['<!--', '-->']],
                }),
            ).toEqual([]);
        });
    });
});
