import { SGFParser } from '../dist/sgf-parser.js';
import { SGFIO } from '../dist/services/sgf-io.js';
import { SGFShare } from '../dist/services/sgf-share.js';
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
    gameTree: overrides.gameTree ?? null,
    gameInfo: overrides.gameInfo ?? {
      title: overrides.title ?? '',
      komi: overrides.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      handicap: overrides.handicap ?? null,
      playerBlack: overrides.playerBlack ?? null,
      playerWhite: overrides.playerWhite ?? null,
      result: overrides.result ?? null,
      boardSize: size,
      handicapStones: overrides.handicapStones ?? 0,
      handicapPositions: overrides.handicapPositions ?? [],
      startColor: overrides.startColor ?? 1,
      problemDiagramSet: overrides.problemDiagramSet ?? false,
      problemDiagramBlack: overrides.problemDiagramBlack ?? [],
      problemDiagramWhite: overrides.problemDiagramWhite ?? []
    }
  };
};

const includes = (haystack, needle) => typeof haystack === 'string' && haystack.includes(needle);
const notIncludes = (haystack, needle) => typeof haystack === 'string' && !haystack.includes(needle);

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

  test('parses header metadata without altering moves', () => {
    const sgf = '(;GM[1]SZ[19]KM[6.5]PB[Black]PW[White]HA[4]RE[B+R];B[dd];W[pq])';
    const result = parser.parse(sgf);

    expect(result.gameInfo.playerBlack).toBe('Black');
    expect(result.gameInfo.playerWhite).toBe('White');
    expect(result.gameInfo.komi).toBe(6.5);
    expect(result.gameInfo.handicap).toBe(4);
    expect(result.gameInfo.result).toBe('B+R');
  });

  test('handles missing or invalid header values gracefully', () => {
    const sgf = '(;GM[1]SZ[19]PB[]PW[]HA[invalid]RE[];B[aa])';
    const result = parser.parse(sgf);

    expect(result.gameInfo.playerBlack).toBeNull();
    expect(result.gameInfo.playerWhite).toBeNull();
    expect(result.gameInfo.handicap).toBeNull();
    expect(result.gameInfo.result).toBeNull();
    expect(result.gameInfo.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
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

  test('does not bleed AW coordinates into AB collection (B2 fix)', () => {
    // 旧正規表現だと貪欲マッチで AB[aa][bb][cc] を 1 つの AB として拾い、
    // 白の [cc] まで黒の初期石として取り込んでしまっていた。
    const sgf = '(;GM[1]SZ[9]AB[aa][bb]AW[cc])';
    const result = parser.parse(sgf);

    expect(result.gameInfo.problemDiagramBlack).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 1 }
    ]);
    expect(result.gameInfo.problemDiagramWhite).toEqual([
      { col: 2, row: 2 }
    ]);
  });

  test('respects node boundaries for AB/AW setup', () => {
    // 複数ノードにまたがる AB/AW プロパティが混ざらないこと
    const sgf = '(;GM[1]SZ[9]AB[aa];AW[bb];AB[cc];AW[dd])';
    const result = parser.parse(sgf);

    expect(result.gameInfo.problemDiagramBlack).toEqual([
      { col: 0, row: 0 },
      { col: 2, row: 2 }
    ]);
    expect(result.gameInfo.problemDiagramWhite).toEqual([
      { col: 1, row: 1 },
      { col: 3, row: 3 }
    ]);
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
    expect(sgf.includes('HA[2]')).toBe(true);
    expect(sgf.includes('AB[cc][gg]')).toBe(true);
    expect(sgf.includes(';B[aa];W[bb]')).toBe(true);
  });
});

describe('SGFParser export()', () => {
  const parser = new SGFParser();

  test('emits standard format with KM for empty 9x9 board', () => {
    const state = createState();
    const sgf = parser.export(state);
    expect(sgf.startsWith('(;GM[1]FF[4]SZ[9]')).toBe(true);
    expect(sgf.includes('KM[6.5]')).toBe(true);
  });

  test('encodes stone position via charCode (aa = 0,0)', () => {
    const state = createState({ sgfMoves: [{ col: 0, row: 0, color: 1 }] });
    const sgf = parser.export(state);
    expect(sgf.includes(';B[aa]')).toBe(true);
  });

  test('encodes W move for color=2', () => {
    const state = createState({ sgfMoves: [{ col: 3, row: 4, color: 2 }] });
    const sgf = parser.export(state);
    expect(sgf.includes(';W[de]')).toBe(true);
  });

  test('omits KM when komi is null', () => {
    const state = createState();
    state.komi = null;
    state.gameInfo = { ...state.gameInfo, komi: null };
    const sgf = parser.export(state);
    expect(notIncludes(sgf, 'KM[')).toBe(true);
  });

  test('includes GN when title is set', () => {
    const state = createState({ title: 'My Problem' });
    const sgf = parser.export(state);
    expect(sgf.includes('GN[My Problem]')).toBe(true);
  });

  test('omits GN when title is empty', () => {
    const state = createState({ title: '' });
    const sgf = parser.export(state);
    expect(notIncludes(sgf, 'GN[')).toBe(true);
  });

  test('emits AB for problem diagram black stones', () => {
    const state = createState({
      problemDiagramSet: true,
      problemDiagramBlack: [{ col: 0, row: 0 }, { col: 8, row: 8 }]
    });
    const sgf = parser.export(state);
    expect(sgf.includes('AB[aa][ii]')).toBe(true);
  });

  test('emits AW for problem diagram white stones', () => {
    const state = createState({
      problemDiagramSet: true,
      problemDiagramWhite: [{ col: 4, row: 4 }]
    });
    const sgf = parser.export(state);
    expect(sgf.includes('AW[ee]')).toBe(true);
  });

  test('does not emit AW when problemDiagramSet is false', () => {
    const state = createState({
      problemDiagramSet: false,
      problemDiagramWhite: [{ col: 4, row: 4 }]
    });
    const sgf = parser.export(state);
    expect(notIncludes(sgf, 'AW[')).toBe(true);
  });

  test('includes PB/PW/RE when set', () => {
    const state = createState({
      playerBlack: '黒',
      playerWhite: '白',
      result: 'B+R'
    });
    const sgf = parser.export(state);
    expect(sgf.includes('PB[黒]')).toBe(true);
    expect(sgf.includes('PW[白]')).toBe(true);
    expect(sgf.includes('RE[B+R]')).toBe(true);
  });

  test('produces round-trip consistent output for simple game', () => {
    const original = '(;GM[1]FF[4]SZ[9]KM[6.5];B[dd];W[pp])';
    const parsed = parser.parse(original);
    const reexported = parser.export(createState({
      boardSize: parsed.gameInfo.boardSize,
      komi: parsed.gameInfo.komi,
      sgfMoves: parsed.moves
    }));
    expect(reexported.includes(';B[dd]')).toBe(true);
    expect(reexported.includes(';W[pp]')).toBe(true);
    expect(reexported.includes('KM[6.5]')).toBe(true);
  });
});

describe('SGFShare encode/decode URL', () => {
  const parser = new SGFParser();
  const share = new SGFShare(parser);

  test('round-trips SGF through Base64', () => {
    const sgf = '(;GM[1]FF[4]SZ[9];B[dd])';
    const encoded = share.encodeForURL(sgf);
    const decoded = share.decodeFromURL(encoded);
    expect(decoded).toBe(sgf);
  });

  test('encodeForURL returns non-empty for valid SGF', () => {
    const result = share.encodeForURL('(;B[aa])');
    expect(result.length > 0).toBe(true);
  });

  test('decodeFromURL handles non-base64 strings gracefully', () => {
    const result = share.decodeFromURL('###invalid###');
    expect(result).toBe('');
  });

  test('encodes special characters in SGF', () => {
    const sgf = '(;GM[1]FF[4]SZ[9]GN[Title with spaces];B[aa])';
    const encoded = share.encodeForURL(sgf);
    expect(encoded.length > 0).toBe(true);
  });
});

describe('SGFIO loadFromClipboard()', () => {
  const parser = new SGFParser();
  const io = new SGFIO(parser);

  test('parses SGF from clipboard', async () => {
    const sgf = '(;GM[1]FF[4]SZ[9];B[dd])';
    global.navigator.clipboard = { readText: async () => sgf };
    const result = await io.loadFromClipboard();
    expect(result.moves).toEqual([{ col: 3, row: 3, color: 1 }]);
  });

  test('returns result on empty clipboard (with trim check)', async () => {
    global.navigator.clipboard = { readText: async () => '   ' };
    let threw = false;
    try {
      await io.loadFromClipboard();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe('SGFIO copyToClipboard()', () => {
  const parser = new SGFParser();
  const io = new SGFIO(parser);

  test('writes to clipboard via API when available', async () => {
    let written = null;
    global.navigator.clipboard = { writeText: async (t) => { written = t; } };
    await io.copyToClipboard('(;B[aa])');
    expect(written).toBe('(;B[aa])');
  });

  test('returns without throwing on success', async () => {
    global.navigator.clipboard = { writeText: async () => undefined };
    let threw = false;
    try {
      await io.copyToClipboard('test data');
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test('falls back when clipboard API missing', async () => {
    const origClipboard = global.navigator.clipboard;
    global.navigator.clipboard = undefined;
    let threw = false;
    try {
      await io.copyToClipboard('test');
    } catch (e) {
      threw = true;
    }
    global.navigator.clipboard = origClipboard;
  });
});

describe('SGFIO saveToFile()', () => {
  const parser = new SGFParser();
  const io = new SGFIO(parser);

  test('returns a Promise', () => {
    global.window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => {},
        close: async () => {}
      })
    });
    const result = io.saveToFile('test', 'x.sgf');
    expect(result instanceof Promise).toBe(true);
    delete global.window.showSaveFilePicker;
  });

  test('does not throw on AbortError', async () => {
    global.window.showSaveFilePicker = async () => {
      const err = new Error('cancelled');
      err.name = 'AbortError';
      throw err;
    };
    let threw = false;
    try {
      await io.saveToFile('test');
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    delete global.window.showSaveFilePicker;
  });

  test('generates timestamp-based default filename format', () => {
    const now = new Date(2026, 5, 24, 10, 30);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const expected = `${yyyy}${mm}${dd}_${hh}${min}.sgf`;
    expect(expected).toBe('20260624_1030.sgf');
  });

  test('uses showSaveFilePicker when available', async () => {
    let writeCalled = false;
    let closeCalled = false;
    global.window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => { writeCalled = true; },
        close: async () => { closeCalled = true; }
      })
    });
    await io.saveToFile('(;B[aa])', 'test.sgf');
    expect(writeCalled).toBe(true);
    expect(closeCalled).toBe(true);
    delete global.window.showSaveFilePicker;
  });
});

describe('SGFShare createShareURL()', () => {
  const parser = new SGFParser();
  const share = new SGFShare(parser);

  test('returns URL containing ?sgf=', () => {
    const url = share.createShareURL('(;B[aa])');
    expect(url.includes('?sgf=')).toBe(true);
  });

  test('accepts custom baseURL', () => {
    const url = share.createShareURL('(;B[aa])', 'https://example.com/path');
    expect(url.includes('https://example.com/path')).toBe(true);
  });

  test('uses provided baseURL when given', () => {
    const url = share.createShareURL('(;B[aa])', 'https://my-site.com/page');
    expect(url.startsWith('https://my-site.com/page?sgf=')).toBe(true);
  });

  test('encoded part is non-empty Base64', () => {
    const sgf = '(;GM[1]FF[4]SZ[9];B[dd])';
    const url = share.createShareURL(sgf, 'https://example.com/path');
    const encoded = url.split('?sgf=')[1];
    expect(encoded.length > 0).toBe(true);
    const decoded = share.decodeFromURL(encoded);
    expect(decoded).toBe(sgf);
  });
});

describe('SGFShare loadFromURL()', () => {
  const parser = new SGFParser();
  const share = new SGFShare(parser);

  test('returns parsed SGF when sgf param present (via mock URLSearchParams)', () => {
    const sgf = '(;GM[1]FF[4]SZ[9];B[dd])';
    const encoded = btoa(sgf);
    const origParams = global.URLSearchParams;
    global.URLSearchParams = class {
      get(key) {
        return key === 'sgf' ? encoded : null;
      }
    };
    const origReplaceState = global.window.history.replaceState;
    global.window.history.replaceState = () => {};
    const result = share.loadFromURL();
    expect(result).not.toBeNull();
    expect(result.moves.length).toBe(1);
    global.URLSearchParams = origParams;
    global.window.history.replaceState = origReplaceState;
  });

  test('returns null when sgf param missing (via mock URLSearchParams)', () => {
    const origParams = global.URLSearchParams;
    global.URLSearchParams = class {
      get() { return null; }
    };
    const result = share.loadFromURL();
    expect(result).toBeNull();
    global.URLSearchParams = origParams;
  });

  test('returns SGFParseResult with empty moves on invalid base64', () => {
    const origParams = global.URLSearchParams;
    global.URLSearchParams = class {
      get() { return '!!!invalid!!!'; }
    };
    const origReplaceState = global.window.history.replaceState;
    global.window.history.replaceState = () => {};
    const result = share.loadFromURL();
    expect(result).not.toBeNull();
    expect(result.moves.length).toBe(0);
    global.URLSearchParams = origParams;
    global.window.history.replaceState = origReplaceState;
  });

  test('clears URL parameter after successful load', () => {
    const sgf = '(;GM[1]FF[4]SZ[9])';
    const encoded = btoa(sgf);
    const origParams = global.URLSearchParams;
    global.URLSearchParams = class {
      get(key) {
        return key === 'sgf' ? encoded : null;
      }
    };
    let replaceCalled = false;
    const origReplaceState = global.window.history.replaceState;
    global.window.history.replaceState = () => { replaceCalled = true; };
    share.loadFromURL();
    expect(replaceCalled).toBe(true);
    global.URLSearchParams = origParams;
    global.window.history.replaceState = origReplaceState;
  });
});

describe('SGFIO loadFromFile()', () => {
  const parser = new SGFParser();
  const io = new SGFIO(parser);

  test('returns a Promise', () => {
    const file = new Blob(['(;B[aa])'], { type: 'application/x-go-sgf' });
    const result = io.loadFromFile(file);
    expect(result instanceof Promise).toBe(true);
  });

  test('reads file and parses SGF content', async () => {
    global.FileReader = class {
      readAsText(file) {
        setTimeout(() => {
          this.result = '(;GM[1]FF[4]SZ[9];B[dd])';
          this.onload();
        }, 0);
      }
    };
    const file = new Blob(['(;GM[1]FF[4]SZ[9];B[dd])'], { type: 'application/x-go-sgf' });
    const result = await io.loadFromFile(file);
    expect(result.moves.length).toBe(1);
    expect(result.moves[0]).toEqual({ col: 3, row: 3, color: 1 });
  });
});
