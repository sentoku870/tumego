import './helpers/dom-setup.js';
import { UIController } from '../dist/ui-controller.js';
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

const setupAllDOM = () => {
  // Toolbar buttons
  ['btn-clear', 'btn-problem', 'btn-answer', 'btn-prev-move', 'btn-next-move',
   'btn-black', 'btn-white', 'btn-erase', 'btn-alt', 'btn-undo', 'btn-exit-solve-edit'].forEach((id) => {
    const btn = document.createElement('button');
    btn.id = id;
    document.body.appendChild(btn);
  });

  // File menu
  const fileBtn = document.createElement('button');
  fileBtn.id = 'btn-file';
  document.body.appendChild(fileBtn);
  const fileDropdown = document.createElement('div');
  fileDropdown.id = 'file-dropdown';
  document.body.appendChild(fileDropdown);

  ['btn-file-select', 'btn-file-load', 'btn-file-copy', 'btn-file-save', 'btn-file-qr', 'btn-file-discord'].forEach((id) => {
    const btn = document.createElement('button');
    btn.id = id;
    document.body.appendChild(btn);
  });

  // Feature menu
  const featureBtn = document.createElement('button');
  featureBtn.id = 'btn-feature';
  document.body.appendChild(featureBtn);
  const featureDropdown = document.createElement('div');
  featureDropdown.id = 'feature-dropdown';
  document.body.appendChild(featureDropdown);

  ['btn-feature-layout', 'btn-feature-rotate', 'btn-feature-handicap', 'feature-copy-answer-sequence'].forEach((id) => {
    const btn = document.createElement('button');
    btn.id = id;
    document.body.appendChild(btn);
  });

  // SGF input
  const sgfInput = document.createElement('input');
  sgfInput.id = 'sgf-input';
  sgfInput.type = 'file';
  document.body.appendChild(sgfInput);

  // SGF text
  const sgfText = document.createElement('textarea');
  sgfText.id = 'sgf-text';
  document.body.appendChild(sgfText);

  // Header inputs
  ['header-title', 'header-black', 'header-white', 'header-komi', 'header-result'].forEach((id) => {
    const input = document.createElement('input');
    input.id = id;
    document.body.appendChild(input);
  });

  ['btn-header-apply', 'btn-header-reset'].forEach((id) => {
    const btn = document.createElement('button');
    btn.id = id;
    document.body.appendChild(btn);
  });

  // Settings panel
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settings-panel';
  document.body.appendChild(settingsPanel);

  const settingsToggle = document.createElement('button');
  settingsToggle.id = 'settings-toggle';
  document.body.appendChild(settingsToggle);

  const tabBasic = document.createElement('button');
  tabBasic.className = 'settings-tab';
  tabBasic.dataset.tab = 'basic';
  settingsPanel.appendChild(tabBasic);
  const tabAdvanced = document.createElement('button');
  tabAdvanced.className = 'settings-tab';
  tabAdvanced.dataset.tab = 'advanced';
  settingsPanel.appendChild(tabAdvanced);

  const tabBasicContent = document.createElement('div');
  tabBasicContent.id = 'settings-tab-basic';
  settingsPanel.appendChild(tabBasicContent);
  const tabAdvancedContent = document.createElement('div');
  tabAdvancedContent.id = 'settings-tab-advanced';
  settingsPanel.appendChild(tabAdvancedContent);

  const rulesSelect = document.createElement('select');
  rulesSelect.id = 'setting-edit-rules-mode';
  ['standard', 'free'].forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    rulesSelect.appendChild(opt);
  });
  settingsPanel.appendChild(rulesSelect);

  const deviceProfileSelect = document.createElement('select');
  deviceProfileSelect.id = 'settings-device-profile';
  ['auto', 'desktop', 'phone', 'tablet'].forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    deviceProfileSelect.appendChild(opt);
  });
  settingsPanel.appendChild(deviceProfileSelect);

  ['setting-show-captured', 'setting-enable-reset', 'setting-highlight-last-move', 'setting-show-solution-move-numbers'].forEach((id) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    settingsPanel.appendChild(input);
  });

  const resetBtn = document.createElement('button');
  resetBtn.id = 'setting-reset-button';
  settingsPanel.appendChild(resetBtn);

  // Size buttons
  ['9', '13', '19'].forEach((size) => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.dataset.size = size;
    document.body.appendChild(btn);
  });

  // Goban
  const goban = document.createElement('div');
  goban.id = 'goban';
  document.body.appendChild(goban);

  // History popup
  const historyPopup = document.createElement('div');
  historyPopup.id = 'history-popup';
  document.body.appendChild(historyPopup);
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

describe('UIController', () => {
  let state, elements, controller;

  beforeEach(() => {
    cleanupDOM();
    setupAllDOM();
    state = createState();
    elements = createUIElements();
  });

  afterEach(cleanupDOM);

  describe('constructor', () => {
    test('creates instance without throwing', () => {
      let threw = false;
      try {
        controller = new UIController(state, elements);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('instance is created', () => {
      controller = new UIController(state, elements);
      const exists = controller !== null && controller !== undefined;
      expect(exists).toBe(true);
    });

    test('initializes all sub-controllers', () => {
      controller = new UIController(state, elements);
      // Verify that sub-controllers are initialized (via initialize)
      let initThrew = false;
      try {
        controller.initialize();
      } catch (e) {
        initThrew = true;
      }
      expect(initThrew).toBe(false);
    });
  });

  describe('initialize()', () => {
    test('does not throw with minimal DOM', () => {
      controller = new UIController(state, elements);
      let threw = false;
      try {
        controller.initialize();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('sets board to default size (9) after init', () => {
      controller = new UIController(state, elements);
      controller.initialize();
      // state.boardSize should still be 9 (default) after initBoard
      expect(state.boardSize).toBe(9);
    });

    test('initializes board with default size', () => {
      controller = new UIController(state, elements);
      controller.initialize();
      // Board should be initialized
      expect(state.board).toHaveLength(9);
    });
  });

  describe('private getEffectiveDeviceProfile (tested via type cast)', () => {
    test('returns preference when not auto (desktop)', () => {
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('desktop');
      expect(result).toBe('desktop');
    });

    test('returns preference when not auto (phone)', () => {
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('phone');
      expect(result).toBe('phone');
    });

    test('returns preference when not auto (tablet)', () => {
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('tablet');
      expect(result).toBe('tablet');
    });

    test('returns phone for width < 640 in auto mode', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('auto');
      expect(result).toBe('phone');
      // Restore
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    });

    test('returns tablet for 640 <= width < 1024 in auto mode', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('auto');
      expect(result).toBe('tablet');
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    });

    test('returns desktop for width >= 1024 in auto mode', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      controller = new UIController(state, elements);
      const result = controller.getEffectiveDeviceProfile('auto');
      expect(result).toBe('desktop');
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    });
  });

  describe('private applyDeviceProfileClass (tested via type cast)', () => {
    test('adds device-desktop class for desktop preference', () => {
      controller = new UIController(state, elements);
      controller.applyDeviceProfileClass('desktop');
      const hasClass = document.body.classList.contains('device-desktop');
      expect(hasClass).toBe(true);
    });

    test('adds device-phone class for phone preference', () => {
      controller = new UIController(state, elements);
      controller.applyDeviceProfileClass('phone');
      const hasClass = document.body.classList.contains('device-phone');
      expect(hasClass).toBe(true);
    });

    test('adds device-tablet class for tablet preference', () => {
      controller = new UIController(state, elements);
      controller.applyDeviceProfileClass('tablet');
      const hasClass = document.body.classList.contains('device-tablet');
      expect(hasClass).toBe(true);
    });

    test('removes previous device-* class when changing', () => {
      controller = new UIController(state, elements);
      controller.applyDeviceProfileClass('desktop');
      controller.applyDeviceProfileClass('phone');
      const hasDesktop = document.body.classList.contains('device-desktop');
      const hasPhone = document.body.classList.contains('device-phone');
      expect(hasDesktop).toBe(false);
      expect(hasPhone).toBe(true);
    });

    test('auto mode applies effective profile based on width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      controller = new UIController(state, elements);
      controller.applyDeviceProfileClass('auto');
      const hasPhone = document.body.classList.contains('device-phone');
      expect(hasPhone).toBe(true);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    });
  });

  describe('private syncSgfTextarea (tested via type cast)', () => {
    test('updates sgf-text element with given text', () => {
      controller = new UIController(state, elements);
      controller.syncSgfTextarea('test sgf content');
      const textarea = document.getElementById('sgf-text');
      expect(textarea.value).toBe('test sgf content');
    });

    test('handles empty string', () => {
      controller = new UIController(state, elements);
      controller.syncSgfTextarea('');
      const textarea = document.getElementById('sgf-text');
      expect(textarea.value).toBe('');
    });
  });

  describe('integration: initialize runs without errors', () => {
    test('full initialization completes', () => {
      controller = new UIController(state, elements);
      let threw = false;
      try {
        controller.initialize();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });
});
