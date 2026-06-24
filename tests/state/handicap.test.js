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
  gameTree: null,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 }
});

describe('GameStore handicap', () => {
  let engine, state, history, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('setHandicap "even" mode', () => {
    test('sets komi to default', () => {
      state.komi = 0;
      store.setHandicap('even');
      expect(state.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
    });

    test('sets startColor to black (1)', () => {
      state.startColor = 2;
      store.setHandicap('even');
      expect(state.startColor).toBe(1);
    });

    test('clears handicap positions', () => {
      store.setHandicap('even');
      expect(state.handicapStones).toBe(0);
      expect(state.handicapPositions).toEqual([]);
    });

    test('clears board', () => {
      state.board[0][0] = 1;
      store.setHandicap('even');
      const allEmpty = state.board.every((row) => row.every((cell) => cell === 0));
      expect(allEmpty).toBe(true);
    });
  });

  describe('setHandicap(0) - no-komi equivalent', () => {
    test('sets komi to 0', () => {
      state.komi = 6.5;
      store.setHandicap(0);
      expect(state.komi).toBe(0);
    });

    test('sets startColor to black (1)', () => {
      state.startColor = 2;
      store.setHandicap(0);
      expect(state.startColor).toBe(1);
    });

    test('clears handicap positions', () => {
      store.setHandicap(0);
      expect(state.handicapStones).toBe(0);
      expect(state.handicapPositions).toEqual([]);
    });
  });

  describe('setHandicap numeric mode (2 stones on 9x9)', () => {
    test('places 2 handicap stones', () => {
      store.setHandicap(2);
      expect(state.handicapStones).toBe(2);
      expect(state.handicapPositions).toHaveLength(2);
    });

    test('all positions are within 9x9 board', () => {
      store.setHandicap(2);
      const allValid = state.handicapPositions.every(
        (pos) => pos.col >= 0 && pos.col < 9 && pos.row >= 0 && pos.row < 9
      );
      expect(allValid).toBe(true);
    });

    test('stones are placed on board as black', () => {
      store.setHandicap(2);
      const allPlaced = state.handicapPositions.every(
        (pos) => state.board[pos.row][pos.col] === 1
      );
      expect(allPlaced).toBe(true);
    });

    test('sets komi to 0 for handicap', () => {
      state.komi = 6.5;
      store.setHandicap(2);
      expect(state.komi).toBe(0);
    });

    test('sets startColor to white (2) for handicap', () => {
      state.startColor = 1;
      store.setHandicap(2);
      expect(state.startColor).toBe(2);
    });

    test('resets turn to 0', () => {
      state.turn = 5;
      store.setHandicap(2);
      expect(state.turn).toBe(0);
    });
  });

  describe('setHandicap numeric mode (9 stones on 9x9)', () => {
    test('places 9 handicap stones on 9x9 board', () => {
      store.setHandicap(9);
      expect(state.handicapStones).toBe(9);
      expect(state.handicapPositions).toHaveLength(9);
    });
  });

  describe('setHandicap numeric mode (4 stones on 13x13)', () => {
    test('places 4 handicap stones on 13x13 board', () => {
      state.boardSize = 13;
      store.setHandicap(4);
      expect(state.handicapStones).toBe(4);
      expect(state.handicapPositions).toHaveLength(4);
      const allValid = state.handicapPositions.every(
        (pos) => pos.col < 13 && pos.row < 13
      );
      expect(allValid).toBe(true);
    });
  });

  describe('setHandicap invalid input', () => {
    test('throws for unknown string', () => {
      let threw = false;
      try {
        store.setHandicap('invalid');
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws for negative number', () => {
      let threw = false;
      try {
        store.setHandicap(-1);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws for NaN', () => {
      let threw = false;
      try {
        store.setHandicap(NaN);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('throws for Infinity', () => {
      let threw = false;
      try {
        store.setHandicap(Infinity);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('handicap history management', () => {
    test('saves to history when game has data (sgfMoves)', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      store.setHandicap('even');
      expect(saveCalls).toHaveLength(1);
    });

    test('saves to history when game has data (handicapStones)', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      state.handicapStones = 3;
      store.setHandicap('even');
      expect(saveCalls).toHaveLength(1);
    });

    test('does not save when no game data', () => {
      const saveCalls = [];
      history.save = (label, s) => saveCalls.push({ label, s });
      store.setHandicap('even');
      expect(saveCalls).toHaveLength(0);
    });
  });

  describe('handicap gameInfo sync', () => {
    test('updates gameInfo.handicap for even mode', () => {
      store.setHandicap('even');
      expect(state.gameInfo.handicap).toBe(null);
    });

    test('updates gameInfo.handicap for no-komi equivalent (0)', () => {
      store.setHandicap(0);
      expect(state.gameInfo.handicap).toBe(null);
    });

    test('updates gameInfo.handicap for numeric mode', () => {
      store.setHandicap(3);
      expect(state.gameInfo.handicap).toBe(3);
    });
  });
});
