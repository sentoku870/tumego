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
        // 実DOMと同じ階層に置くため dropdown の中に追加
        dropdown.appendChild(btn);
      });
      const clear = document.createElement('button');
      clear.id = 'btn-marker-clear';
      dropdown.appendChild(clear);
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

    test('palette item sets activeMarkerKind and keeps the dropdown open for quick switching', () => {
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
      // クイック切替のためパレットは開いたまま
      expect(dropdown.classList.contains('show')).toBe(true);
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

    test('palette clear button invokes store.clearMarkers and keeps the dropdown open', () => {
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
      // 連続して別のマーカー種別を試せるようパレットは開いたまま
      expect(dropdown.classList.contains('show')).toBe(true);
    });

    test('clicking the trigger while markerMode is on only toggles the dropdown (does not disable marker mode)', () => {
      setupMarkerDOM();
      const dropdown = document.getElementById('marker-dropdown');
      // 閉じるボタンとレターボタンは dropdown の中に置く
      const closeBtn = document.createElement('button');
      closeBtn.id = 'btn-marker-close';
      dropdown.appendChild(closeBtn);
      const letterBtn = document.createElement('button');
      letterBtn.id = 'btn-marker-select-LB';
      dropdown.appendChild(letterBtn);
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      // 1) Activate marker mode by selecting a kind
      trigger.click();
      document.getElementById('btn-marker-select-CR').click();
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('CR');
      // Palette stays open after selection (quick switching)
      expect(dropdown.classList.contains('show')).toBe(true);
      // 2) Clicking the trigger again should only close the dropdown
      trigger.click();
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('CR');
      expect(dropdown.classList.contains('show')).toBe(false);
    });

    test('palette item click does NOT close the dropdown (for quick switching)', () => {
      setupMarkerDOM();
      const dropdown = document.getElementById('marker-dropdown');
      const closeBtn = document.createElement('button');
      closeBtn.id = 'btn-marker-close';
      dropdown.appendChild(closeBtn);
      const letterBtn = document.createElement('button');
      letterBtn.id = 'btn-marker-select-LB';
      dropdown.appendChild(letterBtn);
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      trigger.click();
      const trItem = document.getElementById('btn-marker-select-TR');
      trItem.click();
      expect(state.activeMarkerKind).toBe('TR');
      expect(state.markerMode).toBe(true);
      // パレットは開いたまま（クイック切替用）
      expect(dropdown.classList.contains('show')).toBe(true);
    });

    test('clicking the same active kind again toggles marker mode off', () => {
      setupMarkerDOM();
      const dropdown = document.getElementById('marker-dropdown');
      const closeBtn = document.createElement('button');
      closeBtn.id = 'btn-marker-close';
      dropdown.appendChild(closeBtn);
      const letterBtn = document.createElement('button');
      letterBtn.id = 'btn-marker-select-LB';
      dropdown.appendChild(letterBtn);
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      trigger.click();
      const sq = document.getElementById('btn-marker-select-SQ');
      sq.click();
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('SQ');
      sq.click();
      expect(state.markerMode).toBe(false);
      expect(state.activeMarkerKind).toBe(null);
    });

    test('close button hides dropdown and disables marker mode', () => {
      setupMarkerDOM();
      const dropdown = document.getElementById('marker-dropdown');
      const closeBtn = document.createElement('button');
      closeBtn.id = 'btn-marker-close';
      dropdown.appendChild(closeBtn);
      const letterBtn = document.createElement('button');
      letterBtn.id = 'btn-marker-select-LB';
      dropdown.appendChild(letterBtn);
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      trigger.click();
      document.getElementById('btn-marker-select-MA').click();
      expect(state.markerMode).toBe(true);
      // 「閉じる」でパレットを閉じてマーカー解除
      closeBtn.click();
      expect(state.markerMode).toBe(false);
      expect(state.activeMarkerKind).toBe(null);
      expect(dropdown.classList.contains('show')).toBe(false);
    });

    test('letter cycling button activates LB and advances A→B→C…on each press', () => {
      setupMarkerDOM();
      const dropdown = document.getElementById('marker-dropdown');
      const closeBtn = document.createElement('button');
      closeBtn.id = 'btn-marker-close';
      dropdown.appendChild(closeBtn);
      // 単一の cycling ボタン
      const letterBtn = document.createElement('button');
      letterBtn.id = 'btn-marker-select-LB';
      dropdown.appendChild(letterBtn);
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      trigger.click();
      const lbBtn = document.getElementById('btn-marker-select-LB');
      // 1回目: LB + A
      lbBtn.click();
      expect(state.activeMarkerKind).toBe('LB');
      expect(state.activeMarkerLabel).toBe('A');
      // 2回目: B に進む
      lbBtn.click();
      expect(state.activeMarkerLabel).toBe('B');
      // 3回目: C に進む
      lbBtn.click();
      expect(state.activeMarkerLabel).toBe('C');
      // 4回目: D に進む
      lbBtn.click();
      expect(state.activeMarkerLabel).toBe('D');
      // 5回目: E に進む
      lbBtn.click();
      expect(state.activeMarkerLabel).toBe('E');
      // 6回目: A に戻る（サイクル）
      lbBtn.click();
      expect(state.activeMarkerLabel).toBe('A');
      // パレットは開いたまま
      expect(dropdown.classList.contains('show')).toBe(true);
    });

    test('closeMarkerPalette closes the dropdown without disabling marker mode', () => {
      setupMarkerDOM();
      buttons.bindAll();
      const trigger = document.getElementById('btn-marker');
      const dropdown = document.getElementById('marker-dropdown');
      // Activate marker mode (palette closes on selection)
      trigger.click();
      document.getElementById('btn-marker-select-TR').click();
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('TR');
      // Simulate the palette being open (e.g., via external code or a test)
      dropdown.classList.add('show');
      // closeMarkerPalette should hide the palette but keep markerMode on
      buttons.closeMarkerPalette();
      expect(dropdown.classList.contains('show')).toBe(false);
      expect(state.markerMode).toBe(true);
      expect(state.activeMarkerKind).toBe('TR');
    });

    test('closeMarkerPalette is a no-op when palette is already closed', () => {
      setupMarkerDOM();
      buttons.bindAll();
      const dropdown = document.getElementById('marker-dropdown');
      expect(dropdown.classList.contains('show')).toBe(false);
      // Should not throw
      let threw = false;
      try { buttons.closeMarkerPalette(); } catch (e) { threw = true; }
      expect(threw).toBe(false);
    });
  });
});
