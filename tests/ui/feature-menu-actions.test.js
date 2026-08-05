import { FeatureMenuController } from '../../dist/ui/controllers/feature-menu-controller.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { Renderer } from '../../dist/renderer/renderer.js';
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
  const capturedEl = document.createElement('div');
  return { svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl, capturedEl };
};

const setupFeatureMenuDOM = () => {
  ['btn-feature', 'btn-feature-layout', 'btn-feature-rotate',
    'btn-feature-handicap', 'feature-copy-answer-sequence'].forEach(id => {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  });
  const featureDropdown = document.createElement('div');
  featureDropdown.id = 'feature-dropdown';
  document.body.appendChild(featureDropdown);
  const fileDropdown = document.createElement('div');
  fileDropdown.id = 'file-dropdown';
  document.body.appendChild(fileDropdown);
  const sgfText = document.createElement('textarea');
  sgfText.id = 'sgf-text';
  document.body.appendChild(sgfText);
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
  const controller = new FeatureMenuController(
    dropdownManager, renderer, elements, store, sgfService, eventBus
  );
  controller.initialize();
  return { controller, store, state, sgfService, renderer, eventBus };
};

describe('FeatureMenuController facade behavior', () => {
  let controller, store, state, elements;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    setupFeatureMenuDOM();
    const result = setupController();
    controller = result.controller;
    store = result.store;
    state = result.state;
    elements = result.controller.elements;
  });

  describe('initialize()', () => {
    test('does not throw', () => {
      let threw = false;
      try { setupController(); } catch { threw = true; }
      expect(threw).toBe(false);
    });

    test('sets up feature buttons', () => {
      const buttons = ['btn-feature', 'btn-feature-layout', 'btn-feature-rotate',
        'btn-feature-handicap', 'feature-copy-answer-sequence'];
      buttons.forEach(id => {
        expect(document.getElementById(id)).not.toBeNull();
      });
    });

    test('populates layout button text', () => {
      const layoutBtn = document.getElementById('btn-feature-layout');
      expect(layoutBtn.textContent.includes('レイアウト')).toBe(true);
    });
  });

  describe('controller accessors', () => {
    test('has store reference', () => {
      expect(controller.store).toBe(store);
    });

    test('has sgfService reference', () => {
      expect(controller.sgfService).not.toBeNull();
    });

    test('has renderer reference', () => {
      expect(controller.renderer).not.toBeNull();
    });

    test('has elements reference', () => {
      expect(controller.elements).not.toBeNull();
    });

    test('has eventBus reference', () => {
      expect(controller.eventBus).not.toBeNull();
    });
  });

  describe('updateMenuState()', () => {
    test('does not throw without copy answer button', () => {
      let threw = false;
      try { controller.updateMenuState(); } catch { threw = true; }
      expect(threw).toBe(false);
    });

    test('disables copy answer button when not in number mode', () => {
      state.numberMode = false;
      controller.updateMenuState();
      const copyBtn = document.getElementById('feature-copy-answer-sequence');
      expect(copyBtn.disabled).toBe(true);
    });

    test('disables copy answer button when sgfIndex <= numberStartIndex', () => {
      state.numberMode = true;
      state.sgfIndex = 1;
      state.numberStartIndex = 1;
      controller.updateMenuState();
      const copyBtn = document.getElementById('feature-copy-answer-sequence');
      expect(copyBtn.disabled).toBe(true);
    });

    test('enables copy answer button when in number mode with moves', () => {
      state.numberMode = true;
      state.sgfMoves = [
        { col: 4, row: 4, color: 1 },
        { col: 3, row: 3, color: 2 }
      ];
      state.sgfIndex = 2;
      state.numberStartIndex = 1;
      controller.updateMenuState();
      const copyBtn = document.getElementById('feature-copy-answer-sequence');
      expect(copyBtn.disabled).toBe(false);
    });
  });

  describe('rotateBoard()', () => {
    test('adds rotated class to svg', () => {
      controller.rotateBoard();
      expect(elements.svg.classList.contains('rotated')).toBe(true);
    });

    test('toggles rotated class on second call', () => {
      controller.rotateBoard();
      controller.rotateBoard();
      expect(elements.svg.classList.contains('rotated')).toBe(false);
    });
  });

  describe('toggleLayout()', () => {
    test('toggles horizontal class on body', () => {
      expect(document.body.classList.contains('horizontal')).toBe(false);
      const layoutBtn = document.getElementById('btn-feature-layout');
      const dropdown = document.getElementById('feature-dropdown');
      controller.toggleLayout(layoutBtn, dropdown);
      expect(document.body.classList.contains('horizontal')).toBe(true);
    });
  });
});
