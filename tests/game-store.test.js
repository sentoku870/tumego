import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = 5) => ({
  boardSize: size,
  board: createBoard(size),
  playMode: 'alt',
  appMode: 'edit',
  eraseMode: false,
  history: [],
  turn: 0,
  sgfMoves: [],
  originalMoveList: [],
  solutionMoveList: [],
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  reviewTurn: 1,
  komi: DEFAULT_CONFIG.DEFAULT_KOMI,
  handicapStones: 0,
  handicapPositions: [],
  answerMode: 'black',
  problemDiagramSet: false,
  problemDiagramBlack: [],
  problemDiagramWhite: [],
  gameTree: null,
  sgfLoadedFromExternal: false,
  originalSGF: '',
  problemSGF: '',
  solutionSGF: ''
});

const createHistoryMock = () => ({
  save: () => {},
  restore: () => false,
  getList: () => [],
  clear: () => {},
  showHistoryDialog: () => {}
});

describe('GameStore', () => {
  let engine;
  let state;
  let store;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState();
    store = new GameStore(state, engine, createHistoryMock());
  });

  test('applies moves through the engine and records history', () => {
    const success = store.tryMove({ col: 1, row: 1 }, 1);
    expect(success).toBe(true);
    expect(state.board[1][1]).toBe(1);
    expect(state.turn).toBe(1);
    expect(state.problemDiagramBlack).toEqual([{ col: 1, row: 1 }]);
    expect(state.problemSGF).toContain('AB[bb]');
    expect(state.history.length).toBe(1);
  });

  test('removes only the targeted stone in free edit mode', () => {
    store.tryMove({ col: 1, row: 1 }, 1);
    const removed = store.removeStone({ col: 1, row: 1 });

    expect(removed).toBe(true);
    expect(state.board[1][1]).toBe(0);
    expect(state.problemDiagramBlack).toHaveLength(0);
    expect(state.problemSGF.includes('AB[bb]')).toBe(false);
  });

  test('free edit removal keeps later stones intact', () => {
    store.tryMove({ col: 0, row: 0 }, 1);
    store.tryMove({ col: 1, row: 0 }, 2);
    store.tryMove({ col: 2, row: 0 }, 1);
    store.tryMove({ col: 3, row: 0 }, 2);

    const removed = store.removeStone({ col: 2, row: 0 });

    expect(removed).toBe(true);
    expect(state.board[0][0]).toBe(1);
    expect(state.board[0][1]).toBe(2);
    expect(state.board[0][2]).toBe(0);
    expect(state.board[0][3]).toBe(2);
    expect(state.problemDiagramBlack).toEqual([{ col: 0, row: 0 }]);
  });

  test('truncates SGF moves when editing a loaded record', () => {
    state.sgfLoadedFromExternal = true;
    state.appMode = 'review';
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 2, row: 0, color: 1 }
    ];

    store.setMoveIndex(3);

    const removed = store.removeStone({ col: 2, row: 0 });

    expect(removed).toBe(true);
    expect(state.sgfMoves).toEqual([
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 }
    ]);
    expect(state.sgfIndex).toBe(2);
    expect(state.board[0][2]).toBe(0);
    expect(state.board[0][0]).toBe(1);
    expect(state.board[0][1]).toBe(2);
  });

  test('replays moves when setting the SGF index', () => {
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 }
    ];

    store.setMoveIndex(1);
    expect(state.board[0][0]).toBe(1);
    expect(state.board[0][1]).toBe(0);
    expect(state.turn).toBe(1);

    store.setMoveIndex(2);
    expect(state.board[0][1]).toBe(2);
    expect(state.turn).toBe(2);
  });

  test('maintains board consistency across long navigation sequences', () => {
    state.boardSize = 9;
    state.board = createBoard(9);

    const totalMoves = 60;
    state.sgfMoves = Array.from({ length: totalMoves }, (_, index) => ({
      col: index % state.boardSize,
      row: Math.floor(index / state.boardSize),
      color: (index % 2) + 1
    }));

    store.setMoveIndex(totalMoves);
    const finalSnapshot = state.board.map(row => row.slice());

    const mid = 25;
    store.setMoveIndex(mid);
    const midSnapshot = state.board.map(row => row.slice());

    store.setMoveIndex(totalMoves);
    expect(state.board).toEqual(finalSnapshot);

    store.setMoveIndex(mid);
    expect(state.board).toEqual(midSnapshot);

    store.setMoveIndex(0);
    const baseSnapshot = state.board.map(row => row.slice());

    store.setMoveIndex(totalMoves);
    expect(state.board).toEqual(finalSnapshot);

    store.setMoveIndex(0);
    expect(state.board).toEqual(baseSnapshot);
  });

  test('initializes handicap stones and updates starting color', () => {
    state.boardSize = 9;
    state.board = createBoard(9);

    store.setHandicap(4);

    expect(state.handicapStones).toBe(4);
    expect(state.startColor).toBe(2);
    expect(state.board[2][2]).toBe(1);
    expect(state.board[6][6]).toBe(1);
  });

  test('enters solve mode with a clean solution timeline (PR69)', () => {
    store.tryMove({ col: 0, row: 0 }, 1);
    store.tryMove({ col: 1, row: 1 }, 2);

    state.playMode = 'white';
    state.answerMode = 'white';

    store.enterSolveMode();

    expect(state.appMode).toBe('solve');
    expect(state.playMode).toBe('alt');
    expect(state.numberMode).toBe(true);
    expect(state.startColor).toBe(2);
    expect(state.solutionMoveList).toHaveLength(0);
    expect(state.sgfMoves).toHaveLength(0);
    expect(state.board[0][0]).toBe(1);
    expect(state.board[1][1]).toBe(2);

    const nextColor = store.currentColor;
    const success = store.tryMove({ col: 2, row: 2 }, nextColor);

    expect(success).toBe(true);
    expect(state.solutionMoveList).toEqual([
      { col: 2, row: 2, color: nextColor }
    ]);
    expect(state.sgfMoves).toEqual([
      { col: 2, row: 2, color: nextColor }
    ]);
  });

  test('review mode keeps branches separate and slider clears them (PR69)', () => {
    state.originalMoveList = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 }
    ];
    store.enterReviewMode();

    expect(state.appMode).toBe('review');
    expect(store.reviewActive).toBe(false);

    const firstColor = store.reviewTurn;
    expect(store.tryMove({ col: 2, row: 0 }, firstColor)).toBe(true);
    expect(store.reviewActive).toBe(true);
    expect(store.reviewTurn).toBe(firstColor === 1 ? 2 : 1);

    const secondColor = store.reviewTurn;
    expect(store.tryMove({ col: 3, row: 0 }, secondColor)).toBe(true);
    expect(store.reviewActive).toBe(true);

    store.setMoveIndex(1);

    expect(store.reviewActive).toBe(false);
    expect(state.sgfIndex).toBe(1);
    expect(state.sgfMoves).toEqual([
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 }
    ]);
  });
});
