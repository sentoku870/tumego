// ============ ツリー構造（分岐図）の往復テスト ============
// SGF の () 括弧で表される分岐構造が、parse → export → parse で正しく往復するか検証する。
import { SGFParser } from '../../dist/sgf-parser.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (overrides = {}) => {
  const size = overrides.boardSize ?? DEFAULT_CONFIG.DEFAULT_BOARD_SIZE;
  const board = overrides.board ?? createBoard(size);

  // テスト用: sgfMoves から自動的に SGFNode 木を構築
  const sgfMoves = overrides.sgfMoves ?? [];
  const root = { id: 'root', parent: null, children: [], isMainLine: true };
  let parent = root;
  for (let i = 0; i < sgfMoves.length; i++) {
    const node = { id: `n${i + 1}`, parent, children: [], isMainLine: true, move: { ...sgfMoves[i] } };
    parent.children.push(node);
    parent = node;
  }

  return {
    boardSize: size,
    board,
    mode: 'alt',
    eraseMode: false,
    history: [],
    turn: 0,
    sgfMoves,
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
    sgfTree: overrides.sgfTree ?? root,
    currentNodeId: overrides.currentNodeId ?? 'root',
    studyMode: false,
    sgfLoadedFromExternal: false,
    capturedCounts: { black: 0, white: 0 },
    markers: [],
    markerMode: false,
    activeMarkerKind: null,
    activeMarkerLabel: null,
    rootMarkers: overrides.rootMarkers ?? [],
    nodeMarkers: overrides.nodeMarkers ?? sgfMoves.map(() => []),
    gameInfo: overrides.gameInfo ?? {
      title: '',
      boardSize: size,
      komi: DEFAULT_CONFIG.DEFAULT_KOMI,
      handicap: null,
      handicapStones: 0,
      handicapPositions: [],
      startColor: 1,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: [],
      playerBlack: null,
      playerWhite: null,
      result: null
    }
  };
};

describe('SGFParser - tree with branches', () => {
  const parser = new SGFParser();

  describe('parse', () => {
    test('parses main + 1 variation at second move (SGF standard: variations are siblings of last main-sequence node)', () => {
      // ( ;B[dd] ;W[ee] ( ;B[ff] ) ( ;B[gg] ;W[hh] ))
      // → root → B[dd] → [W[ee] (main), B[ff] (var), B[gg] → W[hh] (var)]
      const sgf = '(;B[dd];W[ee](;B[ff])(;B[gg];W[hh]))';
      const result = parser.parse(sgf);

      expect(result.rootNode.children).toHaveLength(1);
      const dd = result.rootNode.children[0];
      expect(dd.move).toEqual({ col: 3, row: 3, color: 1 });

      // B[dd] の子に 3つ: W[ee], B[ff], B[gg]
      expect(dd.children).toHaveLength(3);
      const ee = dd.children[0];
      expect(ee.move).toEqual({ col: 4, row: 4, color: 2 });
      expect(ee.isMainLine).toBe(true);

      const ff = dd.children[1];
      expect(ff.move).toEqual({ col: 5, row: 5, color: 1 });
      expect(ff.isMainLine).toBe(false);

      const gg = dd.children[2];
      expect(gg.move).toEqual({ col: 6, row: 6, color: 1 });
      expect(gg.isMainLine).toBe(false);

      expect(gg.children).toHaveLength(1);
      expect(gg.children[0].move).toEqual({ col: 7, row: 7, color: 2 });
    });

    test('parses nested branches (variation from variation)', () => {
      // ( ;B[aa] ( ;W[bb] ( ;B[cc] ) ) )
      // SGF 標準解釈:
      //   Main sequence: B[aa]
      //   Variation 1: (W[bb](B[cc])) → W[bb] と B[cc] は両方 B[aa] の兄弟
      const sgf = '(;B[aa](;W[bb](;B[cc])))';
      const result = parser.parse(sgf);

      // B[aa]、W[bb]、B[cc] は全て root の子（兄弟）
      expect(result.rootNode.children).toHaveLength(3);
      expect(result.rootNode.children[0].move).toEqual({ col: 0, row: 0, color: 1 });
      expect(result.rootNode.children[1].move).toEqual({ col: 1, row: 1, color: 2 });
      expect(result.rootNode.children[2].move).toEqual({ col: 2, row: 2, color: 1 });
    });

    test('KaTrain-style SGF with multiple variations', () => {
      const sgf = '(;B[dd];W[ee](;B[ff])(;B[gg];W[hh])(;B[ii];W[jj]))';
      const result = parser.parse(sgf);

      const dd = result.rootNode.children[0];
      expect(dd.children).toHaveLength(4); // W[ee], B[ff], B[gg], B[ii]
      expect(dd.children[0].move.color).toBe(2);
      expect(dd.children[1].move.color).toBe(1);
      expect(dd.children[2].move.color).toBe(1);
      expect(dd.children[3].move.color).toBe(1);
    });
  });

  describe('export', () => {
    test('emits parentheses around variation nodes', () => {
      // dd から直接 2 つの子（ee=主、ff=副）を持つ構造
      const root = { id: 'root', parent: null, children: [], isMainLine: true };
      const dd = { id: 'dd', parent: root, children: [], isMainLine: true, move: { col: 3, row: 3, color: 1 } };
      const ee = { id: 'ee', parent: dd, children: [], isMainLine: true, move: { col: 4, row: 4, color: 2 } };
      const ff = { id: 'ff', parent: dd, children: [], isMainLine: false, move: { col: 5, row: 5, color: 1 } };
      root.children = [dd];
      dd.children = [ee, ff];

      const state = createState({ sgfTree: root, currentNodeId: 'root' });
      const sgf = parser.export(state);
      expect(sgf).toContain(';B[dd]');
      expect(sgf).toContain(';W[ee]');
      expect(sgf).toContain(';B[ff]');
      // 副分岐は括弧で囲まれる
      expect(sgf).toContain('(;B[ff])');
    });
  });

  describe('round-trip', () => {
    test('preserves main + 1 variation through parse → export → parse', () => {
      const original = '(;B[dd];W[ee](;B[ff])(;B[gg];W[hh]))';
      const parsed = parser.parse(original);

      const state = createState({ sgfTree: parsed.rootNode, currentNodeId: 'root' });
      const exported = parser.export(state);
      const reParsed = parser.parse(exported);

      // エクスポートは leading `;` でセットアップノードを作るので、
      // root.children[0] はセットアップノード、その children[0] が B[dd]
      const setup = reParsed.rootNode.children[0];
      const reDd = setup.children[0];
      expect(reDd.move).toEqual({ col: 3, row: 3, color: 1 });
      expect(reDd.children).toHaveLength(3);
      expect(reDd.children[0].move).toEqual({ col: 4, row: 4, color: 2 });
      expect(reDd.children[1].move).toEqual({ col: 5, row: 5, color: 1 });
      expect(reDd.children[2].move).toEqual({ col: 6, row: 6, color: 1 });
      expect(reDd.children[2].children[0].move).toEqual({ col: 7, row: 7, color: 2 });
    });

    test('KaTrain-style SGF roundtrips correctly', () => {
      const original = '(;B[dd];W[ee](;B[ff])(;B[gg];W[hh])(;B[ii];W[jj]))';
      const parsed = parser.parse(original);

      const state = createState({ sgfTree: parsed.rootNode, currentNodeId: 'root' });
      const exported = parser.export(state);
      const reParsed = parser.parse(exported);

      const setup = reParsed.rootNode.children[0];
      const reDd = setup.children[0];
      expect(reDd.children).toHaveLength(4);
    });
  });
});

describe('GameStore - study mode branch operations', () => {
  const parser = new SGFParser();

  test('parsing a SGF with a branch and exporting preserves the branch structure', () => {
    const sgf = '(;B[dd];W[ee](;B[ff])(;B[gg];W[hh]))';
    const parsed = parser.parse(sgf);

    const root = parsed.rootNode;
    const state = createState({ sgfTree: root, currentNodeId: 'root' });

    const exported = parser.export(state);
    const reParsed = parser.parse(exported);

    // 主ラインは sgfMoves 経由で取得（後方互換の派生情報）
    expect(reParsed.moves).toEqual([
      { col: 3, row: 3, color: 1 },
      { col: 4, row: 4, color: 2 }
    ]);
    expect(reParsed.moves).toHaveLength(2);

    // 木構造: セットアップノード経由でアクセス
    const setup = reParsed.rootNode.children[0];
    const reDd = setup.children[0];
    expect(reDd.children).toHaveLength(3);
  });
});
