import { SGFParser } from '../../dist/sgf-parser.js';
import { extractMainLineMarkers, extractMainLineMoves } from '../../dist/services/sgf-service.js';
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
  sgfTree: { id: 'root', parent: null, children: [], isMainLine: true },
  currentNodeId: 'root',
  studyMode: false,
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

/**
 * テスト用: sgfMoves と nodeMarkers から SGFNode 木を構築する。
 * ルートのみを作り、主ラインのみを持つ線形木を返す。
 */
function buildTreeFromMovesAndMarkers(moves, nodeMarkers, rootMarkers) {
  const root = { id: 'root', parent: null, children: [], isMainLine: true };
  if (rootMarkers && rootMarkers.length > 0) {
    root.__markers = rootMarkers.map((m) => ({ pos: { ...m.pos }, kind: m.kind, ...(m.label !== undefined ? { label: m.label } : {}) }));
  }
  let parent = root;
  for (let i = 0; i < moves.length; i++) {
    const node = {
      id: `n${i + 1}`,
      parent,
      children: [],
      isMainLine: true,
      move: { ...moves[i] },
    };
    const markers = (nodeMarkers && nodeMarkers[i]) || [];
    if (markers.length > 0) {
      node.__markers = markers.map((m) => ({ pos: { ...m.pos }, kind: m.kind, ...(m.label !== undefined ? { label: m.label } : {}) }));
    }
    parent.children.push(node);
    parent = node;
  }
  return root;
}

describe('SGFParser markers', () => {
  let parser;

  beforeEach(() => {
    parser = new SGFParser();
  });

  describe('parse', () => {
    test('parses root-level CR', () => {
      const sgf = '(;GM[1]FF[4]SZ[9]CR[aa][bb]AB[cc])';
      const result = parser.parse(sgf);
      const { rootMarkers, nodeMarkers } = extractMainLineMarkers(result.rootNode);
      expect(rootMarkers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'CR' },
      ]);
      expect(nodeMarkers).toEqual([]);
    });

    test('parses all four marker kinds on root', () => {
      const sgf = '(;SZ[9]CR[aa]TR[bb]SQ[cc]MA[dd])';
      const result = parser.parse(sgf);
      const { rootMarkers } = extractMainLineMarkers(result.rootNode);
      expect(rootMarkers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'TR' },
        { pos: { col: 2, row: 2 }, kind: 'SQ' },
        { pos: { col: 3, row: 3 }, kind: 'MA' },
      ]);
    });

    test('parses markers per move node (FF4 inheritance=none)', () => {
      const sgf = '(;SZ[9];B[aa]CR[dd];W[bb]TR[ee];B[cc]SQ[ff])';
      const result = parser.parse(sgf);
      const moves = extractMainLineMoves(result.rootNode);
      const { rootMarkers, nodeMarkers } = extractMainLineMarkers(result.rootNode);
      expect(moves).toHaveLength(3);
      expect(nodeMarkers).toEqual([
        [{ pos: { col: 3, row: 3 }, kind: 'CR' }],
        [{ pos: { col: 4, row: 4 }, kind: 'TR' }],
        [{ pos: { col: 5, row: 5 }, kind: 'SQ' }],
      ]);
      expect(rootMarkers).toEqual([]);
    });

    test('does not bleed CR into adjacent TR', () => {
      const sgf = '(;SZ[9]CR[aa][bb]TR[cc][dd])';
      const result = parser.parse(sgf);
      const { rootMarkers } = extractMainLineMarkers(result.rootNode);
      const cr = rootMarkers.filter((m) => m.kind === 'CR');
      const tr = rootMarkers.filter((m) => m.kind === 'TR');
      expect(cr).toHaveLength(2);
      expect(tr).toHaveLength(2);
    });

    test('handles SGF with no markers', () => {
      const sgf = '(;SZ[9];B[aa];W[bb])';
      const result = parser.parse(sgf);
      const { rootMarkers, nodeMarkers } = extractMainLineMarkers(result.rootNode);
      expect(rootMarkers).toEqual([]);
      expect(nodeMarkers).toEqual([[], []]);
    });

    test('parses LB[aa:A] labels on root', () => {
      const sgf = '(;SZ[9]LB[aa:A][bb:B])';
      const result = parser.parse(sgf);
      const { rootMarkers } = extractMainLineMarkers(result.rootNode);
      expect(rootMarkers).toEqual([
        { pos: { col: 0, row: 0 }, kind: 'LB', label: 'A' },
        { pos: { col: 1, row: 1 }, kind: 'LB', label: 'B' },
      ]);
    });

    test('parses LB[aa:A] labels on move nodes (per-node)', () => {
      const sgf = '(;SZ[9];B[aa]LB[cc:A];W[bb]LB[dd:黒])';
      const result = parser.parse(sgf);
      const { nodeMarkers } = extractMainLineMarkers(result.rootNode);
      expect(nodeMarkers).toEqual([
        [{ pos: { col: 2, row: 2 }, kind: 'LB', label: 'A' }],
        [{ pos: { col: 3, row: 3 }, kind: 'LB', label: '黒' }],
      ]);
    });
  });

  describe('export', () => {
    test('emits root markers before the first move', () => {
      const rootMarkers = [
        { pos: { col: 0, row: 0 }, kind: 'CR' },
        { pos: { col: 1, row: 1 }, kind: 'TR' },
      ];
      const sgfMoves = [{ col: 3, row: 3, color: 1 }];
      const nodeMarkers = [[]];
      const sgfTree = buildTreeFromMovesAndMarkers(sgfMoves, nodeMarkers, rootMarkers);
      const state = createState({ sgfMoves, rootMarkers, nodeMarkers, sgfTree });
      const sgf = parser.export(state);
      expect(sgf).toContain('CR[aa]');
      expect(sgf).toContain('TR[bb]');
    });

    test('emits per-move markers after each move property', () => {
      const sgfMoves = [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
      ];
      const nodeMarkers = [
        [{ pos: { col: 2, row: 2 }, kind: 'SQ' }],
        [{ pos: { col: 3, row: 3 }, kind: 'MA' }],
      ];
      const sgfTree = buildTreeFromMovesAndMarkers(sgfMoves, nodeMarkers, []);
      const state = createState({ sgfMoves, nodeMarkers, sgfTree });
      const sgf = parser.export(state);
      expect(sgf).toContain('SQ[cc]');
      expect(sgf).toContain('MA[dd]');
      const bIdx = sgf.indexOf(';B[aa]');
      const sqIdx = sgf.indexOf('SQ[cc]');
      const wIdx = sgf.indexOf(';W[bb]');
      const maIdx = sgf.indexOf('MA[dd]');
      expect(sqIdx >= 0 && bIdx >= 0 && maIdx >= 0 && wIdx >= 0).toBe(true);
      expect(bIdx < sqIdx).toBe(true);
      expect(wIdx < maIdx).toBe(true);
    });

    test('skips marker properties when no markers are present', () => {
      const sgfMoves = [{ col: 0, row: 0, color: 1 }];
      const nodeMarkers = [[]];
      const sgfTree = buildTreeFromMovesAndMarkers(sgfMoves, nodeMarkers, []);
      const state = createState({ sgfMoves, nodeMarkers, sgfTree });
      const sgf = parser.export(state);
      expect(sgf.includes('CR[')).toBe(false);
      expect(sgf.includes('TR[')).toBe(false);
      expect(sgf.includes('SQ[')).toBe(false);
      expect(sgf.includes('MA[')).toBe(false);
    });

    test('emits LB[coord:label] format on root', () => {
      const rootMarkers = [
        { pos: { col: 0, row: 0 }, kind: 'LB', label: 'A' },
        { pos: { col: 1, row: 1 }, kind: 'LB', label: 'B' },
      ];
      const sgfMoves = [{ col: 3, row: 3, color: 1 }];
      const nodeMarkers = [[]];
      const sgfTree = buildTreeFromMovesAndMarkers(sgfMoves, nodeMarkers, rootMarkers);
      const state = createState({ sgfMoves, rootMarkers, nodeMarkers, sgfTree });
      const sgf = parser.export(state);
      expect(sgf).toContain('LB[');
      expect(sgf.includes('[aa:A]')).toBe(true);
      expect(sgf.includes('[bb:B]')).toBe(true);
    });

    test('emits LB[coord:label] on per-move nodes', () => {
      const sgfMoves = [{ col: 0, row: 0, color: 1 }];
      const nodeMarkers = [[{ pos: { col: 2, row: 2 }, kind: 'LB', label: 'C' }]];
      const sgfTree = buildTreeFromMovesAndMarkers(sgfMoves, nodeMarkers, []);
      const state = createState({ sgfMoves, nodeMarkers, sgfTree });
      const sgf = parser.export(state);
      expect(sgf).toContain('LB[cc:C]');
    });
  });

  describe('round-trip', () => {
    test('parse → export preserves root and per-node markers', () => {
      const original = '(;SZ[9]CR[aa]TR[bb];B[cc]SQ[dd];W[ee]MA[ff];B[gg]CR[hh])';
      const parsed = parser.parse(original);
      const moves = extractMainLineMoves(parsed.rootNode);
      const { rootMarkers, nodeMarkers } = extractMainLineMarkers(parsed.rootNode);
      const sgfTree = buildTreeFromMovesAndMarkers(moves, nodeMarkers, rootMarkers);
      const state = createState({
        sgfMoves: moves,
        problemDiagramSet: true,
        rootMarkers,
        nodeMarkers,
        sgfTree,
      });
      const exported = parser.export(state);
      const reParsed = parser.parse(exported);
      const reMarkers = extractMainLineMarkers(reParsed.rootNode);
      expect(reMarkers.rootMarkers).toEqual(rootMarkers);
      expect(reMarkers.nodeMarkers).toEqual(nodeMarkers);
    });
  });
});
