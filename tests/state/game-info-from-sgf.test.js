import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => ({
  boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
  board: createBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE),
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
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  rootMarkers: [],
  nodeMarkers: [],
  gameInfo: {
    title: '',
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    handicap: null,
    playerBlack: null,
    playerWhite: null,
    result: null
  },
  ...overrides
});

describe('GameStore.updateGameInfoFromSgf()', () => {
  let engine, history, state, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  test('updates gameInfo.handicap from SGF', () => {
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: 4,
      handicapStones: 4,
      handicapPositions: [
        { col: 2, row: 2 },
        { col: 6, row: 6 },
        { col: 2, row: 6 },
        { col: 6, row: 2 }
      ]
    });
    expect(state.gameInfo.handicap).toBe(4);
    expect(state.gameInfo.handicapStones).toBe(4);
  });

  test('updates gameInfo.boardSize from SGF', () => {
    store.updateGameInfoFromSgf({
      boardSize: 13,
      handicap: null,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.boardSize).toBe(13);
  });

  test('updates gameInfo.handicapPositions from SGF', () => {
    const positions = [
      { col: 3, row: 3 },
      { col: 9, row: 9 }
    ];
    store.updateGameInfoFromSgf({
      boardSize: 13,
      handicap: 2,
      handicapStones: 2,
      handicapPositions: positions
    });
    expect(state.gameInfo.handicapPositions).toEqual(positions);
  });

  test('keeps existing handicap when SGF handicap is undefined', () => {
    state.gameInfo.handicap = 5;
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: undefined,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.handicap).toBe(5);
  });

  test('keeps existing handicapPositions when SGF provides none', () => {
    state.handicapPositions = [{ col: 1, row: 1 }];
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: null,
      handicapStones: 0,
      handicapPositions: undefined
    });
    expect(state.gameInfo.handicapPositions).toEqual([{ col: 1, row: 1 }]);
  });

  test('preserves startColor from state (not overwritten by SGF)', () => {
    state.startColor = 2;
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: null,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.startColor).toBe(2);
  });

  test('preserves problemDiagramSet from state', () => {
    state.problemDiagramSet = true;
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: null,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.problemDiagramSet).toBe(true);
  });

  test('preserves problemDiagramBlack from state', () => {
    state.problemDiagramBlack = [{ col: 3, row: 3 }];
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: null,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.problemDiagramBlack).toEqual([{ col: 3, row: 3 }]);
  });

  test('sets handicap to null when not provided', () => {
    store.updateGameInfoFromSgf({
      boardSize: 9,
      handicap: null,
      handicapStones: 0,
      handicapPositions: []
    });
    expect(state.gameInfo.handicap).toBe(null);
  });
});
