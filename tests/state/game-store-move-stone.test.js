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
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 }
});

describe('GameStore.moveStone', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('正常系', () => {
    test('空の交点に黒石を移動できる', () => {
      state.board[0][0] = 1;
      const result = store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(0);
      expect(state.board[5][5]).toBe(1);
    });

    test('白石を移動できる', () => {
      state.board[3][3] = 2;
      const result = store.moveStone({ col: 3, row: 3 }, { col: 7, row: 8 });
      expect(result).toBe(true);
      expect(state.board[3][3]).toBe(0);
      expect(state.board[8][7]).toBe(2);
    });

    test('移動先に既存石がある場合は上書きする', () => {
      state.board[0][0] = 1;
      state.board[5][5] = 2;
      const result = store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(0);
      expect(state.board[5][5]).toBe(1); // 白を上書き
    });

    test('履歴には記録されない', () => {
      state.board[0][0] = 1;
      const beforeHistoryLength = history.getList().length;
      store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
      const afterHistoryLength = history.getList().length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });
  });

  describe('異常系', () => {
    test('from に石がない場合は false', () => {
      const result = store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
      expect(result).toBe(false);
      expect(state.board[5][5]).toBe(0);
    });

    test('from が盤外（負の値）の場合は false', () => {
      const result = store.moveStone({ col: -1, row: 0 }, { col: 5, row: 5 });
      expect(result).toBe(false);
    });

    test('to が盤外（負の値）の場合は false', () => {
      state.board[0][0] = 1;
      const result = store.moveStone({ col: 0, row: 0 }, { col: -1, row: 0 });
      expect(result).toBe(false);
      // 移動元は変更されない
      expect(state.board[0][0]).toBe(1);
    });

    test('from が盤外（サイズ超過）の場合は false', () => {
      const result = store.moveStone({ col: 9, row: 0 }, { col: 5, row: 5 });
      expect(result).toBe(false);
    });

    test('to が盤外（サイズ超過）の場合は false', () => {
      state.board[0][0] = 1;
      const result = store.moveStone({ col: 0, row: 0 }, { col: 9, row: 9 });
      expect(result).toBe(false);
      expect(state.board[0][0]).toBe(1);
    });

    test('from === to の場合は false', () => {
      state.board[3][3] = 1;
      const result = store.moveStone({ col: 3, row: 3 }, { col: 3, row: 3 });
      expect(result).toBe(false);
      // 石はそのまま残る
      expect(state.board[3][3]).toBe(1);
    });
  });

  describe('エッジケース', () => {
    test('19路盤でも動作する', () => {
      state.boardSize = 19;
      state.board = createBoard(19);
      state.board[0][0] = 1;
      const result = store.moveStone({ col: 0, row: 0 }, { col: 18, row: 18 });
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(0);
      expect(state.board[18][18]).toBe(1);
    });

    test('連続して複数の石を移動できる', () => {
      state.board[0][0] = 1;
      state.board[5][5] = 2;
      store.moveStone({ col: 0, row: 0 }, { col: 1, row: 1 });
      store.moveStone({ col: 5, row: 5 }, { col: 6, row: 6 });
      expect(state.board[0][0]).toBe(0);
      expect(state.board[1][1]).toBe(1);
      expect(state.board[5][5]).toBe(0);
      expect(state.board[6][6]).toBe(2);
    });
  });
});
