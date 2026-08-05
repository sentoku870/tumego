import { ToolbarController } from '../dist/ui/controllers/toolbar-controller.js';
import { BoardCaptureService } from '../dist/services/board-capture-service.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { Renderer } from '../dist/renderer/renderer.js';
import { PreferencesStore } from '../dist/services/preferences-store.js';
import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { SGFIO } from '../dist/services/sgf-io.js';
import { SGFShare } from '../dist/services/sgf-share.js';
import { UIEventBus } from '../dist/app/event-bus.js';
import { HandicapDialog } from '../dist/ui/controllers/feature-menu/handicap-dialog.js';
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

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

describe('ToolbarController', () => {
  let store, state, renderer, boardCapture, sgfService, controller, elements, eventBus, preferences;

  beforeEach(() => {
    cleanupDOM();
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
    elements = createUIElements();
    eventBus = new UIEventBus();
    preferences = new PreferencesStore();
    renderer = new Renderer(store, elements, () => preferences.state);
    boardCapture = new BoardCaptureService(elements.svg, renderer);
    sgfService = new SGFService(new SGFParser(), store, new SGFIO(new SGFParser()), new SGFShare(new SGFParser()));
    controller = new ToolbarController(
      store,
      renderer,
      boardCapture,
      sgfService,
      elements,
      eventBus,
      preferences,
      null,
      new HandicapDialog(store, renderer, eventBus)
    );
  });

  afterEach(cleanupDOM);

  describe('disableEraseMode()', () => {
    test('does nothing when eraseMode is already false', () => {
      state.eraseMode = false;
      let threw = false;
      try {
        controller.disableEraseMode();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(state.eraseMode).toBe(false);
    });

    test('disables eraseMode when true', () => {
      state.eraseMode = true;
      const eraseBtn = document.createElement('button');
      eraseBtn.id = 'btn-erase';
      eraseBtn.classList.add('active');
      document.body.appendChild(eraseBtn);
      controller.disableEraseMode();
      expect(state.eraseMode).toBe(false);
    });

    test('removes active class from erase button', () => {
      const eraseBtn = document.createElement('button');
      eraseBtn.id = 'btn-erase';
      eraseBtn.classList.add('active');
      document.body.appendChild(eraseBtn);
      controller.initialize();
      state.eraseMode = true;
      eraseBtn.classList.add('active');
      controller.disableEraseMode();
      expect(eraseBtn.classList.contains('active')).toBe(false);
    });

    test('does not throw when erase button is not in DOM', () => {
      state.eraseMode = true;
      let threw = false;
      try {
        controller.disableEraseMode();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  describe('triggerButton()', () => {
    test('triggers click on matching element', () => {
      const btn = document.createElement('button');
      btn.id = 'test-btn';
      let clicked = false;
      btn.addEventListener('click', () => { clicked = true; });
      document.body.appendChild(btn);
      controller.triggerButton('#test-btn');
      expect(clicked).toBe(true);
    });

    test('does not throw when selector matches no element', () => {
      let threw = false;
      try {
        controller.triggerButton('#non-existent');
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  describe('updateAnswerButtonDisplay()', () => {
    test('does not throw when called without DOM elements', () => {
      let threw = false;
      try {
        controller.updateAnswerButtonDisplay();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('updates answer button text for black mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.answerMode = 'black';
      state.numberMode = false;
      controller.updateAnswerButtonDisplay();
      const isBlack = answerBtn.textContent.includes('黒');
      expect(isBlack).toBe(true);
    });

    test('updates answer button text for white mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.answerMode = 'white';
      state.numberMode = false;
      controller.updateAnswerButtonDisplay();
      const isWhite = answerBtn.textContent.includes('白');
      expect(isWhite).toBe(true);
    });

    test('adds white-mode class when answerMode is white', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.answerMode = 'white';
      controller.updateAnswerButtonDisplay();
      const hasClass = answerBtn.classList.contains('white-mode');
      expect(hasClass).toBe(true);
    });

    test('removes white-mode class when answerMode is black', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      answerBtn.classList.add('white-mode');
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.answerMode = 'black';
      controller.updateAnswerButtonDisplay();
      const hasClass = answerBtn.classList.contains('white-mode');
      expect(hasClass).toBe(false);
    });

    test('shows back-to-edit label when in number mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.numberMode = true;
      controller.updateAnswerButtonDisplay();
      const isEdit = exitSolveBtn.textContent.includes('編集');
      expect(isEdit).toBe(true);
    });

    test('shows SGF-placement label when not in number mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);
      state.numberMode = false;
      controller.updateAnswerButtonDisplay();
      const isAnswer = exitSolveBtn.textContent.includes('SGF');
      expect(isAnswer).toBe(true);
    });
  });

  describe('initialize()', () => {
    test('does not throw without DOM elements', () => {
      let threw = false;
      try {
        controller.initialize();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('sets state.mode to alt', () => {
      state.mode = 'black';
      controller.initialize();
      expect(state.mode).toBe('alt');
    });

    test('sets state.numberMode to false', () => {
      state.numberMode = true;
      controller.initialize();
      expect(state.numberMode).toBe(false);
    });

    test('sets state.eraseMode to false', () => {
      state.eraseMode = true;
      controller.initialize();
      expect(state.eraseMode).toBe(false);
    });
  });
});
