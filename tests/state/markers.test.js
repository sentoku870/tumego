import { DEFAULT_CONFIG } from '../../dist/types.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => ({
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
    sgfTree: { id: 'root', parent: null, children: [], isMainLine: true },
  currentNodeId: 'root',
  studyMode: false,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  rootMarkers: [],
  nodeMarkers: [],
  ...overrides,
});

describe('GameStore markers', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('setMarkerMode', () => {
    test('enables marker mode with given kind', () => {
      store.setMarkerMode('CR');
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('CR');
    });

    test('disables marker mode when called with null', () => {
      store.setMarkerMode('TR');
      store.setMarkerMode(null);
      expect(state.markerMode).toBe(false);
      expect(state.activeMarkerKind).toBe(null);
    });

    test('disables erase mode when enabling marker mode', () => {
      store.setEraseMode(true);
      store.setMarkerMode('SQ');
      expect(state.eraseMode).toBe(false);
    });
  });

  describe('addMarker / removeMarker', () => {
    test('adds a marker at the position', () => {
      store.setMarkerMode('CR');
      const result = store.addMarker({ col: 3, row: 4 }, 'CR');
      expect(result).toBe(true);
      expect(state.markers).toEqual([{ pos: { col: 3, row: 4 }, kind: 'CR' }]);
    });

    test('rejects duplicate of the same kind at the same position', () => {
      store.addMarker({ col: 0, row: 0 }, 'TR');
      const result = store.addMarker({ col: 0, row: 0 }, 'TR');
      expect(result).toBe(false);
      expect(state.markers).toHaveLength(1);
    });

    test('removes by kind', () => {
      store.addMarker({ col: 1, row: 1 }, 'MA');
      const result = store.removeMarker({ col: 1, row: 1 }, 'MA');
      expect(result).toBe(true);
      expect(state.markers).toHaveLength(0);
    });

    test('removes all markers at a position when kind omitted', () => {
      store.addMarker({ col: 2, row: 2 }, 'CR');
      // allowMulti is honored by the caller, but removeMarker with no kind
      // always wipes the cell; the store API lets the controller decide.
      store.addMarker({ col: 2, row: 2 }, 'SQ');
      const result = store.removeMarker({ col: 2, row: 2 });
      expect(result).toBe(true);
      expect(state.markers).toHaveLength(0);
    });

    test('rejects out-of-bounds positions', () => {
      expect(store.addMarker({ col: -1, row: 0 }, 'CR')).toBe(false);
      expect(store.addMarker({ col: 0, row: 9 }, 'CR')).toBe(false);
      expect(state.markers).toEqual([]);
    });
  });

  describe('toggleMarker (default single-marker behavior)', () => {
    test('adds a marker when none exists', () => {
      store.setMarkerMode('TR');
      const changed = store.toggleMarker({ col: 5, row: 5 });
      expect(changed).toBe(true);
      expect(state.markers).toHaveLength(1);
    });

    test('removes marker when same kind is toggled', () => {
      store.setMarkerMode('MA');
      store.toggleMarker({ col: 0, row: 0 });
      const changed = store.toggleMarker({ col: 0, row: 0 });
      expect(changed).toBe(false);
      expect(state.markers).toHaveLength(0);
    });

    test('replaces kind at the same cell when allowMulti=false', () => {
      store.setMarkerMode('CR');
      store.toggleMarker({ col: 2, row: 2 });
      store.setMarkerMode('SQ');
      store.toggleMarker({ col: 2, row: 2 });
      expect(state.markers).toEqual([{ pos: { col: 2, row: 2 }, kind: 'SQ' }]);
    });

    test('keeps both kinds when allowMulti=true', () => {
      store.setMarkerMode('CR');
      store.toggleMarker({ col: 4, row: 4 }, true);
      store.setMarkerMode('TR');
      store.toggleMarker({ col: 4, row: 4 }, true);
      expect(state.markers).toHaveLength(2);
    });
  });

  describe('clearMarkers', () => {
    test('clears all markers of the current node', () => {
      store.addMarker({ col: 0, row: 0 }, 'CR');
      store.addMarker({ col: 1, row: 1 }, 'TR');
      store.clearMarkers();
      expect(state.markers).toEqual([]);
    });
  });

  describe('marker persistence per node', () => {
    test('tryMove pushes a fresh marker slot and shows it for the new move', () => {
      // sgfIndex = 0, rootMarkers starts empty
      store.setMarkerMode('CR');
      store.addMarker({ col: 0, row: 0 }, 'CR');
      expect(state.markers).toHaveLength(1);
      expect(state.rootMarkers).toHaveLength(1);

      // 着手 → sgfIndex = 1, 表示は nodeMarkers[0]（最初は空）
      store.tryMove({ col: 4, row: 4 });
      expect(state.sgfIndex).toBe(1);
      expect(state.markers).toEqual([]);
      expect(state.nodeMarkers).toHaveLength(1);
      expect(state.nodeMarkers[0]).toEqual([]);

      // 戻って問題図レベルを確認
      store.setMoveIndex(0);
      expect(state.markers).toHaveLength(1);
      expect(state.markers[0].pos).toEqual({ col: 0, row: 0 });
    });

    test('markers added at sgfIndex=1 are stored in nodeMarkers[0]', () => {
      store.setProblemDiagram(); // clears sgfMoves etc.
      store.tryMove({ col: 3, row: 3 });
      store.setMarkerMode('TR');
      store.addMarker({ col: 1, row: 1 }, 'TR');
      expect(state.markers).toHaveLength(1);
      expect(state.nodeMarkers[0]).toEqual([{ pos: { col: 1, row: 1 }, kind: 'TR' }]);
    });

    test('setMoveIndex switches markers between nodes', () => {
      store.setProblemDiagram();
      store.tryMove({ col: 3, row: 3 });
      // sgfIndex = 1
      store.setMarkerMode('CR');
      store.addMarker({ col: 1, row: 1 }, 'CR');
      store.tryMove({ col: 4, row: 4 });
      // sgfIndex = 2
      store.setMarkerMode('TR');
      store.addMarker({ col: 2, row: 2 }, 'TR');

      // back to first move → nodeMarkers[0] = [CR]
      store.setMoveIndex(1);
      expect(state.markers).toEqual([{ pos: { col: 1, row: 1 }, kind: 'CR' }]);
      // forward to second move → nodeMarkers[1] = [TR]
      store.setMoveIndex(2);
      expect(state.markers).toEqual([{ pos: { col: 2, row: 2 }, kind: 'TR' }]);
      // back to root → rootMarkers
      store.setMoveIndex(0);
      expect(state.markers).toEqual([]);
    });
  });

  describe('HistoryManager round-trip', () => {
    test('saving and restoring keeps marker state', () => {
      store.addMarker({ col: 0, row: 0 }, 'CR');
      store.addMarker({ col: 1, row: 1 }, 'TR');
      history.save('test', state);
      // mutate
      store.addMarker({ col: 2, row: 2 }, 'SQ');
      expect(state.markers).toHaveLength(3);
      const restored = history.restoreLast(state);
      expect(restored).toBe(true);
      expect(state.markers).toHaveLength(2);
    });
  });

  describe('reset paths', () => {
    test('resetForClearAll wipes markers', () => {
      store.addMarker({ col: 0, row: 0 }, 'CR');
      store.addMarker({ col: 1, row: 1 }, 'TR');
      store.resetForClearAll();
      expect(state.markers).toEqual([]);
      expect(state.rootMarkers).toEqual([]);
      expect(state.nodeMarkers).toEqual([]);
    });

    test('setProblemDiagram wipes markers', () => {
      store.addMarker({ col: 0, row: 0 }, 'CR');
      store.setProblemDiagram();
      expect(state.markers).toEqual([]);
      expect(state.rootMarkers).toEqual([]);
      expect(state.nodeMarkers).toEqual([]);
    });

    test('initBoard clears markers', () => {
      store.addMarker({ col: 0, row: 0 }, 'CR');
      store.initBoard(13);
      expect(state.markers).toEqual([]);
      expect(state.rootMarkers).toEqual([]);
      expect(state.nodeMarkers).toEqual([]);
    });
  });

  describe('LB auto-advance (配置時に次の文字へ)', () => {
    test('LB 配置ごとに activeMarkerLabel が A→B→C→D→E→A と進む', () => {
      store.setMarkerMode('LB', 'A');
      store.addMarker({ col: 0, row: 0 }, 'LB', 'A');
      expect(state.activeMarkerLabel).toBe('B');
      store.addMarker({ col: 1, row: 1 }, 'LB', 'B');
      expect(state.activeMarkerLabel).toBe('C');
      store.addMarker({ col: 2, row: 2 }, 'LB', 'C');
      expect(state.activeMarkerLabel).toBe('D');
      store.addMarker({ col: 3, row: 3 }, 'LB', 'D');
      expect(state.activeMarkerLabel).toBe('E');
      store.addMarker({ col: 4, row: 4 }, 'LB', 'E');
      expect(state.activeMarkerLabel).toBe('A');
    });

    test('CR/TR/SQ/MA 配置では activeMarkerLabel は変化しない', () => {
      store.setMarkerMode('CR');
      store.addMarker({ col: 0, row: 0 }, 'CR');
      expect(state.activeMarkerLabel).toBe(null);
      store.addMarker({ col: 1, row: 1 }, 'TR');
      expect(state.activeMarkerLabel).toBe(null);
    });

    test('toggleMarker で LB 配置した場合も自動進行する', () => {
      store.setMarkerMode('LB', 'A');
      // toggleMarker はアクティブ種別の現在ラベルを使う
      store.toggleMarker({ col: 0, row: 0 });
      expect(state.markers).toEqual([{ pos: { col: 0, row: 0 }, kind: 'LB', label: 'A' }]);
      expect(state.activeMarkerLabel).toBe('B');
      // 次の配置は B で行われる
      state.activeMarkerKind = 'LB';
      state.activeMarkerLabel = 'B';
      store.toggleMarker({ col: 1, row: 1 });
      expect(state.markers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'LB', label: 'A' },
        { pos: { col: 1, row: 1 }, kind: 'LB', label: 'B' },
      ]);
      expect(state.activeMarkerLabel).toBe('C');
    });
  });
});
