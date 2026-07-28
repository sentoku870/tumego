import { GameStore } from '../state/game-store.js';
import { toCircledNumber } from '../utils/format.js';
import {
  BoardMarker,
  GameState,
  Move,
  Position,
  SGFGameInfo,
  SGFNode,
  SGFParseResult,
} from '../types.js';
import { SGFParser } from '../sgf-parser.js';
import { SGFIO } from './sgf-io.js';
import { SGFShare } from './sgf-share.js';

export interface ApplyResult {
  sgfText: string;
}

/**
 * 木の主ラインを Move[] として抽出する。
 * 着手を持たないセットアップノード（先頭）はスキップする。
 * children[0] を主分岐として辿る。
 */
export function extractMainLineMoves(root: SGFNode): Move[] {
  const moves: Move[] = [];
  let node: SGFNode | null = root.children[0] ?? null;
  // セットアップノードをスキップ（move を持たない限り子を辿る）
  while (node && !node.move) {
    node = node.children[0] ?? null;
  }
  while (node) {
    if (node.move) {
      moves.push(node.move);
    }
    node = node.children[0] ?? null;
  }
  return moves;
}

/**
 * 木の主ライン上の各ノードのマーカーを、深さ基準の配列として抽出する。
 * まずルート自体のマーカーを rootMarkers に入れ、
 * その上で先頭のセットアップノード（move なし）のマーカーも rootMarkers に追加する。
 * index 0 は主ラインの最初の着手ノードのマーカー。
 */
export function extractMainLineMarkers(root: SGFNode): {
  rootMarkers: BoardMarker[];
  nodeMarkers: BoardMarker[][];
} {
  const rootMarkers: BoardMarker[] = [];
  const nodeMarkers: BoardMarker[][] = [];

  // ルート自体のマーカー
  rootMarkers.push(...extractNodeMarkers(root));

  let node: SGFNode | null = root.children[0] ?? null;

  // 先頭のセットアップノード（move なし）のマーカーも rootMarkers へ
  if (node && !node.move) {
    rootMarkers.push(...extractNodeMarkers(node));
    node = node.children[0] ?? null;
  }

  while (node) {
    nodeMarkers.push(extractNodeMarkers(node));
    node = node.children[0] ?? null;
  }

  return { rootMarkers, nodeMarkers };
}

function extractNodeMarkers(node: SGFNode): BoardMarker[] {
  const ext = node as SGFNode & { __markers?: BoardMarker[] };
  if (!ext.__markers) return [];
  return ext.__markers.map((m) => ({
    pos: { ...m.pos },
    kind: m.kind,
    ...(m.label !== undefined ? { label: m.label } : {}),
  }));
}

/**
 * 旧 API 互換: 線形の着手配列から単純な SGFNode 木を構築する。
 * 分岐を持たない、ルート → 主ラインのチェーンを生成する。
 */
function buildLinearTreeFromMoves(moves: Move[]): SGFNode {
  const root: SGFNode = {
    id: "root",
    parent: null,
    children: [],
    isMainLine: true,
  };
  let parent = root;
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (!move) continue;
    const node: SGFNode = {
      id: `n${i + 1}`,
      parent,
      children: [],
      isMainLine: true,
      move: { ...move },
    };
    parent.children.push(node);
    parent = node;
  }
  return root;
}

export class SGFService {
  constructor(
    private readonly parser: SGFParser,
    private readonly store: GameStore,
    private readonly io: SGFIO,
    private readonly share: SGFShare
  ) {}

  get state(): Readonly<GameState> {
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
   * 状態書込はすべて ModeOperations / GameStore 経由。
   * 旧 API 互換: rootNode がない場合は result.moves から線形木を合成する。
   */
  apply(result: SGFParseResult): ApplyResult {
    const validated = this.validateParseResult(result);
    const { rawSGF, gameInfo } = validated;

    // rootNode がない場合は moves から線形木を合成（旧 API 互換）
    const rootNode: SGFNode =
      validated.rootNode ??
      buildLinearTreeFromMoves(validated.moves ?? []);

    // 主ラインを投影（sgfMoves と各ノードのマーカー）
    const moves = extractMainLineMoves(rootNode);
    const { rootMarkers, nodeMarkers } = extractMainLineMarkers(rootNode);

    // 1) 盤サイズ変更と盤面再生成
    this.store.prepareBoardForSgf(gameInfo.boardSize);

    // 2) 履歴保存 + フラグ類リセット
    this.store.resetForSgfLoad(this.state.sgfMoves.length);

    // 3) 着手木のセット（解析したルートで上書き）
    this.store.setSgfTree(rootNode);

    // 4) メタ情報適用（startColor, handicap, problemDiagram）
    this.store.applySgfMeta(gameInfo);

    // 5) 対局者・コミ・結果・タイトル等
    this.store.updateGameInfo({
      title: gameInfo.title ?? this.state.gameInfo.title ?? '',
      playerBlack: gameInfo.playerBlack ?? null,
      playerWhite: gameInfo.playerWhite ?? null,
      komi: gameInfo.komi ?? this.state.komi,
      result: gameInfo.result ?? null,
    });
    this.store.updateGameInfoFromSgf(gameInfo);

    // 6) 着手履歴セット + 0 手目に進める（手順があれば 1 手目）
    this.store.setSgfMoves(moves);

    // 7) マーカー（ルート + 各着手ノード）
    this.store.setNodeMarkers(rootMarkers, nodeMarkers);

    const firstIndex = moves.length > 0 ? 1 : 0;
    this.store.setMoveIndex(firstIndex);

    return {
      sgfText: rawSGF ?? this.parser.export(this.state)
    };
  }

  private validateParseResult(result: SGFParseResult): SGFParseResult {
    if (!result || !result.gameInfo) {
      throw new Error('不正なSGF解析結果です');
    }
    if (!result.rootNode && !result.moves) {
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
      const num = toCircledNumber(i - startIndex + 1);
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
}
