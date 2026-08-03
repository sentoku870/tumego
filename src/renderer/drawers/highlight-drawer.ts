// ============ HighlightDrawer ============
// 直前手のハイライト円 (赤枠) を描画する。
import { LastMoveHighlightRenderInfo } from '../../types/index.js';
import { resolveCssVar, SvgElementFactory } from './svg-helpers.js';

export class HighlightDrawer {
  constructor(private readonly factory: SvgElementFactory) {}

  drawLastMove(highlight: LastMoveHighlightRenderInfo): void {
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
