// ============ 盤面キャッシュ&手筋再生 ============
// GameState を変更せず、与えられた state / engine 参照で
// 盤面タイムラインを構築し、最終的な盤面・履歴・捕獲数・手番を返す。
// 副作用は内部キャッシュ（cachedBoardTimeline 等）のみ。
import {
  Board,
  CapturedCounts,
  GameState,
  Position,
  StoneColor,
} from "../types.js";
import { GoEngine } from "../go-engine.js";
import { PerformanceMonitor } from "./performance-monitor.js";
import { cloneBoard, createEmptyBoard, isValidPosition } from "./board-utils.js";

export interface BoardRebuildResult {
  /** 該当手数時点の盤面（clone） */
  board: Board;
  /** 該当手数時点の state.history 相当（手数分の snapshot 配列） */
  history: Board[];
  /** 該当手数時点の turn 値 */
  turn: number;
  /** 該当手数時点の捕獲数（clone） */
  counts: CapturedCounts;
  /** この呼び出しで新規に適用した手数（プロファイリング用） */
  newlyApplied: number;
}

interface EnsureBoardResult {
  board: Board | null;
  newlyApplied: number;
}

export class BoardCacheManager {
  private cachedBoardState: Board | null = null;
  private cachedAppliedMoveIndex: number | null = null;
  private cachedBoardTimeline: Board[] = [];
  private cachedMoveApplied: boolean[] = [];
  private capturedCountsTimeline: CapturedCounts[] = [];

  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly monitor?: PerformanceMonitor
  ) {}

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 盤面タイムラインを指定手数まで再構築し、結果を返す。
   * state は変更しない。内部キャッシュのみ更新する。
   */
  rebuildBoardFromMoves(limit: number): BoardRebuildResult {
    const finalize = this.monitor?.startRebuildProfiling(limit);

    this.cachedBoardTimeline = [];
    this.cachedMoveApplied = [];
    this.capturedCountsTimeline = [
      this.cloneCapturedCounts({ black: 0, white: 0 }),
    ];

    const baseBoard = this.applyInitialSetup();
    this.cachedBoardTimeline[0] = baseBoard;

    const { board, newlyApplied } = this.ensureBoardForIndex(limit);
    const finalBoard = board ?? baseBoard;

    this.cachedBoardTimeline[limit] = finalBoard;
    this.cachedBoardState = finalBoard;
    this.cachedAppliedMoveIndex = limit;

    const history = this.buildHistoryFromCache(limit);
    const counts = this.pickCapturedCounts(limit);
    const turn = this.computeTurn(limit, this.state.numberStartIndex);

    finalize?.(newlyApplied);

    return {
      board: cloneBoard(finalBoard),
      history,
      turn,
      counts: this.cloneCapturedCounts(counts),
      newlyApplied,
    };
  }

  /**
   * 指定手数の盤面へ移動する。state は変更しない。
   * キャッシュヒット時は ensureBoardForIndex で差分適用し、
   * キャッシュミス時は rebuildBoardFromMoves にフォールバックする。
   */
  setMoveIndex(index: number): BoardRebuildResult {
    const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));

    if (this.canUseCache()) {
      if (
        clamped === this.cachedAppliedMoveIndex &&
        this.cachedBoardState
      ) {
        return this.buildResultFromCache(clamped, this.cachedBoardState);
      }
      const ensured = this.ensureBoardForIndex(clamped);
      if (ensured.board) {
        return this.buildResultFromCache(clamped, ensured.board);
      }
    }

    return this.rebuildBoardFromMoves(clamped);
  }

  /**
   * 履歴復元後にキャッシュを最小限再構築する。
   * 現在の state.board / state.capturedCounts を sgfIndex 地点として登録する。
   * sgfIndex より前のタイムラインは次回 setMoveIndex 時に遅延構築される。
   */
  rebuildCacheFromHistoryRestore(
    sgfIndex: number,
    numberStartIndex: number
  ): BoardRebuildResult {
    this.cachedBoardTimeline = [];
    this.cachedMoveApplied = [];
    this.capturedCountsTimeline = [];

    const boardSnapshot = cloneBoard(this.state.board);
    const countsSnapshot = this.cloneCapturedCounts(this.state.capturedCounts);

    this.cachedBoardState = boardSnapshot;
    this.cachedAppliedMoveIndex = sgfIndex;
    this.cachedBoardTimeline[sgfIndex] = boardSnapshot;
    this.capturedCountsTimeline[sgfIndex] = countsSnapshot;

    return {
      board: cloneBoard(boardSnapshot),
      history: [],
      turn: this.computeTurn(sgfIndex, numberStartIndex),
      counts: this.cloneCapturedCounts(countsSnapshot),
      newlyApplied: 0,
    };
  }

  /** キャッシュを完全に破棄する */
  invalidate(): void {
    this.cachedBoardState = null;
    this.cachedAppliedMoveIndex = null;
    this.cachedBoardTimeline = [];
    this.cachedMoveApplied = [];
    this.capturedCountsTimeline = [];
  }

  /** 現キャッシュが state.board と一致しているか */
  canUseCache(): boolean {
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

  /** sgfMoves の末尾から指定の石位置を探す（編集用） */
  findLastMoveIndex(pos: Position, color: StoneColor): number {
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

  /** 内部タイムラインを新しい空配列に置き換える（resetToEmptyEditState 等で使用） */
  resetCapturedCountsTimeline(): CapturedCounts {
    const initial = this.cloneCapturedCounts({ black: 0, white: 0 });
    this.capturedCountsTimeline = [initial];
    return initial;
  }

  /** 現 state.board から初期盤面（置石 + 問題図）を構築して返す */
  applyInitialSetup(): Board {
    const size = this.state.boardSize;
    const board = createEmptyBoard(size);

    if (this.state.handicapPositions.length > 0) {
      this.state.handicapPositions.forEach((pos) => {
        if (isValidPosition(size, pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
    }

    if (this.state.problemDiagramSet) {
      this.state.problemDiagramBlack.forEach((pos) => {
        if (isValidPosition(size, pos)) {
          board[pos.row][pos.col] = 1;
        }
      });
      this.state.problemDiagramWhite.forEach((pos) => {
        if (isValidPosition(size, pos)) {
          board[pos.row][pos.col] = 2;
        }
      });
    }

    return board;
  }

  // ============================================================
  // Internal
  // ============================================================

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

  private ensureBoardForIndex(target: number): EnsureBoardResult {
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

      const workingBoard = cloneBoard(board);
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

  private buildHistoryFromCache(target: number): Board[] {
    const history: Board[] = [];
    for (let i = 0; i < target; i++) {
      if (!this.cachedMoveApplied[i]) {
        continue;
      }
      const snapshot = this.cachedBoardTimeline[i];
      if (snapshot) {
        history.push(cloneBoard(snapshot));
      }
    }
    return history;
  }

  private buildResultFromCache(target: number, board: Board): BoardRebuildResult {
    this.cachedBoardTimeline[target] = board;
    this.cachedBoardState = board;
    this.cachedAppliedMoveIndex = target;

    return {
      board: cloneBoard(board),
      history: this.buildHistoryFromCache(target),
      turn: this.computeTurn(target, this.state.numberStartIndex),
      counts: this.cloneCapturedCounts(this.pickCapturedCounts(target)),
      newlyApplied: 0,
    };
  }

  private pickCapturedCounts(target: number): CapturedCounts {
    return (
      this.capturedCountsTimeline[target] ??
      this.capturedCountsTimeline[this.capturedCountsTimeline.length - 1] ??
      { black: 0, white: 0 }
    );
  }

  private computeTurn(target: number, numberStartIndex: number): number {
    return this.state.numberMode
      ? Math.max(0, target - numberStartIndex)
      : target;
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

  private cloneCapturedCounts(counts: CapturedCounts): CapturedCounts {
    return { black: counts.black, white: counts.white };
  }
}
