import * as vscode from 'vscode';

import { markRanges } from './adapter';
import { commentSyntaxFor } from './commentSyntax';
import { MarkConfig, languageEnabled } from './config';
import { topOnlyRuleWidthPx } from './core/borderWidth';
import { findMarks } from './core/findMarks';

/**
 * Decorations are overlays — they cannot push text down, so a border thicker
 * than the line's natural top slack would paint over the mark text itself.
 * For top-only rules wider than 1px the rule is therefore drawn as an
 * absolutely-positioned ::before band shifted UP by its full width, so it
 * occupies the space above the mark line instead (the line before a mark is
 * conventionally blank). The ::before styling beyond text-decoration is
 * smuggled in through the textDecoration string — a long-standing technique
 * (Error Lens et al.) since the decoration API exposes no positioning.
 */
const ruleRenderOptions = (
    config: MarkConfig,
): vscode.DecorationRenderOptions => {
    const widthPx = topOnlyRuleWidthPx(config.borderWidth);
    if (widthPx === undefined || widthPx <= 1) {
        return {
            borderWidth: config.borderWidth,
            borderStyle: config.borderStyle,
            borderColor: config.borderColor,
        };
    }
    const offset = Math.round(widthPx);
    return {
        before: {
            contentText: '',
            // width: 100vw spans the full editor (the containing block is the
            // inline decoration span, so left/right offsets would collapse to
            // the text width); the view clips the overshoot on the right.
            textDecoration:
                `none; position: absolute; left: 0; width: 100vw; ` +
                `top: -${offset}px; ` +
                `border-top: ${widthPx}px ${config.borderStyle} ${config.borderColor}; ` +
                `pointer-events: none;`,
        },
    };
};

export class MarkDecorator implements vscode.Disposable {
    private decorationType: vscode.TextEditorDecorationType | undefined;

    /**
     * Builds a decoration type from the current config and re-decorates all
     * visible editors. The old type is disposed only after the new decorations
     * are applied, so the rules never blank out for a frame.
     */
    recreate(config: MarkConfig): void {
        const previous = this.decorationType;
        this.decorationType = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            ...ruleRenderOptions(config),
            overviewRulerColor: config.overviewRuler
                ? config.borderColor
                : undefined,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
        });
        this.refreshVisibleEditors(config);
        previous?.dispose();
    }

    refreshEditor(editor: vscode.TextEditor, config: MarkConfig): void {
        if (this.decorationType === undefined) {
            return;
        }
        const syntax = commentSyntaxFor(editor.document.languageId);
        if (
            !config.enabled ||
            !languageEnabled(config, editor.document.languageId) ||
            syntax === null
        ) {
            editor.setDecorations(this.decorationType, []);
            return;
        }
        const ranges = findMarks(
            editor.document.getText(),
            config.keyword,
            syntax,
        ).map((mark) => markRanges(mark, editor.document).lineRange);
        editor.setDecorations(this.decorationType, ranges);
    }

    refreshVisibleEditors(config: MarkConfig): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.refreshEditor(editor, config);
        }
    }

    refreshEditorsShowing(
        document: vscode.TextDocument,
        config: MarkConfig,
    ): void {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document === document) {
                this.refreshEditor(editor, config);
            }
        }
    }

    dispose(): void {
        this.decorationType?.dispose();
        this.decorationType = undefined;
    }
}
