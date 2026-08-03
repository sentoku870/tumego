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
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  rootMarkers: [],
  nodeMarkers: [],
});

const createService = (state) => {
  const engine = new GoEngine();
  const history = new HistoryManager();
  const store = new GameStore(state, engine, history);
  return new SGFService(
    new SGFParser(),
    store,
    new SGFIO(new SGFParser()),
    new SGFShare(new SGFParser())
  );
};

const setupSolveModeWithMoves = (state, size = 9) => {
  state.boardSize = size;
  state.board = createBoard(size);
  state.problemDiagramSet = true;
  state.problemDiagramBlack = [{ col: 2, row: 2 }];
  state.problemDiagramWhite = [{ col: 6, row: 6 }];
  state.numberMode = true;
  state.sgfMoves = [
    { col: 0, row: 0, color: 1 },
    { col: 1, row: 1, color: 2 },
  ];
  state.sgfIndex = 2;
  if (size >= 9) {
    state.board[2][2] = 1;
    state.board[6][6] = 2;
  }
};

describe('SGFService.applyGeneratedSgf', () => {
  describe('happy path: SGF placement + finalize after solving', () => {
    test('sets numberMode to false', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      service.applyGeneratedSgf();

      if (state.numberMode !== false) throw new Error('numberMode should be false');
    });

    test('sets sgfLoadedFromExternal to true', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      service.applyGeneratedSgf();

      if (state.sgfLoadedFromExternal !== true) {
        throw new Error('sgfLoadedFromExternal should be true');
      }
    });

    test('preserves sgfMoves', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      service.applyGeneratedSgf();

      if (state.sgfMoves.length !== 2) throw new Error('sgfMoves should have 2');
    });

    test('preserves problemDiagram', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      service.applyGeneratedSgf();

      if (!state.problemDiagramSet) throw new Error('problemDiagramSet should be true');
      if (state.problemDiagramBlack.length !== 1) {
        throw new Error('problemDiagramBlack should have 1');
      }
      if (state.problemDiagramWhite.length !== 1) {
        throw new Error('problemDiagramWhite should have 1');
      }
    });

    test('preserves board size (13x13)', () => {
      const state = createState(13);
      setupSolveModeWithMoves(state, 13);
      const service = createService(state);

      service.applyGeneratedSgf();

      if (state.boardSize !== 13) throw new Error(`expected 13, got ${state.boardSize}`);
      if (state.board.length !== 13) throw new Error('board should be 13x13');
    });

    test('includes sgfText in apply result', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      const result = service.applyGeneratedSgf();

      if (typeof result.sgfText !== 'string') throw new Error('sgfText should be string');
      if (!result.sgfText.includes('SZ[9]')) throw new Error('SZ[9] missing');
      if (!result.sgfText.includes('B[')) throw new Error('B[ missing');
      if (!result.sgfText.includes('W[')) throw new Error('W[ missing');
    });
  });

  describe('history snapshot', () => {
    test('saves history with "before finalize" label', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const engine = new GoEngine();
      const history = new HistoryManager();
      const saveCalls = [];
      history.save = (label, s) => { saveCalls.push({ label, s }); };
      const store = new GameStore(state, engine, history);
      const service = new SGFService(
        new SGFParser(),
        store,
        new SGFIO(new SGFParser()),
        new SGFShare(new SGFParser())
      );

      service.applyGeneratedSgf();

      const finalizeCall = saveCalls.find((c) => c.label.indexOf('SGF確定前') !== -1);
      if (!finalizeCall) throw new Error('SGF確定前 snapshot not saved');
      if (finalizeCall.label.indexOf('2手') === -1) {
        throw new Error(`label should include 2手, got: ${finalizeCall.label}`);
      }
    });

    test('uses "problem-diagram-only" label when no moves', () => {
      const state = createState();
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.numberMode = true;
      state.sgfMoves = [];
      const engine = new GoEngine();
      const history = new HistoryManager();
      const saveCalls = [];
      history.save = (label, s) => { saveCalls.push({ label, s }); };
      const store = new GameStore(state, engine, history);
      const service = new SGFService(
        new SGFParser(),
        store,
        new SGFIO(new SGFParser()),
        new SGFShare(new SGFParser())
      );

      service.applyGeneratedSgf();

      const finalizeCall = saveCalls.find((c) => c.label.indexOf('SGF確定前') !== -1);
      if (!finalizeCall) throw new Error('SGF確定前 snapshot not saved');
      if (finalizeCall.label.indexOf('問題図のみ') === -1) {
        throw new Error(`label should include 問題図のみ, got: ${finalizeCall.label}`);
      }
    });

    test('uses "before-load" label for normal SGF apply', () => {
      const state = createState();
      const engine = new GoEngine();
      const history = new HistoryManager();
      const saveCalls = [];
      history.save = (label, s) => { saveCalls.push({ label, s }); };
      const store = new GameStore(state, engine, history);
      const service = new SGFService(
        new SGFParser(),
        store,
        new SGFIO(new SGFParser()),
        new SGFShare(new SGFParser())
      );

      service.apply({
        moves: [{ col: 0, row: 0, color: 1 }],
        gameInfo: { boardSize: 9 },
      });

      const loadCall = saveCalls.find((c) => c.label.indexOf('SGF読み込み前') !== -1);
      if (!loadCall) throw new Error('SGF読み込み前 snapshot not saved');
    });
  });

  describe('post-finalize robustness', () => {
    test('sgfMoves not destroyed by direct edits after finalize', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      service.applyGeneratedSgf();
      const beforeMoves = state.sgfMoves.slice();

      // 確定後のステートをシミュレート: 盤面を直接編集（sgfMoves には触らない）
      state.board[3][3] = 1;
      state.board[5][5] = 2;

      if (state.sgfMoves.length !== beforeMoves.length) {
        throw new Error('sgfMoves should be preserved');
      }
      for (let i = 0; i < beforeMoves.length; i++) {
        if (state.sgfMoves[i].col !== beforeMoves[i].col) {
          throw new Error(`sgfMoves[${i}].col should be preserved`);
        }
        if (state.sgfMoves[i].row !== beforeMoves[i].row) {
          throw new Error(`sgfMoves[${i}].row should be preserved`);
        }
      }
    });

    test('sgfLoadedFromExternal matches apply() output', () => {
      const state1 = createState();
      setupSolveModeWithMoves(state1);
      const service1 = createService(state1);
      service1.applyGeneratedSgf();

      const state2 = createState();
      setupSolveModeWithMoves(state2);
      const service2 = createService(state2);
      service2.apply({
        moves: [
          { col: 0, row: 0, color: 1 },
          { col: 1, row: 1, color: 2 },
        ],
        gameInfo: { boardSize: 9 },
      });

      if (state1.sgfLoadedFromExternal !== state2.sgfLoadedFromExternal) {
        throw new Error('sgfLoadedFromExternal should match');
      }
      if (state1.numberMode !== state2.numberMode) {
        throw new Error('numberMode should match');
      }
    });
  });

  describe('round-trip: finalize -> export -> re-import restores moves', () => {
    test('re-importing generated SGF restores original moves', () => {
      const state = createState();
      setupSolveModeWithMoves(state);
      const service = createService(state);

      const result = service.applyGeneratedSgf();
      const sgfText = result.sgfText;

      const newState = createState();
      const newService = createService(newState);
      const parsed = newService.parse(sgfText);
      newService.apply(parsed);

      if (newState.sgfMoves.length !== 2) {
        throw new Error(`sgfMoves should have 2, got ${newState.sgfMoves.length}`);
      }
      if (newState.sgfMoves[0].col !== 0) {
        throw new Error(`first move col should be 0, got ${newState.sgfMoves[0].col}`);
      }
      if (newState.sgfMoves[0].color !== 1) {
        throw new Error(`first move color should be 1, got ${newState.sgfMoves[0].color}`);
      }
    });
  });
});