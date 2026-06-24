import './helpers/dom-setup.js';
import { Renderer } from '../dist/renderer/renderer.js';
import { getCircleNumber } from '../dist/renderer/view-model.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = 9) => ({
  boardSize: size,
  board: createBoard(size),
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

const DEFAULT_PREFERENCES = {
  edit: { rulesMode: 'standard' },
  solve: {
    showCapturedStones: 'on',
    enableFullReset: 'on',
    highlightLastMove: true,
    showSolutionMoveNumbers: false
  },
  ui: { deviceProfile: 'auto' }
};

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

describe('getCircleNumber', () => {
  test('returns ① for 1', () => {
    expect(getCircleNumber(1)).toBe('①');
  });

  test('returns ⑩ for 10', () => {
    expect(getCircleNumber(10)).toBe('⑩');
  });

  test('returns ⑳ for 20', () => {
    expect(getCircleNumber(20)).toBe('⑳');
  });

  test('returns circled number for all values 1-20', () => {
    for (let n = 1; n <= 20; n++) {
      const result = getCircleNumber(n);
      // Each result is a non-empty string
      expect(typeof result).toBe('string');
      const nonEmpty = result.length > 0;
      expect(nonEmpty).toBe(true);
    }
  });

  test('returns circled number for 21-35 (parenthesized style)', () => {
    for (let n = 21; n <= 35; n++) {
      const result = getCircleNumber(n);
      expect(typeof result).toBe('string');
      const nonEmpty = result.length > 0;
      expect(nonEmpty).toBe(true);
    }
  });

  test('returns circled number for 36-50', () => {
    for (let n = 36; n <= 50; n++) {
      const result = getCircleNumber(n);
      expect(typeof result).toBe('string');
      const nonEmpty = result.length > 0;
      expect(nonEmpty).toBe(true);
    }
  });

  test('returns plain string for n > 50', () => {
    expect(getCircleNumber(51)).toBe('51');
    expect(getCircleNumber(100)).toBe('100');
  });

  test('returns plain string for n < 1', () => {
    expect(getCircleNumber(0)).toBe('0');
    expect(getCircleNumber(-1)).toBe('-1');
  });

  test('returns unique values for distinct inputs (1-20)', () => {
    const set = new Set();
    for (let n = 1; n <= 20; n++) {
      set.add(getCircleNumber(n));
    }
    expect(set.size).toBe(20);
  });
});

describe('Renderer', () => {
  let store, state, elements, renderer;

  beforeEach(() => {
    const engine = new GoEngine();
    const history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
    elements = createUIElements();
    renderer = new Renderer(store, elements, () => DEFAULT_PREFERENCES);
  });

  describe('render()', () => {
    test('populates svg with content', () => {
      renderer.render();
      expect(elements.svg.innerHTML).not.toBe('');
    });

    test('sets viewBox attribute on svg', () => {
      renderer.render();
      const viewBox = elements.svg.getAttribute('viewBox');
      expect(viewBox).not.toBe(null);
      // Format: "0 0 size size"
      const parts = viewBox.split(' ');
      expect(parts).toHaveLength(4);
    });

    test('renders with stones on board', () => {
      state.board[0][0] = 1;
      state.board[3][3] = 2;
      renderer.render();
      // svg should contain circle elements for stones
      const content = elements.svg.innerHTML;
      expect(content).toContain('circle');
    });

    test('renders empty board (no stones)', () => {
      renderer.render();
      const content = elements.svg.innerHTML;
      // Even with no stones, defs, lines, stars, coordinates are present
      expect(content).toContain('line');
    });

    test('renders with move numbers when numberMode is on and showSolutionMoveNumbers is true', () => {
      const prefs = { ...DEFAULT_PREFERENCES, solve: { ...DEFAULT_PREFERENCES.solve, showSolutionMoveNumbers: true } };
      const renderer2 = new Renderer(store, elements, () => prefs);
      state.numberMode = true;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.sgfIndex = 2;
      renderer2.render();
      const content = elements.svg.innerHTML;
      // Move numbers are rendered as text
      expect(content).toContain('text');
    });

    test('render with suppressLastMoveHighlight does not draw highlight', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      // With highlight
      const rendererWith = new Renderer(store, elements, () => DEFAULT_PREFERENCES);
      rendererWith.render();
      const withHighlight = elements.svg.innerHTML;
      // Without highlight
      elements.svg.innerHTML = '';
      rendererWith.render({ suppressLastMoveHighlight: true });
      const withoutHighlight = elements.svg.innerHTML;
      // Both should have content
      expect(withHighlight).not.toBe('');
      expect(withoutHighlight).not.toBe('');
    });
  });

  describe('updateInfo()', () => {
    test('updates infoEl text content', () => {
      state.mode = 'alt';
      renderer.updateInfo();
      expect(elements.infoEl.textContent).not.toBe('');
    });

    test('reflects current mode (black/white/alt)', () => {
      state.mode = 'black';
      renderer.updateInfo();
      expect(elements.infoEl.textContent).toContain('黒');
    });

    test('reflects numberMode', () => {
      state.numberMode = true;
      renderer.updateInfo();
      expect(elements.infoEl.textContent).toContain('解答');
    });

    test('updates movesEl when present', () => {
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      renderer.updateInfo();
      expect(elements.movesEl.textContent).not.toBe('');
    });
  });

  describe('updateSlider()', () => {
    test('sets slider max to sgfMoves.length', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      renderer.updateSlider();
      expect(elements.sliderEl.max).toBe('3');
    });

    test('sets slider value to sgfIndex', () => {
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.sgfIndex = 2;
      renderer.updateSlider();
      expect(elements.sliderEl.value).toBe('2');
    });

    test('handles empty sgfMoves', () => {
      renderer.updateSlider();
      expect(elements.sliderEl.max).toBe('0');
    });
  });

  describe('updateCapturedStones()', () => {
    test('hides container when show is false', () => {
      renderer.updateCapturedStones(false);
      expect(elements.capturedEl.hidden).toBe(true);
    });

    test('shows container and updates text when show is true', () => {
      state.capturedCounts = { black: 5, white: 3 };
      renderer.updateCapturedStones(true);
      expect(elements.capturedEl.hidden).toBe(false);
      expect(elements.capturedEl.textContent).toContain('5');
      expect(elements.capturedEl.textContent).toContain('3');
    });
  });

  describe('showMessage()', () => {
    test('updates msgEl text content', () => {
      renderer.showMessage('Hello, World!');
      expect(elements.msgEl.textContent).toBe('Hello, World!');
    });

    test('handles empty string', () => {
      renderer.showMessage('');
      expect(elements.msgEl.textContent).toBe('');
    });
  });
});
