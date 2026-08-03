// ============ SGF関連 ============
import { BoardMarker, Move, Position, StoneColor } from './domain.js';

// ============ SGFノードとゲームツリー ============
// SGFNode / GameTree 型は 2026-08-03 の P0 コード整理で削除。
// ver4以降の変化図(分岐図)機能が必要になったタイミングで再導入する。

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
