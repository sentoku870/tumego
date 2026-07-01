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

describe('GameStore initialization', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('initBoard', () => {
    test('changes board size from 9 to 13', () => {
      store.initBoard(13);
      expect(state.boardSize).toBe(13);
      expect(state.board).toHaveLength(13);
      expect(state.board[0]).toHaveLength(13);
    });

    test('changes board size from 13 to 19', () => {
      state.boardSize = 13;
      store.initBoard(19);
      expect(state.boardSize).toBe(19);
      expect(state.board).toHaveLength(19);
    });

    test('saves history when game has data', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.board[0][0] = 1;
      store.initBoard(13);
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0].label).toContain('変更前');
    });

    test('does not save history when board is empty', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      store.initBoard(13);
      expect(saveCalls).toHaveLength(0);
    });

    test('does not save history when skipHistory is true', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.board[0][0] = 1;
      store.initBoard(13, { skipHistory: true });
      expect(saveCalls).toHaveLength(0);
    });

    test('clears board', () => {
      state.board[0][0] = 1;
      state.board[1][1] = 2;
      store.initBoard(9);
      const allEmpty = state.board.every((row) => row.every((cell) => cell === 0));
      expect(allEmpty).toBe(true);
    });

    test('resets sgfMoves and turn', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      state.turn = 5;
      store.initBoard(9);
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
      expect(state.turn).toBe(0);
    });

    test('resets to alt mode', () => {
      state.numberMode = true;
      state.mode = 'black';
      store.initBoard(9);
      expect(state.mode).toBe('alt');
      expect(state.numberMode).toBe(false);
    });

    test('clears problem diagram (no preserve)', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      store.initBoard(9);
      expect(state.problemDiagramSet).toBe(false);
      expect(state.problemDiagramBlack).toEqual([]);
    });
  });
});
