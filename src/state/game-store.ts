// ============ GameStore (Facade) ============
// 盤面キャッシュ・置石・モード遷移・計測を内部の専用クラスへ委譲するファサード。
// 公開API（既存呼び出し側との互換性）は維持する。
import {
  Board,
  CapturedCounts,
  CellState,
  DEFAULT_CONFIG,
  GameInfo,
  GameState,
  Position,
  SGFGameInfo,
  StoneColor,
} from "../types.js";
import { GoEngine } from "../go-engine.js";
import { HistoryManager } from "../history-manager.js";
import { BoardCacheManager } from "./board-cache-manager.js";
import { HandicapSetter } from "./handicap-setter.js";
import { ModeOperations } from "./mode-operations.js";
import {
  PerformanceMetrics,
  PerformanceMonitor,
} from "./performance-monitor.js";

export class GameStore {
  private readonly cache: BoardCacheManager;
  private readonly modeOps: ModeOperations;
  private readonly handicap: HandicapSetter;
  private readonly monitor: PerformanceMonitor;

  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {
    this.monitor = new PerformanceMonitor();
    this.cache = new BoardCacheManager(state, engine, this.monitor);
    this.modeOps = new ModeOperations(state, history, this.cache);
    this.handicap = new HandicapSetter(state, engine, history, this.modeOps, this.cache);

    if (!this.state.capturedCounts) {
      this.state.capturedCounts = { black: 0, white: 0 };
    }

    if (!this.state.gameInfo) {
      this.state.gameInfo = this.createDefaultGameInfo();
    } else {
      this.state.gameInfo = {
        ...this.createDefaultGameInfo(),
        ...this.state.gameInfo,
        komi:
          this.state.gameInfo.komi ??
          this.state.komi ??
          DEFAULT_CONFIG.DEFAULT_KOMI,
      };
    }
  }

  // ============================================================
  // 公開: 状態参照
  // ============================================================

  get snapshot(): GameState {
    return this.state;
  }

  get historyManager(): HistoryManager {
    return this.history;
  }

  get currentColor(): StoneColor {
    if (this.state.numberMode) {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }

    if (this.state.mode === "alt") {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }

    return this.state.mode === "black" ? 1 : 2;
  }

  // ============================================================
  // 公開: ゲーム情報
  // ============================================================

  getGameInfo(): GameInfo {
    const info = this.state.gameInfo ?? this.createDefaultGameInfo();

    return {
      title: info.title ?? "",
      playerBlack: info.playerBlack ?? null,
      playerWhite: info.playerWhite ?? null,
      komi:
        info.komi ?? this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: info.result ?? null,
    };
  }

  updateGameInfo(patch: Partial<GameInfo>): void {
    const current = this.getGameInfo();
    const next: GameInfo = {
      ...current,
      ...patch,
    };

    if (patch.komi !== undefined) {
      if (typeof patch.komi === "number" && Number.isFinite(patch.komi)) {
        this.state.komi = patch.komi;
        next.komi = patch.komi;
      } else {
        next.komi = current.komi;
      }
    }

    this.state.gameInfo = {
      ...this.state.gameInfo,
      ...next,
      komi: next.komi,
    };
  }

  // ============================================================
  // 公開: 着手・石操作
  // ============================================================

  tryMove(pos: Position, color: StoneColor, record = true): boolean {
    const moveColor = this.currentColor;
    const result = this.engine.playMove(this.state, pos, moveColor);
    if (!result) {
      return false;
    }

    this.state.history.push(this.cloneBoard());
    this.state.board = result.board;
    this.state.turn++;

    if (record) {
      this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
      this.state.sgfMoves.push({ col: pos.col, row: pos.row, color: moveColor });
      this.state.sgfIndex = this.state.sgfMoves.length;
    }

    this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
    return true;
  }

  removeStone(pos: Position): boolean {
    if (!this.isValidPosition(pos)) {
      return false;
    }

    const currentStone = this.state.board[pos.row][pos.col];
    if (currentStone === 0) {
      return false;
    }

    if (this.state.sgfLoadedFromExternal || this.state.numberMode) {
      const removeIndex = this.cache.findLastMoveIndex(
        pos,
        currentStone as StoneColor
      );

      if (removeIndex === -1) {
        this.state.board[pos.row][pos.col] = 0;
        this.cache.invalidate();
        return true;
      }

      this.state.sgfMoves = this.state.sgfMoves.slice(0, removeIndex);
      this.state.sgfIndex = this.state.sgfMoves.length;
      this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
      this.cache.invalidate();
      return true;
    }

    this.state.board[pos.row][pos.col] = 0;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: ルール無視で直接配置 */
  directPlace(pos: Position, color: StoneColor): boolean {
    if (!this.isValidPosition(pos)) return false;

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

    this.state.history.push(this.cloneBoard());
    this.state.board = result.board;
    this.state.turn++;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: 石を直接削除 */
  directRemove(pos: Position): boolean {
    if (!this.isValidPosition(pos)) return false;
    if (this.state.board[pos.row][pos.col] === 0) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = 0;
    this.state.board = board;
    this.state.turn = Math.max(0, this.state.turn - 1);
    this.cache.invalidate();
    return true;
  }

  // ============================================================
  // 公開: 盤面初期化・履歴復元・手数移動
  // ============================================================

  initBoard(size: number, options?: { skipHistory?: boolean }): void {
    this.modeOps.initBoard(size, options);
  }

  undo(): boolean {
    const restored = this.history.restoreLast(this.state);
    if (restored) {
      this.applyAfterHistoryRestore();
    }
    return restored;
  }

  restoreHistorySnapshot(index: number): boolean {
    const restored = this.history.restore(index, this.state);
    if (restored) {
      this.applyAfterHistoryRestore();
    }
    return restored;
  }

  setMoveIndex(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
    const result = this.cache.setMoveIndex(clamped);
    this.applyRebuildResult(result);
    this.state.sgfIndex = clamped;
  }

  /**
   * 後方互換のため公開。盤面タイムラインを指定手数まで再構築し state を更新する。
   * 戻り値は最終盤面（後方互換のため Board | null 型）。
   */
  rebuildBoardFromMoves(limit: number): Board | null {
    const result = this.cache.rebuildBoardFromMoves(limit);
    this.applyRebuildResult(result);
    return result.board;
  }

  // ============================================================
  // 公開: モード遷移（ModeOperations への委譲）
  // ============================================================

  startNumberMode(color: StoneColor): void {
    this.modeOps.startNumberMode(color);
  }

  setProblemDiagram(): void {
    this.modeOps.setProblemDiagram();
  }

  restoreProblemDiagram(): void {
    this.modeOps.restoreProblemDiagram();
  }

  hasProblemDiagram(): boolean {
    return this.modeOps.hasProblemDiagram();
  }

  enterSolveMode(): void {
    this.modeOps.enterSolveMode();
  }

  exitSolveModeToEmptyBoard(): void {
    this.modeOps.exitSolveModeToEmptyBoard();
  }

  resetForClearAll(): void {
    this.modeOps.resetForClearAll();
  }

  // ============================================================
  // 公開: 置石（HandicapSetter への委譲）
  // ============================================================

  setHandicap(stones: number | string): void {
    this.handicap.apply(stones);
  }

  // ============================================================
  // 公開: パフォーマンス計測
  // ============================================================

  setPerformanceDebugging(enabled: boolean, reset = true): void {
    this.monitor.setEnabled(enabled, reset);
  }

  resetPerformanceMetrics(): void {
    this.monitor.reset();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.monitor.getMetrics();
  }

  // ============================================================
  // Internal
  // ============================================================

  private createDefaultGameInfo(): SGFGameInfo {
    return {
      title: "",
      playerBlack: null,
      playerWhite: null,
      komi: this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: null,
      handicap: null,
      handicapStones: 0,
      handicapPositions: [],
      boardSize: this.state.boardSize,
      startColor: this.state.startColor,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: [],
    };
  }

  private applyRebuildResult(result: {
    board: Board;
    history: Board[];
    turn: number;
    counts: CapturedCounts;
  }): void {
    this.state.board = result.board;
    this.state.history = result.history;
    this.state.turn = result.turn;
    this.state.capturedCounts = result.counts;
  }

  private applyAfterHistoryRestore(): void {
    this.state.sgfIndex = Math.max(
      0,
      Math.min(this.state.sgfIndex, this.state.sgfMoves.length)
    );
    this.state.numberStartIndex = Math.max(
      0,
      Math.min(this.state.numberStartIndex, this.state.sgfMoves.length)
    );

    const result = this.cache.rebuildCacheFromHistoryRestore(
      this.state.sgfIndex,
      this.state.numberStartIndex
    );
    this.state.history = result.history;
    this.state.turn = result.turn;
    this.state.capturedCounts = result.counts;

    this.syncKomiToGameInfo();
  }

  private syncKomiToGameInfo(): void {
    this.state.gameInfo = {
      ...this.state.gameInfo,
      komi: this.state.komi,
    };
  }

  private cloneBoard(): Board {
    return this.state.board.map((row) => row.slice());
  }

  private isValidPosition(pos: Position): boolean {
    return (
      pos.col >= 0 &&
      pos.col < this.state.boardSize &&
      pos.row >= 0 &&
      pos.row < this.state.boardSize
    );
  }
}
