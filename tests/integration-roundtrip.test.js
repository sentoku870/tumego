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
    sgfLoadedFromExternal: true,
    gameInfo: {
      title: '',
      komi: 5.5,
      handicap: 2,
      playerBlack: null,
      playerWhite: null,
      result: null,
      boardSize: size,
      handicapStones: 2,
      handicapPositions: [
        { col: 2, row: 2 },
        { col: size - 3, row: size - 3 }
      ],
      startColor: 2,
      problemDiagramSet: true,
      problemDiagramBlack: [{ col: 3, row: 3 }],
      problemDiagramWhite: [{ col: 4, row: 4 }]
    }
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

    const baselineEntry = history.getList().find(item => item.label === baselineDescription);
    if (!baselineEntry) {
      throw new Error('baseline snapshot was not saved');
    }

    const restored = history.restore(baselineEntry.index, state);
    expect(restored).toBe(true);
    expect(state.boardSize).toBe(baselineState.boardSize);
    expect(state.board).toEqual(baselineState.board);
    expect(state.turn).toBe(baselineState.turn);
    expect(state.numberMode).toBe(baselineState.numberMode);
    expect(state.answerMode).toBe(baselineState.answerMode);
    expect(state.problemDiagramSet).toBe(baselineState.problemDiagramSet);
    expect(state.problemDiagramBlack).toEqual(baselineState.problemDiagramBlack);
    expect(state.problemDiagramWhite).toEqual(baselineState.problemDiagramWhite);
    expect(state.handicapStones).toBe(baselineState.handicapStones);
    expect(state.handicapPositions).toEqual(baselineState.handicapPositions);
    expect(state.startColor).toBe(baselineState.startColor);
    expect(state.komi).toBe(baselineState.komi);
  });

  test('keeps SGF header metadata through round trip', () => {
    const parser = new SGFParser();
    const history = new HistoryManager();
    const engine = new GoEngine();
    const state = createState();
    const store = new GameStore(state, engine, history);
    const sgfService = new SGFService(parser, store);

    const sgfText = '(;GM[1]SZ[19]KM[6.5]PB[Black]PW[White]HA[4]RE[B+R];B[dd];W[pq])';
    const parsed = parser.parse(sgfText);

    sgfService.apply(parsed);
    const exported = sgfService.export();

    expect(exported.includes('PB[Black]')).toBe(true);
    expect(exported.includes('PW[White]')).toBe(true);
    expect(exported.includes('KM[6.5]')).toBe(true);
    expect(exported.includes('HA[4]')).toBe(true);
    expect(exported.includes('RE[B+R]')).toBe(true);
  });
});
