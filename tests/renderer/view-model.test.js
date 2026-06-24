import {
  getCircleNumber,
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
  gameTree: null,
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

describe('getCircleNumber', () => {
  test('returns ①-⑳ for 1-20', () => {
    expect(getCircleNumber(1)).toBe('①');
    expect(getCircleNumber(10)).toBe('⑩');
    expect(getCircleNumber(20)).toBe('⑳');
  });

  test('returns ㉑-㉟ for 21-35', () => {
    expect(getCircleNumber(21)).toBe('㉑');
    expect(getCircleNumber(35)).toBe('㉟');
  });

  test('returns ㊱-㊿ for 36-50', () => {
    expect(getCircleNumber(36)).toBe('㊱');
    expect(getCircleNumber(50)).toBe('㊿');
  });

  test('falls back to plain number for out-of-range', () => {
    expect(getCircleNumber(0)).toBe('0');
    expect(getCircleNumber(51)).toBe('51');
    expect(getCircleNumber(-1)).toBe('-1');
  });
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
  });

  describe('buildInfoModel', () => {
    test('formats size and turn info', () => {
      const builder = new RendererViewModelBuilder(store, noPrefs);
      const info = builder.buildInfoModel();
      expect(info.infoText).toContain('9路');
      expect(info.infoText).toContain('モード:交互配置');
    });

    test('shows 解答モード when numberMode is on', () => {
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
