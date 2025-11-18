import {
  Board,
  CellState,
  GameState,
  Position,
  StoneColor,
  DEFAULT_CONFIG
} from '../types.js';
import { GoEngine } from '../go-engine.js';
import { HistoryManager } from '../history-manager.js';

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

type HandicapMode = 'even' | 'no-komi' | 'fixed';

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

  // === Performance metrics (from main branch) ===
  private performanceDebug = false;
  private performanceMetrics: PerformanceMetrics = {
    rebuildBoardFromMoves: this.createRebuildMetrics()
  };
  // === Review mode fields ===
  private reviewMoves: { row: number; col: number; color: StoneColor }[] = [];
  private isReviewMode: boolean = false;


  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {}

  get snapshot(): GameState {
    return this.state;
  }

  get historyManager(): HistoryManager {
    return this.history;
  }

  get reviewActive(): boolean {
  return this.reviewMoves.length > 0;
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
      rebuildBoardFromMoves: { ...this.performanceMetrics.rebuildBoardFromMoves }
    };
  }

  tryMove(pos: Position, color: StoneColor, record = true): boolean {
    const result = this.engine.playMove(this.state, pos, color);
    if (!result) {
      return false;
    }

    this.pushHistorySnapshot();
    this.state.board = result.board;
    this.state.turn++;

    if (record) {
      this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
      this.state.sgfMoves.push({ col: pos.col, row: pos.row, color });
      this.state.sgfIndex = this.state.sgfMoves.length;
    }

    this.invalidateCache();
    return true;
  }
    // === Review mode: add temporary move ===
    addReviewMove(move: { row: number; col: number; color: StoneColor }): void {
      // 盤面に実際に着手するが、SGF（sgfMoves）は書き換えない
      const ok = this.tryMove({ row: move.row, col: move.col }, move.color, false);
      if (!ok) {
        return;
      }

      this.reviewMoves.push(move);
      this.isReviewMode = true;
      // tryMove 内で invalidateCache() 済み
    }


    // === Review mode: reset and return to main line ===
  resetReview(): void {
    this.reviewMoves = [];
    this.isReviewMode = false;

    // 本譜だけで盤面を再構築
    this.rebuildBoardFromMoves(this.state.sgfIndex);

    this.invalidateCache();
  }

  removeStone(pos: Position): boolean {

    // === 0) 配置モード（numberMode=false & sgfLoadedFromExternal=false）===
    if (!this.state.numberMode && !this.state.sgfLoadedFromExternal) {
      // → 完全に自由に削除
      const board = this.cloneBoard();
      if (board[pos.row][pos.col] !== 0) {
        board[pos.row][pos.col] = 0;
        this.state.board = board;
        this.invalidateCache();
        return true;
      }
      return false;
    }

    // === 1) 解答モード（numberMode=true）===
    if (this.state.numberMode) {
      // 常に末尾の手だけ消せる
      if (this.state.sgfIndex > this.state.numberStartIndex) {
        const lastMove = this.state.sgfMoves[this.state.sgfIndex - 1];
        if (lastMove.col === pos.col && lastMove.row === pos.row) {
          this.state.sgfMoves.pop();
          this.state.sgfIndex--;
          this.rebuildBoardFromMoves(this.state.sgfIndex);
          this.invalidateCache();
          return true;
        }
      }
      return false;
    }

    // === 2) SGF読み込み中の検討モード（sgfLoadedFromExternal=true）===
    if (this.state.sgfLoadedFromExternal) {
      // 本譜は保護
      // 検討手(reviewMoves) の末尾だけ消せる
      if (this.isReviewMode && this.reviewMoves.length > 0) {
        const last = this.reviewMoves[this.reviewMoves.length - 1];
        if (last.col === pos.col && last.row === pos.row) {
          this.reviewMoves.pop();

          // 本譜 + 残りの検討手で復元
          this.rebuildBoardFromMoves(this.state.sgfIndex);
          for (const mv of this.reviewMoves) {
            const r = this.engine.playMove(this.state, mv, mv.color, this.state.board);
            if (r) this.state.board = r.board;
          }

          this.invalidateCache();
          return true;
        }
      }
      return false; // 本譜は消さない
    }

    return false;
  }

  initBoard(size: number): void {
    if (this.hasGameData()) {
      this.saveToHistory(`${this.state.boardSize}路盤（${this.state.sgfMoves.length}手）`);
    }

    this.state.boardSize = size;
    this.state.board = Array.from({ length: size }, () => Array<CellState>(size).fill(0));
    this.resetGameState();
    this.invalidateCache();
  }

  undo(): boolean {
    if (this.state.numberMode) {
      this.state.sgfIndex = Math.max(this.state.numberStartIndex, this.state.sgfIndex - 1);
      this.setMoveIndex(this.state.sgfIndex);
      return true;
    }

    if (this.state.turn > 0) {
      this.state.turn = Math.max(0, this.state.turn - 1);
      const snapshot = this.state.history[this.state.turn];
      if (snapshot) {
        this.state.board = this.cloneBoard(snapshot);
      }
      this.invalidateCache();
      return true;
    }

    return false;
  }

setMoveIndex(index: number): void {
  const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));

  // ★ここに追加（最も安全で一貫した位置）
  (this as any).reviewMoves = [];

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
    this.state.numberStartIndex = this.state.sgfMoves.length;
    this.state.sgfIndex = this.state.sgfMoves.length;
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

    this.state.problemDiagramBlack = blackPositions.map(pos => ({ ...pos }));
    this.state.problemDiagramWhite = whitePositions.map(pos => ({ ...pos }));
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
   * テンプレートメソッド。以下の順序で処理を行う:
   * 1. {@link resetBoardForHandicap} 盤面のリセット
   * 2. {@link placeHandicapStones} 置石の配置
   * 3. {@link updateHandicapMetadata} メタデータの更新
   */
  setHandicap(stones: number | string): void {
    if (this.hasGameData()) {
      this.saveToHistory(`置石変更前（${this.state.handicapStones}子）`);
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
        : (3 - this.state.startColor) as StoneColor;
    }

    if (this.state.mode === 'alt') {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : (3 - this.state.startColor) as StoneColor;
    }

    return this.state.mode === 'black' ? 1 : 2;
  }

  private pushHistorySnapshot(): void {
    this.state.history.push(this.cloneBoard());
  }

  private cloneBoard(board: Board = this.state.board): Board {
    return board.map(row => row.slice());
  }

  private applyInitialSetup(): void {
    const size = this.state.boardSize;
    const board = Array.from({ length: size }, () => Array<CellState>(size).fill(0));

    if (this.state.handicapPositions.length > 0) {
      this.state.handicapPositions.forEach(pos => {
        if (this.isValidPosition(pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
    }

    if (this.state.problemDiagramSet) {
      this.state.problemDiagramBlack.forEach(pos => {
        if (this.isValidPosition(pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
      this.state.problemDiagramWhite.forEach(pos => {
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

    const baseBoard = this.cloneBoard();
    this.cachedBoardTimeline = [];
    this.cachedBoardTimeline[0] = baseBoard;
    this.cachedMoveApplied = [];

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
        // === Apply review moves (temporary moves) ===
    if (this.isReviewMode && this.reviewMoves.length > 0) {
      for (const mv of this.reviewMoves) {
        const result = this.engine.playMove(this.state, mv, mv.color, this.state.board);
        if (result) {
          this.state.board = result.board;
        }
      }
    }


    if (this.state.numberMode) {
      this.state.turn = Math.max(0, limit - this.state.numberStartIndex);
    } else {
      this.state.turn = limit;
    }

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
      if (move.col === pos.col && move.row === pos.row && move.color === color) {
        return i;
      }
    }
    return -1;
  }

  private hasGameData(): boolean {
    return this.state.sgfMoves.length > 0 ||
      this.state.handicapStones > 0 ||
      this.state.board.some(row => row.some(cell => cell !== 0));
  }

  private resetGameState(): void {
    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberStartIndex = 0;
    this.state.eraseMode = false;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.handicapStones = 0;
    this.state.handicapPositions = [];
    this.state.problemDiagramSet = false;
    this.state.problemDiagramBlack = [];
    this.state.problemDiagramWhite = [];
    this.state.gameTree = null;
    this.state.numberMode = false;
    this.state.sgfLoadedFromExternal = false;
  }

  private invalidateCache(): void {
    this.cachedBoardState = null;
    this.cachedAppliedMoveIndex = null;
    this.cachedBoardTimeline = [];
    this.cachedMoveApplied = [];
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
      this.boardsEqual(this.cachedBoardTimeline[this.cachedAppliedMoveIndex], this.cachedBoardState) &&
      this.boardsEqual(this.state.board, this.cachedBoardState)
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
    this.state.sgfIndex = target;
    this.state.turn = this.state.numberMode
      ? Math.max(0, target - this.state.numberStartIndex)
      : target;
  }

  private ensureBoardForIndex(target: number): { board: Board | null; newlyApplied: number } {
    if (target < 0) {
      return { board: null, newlyApplied: 0 };
    }

    const nearest = this.findNearestCachedIndex(target);
    if (nearest === -1) {
      return { board: null, newlyApplied: 0 };
    }

    let board = this.cachedBoardTimeline[nearest]!;
    let applied = 0;

    for (let index = nearest; index < target; index++) {
      const nextIndex = index + 1;
      const cached = this.cachedBoardTimeline[nextIndex];
      if (cached) {
        board = cached;
        continue;
      }

      const move = this.state.sgfMoves[index];
      if (!move) {
        this.cachedBoardTimeline[nextIndex] = board;
        this.cachedMoveApplied[index] = false;
        continue;
      }

      const workingBoard = this.cloneBoard(board);
      const result = this.engine.playMove(this.state, move, move.color, workingBoard);
      if (!result) {
        this.cachedBoardTimeline[nextIndex] = board;
        this.cachedMoveApplied[index] = false;
        continue;
      }

      board = result.board;
      this.cachedBoardTimeline[nextIndex] = board;
      this.cachedMoveApplied[index] = true;
      applied++;
    }

    return {
      board: this.cachedBoardTimeline[target] ?? board,
      newlyApplied: applied
    };
  }

  private findNearestCachedIndex(target: number): number {
    for (let index = Math.min(target, this.cachedBoardTimeline.length - 1); index >= 0; index--) {
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

  private saveToHistory(description: string): void {
    this.history.save(description, this.state);
  }

  private createRebuildMetrics(): RebuildMetrics {
    return {
      callCount: 0,
      totalDurationMs: 0,
      lastDurationMs: 0,
      lastLimit: 0,
      lastAppliedMoves: 0
    };
  }

  private getTimestamp(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }

  private isValidPosition(pos: Position): boolean {
    return pos.col >= 0 && pos.col < this.state.boardSize &&
      pos.row >= 0 && pos.row < this.state.boardSize;
  }

  private createHandicapContext(stones: number | string): HandicapContext {
    if (stones === 'even') {
      return { mode: 'even', stones: 0, positions: [] };
    }

    const numeric = Number(stones);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error(`無効な置石数: ${stones}`);
    }

    if (numeric === 0) {
      return { mode: 'no-komi', stones: 0, positions: [] };
    }

    const positions = this.engine.generateHandicapPositions(this.state.boardSize, numeric);
    console.log(`置石設定: ${stones}子, 位置:`, positions);
    console.log(`${this.state.boardSize}路盤 ${stones}子局の置石位置:`, positions);

    return { mode: 'fixed', stones: numeric, positions };
  }

  private resetBoardForHandicap(_context: HandicapContext): void {
    this.initBoard(this.state.boardSize);
  }

  private placeHandicapStones(context: HandicapContext): void {
    if (context.mode !== 'fixed') {
      return;
    }

    context.positions.forEach(pos => {
      if (this.isValidPosition(pos)) {
        this.state.board[pos.row][pos.col] = 1;
      }
    });
  }

  private updateHandicapMetadata(context: HandicapContext): void {
    if (context.mode === 'even') {
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
      this.state.startColor = 1;
      return;
    }

    if (context.mode === 'no-komi') {
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = 0;
      this.state.startColor = 1;
      return;
    }

    this.state.handicapStones = context.stones;
    this.state.handicapPositions = context.positions.map(pos => ({ ...pos }));
    this.state.komi = 0;
    this.state.startColor = 2;
    this.state.turn = 0;
  }
}
