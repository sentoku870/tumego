import './helpers/dom-setup.js';
import { FileMenuController } from '../dist/ui/controllers/file-menu-controller.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { Renderer } from '../dist/renderer.js';
import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { QRManager } from '../dist/qr-manager.js';
import { UIInteractionState } from '../dist/ui/state/ui-interaction-state.js';
import { DropdownManager } from '../dist/ui/controllers/dropdown-manager.js';
import { UIEventBus } from '../dist/app/event-bus.js';
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

const setupFileMenuDOM = () => {
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

  const sgfInput = document.createElement('input');
  sgfInput.id = 'sgf-input';
  sgfInput.type = 'file';
  document.body.appendChild(sgfInput);

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

  const sgfText = document.createElement('textarea');
  sgfText.id = 'sgf-text';
  document.body.appendChild(sgfText);

  const featureDropdown = document.createElement('div');
  featureDropdown.id = 'feature-dropdown';
  document.body.appendChild(featureDropdown);
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

describe('FileMenuController', () => {
  let store, state, renderer, sgfService, qrManager, uiState, dropdownManager, controller, eventBus;

  beforeEach(() => {
    cleanupDOM();
    setupFileMenuDOM();
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
    const elements = createUIElements();
    eventBus = new UIEventBus();
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
    sgfService = new SGFService(new SGFParser(), store);
    qrManager = new QRManager();
    uiState = new UIInteractionState();
    dropdownManager = new DropdownManager(uiState);
    controller = new FileMenuController(
      dropdownManager,
      sgfService,
      renderer,
      qrManager,
      store,
      eventBus
    );
  });

  afterEach(cleanupDOM);

  describe('syncHeaderEditor()', () => {
    test('populates title field from gameInfo', () => {
      state.gameInfo = {
        title: 'Test Title',
        playerBlack: 'Alice',
        playerWhite: 'Bob',
        komi: 6.5,
        result: 'B+3',
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-title').value).toBe('Test Title');
    });

    test('populates player black field from gameInfo', () => {
      state.gameInfo = {
        title: '',
        playerBlack: 'Alice',
        playerWhite: '',
        komi: 6.5,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-black').value).toBe('Alice');
    });

    test('populates player white field from gameInfo', () => {
      state.gameInfo = {
        title: '',
        playerBlack: '',
        playerWhite: 'Bob',
        komi: 6.5,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-white').value).toBe('Bob');
    });

    test('populates komi field from gameInfo', () => {
      state.gameInfo = {
        title: '',
        playerBlack: null,
        playerWhite: null,
        komi: 7.5,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-komi').value).toBe('7.5');
    });

    test('populates result field from gameInfo', () => {
      state.gameInfo = {
        title: '',
        playerBlack: null,
        playerWhite: null,
        komi: 6.5,
        result: 'W+5',
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-result').value).toBe('W+5');
    });

    test('handles null gameInfo gracefully', () => {
      state.gameInfo = null;
      let threw = false;
      try {
        controller.syncHeaderEditor();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('handles empty gameInfo fields', () => {
      state.gameInfo = {
        title: '',
        playerBlack: null,
        playerWhite: null,
        komi: 6.5,
        result: null,
        handicap: null,
        handicapStones: 0,
        handicapPositions: [],
        boardSize: 9,
        startColor: 1,
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
      };
      controller.syncHeaderEditor();
      expect(document.getElementById('header-title').value).toBe('');
    });
  });
});
