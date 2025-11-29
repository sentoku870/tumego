import { GameStore } from '../state/game-store.js';
import {
  CellState,
  DEFAULT_CONFIG,
  GameState,
  Move,
  Position,
  SGFGameInfo,
  SGFParseResult,
  StoneColor
} from '../types.js';
import { SGFParser } from '../sgf-parser.js';

export interface ApplyResult {
  sgfText: string;
}

interface InitializationPhaseInput {
  state: GameState;
  result: SGFParseResult;
}

interface InitializationPhaseOutput {
  state: GameState;
  moves: Move[];
  gameInfo: SGFGameInfo;
  rawSGF?: string;
}

interface ApplicationPhaseInput extends InitializationPhaseOutput {}

interface ApplicationPhaseOutput {
  state: GameState;
  appliedMoves: Move[];
}

interface HistoryAdjustmentInput extends ApplicationPhaseOutput {}

interface HistoryAdjustmentOutput {
  state: GameState;
}

export class SGFService {
  constructor(
    private readonly parser: SGFParser,
    private readonly store: GameStore
  ) {}

  get state(): GameState {
    return this.store.snapshot;
  }

  parse(text: string): SGFParseResult {
    return this.parser.parse(text);
  }

  async loadFromFile(file: File): Promise<SGFParseResult> {
    return this.parser.loadFromFile(file);
  }

  async loadFromClipboard(): Promise<SGFParseResult> {
    return this.parser.loadFromClipboard();
  }

  export(): string {
    return this.parser.export(this.state);
  }

  async copyToClipboard(text: string): Promise<void> {
    await this.parser.copyToClipboard(text);
  }

  async saveToFile(text: string): Promise<void> {
    await this.parser.saveToFile(text);
  }

  loadFromURL(): SGFParseResult | null {
    return this.parser.loadFromURL();
  }

  apply(result: SGFParseResult): ApplyResult {
    const validated = this.validateParseResult(result);
    const initialized = this.runInitializationPhase({
      state: this.state,
      result: validated
    });
    const applied = this.runApplicationPhase(initialized);
    this.runHistoryAdjustmentPhase(applied);

    return {
      sgfText: validated.rawSGF ?? this.parser.export(this.state)
    };
  }

  private validateParseResult(result: SGFParseResult): SGFParseResult {
    const { moves, gameInfo } = result;

    if (!moves || !Array.isArray(moves) || !gameInfo) {
      throw new Error('不正なSGF解析結果です');
    }

    return result;
  }

  private runInitializationPhase(input: InitializationPhaseInput): InitializationPhaseOutput {
    const { state, result } = input;
    const { moves, gameInfo, rawSGF } = result;

    this.store.historyManager.save(`SGF読み込み前（${state.sgfMoves.length}手）`, state);

    if (gameInfo.boardSize && gameInfo.boardSize !== state.boardSize) {
      const newSize = gameInfo.boardSize;
      state.boardSize = newSize;
      state.board = Array.from({ length: newSize }, () =>
        Array.from({ length: newSize }, () => 0 as CellState));
    } else {
      const currentSize = state.boardSize;
      state.board = Array.from({ length: currentSize }, () =>
        Array.from({ length: currentSize }, () => 0 as CellState));
    }

    state.history = [];
    state.turn = 0;
    state.sgfMoves = [];
    state.sgfIndex = 0;
    state.numberMode = false;
    state.numberStartIndex = 0;
    state.handicapStones = 0;
    state.gameTree = null;
    state.sgfLoadedFromExternal = true;
    state.handicapPositions = [];
    state.problemDiagramSet = false;
    state.problemDiagramBlack = [];
    state.problemDiagramWhite = [];
    state.startColor = 1;
    state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    state.eraseMode = false;
    state.gameInfo = {
      title: '',
      komi: state.komi,
      handicap: null,
      playerBlack: null,
      playerWhite: null,
      result: null,
      boardSize: state.boardSize,
      handicapStones: state.handicapStones,
      handicapPositions: state.handicapPositions,
      startColor: state.startColor,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: state.problemDiagramBlack,
      problemDiagramWhite: state.problemDiagramWhite,
    };

    return {
      state,
      moves,
      gameInfo,
      rawSGF
    };
  }

  private runApplicationPhase(input: ApplicationPhaseInput): ApplicationPhaseOutput {
    const { state, moves, gameInfo } = input;

    if (gameInfo.startColor !== undefined) state.startColor = gameInfo.startColor as StoneColor;
    if (gameInfo.handicapStones !== undefined) state.handicapStones = gameInfo.handicapStones;
    if (gameInfo.handicapPositions) {
      state.handicapPositions = gameInfo.handicapPositions.map(pos => ({ ...pos }));
    }
    if (gameInfo.problemDiagramBlack) {
      state.problemDiagramBlack = gameInfo.problemDiagramBlack.map(pos => ({ ...pos }));
    }
    if (gameInfo.problemDiagramWhite) {
      state.problemDiagramWhite = gameInfo.problemDiagramWhite.map(pos => ({ ...pos }));
    }
    if (gameInfo.problemDiagramSet !== undefined) {
      state.problemDiagramSet = gameInfo.problemDiagramSet;
    } else if (state.problemDiagramBlack.length > 0 || state.problemDiagramWhite.length > 0) {
      state.problemDiagramSet = true;
    }

    this.store.updateGameInfo({
      title: gameInfo.title ?? state.gameInfo.title ?? '',
      playerBlack: gameInfo.playerBlack ?? null,
      playerWhite: gameInfo.playerWhite ?? null,
      komi: gameInfo.komi ?? state.komi,
      result: gameInfo.result ?? null,
    });

    state.gameInfo = {
      ...state.gameInfo,
      handicap: gameInfo.handicap ?? state.gameInfo.handicap ?? null,
      boardSize: gameInfo.boardSize ?? state.boardSize,
      handicapStones: gameInfo.handicapStones ?? state.handicapStones,
      handicapPositions: gameInfo.handicapPositions ?? state.handicapPositions,
      startColor: state.startColor,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: state.problemDiagramBlack,
      problemDiagramWhite: state.problemDiagramWhite
    };

    state.sgfMoves = moves.map(move => ({ ...move }));
    state.sgfIndex = 0;

    return {
      state,
      appliedMoves: state.sgfMoves
    };
  }

  private runHistoryAdjustmentPhase(input: HistoryAdjustmentInput): HistoryAdjustmentOutput {
    const firstIndex = this.store.snapshot.sgfMoves.length > 0 ? 1 : 0;
    this.store.setMoveIndex(firstIndex);
    return { state: input.state };
  }

  buildAnswerSequence(state: GameState = this.state): string {
    if (!state.numberMode) {
      return '';
    }

    const startIndex = state.numberStartIndex || 0;
    const endIndex = Math.min(state.sgfIndex, state.sgfMoves.length);

    if (endIndex <= startIndex) {
      return '';
    }

    const sequence: string[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const move = state.sgfMoves[i];
      const coordinate = this.formatCoordinate(state, move);
      if (!coordinate) continue;

      const mark = move.color === 1 ? '■' : '□';
      const num = this.getAnswerNumber(i - startIndex + 1);
      sequence.push(`${mark}${num} ${coordinate}`);
    }

    return sequence.join(' ');
  }

  private formatCoordinate(state: GameState, position: Position): string | null {
    const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
    const col = letters[position.col];
    if (!col) return null;

    const row = state.boardSize - position.row;
    return `${col}${row}`;
  }

  private getAnswerNumber(order: number): string {
    const circledNumbers = [
      '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
      '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'
    ];

    return circledNumbers[order - 1] ?? order.toString();
  }
}
