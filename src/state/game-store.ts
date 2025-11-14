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

/**
 * Centralizes all mutations against {@link GameState}. Rendering and UI layers
 * interact through this class to keep domain logic encapsulated.
 */
export class GameStore {
  // === Cache-related fields (from PR57) ===
  private cachedBoardState: Board | null = null;
  private cachedAppliedMoveIndex: number | null = null;
  private cachedBoardTimeline: Board[] = [];

  // === Performance metrics (from main branch) ===
  private performanceDebug = false;
  private performanceMetrics: PerformanceMetrics = {
    rebuildBoardFromMoves: this.createRebuildMetrics()
  };


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

  removeStone(pos: Position): boolean {
    if (!this.isValidPosition(pos)) {
      return false;
    }

    const currentStone = this.state.board[pos.row][pos.col];
    if (currentStone === 0) {
      return false;
    }

    const handicapIndex = this.state.handicapPositions.findIndex(handicap =>
      handicap.col === pos.col && handicap.row === pos.row
    );

    if (handicapIndex !== -1) {
      this.state.handicapPositions.splice(handicapIndex, 1);
      this.state.handicapStones = this.state.handicapPositions.length;
      this.rebuildBoardFromMoves(this.state.sgfIndex);
      this.invalidateCache();
      return true;
    }

    const removeIndex = this.findLastMoveIndex(pos, currentStone as StoneColor);
    if (removeIndex === -1) {
      const board = this.cloneBoard();
      board[pos.row][pos.col] = 0;
      this.state.board = board;
      this.invalidateCache();
      return true;
    }

    const updatedMoves = [...this.state.sgfMoves];
    updatedMoves.splice(removeIndex, 1);

    if (this.state.numberMode && removeIndex < this.state.numberStartIndex) {
      this.state.numberStartIndex = Math.max(0, this.state.numberStartIndex - 1);
    }

    this.state.sgfMoves = updatedMoves;

    if (this.state.numberMode) {
      this.state.numberStartIndex = Math.min(this.state.numberStartIndex, this.state.sgfMoves.length);
    }

    if (this.state.sgfIndex > removeIndex) {
      this.state.sgfIndex = Math.max(removeIndex, this.state.sgfIndex - 1);
    } else if (this.state.sgfIndex > this.state.sgfMoves.length) {
      this.state.sgfIndex = this.state.sgfMoves.length;
    }

    this.rebuildBoardFromMoves(this.state.sgfIndex);
    this.invalidateCache();
    return true;
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

    let useCache = this.canUseCache();

    if (!useCache) {
      this.performFullReset(clamped);
      useCache = true;
    } else if (this.cachedAppliedMoveIndex !== null) {
      if (clamped > this.cachedAppliedMoveIndex) {
        useCache = this.advanceFromCache(clamped);
      } else if (clamped < this.cachedAppliedMoveIndex) {
        useCache = this.rewindFromCache(clamped);
      } else if (this.cachedBoardState) {
        this.state.board = this.cloneBoard(this.cachedBoardState);
      }
    }

    if (!useCache) {
      this.performFullReset(clamped);
    }

    const finalBoard = this.cloneBoard();
    while (this.cachedBoardTimeline.length < clamped) {
      const last = this.cachedBoardTimeline[this.cachedBoardTimeline.length - 1] ?? finalBoard;
      this.cachedBoardTimeline.push(this.cloneBoard(last));
    }
    this.cachedBoardTimeline[clamped] = this.cloneBoard(finalBoard);
    this.cachedBoardState = finalBoard;
    this.cachedAppliedMoveIndex = clamped;

    this.state.history = [];
    this.state.sgfIndex = clamped;
    this.state.turn = this.state.numberMode
      ? Math.max(0, clamped - this.state.numberStartIndex)
      : clamped;
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

  setHandicap(stones: number | string): void {
    if (this.hasGameData()) {
      this.saveToHistory(`置石変更前（${this.state.handicapStones}子）`);
    }

    if (stones === 'even') {
      this.initBoard(this.state.boardSize);
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
      this.state.startColor = 1;
      this.invalidateCache();
      return;
    }

    if (stones === 0) {
      this.initBoard(this.state.boardSize);
      this.state.handicapStones = 0;
      this.state.handicapPositions = [];
      this.state.komi = 0;
      this.state.startColor = 1;
      this.invalidateCache();
      return;
    }

    this.initBoard(this.state.boardSize);

    const count = Number(stones);
    const handicapPositions = this.engine.generateHandicapPositions(this.state.boardSize, count);
    console.log(`置石設定: ${stones}子, 位置:`, handicapPositions);
    console.log(`${this.state.boardSize}路盤 ${stones}子局の置石位置:`, handicapPositions);

    handicapPositions.forEach(pos => {
      if (this.isValidPosition(pos)) {
        this.state.board[pos.row][pos.col] = 1;
      }
    });

    this.state.handicapStones = count;
    this.state.handicapPositions = handicapPositions;
    this.state.komi = 0;
    this.state.startColor = 2;
    this.state.turn = 0;
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

  private rebuildBoardFromMoves(limit: number): void {
    const profiling = this.performanceDebug;
    let startTime = 0;
    let appliedMoves = 0;

    if (profiling) {
      startTime = this.getTimestamp();
      const metrics = this.performanceMetrics.rebuildBoardFromMoves;
      metrics.callCount++;
      metrics.lastLimit = limit;
    }

    this.state.history = [];
    this.state.turn = 0;
    this.applyInitialSetup();

    for (let i = 0; i < limit; i++) {
      const move = this.state.sgfMoves[i];
      const result = this.engine.playMove(this.state, move, move.color);
      if (!result) continue;

      this.pushHistorySnapshot();
      this.state.board = result.board;
      this.state.turn++;
      appliedMoves++;
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
      metrics.lastAppliedMoves = appliedMoves;
    }
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
  }

  private invalidateCache(): void {
    this.cachedBoardState = null;
    this.cachedAppliedMoveIndex = null;
    this.cachedBoardTimeline = [];
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
    this.rebuildBoardFromMoves(target);

    const timeline = this.state.history.map(board => this.cloneBoard(board));
    const finalBoard = this.cloneBoard();
    if (timeline.length === 0) {
      timeline.push(this.cloneBoard(finalBoard));
    }

    while (timeline.length < target) {
      const last = timeline[timeline.length - 1] ?? finalBoard;
      timeline.push(this.cloneBoard(last));
    }

    timeline[target] = this.cloneBoard(finalBoard);

    this.cachedBoardTimeline = timeline;
    this.cachedBoardState = this.cloneBoard(finalBoard);
    this.cachedAppliedMoveIndex = target;
    this.state.history = [];
  }

  private advanceFromCache(target: number): boolean {
    if (this.cachedAppliedMoveIndex === null) {
      return false;
    }

    const currentBoard = this.cachedBoardTimeline[this.cachedAppliedMoveIndex];
    if (!currentBoard) {
      return false;
    }

    this.state.board = this.cloneBoard(currentBoard);
    let index = this.cachedAppliedMoveIndex;

    while (index < target) {
      const cached = this.cachedBoardTimeline[index + 1];
      if (cached) {
        index++;
        this.state.board = this.cloneBoard(cached);
        continue;
      }

      const move = this.state.sgfMoves[index];
      if (!move) {
        return false;
      }

      const result = this.engine.playMove(this.state, move, move.color);
      if (!result) {
        return false;
      }

      const cloned = this.cloneBoard(result.board);
      this.state.board = cloned;
      this.cachedBoardTimeline[index + 1] = this.cloneBoard(cloned);
      index++;
    }

    return true;
  }

  private rewindFromCache(target: number): boolean {
    const cached = this.cachedBoardTimeline[target];
    if (!cached) {
      return false;
    }

    this.state.board = this.cloneBoard(cached);
    return true;
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
}
