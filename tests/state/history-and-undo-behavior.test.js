import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

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
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 }
});

describe('History snapshots and undo behavior', () => {
  let engine;
  let state;
  let history;
  let store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  test('undo walks back through the snapshot stack', () => {
    state.board[0][0] = 1;
    history.save('first', state);

    state.board[0][1] = 2;
    history.save('second', state);

    state.board[0][2] = 1;

    expect(store.undo()).toBe(true);
    expect(state.board[0][2]).toBe(0);
    expect(state.board[0][1]).toBe(2);

    expect(store.undo()).toBe(true);
    expect(state.board[0][1]).toBe(0);
    expect(state.board[0][0]).toBe(1);

    expect(store.undo()).toBe(false);
  });

  test('history dialog restore trims newer snapshots from the shared stack', () => {
    state.board[0][0] = 1;
    history.save('first', state);

    state.board[0][1] = 2;
    history.save('second', state);

    state.board[1][1] = 1;
    history.save('third', state);

    expect(history.getList()).toHaveLength(3);

    state.board[2][2] = 2;

    expect(store.restoreHistorySnapshot(1)).toBe(true);
    expect(history.getList().length < 3).toBe(true);
  });

  test('solve mode undo walks back moves one at a time without leaving solve mode', () => {
    state.board[0][0] = 1;
    store.setProblemDiagram();

    store.enterSolveMode();

    const moves = [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 2, row: 3 }
    ];

    moves.forEach((pos) => {
      expect(store.tryMove(pos, store.currentColor)).toBe(true);
    });

    expect(state.numberMode).toBe(true);
    expect(state.sgfMoves).toHaveLength(5);
    expect(state.turn).toBe(5);

    for (let i = moves.length - 1; i >= 0; i--) {
      expect(store.undo()).toBe(true);
      expect(state.numberMode).toBe(true);
      expect(state.sgfMoves).toHaveLength(i);
      expect(state.sgfIndex).toBe(i);
      expect(state.board[moves[i].row][moves[i].col]).toBe(0);
    }

    expect(state.board[0][0]).toBe(1);
    expect(state.turn).toBe(0);
    expect(store.undo()).toBe(false);
  });

  test('step-back followed by a new move overwrites the move tail', () => {
    store.tryMove({ col: 0, row: 0 }, 1);
    store.tryMove({ col: 1, row: 0 }, 2);
    store.tryMove({ col: 2, row: 0 }, 1);

    store.setMoveIndex(1);
    store.tryMove({ col: 1, row: 1 }, 2);

    expect(state.sgfMoves).toEqual([
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ]);
    expect(state.sgfIndex).toBe(2);
    expect(state.board[0][2]).toBe(0);
    expect(state.board[1][1]).toBe(2);

    expect(store.undo()).toBe(false);
    expect(state.sgfIndex).toBe(2);
  });
});
