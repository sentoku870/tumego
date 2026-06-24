import { ToolbarState } from '../../dist/ui/controllers/toolbar-state.js';
import { ToolbarButtons } from '../../dist/ui/controllers/toolbar-buttons.js';
import { Renderer } from '../../dist/renderer/renderer.js';
import { BoardCaptureService } from '../../dist/services/board-capture-service.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { UIEventBus } from '../../dist/app/event-bus.js';
import { PreferencesStore } from '../../dist/services/preferences-store.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

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
  ...overrides,
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

describe('ToolbarState', () => {
  let store, state, renderer, eventBus, preferences, buttons, stateCtl;

  beforeEach(() => {
    document.body.innerHTML = '';
    ['btn-clear', 'btn-problem', 'btn-answer', 'btn-undo', 'btn-exit-solve-edit',
     'btn-erase', 'btn-alt', 'btn-black', 'btn-white', 'btn-prev-move', 'btn-next-move']
      .forEach((id) => {
        const btn = document.createElement('button');
        btn.id = id;
        document.body.appendChild(btn);
      });

    state = createState();
    store = new GameStore(state, new GoEngine(), new HistoryManager());
    const elements = createUIElements();
    renderer = new Renderer(store, elements, () => ({
      edit: { rulesMode: 'standard' },
      solve: {
        showCapturedStones: true,
        enableFullReset: true,
        highlightLastMove: true,
        showSolutionMoveNumbers: false,
      },
      ui: { deviceProfile: 'auto' },
    }));
    eventBus = new UIEventBus();
    preferences = new PreferencesStore();
    const boardCapture = new BoardCaptureService(elements.svg, renderer);
    buttons = new ToolbarButtons(store, renderer, boardCapture, elements, eventBus);
    stateCtl = new ToolbarState(store, renderer, preferences, eventBus, buttons);
  });

  describe('disableEraseMode', () => {
    test('turns off erase mode and clears active class', () => {
      state.eraseMode = true;
      buttons.eraseBtn?.classList.add('active');
      stateCtl.disableEraseMode();
      if (state.eraseMode !== false) throw new Error(`expected false, got ${state.eraseMode}`);
      if (buttons.eraseBtn?.classList.contains('active')) throw new Error('active class still present');
    });

    test('does nothing when erase mode is already off', () => {
      state.eraseMode = false;
      const before = state.turn;
      stateCtl.disableEraseMode();
      if (state.eraseMode !== false) throw new Error(`expected false, got ${state.eraseMode}`);
      if (state.turn !== before) throw new Error('turn changed');
    });
  });

  describe('updateAnswerButtonDisplay', () => {
    test('shows 白先 when answerMode is white', () => {
      state.answerMode = 'white';
      stateCtl.updateAnswerButtonDisplay();
      expect(buttons.answerBtn?.textContent).toBe('⚪ 白先');
      expect(buttons.answerBtn?.classList.contains('white-mode')).toBe(true);
    });

    test('shows 黒先 when answerMode is black', () => {
      state.answerMode = 'black';
      stateCtl.updateAnswerButtonDisplay();
      expect(buttons.answerBtn?.textContent).toBe('🔥 黒先');
      expect(buttons.answerBtn?.classList.contains('white-mode')).toBe(false);
    });

    test('switches exit button label based on numberMode', () => {
      state.numberMode = true;
      stateCtl.updateAnswerButtonDisplay();
      expect(buttons.exitSolveBtn?.textContent).toBe('編集に戻る');
      state.numberMode = false;
      stateCtl.updateAnswerButtonDisplay();
      expect(buttons.exitSolveBtn?.textContent).toBe('解答開始');
    });
  });

  describe('updateToolbarState', () => {
    test('disables solve-only buttons in edit mode', () => {
      state.numberMode = false;
      stateCtl.updateToolbarState();
      expect(buttons.eraseBtn?.disabled).toBe(false);
      expect(buttons.altBtn?.disabled).toBe(false);
      expect(buttons.blackBtn?.disabled).toBe(false);
      expect(buttons.whiteBtn?.disabled).toBe(false);
      expect(buttons.answerBtn?.disabled).toBe(true);
    });

    test('disables edit-only buttons in solve mode', () => {
      state.numberMode = true;
      stateCtl.updateToolbarState();
      expect(buttons.eraseBtn?.disabled).toBe(true);
      expect(buttons.altBtn?.disabled).toBe(true);
      expect(buttons.blackBtn?.disabled).toBe(true);
      expect(buttons.whiteBtn?.disabled).toBe(true);
      expect(buttons.answerBtn?.disabled).toBe(false);
    });

    test('disables undo when no history snapshots', () => {
      state.numberMode = false;
      stateCtl.updateToolbarState();
      expect(buttons.undoBtn?.disabled).toBe(true);
    });

    test('disables prev/next move buttons based on sgfIndex', () => {
      state.numberMode = true;
      state.sgfIndex = 0;
      state.sgfMoves = [];
      stateCtl.updateToolbarState();
      expect(buttons.prevMoveBtn?.disabled).toBe(true);
      expect(buttons.nextMoveBtn?.disabled).toBe(true);

      state.sgfIndex = 1;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      stateCtl.updateToolbarState();
      expect(buttons.prevMoveBtn?.disabled).toBe(false);
      expect(buttons.nextMoveBtn?.disabled).toBe(true);
    });
  });

  describe('updateFullResetVisibility', () => {
    test('enables clear button in edit mode', () => {
      state.numberMode = false;
      stateCtl.updateFullResetVisibility();
      expect(buttons.clearBtn?.disabled).toBe(false);
    });

    test('respects enableFullReset preference in solve mode', () => {
      state.numberMode = true;
      // enableFullReset default is true
      stateCtl.updateFullResetVisibility();
      expect(buttons.clearBtn?.disabled).toBe(false);
    });
  });
});
