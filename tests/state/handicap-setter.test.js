import { DEFAULT_CONFIG } from '../../dist/types.js';
import { GoEngine } from '../../dist/go-engine.js';
import { BoardCacheManager } from '../../dist/state/board-cache-manager.js';
import { HandicapSetter } from '../../dist/state/handicap-setter.js';
import { HistoryManager } from '../../dist/history-manager.js';
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
  gameTree: null,
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

describe('HandicapSetter', () => {
  let engine, state, history, cache, modeOps, setter;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState(9);
    cache = new BoardCacheManager(state, engine);
    modeOps = new ModeOperations(state, silentHistory(), cache);
    setter = new HandicapSetter(state, engine, history, modeOps, cache);
  });

  describe('apply', () => {
    test('"even" resets handicap and sets default komi + startColor=1', () => {
      state.handicapStones = 5;
      setter.apply('even');
      expect(state.handicapStones).toBe(0);
      expect(state.handicapPositions).toEqual([]);
      expect(state.komi).toBe(DEFAULT_CONFIG.DEFAULT_KOMI);
      expect(state.startColor).toBe(1);
    });

    test('0 sets no-komi', () => {
      setter.apply(0);
      expect(state.handicapStones).toBe(0);
      expect(state.komi).toBe(0);
      expect(state.startColor).toBe(1);
    });

    test('fixed number places stones and updates startColor=2', () => {
      setter.apply(4);
      expect(state.handicapStones).toBe(4);
      expect(state.handicapPositions).toHaveLength(4);
      expect(state.startColor).toBe(2);
      expect(state.komi).toBe(0);
      const stoneCount = state.board.flat().filter((c) => c !== 0).length;
      expect(stoneCount).toBe(4);
    });

    test('gameInfo is synced with handicap metadata', () => {
      setter.apply(4);
      expect(state.gameInfo.handicap).toBe(4);
      expect(state.gameInfo.handicapStones).toBe(4);
      expect(state.gameInfo.startColor).toBe(2);
    });

    test('saves history when game has data', () => {
      let saveCount = 0;
      const realSave = history.save.bind(history);
      history.save = (label, st) => {
        saveCount++;
        if (!label.includes('置石設定前')) {
          realSave(label, st);
        } else {
          // count only the handicap history save
        }
      };
      state.handicapStones = 2;
      setter.apply(4);
      expect(saveCount).toBe(1);
    });

    test('does not save history when no game data', () => {
      let saveCount = 0;
      history.save = () => {
        saveCount++;
      };
      setter.apply('even');
      expect(saveCount).toBe(0);
    });
  });
});
