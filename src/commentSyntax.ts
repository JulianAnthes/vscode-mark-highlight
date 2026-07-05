import { readFileSync } from 'fs';
import { join } from 'path';

import { parse as parseJsonc } from 'jsonc-parser';
import * as vscode from 'vscode';

import { CommentSyntax } from './core/findMarks';

/** Discovers a language's comment tokens from the language-configuration.json
 *  its contributing extension ships — the same file VSCode itself uses for
 *  toggle-comment. There is no public API for this, so the contributions are
 *  read directly; any language installed in this VSCode therefore works,
 *  including third-party ones. Returns null for languages that declare no
 *  comments (plaintext, markdown, ...), which are then skipped entirely. */
const cache = new Map<string, CommentSyntax | null>();

const discover = (languageId: string): CommentSyntax | null => {
    for (const extension of vscode.extensions.all) {
        const contributed = extension.packageJSON?.contributes?.languages;
        if (!Array.isArray(contributed)) {
            continue;
        }
        for (const language of contributed) {
            if (
                language?.id !== languageId ||
                typeof language?.configuration !== 'string'
            ) {
                continue;
            }
            try {
                const comments = parseJsonc(
                    readFileSync(
                        join(extension.extensionPath, language.configuration),
                        'utf8',
                    ),
                )?.comments;
                const line =
                    typeof comments?.lineComment === 'string'
                        ? [comments.lineComment]
                        : [];
                const block: [string, string][] =
                    Array.isArray(comments?.blockComment) &&
                    comments.blockComment.length === 2 &&
                    comments.blockComment.every(
                        (token: unknown) => typeof token === 'string',
                    )
                        ? [[comments.blockComment[0], comments.blockComment[1]]]
                        : [];
                if (line.length > 0 || block.length > 0) {
                    return { line, block };
                }
            } catch {
                // Unreadable configuration — keep looking; another extension
                // may also contribute this language.
            }
        }
    }
    return null;
};

export const commentSyntaxFor = (languageId: string): CommentSyntax | null => {
    let syntax = cache.get(languageId);
    if (syntax === undefined) {
        syntax = discover(languageId);
        cache.set(languageId, syntax);
    }
    return syntax;
};

/** Installed/enabled extensions can change at runtime and with them the known
 *  languages — drop the cache when that happens. */
export const registerCommentSyntaxCacheReset = (): vscode.Disposable =>
    vscode.extensions.onDidChange(() => cache.clear());
