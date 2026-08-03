// ============ BoardDrawer ============
// 盤面の格子線と星を描画する。
import { Position } from '../../types/index.js';
import { RendererGeometry } from '../view-model.js';
import { SvgElementFactory, STROKE_DEFAULT, STAR_RADIUS } from './svg-helpers.js';

export class BoardDrawer {
  constructor(private readonly factory: SvgElementFactory) {}

  /** 盤面の格子線を描画する */
  drawLines(geometry: RendererGeometry): void {
    const margin = geometry.margin;
    const far = geometry.viewBoxSize - margin;

    for (let i = 0; i < geometry.boardSize; i++) {
      const pos = geometry.coordinateAt(i);

      this.factory.append('line', {
        x1: pos.toString(),
        y1: margin.toString(),
        x2: pos.toString(),
        y2: far.toString(),
        stroke: STROKE_DEFAULT,
        'stroke-width': '2'
      });

      this.factory.append('line', {
        x1: margin.toString(),
        y1: pos.toString(),
        x2: far.toString(),
        y2: pos.toString(),
        stroke: STROKE_DEFAULT,
        'stroke-width': '2'
      });
    }
  }

  /** 星 (9/13/19 路盤の定位置) を描画する */
  drawStars(geometry: RendererGeometry, stars: Position[]): void {
    stars.forEach(({ col, row }) => {
      const { cx, cy } = geometry.toPixel({ col, row });

      this.factory.append('circle', {
        cx: cx.toString(),
        cy: cy.toString(),
        r: STAR_RADIUS.toString(),
        class: 'star'
      });
    });
  }
}
