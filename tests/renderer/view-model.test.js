import {
  RendererGeometry,
  RendererViewModelBuilder,
} from '../../dist/renderer/view-model.js';
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
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  ...overrides,
});

const noPrefs = () => ({
  edit: { rulesMode: 'standard' },
  solve: {
    showCapturedStones: false,
    enableFullReset: false,
    highlightLastMove: false,
    showSolutionMoveNumbers: false,
  },
  ui: { deviceProfile: 'auto' },
});

describe('RendererGeometry', () => {
  test('computes viewBoxSize and font sizes from boardSize', () => {
    const g = new RendererGeometry(9);
    expect(g.viewBoxSize).toBe(DEFAULT_CONFIG.CELL_SIZE * 8 + DEFAULT_CONFIG.MARGIN * 2);
    expect(g.coordFontSize).toBe(DEFAULT_CONFIG.CELL_SIZE * DEFAULT_CONFIG.COORD_FONT_RATIO);
    expect(g.moveNumberFontSize).toBe(DEFAULT_CONFIG.CELL_SIZE * DEFAULT_CONFIG.MOVE_NUM_FONT_RATIO);
    // Note: Go uses A-T skipping I
    expect(g.letters).toEqual('ABCDEFGHJ'.split(''));
  });

  test('coordinateAt returns margin + index * cellSize', () => {
    const g = new RendererGeometry(9);
    expect(g.coordinateAt(0)).toBe(DEFAULT_CONFIG.MARGIN);
    expect(g.coordinateAt(8)).toBe(DEFAULT_CONFIG.MARGIN + 8 * DEFAULT_CONFIG.CELL_SIZE);
  });

  test('toPixel converts a grid position to pixel coordinates', () => {
    const g = new RendererGeometry(9);
    const { cx, cy } = g.toPixel({ col: 4, row: 3 });
    expect(cx).toBe(DEFAULT_CONFIG.MARGIN + 4 * DEFAULT_CONFIG.CELL_SIZE);
    expect(cy).toBe(DEFAULT_CONFIG.MARGIN + 3 * DEFAULT_CONFIG.CELL_SIZE);
  });
});

describe('RendererViewModelBuilder', () => {
  let store;
  let state;

  beforeEach(() => {
    state = createState();
    store = new GameStore(state, new GoEngine(), new HistoryManager());
  });

  describe('buildBoardModel', () => {
    test('produces one StoneRenderInfo per non-zero cell', () => {
      state.board[0][0] = 1;
      state.board[1][1] = 2;
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const model = builder.buildBoardModel();
      expect(model.stones).toHaveLength(2);
      expect(model.stones[0].fill).toBe('var(--black)');
      expect(model.stones[0].strokeWidth).toBe(0);
      expect(model.stones[1].fill).toBe('var(--white)');
      expect(model.stones[1].strokeWidth).toBe(2);
    });

    test('coordinates count matches 4 per board cell', () => {
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const model = builder.buildBoardModel();
      expect(model.coordinates).toHaveLength(9 * 4);
    });

    test('omits moveNumbers when numberMode is false', () => {
      state.numberMode = false;
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const model = builder.buildBoardModel();
      expect(model.moveNumbers).toEqual([]);
      expect(model.showMoveNumbers).toBe(false);
    });

    test('omits lastMoveHighlight when no moves have been played', () => {
      const builder = new RendererViewModelBuilder(store, () => ({
        ...noPrefs(),
        solve: { ...noPrefs().solve, highlightLastMove: true },
      }));
      const model = builder.buildBoardModel();
      expect(model.lastMoveHighlight).toBe(undefined);
    });

    test('respects suppressLastMoveHighlight option', () => {
      state.sgfIndex = 1;
      state.sgfMoves = [{ col: 4, row: 4, color: 1 }];
      const prefs = () => ({
        ...noPrefs(),
        solve: { ...noPrefs().solve, highlightLastMove: true },
      });
      const builder = new RendererViewModelBuilder(store, prefs);
      const withHighlight = builder.buildBoardModel();
      const withoutHighlight = builder.buildBoardModel({ suppressLastMoveHighlight: true });
      expect(!!withHighlight.lastMoveHighlight).toBe(true);
      expect(withoutHighlight.lastMoveHighlight).toBe(undefined);
    });

    test('produces MarkerRenderInfo for each marker when showMarkers is true', () => {
      state.markers = [
        { pos: { col: 1, row: 2 }, kind: 'CR' },
        { pos: { col: 3, row: 3 }, kind: 'TR' },
      ];
      const prefs = () => ({
        ...noPrefs(),
        solve: { ...noPrefs().solve, showMarkers: true },
      });
      const builder = new RendererViewModelBuilder(store, prefs);
      const model = builder.buildBoardModel();
      expect(model.markers).toHaveLength(2);
      expect(model.markers[0].kind).toBe('CR');
      expect(model.markers[1].kind).toBe('TR');
      expect(model.showMarkers).toBe(true);
    });

    test('omits markers when showMarkers pref is false', () => {
      state.markers = [
        { pos: { col: 0, row: 0 }, kind: 'SQ' },
      ];
      const prefs = () => ({
        ...noPrefs(),
        solve: { ...noPrefs().solve, showMarkers: false },
      });
      const builder = new RendererViewModelBuilder(store, prefs);
      const model = builder.buildBoardModel();
      expect(model.markers).toEqual([]);
      expect(model.showMarkers).toBe(false);
    });
  });

  describe('buildInfoModel', () => {
    test('formats size and turn info', () => {
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const info = builder.buildInfoModel();
      expect(info.infoText).toContain('9路');
      expect(info.infoText).toContain('モード:自由配置');
    });

    test('shows solve-mode indicator when numberMode is on', () => {
      state.numberMode = true;
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const info = builder.buildInfoModel();
      expect(info.infoText).toContain('解答モード');
    });
  });

  describe('buildSliderModel', () => {
    test('returns current index and move count', () => {
      state.sgfIndex = 2;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ];
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const slider = builder.buildSliderModel();
      expect(slider.max).toBe(3);
      expect(slider.value).toBe(2);
    });
  });
});
