import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

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

const createService = (state) => {
  const engine = new GoEngine();
  const history = new HistoryManager();
  const store = new GameStore(state, engine, history);
  return new SGFService(new SGFParser(), store);
};

describe('SGFService extended', () => {
  describe('state getter', () => {
    test('returns the underlying GameStore snapshot', () => {
      const state = createState();
      state.board[0][0] = 1;
      const service = createService(state);
      const snapshot = service.state;
      expect(snapshot.board[0][0]).toBe(1);
      expect(snapshot.boardSize).toBe(9);
    });
  });

  describe('parse()', () => {
    test('delegates to SGFParser and returns SGFParseResult', () => {
      const state = createState();
      const service = createService(state);
      const sgfText = '(;FF[4]SZ[9];B[aa])';
      const result = service.parse(sgfText);
      expect(result).not.toBe(null);
      const movesDefined = result.moves !== undefined;
      expect(movesDefined).toBe(true);
      const gameInfoDefined = result.gameInfo !== undefined;
      expect(gameInfoDefined).toBe(true);
    });
  });

  describe('export()', () => {
    test('returns SGF text for empty 9x9 board', () => {
      const state = createState(9);
      const service = createService(state);
      const sgfText = service.export();
      expect(typeof sgfText).toBe('string');
      expect(sgfText).toContain('SZ[9]');
    });

    test('returns SGF text for 19x19 board', () => {
      const state = createState(19);
      const service = createService(state);
      const sgfText = service.export();
      expect(sgfText).toContain('SZ[19]');
    });

    test('returns SGF text for 13x13 board', () => {
      const state = createState(13);
      const service = createService(state);
      const sgfText = service.export();
      expect(sgfText).toContain('SZ[13]');
    });

    test('exported SGF contains moves when sgfMoves is populated', () => {
      const state = createState(9);
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.sgfIndex = 2;
      const service = createService(state);
      const sgfText = service.export();
      expect(sgfText).toContain('B[');
      expect(sgfText).toContain('W[');
    });
  });

  describe('apply() - basic', () => {
    test('throws for invalid SGFParseResult (missing moves)', () => {
      const state = createState(9);
      const service = createService(state);
      const invalid = { gameInfo: {} };
      let threw = false;
      try {
        service.apply(invalid);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws for invalid SGFParseResult (missing gameInfo)', () => {
      const state = createState(9);
      const service = createService(state);
      const invalid = { moves: [] };
      let threw = false;
      try {
        service.apply(invalid);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws for non-array moves', () => {
      const state = createState(9);
      const service = createService(state);
      const invalid = { moves: 'not an array', gameInfo: {} };
      let threw = false;
      try {
        service.apply(invalid);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('applies a valid SGFParseResult', () => {
      const state = createState(9);
      state.sgfMoves = [{ col: 5, row: 5, color: 1 }];
      const service = createService(state);
      const result = {
        moves: [
          { col: 0, row: 0, color: 1 },
          { col: 1, row: 1, color: 2 }
        ],
        gameInfo: { boardSize: 9 }
      };
      const applyResult = service.apply(result);
      const sgfTextDefined = applyResult.sgfText !== undefined;
      expect(sgfTextDefined).toBe(true);
    });

    test('apply sets sgfIndex to 1 (or 0) based on move count', () => {
      const state = createState(9);
      state.sgfIndex = 5;
      const service = createService(state);
      // After apply with 1 move, sgfIndex becomes 1 (runHistoryAdjustmentPhase)
      service.apply({
        moves: [{ col: 0, row: 0, color: 1 }],
        gameInfo: { boardSize: 9 }
      });
      // runHistoryAdjustmentPhase: firstIndex = sgfMoves.length > 0 ? 1 : 0
      // With 1 move, firstIndex = 1
      expect(state.sgfIndex).toBe(1);
    });

    test('apply sets sgfLoadedFromExternal to true', () => {
      const state = createState(9);
      state.sgfLoadedFromExternal = false;
      const service = createService(state);
      service.apply({
        moves: [{ col: 0, row: 0, color: 1 }],
        gameInfo: { boardSize: 9 }
      });
      expect(state.sgfLoadedFromExternal).toBe(true);
    });

    test('apply saves history', () => {
      const state = createState(9);
      state.sgfMoves = [{ col: 5, row: 5, color: 1 }];
      const engine = new GoEngine();
      const history = new HistoryManager();
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      const store = new GameStore(state, engine, history);
      const service = new SGFService(new SGFParser(), store);
      service.apply({
        moves: [{ col: 0, row: 0, color: 1 }],
        gameInfo: { boardSize: 9 }
      });
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0].label).toContain('SGF読み込み前');
      expect(saveCalls[0].label).toContain('1手');
    });
  });

  describe('apply() - board size change', () => {
    test('changes board size when gameInfo.boardSize differs', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 19 }
      });
      expect(state.boardSize).toBe(19);
      expect(state.board).toHaveLength(19);
    });

    test('keeps current board size when gameInfo.boardSize is same', () => {
      const state = createState(13);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 13 }
      });
      expect(state.boardSize).toBe(13);
    });

    test('keeps current board size when gameInfo.boardSize is undefined', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: {}
      });
      expect(state.boardSize).toBe(9);
    });
  });

  describe('apply() - gameInfo', () => {
    test('applies title from gameInfo', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 9, title: 'Test Game' }
      });
      expect(state.gameInfo.title).toBe('Test Game');
    });

    test('applies player names from gameInfo', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 9, playerBlack: 'Alice', playerWhite: 'Bob' }
      });
      expect(state.gameInfo.playerBlack).toBe('Alice');
      expect(state.gameInfo.playerWhite).toBe('Bob');
    });

    test('applies komi from gameInfo', () => {
      const state = createState(9);
      state.komi = 6.5;
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 9, komi: 7.5 }
      });
      expect(state.komi).toBe(7.5);
    });

    test('applies result from gameInfo', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 9, result: 'B+3' }
      });
      expect(state.gameInfo.result).toBe('B+3');
    });
  });

  describe('apply() - handicap and problem diagram', () => {
    test('applies handicap from gameInfo', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: {
          boardSize: 9,
          handicapStones: 2,
          handicapPositions: [{ col: 2, row: 6 }, { col: 6, row: 2 }]
        }
      });
      expect(state.handicapStones).toBe(2);
      expect(state.handicapPositions).toHaveLength(2);
    });

    test('applies problem diagram from gameInfo', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: {
          boardSize: 9,
          problemDiagramSet: true,
          problemDiagramBlack: [{ col: 0, row: 0 }],
          problemDiagramWhite: [{ col: 1, row: 1 }]
        }
      });
      expect(state.problemDiagramSet).toBe(true);
      expect(state.problemDiagramBlack).toHaveLength(1);
      expect(state.problemDiagramWhite).toHaveLength(1);
    });
  });

  describe('apply() - moves', () => {
    test('applies sgfMoves from result', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [
          { col: 0, row: 0, color: 1 },
          { col: 1, row: 1, color: 2 }
        ],
        gameInfo: { boardSize: 9 }
      });
      expect(state.sgfMoves).toHaveLength(2);
      expect(state.sgfMoves[0]).toEqual({ col: 0, row: 0, color: 1 });
    });

    test('moves are deep copies (mutating result does not affect state)', () => {
      const state = createState(9);
      const service = createService(state);
      const result = {
        moves: [{ col: 0, row: 0, color: 1 }],
        gameInfo: { boardSize: 9 }
      };
      service.apply(result);
      result.moves.push({ col: 8, row: 8, color: 2 });
      result.moves[0].color = 2;
      expect(state.sgfMoves).toHaveLength(1);
      expect(state.sgfMoves[0].color).toBe(1);
    });

    test('handles empty moves array', () => {
      const state = createState(9);
      const service = createService(state);
      service.apply({
        moves: [],
        gameInfo: { boardSize: 9 }
      });
      expect(state.sgfMoves).toEqual([]);
    });
  });

  describe('buildAnswerSequence() - extended', () => {
    test('returns empty when numberMode is false', () => {
      const state = createState(9);
      state.numberMode = false;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ];
      state.sgfIndex = 2;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      expect(sequence).toBe('');
    });

    test('returns empty when endIndex <= startIndex', () => {
      const state = createState(9);
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 0;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      expect(sequence).toBe('');
    });

    test('uses startIndex from numberStartIndex when > 0', () => {
      const state = createState(9);
      state.numberMode = true;
      state.sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 }
      ];
      state.numberStartIndex = 1;
      state.sgfIndex = 3;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      // Start from index 1, so moves[1] (color 2 → □) and moves[2] (color 1 → ■)
      expect(sequence).toBe('□① B8 ■② C7');
    });

    test('handles white moves with □ mark', () => {
      const state = createState(9);
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 2 }];
      state.sgfIndex = 1;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      expect(sequence).toContain('□');
    });

    test('handles 13x13 board coordinates', () => {
      const state = createState(13);
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      // 13x13 board: row 0 is "13" (top), so coordinate is "A13"
      expect(sequence).toBe('■① A13');
    });

    test('handles 19x19 board coordinates', () => {
      const state = createState(19);
      state.numberMode = true;
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      state.sgfIndex = 1;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      expect(sequence).toBe('■① A19');
    });

    test('uses circled numbers 1-20', () => {
      const state = createState(9);
      state.numberMode = true;
      const moves = [];
      for (let i = 0; i < 9; i++) {
        // Stay within 9x9 board (col 0-8, row 0-8)
        moves.push({ col: i, row: i, color: 1 });
      }
      state.sgfMoves = moves;
      state.sgfIndex = 9;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      expect(sequence).toContain('①');
      expect(sequence).toContain('⑨');
    });

    test('falls back to plain number for moves beyond 20', () => {
      const state = createState(9);
      state.numberMode = true;
      const moves = [];
      for (let i = 0; i < 22; i++) {
        // Avoid col >= boardSize (9)
        moves.push({ col: i % 9, row: Math.floor(i / 9), color: 1 });
      }
      state.sgfMoves = moves;
      state.sgfIndex = 22;
      const service = createService(state);
      const sequence = service.buildAnswerSequence(state);
      // The 21st and 22nd moves should not be circled
      expect(sequence).toContain('⑳');
    });

    test('uses state.snapshot as default when no state argument', () => {
      const state = createState(9);
      state.numberMode = true;
      state.sgfMoves = [
        { col: 5, row: 4, color: 1 },
        { col: 3, row: 2, color: 2 }
      ];
      state.sgfIndex = 2;
      const service = createService(state);
      const sequence = service.buildAnswerSequence();
      expect(sequence).toBe('■① F5 □② D7');
    });
  });

  describe('integration: parse → apply → export', () => {
    test('round-trip preserves a simple game', () => {
      const state = createState(9);
      const service = createService(state);
      const sgfText = '(;FF[4]SZ[9]KM[6.5];B[ee];W[dd])';

      const parsed = service.parse(sgfText);
      service.apply(parsed);

      const exported = service.export();
      expect(exported).toContain('SZ[9]');
      expect(exported).toContain('KM[6.5]');
    });

    test('board size changes correctly via parse/apply', () => {
      const state = createState(9);
      const service = createService(state);
      const sgfText = '(;FF[4]SZ[19];B[dd])';

      const parsed = service.parse(sgfText);
      service.apply(parsed);

      expect(state.boardSize).toBe(19);
      expect(state.board).toHaveLength(19);
    });
  });
});
