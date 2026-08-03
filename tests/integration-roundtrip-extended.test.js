import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { SGFIO } from '../dist/services/sgf-io.js';
import { SGFShare } from '../dist/services/sgf-share.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => {
  const size = overrides.boardSize ?? DEFAULT_CONFIG.DEFAULT_BOARD_SIZE;
  const board = overrides.board ?? createBoard(size);

  const state = {
    boardSize: size,
    board,
    mode: overrides.mode ?? 'alt',
    eraseMode: overrides.eraseMode ?? false,
    history: overrides.history ?? [],
    turn: overrides.turn ?? 0,
    sgfMoves: overrides.sgfMoves ?? [],
    numberMode: overrides.numberMode ?? false,
    startColor: overrides.startColor ?? 1,
    sgfIndex: overrides.sgfIndex ?? 0,
    numberStartIndex: overrides.numberStartIndex ?? 0,
    komi: overrides.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
    handicapStones: overrides.handicapStones ?? 0,
    handicapPositions: overrides.handicapPositions ?? [],
    answerMode: overrides.answerMode ?? 'black',
    problemDiagramSet: overrides.problemDiagramSet ?? false,
    problemDiagramBlack: overrides.problemDiagramBlack ?? [],
    problemDiagramWhite: overrides.problemDiagramWhite ?? [],
    gameTree: overrides.gameTree ?? null,
    sgfLoadedFromExternal: overrides.sgfLoadedFromExternal ?? true,
    gameInfo: overrides.gameInfo ?? {
      title: overrides.title ?? '',
      boardSize: size,
      komi: overrides.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      handicap: overrides.handicap ?? null,
      handicapStones: overrides.handicapStones ?? 0,
      handicapPositions: overrides.handicapPositions ?? [],
      startColor: overrides.startColor ?? 1,
      problemDiagramSet: overrides.problemDiagramSet ?? false,
      problemDiagramBlack: overrides.problemDiagramBlack ?? [],
      problemDiagramWhite: overrides.problemDiagramWhite ?? [],
      playerBlack: overrides.playerBlack ?? null,
      playerWhite: overrides.playerWhite ?? null,
      result: overrides.result ?? null
    }
  };

  return state;
};

const cloneState = (state) => JSON.parse(JSON.stringify(state));

describe('Extended Integration: SGF roundtrip coverage', () => {
  test('roundtrips problem diagram properties through SGF', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = createState({
      boardSize: 9,
      board: createBoard(9),
      problemDiagramSet: true,
      problemDiagramBlack: [{ col: 3, row: 3 }],
      problemDiagramWhite: [{ col: 4, row: 4 }]
    });
    const store = new GameStore(state, engine, history);
    store.setMoveIndex(state.sgfIndex);
    const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    const baseline = cloneState(state);
    const sgfText = service.export();

    const parsed = parser.parse(sgfText);
    const restoredState = createState({ boardSize: 9, board: createBoard(9) });
    const restoredStore = new GameStore(restoredState, new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore, new SGFIO(parser), new SGFShare(parser));
    restoredService.apply(parsed);

    expect(restoredState).toEqual(baseline);
  });

  test('roundtrips sgfMoves, turn, and sgfIndex accurately', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const initialMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 },
      { col: 2, row: 2, color: 1 }
    ];

    const state = createState({
      boardSize: 9,
      board: createBoard(9),
      sgfMoves: initialMoves,
      sgfIndex: 1,
      turn: 1
    });
    const store = new GameStore(state, engine, history);
    store.setMoveIndex(state.sgfIndex);
    const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    const baseline = cloneState(state);
    const sgfText = service.export();

    const parsed = parser.parse(sgfText);
    const restoredState = createState({ boardSize: 9, board: createBoard(9) });
    const restoredStore = new GameStore(restoredState, new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore, new SGFIO(parser), new SGFShare(parser));
    restoredService.apply(parsed);

    expect(restoredState.sgfMoves).toEqual(baseline.sgfMoves);
    expect(restoredState.turn).toBe(baseline.turn);
    expect(restoredState.sgfIndex).toBe(baseline.sgfIndex);
    expect(restoredState.board).toEqual(baseline.board);
  });

  test('roundtrips state after multiple undos via HistoryManager', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = createState({ boardSize: 9, board: createBoard(9) });
    const store = new GameStore(state, engine, history);
    const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    history.save('initial', state);

    const moveSequence = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 2, row: 0, color: 1 },
      { col: 3, row: 0, color: 2 },
      { col: 4, row: 0, color: 1 }
    ];

    moveSequence.forEach(move => {
      store.tryMove({ col: move.col, row: move.row });
    });

    history.save('after 5 moves', state);

    for (let i = 0; i < 3; i++) {
      store.undo();
    }

    store.setMoveIndex(state.turn);
    const baseline = cloneState(state);
    const sgfText = service.export();

    const parsed = parser.parse(sgfText);
    const restoredState = createState({ boardSize: 9, board: createBoard(9) });
    const restoredStore = new GameStore(restoredState, new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore, new SGFIO(parser), new SGFShare(parser));
    restoredService.apply(parsed);
    restoredStore.setMoveIndex(baseline.sgfIndex);

    expect(restoredState).toEqual(baseline);
  });
});

describe('Integration: history snapshot restore after SGF and handicap', () => {
  const restoreCreateState = () => {
    const size = 9;
    const board = createBoard(size);
    board[0][0] = 1;
    board[1][1] = 2;
    const historyBoard = createBoard(size);
    historyBoard[2][2] = 1;
    return {
      boardSize: size,
      board,
      mode: 'white',
      eraseMode: false,
      history: [historyBoard],
      turn: 3,
      sgfMoves: [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ],
      numberMode: true,
      startColor: 2,
      sgfIndex: 2,
      numberStartIndex: 1,
      komi: 5.5,
      handicapStones: 2,
      handicapPositions: [
        { col: 2, row: 2 },
        { col: size - 3, row: size - 3 }
      ],
      answerMode: 'white',
      problemDiagramSet: true,
      problemDiagramBlack: [{ col: 3, row: 3 }],
      problemDiagramWhite: [{ col: 4, row: 4 }],
      gameTree: null,
      sgfLoadedFromExternal: true,
      gameInfo: {
        title: '',
        komi: 5.5,
        handicap: 2,
        playerBlack: null,
        playerWhite: null,
        result: null,
        boardSize: size,
        handicapStones: 2,
        handicapPositions: [
          { col: 2, row: 2 },
          { col: size - 3, row: size - 3 }
        ],
        startColor: 2,
        problemDiagramSet: true,
        problemDiagramBlack: [{ col: 3, row: 3 }],
        problemDiagramWhite: [{ col: 4, row: 4 }]
      }
    };
  };

  test('restores all state fields after applying SGF and handicap changes', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = restoreCreateState();
    const store = new GameStore(state, engine, history);
    const sgfService = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    const baselineDescription = 'baseline snapshot';
    const baselineState = cloneState(state);
    history.save(baselineDescription, state);

    const sgfText = '(;GM[1]FF[4]SZ[9]KM[6.5];B[aa];W[bb])';
    const parsed = parser.parse(sgfText);

    sgfService.apply(parsed);
    store.setHandicap(4);

    expect(state.handicapStones).toBe(4);
    expect(state.komi).toBe(0);

    const baselineEntry = history.getList().find(item => item.label === baselineDescription);
    expect(baselineEntry !== undefined).toBe(true);

    const restored = history.restore(baselineEntry.index, state);
    expect(restored).toBe(true);
    expect(state.boardSize).toBe(baselineState.boardSize);
    expect(state.board).toEqual(baselineState.board);
    expect(state.turn).toBe(baselineState.turn);
    expect(state.numberMode).toBe(baselineState.numberMode);
    expect(state.answerMode).toBe(baselineState.answerMode);
    expect(state.problemDiagramSet).toBe(baselineState.problemDiagramSet);
    expect(state.problemDiagramBlack).toEqual(baselineState.problemDiagramBlack);
    expect(state.problemDiagramWhite).toEqual(baselineState.problemDiagramWhite);
    expect(state.handicapStones).toBe(baselineState.handicapStones);
    expect(state.handicapPositions).toEqual(baselineState.handicapPositions);
    expect(state.startColor).toBe(baselineState.startColor);
    expect(state.komi).toBe(baselineState.komi);
  });

  test('keeps SGF header metadata through round trip', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = restoreCreateState();
    const store = new GameStore(state, engine, history);
    const sgfService = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    const sgfText = '(;GM[1]SZ[19]KM[6.5]PB[Black]PW[White]HA[4]RE[B+R];B[dd];W[pq])';
    const parsed = parser.parse(sgfText);

    sgfService.apply(parsed);
    const exported = sgfService.export();

    expect(exported.includes('PB[Black]')).toBe(true);
    expect(exported.includes('PW[White]')).toBe(true);
    expect(exported.includes('KM[6.5]')).toBe(true);
    expect(exported.includes('HA[4]')).toBe(true);
    expect(exported.includes('RE[B+R]')).toBe(true);
  });
});

describe('Integration: SGF header editing via GameStore', () => {
  const headerCreateState = () => {
    const size = DEFAULT_CONFIG.DEFAULT_BOARD_SIZE;
    return {
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
      gameInfo: {
        title: '',
        boardSize: size,
        komi: DEFAULT_CONFIG.DEFAULT_KOMI,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: [],
        playerBlack: null,
        playerWhite: null,
        result: null
      },
      capturedCounts: { black: 0, white: 0 }
    };
  };

  test('roundtrips header metadata after manual edits', () => {
    const parser = new SGFParser();
    const store = new GameStore(headerCreateState(), new GoEngine(), new HistoryManager());
    const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));

    store.updateGameInfo({
      title: 'Title Sample',
      playerBlack: 'Tester B',
      playerWhite: 'Tester W',
      komi: 7.5,
      result: 'B+R'
    });

    const sgf = service.export();
    expect(sgf).toContain('PB[Tester B]');
    expect(sgf).toContain('PW[Tester W]');
    expect(sgf).toContain('KM[7.5]');
    expect(sgf).toContain('RE[B+R]');
    expect(sgf).toContain('GN[Title Sample]');

    const parsed = parser.parse(sgf);
    const restoredStore = new GameStore(headerCreateState(), new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore, new SGFIO(parser), new SGFShare(parser));
    restoredService.apply(parsed);

    const info = restoredStore.getGameInfo();
    expect(info.playerBlack).toBe('Tester B');
    expect(info.playerWhite).toBe('Tester W');
    expect(info.komi).toBe(7.5);
    expect(restoredStore.snapshot.komi).toBe(7.5);
    expect(info.result).toBe('B+R');
    expect(info.title).toBe('Title Sample');
  });
});
