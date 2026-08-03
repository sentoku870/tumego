// ============ SGF 座標変換ヘルパ ============
// SGF FF4 の座標表現 ('aa' 〜 'ss') と内部の数値 (col, row) を相互変換する
// 純粋関数。座標は "aa" が左下原点 (col=0, row=0)。
import { Position } from './types.js';

/**
 * (col, row) を SGF 文字列 ('aa' 〜 'ss') に変換する。
 */
export function positionToSgf(pos: Position): string {
  return `${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}`;
}

/**
 * SGF 文字列 ('aa' 〜 'ss') を (col, row) に変換する。
 * 不正な文字列 (長さ ≠ 2、または a-z 外) は null を返す。
 */
export function sgfToPosition(coord: string): Position | null {
  if (coord.length !== 2) return null;
  const col = coord.charCodeAt(0) - 97;
  const row = coord.charCodeAt(1) - 97;
  if (col < 0 || col > 25 || row < 0 || row > 25) return null;
  return { col, row };
}

/**
 * (col, row) を `[aa]` 形式にラップして返す。
 */
export function positionToSgfBracket(pos: Position): string {
  return `[${positionToSgf(pos)}]`;
}
