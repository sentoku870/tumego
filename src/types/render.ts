// ============ レンダリング用ビュー型 ============
import { MarkerKind, Position } from './domain.js';

export interface BoardRenderGeometry {
  readonly boardSize: number;
  readonly cellSize: number;
  readonly margin: number;
  readonly viewBoxSize: number;
  readonly coordFontSize: number;
  readonly moveNumberFontSize: number;
  readonly letters: string[];
  coordinateAt(index: number): number;
  toPixel(pos: Position): { cx: number; cy: number };
}

export interface CoordinateLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly className: string;
}

export interface StoneRenderInfo {
  readonly position: Position;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly fill: string;
  readonly strokeWidth: number;
  /** 長押しで掴まれている石に true を設定（ハイライト表示用） */
  readonly grabbed?: boolean;
}

export interface MoveNumberRenderInfo {
  readonly cx: number;
  readonly cy: number;
  readonly fontSize: number;
  readonly fill: string;
  readonly text: string;
}

export interface LastMoveHighlightRenderInfo {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

export interface MarkerRenderInfo {
  readonly cx: number;
  readonly cy: number;
  readonly kind: MarkerKind;
  readonly radius: number;
  /** LB 種別のとき表示するラベル文字列 */
  readonly label?: string;
}

export interface BoardRenderModel {
  readonly geometry: BoardRenderGeometry;
  readonly stars: Position[];
  readonly coordinates: CoordinateLabel[];
  readonly stones: StoneRenderInfo[];
  readonly moveNumbers: MoveNumberRenderInfo[];
  readonly showMoveNumbers: boolean;
  readonly lastMoveHighlight?: LastMoveHighlightRenderInfo;
  readonly markers: MarkerRenderInfo[];
  readonly showMarkers: boolean;
}

export interface InfoRenderModel {
  readonly infoText: string;
  readonly movesText: string;
}

export interface SliderRenderModel {
  readonly max: number;
  readonly value: number;
}
