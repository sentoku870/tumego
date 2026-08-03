import { resolveCssVar } from './svg-helpers.js';
export class HighlightDrawer {
    constructor(factory) {
        this.factory = factory;
    }
    drawLastMove(highlight) {
        // --accent を解決してインライン stroke として設定する（盤面保存の
        // cloneNode(true) → SVG→PNG 変換で CSS クラスが効かないため）
        const accent = resolveCssVar('--accent', '#d9534f');
        this.factory.append('circle', {
            cx: highlight.cx.toString(),
            cy: highlight.cy.toString(),
            r: highlight.radius.toString(),
            class: 'last-move-highlight',
            style: `fill: none; stroke: ${accent};`,
        });
    }
}
//# sourceMappingURL=highlight-drawer.js.map