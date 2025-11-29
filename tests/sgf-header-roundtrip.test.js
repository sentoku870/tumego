import { SGFService } from '../dist/services/sgf-service.js';
import { SGFParser } from '../dist/sgf-parser.js';
import { GameStore } from '../dist/state/game-store.js';
import { GoEngine } from '../dist/go-engine.js';
import { HistoryManager } from '../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../dist/types.js';

const createEmptyBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = () => {
  const size = DEFAULT_CONFIG.DEFAULT_BOARD_SIZE;
  return {
    boardSize: size,
    board: createEmptyBoard(size),
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
    gameInfo: {
      title: '',
      boardSize: size,
      komi: DEFAULT_CONFIG.DEFAULT_KOMI,
      handicap: null,
      handicapStones: 0,
      handicapPositions: [],
      startColor: 1,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: [],
      playerBlack: null,
      playerWhite: null,
      result: null
    },
    capturedCounts: { black: 0, white: 0 }
  };
};

describe('SGF header editing via GameStore', () => {
  test('roundtrips header metadata after manual edits', () => {
    const parser = new SGFParser();
    const store = new GameStore(createState(), new GoEngine(), new HistoryManager());
    const service = new SGFService(parser, store);

    store.updateGameInfo({
      title: 'Title Sample',
      playerBlack: 'Tester B',
      playerWhite: 'Tester W',
      komi: 7.5,
      result: 'B+R'
    });

    const sgf = service.export();
    expect(sgf).toContain('PB[Tester B]');
    expect(sgf).toContain('PW[Tester W]');
    expect(sgf).toContain('KM[7.5]');
    expect(sgf).toContain('RE[B+R]');
    expect(sgf).toContain('GN[Title Sample]');

    const parsed = parser.parse(sgf);
    const restoredStore = new GameStore(createState(), new GoEngine(), new HistoryManager());
    const restoredService = new SGFService(parser, restoredStore);
    restoredService.apply(parsed);

    const info = restoredStore.getGameInfo();
    expect(info.playerBlack).toBe('Tester B');
    expect(info.playerWhite).toBe('Tester W');
    expect(info.komi).toBe(7.5);
    expect(restoredStore.snapshot.komi).toBe(7.5);
    expect(info.result).toBe('B+R');
    expect(info.title).toBe('Title Sample');
  });
});
