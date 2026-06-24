import {
  cloneBoard,
  createEmptyBoard,
  createInitialCapturedCounts,
  hasGameData,
  isValidPosition,
} from '../../dist/state/board-utils.js';

const createState = (overrides = {}) => ({
  boardSize: 9,
  board: createEmptyBoard(9),
  mode: 'alt',
  eraseMode: false,
  history: [],
  turn: 0,
  sgfMoves: [],
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  komi: 6.5,
  handicapStones: 0,
  handicapPositions: [],
  answerMode: 'black',
  problemDiagramSet: false,
  problemDiagramBlack: [],
  problemDiagramWhite: [],
  gameTree: null,
  sgfLoadedFromExternal: false,
  capturedCounts: createInitialCapturedCounts(),
  ...overrides,
});

describe('board-utils', () => {
  describe('createEmptyBoard', () => {
    test('creates a 2D array of zeros with the given size', () => {
      const board = createEmptyBoard(9);
      expect(board).toHaveLength(9);
      board.forEach((row) => {
        expect(row).toHaveLength(9);
        row.forEach((cell) => expect(cell).toBe(0));
      });
    });

    test('returns independent instances for each call', () => {
      const a = createEmptyBoard(9);
      const b = createEmptyBoard(9);
      a[0][0] = 1;
      expect(b[0][0]).toBe(0);
    });
  });

  describe('cloneBoard', () => {
    test('returns a deep copy', () => {
      const board = createEmptyBoard(9);
      board[3][4] = 1;
      const copy = cloneBoard(board);
      expect(copy).toEqual(board);
      copy[0][0] = 2;
      expect(board[0][0]).toBe(0);
    });
  });

  describe('createInitialCapturedCounts', () => {
    test('returns zeros for both colors', () => {
      const counts = createInitialCapturedCounts();
      expect(counts).toEqual({ black: 0, white: 0 });
    });
  });

  describe('isValidPosition', () => {
    test('returns true for positions inside the board', () => {
      expect(isValidPosition(9, { col: 0, row: 0 })).toBe(true);
      expect(isValidPosition(9, { col: 8, row: 8 })).toBe(true);
      expect(isValidPosition(9, { col: 4, row: 4 })).toBe(true);
    });

    test('returns false for positions outside the board', () => {
      expect(isValidPosition(9, { col: -1, row: 0 })).toBe(false);
      expect(isValidPosition(9, { col: 0, row: -1 })).toBe(false);
      expect(isValidPosition(9, { col: 9, row: 0 })).toBe(false);
      expect(isValidPosition(9, { col: 0, row: 9 })).toBe(false);
    });

    test('respects custom boardSize', () => {
      expect(isValidPosition(19, { col: 18, row: 18 })).toBe(true);
      expect(isValidPosition(19, { col: 19, row: 0 })).toBe(false);
    });
  });

  describe('hasGameData', () => {
    test('returns false for an empty state', () => {
      expect(hasGameData(createState())).toBe(false);
    });

    test('returns true when sgfMoves are present', () => {
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      expect(hasGameData(state)).toBe(true);
    });

    test('returns true when handicapStones > 0', () => {
      const state = createState();
      state.handicapStones = 4;
      expect(hasGameData(state)).toBe(true);
    });

    test('returns true when board has any non-zero cell', () => {
      const state = createState();
      state.board[2][3] = 1;
      expect(hasGameData(state)).toBe(true);
    });
  });
});
