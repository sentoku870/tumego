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
  /**
   * 置石の数。SGF の HA プロパティに相当。
   *
   * 注: `handicap` (下記) と同値を保持する重複フィールドが存在する
   * (2026-08-05 時点)。`handicap` は `number | null` で null = 置石なし、
   * `handicapStones` は `number` で 0 = 置石なし。型が微妙に異なるため
   * 完全な統合には gameInfo / state の広範な変更が必要で保留中。
   * 読み込み時 (sgf-metadata.ts:37-38)、適用時 (mode-operations.ts:265-267)
   * の両方で同期して設定される。
   */
  handicapStones?: number;
  handicapPositions?: Position[];
  startColor?: StoneColor;
  problemDiagramSet?: boolean;
  problemDiagramBlack?: Position[];
  problemDiagramWhite?: Position[];
  /**
   * 置石の数。SGF の HA プロパティに相当。
   *
   * 注: `handicapStones` (上記) と同値を保持する重複フィールド。
   * 詳細は handicapStones のコメントを参照。
   */
  handicap?: number | null;
}
