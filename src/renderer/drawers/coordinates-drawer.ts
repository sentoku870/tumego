// ============ CoordinatesDrawer ============
// 盤面の座標ラベル (A, B, ..., 1, 2, ...) を描画する。
import { CoordinateLabel } from '../../types/index.js';
import { SvgElementFactory } from './svg-helpers.js';

export class CoordinatesDrawer {
  constructor(private readonly factory: SvgElementFactory) {}

  draw(labels: CoordinateLabel[]): void {
    labels.forEach(label => {
      const text = this.factory.append('text', {
        x: label.x.toString(),
        y: label.y.toString(),
        class: label.className,
        'font-size': label.fontSize.toString()
      });
      text.textContent = label.text;
    });
  }
}
