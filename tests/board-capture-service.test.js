import { BoardCaptureService } from '../dist/services/board-capture-service.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { Renderer } from '../dist/renderer/renderer.js';
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
        showCapturedStones: true,
        enableFullReset: true,
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
  });

  describe('service instance', () => {
    test('has captureBoard method', () => {
      const hasMethod = typeof service.captureBoard === 'function';
      expect(hasMethod).toBe(true);
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
        showCapturedStones: true,
        enableFullReset: true,
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
      solve: { showCapturedStones: true, enableFullReset: true, highlightLastMove: true, showSolutionMoveNumbers: false },
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
      solve: { showCapturedStones: true, enableFullReset: true, highlightLastMove: true, showSolutionMoveNumbers: false },
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
      solve: { showCapturedStones: true, enableFullReset: true, highlightLastMove: true, showSolutionMoveNumbers: false },
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

  describe('renderer.render() call sequence', () => {
    test('calls render({ suppressLastMoveHighlight: true }) before and render() after', async () => {
      const calls = [];
      const origRender = renderer.render.bind(renderer);
      renderer.render = (opts) => { calls.push(opts); origRender(opts); };

      await service.captureBoard();

      expect(calls.length).toBe(2);
      expect(calls[0]).toEqual({ suppressLastMoveHighlight: true });
      expect(calls[1]).toBe(undefined);
    });

    test('calls render() in finally block even when SVG conversion throws', async () => {
      const calls = [];
      const origRender = renderer.render.bind(renderer);
      renderer.render = (opts) => { calls.push(opts); origRender(opts); };

      // createElement で空の canvas を返し、convertSvgToPng を失敗させる
      const originalCreateElement = document.createElement;
      document.createElement = (tag) => {
        const el = originalCreateElement(tag);
        if (tag === 'canvas') {
          el.getContext = () => null;
        }
        return el;
      };

      try {
        await service.captureBoard();
      } catch (e) {
        // expected
      } finally {
        document.createElement = originalCreateElement;
      }

      expect(calls.length).toBe(2);
      expect(calls[0]).toEqual({ suppressLastMoveHighlight: true });
      expect(calls[1]).toBe(undefined);
    });
  });

  describe('iOS detection and clipboard fallback', () => {
    let origUserAgent;

    beforeEach(() => {
      origUserAgent = global.navigator.userAgent;
    });

    afterEach(() => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: origUserAgent,
        writable: true,
        configurable: true
      });
    });

    test('shows modal fallback when navigator.clipboard is undefined', async () => {
      // navigator.clipboard を undefined に
      Object.defineProperty(global.navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true
      });

      await service.captureBoard();
      const overlay = document.getElementById('board-preview-overlay');
      expect(overlay).not.toBeNull();
    });

    test('shows alert when clipboard.write throws on non-iOS', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
        configurable: true
      });

      let alerted = false;
      global.alert = () => { alerted = true; };

      // clipboard.write が例外を投げるモック
      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          write: async () => { throw new Error('NotAllowedError'); }
        },
        writable: true,
        configurable: true
      });
      global.window.ClipboardItem = class {
        constructor(items) { this.items = items; }
      };

      await service.captureBoard();

      expect(alerted).toBe(true);
      const overlay = document.getElementById('board-preview-overlay');
      expect(overlay).not.toBeNull();
    });

    test('does not show alert when clipboard.write throws on iOS', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        writable: true,
        configurable: true
      });

      let alerted = false;
      global.alert = () => { alerted = true; };

      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          write: async () => { throw new Error('NotAllowedError'); }
        },
        writable: true,
        configurable: true
      });
      global.window.ClipboardItem = class {
        constructor(items) { this.items = items; }
      };

      await service.captureBoard();

      expect(alerted).toBe(false);
      const overlay = document.getElementById('board-preview-overlay');
      expect(overlay).not.toBeNull();
    });

    test('detects iPadOS as iOS via Mac+touchend', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        writable: true,
        configurable: true
      });

      // ontouchend が document に存在することをシミュレート
      const origHasTouchend = 'ontouchend' in document;
      Object.defineProperty(document, 'ontouchend', {
        value: () => {},
        writable: true,
        configurable: true
      });

      let alerted = false;
      global.alert = () => { alerted = true; };

      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          write: async () => { throw new Error('NotAllowedError'); }
        },
        writable: true,
        configurable: true
      });
      global.window.ClipboardItem = class {
        constructor(items) { this.items = items; }
      };

      try {
        await service.captureBoard();
      } finally {
        if (!origHasTouchend) {
          delete document.ontouchend;
        }
      }

      expect(alerted).toBe(false);
    });

    test('writes to clipboard successfully on non-iOS with ClipboardItem', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
        configurable: true
      });

      let writeCalled = false;
      let clipboardItemCtorCalled = false;

      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          write: async (items) => { writeCalled = true; }
        },
        writable: true,
        configurable: true
      });
      global.window.ClipboardItem = class {
        constructor(items) {
          clipboardItemCtorCalled = true;
          this.items = items;
        }
      };

      await service.captureBoard();

      expect(writeCalled).toBe(true);
      expect(clipboardItemCtorCalled).toBe(true);

      // 成功時はモーダルが表示されない
      const overlay = document.getElementById('board-preview-overlay');
      expect(overlay).toBeNull();
    });
  });

  describe('canvas creation', () => {
    test('reuses existing goban-canvas element', async () => {
      // 事前に canvas を生成しておく
      const existing = document.createElement('canvas');
      existing.id = 'goban-canvas';
      document.body.appendChild(existing);

      let createdCount = 0;
      const origCreateElement = document.createElement;
      document.createElement = (tag) => {
        const el = origCreateElement(tag);
        if (tag === 'canvas') {
          createdCount++;
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

      try {
        await service.captureBoard();
      } finally {
        document.createElement = origCreateElement;
      }

      // 既存 canvas が再利用されるので新規作成はされない
      expect(createdCount).toBe(0);
    });

    test('creates new goban-canvas when not present', () => {
      const canvas = service['getBoardCaptureCanvas']();
      expect(canvas.id).toBe('goban-canvas');
      expect(canvas.style.display).toBe('none');
      // body に追加されている
      expect(document.body.contains(canvas)).toBe(true);
    });
  });

  describe('RenderSnapshot abstraction (P1-3)', () => {
    let localSvg, localRenderer, localStore, localState;

    beforeEach(() => {
      document.body.innerHTML = '';
      global.alert = () => {};
      global.window.ClipboardItem = undefined;

      const engine = new GoEngine();
      const history = new HistoryManager();
      localState = createState();
      localStore = new GameStore(localState, engine, history);
      const elements = createUIElements();
      localSvg = elements.svg;
      localSvg.setAttribute('viewBox', '0 0 540 540');
      localSvg.setAttribute('width', '540');
      localSvg.setAttribute('height', '540');
      localRenderer = new Renderer(localStore, elements, () => ({
        edit: { rulesMode: 'standard' },
        solve: { showCapturedStones: true, enableFullReset: true, highlightLastMove: true, showSolutionMoveNumbers: false },
        ui: { deviceProfile: 'auto' }
      }));

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
      const origCreateElement = document.createElement.bind(document);
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

    test('accepts a RenderSnapshot directly and uses it for render calls', async () => {
      const calls = [];
      const snapshot = {
        renderWithoutHighlight: () => { calls.push('without'); },
        renderNormal: () => { calls.push('normal'); }
      };
      const localService = new BoardCaptureService(localSvg, snapshot);

      await localService.captureBoard();

      expect(calls.length).toBe(2);
      expect(calls[0]).toBe('without');
      expect(calls[1]).toBe('normal');
    });

    test('accepts a Renderer and adapts it via RendererSnapshotAdapter', async () => {
      const calls = [];
      const origRender = localRenderer.render.bind(localRenderer);
      localRenderer.render = (opts) => { calls.push(opts); origRender(opts); };

      // 後方互換: Renderer を直接渡しても動作する
      const localService = new BoardCaptureService(localSvg, localRenderer);

      await localService.captureBoard();

      expect(calls.length).toBe(2);
      expect(calls[0]).toEqual({ suppressLastMoveHighlight: true });
      expect(calls[1]).toBe(undefined);
    });

    test('invokes notify callback on successful clipboard write', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
        configurable: true
      });

      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          write: async (items) => {}
        },
        writable: true,
        configurable: true
      });
      global.window.ClipboardItem = class {
        constructor(items) { this.items = items; }
      };

      let notified = null;
      const snapshot = {
        renderWithoutHighlight: () => {},
        renderNormal: () => {}
      };
      const localService = new BoardCaptureService(
        localSvg,
        snapshot,
        (msg) => { notified = msg; }
      );

      await localService.captureBoard();

      expect(notified).toBe('コピーしました');
    });
  });
});
