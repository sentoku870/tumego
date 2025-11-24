import { SGFService } from '../../dist/services/sgf-service.js';
import { SGFParser } from '../../dist/sgf-parser.js';

const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

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
  komi: 6.5,
  handicapStones: 0,
  handicapPositions: [],
  answerMode: 'black',
  problemDiagramSet: false,
  problemDiagramBlack: [],
  problemDiagramWhite: [],
  gameTree: null,
  sgfLoadedFromExternal: false
});

const createService = (state) => new SGFService(new SGFParser(), { snapshot: state });

describe('SGFService.buildAnswerSequence', () => {
  test('formats answer sequence with circled numbers and coordinates', () => {
    const state = createState(9);
    state.numberMode = true;
    state.sgfMoves = [
      { col: 5, row: 4, color: 1 },
      { col: 3, row: 2, color: 2 },
      { col: 1, row: 0, color: 1 }
    ];
    state.sgfIndex = 3;

    const service = createService(state);
    const sequence = service.buildAnswerSequence(state);

    expect(sequence).toBe('■① F5 □② D7 ■③ B9');
  });

  test('returns empty string when no answer moves exist', () => {
    const state = createState();
    state.numberMode = true;
    state.numberStartIndex = 0;
    state.sgfIndex = 0;

    const service = createService(state);
    const sequence = service.buildAnswerSequence(state);

    expect(sequence).toBe('');
  });
});
