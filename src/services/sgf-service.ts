import { GameStore } from '../state/game-store.js';
import { createEmptyBoard } from '../state/board-utils.js';
import {
  GameState,
  Position,
  SGFGameInfo,
  SGFParseResult,
} from '../types.js';
import { SGFParser } from '../sgf-parser.js';
import { SGFIO } from './sgf-io.js';
import { SGFShare } from './sgf-share.js';

export interface ApplyResult {
  sgfText: string;
}

export class SGFService {
  constructor(
    private readonly parser: SGFParser,
    private readonly store: GameStore,
    private readonly io: SGFIO,
    private readonly share: SGFShare
  ) {}

  get state(): GameState {
    return this.store.snapshot;
  }

  parse(text: string): SGFParseResult {
    return this.parser.parse(text);
  }

  async loadFromFile(file: File): Promise<SGFParseResult> {
    return this.io.loadFromFile(file);
  }

  async loadFromClipboard(): Promise<SGFParseResult> {
    return this.io.loadFromClipboard();
  }

  export(): string {
    return this.parser.export(this.state);
  }

  async copyToClipboard(text: string): Promise<void> {
    await this.io.copyToClipboard(text);
  }

  async saveToFile(text: string): Promise<void> {
    await this.io.saveToFile(text);
  }

  loadFromURL(): SGFParseResult | null {
    return this.share.loadFromURL();
  }

  /**
   * SGF 解析結果を state に適用する。
   * 状態書込はすべて ModeOperations 経由。
   */
  apply(result: SGFParseResult): ApplyResult {
    const validated = this.validateParseResult(result);
    const state = this.state;
    const { moves, gameInfo, rawSGF } = validated;

    // 1) 盤サイズ変更と盤面再生成
    if (gameInfo.boardSize && gameInfo.boardSize !== state.boardSize) {
      state.boardSize = gameInfo.boardSize;
    }
    state.board = createEmptyBoard(state.boardSize);

    // 2) 履歴保存 + フラグ類リセット
    this.store.modeOps.resetForSgfLoad(this.state.sgfMoves.length);

    // 3) メタ情報適用（startColor, handicap, problemDiagram）
    this.store.modeOps.applySgfMeta(gameInfo);

    // 4) 対局者・コミ・結果・タイトル等
    this.store.updateGameInfo({
      title: gameInfo.title ?? this.state.gameInfo.title ?? '',
      playerBlack: gameInfo.playerBlack ?? null,
      playerWhite: gameInfo.playerWhite ?? null,
      komi: gameInfo.komi ?? this.state.komi,
      result: gameInfo.result ?? null,
    });
    this.store.modeOps.updateGameInfoFromSgf(gameInfo);

    // 5) 着手履歴セット + 0 手目に進める（手順があれば 1 手目）
    this.store.modeOps.setSgfMoves(moves);
    const firstIndex = this.state.sgfMoves.length > 0 ? 1 : 0;
    this.store.setMoveIndex(firstIndex);

    return {
      sgfText: rawSGF ?? this.parser.export(this.state)
    };
  }

  private validateParseResult(result: SGFParseResult): SGFParseResult {
    const { moves, gameInfo } = result;

    if (!moves || !Array.isArray(moves) || !gameInfo) {
      throw new Error('不正なSGF解析結果です');
    }

    return result;
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
