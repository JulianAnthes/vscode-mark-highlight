import * as vscode from 'vscode';

import { markRanges } from './adapter';
import { commentSyntaxFor } from './commentSyntax';
import { MarkConfig, languageEnabled } from './config';
import { findMarks } from './core/findMarks';
import { ruleRenderOptions } from './core/ruleRenderOptions';

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
