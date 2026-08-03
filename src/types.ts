// ============ 基本型定義 ============

export interface Position {
  col: number;
  row: number;
}

export type StoneColor = 1 | 2; // 1: 黒, 2: 白
export type CellState = 0 | StoneColor; // 0: 空, 1: 黒, 2: 白
export type PlayMode = 'black' | 'white' | 'alt';
export type AnswerMode = 'black' | 'white';
export type RulesMode = 'standard' | 'free';
export type DeviceProfile = 'auto' | 'desktop' | 'phone' | 'tablet';
export type BooleanPreference = boolean;

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

// ============ SGFノードとゲームツリー ============
// ver4以降の変化図(分岐図)機能の布石として SGFNode / GameTree 型を保持していたが、
// 2026-08-03 のコード整理で削除。必要になったタイミングで再導入する。

// ============ 設定定数 ============
export interface GameConfig {
  readonly CELL_SIZE: number;
  readonly MARGIN: number;
  readonly STONE_RADIUS: number;
  readonly STAR_RADIUS: number;
  readonly MAX_BOARD_SIZE: number;
  readonly MIN_BOARD_SIZE: number;
  readonly DEFAULT_BOARD_SIZE: number;
  readonly DEFAULT_KOMI: number;
  readonly COORD_FONT_RATIO: number;
  readonly MOVE_NUM_FONT_RATIO: number;
  /** 座標ラベル X 軸オフセット（盤外側） */
  readonly COORD_LABEL_OFFSET_X: number;
  /** 座標ラベル Y 軸オフセット（盤外側） */
  readonly COORD_LABEL_OFFSET_Y: number;
  /** モバイル判定の window.innerWidth 閾値 (px) */
  readonly MOBILE_BREAKPOINT: number;
  /** 横レイアウト・モバイル時の予約幅 (px) */
  readonly MOBILE_HORIZONTAL_RESERVED: number;
  /** 横レイアウト・デスクトップ時の予約幅 (px) */
  readonly DESKTOP_HORIZONTAL_RESERVED: number;
  /** QR データサイズしきい値 (SGF 文字数) */
  readonly QR_DATA_SMALL: number;
  readonly QR_DATA_MEDIUM: number;
  readonly QR_DATA_LARGE: number;
  /** QR コード画像サイズ (URL クエリ) */
  readonly QR_IMAGE_SMALL: string;
  readonly QR_IMAGE_MEDIUM: string;
  readonly QR_IMAGE_LARGE: string;
  /** 解答シーケンス番号表示: 数字描画の背景円半径係数 */
  readonly MOVE_NUM_BG_RADIUS_RATIO: number;
  /** 解答シーケンス番号表示: 黒枠の余白 (px) */
  readonly MOVE_NUM_BORDER_MARGIN: number;
  /** 解答シーケンス番号表示: 数字のフォントサイズ係数 */
  readonly MOVE_NUM_FONT_SCALE: number;
  /** 解答シーケンス番号表示: 数字のストローク幅係数 */
  readonly MOVE_NUM_STROKE_RATIO: number;
  /** 直前手のハイライト半径オフセット (px) */
  readonly LAST_MOVE_HIGHLIGHT_OFFSET: number;
  /** マーカー描画の基本半径 (px) — 石の内側に収まるよう STONE_RADIUS 未満 */
  readonly MARKER_RADIUS: number;
  /** マーカー枠線の太さ (px) */
  readonly MARKER_STROKE_WIDTH: number;
  /** 盤面保存時にコピー対象とする CSS 変数名 */
  readonly BOARD_CAPTURE_CSS_VARS: readonly string[];
}

// ============ ゲーム状態 ============
export interface GameState {
  boardSize: number;
  board: CellState[][];
  mode: PlayMode;
  eraseMode: boolean;
  history: CellState[][][];
  turn: number;
  sgfMoves: Move[];
  numberMode: boolean;
  startColor: StoneColor;
  sgfIndex: number;
  numberStartIndex: number;
  komi: number;
  handicapStones: number;
  handicapPositions: Position[];
  answerMode: AnswerMode;
  problemDiagramSet: boolean;
  problemDiagramBlack: Position[];
  problemDiagramWhite: Position[];
  sgfLoadedFromExternal: boolean;
  gameInfo: SGFGameInfo;
  capturedCounts: CapturedCounts;
  /** 表示中のマーカー集合（編集・解答モードとも） */
  markers: BoardMarker[];
  /** マーカーモードがオンか */
  markerMode: boolean;
  /** 現在選択中のマーカー種別 */
  activeMarkerKind: MarkerKind | null;
  /** LB 種別のとき現在選択中のラベル文字 */
  activeMarkerLabel: string | null;
  /** 問題図レベル（sgfIndex === 0）で配置されたマーカー */
  rootMarkers: BoardMarker[];
  /** 各着手ノードに紐づくマーカー（SGF往復用、sgfMoves と並行配列） */
  nodeMarkers: BoardMarker[][];
}

// ============ UI要素 ============
export interface UIElements {
  svg: SVGSVGElement;
  boardWrapper: HTMLElement;
  infoEl: HTMLElement;
  sliderEl: HTMLInputElement;
  movesEl: HTMLElement;
  msgEl: HTMLElement;
  capturedEl?: HTMLElement;
}

// ============ 操作履歴 ============
export type HistorySnapshotState = Pick<
  GameState,
  | "boardSize"
  | "board"
  | "mode"
  | "eraseMode"
  | "turn"
  | "numberMode"
  | "answerMode"
  | "problemDiagramSet"
  | "problemDiagramBlack"
  | "problemDiagramWhite"
  | "handicapStones"
  | "handicapPositions"
  | "startColor"
  | "sgfMoves"
  | "sgfIndex"
  | "numberStartIndex"
  | "komi"
  | "sgfLoadedFromExternal"
  | "capturedCounts"
  | "markers"
  | "rootMarkers"
  | "nodeMarkers"
>;

export interface HistorySnapshot {
  timestamp: Date;
  label: string;
  state: HistorySnapshotState;
}

export interface OperationHistory {
  save(label: string, state: GameState): void;
  restore(index: number, currentState: GameState): boolean;
  restoreLast(currentState: GameState): boolean;
  getList(): HistoryItem[];
  clear(): void;
}

export interface HistoryItem {
  index: number;
  label: string;
  timestamp: Date;
  timeString: string;
}

// ============ ドラッグ状態 ============
export interface DragState {
  dragging: boolean;
  dragColor: StoneColor | null;
  lastPos: Position | null;
}

// ============ グループと呼吸点 ============
export interface GroupInfo {
  stones: Position[];
  libs: number;
}

export interface GameInfo {
  title: string;
  playerBlack: string | null;
  playerWhite: string | null;
  komi: number | null;
  result: string | null;
}

// ============ SGF関連 ============
export interface SGFParseResult {
  moves: Move[];
  gameInfo: SGFGameInfo;
  rawSGF?: string;
  /** ルートノード（問題図レベル）のマーカー */
  rootMarkers?: BoardMarker[];
  /** 各着手ノードに紐づくマーカー。sgfMoves と並行配列 */
  nodeMarkers?: BoardMarker[][];
}

export interface SGFGameInfo extends GameInfo {
  boardSize?: number;
  komi: number | null;
  handicapStones?: number;
  handicapPositions?: Position[];
  startColor?: StoneColor;
  problemDiagramSet?: boolean;
  problemDiagramBlack?: Position[];
  problemDiagramWhite?: Position[];
  handicap?: number | null;
}

// ============ イベント関連 ============
// ============ ユーティリティ型 ============
export type Board = CellState[][];

// ============ レンダリング用ビュー型 ============
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

// ============ エンジン関連 ============
export interface MoveResult {
  readonly board: Board;
  readonly captured: Position[];
  /**
   * If a simple ko was created by the last move, this marks the forbidden
   * point for the opponent's immediate reply. `null` means no ko restriction.
   */
  readonly koPoint?: Position | null;
}

// ============ 設定 ============
export interface Preferences {
  edit: { rulesMode: RulesMode };
  solve: {
    showCapturedStones: boolean;
    enableFullReset: boolean;
    highlightLastMove: BooleanPreference;
    showSolutionMoveNumbers: BooleanPreference;
    /** 盤面マーカーを表示するか */
    showMarkers: BooleanPreference;
    /** 同一交点に複数のマーカーを重ねられるか */
    allowMultiMarker: BooleanPreference;
  };
  ui: { deviceProfile: DeviceProfile };
}

export interface CapturedCounts {
  black: number;
  white: number;
}

// ============ 定数 ============
export const DEFAULT_CONFIG: GameConfig = {
  CELL_SIZE: 60,
  MARGIN: 30,
  STONE_RADIUS: 26,
  STAR_RADIUS: 4,
  MAX_BOARD_SIZE: 19,
  MIN_BOARD_SIZE: 9,
  DEFAULT_BOARD_SIZE: 9,
  DEFAULT_KOMI: 6.5,
  COORD_FONT_RATIO: 0.28,
  MOVE_NUM_FONT_RATIO: 0.4,
  COORD_LABEL_OFFSET_X: 20,
  COORD_LABEL_OFFSET_Y: 15,
  MOBILE_BREAKPOINT: 768,
  MOBILE_HORIZONTAL_RESERVED: 250,
  DESKTOP_HORIZONTAL_RESERVED: 350,
  QR_DATA_SMALL: 800,
  QR_DATA_MEDIUM: 1500,
  QR_DATA_LARGE: 2500,
  QR_IMAGE_SMALL: '300x300',
  QR_IMAGE_MEDIUM: '400x400',
  QR_IMAGE_LARGE: '500x500',
  MOVE_NUM_BG_RADIUS_RATIO: 1.15,
  MOVE_NUM_BORDER_MARGIN: 2,
  MOVE_NUM_FONT_SCALE: 1.20,
  MOVE_NUM_STROKE_RATIO: 0.22,
  LAST_MOVE_HIGHLIGHT_OFFSET: 5,
  MARKER_RADIUS: 22,
  MARKER_STROKE_WIDTH: 3,
  BOARD_CAPTURE_CSS_VARS: ['--board', '--line', '--star', '--coord', '--black', '--white', '--accent'],
} as const;