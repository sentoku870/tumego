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
export type ToggleSetting = 'on' | 'off';
export type DeviceProfile = 'auto' | 'desktop' | 'phone' | 'tablet';
export type BooleanPreference = boolean;

export interface Move {
  col: number;
  row: number;
  color: StoneColor;
}

// ============ SGFノードとゲームツリー ============
export interface SGFNode {
  id: string;
  move?: Move;
  comment?: string;
  label?: string;
  mainLine?: boolean;
  parent?: SGFNode;
  children: SGFNode[];
}

export interface GameTree {
  rootNode: SGFNode;
  currentNode: SGFNode;
  currentPath: SGFNode[];
}

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
  gameTree: GameTree | null;
  sgfLoadedFromExternal: boolean;
  gameInfo: SGFGameInfo;
  capturedCounts: CapturedCounts;
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
  showHistoryDialog(onRestore: (index: number) => void): void;
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

export interface BoardRenderModel {
  readonly geometry: BoardRenderGeometry;
  readonly stars: Position[];
  readonly coordinates: CoordinateLabel[];
  readonly stones: StoneRenderInfo[];
  readonly moveNumbers: MoveNumberRenderInfo[];
  readonly showMoveNumbers: boolean;
  readonly lastMoveHighlight?: LastMoveHighlightRenderInfo;
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
    showCapturedStones: ToggleSetting;
    enableFullReset: ToggleSetting;
    highlightLastMove: BooleanPreference;
    showSolutionMoveNumbers: BooleanPreference;
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
  MOVE_NUM_FONT_RATIO: 0.4
} as const;