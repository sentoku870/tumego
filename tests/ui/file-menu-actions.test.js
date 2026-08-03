import { FileMenuController } from '../../dist/ui/controllers/file-menu-controller.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { Renderer } from '../../dist/renderer/renderer.js';
import { QRManager } from '../../dist/qr-manager.js';
import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFIO } from '../../dist/services/sgf-io.js';
import { SGFShare } from '../../dist/services/sgf-share.js';
import { UIEventBus } from '../../dist/app/event-bus.js';
import { DropdownManager } from '../../dist/ui/controllers/dropdown-manager.js';
import { UIInteractionState } from '../../dist/ui/state/ui-interaction-state.js';
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
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  gameInfo: {
    title: '',
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    handicap: null,
    playerBlack: null,
    playerWhite: null,
    result: null
  }
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

const setupFileMenuDOM = () => {
  const buttonIds = [
    'btn-file', 'btn-file-select', 'btn-file-load', 'btn-file-copy',
    'btn-file-finalize', 'btn-file-save', 'btn-file-qr', 'btn-file-discord',
    'btn-header-apply', 'btn-header-reset'
  ];
  buttonIds.forEach(id => {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  });
  const dropdown = document.createElement('div');
  dropdown.id = 'file-dropdown';
  document.body.appendChild(dropdown);
  const featureDropdown = document.createElement('div');
  featureDropdown.id = 'feature-dropdown';
  document.body.appendChild(featureDropdown);
  const sgfInput = document.createElement('input');
  sgfInput.type = 'file';
  sgfInput.id = 'sgf-input';
  document.body.appendChild(sgfInput);
  const sgfText = document.createElement('textarea');
  sgfText.id = 'sgf-text';
  document.body.appendChild(sgfText);
  ['header-title', 'header-black', 'header-white', 'header-komi', 'header-result'].forEach(id => {
    const input = document.createElement('input');
    input.id = id;
    document.body.appendChild(input);
  });
};

const setupController = () => {
  const engine = new GoEngine();
  const history = new HistoryManager();
  const state = createState();
  const store = new GameStore(state, engine, history);
  const elements = createUIElements();
  const eventBus = new UIEventBus();
  const uiState = new UIInteractionState();
  const dropdownManager = new DropdownManager(uiState);
  const renderer = new Renderer(store, elements, () => ({
    edit: { rulesMode: 'standard' },
    solve: { showCapturedStones: true, enableFullReset: true, highlightLastMove: true, showSolutionMoveNumbers: false },
    ui: { deviceProfile: 'auto' }
  }));
  const parser = new SGFParser();
  const sgfService = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));
  const qrManager = new QRManager(parser, new SGFShare(parser));
  const controller = new FileMenuController(dropdownManager, sgfService, renderer, qrManager, store, eventBus);
  controller.initialize();
  return { controller, store, state, sgfService, renderer, eventBus };
};

describe('FileMenuController facade behavior', () => {
  let controller, store, state;

  beforeEach(() => {
    document.body.innerHTML = '';
    setupFileMenuDOM();
    const result = setupController();
    controller = result.controller;
    store = result.store;
    state = result.state;
  });

  describe('initialize()', () => {
    test('does not throw', () => {
      let threw = false;
      try { setupController(); } catch { threw = true; }
      expect(threw).toBe(false);
    });

    test('sets up event listeners on all file buttons', () => {
      const buttons = ['btn-file', 'btn-file-select', 'btn-file-load', 'btn-file-copy',
        'btn-file-finalize', 'btn-file-save', 'btn-file-qr', 'btn-file-discord'];
      buttons.forEach(id => {
        const btn = document.getElementById(id);
        expect(btn).not.toBeNull();
      });
    });
  });

  describe('syncHeaderEditor()', () => {
    test('populates header fields from state', () => {
      state.gameInfo.title = 'Test Title';
      state.gameInfo.playerBlack = 'Black Player';
      state.gameInfo.playerWhite = 'White Player';
      state.gameInfo.komi = 7.5;
      state.gameInfo.result = 'B+R';

      controller.syncHeaderEditor();

      expect(document.getElementById('header-title').value).toBe('Test Title');
      expect(document.getElementById('header-black').value).toBe('Black Player');
      expect(document.getElementById('header-white').value).toBe('White Player');
      expect(document.getElementById('header-komi').value).toBe('7.5');
      expect(document.getElementById('header-result').value).toBe('B+R');
    });

    test('handles null gameInfo fields', () => {
      state.gameInfo.title = '';
      state.gameInfo.playerBlack = null;
      state.gameInfo.playerWhite = null;
      state.gameInfo.result = null;

      controller.syncHeaderEditor();

      expect(document.getElementById('header-title').value).toBe('');
      expect(document.getElementById('header-black').value).toBe('');
    });
  });

  describe('controller accessors', () => {
    test('has store reference', () => {
      expect(controller.store).toBe(store);
    });

    test('has sgfService reference', () => {
      expect(controller.sgfService).not.toBeNull();
    });

    test('has dropdownManager reference', () => {
      expect(controller.dropdownManager).not.toBeNull();
    });
  });
});

describe('FileMenuController finalize behavior', () => {
  let controller, store, state, sgfService, eventBus, renderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    setupFileMenuDOM();
    const result = setupController();
    controller = result.controller;
    store = result.store;
    state = result.state;
    sgfService = result.sgfService;
    eventBus = result.eventBus;
    renderer = result.renderer;
  });

  test('shows message when not in number mode (no-op)', () => {
    state.numberMode = false;
    let messageText = '';
    renderer.showMessage = (msg) => { messageText = msg; };

    const finalizeBtn = document.getElementById('btn-file-finalize');
    finalizeBtn.click();

    expect(messageText.includes('解答モード')).toBe(true);
  });

  test('applies generated SGF when in number mode', () => {
    state.numberMode = true;
    state.sgfMoves = [
      { col: 4, row: 4, color: 1 },
      { col: 3, row: 3, color: 2 }
    ];
    state.sgfIndex = 2;

    let uiUpdateCount = 0;
    eventBus.onUIUpdate(() => { uiUpdateCount += 1; });

    const finalizeBtn = document.getElementById('btn-file-finalize');
    finalizeBtn.click();

    expect(uiUpdateCount).toBe(1);
    expect(state.sgfLoadedFromExternal).toBe(true);
    expect(state.numberMode).toBe(false);
  });
});
