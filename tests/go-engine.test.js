import { GoEngine } from '../dist/go-engine.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createState = (board, overrides = {}) => ({
  boardSize: board.length,
  board: board.map(row => row.slice()),
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
  koPoint: null,
  ...overrides,
});

const emptyBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));
const placeStones = (board, coords, color) => {
  coords.forEach(({ col, row }) => {
    board[row][col] = color;
  });
  return board;
};

const cloneBoard = (board) => board.map(row => row.slice());

describe('GoEngine', () => {
  const engine = new GoEngine();

  test('captures surrounded stones when a liberty is filled', () => {
    const state = createState([
      [0, 1, 0],
      [1, 2, 0],
      [0, 1, 0]
    ]);

    const result = engine.playMove(state, { col: 2, row: 1 }, 1);
    expect(result).not.toBeNull();

    const board = result.board;
    expect(board[1][1]).toBe(0);
    expect(board[1][2]).toBe(1);
    expect(state.board[1][1]).toBe(2);
  });

  test('rejects suicide moves that do not capture opponents', () => {
    const board = [
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
      [0, 2, 0, 2, 0],
      [0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0]
    ];
    const state = createState(board);

    const result = engine.playMove(state, { col: 2, row: 2 }, 1);
    expect(result).toBeNull();
  });

  test('provides handicap stones for supported board sizes', () => {
    const positions = engine.generateHandicapPositions(9, 4);
    expect(positions).toHaveLength(4);
    expect(positions).toEqual([
      { col: 6, row: 2 },
      { col: 2, row: 2 },
      { col: 6, row: 6 },
      { col: 2, row: 6 }
    ]);
  });

  test('returns an empty array for unsupported handicap requests', () => {
    expect(engine.generateHandicapPositions(10, 2)).toEqual([]);
    expect(engine.generateHandicapPositions(9, 42)).toEqual([]);
  });

  describe('capture scenarios', () => {
    test('C1: captures a single stone in the middle of the board', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 2, row: 2 } // White stone with last liberty below
      ], 2);

      placeStones(board, [
        { col: 2, row: 1 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 3 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0); // captured
      expect(result.board[3][2]).toBe(1); // new black stone
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });

    test('C2: captures a single edge stone', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 2, row: 0 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 0 },
        { col: 3, row: 0 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      const expected = placeStones(cloneBoard(board), [
        { col: 2, row: 1 }
      ], 1);
      expected[0][2] = 0;

      expect(result.board).toEqual(expected);
    });

    test('C3: captures a single corner stone', () => {
      const board = placeStones(emptyBoard(5), [
        { col: 0, row: 0 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 0 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 0, row: 1 }, 1);

      expect(result).not.toBeNull();
      const expected = placeStones(cloneBoard(board), [
        { col: 0, row: 1 }
      ], 1);
      expected[0][0] = 0;

      expect(result.board).toEqual(expected);
    });

    test('C4: captures a two-stone connected group with one liberty', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 2 },
        { col: 2, row: 3 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 2 }, { col: 3, row: 2 },
        { col: 1, row: 3 }, { col: 3, row: 3 },
        { col: 2, row: 4 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0);
      expect(result.board[3][2]).toBe(0);
      expect(result.board[1][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });

    test('C5: captures two separate groups that share a liberty', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 1, row: 1 },
        { col: 3, row: 1 }
      ], 2);

      placeStones(board, [
        { col: 0, row: 1 }, { col: 1, row: 0 }, { col: 1, row: 2 },
        { col: 4, row: 1 }, { col: 3, row: 0 }, { col: 3, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 1 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[1][1]).toBe(0);
      expect(result.board[1][3]).toBe(0);
      expect(result.board[1][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });
  });

  describe('suicide detection', () => {
    test('S1: rejects pure suicide when no capture occurs', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 1 },
        { col: 2, row: 3 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 2);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 2 }, 1);

      expect(result).toBeNull();
      expect(state.board).toEqual(board);
    });

    test('S2: allows move that looks suicidal but captures adjacent groups', () => {
      const board = emptyBoard(5);
      placeStones(board, [
        { col: 2, row: 1 },
        { col: 2, row: 3 },
        { col: 1, row: 2 },
        { col: 3, row: 2 }
      ], 2);

      placeStones(board, [
        { col: 1, row: 1 }, { col: 3, row: 1 }, { col: 2, row: 0 },
        { col: 1, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 4 },
        { col: 0, row: 2 }, { col: 4, row: 2 }
      ], 1);

      const state = createState(board);
      const result = engine.playMove(state, { col: 2, row: 2 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[1][2]).toBe(0);
      expect(result.board[3][2]).toBe(0);
      expect(result.board[2][1]).toBe(0);
      expect(result.board[2][3]).toBe(0);
      expect(result.board[2][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(0);
    });
  });

  describe('simple ko (intended behavior)', () => {
    const buildKoBase = () => {
      const board = emptyBoard(5);
      // White stone at (2,2) with one liberty at (2,3)
      placeStones(board, [{ col: 2, row: 2 }], 2);
      // Surrounding black stones
      placeStones(board, [
        { col: 1, row: 2 }, { col: 3, row: 2 }, { col: 2, row: 1 }
      ], 1);
      // White stones that will leave the capturing stone with only the ko liberty
      placeStones(board, [
        { col: 1, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 4 }
      ], 2);
      return board;
    };

    test('K1: first capture that creates ko is legal', () => {
      const state = createState(buildKoBase());
      const result = engine.playMove(state, { col: 2, row: 3 }, 1);

      expect(result).not.toBeNull();
      expect(result.board[2][2]).toBe(0);
      expect(result.board[3][2]).toBe(1);
      expect(result.board.flat().filter(v => v === 2)).toHaveLength(3);
      // No ko metadata exists yet; future implementation should mark (2,2) as ko point
    });

    test('K2: immediate recapture at ko point should be illegal (intended)', () => {
      const firstState = createState(buildKoBase());
      const afterCapture = engine.playMove(firstState, { col: 2, row: 3 }, 1);
      const koBoard = afterCapture?.board ?? [];

      // koPoint は state に保持される。次の state にも引き継ぐ。
      const recaptureState = createState(koBoard, { koPoint: firstState.koPoint });
      const recapture = engine.playMove(recaptureState, { col: 2, row: 2 }, 2);

      expect(recapture).toBeNull();
      expect(recaptureState.board).toEqual(koBoard);
    });

    test('K3: recapture becomes legal after a move elsewhere (intended)', () => {
      const firstState = createState(buildKoBase());
      const afterCapture = engine.playMove(firstState, { col: 2, row: 3 }, 1);
      const koBoard = afterCapture?.board ?? [];

      const moveElsewhereState = createState(koBoard, { koPoint: firstState.koPoint });
      const elsewhere = engine.playMove(moveElsewhereState, { col: 0, row: 0 }, 2);
      expect(elsewhere).not.toBeNull();

      const recaptureState = createState(elsewhere.board, { koPoint: moveElsewhereState.koPoint });
      const recapture = engine.playMove(recaptureState, { col: 2, row: 2 }, 2);

      expect(recapture).not.toBeNull();
      expect(recapture.board[3][2]).toBe(0);
      expect(recapture.board[2][2]).toBe(2);
    });
  });

  describe('snapback (multi-stone capturing group)', () => {
    // Regression: when the capturing group contains multiple stones,
    // a 1-stone / 1-liberty capture is a legitimate snapback-style
    // recapture and must NOT be marked as ko. Without the fix, koPoint
    // is incorrectly set to the captured point and the immediate
    // recapture is rejected as a ko violation.
    test('SB1: minimal 3x3 reproduction of multi-stone capture not being ko', () => {
      // 3x3 board: 8 black stones surround white at center,
      // black's only liberty is the captured point.
      const board = emptyBoard(3);
      placeStones(board, [
        { col: 0, row: 0 }, { col: 2, row: 0 },
        { col: 0, row: 1 }, { col: 2, row: 1 },
        { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 }
      ], 1);
      placeStones(board, [{ col: 1, row: 1 }], 2);

      const state = createState(board);
      const result = engine.playMove(state, { col: 1, row: 0 }, 1);

      expect(result).not.toBeNull();
      expect(result.captured).toHaveLength(1);
      expect(result.koPoint).toBeNull();

      const recaptureState = createState(result.board);
      const recapture = engine.playMove(recaptureState, { col: 1, row: 1 }, 2);

      expect(recapture).not.toBeNull();
      expect(recapture.captured.length > 1).toBe(true);
    });

    test('SB2: simple ko with single-stone group still sets koPoint', () => {
      // Regression guard: real ko (single-stone capturing group) still works.
      const buildBase = () => {
        const b = emptyBoard(5);
        placeStones(b, [{ col: 2, row: 2 }], 2);
        placeStones(b, [
          { col: 1, row: 2 }, { col: 3, row: 2 }, { col: 2, row: 1 }
        ], 1);
        placeStones(b, [
          { col: 1, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 4 }
        ], 2);
        return b;
      };
      const state = createState(buildBase());
      const result = engine.playMove(state, { col: 2, row: 3 }, 1);

      expect(result).not.toBeNull();
      expect(result.koPoint).toEqual({ col: 2, row: 2 });
    });

    test('SB3: 13x13 reproduction from user SGF (B[hm] captures J1 then white recaptures at J1)', () => {
      // Reproduces the 13x13 problem reported by the user:
      //   (;GM[1]FF[4]SZ[13]KM[6.5]
      //     AB[ih][jh][kh][hi][li][hj][lj][dk][ek][fk][gk][hk][lk][ll][jm][lm]
      //     AW[kk][gl][hl][kl][im][km]
      //     ;B[gm];W[fl];B[el];W[fm];B[il];W[ik];B[hm])
      //
      // Move 7: B[hm] = H1, captures the white stone at J1 (state.board[12][8])
      // because H1/G1/J2/K1 surround it.
      // The merged black group (G1)(H1) has only the captured point J1 as
      // its liberty. Without the fix, koPoint is set to J1 and the immediate
      // white recapture at J1 is rejected as a ko violation.
      const board = emptyBoard(13);

      // AB (black setup)
      placeStones(board, [
        { col: 8, row: 7 }, { col: 9, row: 7 }, { col: 10, row: 7 },
        { col: 7, row: 8 }, { col: 11, row: 8 },
        { col: 7, row: 9 }, { col: 11, row: 9 },
        { col: 3, row: 10 }, { col: 4, row: 10 }, { col: 5, row: 10 }, { col: 6, row: 10 }, { col: 7, row: 10 },
        { col: 11, row: 10 }, { col: 11, row: 11 }, { col: 9, row: 12 }, { col: 11, row: 12 }
      ], 1);
      // AW (white setup)
      placeStones(board, [
        { col: 10, row: 10 },
        { col: 6, row: 11 }, { col: 7, row: 11 }, { col: 10, row: 11 },
        { col: 8, row: 12 }, { col: 10, row: 12 }
      ], 2);

      // Apply moves 1-6
      const moves = [
        { col: 6, row: 12, color: 1 }, // 1: G1
        { col: 5, row: 11, color: 2 }, // 2: F2
        { col: 4, row: 11, color: 1 }, // 3: E2
        { col: 5, row: 12, color: 2 }, // 4: F1
        { col: 8, row: 11, color: 1 }, // 5: J2
        { col: 8, row: 10, color: 2 }   // 6: J3
      ];

      let cur = board;
      for (const m of moves) {
        const state = createState(cur);
        const result = engine.playMove(state, { col: m.col, row: m.row }, m.color);
        expect(result).not.toBeNull();
        cur = result.board;
      }

      // Move 7: B[hm] = H1 (col 7, row 12) captures white J1.
      const beforeMove7 = cur;
      const move7State = createState(beforeMove7);
      const move7 = engine.playMove(move7State, { col: 7, row: 12 }, 1);

      expect(move7).not.toBeNull();
      expect(move7.captured).toHaveLength(1);
      // Without the fix, koPoint would be { col: 8, row: 12 } (J1).
      // With the fix, the multi-stone capturing group means no ko.
      expect(move7.koPoint).toBeNull();

      // After move 7, the merged black group (G1)(H1) has 2 stones and
      // its only liberty is the captured point J1. White recapturing at
      // J1 takes both stones (snapback), which is legal.
      const afterMove7State = createState(move7.board);
      const recapture = engine.playMove(afterMove7State, { col: 8, row: 12 }, 2);

      expect(recapture).not.toBeNull();
      expect(recapture.captured.length).toBe(2);
      expect(recapture.board[12][6]).toBe(0); // G1 cleared
      expect(recapture.board[12][7]).toBe(0); // H1 cleared
      expect(recapture.board[12][8]).toBe(2); // J1 is white
    });

    test('SB4: 13x13 reproduction from updated SGF (white-first setup with G1 in AB)', () => {
      // Updated SGF provided by the user (white-first, G1 is part of AB):
      //   (;GM[1]FF[4]SZ[13]KM[6.5]
      //     AB[ih][jh][kh][hi][li][hj][lj][dk][ek][fk][gk][hk][lk][ll][gm][jm][lm]
      //     AW[kk][gl][hl][kl][im][km]
      //     ;W[fl];B[el];W[fm];B[il];W[ik];B[hm])
      //
      // Move 6: B[hm] = H1 (col 7, row 12) captures white J1.
      // The merged black group (G1)(H1) has 2 stones and only J1 as liberty.
      // White recapturing at J1 takes both stones (snapback).
      const board = emptyBoard(13);

      // AB (black setup, includes G1)
      placeStones(board, [
        { col: 8, row: 7 }, { col: 9, row: 7 }, { col: 10, row: 7 },
        { col: 7, row: 8 }, { col: 11, row: 8 },
        { col: 7, row: 9 }, { col: 11, row: 9 },
        { col: 3, row: 10 }, { col: 4, row: 10 }, { col: 5, row: 10 }, { col: 6, row: 10 }, { col: 7, row: 10 },
        { col: 11, row: 10 }, { col: 11, row: 11 },
        { col: 6, row: 12 }, // G1
        { col: 9, row: 12 }, { col: 11, row: 12 }
      ], 1);
      // AW (white setup)
      placeStones(board, [
        { col: 10, row: 10 },
        { col: 6, row: 11 }, { col: 7, row: 11 }, { col: 10, row: 11 },
        { col: 8, row: 12 }, { col: 10, row: 12 }
      ], 2);

      // Apply moves 1-5 (white-first)
      const moves = [
        { col: 5, row: 11, color: 2 }, // 1: F2
        { col: 4, row: 11, color: 1 }, // 2: E2
        { col: 5, row: 12, color: 2 }, // 3: F1
        { col: 8, row: 11, color: 1 }, // 4: J2
        { col: 8, row: 10, color: 2 }   // 5: J3
      ];

      let cur = board;
      for (const m of moves) {
        const state = createState(cur);
        const result = engine.playMove(state, { col: m.col, row: m.row }, m.color);
        expect(result).not.toBeNull();
        cur = result.board;
      }

      // Move 6: B[hm] = H1 (col 7, row 12) captures white J1.
      const move6 = engine.playMove(createState(cur), { col: 7, row: 12 }, 1);

      expect(move6).not.toBeNull();
      expect(move6.captured).toHaveLength(1);
      // With the fix: koPoint must be null (multi-stone capturing group).
      expect(move6.koPoint).toBeNull();

      // Move 7: W[im] = J1 takes the 2-stone black group (snapback).
      const move7 = engine.playMove(createState(move6.board), { col: 8, row: 12 }, 2);

      expect(move7).not.toBeNull();
      expect(move7.captured.length).toBe(2);
      expect(move7.board[12][6]).toBe(0); // G1 cleared
      expect(move7.board[12][7]).toBe(0); // H1 cleared
      expect(move7.board[12][8]).toBe(2); // J1 is white
    });

    test('SB5: 13x13 double-snapback reproduction (W[J1] recaptures G1+H1, then B[H1] recaptures J1)', () => {
      // SGF provided by the user (double-snapback structure):
      //   (;GM[1]FF[4]SZ[13]KM[6.5]
      //     AB[dk][ek][fk][gk][gm][hi][hj][hk][ih][jh][jm][kh][li][lj][lk][ll][lm]
      //     AW[gl][hl][im][kk][kl][km]
      //     ;W[fl];B[el];W[fm];B[il];W[ik];B[hm];W[im];B[hm])
      //
      // Move 6: B[hm] = H1 captures J1 (snapback setup)
      // Move 7: W[im] = J1 captures G1+H1 (snapback)
      // Move 8: B[hm] = H1 captures J1 again (re-snapback)
      const board = emptyBoard(13);

      // AB (black setup, includes G1)
      placeStones(board, [
        { col: 3, row: 10 }, { col: 4, row: 10 }, { col: 5, row: 10 }, { col: 6, row: 10 },
        { col: 6, row: 12 }, // G1
        { col: 7, row: 8 }, { col: 7, row: 9 }, { col: 7, row: 10 },
        { col: 8, row: 7 }, { col: 9, row: 7 }, { col: 9, row: 12 }, { col: 10, row: 7 },
        { col: 11, row: 8 }, { col: 11, row: 9 }, { col: 11, row: 10 }, { col: 11, row: 11 }, { col: 11, row: 12 }
      ], 1);
      // AW (white setup)
      placeStones(board, [
        { col: 6, row: 11 }, { col: 7, row: 11 },
        { col: 8, row: 12 }, // J1
        { col: 10, row: 10 }, { col: 10, row: 11 }, { col: 10, row: 12 }
      ], 2);

      // Apply moves 1-5 (white-first)
      const moves = [
        { col: 5, row: 11, color: 2 }, // 1: F2
        { col: 4, row: 11, color: 1 }, // 2: E2
        { col: 5, row: 12, color: 2 }, // 3: F1
        { col: 8, row: 11, color: 1 }, // 4: J2
        { col: 8, row: 10, color: 2 }   // 5: J3
      ];

      let cur = board;
      for (const m of moves) {
        const state = createState(cur);
        const result = engine.playMove(state, { col: m.col, row: m.row }, m.color);
        expect(result).not.toBeNull();
        cur = result.board;
      }

      // Move 6: B[hm] = H1 (col 7, row 12) captures white J1.
      const move6 = engine.playMove(createState(cur), { col: 7, row: 12 }, 1);

      expect(move6).not.toBeNull();
      expect(move6.captured).toHaveLength(1);
      // With the fix: koPoint must be null (multi-stone capturing group).
      expect(move6.koPoint).toBeNull();

      // Move 7: W[im] = J1 takes the 2-stone black group (snapback).
      const move7 = engine.playMove(createState(move6.board), { col: 8, row: 12 }, 2);

      expect(move7).not.toBeNull();
      expect(move7.captured.length).toBe(2);
      expect(move7.board[12][6]).toBe(0); // G1 cleared
      expect(move7.board[12][7]).toBe(0); // H1 cleared
      expect(move7.board[12][8]).toBe(2); // J1 is white

      // Move 8: B[hm] = H1 (col 7, row 12) takes white J1 again (re-snapback).
      const move8 = engine.playMove(createState(move7.board), { col: 7, row: 12 }, 1);

      expect(move8).not.toBeNull();
      expect(move8.captured).toHaveLength(1);
      // The black stone is now a single stone (H1 only) with 2 liberties
      // (G1 and J1 are both empty). So koPoint must be null.
      expect(move8.koPoint).toBeNull();
      expect(move8.board[12][7]).toBe(1); // H1 is black
      expect(move8.board[12][8]).toBe(0); // J1 cleared (captured)
    });
  });
});
