import { SGFParser } from '../../dist/sgf-parser.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

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
  gameInfo: { title: '', komi: 6.5, handicap: null, playerBlack: null, playerWhite: null, result: null },
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  rootMarkers: [],
  nodeMarkers: [],
  ...overrides,
});

describe('SGFParser markers', () => {
  let parser;

  beforeEach(() => {
    parser = new SGFParser();
  });

  describe('parse', () => {
    test('parses root-level CR', () => {
      const sgf = '(;GM[1]FF[4]SZ[9]CR[aa][bb]AB[cc])';
      const result = parser.parse(sgf);
      expect(result.rootMarkers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'CR' },
      ]);
      expect(result.nodeMarkers).toEqual([]);
    });

    test('parses all four marker kinds on root', () => {
      const sgf = '(;SZ[9]CR[aa]TR[bb]SQ[cc]MA[dd])';
      const result = parser.parse(sgf);
      expect(result.rootMarkers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'TR' },
        { pos: { col: 2, row: 2 }, kind: 'SQ' },
        { pos: { col: 3, row: 3 }, kind: 'MA' },
      ]);
    });

    test('parses markers per move node (FF4 inheritance=none)', () => {
      const sgf = '(;SZ[9];B[aa]CR[dd];W[bb]TR[ee];B[cc]SQ[ff])';
      const result = parser.parse(sgf);
      expect(result.moves).toHaveLength(3);
      expect(result.nodeMarkers).toEqual([
        [{ pos: { col: 3, row: 3 }, kind: 'CR' }],
        [{ pos: { col: 4, row: 4 }, kind: 'TR' }],
        [{ pos: { col: 5, row: 5 }, kind: 'SQ' }],
      ]);
      expect(result.rootMarkers).toEqual([]);
    });

    test('does not bleed CR into adjacent TR', () => {
      // B2 修正のミラー: 隣接する複数マーカープロパティが互いに干渉しない
      const sgf = '(;SZ[9]CR[aa][bb]TR[cc][dd])';
      const result = parser.parse(sgf);
      const cr = result.rootMarkers.filter((m) => m.kind === 'CR');
      const tr = result.rootMarkers.filter((m) => m.kind === 'TR');
      expect(cr).toHaveLength(2);
      expect(tr).toHaveLength(2);
    });

    test('handles SGF with no markers', () => {
      const sgf = '(;SZ[9];B[aa];W[bb])';
      const result = parser.parse(sgf);
      expect(result.rootMarkers).toEqual([]);
      expect(result.nodeMarkers).toEqual([[], []]);
    });
  });

  describe('export', () => {
    test('emits root markers before the first move', () => {
      const state = createState({
        rootMarkers: [
          { pos: { col: 0, row: 0 }, kind: 'CR' },
          { pos: { col: 1, row: 1 }, kind: 'TR' },
        ],
        sgfMoves: [{ col: 3, row: 3, color: 1 }],
        nodeMarkers: [[]],
      });
      const sgf = parser.export(state);
      expect(sgf).toContain('CR[aa]');
      expect(sgf).toContain('TR[bb]');
    });

    test('emits per-move markers after each move property', () => {
      const state = createState({
        sgfMoves: [
          { col: 0, row: 0, color: 1 },
          { col: 1, row: 1, color: 2 },
        ],
        nodeMarkers: [
          [{ pos: { col: 2, row: 2 }, kind: 'SQ' }],
          [{ pos: { col: 3, row: 3 }, kind: 'MA' }],
        ],
      });
      const sgf = parser.export(state);
      expect(sgf).toContain('SQ[cc]');
      expect(sgf).toContain('MA[dd]');
      // ;B[aa] must precede SQ[cc]; ;W[bb] must precede MA[dd]
      const bIdx = sgf.indexOf(';B[aa]');
      const sqIdx = sgf.indexOf('SQ[cc]');
      const wIdx = sgf.indexOf(';W[bb]');
      const maIdx = sgf.indexOf('MA[dd]');
      expect(sqIdx >= 0 && bIdx >= 0 && maIdx >= 0 && wIdx >= 0).toBe(true);
      expect(bIdx < sqIdx).toBe(true);
      expect(wIdx < maIdx).toBe(true);
    });

    test('skips marker properties when no markers are present', () => {
      const state = createState({
        sgfMoves: [{ col: 0, row: 0, color: 1 }],
        nodeMarkers: [[]],
      });
      const sgf = parser.export(state);
      expect(sgf.includes('CR[')).toBe(false);
      expect(sgf.includes('TR[')).toBe(false);
      expect(sgf.includes('SQ[')).toBe(false);
      expect(sgf.includes('MA[')).toBe(false);
    });
  });

  describe('round-trip', () => {
    test('parse → export preserves root and per-node markers', () => {
      const original = '(;SZ[9]CR[aa]TR[bb];B[cc]SQ[dd];W[ee]MA[ff];B[gg]CR[hh])';
      const parsed = parser.parse(original);
      const state = createState({
        sgfMoves: parsed.moves,
        problemDiagramSet: true,
        rootMarkers: parsed.rootMarkers ?? [],
        nodeMarkers: parsed.nodeMarkers ?? [],
      });
      const exported = parser.export(state);
      const reParsed = parser.parse(exported);
      expect(reParsed.rootMarkers).toEqual(parsed.rootMarkers);
      expect(reParsed.nodeMarkers).toEqual(parsed.nodeMarkers);
    });
  });
});
