// ============ medium-priority-bugs-1.test.js ============
// 2026-08-12 修正の中重要度バグ 4 件の回帰テスト。

import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { GameStore } from '../../dist/state/game-store.js';
import { PreferencesStore } from '../../dist/services/preferences-store.js';
import { createDefaultState } from '../helpers/state-factory.js';

describe('B-6: tryMove does not double-update state', () => {
  test('tryMove sets state.turn from rebuild result, not manual increment', () => {
    const state = createDefaultState({ boardSize: 9 });
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.tryMove({ col: 4, row: 4 });

    // numberMode=false, numberStartIndex=0 なので turn = sgfIndex - 0 = sgfIndex
    expect(state.turn).toBe(state.sgfIndex);
    expect(state.turn).toBe(1);
  });

  test('tryMove turn is consistent across multiple moves', () => {
    const state = createDefaultState({ boardSize: 9 });
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.tryMove({ col: 4, row: 4 });
    store.tryMove({ col: 3, row: 3 });
    store.tryMove({ col: 2, row: 2 });

    expect(state.turn).toBe(3);
    expect(state.sgfIndex).toBe(3);
  });

  test('tryMove with numberMode uses computeTurn logic', () => {
    const state = createDefaultState({
      boardSize: 9,
      numberMode: true,
      numberStartIndex: 0,
    });
    state.sgfMoves = [
      { col: 0, row: 0, color: 1 },
      { col: 1, row: 0, color: 2 },
      { col: 0, row: 1, color: 1 },
    ];
    state.sgfIndex = 3;
    state.turn = 0;

    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.tryMove({ col: 2, row: 2 });

    // sgfIndex=4, numberStartIndex=0 → turn = 4
    expect(state.turn).toBe(4);
    expect(state.sgfIndex).toBe(4);
  });
});

describe('B-7: moveStone increments turn', () => {
  test('moveStone increments turn', () => {
    const state = createDefaultState({ boardSize: 9 });
    state.board[0][0] = 1;
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    expect(state.turn).toBe(0);

    store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });

    expect(state.turn).toBe(1);
    expect(state.board[5][5]).toBe(1);
    expect(state.board[0][0]).toBe(0);
  });

  test('multiple moveStones increment turn correctly', () => {
    const state = createDefaultState({ boardSize: 9 });
    state.board[0][0] = 1;
    state.board[3][3] = 2;
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
    store.moveStone({ col: 3, row: 3 }, { col: 6, row: 6 });

    expect(state.turn).toBe(2);
  });

  test('failed moveStone does not increment turn', () => {
    const state = createDefaultState({ boardSize: 9 });
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    // 石がないので失敗
    const result = store.moveStone({ col: 0, row: 0 }, { col: 5, row: 5 });
    expect(result).toBe(false);
    expect(state.turn).toBe(0);
  });
});

describe('B-8: removeStone resets capturedCounts', () => {
  test('removeStone in edit mode resets capturedCounts', () => {
    const state = createDefaultState({ boardSize: 9 });
    state.board[0][0] = 1;
    state.capturedCounts = { black: 5, white: 3 };
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.removeStone({ col: 0, row: 0 });

    expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
  });

  test('removeStone in numberMode rebuilds capturedCounts', () => {
    const state = createDefaultState({
      boardSize: 9,
      numberMode: true,
    });
    state.sgfMoves = [
      { col: 4, row: 4, color: 1 }, // black
      { col: 4, row: 5, color: 2 }, // white
      { col: 5, row: 4, color: 1 }, // black captures white at (4,4)
    ];
    state.sgfIndex = 3;
    state.board[4][4] = 1; // captured white position now black
    state.capturedCounts = { black: 0, white: 1 };
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    // Remove the black move at (5,4) which captured the white at (4,4)
    // After this, white at (4,4) should be back on the board
    const removed = store.removeStone({ col: 4, row: 4 });
    expect(removed).toBe(true);
    // capturedCounts should be rebuilt from sgfMoves after truncation
    expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
  });

  test('removeStone of stone not in sgfMoves resets capturedCounts', () => {
    const state = createDefaultState({
      boardSize: 9,
      numberMode: true,
      sgfLoadedFromExternal: true,
    });
    state.board[0][0] = 1;
    state.capturedCounts = { black: 5, white: 5 };
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.removeStone({ col: 0, row: 0 });

    expect(state.capturedCounts).toEqual({ black: 0, white: 0 });
  });
});

describe('B-11: preferences-store handles array raw value', () => {
  function loadPreferences(rawValue) {
    const storage = {
      _data: { 'tumego.preferences': typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue) },
      getItem(key) { return this._data[key] ?? null; },
      setItem(key, value) { this._data[key] = String(value); },
      removeItem(key) { delete this._data[key]; },
    };
    return new PreferencesStore(storage);
  }

  test('array raw returns defaults', () => {
    const prefs = loadPreferences([]);
    expect(prefs.state.edit.rulesMode).toBe('standard');
    expect(prefs.state.solve.showCapturedStones).toBe(true);
    expect(prefs.state.ui.deviceProfile).toBe('auto');
  });

  test('null raw returns defaults', () => {
    const prefs = loadPreferences(null);
    expect(prefs.state.edit.rulesMode).toBe('standard');
  });

  test('string raw returns defaults', () => {
    const prefs = loadPreferences('not json');
    expect(prefs.state.edit.rulesMode).toBe('standard');
  });

  test('number raw returns defaults', () => {
    const prefs = loadPreferences(42);
    expect(prefs.state.edit.rulesMode).toBe('standard');
  });
});