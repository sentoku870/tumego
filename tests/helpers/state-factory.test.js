// ============ state-factory.js 単体テスト ============
import {
  createDefaultState,
  createEmptyBoard
} from '../helpers/state-factory.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

describe('createDefaultState', () => {
  test('returns a state with default 9x9 board', () => {
    const state = createDefaultState();
    expect(state.boardSize).toBe(9);
    expect(state.board).toHaveLength(9);
    expect(state.board[0]).toHaveLength(9);
    expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
  });

  test('sets default mode flags', () => {
    const state = createDefaultState();
    expect(state.mode).toBe('alt');
    expect(state.eraseMode).toBe(false);
    expect(state.numberMode).toBe(false);
    expect(state.markerMode).toBe(false);
  });

  test('sets default turn / color / answer values', () => {
    const state = createDefaultState();
    expect(state.turn).toBe(0);
    expect(state.startColor).toBe(1);
    expect(state.answerMode).toBe('black');
  });

  test('sets default komi from DEFAULT_CONFIG', () => {
    const state = createDefaultState();
    expect(state.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
  });

  test('initializes empty markers', () => {
    const state = createDefaultState();
    expect(state.markers).toEqual([]);
    expect(state.rootMarkers).toEqual([]);
    expect(state.nodeMarkers).toEqual([]);
  });

  test('initializes empty gameInfo', () => {
    const state = createDefaultState();
    expect(state.gameInfo.title).toBe('');
    expect(state.gameInfo.black).toBe('');
    expect(state.gameInfo.white).toBe('');
    expect(state.gameInfo.result).toBe('');
  });

  test('capturedCounts starts at zero', () => {
    const state = createDefaultState();
    expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
  });

  test('overrides merge with defaults', () => {
    const state = createDefaultState({ boardSize: 19, startColor: 2 });
    expect(state.boardSize).toBe(19);
    expect(state.startColor).toBe(2);
    expect(state.board).toHaveLength(19);
    // 他のデフォルトは保持される
    expect(state.eraseMode).toBe(false);
    expect(state.answerMode).toBe('black');
  });

  test('supports empty overrides object', () => {
    const state = createDefaultState({});
    expect(state.boardSize).toBe(9);
  });
});

describe('createEmptyBoard', () => {
  test('creates board of given size filled with 0', () => {
    const board = createEmptyBoard(13);
    expect(board).toHaveLength(13);
    expect(board[0]).toHaveLength(13);
    expect(board.every((row) => row.every((cell) => cell === 0))).toBe(true);
  });

  test('creates independent rows (no shared references)', () => {
    const board = createEmptyBoard(5);
    board[0][0] = 1;
    expect(board[1][0]).toBe(0);
  });

  test('handles minimum board size (9)', () => {
    const board = createEmptyBoard(9);
    expect(board).toHaveLength(9);
  });

  test('handles maximum board size (19)', () => {
    const board = createEmptyBoard(19);
    expect(board).toHaveLength(19);
  });
});
