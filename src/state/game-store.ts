import {
  Board,
  CellState,
  CapturedCounts,
  GameState,
  Position,
  GameInfo,
  SGFGameInfo,
  StoneColor,
  DEFAULT_CONFIG,
} from "../types.js";
import { GoEngine } from "../go-engine.js";
import { HistoryManager } from "../history-manager.js";

interface RebuildMetrics {
  callCount: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastLimit: number;
  lastAppliedMoves: number;
}

interface PerformanceMetrics {
  rebuildBoardFromMoves: RebuildMetrics;
}

type HandicapMode = "even" | "no-komi" | "fixed";

interface HandicapContext {
  readonly mode: HandicapMode;
  readonly stones: number;
  readonly positions: Position[];
}

/**
 * Centralizes all mutations against {@link GameState}. Rendering and UI layers
 * interact through this class to keep domain logic encapsulated.
 */
export class GameStore {
  // === Cache-related fields (from PR57) ===
  private cachedBoardState: Board | null = null;
  private cachedAppliedMoveIndex: number | null = null;
  private cachedBoardTimeline: Board[] = [];
  private cachedMoveApplied: boolean[] = [];
  private capturedCountsTimeline: CapturedCounts[] = [];

  // === Performance metrics (from main branch) ===
  private performanceDebug = false;
  private performanceMetrics: PerformanceMetrics = {
    rebuildBoardFromMoves: this.createRebuildMetrics(),
  };

  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {
    if (!this.state.capturedCounts) {
      this.state.capturedCounts = { black: 0, white: 0 };
    }

    if (!this.state.gameInfo) {
      this.state.gameInfo = this.createDefaultGameInfo();
    } else {
      this.state.gameInfo = {
        ...this.createDefaultGameInfo(),
        ...this.state.gameInfo,
        komi: this.state.gameInfo.komi ?? this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      };
    }
  }

  get snapshot(): GameState {
    return this.state;
  }

  getGameInfo(): GameInfo {
    const info = this.state.gameInfo ?? this.createDefaultGameInfo();

    return {
      title: info.title ?? "",
      playerBlack: info.playerBlack ?? null,
      playerWhite: info.playerWhite ?? null,
      komi: info.komi ?? this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
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

  get historyManager(): HistoryManager {
    return this.history;
  }

  setPerformanceDebugging(enabled: boolean, reset = true): void {
    this.performanceDebug = enabled;
    if (reset) {
      this.resetPerformanceMetrics();
    }
  }

  resetPerformanceMetrics(): void {
    this.performanceMetrics.rebuildBoardFromMoves = this.createRebuildMetrics();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      rebuildBoardFromMoves: {
        ...this.performanceMetrics.rebuildBoardFromMoves,
      },
    };
  }

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

  private syncKomiToGameInfo(): void {
    this.state.gameInfo = {
      ...this.state.gameInfo,
      komi: this.state.komi,
    };
  }

tryMove(pos: Position, color: StoneColor, record = true): boolean {
  // ★ color 引数は無視し、現在の正しい手番を色とする
  const moveColor = this.currentColor;

  const result = this.engine.playMove(this.state, pos, moveColor);
  if (!result) {
    return false;
  }

  this.pushHistorySnapshot();
  this.state.board = result.board;
  this.state.turn++;

  if (record) {
    this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
    this.state.sgfMoves.push({ col: pos.col, row: pos.row, color: moveColor });
    this.state.sgfIndex = this.state.sgfMoves.length;
  }

  this.rebuildBoardFromMoves(this.state.sgfIndex);
  this.invalidateCache();
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
      const removeIndex = this.findLastMoveIndex(
        pos,
        currentStone as StoneColor
      );

      if (removeIndex === -1) {
        const board = this.cloneBoard();
        board[pos.row][pos.col] = 0;
        this.state.board = board;
        this.invalidateCache();
        return true;
      }

      this.state.sgfMoves = this.state.sgfMoves.slice(0, removeIndex);
      this.state.sgfIndex = this.state.sgfMoves.length;
      this.rebuildBoardFromMoves(this.state.sgfIndex);
      this.invalidateCache();
      return true;
    }

    const board = this.cloneBoard();
    board[pos.row][pos.col] = 0;
    this.state.board = board;
    this.invalidateCache();
    return true;
  }

  initBoard(size: number, options?: { skipHistory?: boolean }): void {
    const skipHistory = options?.skipHistory ?? false;

    if (!skipHistory && this.hasGameData()) {
      this.saveToHistory(`${this.state.boardSize}路盤→${size}路盤 変更前`);
    }

    this.state.boardSize = size;
    this.resetToEmptyEditState({ preserveProblemDiagram: false });
  }

  undo(): boolean {
    if (this.state.numberMode) {
      return this.undoSolveMove();
    }

    const restored =
      typeof this.history.restoreLast === "function"
        ? this.history.restoreLast(this.state)
        : false;
    if (restored) {
      this.afterHistoryRestore();
    }

    return restored;
  }

  restoreHistorySnapshot(index: number): boolean {
    const restored = this.history.restore(index, this.state);
    if (restored) {
      this.afterHistoryRestore();
    }

    return restored;
  }

  setMoveIndex(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
    let board = this.resolveBoardThroughCache(clamped);

    if (!board) {
      this.performFullReset(clamped);
      board = this.cachedBoardTimeline[clamped] ?? this.cachedBoardState;
    }

    if (!board) {
      board = this.cloneBoard();
    }

    this.applyCachedBoard(clamped, board);
  }

  startNumberMode(color: StoneColor): void {
    this.state.numberMode = true;
    this.state.startColor = color;

    this.state.numberStartIndex = 0; // ★番号の起点は常に 0
    this.state.sgfIndex = 0;

    this.state.turn = 0;
    this.state.history = [];
    this.invalidateCache();
  }

  setProblemDiagram(): void {
    const blackPositions: Position[] = [];
    const whitePositions: Position[] = [];

    for (let row = 0; row < this.state.boardSize; row++) {
      for (let col = 0; col < this.state.boardSize; col++) {
        const cell = this.state.board[row][col];
        if (cell === 1) {
          blackPositions.push({ col, row });
        } else if (cell === 2) {
          whitePositions.push({ col, row });
        }
      }
    }

    this.state.problemDiagramBlack = blackPositions.map((pos) => ({ ...pos }));
    this.state.problemDiagramWhite = whitePositions.map((pos) => ({ ...pos }));
    this.state.problemDiagramSet = true;

    this.state.handicapPositions = [];
    this.state.handicapStones = 0;
    this.state.gameTree = null;
    this.state.sgfLoadedFromExternal = false;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.turn = 0;
    this.state.numberMode = false;
    this.state.numberStartIndex = 0;
    this.state.history = [];

    this.applyInitialSetup();
    this.invalidateCache();

    this.saveToHistory("問題図確定");
  }

  restoreProblemDiagram(): void {
    if (!this.state.problemDiagramSet) {
      return;
    }

    this.state.sgfIndex = 0;
    this.rebuildBoardFromMoves(0);
    this.invalidateCache();

    if (this.state.numberMode) {
      this.state.turn = 0;
      this.state.history = [];
    }
  }

  hasProblemDiagram(): boolean {
    return this.state.problemDiagramSet;
  }

  /**
   * 解答モードへ入るときの公式初期化処理。
   * 編集モードの状態をすべて破棄し、
   * 問題図をベースにしたクリーンな盤面から解答を始める。
   */
  /** 解答モードに正式に入る初期化 */
  /** 解答モードに正式に入る初期化 */
  enterSolveMode(): void {
    this.saveToHistory(`解答開始前（${this.state.sgfMoves.length}手）`);

    if (this.state.problemDiagramSet) {
      this.applyInitialSetup();
    }

    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;

    this.state.numberMode = true;
    this.state.numberStartIndex = 0; // ★追加
    this.state.eraseMode = false;

    this.state.turn = 0;
    this.resetCapturedCounts();
    this.invalidateCache();
  }

  /**
   * 解答モードから空盤面の編集モードへ戻す。
   * 盤面と手順をリセットし、問題図などのメタ情報は保持する。
   */
  exitSolveModeToEmptyBoard(): void {
    this.resetToEmptyEditState({ preserveProblemDiagram: true });
  }

  /**
   * 「全消去」ボタン相当の挙動として、編集モードの初期状態に戻す。
   * boardSize はそのまま維持し、問題図などのメタ情報は従来同様リセットする。
   */
  resetForClearAll(): void {
    if (this.hasGameData()) {
      this.saveToHistory(`全消去前（${this.state.boardSize}路盤）`);
    }

    this.resetToEmptyEditState({ preserveProblemDiagram: false });
  }

  /**
   * テンプレートメソッド。以下の順序で処理を行う:
   * 1. {@link resetBoardForHandicap} 盤面のリセット
   * 2. {@link placeHandicapStones} 置石の配置
   * 3. {@link updateHandicapMetadata} メタデータの更新
   */
  setHandicap(stones: number | string): void {
    if (this.hasGameData()) {
      this.saveToHistory(`置石設定前（${this.state.handicapStones}子）`);
    }

    const context = this.createHandicapContext(stones);

    this.resetBoardForHandicap(context);
    this.placeHandicapStones(context);
    this.updateHandicapMetadata(context);

    this.invalidateCache();
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

  private resetToEmptyEditState({
    preserveProblemDiagram,
  }: {
    preserveProblemDiagram: boolean;
  }): void {
    const size = this.state.boardSize;

    this.state.board = Array.from({ length: size }, () =>
      Array<CellState>(size).fill(0)
    );

    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberStartIndex = 0;
    this.resetCapturedCounts();

    this.state.numberMode = false;
    this.state.mode = "alt";
    this.state.eraseMode = false;

    if (!preserveProblemDiagram) {
      this.resetMetadataForNewBoard();
    }

    this.invalidateCache();
  }

  private resetMetadataForNewBoard(): void {
    this.state.handicapStones = 0;
    this.state.handicapPositions = [];
    this.state.problemDiagramSet = false;
    this.state.problemDiagramBlack = [];
    this.state.problemDiagramWhite = [];
    this.state.gameTree = null;
    this.state.sgfLoadedFromExternal = false;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.gameInfo = {
      ...this.createDefaultGameInfo(),
      title: "",
    };
    this.resetCapturedCounts();
  }

  private undoSolveMove(): boolean {
    if (!this.state.numberMode) {
      return false;
    }

    if (this.state.sgfIndex <= 0 || this.state.sgfMoves.length <= 0) {
      return false;
    }

    const targetIndex = Math.max(
      0,
      Math.min(this.state.sgfIndex - 1, this.state.sgfMoves.length - 1)
    );

    this.state.sgfMoves = this.state.sgfMoves.slice(0, targetIndex);
    this.state.sgfIndex = targetIndex;

    this.rebuildBoardFromMoves(targetIndex);
    this.invalidateCache();

    return true;
  }

  private pushHistorySnapshot(): void {
    this.state.history.push(this.cloneBoard());
  }

  private cloneBoard(board: Board = this.state.board): Board {
    return board.map((row) => row.slice());
  }

  private cloneCapturedCounts(counts: CapturedCounts = { black: 0, white: 0 }): CapturedCounts {
    return { black: counts.black, white: counts.white };
  }

  private resetCapturedCounts(): void {
    this.state.capturedCounts = { black: 0, white: 0 };
    this.capturedCountsTimeline = [this.cloneCapturedCounts(this.state.capturedCounts)];
  }

  private accumulateCapturedCounts(
    previous: CapturedCounts,
    moveColor: StoneColor,
    captured: Position[]
  ): CapturedCounts {
    if (!captured.length) {
      return previous;
    }

    const next = this.cloneCapturedCounts(previous);
    if (moveColor === 1) {
      next.white += captured.length;
    } else {
      next.black += captured.length;
    }
    return next;
  }

  private applyInitialSetup(): void {
    const size = this.state.boardSize;
    const board = Array.from({ length: size }, () =>
      Array<CellState>(size).fill(0)
    );

    if (this.state.handicapPositions.length > 0) {
      this.state.handicapPositions.forEach((pos) => {
        if (this.isValidPosition(pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
    }

    if (this.state.problemDiagramSet) {
      this.state.problemDiagramBlack.forEach((pos) => {
        if (this.isValidPosition(pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
      this.state.problemDiagramWhite.forEach((pos) => {
        if (this.isValidPosition(pos)) {
          board[pos.row][pos.col] = 2;
        }
      });
    }

    this.state.board = board;
  }

  private rebuildBoardFromMoves(limit: number): Board | null {
    const profiling = this.performanceDebug;
    let startTime = 0;

    if (profiling) {
      startTime = this.getTimestamp();
      const metrics = this.performanceMetrics.rebuildBoardFromMoves;
      metrics.callCount++;
      metrics.lastLimit = limit;
    }

    this.state.history = [];
    this.state.turn = 0;
    this.applyInitialSetup();
    this.resetCapturedCounts();

    const baseBoard = this.cloneBoard();
    this.cachedBoardTimeline = [];
    this.cachedBoardTimeline[0] = baseBoard;
    this.cachedMoveApplied = [];
    this.capturedCountsTimeline = [this.cloneCapturedCounts(this.state.capturedCounts)];

    const { board, newlyApplied } = this.ensureBoardForIndex(limit);
    const finalBoard = board ?? baseBoard;

    this.cachedBoardTimeline[limit] = finalBoard;
    this.cachedBoardState = finalBoard;
    this.cachedAppliedMoveIndex = limit;

    this.state.history = [];
    for (let i = 0; i < limit; i++) {
      if (!this.cachedMoveApplied[i]) {
        continue;
      }

      const snapshot = this.cachedBoardTimeline[i];
      if (snapshot) {
        this.state.history.push(this.cloneBoard(snapshot));
      }
    }

    this.state.board = this.cloneBoard(finalBoard);
    const counts =
      this.capturedCountsTimeline[limit] ??
      this.capturedCountsTimeline[this.capturedCountsTimeline.length - 1] ??
      { black: 0, white: 0 };
    this.state.capturedCounts = this.cloneCapturedCounts(counts);

    if (this.state.numberMode) {
      this.state.turn = Math.max(0, limit - this.state.numberStartIndex);
    } else {
      this.state.turn = limit;
    }
    this.logBoardDump(`after rebuildBoardFromMoves(limit=${limit})`);
    if (profiling) {
      const metrics = this.performanceMetrics.rebuildBoardFromMoves;
      const duration = this.getTimestamp() - startTime;
      metrics.totalDurationMs += duration;
      metrics.lastDurationMs = duration;
      metrics.lastAppliedMoves = newlyApplied;
    }

    return finalBoard;
  }

  private findLastMoveIndex(pos: Position, color: StoneColor): number {
    for (let i = this.state.sgfMoves.length - 1; i >= 0; i--) {
      const move = this.state.sgfMoves[i];
      if (
        move.col === pos.col &&
        move.row === pos.row &&
        move.color === color
      ) {
        return i;
      }
    }
    return -1;
  }

  private hasGameData(): boolean {
    return (
      this.state.sgfMoves.length > 0 ||
      this.state.handicapStones > 0 ||
      this.state.board.some((row) => row.some((cell) => cell !== 0))
    );
  }

  private afterHistoryRestore(): void {
    this.state.sgfIndex = Math.max(
      0,
      Math.min(this.state.sgfIndex, this.state.sgfMoves.length)
    );
    this.state.numberStartIndex = Math.max(
      0,
      Math.min(this.state.numberStartIndex, this.state.sgfMoves.length)
    );
    this.state.history = [];

    this.invalidateCache();
    this.cachedAppliedMoveIndex = this.state.sgfIndex;
    this.cachedBoardState = this.cloneBoard();
    this.cachedBoardTimeline[this.state.sgfIndex] = this.cachedBoardState;
    this.capturedCountsTimeline[this.state.sgfIndex] = this.cloneCapturedCounts(
      this.state.capturedCounts
    );
    this.syncKomiToGameInfo();
  }

  private invalidateCache(): void {
    this.cachedBoardState = null;
    this.cachedAppliedMoveIndex = null;
    this.cachedBoardTimeline = [];
    this.cachedMoveApplied = [];
    this.capturedCountsTimeline = [];
  }

  private canUseCache(): boolean {
    if (
      this.cachedBoardState === null ||
      this.cachedAppliedMoveIndex === null ||
      !this.cachedBoardTimeline[this.cachedAppliedMoveIndex]
    ) {
      return false;
    }

    return (
      this.boardsEqual(
        this.cachedBoardTimeline[this.cachedAppliedMoveIndex],
        this.cachedBoardState
      ) && this.boardsEqual(this.state.board, this.cachedBoardState)
    );
  }

  private performFullReset(target: number): void {
    const board = this.rebuildBoardFromMoves(target);
    if (board) {
      this.cachedBoardTimeline[target] = board;
      this.cachedBoardState = board;
      this.cachedAppliedMoveIndex = target;
    }
  }

  private resolveBoardThroughCache(target: number): Board | null {
    if (!this.canUseCache()) {
      return null;
    }

    if (this.cachedAppliedMoveIndex === null) {
      return null;
    }

    if (target === this.cachedAppliedMoveIndex && this.cachedBoardState) {
      return this.cachedBoardState;
    }

    const { board } = this.ensureBoardForIndex(target);
    return board;
  }

  private applyCachedBoard(target: number, board: Board): void {
    this.cachedBoardTimeline[target] = board;
    this.cachedBoardState = board;
    this.cachedAppliedMoveIndex = target;

    this.state.board = this.cloneBoard(board);
    this.state.history = [];
    for (let i = 0; i < target; i++) {
      if (!this.cachedMoveApplied[i]) {
        continue;
      }

      const snapshot = this.cachedBoardTimeline[i];
      if (snapshot) {
        this.state.history.push(this.cloneBoard(snapshot));
      }
    }
    const counts =
      this.capturedCountsTimeline[target] ??
      this.capturedCountsTimeline[this.capturedCountsTimeline.length - 1] ??
      { black: 0, white: 0 };
    this.state.capturedCounts = this.cloneCapturedCounts(counts);
    this.state.sgfIndex = target;
    this.state.turn = this.state.numberMode
      ? Math.max(0, target - this.state.numberStartIndex)
      : target;
  }

  private ensureBoardForIndex(target: number): {
    board: Board | null;
    newlyApplied: number;
  } {
    if (target < 0) {
      return { board: null, newlyApplied: 0 };
    }

    const nearest = this.findNearestCachedIndex(target);
    if (nearest === -1) {
      return { board: null, newlyApplied: 0 };
    }

    let board = this.cachedBoardTimeline[nearest]!;
    let counts = this.cloneCapturedCounts(
      this.capturedCountsTimeline[nearest] ?? { black: 0, white: 0 }
    );
    let applied = 0;

    for (let index = nearest; index < target; index++) {
      const nextIndex = index + 1;
      const cached = this.cachedBoardTimeline[nextIndex];
      const cachedCounts = this.capturedCountsTimeline[nextIndex];
      if (cached && cachedCounts) {
        board = cached;
        counts = this.cloneCapturedCounts(cachedCounts);
        continue;
      }
      if (cached) {
        board = cached;
        this.capturedCountsTimeline[nextIndex] = counts;
        continue;
      }

      const move = this.state.sgfMoves[index];
      if (!move) {
        this.cachedBoardTimeline[nextIndex] = board;
        this.capturedCountsTimeline[nextIndex] = counts;
        this.cachedMoveApplied[index] = false;
        continue;
      }

      const workingBoard = this.cloneBoard(board);
      const result = this.engine.playMove(
        this.state,
        move,
        move.color,
        workingBoard
      );
      if (!result) {
        this.cachedBoardTimeline[nextIndex] = board;
        this.capturedCountsTimeline[nextIndex] = counts;
        this.cachedMoveApplied[index] = false;
        continue;
      }

      board = result.board;
      counts = this.accumulateCapturedCounts(counts, move.color, result.captured);
      this.cachedBoardTimeline[nextIndex] = board;
      this.capturedCountsTimeline[nextIndex] = counts;
      this.cachedMoveApplied[index] = true;
      applied++;
    }

    return {
      board: this.cachedBoardTimeline[target] ?? board,
      newlyApplied: applied,
    };
  }

  private findNearestCachedIndex(target: number): number {
    for (
      let index = Math.min(target, this.cachedBoardTimeline.length - 1);
      index >= 0;
      index--
    ) {
      if (this.cachedBoardTimeline[index]) {
        return index;
      }
    }

    return -1;
  }

  private boardsEqual(a: Board, b: Board): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let row = 0; row < a.length; row++) {
      const rowA = a[row];
      const rowB = b[row];
      if (rowA.length !== rowB.length) {
        return false;
      }

      for (let col = 0; col < rowA.length; col++) {
        if (rowA[col] !== rowB[col]) {
          return false;
        }
      }
    }

    return true;
  }

  private saveToHistory(label: string): void {
    this.history.save(label, this.state);
  }

  private createRebuildMetrics(): RebuildMetrics {
    return {
      callCount: 0,
      totalDurationMs: 0,
      lastDurationMs: 0,
      lastLimit: 0,
      lastAppliedMoves: 0,
    };
  }

  private getTimestamp(): number {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      return performance.now();
    }

    return Date.now();
  }

  private isValidPosition(pos: Position): boolean {
    return (
      pos.col >= 0 &&
      pos.col < this.state.boardSize &&
      pos.row >= 0 &&
      pos.row < this.state.boardSize
    );
  }

  private createHandicapContext(stones: number | string): HandicapContext {
    if (stones === "even") {
      return { mode: "even", stones: 0, positions: [] };
    }

    const numeric = Number(stones);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error(`無効な置石数: ${stones}`);
    }

    if (numeric === 0) {
      return { mode: "no-komi", stones: 0, positions: [] };
    }

    const positions = this.engine.generateHandicapPositions(
      this.state.boardSize,
      numeric
    );
    console.log(`置石設定: ${stones}子, 位置:`, positions);
    console.log(
      `${this.state.boardSize}路盤 ${stones}子局の置石位置:`,
      positions
    );

    return { mode: "fixed", stones: numeric, positions };
  }

  private resetBoardForHandicap(_context: HandicapContext): void {
    this.initBoard(this.state.boardSize, { skipHistory: true });
  }

  private placeHandicapStones(context: HandicapContext): void {
    if (context.mode !== "fixed") {
      return;
    }

    context.positions.forEach((pos) => {
      if (this.isValidPosition(pos)) {
        this.state.board[pos.row][pos.col] = 1;
      }
    });
  }

  private updateHandicapMetadata(context: HandicapContext): void {
    if (context.mode === "even") {
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
      this.state.startColor = 1;
      this.state.gameInfo = {
        ...this.state.gameInfo,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        startColor: this.state.startColor,
      };
      this.syncKomiToGameInfo();
      return;
    }

    if (context.mode === "no-komi") {
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = 0;
      this.state.startColor = 1;
      this.state.gameInfo = {
        ...this.state.gameInfo,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        startColor: this.state.startColor,
      };
      this.syncKomiToGameInfo();
      return;
    }

    this.state.handicapStones = context.stones;
    this.state.handicapPositions = context.positions.map((pos) => ({ ...pos }));
    this.state.komi = 0;
    this.state.startColor = 2;
    this.state.turn = 0;
    this.state.gameInfo = {
      ...this.state.gameInfo,
      handicap: context.stones,
      handicapStones: context.stones,
      handicapPositions: context.positions.map((pos) => ({ ...pos })),
      startColor: this.state.startColor,
    };
    this.syncKomiToGameInfo();
  }
  /** Debug: board[][] dump for SGF apply tracing */
  private logBoardDump(reason: string = "dump"): void {
    const size = this.state.boardSize;
    const board = this.state.board;

    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] Board dump (${reason}), size=${size}`);

    for (let row = 0; row < size; row++) {
      console.log(`row ${row}: ${board[row].join(" ")}`);
    }
  }
  /** =========================================================================
   * 編集モード専用：囲碁ルールを使わない石配置（board へ直接書き込む）
   * ========================================================================= */
  public directPlace(pos: Position, color: StoneColor): boolean {
    if (!this.isValidPosition(pos)) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = color;
    this.state.board = board;

    this.state.turn++; // ★追加：これで alt モードが交互に動く

    this.invalidateCache();
    return true;
  }

  public placeWithRulesInEdit(pos: Position, color: StoneColor): boolean {
    const result = this.engine.playMove(this.state, pos, color);
    if (!result) {
      return false;
    }

    this.pushHistorySnapshot();
    this.state.board = result.board;
    this.state.turn++;
    this.invalidateCache();
    return true;
  }

  /** =========================================================================
   * 編集モード専用：囲碁ルールを使わない石消し
   * ========================================================================= */
  public directRemove(pos: Position): boolean {
    if (!this.isValidPosition(pos)) return false;

    if (this.state.board[pos.row][pos.col] === 0) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = 0;
    this.state.board = board;

    this.state.turn = Math.max(0, this.state.turn - 1); // ★任意

    this.invalidateCache();
    return true;
  }
}
