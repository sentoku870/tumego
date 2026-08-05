// ============ EditorOps ============
// 編集モード専用の石操作（直接配置 / ルール適用配置 / 直接削除 / 移動）を
// 担当するサブモジュール。GameStore から分離し、テスト容易性を向上。
//
// - directPlace: ルール無視で石を配置（編集モード専用）
// - placeWithRulesInEdit: ルール適用して石を配置（編集モード専用）
// - directRemove: ルール無視で石を削除
// - moveStone: 石を別の交点へ移動
import { GameState, Position, StoneColor } from '../types.js';
import { GoEngine } from '../go-engine.js';
import { BoardCacheManager } from './board-cache-manager.js';
import { isValidPosition } from './board-utils.js';

export class EditorOps {
  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly cache: BoardCacheManager
  ) {}

  /** 編集モード専用: ルール無視で直接配置 */
  directPlace(pos: Position, color: StoneColor): boolean {
    if (!isValidPosition(this.state.boardSize, pos)) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = color;
    this.state.board = board;
    this.state.turn++;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: ルール適用して配置 */
  placeWithRulesInEdit(pos: Position, color: StoneColor): boolean {
    const result = this.engine.playMove(this.state, pos, color);
    if (!result) {
      return false;
    }

    this.state.board = result.board;
    this.state.turn++;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: 石を直接削除 */
  directRemove(pos: Position): boolean {
    if (!isValidPosition(this.state.boardSize, pos)) return false;
    if (this.state.board[pos.row][pos.col] === 0) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = 0;
    this.state.board = board;
    this.state.turn = Math.max(0, this.state.turn - 1);
    this.cache.invalidate();
    return true;
  }

  /**
   * 編集モード専用: 石を別の交点へ移動する。
   * from に石がなく、to が盤外、from === to のいずれかの場合は false。
   * 移動先に既存石がある場合は上書き（directPlace と同じ挙動）。
   * 履歴は記録しない（細かい編集は履歴に積まない既存方針と整合）。
   * @returns 移動に成功したか
   */
  moveStone(from: Position, to: Position): boolean {
    if (!isValidPosition(this.state.boardSize, from)) return false;
    if (!isValidPosition(this.state.boardSize, to)) return false;
    if (from.col === to.col && from.row === to.row) return false;

    const color = this.state.board[from.row][from.col];
    if (color === 0) return false;

    // 移動先で同色の石に上書きする場合は実質「無変化」だが、
    // directPlace に揃えて上書き動作とする（仕様: 上書き）
    const board = this.cloneBoard();
    board[from.row][from.col] = 0;
    board[to.row][to.col] = color as StoneColor;
    this.state.board = board;
    this.cache.invalidate();
    return true;
  }

  private cloneBoard(): GameState['board'] {
    return this.state.board.map((row) => row.slice());
  }
}
