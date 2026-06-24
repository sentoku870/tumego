import { normalizePointerInput } from '../dist/ui/controllers/pointer-input.js';
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

const createPointerEvent = (overrides = {}) => ({
  button: 0,
  buttons: 0,
  pointerType: 'mouse',
  ...overrides
});

describe('normalizePointerInput', () => {
  describe('mode resolution', () => {
    test('returns "erase" mode when eraseMode is true', () => {
      const event = createPointerEvent();
      const state = createState({ eraseMode: true, mode: 'alt' });
      const result = normalizePointerInput(event, state);
      expect(result.mode).toBe('erase');
    });

    test('returns "alt" mode when mode is "alt" and not erasing', () => {
      const event = createPointerEvent();
      const state = createState({ eraseMode: false, mode: 'alt' });
      const result = normalizePointerInput(event, state);
      expect(result.mode).toBe('alt');
    });

    test('returns "play" mode when mode is "black"', () => {
      const event = createPointerEvent();
      const state = createState({ eraseMode: false, mode: 'black' });
      const result = normalizePointerInput(event, state);
      expect(result.mode).toBe('play');
    });

    test('returns "play" mode when mode is "white"', () => {
      const event = createPointerEvent();
      const state = createState({ eraseMode: false, mode: 'white' });
      const result = normalizePointerInput(event, state);
      expect(result.mode).toBe('play');
    });

    test('eraseMode takes precedence over mode setting', () => {
      const event = createPointerEvent();
      const state = createState({ eraseMode: true, mode: 'black' });
      const result = normalizePointerInput(event, state);
      expect(result.mode).toBe('erase');
    });
  });

  describe('button resolution', () => {
    test('returns "primary" for button 0', () => {
      const event = createPointerEvent({ button: 0 });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.button).toBe('primary');
    });

    test('returns "secondary" for button 2', () => {
      const event = createPointerEvent({ button: 2 });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.button).toBe('secondary');
    });

    test('returns "auxiliary" for button 1', () => {
      const event = createPointerEvent({ button: 1 });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.button).toBe('auxiliary');
    });

    test('returns "auxiliary" for button 3 (back button)', () => {
      const event = createPointerEvent({ button: 3 });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.button).toBe('auxiliary');
    });
  });

  describe('device resolution', () => {
    test('returns "mouse" for pointerType mouse', () => {
      const event = createPointerEvent({ pointerType: 'mouse' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.device).toBe('mouse');
    });

    test('returns "touch" for pointerType touch', () => {
      const event = createPointerEvent({ pointerType: 'touch' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.device).toBe('touch');
    });

    test('returns "pen" for pointerType pen', () => {
      const event = createPointerEvent({ pointerType: 'pen' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.device).toBe('pen');
    });

    test('returns "unknown" for unrecognized pointerType', () => {
      const event = createPointerEvent({ pointerType: 'unusual-device' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.device).toBe('unknown');
    });

    test('returns "unknown" for missing pointerType', () => {
      const event = createPointerEvent();
      delete event.pointerType;
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.device).toBe('unknown');
    });
  });

  describe('isPointerActive resolution', () => {
    test('returns true when buttons > 0', () => {
      const event = createPointerEvent({ buttons: 1, pointerType: 'mouse' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.isPointerActive).toBe(true);
    });

    test('returns true for touch with no buttons', () => {
      const event = createPointerEvent({ buttons: 0, pointerType: 'touch' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.isPointerActive).toBe(true);
    });

    test('returns false for mouse with no buttons', () => {
      const event = createPointerEvent({ buttons: 0, pointerType: 'mouse' });
      const state = createState();
      const result = normalizePointerInput(event, state);
      expect(result.isPointerActive).toBe(false);
    });
  });

  describe('colors resolution', () => {
    test('returns null/null for alt mode', () => {
      const event = createPointerEvent();
      const state = createState({ mode: 'alt' });
      const result = normalizePointerInput(event, state);
      expect(result.colors.primary).toBe(null);
      expect(result.colors.secondary).toBe(null);
    });

    test('returns black/white for mode "black"', () => {
      const event = createPointerEvent();
      const state = createState({ mode: 'black' });
      const result = normalizePointerInput(event, state);
      expect(result.colors.primary).toBe(1);
      expect(result.colors.secondary).toBe(2);
    });

    test('returns white/black for mode "white"', () => {
      const event = createPointerEvent();
      const state = createState({ mode: 'white' });
      const result = normalizePointerInput(event, state);
      expect(result.colors.primary).toBe(2);
      expect(result.colors.secondary).toBe(1);
    });

    test('colors are based on mode, not eraseMode', () => {
      const event = createPointerEvent();
      const state = createState({ mode: 'black', eraseMode: true });
      const result = normalizePointerInput(event, state);
      // Even in erase mode, colors are based on underlying mode
      expect(result.colors.primary).toBe(1);
    });
  });

  describe('result completeness', () => {
    test('returns all required fields', () => {
      const event = createPointerEvent();
      const state = createState();
      const result = normalizePointerInput(event, state);
      const hasMode = 'mode' in result;
      const hasButton = 'button' in result;
      const hasDevice = 'device' in result;
      const hasIsActive = 'isPointerActive' in result;
      const hasColors = 'colors' in result;
      expect(hasMode).toBe(true);
      expect(hasButton).toBe(true);
      expect(hasDevice).toBe(true);
      expect(hasIsActive).toBe(true);
      expect(hasColors).toBe(true);
    });
  });
});
