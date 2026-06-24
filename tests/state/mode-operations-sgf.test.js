import { ModeOperations } from '../../dist/state/mode-operations.js';
import { BoardCacheManager } from '../../dist/state/board-cache-manager.js';
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

const silentHistory = () => ({
  save: () => {},
  restore: () => false,
  restoreLast: () => false,
  getList: () => [],
  clear: () => {},
  showHistoryDialog: () => {},
});

describe('ModeOperations SGF-related methods', () => {
  let engine, state, history, cache, modeOps, store;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState();
    history = new HistoryManager();
    cache = new BoardCacheManager(state, engine);
    modeOps = new ModeOperations(state, history, cache);
    store = new GameStore(state, engine, history);
  });

  describe('resetForSgfLoad', () => {
    test('saves history snapshot before reset', () => {
      let called = 0;
      let lastArgs = null;
      const original = history.save.bind(history);
      history.save = (label, st) => { called++; lastArgs = { label, st }; };
      modeOps.resetForSgfLoad(5);
      expect(called).toBe(1);
      expect(lastArgs.label).toBe('SGF読み込み前（5手）');
      expect(lastArgs.st).toBe(state);
      history.save = original;
    });

    test('clears moves, index, and numberMode flags', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      state.numberMode = true;
      state.handicapStones = 4;
      state.problemDiagramSet = true;

      modeOps.resetForSgfLoad(1);

      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
      expect(state.numberMode).toBe(false);
      expect(state.handicapStones).toBe(0);
      expect(state.problemDiagramSet).toBe(false);
      expect(state.sgfLoadedFromExternal).toBe(true);
    });

    test('resets komi to default', () => {
      state.komi = 0;
      modeOps.resetForSgfLoad(0);
      expect(state.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
    });
  });

  describe('applySgfMeta', () => {
    test('updates startColor and handicapStones', () => {
      modeOps.applySgfMeta({
        title: '',
        komi: 6.5,
        handicap: null,
        handicapStones: 4,
        handicapPositions: [],
        startColor: 2,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: [],
        playerBlack: null,
        playerWhite: null,
        result: null,
      });
      expect(state.startColor).toBe(2);
      expect(state.handicapStones).toBe(4);
    });

    test('copies problem diagram positions', () => {
      const blackPos = { col: 3, row: 3 };
      const whitePos = { col: 5, row: 5 };
      modeOps.applySgfMeta({
        title: '',
        komi: 6.5,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        startColor: 1,
        problemDiagramSet: true,
        problemDiagramBlack: [blackPos],
        problemDiagramWhite: [whitePos],
        playerBlack: null,
        playerWhite: null,
        result: null,
      });
      expect(state.problemDiagramBlack).toEqual([blackPos]);
      expect(state.problemDiagramWhite).toEqual([whitePos]);
      expect(state.problemDiagramSet).toBe(true);
    });
  });

  describe('setSgfMoves', () => {
    test('clones moves into state.sgfMoves', () => {
      const moves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
      ];
      modeOps.setSgfMoves(moves);
      expect(state.sgfMoves).toEqual(moves);
      expect(state.sgfMoves).not.toBe(moves);
      expect(state.sgfIndex).toBe(0);
    });
  });

  describe('GameStore wrappers', () => {
    test('store.resetForSgfLoad delegates to modeOps', () => {
      let called = 0;
      let lastArg = null;
      const target = store.modeOps;
      const original = target.resetForSgfLoad.bind(target);
      target.resetForSgfLoad = (n) => { called++; lastArg = n; return original(n); };
      store.resetForSgfLoad(3);
      expect(called).toBe(1);
      expect(lastArg).toBe(3);
      target.resetForSgfLoad = original;
    });

    test('store.applySgfMeta delegates to modeOps', () => {
      let called = 0;
      let lastArg = null;
      const target = store.modeOps;
      const original = target.applySgfMeta.bind(target);
      target.applySgfMeta = (info) => { called++; lastArg = info; return original(info); };
      const info = {
        title: 't',
        komi: 6.5,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: [],
        playerBlack: null,
        playerWhite: null,
        result: null,
      };
      store.applySgfMeta(info);
      expect(called).toBe(1);
      expect(lastArg).toBe(info);
      target.applySgfMeta = original;
    });

    test('store.setSgfMoves delegates to modeOps', () => {
      let called = 0;
      let lastArg = null;
      const target = store.modeOps;
      const original = target.setSgfMoves.bind(target);
      target.setSgfMoves = (m) => { called++; lastArg = m; return original(m); };
      const moves = [{ col: 0, row: 0, color: 1 }];
      store.setSgfMoves(moves);
      expect(called).toBe(1);
      expect(lastArg).toBe(moves);
      target.setSgfMoves = original;
    });
  });
});
