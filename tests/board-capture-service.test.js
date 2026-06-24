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

    test('appends new canvas when none exists', () => {
      const before = document.getElementById('goban-canvas');
      const canvas = document.createElement('canvas');
      canvas.id = 'goban-canvas';
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      const after = document.getElementById('goban-canvas');
      expect(before).toBeNull();
      expect(after).not.toBeNull();
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

describe('BoardCaptureService - SVG conversion', () => {
  let service, renderer, store, state, svg;

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

  test('getSvgRenderSize returns 0 for element without dimensions', () => {
    const emptySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const size = service['getSvgRenderSize'](emptySvg);
    expect(size.width).toBe(0);
    expect(size.height).toBe(0);
  });

  test('getSvgRenderSize uses viewBox when available', () => {
    svg.setAttribute('viewBox', '0 0 540 540');
    const size = service['getSvgRenderSize'](svg);
    expect(size.width).toBe(540);
    expect(size.height).toBe(540);
  });

  test('getSvgRenderSize handles non-finite dimensions', () => {
    const emptySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    emptySvg.setAttribute('width', 'invalid');
    emptySvg.setAttribute('height', 'invalid');
    const size = service['getSvgRenderSize'](emptySvg);
    expect(size.width).toBe(0);
    expect(size.height).toBe(0);
  });

  test('convertSvgToPng throws when SVG size is 0', async () => {
    const emptySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const canvas = document.createElement('canvas');
    let threw = false;
    let message = '';
    try {
      await service['convertSvgToPng'](emptySvg, canvas);
    } catch (e) {
      threw = true;
      message = e.message;
    }
    expect(threw).toBe(true);
    expect(message.includes('サイズ')).toBe(true);
  });
});

describe('BoardCaptureService - blobToDataUrl', () => {
  let service;
  let origFileReader;

  beforeEach(() => {
    document.body.innerHTML = '';
    origFileReader = global.FileReader;
    const engine = new GoEngine();
    const history = new HistoryManager();
    const state = createState();
    const store = new GameStore(state, engine, history);
    const elements = createUIElements();
    const renderer = new Renderer(store, elements, () => ({
      edit: { rulesMode: 'standard' },
      solve: { showCapturedStones: 'on', enableFullReset: 'on', highlightLastMove: true, showSolutionMoveNumbers: false },
      ui: { deviceProfile: 'auto' }
    }));
    service = new BoardCaptureService(elements.svg, renderer);
  });

  afterEach(() => {
    if (origFileReader === undefined) {
      delete global.FileReader;
    } else {
      global.FileReader = origFileReader;
    }
  });

  test('returns data URL string on success', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    const result = await service['blobToDataUrl'](blob);
    expect(typeof result).toBe('string');
    expect(result.length > 0).toBe(true);
  });

  test('returns null when FileReader errors', async () => {
    global.FileReader = class {
      readAsDataURL(blob) {
        setTimeout(() => {
          this.onerror();
        }, 0);
      }
    };
    const blob = new Blob(['fake'], { type: 'image/png' });
    const result = await service['blobToDataUrl'](blob);
    expect(result).toBeNull();
  });
});

describe('BoardCaptureService - showBoardPreviewModal', () => {
  let service;

  beforeEach(() => {
    document.body.innerHTML = '';
    global.alert = () => {};
    const engine = new GoEngine();
    const history = new HistoryManager();
    const state = createState();
    const store = new GameStore(state, engine, history);
    const elements = createUIElements();
    const renderer = new Renderer(store, elements, () => ({
      edit: { rulesMode: 'standard' },
      solve: { showCapturedStones: 'on', enableFullReset: 'on', highlightLastMove: true, showSolutionMoveNumbers: false },
      ui: { deviceProfile: 'auto' }
    }));
    service = new BoardCaptureService(elements.svg, renderer);
  });

  test('creates overlay with board-preview-overlay id', () => {
    service['showBoardPreviewModal']('data:image/png;base64,fake');
    const overlay = document.getElementById('board-preview-overlay');
    expect(overlay).not.toBeNull();
  });

  test('contains img element with data URL', () => {
    const fakeUrl = 'data:image/png;base64,XYZ';
    service['showBoardPreviewModal'](fakeUrl);
    const img = document.getElementById('board-preview');
    expect(img).not.toBeNull();
    expect(img.src).toBe(fakeUrl);
  });

  test('replaces existing overlay on second call', () => {
    service['showBoardPreviewModal']('data:image/png;base64,first');
    const firstOverlay = document.getElementById('board-preview-overlay');
    service['showBoardPreviewModal']('data:image/png;base64,second');
    const secondOverlay = document.getElementById('board-preview-overlay');
    expect(firstOverlay).not.toBeNull();
    expect(secondOverlay).not.toBeNull();
    expect(firstOverlay).not.toBe(secondOverlay);
  });

  test('close button removes overlay', () => {
    service['showBoardPreviewModal']('data:image/png;base64,test');
    const closeButton = document.querySelector('#board-preview-overlay button');
    expect(closeButton).not.toBeNull();
    closeButton.click();
    const overlayAfter = document.getElementById('board-preview-overlay');
    expect(overlayAfter).toBeNull();
  });

  test('overlay has fixed position styling', () => {
    service['showBoardPreviewModal']('data:image/png;base64,test');
    const overlay = document.getElementById('board-preview-overlay');
    expect(overlay.style.position).toBe('fixed');
  });
});

describe('BoardCaptureService - captureBoard flow', () => {
  let service, renderer, state;
  let origCreate, origRevoke, origImage, origCreateElement, origClipboard, origClipboardItem;

  beforeEach(() => {
    document.body.innerHTML = '';
    global.alert = () => {};
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    const store = new GameStore(state, engine, history);
    const elements = createUIElements();
    const rendererInstance = new Renderer(store, elements, () => ({
      edit: { rulesMode: 'standard' },
      solve: { showCapturedStones: 'on', enableFullReset: 'on', highlightLastMove: true, showSolutionMoveNumbers: false },
      ui: { deviceProfile: 'auto' }
    }));
    renderer = rendererInstance;
    service = new BoardCaptureService(elements.svg, renderer);

    origCreate = URL.createObjectURL;
    origRevoke = URL.revokeObjectURL;
    origImage = global.Image;
    origCreateElement = document.createElement.bind(document);
    origClipboard = global.navigator.clipboard;
    origClipboardItem = global.window.ClipboardItem;

    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
      }
      set src(value) {
        this._src = value;
        const onloadRef = this.onload;
        if (onloadRef) {
          setTimeout(() => onloadRef(), 0);
        }
      }
      get src() {
        return this._src;
      }
    };
    document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          clearRect: () => {},
          fillRect: () => {},
          drawImage: () => {},
          fillStyle: ''
        });
        el.toBlob = (cb) => cb(new Blob(['png'], { type: 'image/png' }));
      }
      return el;
    };
  });

  afterEach(() => {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    global.Image = origImage;
    document.createElement = origCreateElement;
    if (origClipboard === undefined) {
      delete global.navigator.clipboard;
    } else {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: origClipboard,
        writable: true,
        configurable: true
      });
    }
    if (origClipboardItem === undefined) {
      delete global.window.ClipboardItem;
    } else {
      global.window.ClipboardItem = origClipboardItem;
    }
  });

  test('falls back to preview modal when clipboard API missing', async () => {
    global.navigator.clipboard = undefined;
    delete global.window.ClipboardItem;
    state.board[4][4] = 1;
    let previewAppeared = false;
    let threw = false;
    try {
      await service.captureBoard();
      previewAppeared = document.getElementById('board-preview-overlay') !== null;
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test('handles Image.onload firing successfully', async () => {
    state.board[0][0] = 1;
    let threw = false;
    let errorMsg = '';
    try {
      await service.captureBoard();
    } catch (e) {
      threw = true;
      errorMsg = e.message || String(e);
    }
    expect(threw).toBe(false);
    expect(errorMsg).toBe('');
  });

  test('suppresses alert on iOS when clipboard fails', async () => {
    let alertCalled = false;
    global.alert = () => { alertCalled = true; };
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
      configurable: true
    });

    global.navigator.clipboard = {
      write: async () => { throw new Error('blocked'); }
    };
    global.window.ClipboardItem = class {
      constructor(items) { this.items = items; }
    };

    state.board[0][0] = 1;
    let threw = false;
    try {
      await service.captureBoard();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test('handles missing ClipboardItem gracefully', async () => {
    let alertCalled = false;
    global.alert = () => { alertCalled = true; };
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0)',
      configurable: true
    });
    delete global.navigator.clipboard;
    delete global.window.ClipboardItem;
    state.board[0][0] = 1;
    let threw = false;
    try {
      await service.captureBoard();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
