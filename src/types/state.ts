// ============ ゲーム状態 ============
import {
  AnswerMode,
  BoardMarker,
  CellState,
  MarkerKind,
  Move,
  PlayMode,
  Position,
  StoneColor
} from './domain.js';
import { SGFGameInfo } from './sgf.js';

export interface CapturedCounts {
  black: number;
  white: number;
}

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
