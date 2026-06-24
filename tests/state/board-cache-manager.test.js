import { DEFAULT_CONFIG } from '../../dist/types.js';
import { GoEngine } from '../../dist/go-engine.js';
import { BoardCacheManager } from '../../dist/state/board-cache-manager.js';
import { PerformanceMonitor } from '../../dist/state/performance-monitor.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = 9) => ({
  boardSize: size,
  board: createBoard(size),
  mode: 'alt',
  eraseMode: false,
  history: [],
  turn: 0,
  sgfMoves: [],
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  komi: DEFAULT_CONFIG.DEFAULT_KOMI,
  handicapStones: 0,
  handicapPositions: [],
  answerMode: 'black',
  problemDiagramSet: false,
  problemDiagramBlack: [],
  problemDiagramWhite: [],
  gameTree: null,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 }
});

describe('BoardCacheManager', () => {
  let engine, state, monitor, cache;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState(5);
    monitor = new PerformanceMonitor();
    cache = new BoardCacheManager(state, engine, monitor);
  });

  describe('purity (no state writes)', () => {
    test('rebuildBoardFromMoves does not mutate state.sgfMoves', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      const before = state.sgfMoves.slice();
      cache.rebuildBoardFromMoves(state.sgfMoves.length);
      expect(state.sgfMoves).toEqual(before);
    });

    test('rebuildBoardFromMoves does not mutate state.board directly', () => {
      state.board[0][0] = 1;
      const before = state.board.map((r) => r.slice());
      cache.rebuildBoardFromMoves(0);
      expect(state.board).toEqual(before);
    });
  });

  describe('rebuildBoardFromMoves', () => {
    test('rebuilds board from empty state', () => {
      const result = cache.rebuildBoardFromMoves(0);
      expect(result.board).toEqual(createBoard(5));
      expect(result.history).toEqual([]);
      expect(result.turn).toBe(0);
      expect(result.counts).toEqual({ black: 0, white: 0 });
    });

    test('applies moves from state.sgfMoves', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.board[0][0]).toBe(1);
      expect(result.board[1][1]).toBe(2);
      expect(result.history).toHaveLength(2);
      expect(result.turn).toBe(2);
    });

    test('partial rebuild stops at the limit', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.board[0][0]).toBe(1);
      expect(result.board[1][1]).toBe(2);
      expect(result.board[2][2]).toBe(0);
      expect(result.history).toHaveLength(2);
    });

    test('applies initial setup with handicap positions', () => {
      state.handicapPositions = [
        { col: 0, row: 0 },
        { col: 4, row: 4 }
      ];
      const result = cache.rebuildBoardFromMoves(0);
      expect(result.board[0][0]).toBe(1);
      expect(result.board[4][4]).toBe(1);
    });

    test('applies initial setup with problem diagram', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 1, row: 1 }];
      state.problemDiagramWhite = [{ col: 2, row: 2 }];
      const result = cache.rebuildBoardFromMoves(0);
      expect(result.board[1][1]).toBe(1);
      expect(result.board[2][2]).toBe(2);
    });

    test('skips illegal moves', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 0, row: 0, color: 2 },
        { col: 1, row: 1, color: 1 }
      ];
      const result = cache.rebuildBoardFromMoves(3);
      expect(result.board[0][0]).toBe(1);
      expect(result.board[1][1]).toBe(1);
      expect(result.history).toHaveLength(2);
    });

    test('returns newlyApplied count', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.newlyApplied).toBe(2);
    });
  });

  describe('numberMode turn computation', () => {
    test('numberMode adjusts turn by numberStartIndex', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.numberMode = true;
      state.numberStartIndex = 1;
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.turn).toBe(1);
    });
  });

  describe('setMoveIndex', () => {
    test('clamps index to sgfMoves range', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      const result = cache.setMoveIndex(10);
      expect(result.board[1][1]).toBe(2);
    });

    test('clamps to 0 for negative index', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      const result = cache.setMoveIndex(-1);
      expect(result.board[0][0]).toBe(0);
    });
  });

  describe('cache management', () => {
    test('invalidate clears all cache', () => {
      cache.rebuildBoardFromMoves(0);
      expect(cache.canUseCache()).toBe(true);
      cache.invalidate();
      expect(cache.canUseCache()).toBe(false);
    });

    test('rebuildCacheFromHistoryRestore uses current state.board', () => {
      state.board[2][2] = 1;
      state.board[3][3] = 2;
      state.sgfIndex = 0;
      const result = cache.rebuildCacheFromHistoryRestore(0, 0);
      expect(result.board[2][2]).toBe(1);
      expect(result.board[3][3]).toBe(2);
      expect(result.turn).toBe(0);
    });
  });

  describe('findLastMoveIndex', () => {
    test('finds the last matching move from the end', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 0, row: 0, color: 1 }
      ];
      const idx = cache.findLastMoveIndex({ col: 0, row: 0 }, 1);
      expect(idx).toBe(2);
    });

    test('returns -1 when not found', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      const idx = cache.findLastMoveIndex({ col: 1, row: 1 }, 2);
      expect(idx).toBe(-1);
    });
  });

  describe('applyInitialSetup (pure)', () => {
    test('returns an empty board by default', () => {
      const board = cache.applyInitialSetup();
      expect(board).toEqual(createBoard(5));
    });

    test('places handicap stones', () => {
      state.handicapPositions = [{ col: 1, row: 1 }, { col: 3, row: 3 }];
      const board = cache.applyInitialSetup();
      expect(board[1][1]).toBe(1);
      expect(board[3][3]).toBe(1);
    });

    test('places problem diagram black/white', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.problemDiagramWhite = [{ col: 4, row: 4 }];
      const board = cache.applyInitialSetup();
      expect(board[0][0]).toBe(1);
      expect(board[4][4]).toBe(2);
    });
  });

  describe('PerformanceMonitor integration', () => {
    test('metrics are recorded when monitor is enabled', () => {
      monitor.setEnabled(true, true);
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      cache.rebuildBoardFromMoves(1);
      const m = monitor.getMetrics();
      expect(m.rebuildBoardFromMoves.callCount).toBe(1);
      expect(m.rebuildBoardFromMoves.lastLimit).toBe(1);
    });
  });
});
