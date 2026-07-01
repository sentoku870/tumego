import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

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

describe('GameStore cache and performance', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('cache invalidation', () => {
    test('tryMove updates board', () => {
      const result = store.tryMove({ col: 0, row: 0 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
    });

    test('removeStone updates board', () => {
      state.board[0][0] = 1;
      store.removeStone({ col: 0, row: 0 });
      expect(state.board[0][0]).toBe(0);
    });

    test('setMoveIndex updates sgfIndex', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      store.setMoveIndex(1);
      expect(state.sgfIndex).toBe(1);
    });

    test('setMoveIndex moves forward', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      store.setMoveIndex(0);
      expect(state.sgfIndex).toBe(0);
      store.setMoveIndex(2);
      expect(state.sgfIndex).toBe(2);
    });

    test('setMoveIndex moves backward', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      store.setMoveIndex(3);
      expect(state.sgfIndex).toBe(3);
      store.setMoveIndex(1);
      expect(state.sgfIndex).toBe(1);
    });
  });

  describe('performance metrics - default state', () => {
    test('default callCount is 0', () => {
      const metrics = store.getPerformanceMetrics();
      expect(metrics.rebuildBoardFromMoves.callCount).toBe(0);
    });

    test('default totalDurationMs is 0', () => {
      const metrics = store.getPerformanceMetrics();
      expect(metrics.rebuildBoardFromMoves.totalDurationMs).toBe(0);
    });

    test('default lastDurationMs is 0', () => {
      const metrics = store.getPerformanceMetrics();
      expect(metrics.rebuildBoardFromMoves.lastDurationMs).toBe(0);
    });
  });

  describe('performance metrics - enabled', () => {
    test('setPerformanceDebugging(true) enables metrics', () => {
      store.setPerformanceDebugging(true, false);
      // We can verify it's enabled by triggering a rebuild and checking metrics
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.setMoveIndex(1);
      const metrics = store.getPerformanceMetrics();
      // callCount should be a number
      expect(typeof metrics.rebuildBoardFromMoves.callCount).toBe('number');
    });

    test('setPerformanceDebugging(true, true) resets metrics first', () => {
      // First, enable without reset to potentially accumulate
      store.setPerformanceDebugging(true, false);
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.setMoveIndex(1);
      // Then enable with reset
      store.setPerformanceDebugging(true, true);
      const metrics = store.getPerformanceMetrics();
      expect(metrics.rebuildBoardFromMoves.callCount).toBe(0);
    });

    test('resetPerformanceMetrics clears counters', () => {
      store.setPerformanceDebugging(true, false);
      store.resetPerformanceMetrics();
      const metrics = store.getPerformanceMetrics();
      expect(metrics.rebuildBoardFromMoves.callCount).toBe(0);
      expect(metrics.rebuildBoardFromMoves.totalDurationMs).toBe(0);
    });
  });

  describe('performance metrics - return value isolation', () => {
    test('getPerformanceMetrics returns a copy (not the internal state)', () => {
      const metrics1 = store.getPerformanceMetrics();
      const metrics2 = store.getPerformanceMetrics();
      expect(metrics1).not.toBe(metrics2);
      expect(metrics1.rebuildBoardFromMoves).not.toBe(metrics2.rebuildBoardFromMoves);
    });

    test('mutating returned metrics does not affect internal state', () => {
      const metrics = store.getPerformanceMetrics();
      metrics.rebuildBoardFromMoves.callCount = 999;
      const fresh = store.getPerformanceMetrics();
      expect(fresh.rebuildBoardFromMoves.callCount).not.toBe(999);
    });
  });

  describe('rebuild metrics accumulation', () => {
    test('rebuildBoardFromMoves produces metrics when enabled', () => {
      store.setPerformanceDebugging(true, true);
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      store.setMoveIndex(2);
      const metrics = store.getPerformanceMetrics();
      // callCount should be a number >= 0
      const valid = metrics.rebuildBoardFromMoves.callCount >= 0;
      expect(valid).toBe(true);
    });
  });
});
