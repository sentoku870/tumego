import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = (size = 9) => {
  const board = createBoard(size);
  board[0][0] = 1;
  board[1][1] = 2;

  const historyBoard = createBoard(size);
  historyBoard[2][2] = 1;

  return {
    boardSize: size,
    board,
    mode: 'white',
    eraseMode: false,
    history: [historyBoard],
    turn: 3,
    sgfMoves: [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 1, color: 2 }
    ],
    numberMode: true,
    startColor: 2,
    sgfIndex: 2,
    numberStartIndex: 1,
    komi: 5.5,
    handicapStones: 2,
    handicapPositions: [
      { col: 2, row: 2 },
      { col: size - 3, row: size - 3 }
    ],
    answerMode: 'white',
    problemDiagramSet: true,
    problemDiagramBlack: [{ col: 3, row: 3 }],
    problemDiagramWhite: [{ col: 4, row: 4 }],
    gameTree: null,
    sgfLoadedFromExternal: true
  };
};

const cloneState = (state) => JSON.parse(JSON.stringify(state));

describe('Integration: SGF import, handicap, and history restore', () => {
  test('restores every field after round trip', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = createState();
    const store = new GameStore(state, engine, history);
    const sgfService = new SGFService(parser, store);

    const baselineDescription = 'baseline snapshot';
    const baselineState = cloneState(state);
    history.save(baselineDescription, state);

    const sgfText = '(;GM[1]FF[4]SZ[9]KM[6.5];B[aa];W[bb])';
    const parsed = parser.parse(sgfText);

    sgfService.apply(parsed);
    store.setHandicap(4);

    expect(state.handicapStones).toBe(4);
    expect(state.komi).toBe(0);

    const baselineEntry = history.getList().find(item => item.description === baselineDescription);
    if (!baselineEntry) {
      throw new Error('baseline snapshot was not saved');
    }

    const restored = history.restore(baselineEntry.index, state);
    expect(restored).toBe(true);
    expect(state).toEqual(baselineState);
    expect(state.komi).toBe(baselineState.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI);
  });
});
