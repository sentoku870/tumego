// ============ 基本型定義 ============

export interface Position {
  col: number;
  row: number;
}

export type StoneColor = 1 | 2; // 1: 黒, 2: 白
export type CellState = 0 | StoneColor; // 0: 空, 1: 黒, 2: 白
export type Board = CellState[][];
export type PlayMode = 'black' | 'white' | 'alt';
export type AnswerMode = 'black' | 'white';
export type RulesMode = 'standard' | 'free';
export type DeviceProfile = 'auto' | 'desktop' | 'phone' | 'tablet';
export type BooleanPreference = boolean;
/**
 * 横レイアウト時のパネルと碁盤の左右配置。
 * 'board-left'  : 碁盤が左、パネルが右（既定）
 * 'board-right' : パネルが左、碁盤が右
 */
export type PanelPosition = 'board-left' | 'board-right';

/** 盤面マーカーの種類。SGF FF4 の CR/TR/SQ/MA/LB に対応。 */
export type MarkerKind = 'CR' | 'TR' | 'SQ' | 'MA' | 'LB';

export interface BoardMarker {
  pos: Position;
  kind: MarkerKind;
  /** LB 種別のとき表示する 1〜数文字のラベル */
  label?: string;
}

/** LB（ラベル）マーカーで自動進転する文字のシーケンス。配置ごとに次へ進む。 */
export const MARKER_LETTER_SEQUENCE = ['A', 'B', 'C', 'D', 'E'] as const;
export type MarkerLetter = (typeof MARKER_LETTER_SEQUENCE)[number];

/** 次のラベル文字を返す（シーケンス末尾で先頭に戻る） */
export function nextMarkerLetter(current: string | null | undefined): MarkerLetter {
  if (!current) return MARKER_LETTER_SEQUENCE[0];
  const idx = MARKER_LETTER_SEQUENCE.indexOf(current as MarkerLetter);
  if (idx < 0) return MARKER_LETTER_SEQUENCE[0];
  return MARKER_LETTER_SEQUENCE[(idx + 1) % MARKER_LETTER_SEQUENCE.length];
}

export interface Move {
  col: number;
  row: number;
  color: StoneColor;
}
