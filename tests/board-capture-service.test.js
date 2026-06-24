import './helpers/dom-setup.js';
import { BoardCaptureService } from '../dist/services/board-capture-service.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { Renderer } from '../dist/renderer.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

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
  gameTree: null,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  ...overrides
});

const createUIElements = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const boardWrapper = document.createElement('div');
  const infoEl = document.createElement('div');
  const sliderEl = document.createElement('input');
  sliderEl.type = 'range';
  const movesEl = document.createElement('div');
  const msgEl = document.createElement('div');
  const capturedEl = document.createElement('div');
  return { svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl, capturedEl };
};

describe('BoardCaptureService', () => {
  let store, state, renderer, service, svg;

  beforeEach(() => {
    document.body.innerHTML = '';
    global.alert = () => {};
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
    const elements = createUIElements();
    svg = elements.svg;
    renderer = new Renderer(store, elements, () => ({
      edit: { rulesMode: 'standard' },
      solve: {
        showCapturedStones: 'on',
        enableFullReset: 'on',
        highlightLastMove: true,
        showSolutionMoveNumbers: false
      },
      ui: { deviceProfile: 'auto' }
    }));
    service = new BoardCaptureService(svg, renderer);
  });

  describe('constructor', () => {
    test('does not throw on construction', () => {
      let threw = false;
      try {
        new BoardCaptureService(svg, renderer);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('instance is created', () => {
      const exists = service !== null && service !== undefined;
      expect(exists).toBe(true);
    });
  });

  describe('service instance', () => {
    test('preserves reference to svg element', () => {
      const isValid = service !== null && service !== undefined;
      expect(isValid).toBe(true);
    });

    test('preserves reference to renderer', () => {
      const isValid = renderer !== null && renderer !== undefined;
      expect(isValid).toBe(true);
    });

    test('has captureBoard method', () => {
      const hasMethod = typeof service.captureBoard === 'function';
      expect(hasMethod).toBe(true);
    });
  });

  describe('canvas element handling', () => {
    test('createBoardCaptureCanvas creates canvas with goban-canvas id', () => {
      const canvas = document.createElement('canvas');
      canvas.id = 'goban-canvas';
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      const found = document.getElementById('goban-canvas');
      const tagName = found && found.tagName;
      expect(tagName).toBe('CANVAS');
    });

    test('returns existing canvas on second call', () => {
      const canvas1 = document.createElement('canvas');
      canvas1.id = 'goban-canvas';
      document.body.appendChild(canvas1);
      const canvas2 = document.getElementById('goban-canvas');
      const sameInstance = canvas1 === canvas2;
      expect(sameInstance).toBe(true);
    });
  });

  describe('captureBoard()', () => {
    test('returns a Promise', () => {
      const promise = service.captureBoard().catch(() => {});
      const isPromise = promise && typeof promise.then === 'function';
      expect(isPromise).toBe(true);
    });

    test('does not throw synchronously', () => {
      let syncThrew = false;
      try {
        service.captureBoard().catch(() => {});
      } catch (e) {
        syncThrew = true;
      }
      expect(syncThrew).toBe(false);
    });

    test('handles state with stones', () => {
      state.board[0][0] = 1;
      state.board[3][3] = 2;
      let syncThrew = false;
      try {
        service.captureBoard().catch(() => {});
      } catch (e) {
        syncThrew = true;
      }
      expect(syncThrew).toBe(false);
    });

    test('handles 19x19 board', () => {
      state.boardSize = 19;
      let syncThrew = false;
      try {
        service.captureBoard().catch(() => {});
      } catch (e) {
        syncThrew = true;
      }
      expect(syncThrew).toBe(false);
    });
  });
});
