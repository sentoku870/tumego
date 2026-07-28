import { ToolbarButtons } from '../../dist/ui/controllers/toolbar-buttons.js';
import { Renderer } from '../../dist/renderer/renderer.js';
import { BoardCaptureService } from '../../dist/services/board-capture-service.js';
import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFIO } from '../../dist/services/sgf-io.js';
import { SGFShare } from '../../dist/services/sgf-share.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { UIEventBus } from '../../dist/app/event-bus.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';
import { DropdownManager } from '../../dist/ui/controllers/dropdown-manager.js';
import { UIInteractionState } from '../../dist/ui/state/ui-interaction-state.js';

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

describe('ToolbarButtons', () => {
  let store;
  let state;
  let renderer;
  let eventBus;
  let buttons;

  beforeEach(() => {
    document.body.innerHTML = '';
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
    const boardCapture = new BoardCaptureService(elements.svg, renderer);
    const sgfParser = new SGFParser();
    const sgfService = new SGFService(sgfParser, store, new SGFIO(sgfParser), new SGFShare(sgfParser));
    const uiState = new UIInteractionState();
    const dropdownManager = new DropdownManager(uiState);
    buttons = new ToolbarButtons(store, renderer, boardCapture, sgfService, elements, eventBus, dropdownManager);
  });

  afterEach(() => {
    buttons.dispose();
  });

  describe('ensureButtonRefs', () => {
    test('populates all button refs from DOM ids', () => {
      ['btn-clear', 'btn-problem', 'btn-answer', 'btn-prev-move', 'btn-next-move',
       'btn-black', 'btn-white', 'btn-erase', 'btn-alt', 'btn-undo', 'btn-exit-solve-edit']
        .forEach((id) => {
          const btn = document.createElement('button');
          btn.id = id;
          document.body.appendChild(btn);
        });
      buttons.ensureButtonRefs();
      expect(buttons.clearBtn?.id).toBe('btn-clear');
      expect(buttons.problemBtn?.id).toBe('btn-problem');
      expect(buttons.answerBtn?.id).toBe('btn-answer');
      expect(buttons.prevMoveBtn?.id).toBe('btn-prev-move');
      expect(buttons.nextMoveBtn?.id).toBe('btn-next-move');
      expect(buttons.blackBtn?.id).toBe('btn-black');
      expect(buttons.whiteBtn?.id).toBe('btn-white');
      expect(buttons.eraseBtn?.id).toBe('btn-erase');
      expect(buttons.altBtn?.id).toBe('btn-alt');
      expect(buttons.undoBtn?.id).toBe('btn-undo');
      expect(buttons.exitSolveBtn?.id).toBe('btn-exit-solve-edit');
    });

    test('leaves existing refs untouched when already set', () => {
      const pre = document.createElement('button');
      pre.id = 'btn-clear';
      document.body.appendChild(pre);
      buttons.clearBtn = pre;
      buttons.ensureButtonRefs();
      expect(buttons.clearBtn).toBe(pre);
    });
  });

  describe('bindAll', () => {
    test('resets state to alt mode, numberMode=false, eraseMode=false', () => {
      state.mode = 'white';
      state.numberMode = true;
      state.eraseMode = true;
      buttons.bindAll();
      expect(state.mode).toBe('alt');
      expect(state.numberMode).toBe(false);
      expect(state.eraseMode).toBe(false);
    });
  });

  describe('triggerButton', () => {
    test('invokes click on a matching element', () => {
      const btn = document.createElement('button');
      btn.id = 'btn-test-trigger';
      let clicked = 0;
      btn.addEventListener('click', () => { clicked++; });
      document.body.appendChild(btn);
      buttons.triggerButton('#btn-test-trigger');
      expect(clicked).toBe(1);
    });

    test('does not throw when selector matches no element', () => {
      let threw = false;
      try { buttons.triggerButton('#does-not-exist'); } catch (e) { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('dispose', () => {
    test('is idempotent', () => {
      buttons.dispose();
      let threw = false;
      try { buttons.dispose(); } catch (e) { threw = true; }
      expect(threw).toBe(false);
    });
  });

  describe('問題図ボタン (SGF テキスト欄更新)', () => {
    test('問題図確定時に sgf-text の textarea が現在状態で更新される (Issue 5 fix)', () => {
      const sgfTextarea = document.createElement('textarea');
      sgfTextarea.id = 'sgf-text';
      document.body.appendChild(sgfTextarea);

      const problemBtn = document.createElement('button');
      problemBtn.id = 'btn-problem';
      document.body.appendChild(problemBtn);

      state.board[0][0] = 1;
      state.board[1][1] = 2;
      buttons.bindAll();

      problemBtn.click();

      // sgfService.export() の結果が textarea に反映される
      expect(sgfTextarea.value).toContain('AB[aa]');
      expect(sgfTextarea.value).toContain('AW[bb]');
    });
  });

  describe('マーカー統合ボタン (palette)', () => {
    const setupMarkerDOM = () => {
      const trigger = document.createElement('button');
      trigger.id = 'btn-marker';
      document.body.appendChild(trigger);
      const dropdown = document.createElement('div');
      dropdown.id = 'marker-dropdown';
      document.body.appendChild(dropdown);
      ['CR', 'TR', 'SQ', 'MA'].forEach((kind) => {
        const btn = document.createElement('button');
        btn.id = `btn-marker-select-${kind}`;
        document.body.appendChild(btn);
      });
      const clear = document.createElement('button');
      clear.id = 'btn-marker-clear';
      document.body.appendChild(clear);
    };

    test('trigger button toggles the marker dropdown', () => {
      setupMarkerDOM();
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      const dropdown = document.getElementById('marker-dropdown');
      expect(dropdown.classList.contains('show')).toBe(false);
      trigger.click();
      expect(dropdown.classList.contains('show')).toBe(true);
      trigger.click();
      expect(dropdown.classList.contains('show')).toBe(false);
    });

    test('palette item sets activeMarkerKind and closes the dropdown', () => {
      setupMarkerDOM();
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      const dropdown = document.getElementById('marker-dropdown');
      trigger.click();
      expect(dropdown.classList.contains('show')).toBe(true);
      const trItem = document.getElementById('btn-marker-select-TR');
      trItem.click();
      expect(state.activeMarkerKind).toBe('TR');
      expect(state.markerMode).toBe(true);
      expect(dropdown.classList.contains('show')).toBe(false);
    });

    test('setActiveMarkerButton updates trigger label and palette active class', () => {
      setupMarkerDOM();
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      const crItem = document.getElementById('btn-marker-select-CR');
      state.activeMarkerKind = 'CR';
      buttons.setActiveMarkerButton();
      expect(trigger.classList.contains('active')).toBe(true);
      expect(trigger.textContent).toContain('○');
      expect(crItem.classList.contains('active')).toBe(true);
      state.activeMarkerKind = null;
      buttons.setActiveMarkerButton();
      expect(trigger.classList.contains('active')).toBe(false);
    });

    test('palette clear button invokes store.clearMarkers and closes the dropdown', () => {
      setupMarkerDOM();
      buttons.bindAll();
      state.markers = [
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'TR' },
      ];
      const trigger = document.getElementById('btn-marker');
      const dropdown = document.getElementById('marker-dropdown');
      trigger.click();
      document.getElementById('btn-marker-clear').click();
      expect(state.markers).toEqual([]);
      expect(dropdown.classList.contains('show')).toBe(false);
    });
  });
});
