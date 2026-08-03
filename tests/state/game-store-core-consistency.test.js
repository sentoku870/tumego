import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFIO } from '../../dist/services/sgf-io.js';
import { SGFShare } from '../../dist/services/sgf-share.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

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
  sgfLoadedFromExternal: false
});

const createHistoryMock = () => ({
  save: () => {},
  restore: () => false,
  restoreLast: () => false,
  getList: () => [],
  clear: () => {},
  showHistoryDialog: () => {}
});

const buildBoardFromMoves = (size, moves) => {
  const board = createBoard(size);
  moves.forEach(({ col, row, color }) => {
    board[row][col] = color;
  });
  return board;
};

const expectBoardState = (state, expectedBoard) => {
  expect(state.board).toEqual(expectedBoard);
};

const expectCurrentColorFromTurn = (state, store) => {
  const expected =
    state.turn % 2 === 0 ? state.startColor : 3 - state.startColor;
  expect(store.currentColor).toBe(expected);
};

describe('Core consistency: GameStore state alignment', () => {
  let engine;
  let state;
  let store;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState();
    store = new GameStore(state, engine, createHistoryMock());
  });

  test('Test1: initial state consistency (right after clear)', () => {
    expect(state.sgfMoves).toEqual([]);
    expect(state.sgfIndex).toBe(0);
    expectBoardState(state, createBoard(state.boardSize));
    expect(state.turn).toBe(0);
    expectCurrentColorFromTurn(state, store);
  });

  test('Test2: playMove single integration', () => {
    const move = { col: 0, row: 0, color: 1 };
    const success = store.tryMove(move);

    expect(success).toBe(true);
    expect(state.sgfMoves).toHaveLength(1);
    expect(state.sgfMoves[0]).toEqual(move);
    expect(state.sgfIndex).toBe(state.sgfMoves.length);
    expect(state.board[0][0]).toBe(move.color);
    expect(state.turn).toBe(1);
    expectCurrentColorFromTurn(state, store);
  });

  test('Test3: multiple playMove -> undo returns one move', () => {
    const moves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 }
    ];

    moves.forEach((move) => store.tryMove(move));

    const undone = store.undo();

    expect(undone).toBe(false);
    expect(state.sgfMoves).toHaveLength(3);
    expect(state.sgfIndex).toBe(state.sgfMoves.length);
    expect(state.turn).toBe(3);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, moves));
    expectCurrentColorFromTurn(state, store);
  });

  test('Test4: move index jump via setMoveIndex', () => {
    const moves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 },
      { col: 1, row: 1, color: 2 },
      { col: 2, row: 2, color: 1 }
    ];

    moves.forEach((move) => store.tryMove(move));

    store.setMoveIndex(2);
    expect(state.sgfIndex).toBe(2);
    expect(state.turn).toBe(2);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, moves.slice(0, 2)));
    expectCurrentColorFromTurn(state, store);

    store.setMoveIndex(5);
    expect(state.sgfIndex).toBe(5);
    expect(state.turn).toBe(5);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, moves));
    expectCurrentColorFromTurn(state, store);
  });

  test('Test5: SGF load -> setMoveIndex combination', () => {
    const parser = new SGFParser();
    const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));
    const sgf = '(;GM[1]SZ[9];B[aa];W[ab];B[ba])';

    const result = service.parse(sgf);
    service.apply(result);

    const expectedMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 0, row: 1, color: 2 },
      { col: 1, row: 0, color: 1 }
    ];

    store.setMoveIndex(0);
    expect(state.sgfIndex).toBe(0);
    expect(state.turn).toBe(0);
    expectBoardState(state, createBoard(state.boardSize));
    expectCurrentColorFromTurn(state, store);

    store.setMoveIndex(1);
    expect(state.sgfIndex).toBe(1);
    expect(state.turn).toBe(1);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, expectedMoves.slice(0, 1)));
    expectCurrentColorFromTurn(state, store);

    store.setMoveIndex(3);
    expect(state.sgfIndex).toBe(3);
    expect(state.turn).toBe(3);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, expectedMoves));
    expectCurrentColorFromTurn(state, store);
  });

  test('Test6: normal mode undo does not change sgfIndex', () => {
    const moves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 }
    ];

    moves.forEach((move) => store.tryMove(move));

    const indexBefore = state.sgfIndex;

    const undone = store.undo();

    expect(undone).toBe(false);
    expect(state.sgfMoves).toHaveLength(3);
    expect(state.sgfIndex).toBe(indexBefore);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, moves));
    expect(state.turn).toBe(3);
  });

  test('Test7: setMoveIndex after undo restores all moves like redo', () => {
    const moves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 }
    ];

    state.numberMode = true;
    state.numberStartIndex = 0;

    moves.forEach((move) => store.tryMove(move));

    const undone = store.undo();

    expect(undone).toBe(false);
    expect(state.sgfIndex).toBe(moves.length);
    expectBoardState(state, buildBoardFromMoves(state.boardSize, moves));
  });

  test('Test8: expand problem diagram from solve mode to edit', () => {
    store.directPlace({ col: 0, row: 0 }, 1);
    store.directPlace({ col: 1, row: 0 }, 2);
    store.setProblemDiagram();

    store.enterSolveMode();
    const solveMoves = [
      { col: 2, row: 2, color: 1 },
      { col: 3, row: 2, color: 2 }
    ];
    solveMoves.forEach((move) => store.tryMove(move));

    expect(state.numberMode).toBe(true);
    expect(state.sgfMoves).toHaveLength(solveMoves.length);
    expect(state.turn).toBe(solveMoves.length);

    const problemDiagramBlack = [...state.problemDiagramBlack];
    const problemDiagramWhite = [...state.problemDiagramWhite];

    store.exitSolveModeForEditing();

    expect(state.numberMode).toBe(false);
    expect(state.mode).toBe('alt');
    const expectedBoard = createBoard(state.boardSize);
    problemDiagramBlack.forEach((pos) => {
      expectedBoard[pos.row][pos.col] = 1;
    });
    problemDiagramWhite.forEach((pos) => {
      expectedBoard[pos.row][pos.col] = 2;
    });
    expectBoardState(state, expectedBoard);
    expect(state.sgfMoves).toHaveLength(0);
    expect(state.sgfIndex).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.history).toEqual([]);
    expect(state.problemDiagramSet).toBe(true);
    expect(state.problemDiagramBlack).toEqual(problemDiagramBlack);
    expect(state.problemDiagramWhite).toEqual(problemDiagramWhite);
  });

  test('Test9: clear all in solve mode returns to initial edit state', () => {
    store.directPlace({ col: 0, row: 0 }, 1);
    store.directPlace({ col: 1, row: 0 }, 2);
    store.setProblemDiagram();

    store.enterSolveMode();
    const solveMoves = [
      { col: 2, row: 2, color: 1 },
      { col: 3, row: 2, color: 2 },
      { col: 4, row: 4, color: 1 }
    ];
    solveMoves.forEach((move) => store.tryMove(move));

    expect(state.numberMode).toBe(true);
    expect(state.sgfMoves).toHaveLength(solveMoves.length);
    expect(state.turn).toBe(solveMoves.length);

    store.resetForClearAll();

    expectBoardState(state, createBoard(state.boardSize));
    expect(state.sgfMoves).toHaveLength(0);
    expect(state.sgfIndex).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.numberMode).toBe(false);
    expect(state.mode).toBe('alt');
    expect(state.history).toEqual([]);
    expect(state.problemDiagramSet).toBe(false);
    expect(state.numberStartIndex).toBe(0);
    expectCurrentColorFromTurn(state, store);
  });
});
