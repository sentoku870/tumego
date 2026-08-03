import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFIO } from '../../dist/services/sgf-io.js';
import { SGFShare } from '../../dist/services/sgf-share.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

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
  gameInfo: {
    title: '',
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    handicap: null,
    playerBlack: null,
    playerWhite: null,
    result: null
  },
  capturedCounts: { black: 0, white: 0 }
});

const createService = () => {
  const state = createState();
  const engine = new GoEngine();
  const history = new HistoryManager();
  const store = new GameStore(state, engine, history);
  const parser = new SGFParser();
  const service = new SGFService(parser, store, new SGFIO(parser), new SGFShare(parser));
  return { service, state, store, parser };
};

describe('SGFService.validateParseResult()', () => {
  test('accepts a well-formed result with moves array', () => {
    const { service } = createService();
    const result = {
      moves: [{ col: 0, row: 0, color: 1 }],
      gameInfo: { boardSize: 9, komi: 6.5, handicap: null },
      rootMarkers: [],
      nodeMarkers: []
    };
    let threw = false;
    try { service.validateParseResult(result); } catch { threw = true; }
    expect(threw).toBe(false);
    expect(service.validateParseResult(result)).toBe(result);
  });

  test('throws when moves is missing', () => {
    const { service } = createService();
    const result = {
      gameInfo: { boardSize: 9, komi: 6.5, handicap: null }
    };
    let threw = false;
    let message = '';
    try {
      service.validateParseResult(result);
    } catch (e) {
      threw = true;
      message = e.message;
    }
    expect(threw).toBe(true);
    expect(message.includes('SGF')).toBe(true);
  });

  test('throws when moves is not an array', () => {
    const { service } = createService();
    const result = {
      moves: 'not-an-array',
      gameInfo: { boardSize: 9, komi: 6.5, handicap: null }
    };
    let threw = false;
    try {
      service.validateParseResult(result);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('throws when moves is null', () => {
    const { service } = createService();
    const result = {
      moves: null,
      gameInfo: { boardSize: 9, komi: 6.5, handicap: null }
    };
    let threw = false;
    try {
      service.validateParseResult(result);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('throws when gameInfo is missing', () => {
    const { service } = createService();
    const result = {
      moves: []
    };
    let threw = false;
    try {
      service.validateParseResult(result);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('accepts empty moves array (SGF with no moves)', () => {
    const { service } = createService();
    const result = {
      moves: [],
      gameInfo: { boardSize: 9, komi: 6.5, handicap: null },
      rootMarkers: [],
      nodeMarkers: []
    };
    let threw = false;
    try { service.validateParseResult(result); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});

describe('SGFService.buildAnswerSequence() - boundary cases', () => {
  test('returns empty string when numberMode is false', () => {
    const { service, state } = createService();
    state.numberMode = false;
    state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
    state.sgfIndex = 1;
    expect(service.buildAnswerSequence(state)).toBe('');
  });

  test('returns empty string when no moves exist', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [];
    state.sgfIndex = 0;
    expect(service.buildAnswerSequence(state)).toBe('');
  });

  test('returns empty string when sgfIndex equals numberStartIndex', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
    state.sgfIndex = 0;
    state.numberStartIndex = 0;
    expect(service.buildAnswerSequence(state)).toBe('');
  });

  test('returns empty string when sgfIndex is below numberStartIndex', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ];
    state.numberStartIndex = 2;
    state.sgfIndex = 1;
    expect(service.buildAnswerSequence(state)).toBe('');
  });

  test('clamps endIndex to sgfMoves.length when sgfIndex exceeds', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ];
    state.sgfIndex = 999;
    state.numberStartIndex = 0;
    const seq = service.buildAnswerSequence(state);
    expect(seq).toBe('■① A9 □② B8');
  });

  test('starts numbering from 1 when numberStartIndex is 0', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 },
      { col: 2, row: 2, color: 1 }
    ];
    state.sgfIndex = 3;
    state.numberStartIndex = 0;
    const seq = service.buildAnswerSequence(state);
    expect(seq).toContain('①');
    expect(seq).toContain('②');
    expect(seq).toContain('③');
  });

  test('uses numberStartIndex as the start for numbering', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 },
      { col: 2, row: 2, color: 1 },
      { col: 3, row: 3, color: 2 }
    ];
    state.numberStartIndex = 2;
    state.sgfIndex = 4;
    const seq = service.buildAnswerSequence(state);
    expect(seq).toBe('■① C7 □② D6');
  });

  test('uses ■ for black moves and □ for white moves', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ];
    state.sgfIndex = 2;
    state.numberStartIndex = 0;
    const seq = service.buildAnswerSequence(state);
    expect(seq.includes('■')).toBe(true);
    expect(seq.includes('□')).toBe(true);
    expect(seq.indexOf('■') < seq.indexOf('□')).toBe(true);
  });

  test('formats 19x19 coordinates correctly', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.boardSize = 19;
    state.board = createBoard(19);
    state.sgfMoves = [{ col: 0, row: 18, color: 1 }];
    state.sgfIndex = 1;
    state.numberStartIndex = 0;
    const seq = service.buildAnswerSequence(state);
    expect(seq).toContain('A1');
  });

  test('skips move when coordinate is null (col out of range)', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 99, row: 0, color: 2 },
      { col: 1, row: 1, color: 1 }
    ];
    state.sgfIndex = 3;
    state.numberStartIndex = 0;
    const seq = service.buildAnswerSequence(state);
    expect(seq.includes('99')).toBe(false);
    expect(seq.includes('A9')).toBe(true);
    expect(seq.includes('B8')).toBe(true);
  });

  test('handles default state when called without argument', () => {
    const { service, state } = createService();
    state.numberMode = true;
    state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
    state.sgfIndex = 1;
    state.numberStartIndex = 0;
    expect(typeof service.buildAnswerSequence()).toBe('string');
  });
});
