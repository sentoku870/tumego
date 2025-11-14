import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = DEFAULT_CONFIG.DEFAULT_BOARD_SIZE) => ({
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
  gameTree: null
});

const createHistoryMock = () => ({
  save: () => {},
  restore: () => false,
  getList: () => [],
  clear: () => {},
  showHistoryDialog: () => {}
});

const snapshotBoard = (state) => state.board.map(row => row.join(''));
const createExpectedBoard = (size, placements) => {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => '0'));
  placements.forEach(({ col, row, value }) => {
    grid[row][col] = String(value);
  });
  return grid.map(row => row.join(''));
};

describe('rebuildBoardFromMoves', () => {
  let engine;
  let state;
  let store;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState();
    store = new GameStore(state, engine, createHistoryMock());
  });

  describe('主要盤サイズの検証', () => {
    const moves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 },
      { col: 1, row: 1, color: 2 },
      { col: 2, row: 2, color: 1 }
    ];

    [9, 13, 19].forEach(size => {
      test(`${size}x${size} 盤での盤面再構築`, () => {
        state.boardSize = size;
        state.board = createBoard(size);
        state.sgfMoves = moves;

        store.rebuildBoardFromMoves(moves.length);

        expect({
          board: snapshotBoard(state),
          turn: state.turn,
          historyLength: state.history.length
        }).toEqual({
          board: createExpectedBoard(size, [
            { col: 0, row: 0, value: 1 },
            { col: 1, row: 0, value: 2 },
            { col: 0, row: 1, value: 1 },
            { col: 1, row: 1, value: 2 },
            { col: 2, row: 2, value: 1 }
          ]),
          turn: moves.length,
          historyLength: moves.length
        });
      });
    });
  });

  test('分岐棋譜の途中までを再現する', () => {
    const moves = [
      { col: 4, row: 4, color: 1 },
      { col: 5, row: 4, color: 2 },
      { col: 4, row: 5, color: 1 },
      { col: 5, row: 5, color: 2 },
      { col: 3, row: 4, color: 1 }
    ];

    state.sgfMoves = moves;

    store.rebuildBoardFromMoves(3);

    expect({
      board: snapshotBoard(state),
      turn: state.turn,
      historyLength: state.history.length
    }).toEqual({
      board: createExpectedBoard(state.boardSize, [
        { col: 4, row: 4, value: 1 },
        { col: 5, row: 4, value: 2 },
        { col: 4, row: 5, value: 1 }
      ]),
      turn: 3,
      historyLength: 3
    });
  });

  test('自殺手が含まれる棋譜をスキップする', () => {
    state.sgfMoves = [
      { col: 1, row: 0, color: 1 },
      { col: 0, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 },
      { col: 2, row: 2, color: 2 },
      { col: 2, row: 1, color: 1 },
      { col: 5, row: 5, color: 2 },
      { col: 1, row: 2, color: 1 },
      { col: 1, row: 1, color: 2 }
    ];

    store.rebuildBoardFromMoves(state.sgfMoves.length);

    expect({
      board: snapshotBoard(state),
      turn: state.turn,
      historyLength: state.history.length
    }).toEqual({
      board: createExpectedBoard(state.boardSize, [
        { col: 1, row: 0, value: 1 },
        { col: 0, row: 1, value: 1 },
        { col: 2, row: 1, value: 1 },
        { col: 1, row: 2, value: 1 },
        { col: 2, row: 2, value: 2 },
        { col: 5, row: 5, value: 2 }
      ]),
      turn: state.sgfMoves.length,
      historyLength: 7
    });
  });
});
