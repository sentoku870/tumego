// ============ StonesDrawer ============
// 石と着手番号を描画する。
// drawStones: 黒白石 (circle) を描画
// drawMoveNumbers: 背景円 + 数字テキストを描画 (白文字/黒文字を切替)
import {
  DEFAULT_CONFIG,
  MoveNumberRenderInfo,
  StoneRenderInfo
} from '../../types/index.js';
import { SvgElementFactory } from './svg-helpers.js';

export class StonesDrawer {
  constructor(private readonly factory: SvgElementFactory) {}

  drawStones(stones: StoneRenderInfo[]): void {
    stones.forEach(stone => {
      const className = stone.grabbed ? 'stone grabbed-stone' : 'stone';
      this.factory.append('circle', {
        cx: stone.cx.toString(),
        cy: stone.cy.toString(),
        r: stone.radius.toString(),
        class: className,
        fill: stone.fill,
        stroke: '#000',
        'stroke-width': stone.strokeWidth.toString()
      });
    });
  }

  drawMoveNumbers(numbers: MoveNumberRenderInfo[]): void {
    const stoneRadius = DEFAULT_CONFIG.STONE_RADIUS;
    const borderMargin = DEFAULT_CONFIG.MOVE_NUM_BORDER_MARGIN;

    numbers.forEach(number => {
      const idealRadius = number.fontSize * DEFAULT_CONFIG.MOVE_NUM_BG_RADIUS_RATIO;
      const maxRadius = stoneRadius - borderMargin;
      const bgRadius = Math.min(idealRadius, maxRadius);

      const bgColor = number.fill === '#000'
        ? '#ffffff'
        : '#000000';

      this.factory.append('circle', {
        cx: number.cx.toString(),
        cy: number.cy.toString(),
        r: bgRadius.toString(),
        fill: bgColor,
        filter: 'url(#num-shadow)'
      });

      const text = this.factory.append('text', {
        x: number.cx.toString(),
        y: number.cy.toString(),
        fill: number.fill,
        class: 'move-num',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      });

      const size = number.fontSize * DEFAULT_CONFIG.MOVE_NUM_FONT_SCALE;
      text.setAttribute('font-weight', '900');
      text.setAttribute('font-size', size.toString());

      const strokeColor = number.fill === '#000' ? '#fff' : '#000';
      text.setAttribute('stroke', strokeColor);
      text.setAttribute('stroke-width', (size * DEFAULT_CONFIG.MOVE_NUM_STROKE_RATIO).toString());
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('filter', 'url(#num-shadow)');

      text.textContent = number.text;
    });
  }
}
