import { compositionRoot } from '../../dist/app/composition-root.js';
import { createDebugApi } from '../../dist/app/debug-api.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = () => ({
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
  capturedCounts: { black: 0, white: 0 }
});

const createUIElements = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const boardWrapper = document.createElement('div');
  const infoEl = document.createElement('div');
  const sliderEl = document.createElement('input');
  sliderEl.type = 'range';
  const movesEl = document.createElement('div');
  const msgEl = document.createElement('div');
  return { svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl };
};

const setupAllDOM = () => {
  ['btn-clear', 'btn-answer', 'btn-undo'].forEach((id) => {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  });
  ['sgf-text', 'sgf-input'].forEach((id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  });
};

describe('createDebugApi()', () => {
  let app;
  let api;

  beforeEach(() => {
    document.body.innerHTML = '';
    setupAllDOM();
    app = compositionRoot(createState(), createUIElements());
    api = createDebugApi(app);
  });

  describe('getStore()', () => {
    test('returns the underlying GameStore instance', () => {
      expect(api.getStore()).toBe(app.store);
    });
  });

  describe('exportSGF()', () => {
    test('returns SGF text from the service', () => {
      const exported = api.exportSGF();
      expect(typeof exported).toBe('string');
      expect(exported.includes('GM[1]')).toBe(true);
    });

    test('reflects changes to board state', () => {
      app.store.tryMove({ col: 3, row: 3 });
      const exported = api.exportSGF();
      expect(exported).toContain('B[dd]');
    });
  });

  describe('loadSGF()', () => {
    test('parses and applies the provided SGF text', () => {
      api.loadSGF('(;GM[1]FF[4]SZ[9]KM[6.5];B[aa];W[bb])');
      expect(app.store.snapshot.sgfMoves).toHaveLength(2);
      expect(app.store.snapshot.sgfMoves[0]).toEqual({ col: 0, row: 0, color: 1 });
      expect(app.store.snapshot.sgfMoves[1]).toEqual({ col: 1, row: 1, color: 2 });
    });

    test('sets sgfLoadedFromExternal to true', () => {
      expect(app.store.snapshot.sgfLoadedFromExternal).toBe(false);
      api.loadSGF('(;GM[1]FF[4]SZ[9];B[aa])');
      expect(app.store.snapshot.sgfLoadedFromExternal).toBe(true);
    });

    test('emits UIUpdate, answerButtonUpdate, and sgfApplied events', () => {
      let uiUpdateCount = 0;
      let answerButtonCount = 0;
      let sgfAppliedPayload = null;
      app.eventBus.onUIUpdate(() => { uiUpdateCount += 1; });
      app.eventBus.onAnswerButtonUpdate(() => { answerButtonCount += 1; });
      app.eventBus.onSgfApplied((text) => { sgfAppliedPayload = text; });

      api.loadSGF('(;GM[1]FF[4]SZ[9];B[cc])');

      expect(uiUpdateCount).toBe(1);
      expect(answerButtonCount).toBe(1);
      expect(sgfAppliedPayload).not.toBeNull();
      expect(sgfAppliedPayload.includes('B[cc]')).toBe(true);
    });

    test('updates renderer board size from SGF', () => {
      api.loadSGF('(;GM[1]FF[4]SZ[19];B[aa])');
      const updateBoardSize = app.renderer.updateBoardSize;
      let called = 0;
      app.renderer.updateBoardSize = () => { called += 1; };
      api.loadSGF('(;GM[1]FF[4]SZ[9];B[dd])');
      expect(called).toBe(1);
      app.renderer.updateBoardSize = updateBoardSize;
    });
  });

  describe('reset()', () => {
    test('clears moves and resets board', () => {
      app.store.tryMove({ col: 0, row: 0 });
      app.store.tryMove({ col: 1, row: 1 });
      expect(app.store.snapshot.sgfMoves.length > 0).toBe(true);

      api.reset();

      expect(app.store.snapshot.sgfMoves).toEqual([]);
      expect(app.store.snapshot.board[0][0]).toBe(0);
    });

    test('emits UIUpdate and answerButtonUpdate events', () => {
      let uiUpdateCount = 0;
      let answerButtonCount = 0;
      app.eventBus.onUIUpdate(() => { uiUpdateCount += 1; });
      app.eventBus.onAnswerButtonUpdate(() => { answerButtonCount += 1; });

      api.reset();

      expect(uiUpdateCount).toBe(1);
      expect(answerButtonCount).toBe(1);
    });
  });

  describe('API surface', () => {
    test('exposes exactly four methods', () => {
      const keys = Object.keys(api).sort();
      expect(keys).toEqual(['exportSGF', 'getStore', 'loadSGF', 'reset']);
    });
  });
});
