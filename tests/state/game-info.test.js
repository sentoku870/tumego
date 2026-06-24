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

describe('GameStore game info', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('getGameInfo', () => {
    test('returns default values when gameInfo is null', () => {
      state.gameInfo = null;
      const info = store.getGameInfo();
      expect(info.title).toBe('');
      expect(info.playerBlack).toBe(null);
      expect(info.playerWhite).toBe(null);
      expect(info.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
      expect(info.result).toBe(null);
    });

    test('returns existing gameInfo values', () => {
      state.gameInfo = {
        title: 'Test Game',
        playerBlack: 'Alice',
        playerWhite: 'Bob',
        komi: 6.5,
        result: 'B+3',
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      const info = store.getGameInfo();
      expect(info.title).toBe('Test Game');
      expect(info.playerBlack).toBe('Alice');
      expect(info.playerWhite).toBe('Bob');
      expect(info.komi).toBe(6.5);
      expect(info.result).toBe('B+3');
    });

    test('falls back to state.komi if gameInfo.komi is null', () => {
      state.komi = 7.5;
      state.gameInfo = {
        title: '',
        playerBlack: null,
        playerWhite: null,
        komi: null,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      const info = store.getGameInfo();
      expect(info.komi).toBe(7.5);
    });

    test('falls back to DEFAULT_KOMI if both are null', () => {
      state.komi = null;
      state.gameInfo = null;
      const info = store.getGameInfo();
      expect(info.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
    });

    test('null player fields are converted to null', () => {
      state.gameInfo = {
        title: 'Game',
        playerBlack: undefined,
        playerWhite: undefined,
        komi: 6.5,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      const info = store.getGameInfo();
      expect(info.playerBlack).toBe(null);
      expect(info.playerWhite).toBe(null);
    });
  });

  describe('updateGameInfo', () => {
    test('updates title', () => {
      store.updateGameInfo({ title: 'New Title' });
      expect(state.gameInfo.title).toBe('New Title');
    });

    test('updates player names', () => {
      store.updateGameInfo({ playerBlack: 'Alice', playerWhite: 'Bob' });
      expect(state.gameInfo.playerBlack).toBe('Alice');
      expect(state.gameInfo.playerWhite).toBe('Bob');
    });

    test('updates result', () => {
      store.updateGameInfo({ result: 'W+5' });
      expect(state.gameInfo.result).toBe('W+5');
    });

    test('updates komi and syncs to state.komi', () => {
      store.updateGameInfo({ komi: 7.5 });
      expect(state.komi).toBe(7.5);
      expect(state.gameInfo.komi).toBe(7.5);
    });

    test('rejects invalid komi (string)', () => {
      state.komi = 6.5;
      store.updateGameInfo({ komi: 'invalid' });
      // state.komi should remain unchanged
      expect(state.komi).toBe(6.5);
    });

    test('rejects invalid komi (NaN)', () => {
      state.komi = 6.5;
      store.updateGameInfo({ komi: NaN });
      expect(state.komi).toBe(6.5);
    });

    test('preserves existing values for unspecified fields', () => {
      state.gameInfo = {
        title: 'Original',
        playerBlack: 'Alice',
        playerWhite: 'Bob',
        komi: 6.5,
        result: 'B+3',
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      store.updateGameInfo({ title: 'New Title' });
      expect(state.gameInfo.title).toBe('New Title');
      expect(state.gameInfo.playerBlack).toBe('Alice');
      expect(state.gameInfo.playerWhite).toBe('Bob');
      expect(state.gameInfo.result).toBe('B+3');
      expect(state.gameInfo.komi).toBe(6.5);
    });

    test('updates multiple fields at once', () => {
      store.updateGameInfo({
        title: 'New',
        playerBlack: 'A',
        komi: 5.5
      });
      expect(state.gameInfo.title).toBe('New');
      expect(state.gameInfo.playerBlack).toBe('A');
      expect(state.komi).toBe(5.5);
    });
  });

  describe('initial gameInfo setup', () => {
    test('initializes gameInfo with default values when missing', () => {
      // state is created without gameInfo in createState
      const freshState = {
        boardSize: 9,
        board: createBoard(9),
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
      };
      delete freshState.gameInfo;
      const freshStore = new GameStore(freshState, engine, history);
      const isDefined = freshState.gameInfo !== undefined;
      expect(isDefined).toBe(true);
      expect(freshState.gameInfo.title).toBe('');
    });
  });
});
