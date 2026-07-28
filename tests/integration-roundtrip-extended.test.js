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

  // テスト用: sgfMoves から自動的に SGFNode 木を構築
  const sgfMoves = overrides.sgfMoves ?? [];
  const root = { id: 'root', parent: null, children: [], isMainLine: true };
  let parent = root;
  for (let i = 0; i < sgfMoves.length; i++) {
    const node = { id: `n${i + 1}`, parent, children: [], isMainLine: true, move: { ...sgfMoves[i] } };
    parent.children.push(node);
    parent = node;
  }

  const state = {
    boardSize: size,
    board,
    mode: overrides.mode ?? 'alt',
    eraseMode: overrides.eraseMode ?? false,
    history: overrides.history ?? [],
    turn: overrides.turn ?? 0,
    sgfMoves,
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
    sgfTree: overrides.sgfTree ?? root,
    currentNodeId: overrides.currentNodeId ?? 'root',
    studyMode: overrides.studyMode ?? false,
    sgfLoadedFromExternal: overrides.sgfLoadedFromExternal ?? true,
    capturedCounts: { black: 0, white: 0 },
    markers: [],
    markerMode: false,
    activeMarkerKind: null,
    activeMarkerLabel: null,
    rootMarkers: [],
    nodeMarkers: [],
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

const cloneState = (state) => {
  // sgfTree 内の循環参照を避けるため、sgfTree を一時的に除去してクローン
  const tree = state.sgfTree;
  state.sgfTree = null;
  const cloned = JSON.parse(JSON.stringify(state));
  state.sgfTree = tree;
  cloned.sgfTree = null;
  return cloned;
};

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

    // 主要フィールドの比較（sgfTree 内部の __markers 等の非表示プロパティは除外）
    expect(restoredState.boardSize).toBe(baseline.boardSize);
    expect(restoredState.problemDiagramSet).toBe(baseline.problemDiagramSet);
    expect(restoredState.problemDiagramBlack).toEqual(baseline.problemDiagramBlack);
    expect(restoredState.problemDiagramWhite).toEqual(baseline.problemDiagramWhite);
    expect(restoredState.komi).toBe(baseline.komi);
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

    expect(restoredState.sgfMoves).toEqual(baseline.sgfMoves);
    expect(restoredState.turn).toBe(baseline.turn);
    expect(restoredState.sgfIndex).toBe(baseline.sgfIndex);
    expect(restoredState.board).toEqual(baseline.board);
  });
});
