import { GoEngine } from '../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createState = (board) => ({
  boardSize: board.length,
  board: board.map(row => row.slice()),
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
  gameTree: null
});

const emptyBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));
const placeStones = (board, coords, color) => {
  coords.forEach(({ col, row }) => {
    board[row][col] = color;
  });
  return board;
};

const cloneBoard = (board) => board.map(row => row.slice());

describe('GoEngine', () => {
  const engine = new GoEngine();

  test('captures surrounded stones when a liberty is filled', () => {
    const state = createState([
      [0, 1, 0],
      [1, 2, 0],
      [0, 1, 0]
    ]);

    const result = engine.playMove(state, { col: 2, row: 1 }, 1);
    expect(result).not.toBeNull();

    const board = result.board;
    expect(board[1][1]).toBe(0);
    expect(board[1][2]).toBe(1);
    expect(state.board[1][1]).toBe(2);
  });

  test('rejects suicide moves that do not capture opponents', () => {
    const board = [
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
      [0, 2, 0, 2, 0],
      [0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0]
    ];
    const state = createState(board);

    const result = engine.playMove(state, { col: 2, row: 2 }, 1);
    expect(result).toBeNull();
  });

  test('provides handicap stones for supported board sizes', () => {
    const positions = engine.generateHandicapPositions(9, 4);
    expect(positions).toHaveLength(4);
    expect(positions).toEqual([
      { col: 6, row: 2 },
      { col: 2, row: 2 },
      { col: 6, row: 6 },
      { col: 2, row: 6 }
    ]);
  });

  test('returns an empty array for unsupported handicap requests', () => {
    expect(engine.generateHandicapPositions(10, 2)).toEqual([]);
    expect(engine.generateHandicapPositions(9, 42)).toEqual([]);
  });

  describe('capture scenarios', () => {
    test('C1: captures a single stone in the middle of the board', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 2, row: 2 } // White stone with last liberty below
      ], 2);

      placeStones(board, [
        { col: 2, row: 1 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 3 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0); // captured
      expect(result.board[3][2]).toBe(1); // new black stone
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });

    test('C2: captures a single edge stone', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 2, row: 0 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 0 },
        { col: 3, row: 0 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      const expected = placeStones(cloneBoard(board), [
        { col: 2, row: 1 }
      ], 1);
      expected[0][2] = 0;

      expect(result.board).toEqual(expected);
    });

    test('C3: captures a single corner stone', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 0, row: 0 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 0 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 0, row: 1 }, 1);

      expect(result).not.toBeNull();
      const expected = placeStones(cloneBoard(board), [
        { col: 0, row: 1 }
      ], 1);
      expected[0][0] = 0;

      expect(result.board).toEqual(expected);
    });

    test('C4: captures a two-stone connected group with one liberty', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 2 },
        { col: 2, row: 3 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 2 }, { col: 3, row: 2 },
        { col: 1, row: 3 }, { col: 3, row: 3 },
        { col: 2, row: 4 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0);
      expect(result.board[3][2]).toBe(0);
      expect(result.board[1][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });

    test('C5: captures two separate groups that share a liberty', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 1, row: 1 },
        { col: 3, row: 1 }
      ], 2);

      placeStones(board, [
        { col: 0, row: 1 }, { col: 1, row: 0 }, { col: 1, row: 2 },
        { col: 4, row: 1 }, { col: 3, row: 0 }, { col: 3, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[1][1]).toBe(0);
      expect(result.board[1][3]).toBe(0);
      expect(result.board[1][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });
  });

  describe('suicide detection', () => {
    test('S1: rejects pure suicide when no capture occurs', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 1 },
        { col: 2, row: 3 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 2);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 2 }, 1);

      expect(result).toBeNull();
      expect(state.board).toEqual(board);
    });

    test('S2: allows move that looks suicidal but captures adjacent groups', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 1 },
        { col: 2, row: 3 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 1 }, { col: 3, row: 1 }, { col: 2, row: 0 },
        { col: 1, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 4 },
        { col: 0, row: 2 }, { col: 4, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 2 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[1][2]).toBe(0);
      expect(result.board[3][2]).toBe(0);
      expect(result.board[2][1]).toBe(0);
      expect(result.board[2][3]).toBe(0);
      expect(result.board[2][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });
  });

  describe('simple ko (intended behavior)', () => {
    const buildKoBase = () => {
      const board = emptyBoard(5);
      // White stone at (2,2) with one liberty at (2,3)
      placeStones(board, [{ col: 2, row: 2 }], 2);
      // Surrounding black stones
      placeStones(board, [
        { col: 1, row: 2 }, { col: 3, row: 2 }, { col: 2, row: 1 }
      ], 1);
      // White stones that will leave the capturing stone with only the ko liberty
      placeStones(board, [
        { col: 1, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 4 }
      ], 2);
      return board;
    };

    test('K1: first capture that creates ko is legal', () => {
      const state = createState(buildKoBase());
      const result = engine.playMove(state, { col: 2, row: 3 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0);
      expect(result.board[3][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(3);
      // No ko metadata exists yet; future implementation should mark (2,2) as ko point
    });

    test('K2: immediate recapture at ko point should be illegal (intended)', () => {
      const afterCapture = engine.playMove(createState(buildKoBase()), { col: 2, row: 3 }, 1);
      const koBoard = afterCapture?.board ?? [];

      const recaptureState = createState(koBoard);
      const recapture = engine.playMove(recaptureState, { col: 2, row: 2 }, 2);

      expect(recapture).toBeNull();
      expect(recaptureState.board).toEqual(koBoard);
    });

    test('K3: recapture becomes legal after a move elsewhere (intended)', () => {
      const afterCapture = engine.playMove(createState(buildKoBase()), { col: 2, row: 3 }, 1);
      const koBoard = afterCapture?.board ?? [];

      const moveElsewhereState = createState(koBoard);
      const elsewhere = engine.playMove(moveElsewhereState, { col: 0, row: 0 }, 2);
      expect(elsewhere).not.toBeNull();

      const recaptureState = createState(elsewhere.board);
      const recapture = engine.playMove(recaptureState, { col: 2, row: 2 }, 2);

      expect(recapture).not.toBeNull();
      expect(recapture.board[3][2]).toBe(0);
      expect(recapture.board[2][2]).toBe(2);
    });
  });
});
