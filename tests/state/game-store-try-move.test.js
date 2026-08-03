import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
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
  gameTree: null,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  rootMarkers: [],
  nodeMarkers: [],
  ...overrides
});

describe('GameStore.tryMove()', () => {
  let engine, history, state, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('basic success path', () => {
    test('places a stone on an empty cell', () => {
      const result = store.tryMove({ col: 4, row: 4 });
      expect(result).toBe(true);
      expect(state.board[4][4]).toBe(1);
    });

    test('increments turn after successful move', () => {
      store.tryMove({ col: 4, row: 4 });
      expect(state.turn).toBe(1);
    });

    test('alternates color via alt mode', () => {
      store.tryMove({ col: 4, row: 4 });
      store.tryMove({ col: 3, row: 3 });
      expect(state.board[4][4]).toBe(1);
      expect(state.board[3][3]).toBe(2);
    });

    test('appends move to sgfMoves', () => {
      store.tryMove({ col: 4, row: 4 });
      expect(state.sgfMoves).toHaveLength(1);
      expect(state.sgfMoves[0]).toEqual({ col: 4, row: 4, color: 1 });
    });

    test('updates sgfIndex to track the latest move', () => {
      store.tryMove({ col: 4, row: 4 });
      expect(state.sgfIndex).toBe(1);
    });
  });

  describe('failure cases', () => {
    test('returns false on occupied cell', () => {
      state.board[4][4] = 1;
      const result = store.tryMove({ col: 4, row: 4 });
      expect(result).toBe(false);
    });

    test('returns false for out-of-bounds position', () => {
      const result = store.tryMove({ col: 99, row: 99 });
      expect(result).toBe(false);
    });

    test('returns false for negative position', () => {
      const result = store.tryMove({ col: -1, row: -1 });
      expect(result).toBe(false);
    });

    test('does not increment turn on failed move', () => {
      state.board[4][4] = 1;
      const initialTurn = state.turn;
      store.tryMove({ col: 4, row: 4 });
      expect(state.turn).toBe(initialTurn);
    });
  });

  describe('record=false (non-recording mode)', () => {
    test('does not modify sgfMoves', () => {
      store.tryMove({ col: 4, row: 4 }, false);
      expect(state.sgfMoves).toHaveLength(0);
    });

    test('does not change sgfIndex when record=false', () => {
      store.tryMove({ col: 4, row: 4 }, false);
      expect(state.sgfIndex).toBe(0);
    });
  });

  describe('history tail overwrite', () => {
    test('truncates sgfMoves when adding a move at a non-tail index', () => {
      store.tryMove({ col: 4, row: 4 });
      store.tryMove({ col: 3, row: 3 });
      expect(state.sgfMoves).toHaveLength(2);

      store.setMoveIndex(1);
      store.tryMove({ col: 2, row: 2 });

      expect(state.sgfMoves).toHaveLength(2);
      expect(state.sgfMoves[1]).toEqual({ col: 2, row: 2, color: 2 });
    });
  });

  describe('fixed color modes', () => {
    test('black mode always uses color 1', () => {
      state.mode = 'black';
      store.tryMove({ col: 4, row: 4 });
      store.tryMove({ col: 3, row: 3 });
      expect(state.board[4][4]).toBe(1);
      expect(state.board[3][3]).toBe(1);
    });

    test('white mode always uses color 2', () => {
      state.mode = 'white';
      store.tryMove({ col: 4, row: 4 });
      store.tryMove({ col: 3, row: 3 });
      expect(state.board[4][4]).toBe(2);
      expect(state.board[3][3]).toBe(2);
    });
  });

  describe('capture handling', () => {
    test('places a stone adjacent to opponent successfully', () => {
      // Setup a single white stone at (col=4, row=4) then place black adjacent.
      state.board[4][4] = 2;
      const result = store.tryMove({ col: 4, row: 3 });
      expect(result).toBe(true);
      // board[row][col] - the placed stone at pos { col: 4, row: 3 } is board[3][4]
      expect(state.board[3][4]).toBe(1);
    });
  });
});
