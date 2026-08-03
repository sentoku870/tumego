import { initializeApp } from '../dist/main.js';
import { DEFAULT_CONFIG } from '../dist/types.js';
import { mockGlobals } from './helpers/global-mocks.js';

const setupRequiredDOM = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'goban';
  document.body.appendChild(svg);

  const boardWrapper = document.createElement('div');
  boardWrapper.id = 'board-wrapper';
  document.body.appendChild(boardWrapper);

  const infoEl = document.createElement('div');
  infoEl.id = 'info';
  document.body.appendChild(infoEl);

  const sliderEl = document.createElement('input');
  sliderEl.type = 'range';
  sliderEl.id = 'move-slider';
  document.body.appendChild(sliderEl);

  const movesEl = document.createElement('div');
  movesEl.id = 'moves';
  document.body.appendChild(movesEl);

  const msgEl = document.createElement('div');
  msgEl.id = 'msg';
  document.body.appendChild(msgEl);
};

const setupFullDOM = () => {
  setupRequiredDOM();

  const buttons = [
    'btn-clear', 'btn-problem', 'btn-answer', 'btn-prev-move', 'btn-next-move',
    'btn-black', 'btn-white', 'btn-erase', 'btn-alt', 'btn-undo', 'btn-exit-solve-edit',
    'btn-file', 'btn-feature', 'btn-file-select', 'btn-file-load', 'btn-file-copy',
    'btn-file-save', 'btn-file-qr', 'btn-file-discord', 'btn-feature-layout',
    'btn-feature-rotate', 'btn-feature-handicap', 'feature-copy-answer-sequence',
    'btn-save-board', 'settings-toggle', 'btn-header-apply', 'btn-header-reset',
    'btn-marker', 'btn-marker-clear', 'btn-marker-close',
    'btn-marker-select-CR', 'btn-marker-select-TR',
    'btn-marker-select-SQ', 'btn-marker-select-MA',
    'btn-marker-select-LB'
  ];
  buttons.forEach((id) => {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  });

  ['file-dropdown', 'feature-dropdown', 'settings-panel', 'sgf-input', 'sgf-text',
    'marker-dropdown'].forEach((id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  });

  ['9', '13', '19'].forEach((size) => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.dataset.size = size;
    document.body.appendChild(btn);
  });
};

const setupSgfInfoTabsDOM = () => {
  const panel = document.createElement('div');
  panel.id = 'sgf-info-panel';
  const basicBtn = document.createElement('button');
  basicBtn.dataset.sgfTab = 'basic';
  panel.appendChild(basicBtn);
  const advancedBtn = document.createElement('button');
  advancedBtn.dataset.sgfTab = 'advanced';
  panel.appendChild(advancedBtn);
  document.body.appendChild(panel);

  const basicContent = document.createElement('div');
  basicContent.id = 'sgf-tab-basic';
  document.body.appendChild(basicContent);

  const advancedContent = document.createElement('div');
  advancedContent.id = 'sgf-tab-advanced';
  document.body.appendChild(advancedContent);
};

describe('initializeApp()', () => {
  let restoreGlobals;
  beforeEach(() => {
    document.body.innerHTML = '';
    restoreGlobals = mockGlobals({
      alert: () => {},
      window: { ...window, tumego: undefined }
    });
    delete window.tumego;
  });

  afterEach(() => {
    if (restoreGlobals) restoreGlobals();
  });

  test('creates the global tumego debug API after init', () => {
    setupFullDOM();
    initializeApp();
    expect(window.tumego).not.toBeNull();
    expect(typeof window.tumego.loadSGF).toBe('function');
    expect(typeof window.tumego.exportSGF).toBe('function');
    expect(typeof window.tumego.reset).toBe('function');
    expect(typeof window.tumego.getStore).toBe('function');
  });

  test('initializes state with default board size and empty board', () => {
    setupFullDOM();
    initializeApp();
    const store = window.tumego.getStore();
    expect(store.snapshot.boardSize).toBe(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);
    expect(store.snapshot.board.length).toBe(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);
    expect(store.snapshot.board[0].length).toBe(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);
    expect(store.snapshot.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
  });

  test('initializes state with default komi', () => {
    setupFullDOM();
    initializeApp();
    const store = window.tumego.getStore();
    expect(store.snapshot.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
    expect(store.snapshot.startColor).toBe(1);
  });

  test('initializes game info with default values', () => {
    setupFullDOM();
    initializeApp();
    const store = window.tumego.getStore();
    const info = store.getGameInfo();
    expect(info.title).toBe('');
    expect(info.playerBlack).toBe(null);
    expect(info.playerWhite).toBe(null);
    expect(info.result).toBe(null);
  });

  test('initializes state gameInfo with handicap null', () => {
    setupFullDOM();
    initializeApp();
    const store = window.tumego.getStore();
    expect(store.snapshot.gameInfo.handicap).toBe(null);
  });

  test('throws error when required DOM elements are missing', () => {
    let alertCalled = false;
    let alertMessage = '';
    global.alert = (msg) => { alertCalled = true; alertMessage = msg; };

    initializeApp();

    expect(alertCalled).toBe(true);
    expect(alertMessage.includes('初期化')).toBe(true);
  });

  test('does not throw even when initialization fails', () => {
    document.body.innerHTML = '';
    let threw = false;
    try {
      initializeApp();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

describe('SGF info tabs (setupSgfInfoTabs via initializeApp)', () => {
  let restoreGlobals;
  beforeEach(() => {
    document.body.innerHTML = '';
    restoreGlobals = mockGlobals({
      alert: () => {},
      window: { ...window, tumego: undefined }
    });
    delete window.tumego;
  });

  afterEach(() => {
    if (restoreGlobals) restoreGlobals();
  });

  test('activates basic tab by default', () => {
    setupRequiredDOM();
    setupSgfInfoTabsDOM();
    initializeApp();
    const basicContent = document.getElementById('sgf-tab-basic');
    const advancedContent = document.getElementById('sgf-tab-advanced');
    expect(basicContent.hidden).toBe(false);
    expect(advancedContent.hidden).toBe(true);
  });

  test('clicking advanced tab switches the visible content', () => {
    setupRequiredDOM();
    setupSgfInfoTabsDOM();
    initializeApp();

    const advancedBtn = document.querySelector('[data-sgf-tab="advanced"]');
    advancedBtn.click();

    const basicContent = document.getElementById('sgf-tab-basic');
    const advancedContent = document.getElementById('sgf-tab-advanced');
    expect(basicContent.hidden).toBe(true);
    expect(advancedContent.hidden).toBe(false);
  });

  test('switching back to basic tab restores visibility', () => {
    setupRequiredDOM();
    setupSgfInfoTabsDOM();
    initializeApp();

    const basicBtn = document.querySelector('[data-sgf-tab="basic"]');
    const advancedBtn = document.querySelector('[data-sgf-tab="advanced"]');

    advancedBtn.click();
    expect(document.getElementById('sgf-tab-advanced').hidden).toBe(false);

    basicBtn.click();
    expect(document.getElementById('sgf-tab-basic').hidden).toBe(false);
    expect(document.getElementById('sgf-tab-advanced').hidden).toBe(true);
  });

  test('does not throw when sgf-info-panel is missing', () => {
    setupRequiredDOM();
    let threw = false;
    try {
      initializeApp();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
