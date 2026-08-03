import { BoardCacheManager } from '../../dist/state/board-cache-manager.js';
import { GoEngine } from '../../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => ({
  boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
  board: createBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE),
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
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  rootMarkers: [],
  nodeMarkers: [],
  ...overrides
});

describe('BoardCacheManager cache behavior', () => {
  let engine, state, cache;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState();
    cache = new BoardCacheManager(state, engine);
  });

  describe('initial state', () => {
    test('cache is empty after construction', () => {
      expect(cache.canUseCache()).toBe(false);
    });
  });

  describe('invalidate()', () => {
    test('resets all cache fields after rebuild', () => {
      state.sgfMoves = [{ col: 4, row: 4, color: 1 }];
      state.sgfIndex = 1;
      const result = cache.rebuildBoardFromMoves(1);
      // Sync state.board to the cached board so canUseCache returns true
      state.board = JSON.parse(JSON.stringify(result.board));
      state.turn = result.turn;
      state.capturedCounts = JSON.parse(JSON.stringify(result.counts));
      expect(cache.canUseCache()).toBe(true);

      cache.invalidate();

      expect(cache.canUseCache()).toBe(false);
    });
  });

  describe('rebuildBoardFromMoves()', () => {
    test('rebuilds empty board when sgfMoves is empty', () => {
      state.sgfMoves = [];
      const result = cache.rebuildBoardFromMoves(0);
      expect(result.board.every(row => row.every(cell => cell === 0))).toBe(true);
    });

    test('rebuilds board with stones from sgfMoves', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.board[4][4]).toBe(1);
      expect(result.board[3][3]).toBe(2);
    });

    test('rebuilds partial board when limit is smaller than sgfMoves', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      const result = cache.rebuildBoardFromMoves(1);
      expect(result.board[4][4]).toBe(1);
      expect(result.board[3][3]).toBe(0);
    });

    test('updates turn based on limit', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];
      const result = cache.rebuildBoardFromMoves(2);
      expect(result.turn).toBe(2);
    });
  });

  describe('cache hit behavior via setMoveIndex()', () => {
    test('reuses cached board on repeated setMoveIndex calls', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];

      const result = cache.setMoveIndex(2);
      // Sync state.board to the cached board so canUseCache returns true
      state.board = JSON.parse(JSON.stringify(result.board));
      state.turn = result.turn;
      state.capturedCounts = JSON.parse(JSON.stringify(result.counts));
      expect(cache.canUseCache()).toBe(true);

      const beforeInvalidateBoard = cache.cachedBoardState;

      cache.setMoveIndex(2);
      expect(cache.canUseCache()).toBe(true);
      expect(cache.cachedBoardState).toBe(beforeInvalidateBoard);
    });

    test('falls back to rebuild when state.board differs from cache', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];

      cache.setMoveIndex(2);

      // Mutate state.board to invalidate cache match
      state.board[4][4] = 0;

      const result = cache.setMoveIndex(2);
      expect(result.board[4][4]).toBe(1);
    });
  });

  describe('clamping behavior', () => {
    test('clamps negative index to 0', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 }
      ];
      const result = cache.setMoveIndex(-1);
      expect(result.turn).toBe(0);
    });

    test('clamps too-large index to sgfMoves.length', () => {
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];
      const result = cache.setMoveIndex(999);
      expect(result.turn).toBe(2);
    });
  });
});
