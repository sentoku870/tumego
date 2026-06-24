import './helpers/dom-setup.js';
import { QRManager } from '../dist/qr-manager.js';
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

describe('QRManager', () => {
  let manager;

  beforeEach(() => {
    manager = new QRManager();
  });

  describe('createSGFQRCode()', () => {
    test('does not throw with empty board', () => {
      const state = createState();
      global.alert = () => {};
      let threw = false;
      try {
        manager.createSGFQRCode(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('does not throw with non-empty board', () => {
      const state = createState();
      state.board[0][0] = 1;
      global.alert = () => {};
      let threw = false;
      try {
        manager.createSGFQRCode(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('does not throw with 19x19 board', () => {
      const state = createState({ boardSize: 19 });
      state.board[5][5] = 1;
      global.alert = () => {};
      let threw = false;
      try {
        manager.createSGFQRCode(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  describe('createDiscordShareLink()', () => {
    test('does not throw with empty board (prompt is null)', () => {
      const state = createState();
      global.alert = () => {};
      global.prompt = () => null;
      let threw = false;
      try {
        manager.createDiscordShareLink(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('returns early when prompt returns null', async () => {
      const state = createState();
      global.alert = () => {};
      global.prompt = () => null;
      // Should complete without throwing
      await manager.createDiscordShareLink(state);
    });

    test('does not throw when label is whitespace only', () => {
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      global.alert = () => {};
      global.prompt = () => '   ';
      let threw = false;
      try {
        manager.createDiscordShareLink(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('does not throw with mocked prompt/clipboard', () => {
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      global.alert = () => {};
      global.prompt = () => 'Test Label';
      global.navigator.clipboard = { writeText: async () => undefined };
      let threw = false;
      try {
        manager.createDiscordShareLink(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });
});
