// ============ BoardPosition ============
// SVG のクライアント座標を盤面の (col, row) に変換するヘルパ。
// 盤面のフォーカス管理 (tabIndex、pointer フォーカス) も担当する。
import { Position, DEFAULT_CONFIG } from '../../../types.js';

export class BoardPosition {
  constructor(private readonly svg: SVGSVGElement) {}

  /** クライアント座標 → (col, row)。盤外は { col: -1, row: -1 } */
  fromEvent(event: PointerEvent): Position {
    try {
      const point = this.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;

      const ctm = this.svg.getScreenCTM();
      if (!ctm) {
        return { col: -1, row: -1 };
      }

      const svgPoint = point.matrixTransform(ctm.inverse());
      const col = Math.round(
        (svgPoint.x - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE
      );
      const row = Math.round(
        (svgPoint.y - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE
      );
      return { col, row };
    } catch (error) {
      console.error('座標変換エラー:', error);
      return { col: -1, row: -1 };
    }
  }
}
