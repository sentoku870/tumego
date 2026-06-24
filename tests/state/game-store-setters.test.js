import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createEmptyBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => ({
  boardSize: 9,
  board: createEmptyBoard(9),
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
  capturedCounts: { black: 0, white: 0 },
  ...overrides,
});

describe('GameStore simple setters', () => {
  let store;
  let state;

  beforeEach(() => {
    state = createState();
    store = new GameStore(state, new GoEngine(), new HistoryManager());
  });

  describe('setMode', () => {
    test('updates state.mode', () => {
      store.setMode('black');
      expect(state.mode).toBe('black');
      store.setMode('white');
      expect(state.mode).toBe('white');
    });
  });

  describe('setEraseMode', () => {
    test('updates state.eraseMode', () => {
      store.setEraseMode(true);
      expect(state.eraseMode).toBe(true);
      store.setEraseMode(false);
      expect(state.eraseMode).toBe(false);
    });
  });

  describe('setStartColor', () => {
    test('updates state.startColor', () => {
      store.setStartColor(2);
      expect(state.startColor).toBe(2);
    });
  });

  describe('setAnswerMode', () => {
    test('updates state.answerMode', () => {
      store.setAnswerMode('white');
      expect(state.answerMode).toBe('white');
    });
  });

  describe('resetInteractionModes', () => {
    test('resets mode, numberMode, and eraseMode to defaults', () => {
      state.mode = 'white';
      state.numberMode = true;
      state.eraseMode = true;

      store.resetInteractionModes();

      expect(state.mode).toBe('alt');
      expect(state.numberMode).toBe(false);
      expect(state.eraseMode).toBe(false);
    });

    test('does not affect unrelated state', () => {
      state.startColor = 2;
      state.komi = 0;

      store.resetInteractionModes();

      expect(state.startColor).toBe(2);
      expect(state.komi).toBe(0);
    });
  });
});
