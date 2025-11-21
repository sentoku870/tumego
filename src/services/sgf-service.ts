import { GameStore } from '../state/game-store.js';
import {
  CellState,
  DEFAULT_CONFIG,
  GameState,
  Move,
  SGFParseResult,
  StoneColor
} from '../types.js';
import { SGFParser } from '../sgf-parser.js';
import { getCircleNumber } from '../renderer.js';

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
  gameInfo: Partial<GameState>;
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

    if (state.sgfMoves.length > 0 || state.handicapStones > 0 ||
      state.board.some(row => row.some(cell => cell !== 0))) {
      this.store.historyManager.save(`SGF読み込み前（${state.sgfMoves.length}手）`, state);
    }

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

    return {
      state,
      moves,
      gameInfo,
      rawSGF
    };
  }

  private runApplicationPhase(input: ApplicationPhaseInput): ApplicationPhaseOutput {
    const { state, moves, gameInfo } = input;

    if (gameInfo.komi !== undefined) state.komi = gameInfo.komi;
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

  buildAnswerSequence(): string | null {
    const state = this.state;
    if (!state.numberMode || state.sgfMoves.length === 0) {
      return null;
    }

    const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
    const startIndex = state.numberStartIndex || 0;
    const endIndex = state.sgfIndex;

    if (endIndex <= startIndex) {
      return null;
    }

    const sequence: string[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const move = state.sgfMoves[i];
      if (!move) continue;

      const col = letters[move.col];
      const row = state.boardSize - move.row;
      const mark = move.color === 1 ? '■' : '□';
      const num = getCircleNumber(i - startIndex + 1);

      if (col) {
        sequence.push(`${mark}${num} ${col}${row}`);
      }
    }

    return sequence.length ? sequence.join(' ') : null;
  }
}
