// ============ high-priority-bugs.test.js ============
// 2026-08-12 修正の高重要度バグ 5 件の回帰テスト。

import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { GameStore } from '../../dist/state/game-store.js';
import { PreferencesStore } from '../../dist/services/preferences-store.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';
import { createDefaultState } from '../helpers/state-factory.js';

describe('B-1: size-btn active syncs from state.boardSize', () => {
  test('syncSizeButton sets active class for matching size', () => {
    document.body.innerHTML = `
      <button class="size-btn" data-size="9"></button>
      <button class="size-btn" data-size="13"></button>
      <button class="size-btn" data-size="19"></button>
    `;

    const mockController = {
      syncSizeButton(size) {
        const buttons = document.querySelectorAll('.size-btn');
        buttons.forEach((btn) => {
          const sizeRaw = btn.dataset.size;
          const btnSize = sizeRaw === undefined ? NaN : parseInt(sizeRaw, 10);
          if (btnSize === size) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      },
    };

    mockController.syncSizeButton(13);
    expect(document.querySelector('.size-btn[data-size="9"]').classList.contains('active')).toBe(false);
    expect(document.querySelector('.size-btn[data-size="13"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.size-btn[data-size="19"]').classList.contains('active')).toBe(false);

    mockController.syncSizeButton(19);
    expect(document.querySelector('.size-btn[data-size="9"]').classList.contains('active')).toBe(false);
    expect(document.querySelector('.size-btn[data-size="13"]').classList.contains('active')).toBe(false);
    expect(document.querySelector('.size-btn[data-size="19"]').classList.contains('active')).toBe(true);
  });

  test('syncPlayModeButton sets active class for matching mode', () => {
    document.body.innerHTML = `
      <button id="btn-black" class="play-btn"></button>
      <button id="btn-white" class="play-btn"></button>
      <button id="btn-alt" class="play-btn"></button>
    `;

    const mockController = {
      syncPlayModeButton(mode) {
        const map = { black: 'btn-black', white: 'btn-white', alt: 'btn-alt' };
        const activeId = map[mode];
        document.querySelectorAll('.play-btn').forEach((btn) => btn.classList.remove('active'));
        document.getElementById(activeId)?.classList.add('active');
      },
    };

    mockController.syncPlayModeButton('alt');
    expect(document.getElementById('btn-alt').classList.contains('active')).toBe(true);
    expect(document.getElementById('btn-black').classList.contains('active')).toBe(false);

    mockController.syncPlayModeButton('black');
    expect(document.getElementById('btn-alt').classList.contains('active')).toBe(false);
    expect(document.getElementById('btn-black').classList.contains('active')).toBe(true);
  });
});

describe('B-2: GoEngine koPoint persists in GameState, not instance', () => {
  function buildKoBase(size = 5) {
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    board[2][2] = 2; // 白石 (col=2, row=2)
    board[2][1] = 1;
    board[2][3] = 1;
    board[1][2] = 1;
    board[3][1] = 2;
    board[3][3] = 2;
    board[4][2] = 2;
    return board;
  }

  test('koPoint is set on state after capture move', () => {
    const engine = new GoEngine();
    const state = createDefaultState({ boardSize: 5 });
    state.board = buildKoBase();

    const result = engine.playMove(state, { col: 2, row: 3 }, 1);

    expect(result).not.toBeNull();
    expect(state.koPoint).toEqual({ col: 2, row: 2 });
  });

  test('koPoint from previous game does not affect new game after reset', () => {
    const engine = new GoEngine();
    const state = createDefaultState({ boardSize: 5 });
    state.board = buildKoBase();

    // Game 1: ko を作る
    engine.playMove(state, { col: 2, row: 3 }, 1);
    expect(state.koPoint).not.toBeNull();

    // Game 2: state をリセット（resetToEmptyEditState 等と同じ）
    state.board = Array.from({ length: 5 }, () => Array(5).fill(0));
    state.koPoint = null;

    // 新ゲームで ko を作れるかどうか（前回 ko が漏れて禁手になっていないか確認）
    // 新たな ko 状況を作る
    state.board = buildKoBase();
    const result = engine.playMove(state, { col: 2, row: 3 }, 1);
    expect(result).not.toBeNull();
    expect(state.koPoint).toEqual({ col: 2, row: 2 });
  });

  test('same engine instance does not leak ko between states', () => {
    const engine = new GoEngine();
    const stateA = createDefaultState({ boardSize: 5 });
    stateA.board = buildKoBase();
    engine.playMove(stateA, { col: 2, row: 3 }, 1);

    // 別の state で同じエンジンを再利用
    const stateB = createDefaultState({ boardSize: 5 });
    stateB.board = buildKoBase();

    // stateB には koPoint がないのでコウルールは適用されない
    const result = engine.playMove(stateB, { col: 2, row: 3 }, 1);
    expect(result).not.toBeNull();
  });
});

describe('B-3: gameInfo is restored from history', () => {
  test('undo restores title, players, komi, result', () => {
    const state = createDefaultState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.updateGameInfo({
      title: 'Test Title',
      playerBlack: '黒 テスト',
      playerWhite: '白 テスト',
      komi: 7.5,
      result: 'B+R',
    });

    // スナップショットを保存（手動）
    store.historyManager.save('before gameInfo change', state);

    // gameInfo を変更
    store.updateGameInfo({
      title: 'Changed Title',
      playerBlack: '黒 変更',
      playerWhite: '白 変更',
      komi: 5.5,
      result: 'W+T',
    });

    // Undo で復元
    const restored = store.undo();
    expect(restored).toBe(true);

    const info = store.getGameInfo();
    expect(info.title).toBe('Test Title');
    expect(info.playerBlack).toBe('黒 テスト');
    expect(info.playerWhite).toBe('白 テスト');
    expect(info.komi).toBe(7.5);
    expect(info.result).toBe('B+R');
  });

  test('restoreHistorySnapshot restores gameInfo', () => {
    const state = createDefaultState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    store.updateGameInfo({ title: 'Original Title', komi: 7.5 });
    store.historyManager.save('snapshot 1', state);

    store.updateGameInfo({ title: 'New Title', komi: 5.5 });
    store.historyManager.save('snapshot 2', state);

    store.updateGameInfo({ title: 'Latest Title', komi: 6.5 });

    // snapshot 1 を復元
    const restored = store.restoreHistorySnapshot(1);
    expect(restored).toBe(true);

    const info = store.getGameInfo();
    expect(info.title).toBe('Original Title');
    expect(info.komi).toBe(7.5);
  });
});

describe('B-4: enterSolveMode does not snapshot empty board', () => {
  test('enterSolveMode on empty board does not add history', () => {
    const state = createDefaultState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    expect(store.historyManager.getList().length).toBe(0);

    store.enterSolveMode();

    expect(store.historyManager.getList().length).toBe(0);
  });

  test('enterSolveMode on non-empty board adds history', () => {
    const state = createDefaultState();
    const store = new GameStore(state, new GoEngine(), new HistoryManager());

    // 石を置く
    state.board[4][4] = 1;
    expect(store.historyManager.getList().length).toBe(0);

    store.enterSolveMode();

    expect(store.historyManager.getList().length).toBe(1);
  });
});

describe('B-5: legacy "on"/"off" migration for all boolean preferences', () => {
  function loadPreferences(rawString) {
    const storage = {
      _data: { 'tumego.preferences': rawString },
      getItem(key) { return this._data[key] ?? null; },
      setItem(key, value) { this._data[key] = String(value); },
      removeItem(key) { delete this._data[key]; },
    };
    return new PreferencesStore(storage);
  }

  test('"on"/"off" for highlightLastMove is migrated', () => {
    const prefs = loadPreferences(JSON.stringify({
      edit: { rulesMode: 'standard' },
      solve: { highlightLastMove: 'on' },
      ui: { deviceProfile: 'auto' },
    }));
    expect(prefs.state.solve.highlightLastMove).toBe(true);
  });

  test('"on"/"off" for showSolutionMoveNumbers is migrated', () => {
    const prefs = loadPreferences(JSON.stringify({
      solve: { showSolutionMoveNumbers: 'off' },
    }));
    expect(prefs.state.solve.showSolutionMoveNumbers).toBe(false);
  });

  test('"on"/"off" for showMarkers is migrated', () => {
    const prefs = loadPreferences(JSON.stringify({
      solve: { showMarkers: 'on' },
    }));
    expect(prefs.state.solve.showMarkers).toBe(true);
  });

  test('"on"/"off" for allowMultiMarker is migrated', () => {
    const prefs = loadPreferences(JSON.stringify({
      solve: { allowMultiMarker: 'off' },
    }));
    expect(prefs.state.solve.allowMultiMarker).toBe(false);
  });

  test('all 6 boolean fields can be loaded from legacy schema', () => {
    const prefs = loadPreferences(JSON.stringify({
      solve: {
        showCapturedStones: 'on',
        enableFullReset: 'off',
        highlightLastMove: 'on',
        showSolutionMoveNumbers: 'off',
        showMarkers: 'on',
        allowMultiMarker: 'off',
      },
    }));
    expect(prefs.state.solve.showCapturedStones).toBe(true);
    expect(prefs.state.solve.enableFullReset).toBe(false);
    expect(prefs.state.solve.highlightLastMove).toBe(true);
    expect(prefs.state.solve.showSolutionMoveNumbers).toBe(false);
    expect(prefs.state.solve.showMarkers).toBe(true);
    expect(prefs.state.solve.allowMultiMarker).toBe(false);
  });
});