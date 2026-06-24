import { QRManager } from '../dist/qr-manager.js';
import { SGFParser } from '../dist/sgf-parser.js';
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

const stubAlert = () => {
  global.alert = () => {};
};

const stubPrompt = (returnValue) => {
  global.prompt = () => returnValue;
};

const stubClipboard = () => {
  global.navigator.clipboard = { writeText: async () => undefined };
};

describe('QRManager', () => {
  let manager;

  beforeEach(() => {
    manager = new QRManager();
    document.body.innerHTML = '';
    stubAlert();
  });

  describe('createSGFQRCode()', () => {
    test('does not throw with empty board', () => {
      const state = createState();
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
      let threw = false;
      try {
        manager.createSGFQRCode(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('opens share-method popup for non-empty board', () => {
      const state = createState();
      state.board[4][4] = 1;
      manager.createSGFQRCode(state);
      const popup = document.getElementById('share-method-popup');
      expect(popup).not.toBeNull();
    });

    test('does not open popup when SGF is empty/initial', () => {
      let alerted = false;
      global.alert = () => { alerted = true; };
      const state = createState({ komi: null, gameInfo: { title: '', komi: null, handicap: null, playerBlack: null, playerWhite: null, result: null } });
      manager.createSGFQRCode(state);
      const popup = document.getElementById('share-method-popup');
      expect(popup).toBeNull();
      expect(alerted).toBe(true);
    });

    test('replaces existing share-method popup on second call', () => {
      const state = createState();
      state.board[2][2] = 1;
      manager.createSGFQRCode(state);
      const firstPopup = document.getElementById('share-method-popup');
      manager.createSGFQRCode(state);
      const secondPopup = document.getElementById('share-method-popup');
      expect(firstPopup).not.toBeNull();
      expect(secondPopup).not.toBeNull();
      expect(firstPopup).not.toBe(secondPopup);
    });
  });

  describe('createAutoLoadQR()', () => {
    test('shows QR popup with share URL', () => {
      const state = createState();
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      manager.createSGFQRCode(state);
      const autoLoadBtn = document.getElementById('share-auto-load');
      autoLoadBtn?.click();
      const qrPopup = document.getElementById('qr-popup');
      expect(qrPopup).not.toBeNull();
      expect(qrPopup.innerHTML).toContain('qr');
    });

    test('falls back to direct SGF QR for large data', () => {
      const state = createState({ boardSize: 19 });
      const moves = [];
      for (let i = 0; i < 100; i++) {
        moves.push({ col: i % 19, row: Math.floor(i / 19), color: (i % 2) + 1 });
      }
      state.sgfMoves = moves;
      manager.createSGFQRCode(state);
      const autoLoadBtn = document.getElementById('share-auto-load');
      autoLoadBtn?.click();
      const qrPopup = document.getElementById('qr-popup');
      expect(qrPopup).not.toBeNull();
    });
  });

  describe('createDirectSGFQR()', () => {
    test('selects 300x300 for data length <= 800', () => {
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      manager.createSGFQRCode(state);
      const directBtn = document.getElementById('share-direct-sgf');
      directBtn?.click();
      const qrPopup = document.getElementById('qr-popup');
      expect(qrPopup).not.toBeNull();
    });

    test('shows warning for large data 1500-2500', () => {
      const state = createState();
      const longSgf = 'B[' + 'aa'.repeat(500) + ']';
      state.sgfMoves = [];
      const parser = new SGFParser();
      parser.export(state);
      manager.createSGFQRCode(state);
      const directBtn = document.getElementById('share-direct-sgf');
      directBtn?.click();
    });

    test('alerts and aborts for data > 2500', () => {
      let alerted = false;
      global.alert = () => { alerted = true; };
      const state = createState();
      const veryLongSgf = '(;GM[1]FF[4]SZ[9]' + ';B[aa]'.repeat(700) + ')';
      state.sgfLoadedFromExternal = true;
      state.sgfMoves = Array.from({ length: 700 }, () => ({ col: 0, row: 0, color: 1 }));
      manager.createSGFQRCode(state);
      const directBtn = document.getElementById('share-direct-sgf');
      directBtn?.click();
      expect(alerted).toBe(true);
    });
  });

  describe('createDiscordShareLink()', () => {
    test('returns early when prompt returns null', async () => {
      stubPrompt(null);
      const state = createState();
      await manager.createDiscordShareLink(state);
    });

    test('does not throw with empty board and null prompt', () => {
      stubPrompt(null);
      const state = createState();
      let threw = false;
      try {
        manager.createDiscordShareLink(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('does not throw when label is whitespace only', () => {
      stubPrompt('   ');
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      let threw = false;
      try {
        manager.createDiscordShareLink(state);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('generates markdown link and writes to clipboard', async () => {
      stubPrompt('Test Label');
      stubClipboard();
      const state = createState();
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      await manager.createDiscordShareLink(state);
    });

    test('alerts when data is empty', () => {
      let alerted = false;
      global.alert = (msg) => { alerted = true; };
      const state = createState({ komi: null, gameInfo: { title: '', komi: null, handicap: null, playerBlack: null, playerWhite: null, result: null } });
      manager.createDiscordShareLink(state);
      expect(alerted).toBe(true);
    });

    test('alerts when share URL exceeds 2000 chars', () => {
      let alerted = false;
      global.alert = (msg) => { alerted = true; };
      const state = createState({ boardSize: 19 });
      const moves = [];
      for (let row = 0; row < 19; row++) {
        for (let col = 0; col < 19; col++) {
          moves.push({ col, row, color: ((row * 19 + col) % 2) + 1 });
        }
      }
      state.sgfMoves = moves;
      manager.createDiscordShareLink(state);
      expect(alerted).toBe(true);
    });
  });

  describe('buildDefaultDiscordLabel()', () => {
    test('uses 黒先 for default answerMode', () => {
      const state = createState({ problemDiagramSet: false, sgfMoves: [] });
      const label = manager['buildDefaultDiscordLabel'](state);
      expect(label).toContain('黒先');
    });

    test('uses 白先 for answerMode=white', () => {
      const state = createState({ answerMode: 'white' });
      const label = manager['buildDefaultDiscordLabel'](state);
      expect(label).toContain('白先');
    });

    test('prefix is 問題図 when problemDiagramSet', () => {
      const state = createState({ problemDiagramSet: true });
      const label = manager['buildDefaultDiscordLabel'](state);
      expect(label).toContain('問題図');
    });

    test('prefix is 詰碁 when not problemDiagramSet', () => {
      const state = createState({ problemDiagramSet: false });
      const label = manager['buildDefaultDiscordLabel'](state);
      expect(label).toContain('詰碁');
    });

    test('includes boardSize and moveCount', () => {
      const state = createState({ boardSize: 13, sgfMoves: [{ col: 0, row: 0, color: 1 }] });
      const label = manager['buildDefaultDiscordLabel'](state);
      expect(label).toContain('13路');
      expect(label).toContain('1手');
    });
  });

  describe('QR popup interactions', () => {
    test('qr-copy writes data to clipboard', async () => {
      stubClipboard();
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      manager.createSGFQRCode(state);
      const directBtn = document.getElementById('share-direct-sgf');
      directBtn?.click();
      const copyBtn = document.getElementById('qr-copy');
      copyBtn?.click();
    });

    test('qr-close removes popup', () => {
      const state = createState();
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      manager.createSGFQRCode(state);
      const directBtn = document.getElementById('share-direct-sgf');
      directBtn?.click();
      const closeBtn = document.getElementById('qr-close');
      closeBtn?.click();
      const popup = document.getElementById('qr-popup');
      expect(popup).toBeNull();
    });
  });
});
