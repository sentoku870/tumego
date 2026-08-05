import { DEFAULT_CONFIG } from '../../dist/types.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { BoardCacheManager } from '../../dist/state/board-cache-manager.js';
import { GameInfoStore } from '../../dist/state/game-info-store.js';
import { ModeOperations } from '../../dist/state/mode-operations.js';

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

const silentHistory = () => ({
  save: () => {},
  restore: () => false,
  restoreLast: () => false,
  getList: () => [],
  clear: () => {},
  showHistoryDialog: () => {}
});

const trackHistory = () => {
  const history = new HistoryManager();
  const calls = [];
  const original = history.save.bind(history);
  history.save = (label, state) => {
    calls.push({ label, state });
    original(label, state);
  };
  return { history, calls };
};

describe('ModeOperations', () => {
  let engine, state, cache, modeOps;

  beforeEach(() => {
    engine = new GoEngine();
    state = createState(9);
    cache = new BoardCacheManager(state, engine);
    modeOps = new ModeOperations(state, silentHistory(), cache, new GameInfoStore(state));
  });

  describe('initBoard', () => {
    test('changes boardSize and clears state', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      modeOps.initBoard(13);
      expect(state.boardSize).toBe(13);
      expect(state.board).toHaveLength(13);
      expect(state.sgfMoves).toEqual([]);
      expect(state.mode).toBe('alt');
    });

    test('saves history by default when data exists', () => {
      const { history, calls } = trackHistory();
      const ops = new ModeOperations(state, history, cache, new GameInfoStore(state));
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      ops.initBoard(13);
      const label = calls.length > 0 ? calls[0].label : '';
      expect(label).toContain('路盤');
    });

    test('skipHistory suppresses history save', () => {
      const { history, calls } = trackHistory();
      const ops = new ModeOperations(state, history, cache, new GameInfoStore(state));
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      ops.initBoard(13, { skipHistory: true });
      expect(calls).toHaveLength(0);
    });
  });

  describe('resetForClearAll', () => {
    test('clears board and history when data exists', () => {
      const { history, calls } = trackHistory();
      const ops = new ModeOperations(state, history, cache, new GameInfoStore(state));
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      ops.resetForClearAll();
      expect(state.sgfMoves).toEqual([]);
      expect(calls).toHaveLength(1);
    });

    test('does not save when no data', () => {
      const { history, calls } = trackHistory();
      const ops = new ModeOperations(state, history, cache, new GameInfoStore(state));
      ops.resetForClearAll();
      expect(calls).toHaveLength(0);
    });

    test('SGF 読込後の resetForClearAll で対局情報が全て消える（バグ修正回帰テスト）', () => {
      // SGF 棋譜から読み込まれた対局情報をセットアップ
      state.gameInfo = {
        ...state.gameInfo,
        title: 'テスト棋譜',
        playerBlack: '黒テスト',
        playerWhite: '白テスト',
        result: 'B+R',
      };
      state.komi = 7.5;
      state.handicapStones = 3;

      modeOps.resetForClearAll();

      // 全ての対局情報がリセットされる
      expect(state.gameInfo.title).toBe('');
      expect(state.gameInfo.playerBlack).toBeNull();
      expect(state.gameInfo.playerWhite).toBeNull();
      expect(state.gameInfo.result).toBeNull();
      expect(state.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
      expect(state.handicapStones).toBe(0);
    });

    test('resetForClearAll 後に SGF 拡張フィールド（handicap/boardSize/startColor）も既定値に戻る', () => {
      state.gameInfo = {
        ...state.gameInfo,
        title: 'タイトル',
        handicap: 5,
        handicapStones: 5,
        handicapPositions: [{ col: 0, row: 0 }],
        boardSize: 13,
        startColor: 2,
        problemDiagramSet: true,
        problemDiagramBlack: [{ col: 3, row: 3 }],
      };
      state.sgfLoadedFromExternal = true;

      modeOps.resetForClearAll();

      expect(state.gameInfo.title).toBe('');
      expect(state.gameInfo.handicap).toBeNull();
      expect(state.gameInfo.handicapStones).toBe(0);
      expect(state.gameInfo.handicapPositions).toEqual([]);
      expect(state.problemDiagramSet).toBe(false);
      expect(state.problemDiagramBlack).toEqual([]);
      expect(state.sgfLoadedFromExternal).toBe(false);
    });
  });

  describe('setProblemDiagram / restoreProblemDiagram', () => {
    test('setProblemDiagram captures stones and resets moves', () => {
      state.board[3][3] = 1;
      state.board[5][5] = 2;
      modeOps.setProblemDiagram();
      expect(state.problemDiagramSet).toBe(true);
      expect(state.problemDiagramBlack).toEqual([{ col: 3, row: 3 }]);
      expect(state.problemDiagramWhite).toEqual([{ col: 5, row: 5 }]);
      expect(state.sgfMoves).toEqual([]);
    });

    test('restoreProblemDiagram is no-op when not set', () => {
      state.board[3][3] = 1;
      modeOps.restoreProblemDiagram();
      expect(state.board[3][3]).toBe(1);
    });

    test('restoreProblemDiagram restores problem diagram board', () => {
      state.board[3][3] = 1;
      state.board[5][5] = 2;
      modeOps.setProblemDiagram();
      state.board[0][0] = 1;
      modeOps.restoreProblemDiagram();
      expect(state.board[3][3]).toBe(1);
      expect(state.board[5][5]).toBe(2);
      expect(state.board[0][0]).toBe(0);
    });

    test('hasProblemDiagram returns the flag', () => {
      expect(modeOps.hasProblemDiagram()).toBe(false);
      state.problemDiagramSet = true;
      expect(modeOps.hasProblemDiagram()).toBe(true);
    });
  });

  describe('enterSolveMode / exitSolveModeForEditing', () => {
    test('enterSolveMode enables number mode and clears moves', () => {
      const { history, calls } = trackHistory();
      const ops = new ModeOperations(state, history, cache, new GameInfoStore(state));
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      ops.enterSolveMode();
      expect(state.numberMode).toBe(true);
      expect(state.sgfMoves).toEqual([]);
      expect(state.sgfIndex).toBe(0);
      expect(state.numberStartIndex).toBe(0);
      const label = calls.length > 0 ? calls[0].label : '';
      expect(label).toContain('解答開始前');
    });

    test('enterSolveMode resets captured counts', () => {
      state.capturedCounts = { black: 5, white: 3 };
      modeOps.enterSolveMode();
      expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
    });

    test('exitSolveModeForEditing preserves problem diagram', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.numberMode = true;
      modeOps.exitSolveModeForEditing();
      expect(state.problemDiagramSet).toBe(true);
      expect(state.numberMode).toBe(false);
      expect(state.mode).toBe('alt');
    });

    test('exitSolveModeForEditing restores problem diagram stones onto board', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 2, row: 2 }];
      state.problemDiagramWhite = [{ col: 5, row: 5 }];
      state.board[3][3] = 1;
      state.numberMode = true;
      modeOps.exitSolveModeForEditing();
      expect(state.board[2][2]).toBe(1);
      expect(state.board[5][5]).toBe(2);
      expect(state.board[3][3]).toBe(0);
    });
  });

});
