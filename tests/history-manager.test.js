import { HistoryManager } from '../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

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

describe('HistoryManager', () => {
  let history, state;

  beforeEach(() => {
    history = new HistoryManager();
    state = createState();
  });

  describe('save()', () => {
    test('saves a snapshot and returns it via getList', () => {
      history.save('first operation', state);
      const list = history.getList();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('first operation');
    });

    test('saves multiple snapshots in LIFO order', () => {
      history.save('first', state);
      state.board[0][0] = 1;
      history.save('second', state);
      state.board[0][1] = 2;
      history.save('third', state);

      const list = history.getList();
      expect(list).toHaveLength(3);
      expect(list[0].label).toBe('third');
      expect(list[1].label).toBe('second');
      expect(list[2].label).toBe('first');
    });

    test('limits snapshots to maxSnapshots (5)', () => {
      for (let i = 0; i < 7; i++) {
        history.save(`op${i}`, state);
      }
      const list = history.getList();
      expect(list).toHaveLength(5);
      // The 2 oldest (op0, op1) should be discarded
      expect(list[0].label).toBe('op6');
      expect(list[4].label).toBe('op2');
    });

    test('preserves label exactly', () => {
      history.save('問題図確定', state);
      history.save('全消去前（9路盤）', state);
      const list = history.getList();
      expect(list[0].label).toBe('全消去前（9路盤）');
      expect(list[1].label).toBe('問題図確定');
    });

    test('records a Date timestamp for each snapshot', () => {
      history.save('first', state);
      const list = history.getList();
      const isDate = list[0].timestamp instanceof Date;
      expect(isDate).toBe(true);
    });

    test('snapshots are deep copies (state changes do not affect history)', () => {
      state.board[0][0] = 1;
      state.turn = 5;
      history.save('first', state);

      // Mutate state after save
      state.board[0][0] = 2;
      state.turn = 10;
      state.boardSize = 13;

      // Restore and check the saved state is intact
      const restored = createState();
      history.restoreLast(restored);
      expect(restored.board[0][0]).toBe(1);
      expect(restored.turn).toBe(5);
      expect(restored.boardSize).toBe(9);
    });

    test('sgfMoves are deep copied', () => {
      state.sgfMoves = [{ col: 0, row: 0, color: 1 }];
      history.save('with moves', state);

      // Mutate sgfMoves
      state.sgfMoves.push({ col: 1, row: 1, color: 2 });
      state.sgfMoves[0].color = 2;

      const restored = createState();
      history.restoreLast(restored);
      expect(restored.sgfMoves).toHaveLength(1);
      expect(restored.sgfMoves[0].color).toBe(1);
    });

    test('problemDiagram positions are deep copied', () => {
      state.problemDiagramSet = true;
      state.problemDiagramBlack = [{ col: 0, row: 0 }];
      state.problemDiagramWhite = [{ col: 1, row: 1 }];
      history.save('problem', state);

      // Mutate
      state.problemDiagramBlack.push({ col: 8, row: 8 });

      const restored = createState();
      history.restoreLast(restored);
      expect(restored.problemDiagramBlack).toHaveLength(1);
      expect(restored.problemDiagramBlack[0]).toEqual({ col: 0, row: 0 });
    });

    test('capturedCounts are deep copied', () => {
      state.capturedCounts = { black: 5, white: 3 };
      history.save('with captures', state);

      state.capturedCounts.black = 100;

      const restored = createState();
      history.restoreLast(restored);
      expect(restored.capturedCounts).toEqual({ black: 5, white: 3 });
    });
  });

  describe('restore(index, state)', () => {
    test('returns false for negative index', () => {
      history.save('first', state);
      const result = history.restore(-1, state);
      expect(result).toBe(false);
    });

    test('returns false for index >= snapshots.length', () => {
      history.save('first', state);
      const result = history.restore(5, state);
      expect(result).toBe(false);
    });

    test('returns false when no snapshots exist', () => {
      const result = history.restore(0, state);
      expect(result).toBe(false);
    });

    test('restores the snapshot at given index', () => {
      state.board[0][0] = 1;
      state.turn = 3;
      history.save('first', state);

      state.board[0][0] = 2;
      state.turn = 6;
      // Don't save this state

      // Restore to first snapshot
      const result = history.restore(0, state);
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
      expect(state.turn).toBe(3);
    });

    test('removes snapshots before the restored index (slice)', () => {
      history.save('op0', state);
      state.board[0][0] = 1;
      history.save('op1', state);
      state.board[0][1] = 2;
      history.save('op2', state);

      // Restore to op1 (index 1 in current list)
      // current list: [op2, op1, op0]
      history.restore(1, state);

      const list = history.getList();
      // After restore(1), snapshots.slice(2) = [op0]
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('op0');
    });

    test('applies full state from snapshot', () => {
      state.boardSize = 9;
      state.mode = 'alt';
      state.turn = 0;
      history.save('initial', state);

      state.boardSize = 13;
      state.mode = 'black';
      state.turn = 5;
      state.turn = 5;

      history.restore(0, state);
      expect(state.boardSize).toBe(9);
      expect(state.mode).toBe('alt');
      expect(state.turn).toBe(0);
    });
  });

  describe('restoreLast(state)', () => {
    test('returns false when no snapshots exist', () => {
      const result = history.restoreLast(state);
      expect(result).toBe(false);
    });

    test('restores the most recent snapshot', () => {
      history.save('first', state);
      state.board[0][0] = 1;
      history.save('second', state);

      const result = history.restoreLast(state);
      expect(result).toBe(true);
      expect(state.board[0][0]).toBe(1);
    });

    test('removes all but the restored snapshot (clears older entries)', () => {
      history.save('op0', state);
      state.board[0][0] = 1;
      history.save('op1', state);
      state.board[0][1] = 2;
      history.save('op2', state);

      history.restoreLast(state);
      const list = history.getList();
      // After restore(0), snapshots.slice(1) = [op1, op0]
      expect(list).toHaveLength(2);
      expect(list[0].label).toBe('op1');
      expect(list[1].label).toBe('op0');
    });
  });

  describe('getList()', () => {
    test('returns empty array when no snapshots', () => {
      const list = history.getList();
      expect(list).toEqual([]);
    });

    test('returns items with index, label, timestamp, timeString', () => {
      history.save('first', state);
      const list = history.getList();
      expect(list[0].index).toBe(0);
      expect(list[0].label).toBe('first');
      const isDate = list[0].timestamp instanceof Date;
      expect(isDate).toBe(true);
      expect(typeof list[0].timeString).toBe('string');
    });

    test('assigns correct indices', () => {
      history.save('a', state);
      history.save('b', state);
      history.save('c', state);
      const list = history.getList();
      expect(list[0].index).toBe(0);
      expect(list[1].index).toBe(1);
      expect(list[2].index).toBe(2);
    });
  });

  describe('clear()', () => {
    test('removes all snapshots', () => {
      history.save('a', state);
      history.save('b', state);
      history.save('c', state);
      history.clear();
      expect(history.getList()).toEqual([]);
    });

    test('allows new saves after clear', () => {
      history.save('a', state);
      history.clear();
      history.save('b', state);
      const list = history.getList();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('b');
    });

    test('restoreLast returns false after clear', () => {
      history.save('a', state);
      history.clear();
      const result = history.restoreLast(state);
      expect(result).toBe(false);
    });
  });

  describe('integration: save → restore → modify → restore', () => {
    test('multiple save/restore cycles preserve state correctly', () => {
      state.board[0][0] = 1;
      state.turn = 1;
      history.save('step1', state);

      state.board[0][1] = 2;
      state.turn = 2;
      history.save('step2', state);

      state.board[0][2] = 1;
      state.turn = 3;
      // Do not save step3

      // Restore to step2
      history.restoreLast(state);
      expect(state.board[0][0]).toBe(1);
      expect(state.board[0][1]).toBe(2);
      expect(state.board[0][2]).toBe(0);
      expect(state.turn).toBe(2);

      // Now restore to step1
      history.restoreLast(state);
      expect(state.board[0][0]).toBe(1);
      expect(state.board[0][1]).toBe(0);
      expect(state.board[0][2]).toBe(0);
      expect(state.turn).toBe(1);
    });
  });
});
