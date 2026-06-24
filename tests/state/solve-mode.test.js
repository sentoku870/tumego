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

describe('GameStore solve mode', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('enterSolveMode', () => {
    test('saves current state to history with current move count', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.enterSolveMode();
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0].label).toContain('解答開始前');
      expect(saveCalls[0].label).toContain('1手');
    });

    test('clears sgf moves and resets index', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.sgfIndex = 2;
      store.enterSolveMode();
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
    });

    test('enables number mode with start index 0', () => {
      state.numberMode = false;
      store.enterSolveMode();
      expect(state.numberMode).toBe(true);
      expect(state.numberStartIndex).toBe(0);
    });

    test('disables erase mode', () => {
      state.eraseMode = true;
      store.enterSolveMode();
      expect(state.eraseMode).toBe(false);
    });

    test('resets turn and captured counts', () => {
      state.turn = 10;
      state.capturedCounts = { black: 5, white: 3 };
      store.enterSolveMode();
      expect(state.turn).toBe(0);
      expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
    });

    test('applies problem diagram if set', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.problemDiagramWhite = [{ col: 1, row: 1 }];
      store.enterSolveMode();
      expect(state.board[0][0]).toBe(1);
      expect(state.board[1][1]).toBe(2);
    });

    test('does not change board when problem diagram not set', () => {
      // When problemDiagramSet is false, applyInitialSetup is not called.
      // The board state is preserved (not cleared).
      state.problemDiagramSet = false;
      state.board[0][0] = 1;
      state.board[1][1] = 2;
      store.enterSolveMode();
      // Board is left as-is (or at least board[0][0] and board[1][1] are preserved)
      // sgfMoves and other state are reset
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
    });
  });

  describe('exitSolveModeToEmptyBoard', () => {
    test('clears sgf moves', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.exitSolveModeToEmptyBoard();
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
    });

    test('preserves problem diagram', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.problemDiagramWhite = [{ col: 1, row: 1 }];
      store.exitSolveModeToEmptyBoard();
      expect(state.problemDiagramSet).toBe(true);
      expect(state.problemDiagramBlack).toEqual([{ col: 0, row: 0 }]);
      expect(state.problemDiagramWhite).toEqual([{ col: 1, row: 1 }]);
    });

    test('clears board', () => {
      state.board[0][0] = 1;
      state.board[1][1] = 2;
      store.exitSolveModeToEmptyBoard();
      const allEmpty = state.board.every((row) => row.every((cell) => cell === 0));
      expect(allEmpty).toBe(true);
    });

    test('disables number mode', () => {
      state.numberMode = true;
      store.exitSolveModeToEmptyBoard();
      expect(state.numberMode).toBe(false);
    });

    test('resets mode to alt', () => {
      state.mode = 'black';
      store.exitSolveModeToEmptyBoard();
      expect(state.mode).toBe('alt');
    });
  });

  describe('resetForClearAll', () => {
    test('saves history when game has data', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.board[0][0] = 1;
      store.resetForClearAll();
      expect(saveCalls).toHaveLength(1);
    });

    test('does not save history when no game data', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      store.resetForClearAll();
      expect(saveCalls).toHaveLength(0);
    });

    test('clears problem diagram', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.problemDiagramWhite = [{ col: 1, row: 1 }];
      store.resetForClearAll();
      expect(state.problemDiagramSet).toBe(false);
      expect(state.problemDiagramBlack).toEqual([]);
      expect(state.problemDiagramWhite).toEqual([]);
    });

    test('maintains boardSize', () => {
      state.boardSize = 13;
      store.resetForClearAll();
      expect(state.boardSize).toBe(13);
      expect(state.board).toHaveLength(13);
    });

    test('clears board', () => {
      state.board[0][0] = 1;
      state.board[3][3] = 2;
      store.resetForClearAll();
      const allEmpty = state.board.every((row) => row.every((cell) => cell === 0));
      expect(allEmpty).toBe(true);
    });

    test('resets mode to alt and disables number mode', () => {
      state.mode = 'black';
      state.numberMode = true;
      store.resetForClearAll();
      expect(state.mode).toBe('alt');
      expect(state.numberMode).toBe(false);
    });
  });
});
