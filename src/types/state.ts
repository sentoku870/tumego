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
  /**
   * 簡易コウの禁手位置。最後に着手で 1 石捕獲 + 着手石グループが 1 石・1 呼吸点
   * となった場合に設定される。null なら禁手なし。
   * 同一ゲーム内でコウ判定を保つために state に保持する（インスタンス状態にしない）。
   */
  koPoint: Position | null;
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
  | "gameInfo"
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
export interface GrabbedStoneInfo {
  /** 掴んだ石の元の位置 */
  pos: Position;
  /** 掴んだ石の色（スナップショット）。移動中は色が変動しないため保持 */
  color: StoneColor;
}

export interface DragState {
  dragging: boolean;
  dragColor: StoneColor | null;
  lastPos: Position | null;
  /** 長押しで掴んでいる石の情報。null のときは未掴み状態 */
  grabbedStone: GrabbedStoneInfo | null;
}

// ============ グループと呼吸点 ============
export interface GroupInfo {
  stones: Position[];
  libs: number;
}
