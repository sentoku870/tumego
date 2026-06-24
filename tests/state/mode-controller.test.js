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

describe('GameStore mode controller', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('currentColor in alt mode', () => {
    test('returns startColor (black) when turn is even', () => {
      state.startColor = 1;
      state.turn = 0;
      expect(store.currentColor).toBe(1);
      state.turn = 2;
      expect(store.currentColor).toBe(1);
    });

    test('returns opposite color (white) when turn is odd', () => {
      state.startColor = 1;
      state.turn = 1;
      expect(store.currentColor).toBe(2);
      state.turn = 3;
      expect(store.currentColor).toBe(2);
    });

    test('respects startColor = 2 (white first)', () => {
      state.startColor = 2;
      state.turn = 0;
      expect(store.currentColor).toBe(2);
      state.turn = 1;
      expect(store.currentColor).toBe(1);
    });
  });

  describe('currentColor in number mode', () => {
    test('returns startColor when turn is even', () => {
      state.numberMode = true;
      state.startColor = 1;
      state.turn = 0;
      expect(store.currentColor).toBe(1);
    });

    test('returns opposite color when turn is odd', () => {
      state.numberMode = true;
      state.startColor = 1;
      state.turn = 1;
      expect(store.currentColor).toBe(2);
    });

    test('respects startColor = 2 in number mode', () => {
      state.numberMode = true;
      state.startColor = 2;
      state.turn = 0;
      expect(store.currentColor).toBe(2);
    });
  });

  describe('currentColor in fixed mode (black/white)', () => {
    test('returns black when mode is black', () => {
      state.mode = 'black';
      expect(store.currentColor).toBe(1);
    });

    test('returns white when mode is white', () => {
      state.mode = 'white';
      expect(store.currentColor).toBe(2);
    });

    test('does not depend on turn in fixed mode', () => {
      state.mode = 'black';
      state.turn = 5;
      expect(store.currentColor).toBe(1);
      state.mode = 'white';
      state.turn = 7;
      expect(store.currentColor).toBe(2);
    });
  });
});
