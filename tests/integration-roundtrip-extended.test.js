import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
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
    const service = new SGFService(parser, store);

    const baseline = cloneState(state);
    const sgfText = service.export();

    const parsed = parser.parse(sgfText);
    const restoredState = createState({ boardSize: 9, board: createBoard(9) });
    const restoredStore = new GameStore(restoredState, new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore);
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
    const service = new SGFService(parser, store);

    const baseline = cloneState(state);
    const sgfText = service.export();

    const parsed = parser.parse(sgfText);
    const restoredState = createState({ boardSize: 9, board: createBoard(9) });
    const restoredStore = new GameStore(restoredState, new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore);
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
    const service = new SGFService(parser, store);

    history.save('initial', state);

    const moveSequence = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 2, row: 0, color: 1 },
      { col: 3, row: 0, color: 2 },
      { col: 4, row: 0, color: 1 }
    ];

    moveSequence.forEach(move => {
      store.tryMove({ col: move.col, row: move.row }, move.color);
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
    const restoredService = new SGFService(parser, restoredStore);
    restoredService.apply(parsed);
    restoredStore.setMoveIndex(baseline.sgfIndex);

    expect(restoredState).toEqual(baseline);
  });
});
