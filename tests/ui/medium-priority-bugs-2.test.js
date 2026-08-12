// ============ medium-priority-bugs-2.test.js ============
// 2026-08-12 修正の中重要度バグ 3 件（UI 系）の回帰テスト。

import { FileMenuController } from '../../dist/ui/controllers/file-menu-controller.js';
import { FeatureMenuController } from '../../dist/ui/controllers/feature-menu-controller.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFIO } from '../../dist/services/sgf-io.js';
import { SGFShare } from '../../dist/services/sgf-share.js';
import { UIEventBus } from '../../dist/app/event-bus.js';
import { DropdownManager } from '../../dist/ui/controllers/dropdown-manager.js';
import { UIInteractionState } from '../../dist/ui/state/ui-interaction-state.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const jest = (globalThis.jest ?? createLocalJest());

function createLocalJest() {
  const createMock = (impl = () => {}) => {
    const mockFn = function (...args) {
      mockFn.mock.calls.push(args);
      return mockFn.mock.impl.apply(this, args);
    };
    mockFn.mock = { calls: [], impl };
    mockFn.mockImplementation = (newImpl) => {
      mockFn.mock.impl = newImpl;
      return mockFn;
    };
    mockFn.mockReturnValue = (value) => mockFn.mockImplementation(() => value);
    mockFn.mockClear = () => {
      mockFn.mock.calls = [];
    };
    return mockFn;
  };

  const spyOn = (object, methodName) => {
    const original = object[methodName];
    const mockFn = createMock(function (...args) {
      return original.apply(this, args);
    });
    object[methodName] = function (...args) {
      return mockFn.apply(this, args);
    };
    mockFn.mockRestore = () => {
      object[methodName] = original;
    };
    return mockFn;
  };

  return {
    fn: createMock,
    spyOn,
  };
}

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => ({
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
  sgfLoadedFromExternal: false,
  gameInfo: {
    title: '',
    playerBlack: null,
    playerWhite: null,
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    result: null,
    handicap: null,
    handicapStones: 0,
    handicapPositions: [],
    startColor: 1,
    boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
    problemDiagramSet: false,
    problemDiagramBlack: [],
    problemDiagramWhite: [],
  },
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  rootMarkers: [],
  nodeMarkers: [],
  markerMode: false,
  activeMarkerKind: null,
  activeMarkerLabel: null,
  koPoint: null,
  ...overrides,
});

const createUIElements = () => ({
  svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
  boardWrapper: document.createElement('div'),
  infoEl: document.createElement('div'),
  sliderEl: document.createElement('input'),
  movesEl: document.createElement('div'),
  msgEl: document.createElement('div'),
  capturedEl: document.createElement('div'),
});

function setupFileMenuDOM() {
  document.body.innerHTML = `
    <button id="btn-file" class="dropdown-btn"></button>
    <div id="file-dropdown" class="dropdown"></div>
    <button id="btn-file-select"></button>
    <button id="btn-file-load"></button>
    <button id="btn-file-copy"></button>
    <button id="btn-file-finalize"></button>
    <button id="btn-file-save"></button>
    <button id="btn-file-qr"></button>
    <button id="btn-file-discord"></button>
    <input id="sgf-input" type="file" />
    <div id="feature-dropdown" class="dropdown"></div>
    <input id="header-title" />
    <input id="header-black" />
    <input id="header-white" />
    <input id="header-komi" />
    <input id="header-result" />
    <button id="header-apply"></button>
    <button id="header-reset"></button>
  `;
}

function setupFeatureMenuDOM() {
  document.body.innerHTML = `
    <button id="btn-feature" class="dropdown-btn"></button>
    <div id="feature-dropdown" class="dropdown"></div>
    <button id="btn-feature-layout"></button>
    <button id="btn-feature-rotate"></button>
    <button id="feature-copy-answer-sequence"></button>
    <div id="file-dropdown" class="dropdown"></div>
  `;
}

function createDropdownManager() {
  return new DropdownManager(new UIInteractionState());
}

function createRendererMock() {
  return {
    render: jest.fn(),
    showMessage: jest.fn(),
    updateBoardSize: jest.fn(),
  };
}

describe('B-9: file menu does not overwrite in-progress header edits', () => {
  test('populateFields is not called when closing the dropdown', () => {
    setupFileMenuDOM();

    const state = createState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());
    const eventBus = new UIEventBus();
    const dropdownManager = createDropdownManager();
    const renderer = createRendererMock();
    const qrManager = { createSGFQRCode: jest.fn(), createDiscordShareLink: jest.fn() };
    const parser = new SGFParser();
    const sgfService = new SGFService(
      parser,
      store,
      new SGFIO(parser),
      new SGFShare(parser)
    );

    const controller = new FileMenuController(
      dropdownManager,
      sgfService,
      renderer,
      qrManager,
      store,
      eventBus
    );
    controller.initialize();

    // headerEditor.populateFields の呼び出し回数を記録
    const populateSpy = jest.spyOn(controller['headerEditor'], 'populateFields');

    // ファイルメニューを開く（populateFields 1回呼ばれる）
    document.getElementById('btn-file').click();
    const callsAfterOpen = populateSpy.mock.calls.length;

    // ファイルメニューを閉じる
    document.getElementById('btn-file').click();
    const callsAfterClose = populateSpy.mock.calls.length;

    // 開くときに populateFields、閉じるときには呼ばれない
    expect(callsAfterOpen).toBe(1);
    expect(callsAfterClose).toBe(1);

    populateSpy.mockRestore();
  });
});

describe('B-10: dispose() unsubscribes outside click listeners', () => {
  test('FileMenuController.dispose() can be called without throwing', () => {
    setupFileMenuDOM();
    const state = createState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());
    const eventBus = new UIEventBus();
    const dropdownManager = createDropdownManager();
    const renderer = createRendererMock();
    const qrManager = { createSGFQRCode: jest.fn(), createDiscordShareLink: jest.fn() };
    const parser = new SGFParser();
    const sgfService = new SGFService(
      parser,
      store,
      new SGFIO(parser),
      new SGFShare(parser)
    );

    const controller = new FileMenuController(
      dropdownManager,
      sgfService,
      renderer,
      qrManager,
      store,
      eventBus
    );
    controller.initialize();

    let firstCallErrored = false;
    try { controller.dispose(); } catch (e) { firstCallErrored = true; }
    expect(firstCallErrored).toBe(false);

    let secondCallErrored = false;
    try { controller.dispose(); } catch (e) { secondCallErrored = true; }
    expect(secondCallErrored).toBe(false);
  });

  test('FeatureMenuController.dispose() can be called without throwing', () => {
    setupFeatureMenuDOM();
    const state = createState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());
    const eventBus = new UIEventBus();
    const dropdownManager = createDropdownManager();
    const renderer = createRendererMock();
    const elements = createUIElements();
    const parser = new SGFParser();
    const sgfService = new SGFService(
      parser,
      store,
      new SGFIO(parser),
      new SGFShare(parser)
    );

    const controller = new FeatureMenuController(
      dropdownManager,
      renderer,
      elements,
      store,
      sgfService,
      eventBus
    );
    controller.initialize();

    let firstCallErrored = false;
    try { controller.dispose(); } catch (e) { firstCallErrored = true; }
    expect(firstCallErrored).toBe(false);

    let secondCallErrored = false;
    try { controller.dispose(); } catch (e) { secondCallErrored = true; }
    expect(secondCallErrored).toBe(false);
  });
});

describe('B-12: FeatureMenuController.syncLayoutState reflects body class', () => {
  test('syncLayoutState reads current body.horizontal class', () => {
    setupFeatureMenuDOM();
    document.body.classList.remove('horizontal');

    const state = createState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());
    const eventBus = new UIEventBus();
    const dropdownManager = createDropdownManager();
    const renderer = createRendererMock();
    const elements = createUIElements();
    const parser = new SGFParser();
    const sgfService = new SGFService(
      parser,
      store,
      new SGFIO(parser),
      new SGFShare(parser)
    );

    const controller = new FeatureMenuController(
      dropdownManager,
      renderer,
      elements,
      store,
      sgfService,
      eventBus
    );
    controller.initialize();

    // 初期: horizontal なし
    expect(controller.syncLayoutState()).toBe(false);

    // 外部要因で horizontal クラスを付与
    document.body.classList.add('horizontal');
    expect(controller.syncLayoutState()).toBe(true);

    // クラスを除去
    document.body.classList.remove('horizontal');
    expect(controller.syncLayoutState()).toBe(false);
  });
});