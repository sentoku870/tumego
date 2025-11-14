import { SGFParser } from '../dist/sgf-parser.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createState = (overrides = {}) => {
  const size = overrides.boardSize ?? DEFAULT_CONFIG.DEFAULT_BOARD_SIZE;
  const board = overrides.board ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

  return {
    boardSize: size,
    board,
    mode: 'alt',
    eraseMode: false,
    history: [],
    turn: overrides.turn ?? 0,
    sgfMoves: overrides.sgfMoves ?? [],
    numberMode: overrides.numberMode ?? false,
    startColor: overrides.startColor ?? 1,
    sgfIndex: overrides.sgfIndex ?? 0,
    numberStartIndex: overrides.numberStartIndex ?? 0,
    komi: overrides.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
    handicapStones: overrides.handicapStones ?? 0,
    handicapPositions: overrides.handicapPositions ?? [],
    answerMode: overrides.answerMode ?? 'black',
    problemDiagramSet: overrides.problemDiagramSet ?? false,
    problemDiagramBlack: overrides.problemDiagramBlack ?? [],
    problemDiagramWhite: overrides.problemDiagramWhite ?? [],
    gameTree: overrides.gameTree ?? null
  };
};

describe('SGFParser', () => {
  const parser = new SGFParser();

  test('parses basic SGF properties and moves', () => {
    const sgf = '(;GM[1]FF[4]SZ[9]KM[6.5];B[aa];W[bb])';
    const result = parser.parse(sgf);

    expect(result.moves).toEqual([
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ]);
    expect(result.gameInfo.boardSize).toBe(9);
    expect(result.gameInfo.komi).toBe(6.5);
    expect(result.gameInfo.startColor).toBe(1);
  });

  test('detects handicap setup and starting color from SGF', () => {
    const sgf = '(;GM[1]SZ[19]KM[5.5]HA[2]AB[dd][qq];W[dp])';
    const result = parser.parse(sgf);

    expect(result.gameInfo.handicapPositions).toEqual([
      { col: 3, row: 3 },
      { col: 16, row: 16 }
    ]);
    expect(result.gameInfo.handicapStones).toBe(2);
    expect(result.gameInfo.startColor).toBe(2);
  });

  test('exports SGF with handicap stones and moves', () => {
    const state = createState({
      boardSize: 9,
      komi: 0,
      handicapStones: 2,
      handicapPositions: [
        { col: 2, row: 2 },
        { col: 6, row: 6 }
      ],
      sgfMoves: [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 }
      ]
    });

    const sgf = parser.export(state);
    expect(sgf).toContain('HA[2]');
    expect(sgf).toContain('AB[cc][gg]');
    expect(sgf).toContain(';B[aa];W[bb]');
  });

  test('compresses SGF text by removing unnecessary whitespace', () => {
    const messy = ' ( ;B [aa ] ; W[ bb] ) ';
    expect(parser.compress(messy)).toBe('(;B[aa];W[bb])');
  });
});
