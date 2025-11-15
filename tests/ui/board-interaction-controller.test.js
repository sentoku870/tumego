import { BoardInteractionController } from '../../dist/ui/controllers/board-interaction-controller.js';

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
  gameTree: null,
  sgfLoadedFromExternal: false,
  ...overrides
});

const createStore = (state) => ({
  snapshot: state,
  currentColor: 1,
  tryMove: jest.fn(() => true),
  removeStone: jest.fn(() => true)
});

const createUIState = () => ({
  drag: {
    dragging: false,
    dragColor: null,
    lastPos: null
  },
  boardHasFocus: false,
  touchStartY: 0,
  activeDropdown: null,
  resetDrag: jest.fn(function reset() {
    this.drag.dragging = false;
    this.drag.dragColor = null;
    this.drag.lastPos = null;
  })
});

describe('BoardInteractionController pointer handling', () => {
  let state;
  let store;
  let uiState;
  let elements;
  let disableEraseMode;
  let controller;
  let placeSpy;

  beforeEach(() => {
    state = createState();
    store = createStore(state);
    uiState = createUIState();
    elements = createElements();
    disableEraseMode = jest.fn();

    controller = new BoardInteractionController(
      store,
      elements,
      uiState,
      jest.fn(),
      disableEraseMode
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
});
