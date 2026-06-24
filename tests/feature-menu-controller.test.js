import './helpers/dom-setup.js';
import { FeatureMenuController } from '../dist/ui/controllers/feature-menu-controller.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { Renderer } from '../dist/renderer.js';
import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { UIInteractionState } from '../dist/ui/state/ui-interaction-state.js';
import { DropdownManager } from '../dist/ui/controllers/dropdown-manager.js';
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

const setupFeatureMenuDOM = () => {
  const featureBtn = document.createElement('button');
  featureBtn.id = 'btn-feature';
  document.body.appendChild(featureBtn);

  const featureDropdown = document.createElement('div');
  featureDropdown.id = 'feature-dropdown';
  document.body.appendChild(featureDropdown);

  const layoutBtn = document.createElement('button');
  layoutBtn.id = 'btn-feature-layout';
  document.body.appendChild(layoutBtn);

  const rotateBtn = document.createElement('button');
  rotateBtn.id = 'btn-feature-rotate';
  document.body.appendChild(rotateBtn);

  const handicapBtn = document.createElement('button');
  handicapBtn.id = 'btn-feature-handicap';
  document.body.appendChild(handicapBtn);

  const copyAnswerBtn = document.createElement('button');
  copyAnswerBtn.id = 'feature-copy-answer-sequence';
  document.body.appendChild(copyAnswerBtn);

  const sgfText = document.createElement('textarea');
  sgfText.id = 'sgf-text';
  document.body.appendChild(sgfText);

  const fileDropdown = document.createElement('div');
  fileDropdown.id = 'file-dropdown';
  document.body.appendChild(fileDropdown);

  return { featureBtn, featureDropdown, layoutBtn, rotateBtn, handicapBtn, copyAnswerBtn, sgfText, fileDropdown };
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

describe('FeatureMenuController', () => {
  let store, state, renderer, sgfService, uiState, dropdownManager, controller;

  beforeEach(() => {
    cleanupDOM();
    setupFeatureMenuDOM();
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
    const elements = createUIElements();
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
    uiState = new UIInteractionState();
    dropdownManager = new DropdownManager(uiState);
    controller = new FeatureMenuController(
      dropdownManager,
      renderer,
      elements,
      store,
      sgfService,
      () => {}
    );
  });

  afterEach(cleanupDOM);

  describe('updateMenuState()', () => {
    test('disables copy answer button when not in number mode', () => {
      state.numberMode = false;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.numberStartIndex = 0;
      state.sgfIndex = 1;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.disabled).toBe(true);
    });

    test('disables copy answer button when no answer moves', () => {
      state.numberMode = true;
      state.sgfMoves = [];
      state.numberStartIndex = 0;
      state.sgfIndex = 0;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.disabled).toBe(true);
    });

    test('disables when sgfIndex <= numberStartIndex', () => {
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.numberStartIndex = 1;
      state.sgfIndex = 1;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.disabled).toBe(true);
    });

    test('enables copy answer button when in number mode and has moves beyond start', () => {
      state.numberMode = true;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.numberStartIndex = 0;
      state.sgfIndex = 2;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.disabled).toBe(false);
    });

    test('enables when sgfIndex > numberStartIndex with moves', () => {
      state.numberMode = true;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      state.numberStartIndex = 1;
      state.sgfIndex = 3;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.disabled).toBe(false);
    });

    test('adds "disabled" class when button is disabled', () => {
      state.numberMode = false;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.classList.contains('disabled')).toBe(true);
    });

    test('removes "disabled" class when button is enabled', () => {
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.numberStartIndex = 0;
      state.sgfIndex = 1;
      controller.initialize();
      controller.updateMenuState();
      const btn = document.getElementById('feature-copy-answer-sequence');
      expect(btn.classList.contains('disabled')).toBe(false);
    });
  });
});
