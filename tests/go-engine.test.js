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
});
