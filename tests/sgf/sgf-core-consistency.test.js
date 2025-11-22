import { SGFParser } from '../../dist/sgf-parser.js';
import { SGFService } from '../../dist/services/sgf-service.js';
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = DEFAULT_CONFIG.DEFAULT_BOARD_SIZE) => ({
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
  sgfLoadedFromExternal: false
});

const snapshotBoard = (board) => board.map(row => row.slice());

const setupService = () => {
  const state = createState();
  const engine = new GoEngine();
  const history = new HistoryManager(state);
  const store = new GameStore(state, engine, history);
  const parser = new SGFParser();
  const service = new SGFService(parser, store);

  return { state, store, parser, service };
};

describe('SGF Core Consistency', () => {
  test('Test8: SGF 読み込み → 初期盤面構築の正しさ', () => {
    const { state, parser, service } = setupService();
    const sgf = '(;GM[1]SZ[9]KM[6.5]AB[cc][ee]AW[dd])';

    service.apply(parser.parse(sgf));

    expect(state.boardSize).toBe(9);
    expect(state.komi).toBe(6.5);
    expect(state.problemDiagramSet).toBe(true);
    expect(state.problemDiagramBlack).toEqual([
      { col: 2, row: 2 },
      { col: 4, row: 4 }
    ]);
    expect(state.problemDiagramWhite).toEqual([
      { col: 3, row: 3 }
    ]);
    expect(state.handicapStones).toBe(0);
    expect(state.sgfMoves).toHaveLength(0);
    expect(state.sgfIndex).toBe(0);

    expect(state.board[2][2]).toBe(1);
    expect(state.board[4][4]).toBe(1);
    expect(state.board[3][3]).toBe(2);
  });

  test('Test9: SGF 読み込み後の sgfMoves / sgfIndex / turn の整合', () => {
    const { state, parser, service, store } = setupService();
    const sgf = '(;GM[1]SZ[9];B[aa];W[bb];B[cc])';

    service.apply(parser.parse(sgf));

    expect(state.sgfMoves).toHaveLength(3);
    expect(state.sgfIndex).toBe(1);
    expect(state.turn).toBe(1);
    expect(state.board[0][0]).toBe(1);
    expect(state.board[1][1]).toBe(0);
    expect(state.board[2][2]).toBe(0);

    store.setMoveIndex(3);

    expect(state.board[0][0]).toBe(1);
    expect(state.board[1][1]).toBe(2);
    expect(state.board[2][2]).toBe(1);
    expect(state.sgfIndex).toBe(3);
    expect(state.turn).toBe(3);
  });

  test('Test10: SGF 読み込み → setMoveIndex(0) → setMoveIndex(n) の roundtrip', () => {
    const { state, parser, service, store } = setupService();
    const sgf = '(;GM[1]SZ[9];B[aa];W[ab];B[ba])';

    service.apply(parser.parse(sgf));

    expect(state.sgfIndex).toBe(1);

    store.setMoveIndex(0);
    expect(state.board.every(row => row.every(cell => cell === 0))).toBe(true);

    store.setMoveIndex(3);

    const boardAfterSet = snapshotBoard(state.board);
    const rebuilt = store.rebuildBoardFromMoves(state.sgfMoves.length);

    expect(state.board).toEqual(boardAfterSet);
    expect(rebuilt).toEqual(boardAfterSet);
  });

  test('Test11: SGF の export が parse → apply した内容と一致（roundtrip）', () => {
    const { state, parser, service } = setupService();
    const sgf = '(;GM[1]SZ[9]KM[5.5]AB[cc];B[aa];W[bb])';

    service.apply(parser.parse(sgf));

    const initialSnapshot = {
      board: snapshotBoard(state.board),
      sgfMoves: state.sgfMoves.map(move => ({ ...move })),
      komi: state.komi,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: state.problemDiagramBlack.map(pos => ({ ...pos })),
      problemDiagramWhite: state.problemDiagramWhite.map(pos => ({ ...pos })),
      handicapStones: state.handicapStones,
      handicapPositions: state.handicapPositions.map(pos => ({ ...pos })),
      boardSize: state.boardSize,
      sgfIndex: state.sgfIndex,
      startColor: state.startColor
    };

    const exported = service.export();

    service.apply(parser.parse(exported));

    expect({
      board: state.board,
      sgfMoves: state.sgfMoves,
      komi: state.komi,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: state.problemDiagramBlack,
      problemDiagramWhite: state.problemDiagramWhite,
      handicapStones: state.handicapStones,
      handicapPositions: state.handicapPositions,
      boardSize: state.boardSize,
      sgfIndex: state.sgfIndex,
      startColor: state.startColor
    }).toEqual(initialSnapshot);
  });

  test('Test12: HA + AB の特殊パターン（置石 vs 問題図の解釈）', () => {
    const { state, parser, service, store } = setupService();
    const sgf = '(;GM[1]SZ[9]KM[0]HA[2]AB[dd][pp])';

    service.apply(parser.parse(sgf));

    expect(state.handicapStones).toBe(2);
    expect(state.handicapPositions).toEqual([
      { col: 3, row: 3 },
      { col: 15, row: 15 }
    ]);
    expect(state.problemDiagramSet).toBe(false);
    expect(state.startColor).toBe(2);

    expect(state.board[3][3]).toBe(1);

    const boardSnapshot = snapshotBoard(state.board);

    store.setMoveIndex(0);

    expect(state.board).toEqual(boardSnapshot);
  });
});
