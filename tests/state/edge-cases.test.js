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

describe('GameStore edge cases', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('tryMove edge cases', () => {
    test('rejects move on occupied position', () => {
      state.board[0][0] = 1;
      const result = store.tryMove({ col: 0, row: 0 });
      expect(result).toBe(false);
    });

    test('rejects move outside board (negative col)', () => {
      const result = store.tryMove({ col: -1, row: 0 });
      expect(result).toBe(false);
    });

    test('rejects move outside board (negative row)', () => {
      const result = store.tryMove({ col: 0, row: -1 });
      expect(result).toBe(false);
    });

    test('rejects move outside board (too large)', () => {
      const result = store.tryMove({ col: 9, row: 0 });
      expect(result).toBe(false);
    });

    test('accepts move on empty position', () => {
      const result = store.tryMove({ col: 0, row: 0 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
    });
  });

  describe('removeStone edge cases', () => {
    test('returns false on empty position', () => {
      const result = store.removeStone({ col: 0, row: 0 });
      expect(result).toBe(false);
    });

    test('returns false on invalid position (negative)', () => {
      const result = store.removeStone({ col: -1, row: 0 });
      expect(result).toBe(false);
    });

    test('returns false on invalid position (too large)', () => {
      const result = store.removeStone({ col: 9, row: 0 });
      expect(result).toBe(false);
    });

    test('removes stone on occupied position', () => {
      state.board[0][0] = 1;
      const result = store.removeStone({ col: 0, row: 0 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(0);
    });
  });

  describe('setMoveIndex edge cases', () => {
    test('clamps negative index to 0', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.setMoveIndex(-5);
      expect(state.sgfIndex).toBe(0);
    });

    test('handles empty sgfMoves with index 0', () => {
      state.sgfMoves = [];
      store.setMoveIndex(0);
      expect(state.sgfIndex).toBe(0);
    });
  });

  describe('undo edge cases', () => {
    test('returns false when no history to restore', () => {
      const result = store.undo();
      expect(result).toBe(false);
    });
  });

  describe('board size transitions', () => {
    test('handles transition from 9 to 19', () => {
      store.initBoard(9);
      state.board[0][0] = 1;
      store.initBoard(19);
      expect(state.boardSize).toBe(19);
      expect(state.board.length).toBe(19);
      expect(state.board[0].length).toBe(19);
      expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
    });

    test('handles transition from 19 to 9', () => {
      store.initBoard(19);
      store.initBoard(9);
      expect(state.boardSize).toBe(9);
      expect(state.board.length).toBe(9);
    });

    test('handles transition from 9 to 9 (same size)', () => {
      state.board[0][0] = 1;
      store.initBoard(9);
      expect(state.boardSize).toBe(9);
      expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
    });
  });

  describe('directPlace / directRemove / placeWithRulesInEdit', () => {
    test('directPlace puts stone regardless of rules', () => {
      const result = store.directPlace({ col: 0, row: 0 }, 1);
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
    });

    test('directPlace on invalid position returns false', () => {
      const result = store.directPlace({ col: -1, row: 0 }, 1);
      expect(result).toBe(false);
    });

    test('directPlace increments turn', () => {
      state.turn = 0;
      store.directPlace({ col: 0, row: 0 }, 1);
      expect(state.turn).toBe(1);
    });

    test('directPlace on occupied cell overwrites', () => {
      state.board[0][0] = 1;
      store.directPlace({ col: 0, row: 0 }, 2);
      expect(state.board[0][0]).toBe(2);
    });

    test('directRemove removes stone', () => {
      state.board[0][0] = 1;
      const result = store.directRemove({ col: 0, row: 0 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(0);
    });

    test('directRemove on empty cell returns false', () => {
      const result = store.directRemove({ col: 0, row: 0 });
      expect(result).toBe(false);
    });

    test('directRemove on invalid position returns false', () => {
      const result = store.directRemove({ col: -1, row: 0 });
      expect(result).toBe(false);
    });

    test('directRemove decrements turn (but not below 0)', () => {
      state.turn = 3;
      state.board[0][0] = 1;
      store.directRemove({ col: 0, row: 0 });
      expect(state.turn).toBe(2);
      // Cannot go below 0
      state.turn = 0;
      state.board[1][1] = 2;
      store.directRemove({ col: 1, row: 1 });
      expect(state.turn).toBe(0);
    });

    test('placeWithRulesInEdit places stone following rules', () => {
      const result = store.placeWithRulesInEdit({ col: 0, row: 0 }, 1);
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
    });
  });

  describe('restoreHistorySnapshot edge cases', () => {
    test('returns false when index is out of range', () => {
      const result = store.restoreHistorySnapshot(999);
      expect(result).toBe(false);
    });

    test('returns false when history is empty', () => {
      const result = store.restoreHistorySnapshot(0);
      expect(result).toBe(false);
    });
  });
});
