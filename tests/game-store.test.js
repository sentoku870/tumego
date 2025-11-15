import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = 5) => ({
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
  hasExternalSGF: false
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
    expect(state.sgfMoves).toEqual([{ col: 1, row: 1, color: 1 }]);
    expect(state.history.length).toBe(1);
  });

  test('removes only the targeted stone in free edit mode', () => {
    store.tryMove({ col: 1, row: 1 }, 1);
    const removed = store.removeStone({ col: 1, row: 1 });

    expect(removed).toBe(true);
    expect(state.board[1][1]).toBe(0);
    expect(state.sgfMoves).toEqual([{ col: 1, row: 1, color: 1 }]);
    expect(state.sgfIndex).toBe(1);
  });

  test('truncates SGF moves when editing a loaded record', () => {
    state.hasExternalSGF = true;
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

  test('initializes handicap stones and updates starting color', () => {
    state.boardSize = 9;
    state.board = createBoard(9);

    store.setHandicap(4);

    expect(state.handicapStones).toBe(4);
    expect(state.startColor).toBe(2);
    expect(state.board[2][2]).toBe(1);
    expect(state.board[6][6]).toBe(1);
  });
});
