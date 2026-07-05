// Pure builder for the decoration render options of a mark's horizontal rule.
// Must never import "vscode"; the returned object is structurally a subset of
// vscode.DecorationRenderOptions and spreads straight into
// createTextEditorDecorationType (see src/decorations.ts).
import { topOnlyRuleWidthPx } from './borderWidth';
import { MarkConfig } from './config';

/** The subset of vscode.DecorationRenderOptions this builder produces. */
export interface RuleRenderOptions {
    borderWidth?: string;
    borderStyle?: string;
    borderColor?: string;
    before?: { contentText: string; textDecoration: string };
}

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
export const ruleRenderOptions = (config: MarkConfig): RuleRenderOptions => {
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
