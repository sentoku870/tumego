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

describe('GameStore problem diagram', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('setProblemDiagram', () => {
    test('captures black and white positions', () => {
      state.board[0][0] = 1;
      state.board[1][1] = 1;
      state.board[2][2] = 2;
      state.board[3][3] = 2;
      store.setProblemDiagram();
      expect(state.problemDiagramBlack).toEqual([
        { col: 0, row: 0 },
        { col: 1, row: 1 }
      ]);
      expect(state.problemDiagramWhite).toEqual([
        { col: 2, row: 2 },
        { col: 3, row: 3 }
      ]);
    });

    test('positions are deep copies (immutable)', () => {
      state.board[0][0] = 1;
      store.setProblemDiagram();
      state.board[0][0] = 0;
      expect(state.problemDiagramBlack).toEqual([{ col: 0, row: 0 }]);
    });

    test('sets problemDiagramSet to true', () => {
      expect(state.problemDiagramSet).toBe(false);
      store.setProblemDiagram();
      expect(state.problemDiagramSet).toBe(true);
    });

    test('clears handicap', () => {
      state.handicapStones = 3;
      state.handicapPositions = [{ col: 0, row: 0 }];
      store.setProblemDiagram();
      expect(state.handicapStones).toBe(0);
      expect(state.handicapPositions).toEqual([]);
    });

    test('clears sgf moves and metadata', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      state.sgfLoadedFromExternal = true;
      state.numberMode = true;
      state.numberStartIndex = 3;
      store.setProblemDiagram();
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
      expect(state.sgfLoadedFromExternal).toBe(false);
      expect(state.numberMode).toBe(false);
      expect(state.numberStartIndex).toBe(0);
    });

    test('saves history with "問題図確定" label', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      store.setProblemDiagram();
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0].label).toBe('問題図確定');
    });

    test('handles empty board', () => {
      store.setProblemDiagram();
      expect(state.problemDiagramSet).toBe(true);
      expect(state.problemDiagramBlack).toEqual([]);
      expect(state.problemDiagramWhite).toEqual([]);
    });

    test('clears gameTree', () => {
      state.gameTree = { root: { children: [] } };
      store.setProblemDiagram();
      expect(state.gameTree).toBe(null);
    });

    test('resets turn and history', () => {
      state.turn = 10;
      state.history = [createBoard(9)];
      store.setProblemDiagram();
      expect(state.turn).toBe(0);
      expect(state.history).toEqual([]);
    });
  });

  describe('restoreProblemDiagram', () => {
    test('does nothing if problem diagram not set', () => {
      state.problemDiagramSet = false;
      state.board[0][0] = 5;
      store.restoreProblemDiagram();
      expect(state.board[0][0]).toBe(5);
    });

    test('restores board from problem diagram', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [
        { col: 0, row: 0 },
        { col: 1, row: 1 }
      ];
      state.problemDiagramWhite = [{ col: 2, row: 2 }];
      // Add some moves that should be cleared
      state.sgfMoves = [{ col: 5, row: 5, color: 1 }];
      state.sgfIndex = 1;
      store.restoreProblemDiagram();
      expect(state.sgfIndex).toBe(0);
    });

    test('resets sgfIndex to 0', () => {
      state.problemDiagramSet = true;
      state.sgfIndex = 5;
      store.restoreProblemDiagram();
      expect(state.sgfIndex).toBe(0);
    });

    test('resets turn to 0 in number mode', () => {
      state.problemDiagramSet = true;
      state.numberMode = true;
      state.turn = 10;
      store.restoreProblemDiagram();
      expect(state.turn).toBe(0);
    });

    test('preserves turn in non-number mode', () => {
      state.problemDiagramSet = true;
      state.numberMode = false;
      store.restoreProblemDiagram();
      // sgfIndex 0 -> turn 0
      expect(state.turn).toBe(0);
    });
  });

  describe('hasProblemDiagram', () => {
    test('returns false initially', () => {
      expect(store.hasProblemDiagram()).toBe(false);
    });

    test('returns true after setProblemDiagram', () => {
      store.setProblemDiagram();
      expect(store.hasProblemDiagram()).toBe(true);
    });

    test('returns false after problemDiagramSet is false', () => {
      store.setProblemDiagram();
      state.problemDiagramSet = false;
      expect(store.hasProblemDiagram()).toBe(false);
    });
  });
});
