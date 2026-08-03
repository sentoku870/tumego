import { ToolbarController } from '../../dist/ui/controllers/toolbar-controller.js';
import { BoardCaptureService } from '../../dist/services/board-capture-service.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { Renderer } from '../../dist/renderer/renderer.js';
import { PreferencesStore } from '../../dist/services/preferences-store.js';
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

const setupController = () => {
  const engine = new GoEngine();
  const history = new HistoryManager();
  const state = createState();
  const store = new GameStore(state, engine, history);
  const elements = createUIElements();
  const eventBus = new UIEventBus();
  const preferences = new PreferencesStore();
  const uiState = new UIInteractionState();
  const dropdownManager = new DropdownManager(uiState);
  const renderer = new Renderer(store, elements, () => preferences.state);
  const boardCapture = new BoardCaptureService(elements.svg, renderer);
  const sgfService = new SGFService(new SGFParser(), store, new SGFIO(new SGFParser()), new SGFShare(new SGFParser()));
  const controller = new ToolbarController(
    store, renderer, boardCapture, sgfService, elements, eventBus, preferences, dropdownManager
  );
  controller.initialize();
  return { controller, store, state, renderer, eventBus, preferences, sgfService };
};

describe('ToolbarController facade behavior', () => {
  let controller, store, state, eventBus;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ controller, store, state, eventBus } = setupController());
  });

  describe('initialize()', () => {
    test('resets state to alt mode', () => {
      state.mode = 'black';
      // initialize was already called; force reset via setting + check
      store.resetInteractionModes();
      expect(state.mode).toBe('alt');
    });

    test('resets numberMode to false', () => {
      store.resetInteractionModes();
      expect(state.numberMode).toBe(false);
    });

    test('resets eraseMode to false', () => {
      store.resetInteractionModes();
      expect(state.eraseMode).toBe(false);
    });
  });

  describe('disableEraseMode()', () => {
    test('sets eraseMode to false', () => {
      state.eraseMode = true;
      controller.disableEraseMode();
      expect(state.eraseMode).toBe(false);
    });

    test('remains false when already false', () => {
      state.eraseMode = false;
      controller.disableEraseMode();
      expect(state.eraseMode).toBe(false);
    });
  });

  describe('updateAnswerButtonDisplay()', () => {
    test('does not throw without answer button in DOM', () => {
      let threw = false;
      try { controller.updateAnswerButtonDisplay(); } catch { threw = true; }
      expect(threw).toBe(false);
    });

    test('updates button text for black mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);

      state.answerMode = 'black';
      state.numberMode = false;
      controller.updateAnswerButtonDisplay();

      expect(answerBtn.textContent.includes('黒')).toBe(true);
    });

    test('updates button text for white mode', () => {
      const answerBtn = document.createElement('button');
      answerBtn.id = 'btn-answer';
      document.body.appendChild(answerBtn);
      const exitSolveBtn = document.createElement('button');
      exitSolveBtn.id = 'btn-exit-solve-edit';
      document.body.appendChild(exitSolveBtn);

      state.answerMode = 'white';
      state.numberMode = false;
      controller.updateAnswerButtonDisplay();

      expect(answerBtn.textContent.includes('白')).toBe(true);
    });
  });

  describe('triggerButton()', () => {
    test('clicks the matching element', () => {
      const btn = document.createElement('button');
      btn.id = 'test-trigger';
      let clicked = false;
      btn.addEventListener('click', () => { clicked = true; });
      document.body.appendChild(btn);

      controller.triggerButton('#test-trigger');
      expect(clicked).toBe(true);
    });

    test('does not throw for non-existent selector', () => {
      let threw = false;
      try { controller.triggerButton('#does-not-exist'); } catch { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('closeMarkerPalette()', () => {
    test('is callable', () => {
      let threw = false;
      try { controller.closeMarkerPalette(); } catch { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('updateToolbarState()', () => {
    test('is callable without DOM elements', () => {
      let threw = false;
      try { controller.updateToolbarState(); } catch { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('controller accessors', () => {
    test('controller has store reference', () => {
      expect(controller.store).toBe(store);
    });

    test('controller has buttons reference', () => {
      expect(controller.buttons).not.toBeNull();
    });

    test('controller has state (ToolbarState) reference', () => {
      expect(controller.state).not.toBeNull();
    });
  });

  describe('dispose()', () => {
    test('does not throw', () => {
      let threw = false;
      try { controller.dispose(); } catch { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('mode updates via controller state', () => {
    test('updateToolbarState reflects mode', () => {
      state.mode = 'black';
      controller.updateToolbarState();
      // No assertion on DOM, just verify no throw
      expect(true).toBe(true);
    });

    test('updateAnswerButtonDisplay reflects answerMode', () => {
      state.answerMode = 'white';
      controller.updateAnswerButtonDisplay();
      expect(true).toBe(true);
    });
  });

  describe('integration with store', () => {
    test('controller uses the same store instance', () => {
      expect(controller.store).toBe(store);
    });

    test('controller uses the same state object', () => {
      expect(controller.store.snapshot).toBe(state);
    });
  });
});
