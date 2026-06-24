import './helpers/dom-setup.js';
import { compositionRoot } from '../dist/app/composition-root.js';
import { UIEventBus } from '../dist/app/event-bus.js';
import { GameStore } from '../dist/state/game-store.js';
import { Renderer } from '../dist/renderer.js';
import { SGFService } from '../dist/services/sgf-service.js';
import { PreferencesStore } from '../dist/services/preferences-store.js';
import { QRManager } from '../dist/qr-manager.js';
import { BoardCaptureService } from '../dist/services/board-capture-service.js';
import { DropdownManager } from '../dist/ui/controllers/dropdown-manager.js';
import { BoardInteractionController } from '../dist/ui/controllers/board-interaction-controller.js';
import { ToolbarController } from '../dist/ui/controllers/toolbar-controller.js';
import { FeatureMenuController } from '../dist/ui/controllers/feature-menu-controller.js';
import { FileMenuController } from '../dist/ui/controllers/file-menu-controller.js';
import { SettingsController } from '../dist/ui/controllers/settings-controller.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

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
  gameTree: null,
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
  return { svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl };
};

const setupAllDOM = () => {
  ['btn-clear', 'btn-problem', 'btn-answer', 'btn-prev-move', 'btn-next-move',
   'btn-black', 'btn-white', 'btn-erase', 'btn-alt', 'btn-undo', 'btn-exit-solve-edit',
   'btn-file', 'btn-feature', 'btn-file-select', 'btn-file-load', 'btn-file-copy',
   'btn-file-save', 'btn-file-qr', 'btn-file-discord', 'btn-feature-layout',
   'btn-feature-rotate', 'btn-feature-handicap', 'feature-copy-answer-sequence',
   'btn-save-board', 'settings-toggle', 'btn-header-apply', 'btn-header-reset'].forEach((id) => {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  });
  ['file-dropdown', 'feature-dropdown', 'settings-panel', 'sgf-input', 'sgf-text'].forEach((id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  });
  ['9', '13', '19'].forEach((size) => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.dataset.size = size;
    document.body.appendChild(btn);
  });
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

const makeCounter = () => {
  let count = 0;
  const fn = () => { count += 1; };
  fn.count = () => count;
  return fn;
};

const isInstanceOf = (value, ctor) => value instanceof ctor;

const expectNoThrow = (fn) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

describe('compositionRoot()', () => {
  beforeEach(() => {
    cleanupDOM();
    setupAllDOM();
  });
  afterEach(cleanupDOM);

  test('returns an AppContext with all services and controllers', () => {
    const app = compositionRoot(createState(), createUIElements());
    expect(isInstanceOf(app.store, GameStore)).toBe(true);
    expect(isInstanceOf(app.renderer, Renderer)).toBe(true);
    expect(isInstanceOf(app.sgfService, SGFService)).toBe(true);
    expect(isInstanceOf(app.preferences, PreferencesStore)).toBe(true);
    expect(isInstanceOf(app.qrManager, QRManager)).toBe(true);
    expect(isInstanceOf(app.boardCapture, BoardCaptureService)).toBe(true);
    expect(isInstanceOf(app.dropdownManager, DropdownManager)).toBe(true);
    expect(isInstanceOf(app.eventBus, UIEventBus)).toBe(true);
    expect(isInstanceOf(app.controllers.board, BoardInteractionController)).toBe(true);
    expect(isInstanceOf(app.controllers.toolbar, ToolbarController)).toBe(true);
    expect(isInstanceOf(app.controllers.feature, FeatureMenuController)).toBe(true);
    expect(isInstanceOf(app.controllers.file, FileMenuController)).toBe(true);
    expect(isInstanceOf(app.controllers.settings, SettingsController)).toBe(true);
  });

  test('produces independent instances on repeated calls', () => {
    const a = compositionRoot(createState(), createUIElements());
    const b = compositionRoot(createState(), createUIElements());
    expect(a.store === b.store).toBe(false);
    expect(a.eventBus === b.eventBus).toBe(false);
    expect(a.controllers.toolbar === b.controllers.toolbar).toBe(false);
  });

  test('shared eventBus delivers UIUpdate events to listeners', () => {
    const app = compositionRoot(createState(), createUIElements());
    const counter = makeCounter();
    app.eventBus.onUIUpdate(counter);
    app.eventBus.emitUIUpdate();
    expect(counter.count()).toBe(1);
  });

  test('UIEventBus subscription returns an unsubscribe function', () => {
    const app = compositionRoot(createState(), createUIElements());
    const counter = makeCounter();
    const unsubscribe = app.eventBus.onUIUpdate(counter);
    app.eventBus.emitUIUpdate();
    expect(counter.count()).toBe(1);
    unsubscribe();
    app.eventBus.emitUIUpdate();
    expect(counter.count()).toBe(1);
  });

  test('all five controllers initialize without throwing', () => {
    const app = compositionRoot(createState(), createUIElements());
    expect(expectNoThrow(() => app.controllers.board.initialize())).toBe(true);
    expect(expectNoThrow(() => app.controllers.toolbar.initialize())).toBe(true);
    expect(expectNoThrow(() => app.controllers.feature.initialize())).toBe(true);
    expect(expectNoThrow(() => app.controllers.file.initialize())).toBe(true);
    expect(expectNoThrow(() => app.controllers.settings.initialize())).toBe(true);
  });

  test('emits eraseModeDisable when bus is triggered', () => {
    const app = compositionRoot(createState(), createUIElements());
    const counter = makeCounter();
    app.eventBus.onEraseModeDisable(counter);
    app.eventBus.emitEraseModeDisable();
    expect(counter.count()).toBe(1);
  });

  test('SGF applied event delivers payload text to listeners', () => {
    const app = compositionRoot(createState(), createUIElements());
    let received = null;
    app.eventBus.onSgfApplied((text) => { received = text; });
    app.eventBus.emitSgfApplied('(;SZ[9])');
    expect(received).toBe('(;SZ[9])');
  });
});
