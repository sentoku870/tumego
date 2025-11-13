// ============ 基本型定義 ============

export interface Position {
  col: number;
  row: number;
}

export type StoneColor = 1 | 2; // 1: 黒, 2: 白
export type CellState = 0 | StoneColor; // 0: 空, 1: 黒, 2: 白
export type PlayMode = 'black' | 'white' | 'alt';
export type AnswerMode = 'black' | 'white';

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
}

// ============ UI要素 ============
export interface UIElements {
  svg: SVGSVGElement;
  boardWrapper: HTMLElement;
  infoEl: HTMLElement;
  sliderEl: HTMLInputElement;
  movesEl: HTMLElement;
  msgEl: HTMLElement;
}

// ============ 操作履歴 ============
export interface HistorySnapshot {
  timestamp: Date;
  description: string;
  state: GameState;
}

export interface OperationHistory {
  snapshots: HistorySnapshot[];
  maxSnapshots: number;
  save(description: string): void;
  restore(index: number): boolean;
  getList(): HistoryItem[];
  clear(): void;
}

export interface HistoryItem {
  index: number;
  description: string;
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

// ============ SGF関連 ============
export interface SGFParseResult {
  moves: Move[];
  gameInfo: Partial<GameState>;
}

// ============ イベント関連 ============
export interface KeyBindings {
  [key: string]: () => void;
}

// ============ ユーティリティ型 ============
export type Board = CellState[][];

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