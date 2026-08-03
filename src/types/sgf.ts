// ============ SGF関連 ============
import { BoardMarker, Move, Position, StoneColor } from './domain.js';

// ============ SGFノードとゲームツリー ============
// ver4以降の変化図(分岐図)機能の布石として SGFNode / GameTree 型を保持。
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

// ============ SGF パース結果と対局情報 ============
export interface GameInfo {
  title: string;
  playerBlack: string | null;
  playerWhite: string | null;
  komi: number | null;
  result: string | null;
}

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
