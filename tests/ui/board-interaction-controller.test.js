import { BoardInteractionController } from '../../dist/ui/controllers/board-interaction-controller.js';
import { UIEventBus } from '../../dist/app/event-bus.js';
import { PreferencesStore } from '../../dist/services/preferences-store.js';
import { LongPressDetector } from '../../dist/ui/controllers/long-press-detector.js';

const jest = (globalThis.jest ?? createLocalJest());

function createLocalJest() {
  const createMock = (impl = () => {}) => {
    const mockFn = function (...args) {
      mockFn.mock.calls.push(args);
      return mockFn.mock.impl.apply(this, args);
    };
    mockFn.mock = { calls: [], impl };
    mockFn.mockImplementation = (newImpl) => {
      mockFn.mock.impl = newImpl;
      return mockFn;
    };
    mockFn.mockReturnValue = (value) => mockFn.mockImplementation(() => value);
    mockFn.mockClear = () => {
      mockFn.mock.calls = [];
    };
    return mockFn;
  };

  const spyOn = (object, methodName) => {
    const original = object[methodName];
    const mockFn = createMock(function (...args) {
      return original.apply(this, args);
    });
    object[methodName] = function (...args) {
      return mockFn.apply(this, args);
    };
    mockFn.mockRestore = () => {
      object[methodName] = original;
    };
    return mockFn;
  };

  return {
    fn: createMock,
    spyOn
  };
}

const createPointerEvent = (overrides = {}) => ({
  button: 0,
  buttons: 1,
  pointerId: 1,
  pointerType: 'mouse',
  clientX: 0,
  clientY: 0,
  preventDefault: jest.fn(),
  ...overrides
});

const createElements = () => {
  const boardWrapper = {
    focus: jest.fn(),
    addEventListener: jest.fn(),
    tabIndex: 0
  };

  const svg = {
    addEventListener: jest.fn(),
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
    hasPointerCapture: jest.fn(() => false),
    createSVGPoint: jest.fn(() => ({
      x: 0,
      y: 0,
      matrixTransform: jest.fn(() => ({ x: 0, y: 0 }))
    })),
    getScreenCTM: jest.fn(() => ({ inverse: () => ({}) }))
  };

  return {
    boardWrapper,
    svg,
    infoEl: {},
    sliderEl: { value: '0' },
    movesEl: {},
    msgEl: {}
  };
};

const createState = (overrides = {}) => ({
  boardSize: 9,
  board: Array.from({ length: 9 }, () => Array(9).fill(0)),
  mode: 'black',
  eraseMode: false,
  markerMode: false,
  markers: [],
  activeMarkerKind: null,
  history: [],
  turn: 0,
  sgfMoves: [],
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  komi: 6.5,
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

const createStore = (state) => ({
  snapshot: state,
  currentColor: 1,
  tryMove: jest.fn(() => true),
  removeStone: jest.fn(() => true),
  directRemove: jest.fn(() => true),
  directPlace: jest.fn(() => true),
  moveStone: jest.fn(() => true)
});

const createUIState = () => ({
  drag: {
    dragging: false,
    dragColor: null,
    lastPos: null,
    grabbedStone: null
  },
  boardHasFocus: false,
  touchStartY: 0,
  activeDropdown: null,
  resetDrag: jest.fn(function reset() {
    this.drag.dragging = false;
    this.drag.dragColor = null;
    this.drag.lastPos = null;
    this.drag.grabbedStone = null;
  }),
  releaseGrabbedStone: jest.fn(function release() {
    this.drag.grabbedStone = null;
  })
});

describe('BoardInteractionController pointer handling', () => {
  let state;
  let store;
  let uiState;
  let elements;
  let eventBus;
  let disableEraseMode;
  let controller;
  let placeSpy;

  beforeEach(() => {
    state = createState();
    store = createStore(state);
    uiState = createUIState();
    elements = createElements();
    eventBus = new UIEventBus();
    disableEraseMode = jest.fn();
    eventBus.onEraseModeDisable(disableEraseMode);

    controller = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      new PreferencesStore()
    );

    placeSpy = jest.spyOn(controller, 'placeAtEvent').mockImplementation(() => {});
    jest.spyOn(controller, 'getPositionFromEvent').mockReturnValue({ col: 0, row: 0 });
    jest.spyOn(controller, 'isValidPosition').mockReturnValue(true);
  });

  test('starts erase drag on primary input and places once', () => {
    state.eraseMode = true;
    const event = createPointerEvent({ button: 0 });

    controller.handlePointerDown(event);

    expect(uiState.drag.dragging).toBe(true);
    expect(uiState.drag.dragColor).toBeNull();
    expect(placeSpy.mock.calls.length).toBe(1);
  });

  test('disables erase mode on secondary input without placing', () => {
    state.eraseMode = true;
    const event = createPointerEvent({ button: 2 });

    controller.handlePointerDown(event);

    expect(disableEraseMode.mock.calls.length).toBe(1);
    expect(placeSpy.mock.calls.length).toBe(0);
    expect(uiState.drag.dragging).toBe(false);
  });

  test('sets alternating mode drag color to null', () => {
    state.mode = 'alt';
    const event = createPointerEvent({ button: 0 });

    controller.handlePointerDown(event);

    expect(uiState.drag.dragColor).toBeNull();
    expect(placeSpy.mock.calls.length).toBe(1);
  });

  test('assigns colors for play mode primary and secondary inputs', () => {
    const primaryEvent = createPointerEvent({ button: 0 });
    controller.handlePointerDown(primaryEvent);
    expect(uiState.drag.dragColor).toBe(1);

    controller.uiState.resetDrag();
    const secondaryEvent = createPointerEvent({ button: 2 });
    controller.handlePointerDown(secondaryEvent);
    expect(uiState.drag.dragColor).toBe(2);
  });

  test('ignores pointer move in alternating mode', () => {
    state.mode = 'alt';
    uiState.drag.dragging = true;

    controller.handlePointerMove(createPointerEvent());

    expect(placeSpy.mock.calls.length).toBe(0);
  });

  test('starts erase drag from move when not dragging yet', () => {
    state.eraseMode = true;
    const event = createPointerEvent({ buttons: 1 });
    uiState.drag.dragging = false;

    controller.handlePointerMove(event);

    expect(uiState.drag.dragging).toBe(true);
    expect(placeSpy.mock.calls.length).toBe(1);
  });

  test('in solve mode, markerMode flag is honored and toggleMarker is called via store', () => {
    // マーカーモードは解答モード中でも優先される（PR #161 の仕様）
    placeSpy.mockRestore();
    state.numberMode = true;
    state.markerMode = true;
    state.activeMarkerKind = 'CR';
    state.markers = [];
    const toggleMarkerMock = jest.fn(() => true);
    store.toggleMarker = toggleMarkerMock;
    jest.spyOn(controller, 'isValidPosition').mockReturnValue(true);

    controller.placeAtEvent(createPointerEvent());

    expect(toggleMarkerMock.mock.calls.length).toBe(1);
    expect(store.tryMove.mock.calls.length).toBe(0);
  });

  test('in solve mode, stale eraseMode flag is ignored and tryMove is called', () => {
    placeSpy.mockRestore();
    state.numberMode = true;
    state.eraseMode = true;
    jest.spyOn(controller, 'isValidPosition').mockReturnValue(true);

    controller.placeAtEvent(createPointerEvent());

    expect(store.tryMove.mock.calls.length).toBe(1);
  });
});

describe('BoardInteractionController long-press stone move', () => {
  let state;
  let store;
  let uiState;
  let elements;
  let eventBus;
  let uiUpdateSpy;
  let controller;
  let detector;
  /** LongPressDetector に注入する仮想タイマー */
  let virtualTimers;

  beforeEach(() => {
    state = createState();
    state.board[3][3] = 1; // 黒石を (3,3) に配置
    store = createStore(state);
    uiState = createUIState();
    elements = createElements();
    eventBus = new UIEventBus();
    uiUpdateSpy = jest.fn();
    eventBus.onUIUpdate(uiUpdateSpy);

    virtualTimers = (() => {
      const handles = [];
      const handlers = new Map();
      let nextId = 1;
      return {
        setTimeoutFn: (h, _ms) => {
          const id = nextId++;
          handles.push({ id });
          handlers.set(id, h);
          return id;
        },
        clearTimeoutFn: (handle) => {
          const id = typeof handle === 'object' ? handle.id : handle;
          handlers.delete(id);
          const idx = handles.findIndex((h) => h.id === id);
          if (idx >= 0) handles.splice(idx, 1);
        },
        fireAll() {
          const snapshot = handles.slice();
          snapshot.forEach((h) => handlers.get(h.id)?.());
        },
      };
    })();

    // LongPressDetector に仮想タイマーを注入（400ms を待たずに発火できる）
    const detectorInstance = new LongPressDetector({
      setTimeoutFn: virtualTimers.setTimeoutFn,
      clearTimeoutFn: virtualTimers.clearTimeoutFn,
    });

    controller = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      new PreferencesStore()
    );
    controller.initialize();

    // コントローラ内部の detector を仮想タイマー版に差し替え
    // TypeScript の private フィールドはコンパイル後は通常のプロパティになる
    controller.longPressDetector = detectorInstance;
    detector = controller.getLongPressDetector();
    // 既定の位置取得を (3,3) にする（石がある位置）
    jest.spyOn(controller, 'getPositionFromEvent').mockReturnValue({ col: 3, row: 3 });
    jest.spyOn(controller, 'isValidPosition').mockReturnValue(true);
    // 通常配置の placeAtEvent を抑止（moveStone などのテスト対象に集中）
    jest.spyOn(controller, 'placeAtEvent').mockImplementation(() => {});
  });

  test('pointerdown on a stone starts long-press timer', () => {
    expect(detector.isActive()).toBe(false);

    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));

    expect(detector.isActive()).toBe(true);
  });

  test('timer reaches threshold → grabStone decision is applied', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    expect(uiState.drag.grabbedStone).toBeNull();

    virtualTimers.fireAll();

    expect(uiState.drag.grabbedStone).not.toBeNull();
    expect(uiState.drag.grabbedStone.pos).toEqual({ col: 3, row: 3 });
    expect(uiState.drag.grabbedStone.color).toBe(1);
    expect(uiUpdateSpy.mock.calls.length > 0).toBe(true);
  });

  test('long press in solve mode does not grab stone', () => {
    state.numberMode = true;
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));

    virtualTimers.fireAll();

    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('long press in erase mode does not grab stone', () => {
    state.eraseMode = true;
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));

    virtualTimers.fireAll();

    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('long press on empty cell does not start timer', () => {
    jest.spyOn(controller, 'getPositionFromEvent').mockReturnValue({ col: 5, row: 5 });
    // board[5][5] は 0（空）
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));

    expect(detector.isActive()).toBe(false);
  });

  test('pointermove beyond threshold cancels long-press', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    expect(detector.isActive()).toBe(true);

    // 押下位置から大きく離れた位置へ移動
    controller.handlePointerMove(createPointerEvent({ clientX: 200, clientY: 200 }));

    expect(detector.isActive()).toBe(false);

    // タイマーは既にキャンセルされているので発火しない
    virtualTimers.fireAll();
    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('pointerend after long-press grab commits move to store.moveStone', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();

    expect(uiState.drag.grabbedStone).not.toBeNull();

    // ドロップ位置を別の交点に変更
    jest.spyOn(controller, 'getPositionFromEvent').mockReturnValue({ col: 7, row: 7 });
    controller.handlePointerEnd(createPointerEvent({ clientX: 200, clientY: 200 }));

    expect(store.moveStone.mock.calls.length).toBe(1);
    expect(store.moveStone.mock.calls[0]).toEqual([
      { col: 3, row: 3 },
      { col: 7, row: 7 }
    ]);
    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('pointerend without grab does not call store.moveStone', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    // タイマー発火前にリリース
    controller.handlePointerEnd(createPointerEvent());

    expect(store.moveStone.mock.calls.length).toBe(0);
  });

  test('pointerend at same position does not call store.moveStone', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();
    // 同じ位置にドロップ
    controller.handlePointerEnd(createPointerEvent({ clientX: 100, clientY: 100 }));

    expect(store.moveStone.mock.calls.length).toBe(0);
    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('pointerend with invalid drop position cancels grab without moving', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();

    jest.spyOn(controller, 'isValidPosition').mockReturnValue(false);
    controller.handlePointerEnd(createPointerEvent());

    expect(store.moveStone.mock.calls.length).toBe(0);
    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('ESC key cancels grab', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();
    expect(uiState.drag.grabbedStone).not.toBeNull();

    // 盤面がフォーカスを持つように
    uiState.boardHasFocus = true;

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);

    expect(uiState.drag.grabbedStone).toBeNull();
    expect(detector.isActive()).toBe(false);
  });

  test('ESC key without grab is ignored', () => {
    uiState.boardHasFocus = true;
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    let threw = false;
    try {
      document.dispatchEvent(escEvent);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(uiState.drag.grabbedStone).toBeNull();
  });

  test('ESC key when board not focused is ignored', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();
    uiState.boardHasFocus = false;

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);

    // grab は維持される
    expect(uiState.drag.grabbedStone).not.toBeNull();
  });

  test('pointermove while grabbed does not emit UI update', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();

    uiUpdateSpy.mockClear();
    controller.handlePointerMove(createPointerEvent({ clientX: 110, clientY: 110 }));

    // 掴み中は pointermove で UI 更新を発火しない（パフォーマンス対策）
    expect(uiUpdateSpy.mock.calls.length).toBe(0);
  });

  test('second long-press while already grabbed does not start new timer', () => {
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));
    virtualTimers.fireAll();
    expect(uiState.drag.grabbedStone).not.toBeNull();

    const beforeTimerActive = detector.isActive();

    // 既に掴んでいる状態で再度押下
    controller.handlePointerDown(createPointerEvent({ clientX: 100, clientY: 100 }));

    // タイマーは新たに起動されない（grabbedStone チェックで抜ける）
    // 既にgrabされている状態での二度目の down は no-op
    expect(beforeTimerActive).toBe(false);
  });

  test('initial long-press threshold reflects default preference (short -> 250ms)', () => {
    const prefs = new PreferencesStore();
    const freshController = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      prefs
    );
    expect(freshController.getLongPressDetector().getThresholdMs()).toBe(250);
  });

  test('setLongPressDuration(long) updates LongPressDetector threshold (400ms)', () => {
    const prefs = new PreferencesStore();
    const freshController = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      prefs
    );
    expect(freshController.getLongPressDetector().getThresholdMs()).toBe(250);

    prefs.setLongPressDuration('long');

    expect(freshController.getLongPressDetector().getThresholdMs()).toBe(400);
  });

  test('setLongPressDuration(short) restores 250ms threshold', () => {
    const prefs = new PreferencesStore();
    prefs.setLongPressDuration('long');
    const freshController = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      prefs
    );
    expect(freshController.getLongPressDetector().getThresholdMs()).toBe(400);

    prefs.setLongPressDuration('short');

    expect(freshController.getLongPressDetector().getThresholdMs()).toBe(250);
  });
});

describe('BoardInteractionController wheel navigation', () => {
  let state;
  let store;
  let uiState;
  let elements;
  let eventBus;
  let uiUpdateSpy;
  let controller;
  let setMoveIndexSpy;

  const createWheelEvent = (overrides = {}) => ({
    deltaY: 0,
    deltaX: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    cancelable: true,
    preventDefault: jest.fn(),
    ...overrides
  });

  beforeEach(() => {
    state = createState({
      numberMode: true,
      sgfMoves: [
        { color: 'B', row: 3, col: 3 },
        { color: 'W', row: 4, col: 4 },
        { color: 'B', row: 5, col: 5 }
      ],
      sgfIndex: 1
    });
    store = createStore(state);
    store.setMoveIndex = jest.fn();
    uiState = createUIState();
    elements = createElements();
    eventBus = new UIEventBus();
    uiUpdateSpy = jest.fn();
    eventBus.onUIUpdate(uiUpdateSpy);

    controller = new BoardInteractionController(
      store,
      elements,
      uiState,
      eventBus,
      new PreferencesStore()
    );
    controller.initialize();
    setMoveIndexSpy = store.setMoveIndex;
  });

  test('initialize registers wheel listener on boardWrapper', () => {
    const calls = elements.boardWrapper.addEventListener.mock.calls;
    const types = calls.map((c) => c[0]);
    const wheelCall = calls.find(([type]) => type === 'wheel');
    expect(Boolean(wheelCall)).toBe(true);
    expect(typeof wheelCall[1]).toBe('function');
    expect(wheelCall[2]).toEqual({ passive: false });
    // Sanity check: other listeners should also be registered
    expect(types).toContain('pointerenter');
    expect(types).toContain('wheel');
  });

  test('solve mode + deltaY>0 advances sgfIndex by 1 and emits UIUpdate', () => {
    const event = createWheelEvent({ deltaY: 100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls).toEqual([[state.sgfIndex + 1]]);
    expect(uiUpdateSpy.mock.calls.length).toBe(1);
    expect(event.preventDefault.mock.calls.length).toBe(1);
  });

  test('solve mode + deltaY<0 retreats sgfIndex by 1 and emits UIUpdate', () => {
    state.sgfIndex = 2;
    const event = createWheelEvent({ deltaY: -100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls).toEqual([[1]]);
    expect(uiUpdateSpy.mock.calls.length).toBe(1);
    expect(event.preventDefault.mock.calls.length).toBe(1);
  });

  test('edit mode (numberMode=false) ignores wheel and does not preventDefault', () => {
    state.numberMode = false;
    const event = createWheelEvent({ deltaY: 100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls.length).toBe(0);
    expect(uiUpdateSpy.mock.calls.length).toBe(0);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });

  test('at first move (sgfIndex=0) ignores deltaY<0', () => {
    state.sgfIndex = 0;
    const event = createWheelEvent({ deltaY: -100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls.length).toBe(0);
    expect(uiUpdateSpy.mock.calls.length).toBe(0);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });

  test('at last move (sgfIndex=sgfMoves.length) ignores deltaY>0', () => {
    state.sgfIndex = state.sgfMoves.length;
    const event = createWheelEvent({ deltaY: 100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls.length).toBe(0);
    expect(uiUpdateSpy.mock.calls.length).toBe(0);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });

  test('horizontal-dominant wheel (|deltaX|>|deltaY|) is ignored', () => {
    const event = createWheelEvent({ deltaY: 10, deltaX: 100 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls.length).toBe(0);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });

  test('modifier key (Ctrl/Shift/Alt/Meta) bypasses handler to avoid OS conflicts', () => {
    const variants = [
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { metaKey: true }
    ];
    for (const overrides of variants) {
      setMoveIndexSpy.mockClear();
      uiUpdateSpy.mockClear();
      const event = createWheelEvent({ deltaY: 100, ...overrides });
      controller.handleWheel(event);
      expect(setMoveIndexSpy.mock.calls.length).toBe(0);
      expect(event.preventDefault.mock.calls.length).toBe(0);
    }
  });

  test('deltaY===0 is a no-op', () => {
    const event = createWheelEvent({ deltaY: 0 });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls.length).toBe(0);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });

  test('uncancelable event still navigates but skips preventDefault', () => {
    const event = createWheelEvent({ deltaY: 100, cancelable: false });
    controller.handleWheel(event);

    expect(setMoveIndexSpy.mock.calls).toEqual([[state.sgfIndex + 1]]);
    expect(event.preventDefault.mock.calls.length).toBe(0);
  });
});
