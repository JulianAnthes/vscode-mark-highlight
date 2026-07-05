import * as vscode from 'vscode';

import { Mark } from './core/findMarks';

export interface MarkRanges {
    /** The full comment line. */
    lineRange: vscode.Range;
    /** The title text within the line; always contained in lineRange. */
    titleRange: vscode.Range;
}

export const markRanges = (
    mark: Mark,
    document: vscode.TextDocument,
): MarkRanges => {
    const lineRange = document.lineAt(mark.line).range;
    const titleRange = new vscode.Range(
        mark.line,
        mark.startCol,
        mark.line,
        mark.endCol,
    );
    // A selectionRange outside its range makes VSCode reject the symbol, so
    // fall back to the whole line if the columns ever disagree with the document.
    if (!lineRange.contains(titleRange)) {
        return { lineRange, titleRange: lineRange };
    }
    return { lineRange, titleRange };
};
