// ============ モード遷移&局面管理 ============
// 編集モード ⇄ 解答モードの切り替え、問題図の確定・復元、初期化などを行う。
// 盤面タイムラインキャッシュの制御は BoardCacheManager に委譲する。
import {
  DEFAULT_CONFIG,
  GameState,
  Position,
  SGFGameInfo,
  StoneColor,
} from "../types.js";
import { createEmptyBoard, createInitialCapturedCounts, hasGameData } from "./board-utils.js";
import { HistoryManager } from "../history-manager.js";
import { BoardCacheManager } from "./board-cache-manager.js";

export class ModeOperations {
  constructor(
    private readonly state: GameState,
    private readonly history: HistoryManager,
    private readonly cache: BoardCacheManager
  ) {}

  // ============================================================
  // 公開操作
  // ============================================================

  /**
   * 盤面サイズを変更する。skipHistory が false で既存データがある場合、
   * 履歴に保存する。
   */
  initBoard(size: number, options?: { skipHistory?: boolean }): void {
    const skipHistory = options?.skipHistory ?? false;

    if (!skipHistory && hasGameData(this.state)) {
      this.saveToHistory(`${this.state.boardSize}路盤→${size}路盤 変更前`);
    }

    this.state.boardSize = size;
    this.resetToEmptyEditState({ preserveProblemDiagram: false });
  }

  /** 「全消去」ボタン相当 */
  resetForClearAll(): void {
    if (hasGameData(this.state)) {
      this.saveToHistory(`全消去前（${this.state.boardSize}路盤）`);
    }
    this.resetToEmptyEditState({ preserveProblemDiagram: false });
  }

  /** 現在の盤面を問題図として固定する */
  setProblemDiagram(): void {
    if (hasGameData(this.state)) {
      this.saveToHistory("問題図確定");
    }

    this.captureBoardAsProblemDiagram();

    this.state.handicapPositions = [];
    this.state.handicapStones = 0;
    this.state.sgfTree = this.createEmptyRoot();
    this.state.currentNodeId = 'root';
    this.state.studyMode = false;
    this.state.sgfLoadedFromExternal = false;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.turn = 0;
    this.state.numberMode = false;
    this.state.numberStartIndex = 0;
    this.state.history = [];
    this.state.markers = [];
    this.state.rootMarkers = [];
    this.state.nodeMarkers = [];

    const baseBoard = this.cache.applyInitialSetup();
    this.state.board = baseBoard;
    this.cache.invalidate();
  }

  /** 問題図が設定済みの場合、問題図の状態に復元する */
  restoreProblemDiagram(): void {
    if (!this.state.problemDiagramSet) {
      return;
    }

    if (this.state.sgfMoves.length > 0) {
      this.saveToHistory("問題図復元");
    }

    this.state.sgfIndex = 0;
    this.state.sgfMoves = [];
    this.state.nodeMarkers = [];
    this.state.markers = this.cloneMarkers(this.state.rootMarkers);
    const baseBoard = this.cache.applyInitialSetup();
    this.state.board = baseBoard;
    const counts = this.cache.resetCapturedCountsTimeline();
    this.state.capturedCounts = counts;
    this.state.history = [];
    this.state.turn = 0;
    this.cache.invalidate();

    if (this.state.numberMode) {
      this.state.turn = 0;
      this.state.history = [];
    }
  }

  /** 解答モードへ入る（問題図をベースにしたクリーンな盤面から開始） */
  enterSolveMode(): void {
    this.saveToHistory(`解答開始前（${this.state.sgfMoves.length}手）`);

    if (!this.state.problemDiagramSet) {
      this.captureBoardAsProblemDiagram();
    }

    if (this.state.problemDiagramSet) {
      const baseBoard = this.cache.applyInitialSetup();
      this.state.board = baseBoard;
    }

    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.nodeMarkers = [];
    this.state.markers = this.cloneMarkers(this.state.rootMarkers);

    this.state.numberMode = true;
    this.state.numberStartIndex = 0;
    this.state.eraseMode = false;

    this.state.turn = 0;
    this.state.capturedCounts = createInitialCapturedCounts();
    this.state.history = [];
    this.cache.invalidate();
  }

  /** 解答モードから空盤面の編集モードへ戻す */
  exitSolveModeToEmptyBoard(): void {
    this.resetToEmptyEditState({ preserveProblemDiagram: true });
  }

  // ============================================================
  // 公開: 検討モード (study mode)
  // ============================================================

  /**
   * 検討モードに入る。現在の着手木を保持したまま、編集系操作（分岐着手・兄弟切替・削除）が
   * 可能になる。studyMode=true の間、numberMode は false。
   */
  enterStudyMode(): void {
    if (this.state.studyMode) return;
    this.saveToHistory(`検討モード開始（${this.state.sgfMoves.length}手）`);
    this.state.studyMode = true;
    this.state.numberMode = false;
    this.state.eraseMode = false;
  }

  /** 検討モードを抜ける */
  exitStudyMode(): void {
    if (!this.state.studyMode) return;
    this.saveToHistory(`検討モード終了（${this.state.sgfMoves.length}手）`);
    this.state.studyMode = false;
  }

  /**
   * 指定ノードIDの SGFNode を取得する（ユーティリティ）
   */
  findNodeById(nodeId: string): import("../types.js").SGFNode | null {
    if (this.state.sgfTree.id === nodeId) return this.state.sgfTree;
    return this.findNodeInChildren(this.state.sgfTree, nodeId);
  }

  private findNodeInChildren(
    node: import("../types.js").SGFNode,
    nodeId: string
  ): import("../types.js").SGFNode | null {
    for (const child of node.children) {
      if (child.id === nodeId) return child;
      const found = this.findNodeInChildren(child, nodeId);
      if (found) return found;
    }
    return null;
  }

  /**
   * currentNode に move を追加する。既存の子がある場合は副分岐として追加する。
   * 戻り値: 追加された新しいノード
   */
  appendMoveToCurrentNode(
    move: import("../types.js").Move
  ): import("../types.js").SGFNode {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode) {
      throw new Error(`currentNode not found: ${this.state.currentNodeId}`);
    }
    const newId = this.generateNodeId(currentNode);
    const newNode: import("../types.js").SGFNode = {
      id: newId,
      parent: currentNode,
      children: [],
      isMainLine: currentNode.children.length === 0,
      move: { ...move },
    };
    currentNode.children.push(newNode);
    return newNode;
  }

  /**
   * currentNode の子要素の主（0番目）に移動する。
   */
  navigateToMainChild(): void {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode) return;
    const main = currentNode.children[0];
    if (!main) return;
    this.state.currentNodeId = main.id;
    this.syncProjections();
  }

  /**
   * currentNode の子要素の副分岐（1番目以降）に移動する。
   * 副分岐が複数ある場合は最初の副分岐に移動。
   */
  navigateToVariationSibling(): void {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode) return;
    if (currentNode.children.length < 2) return;
    const variation = currentNode.children[1];
    if (!variation) return;
    this.state.currentNodeId = variation.id;
    this.syncProjections();
  }

  /**
   * currentNode の親に移動する（ルートより上には行かない）。
   */
  navigateParent(): void {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode || !currentNode.parent) return;
    this.state.currentNodeId = currentNode.parent.id;
    this.syncProjections();
  }

  /**
   * 兄弟間で循環する（主→副→主→...）。
   * 兄弟がない場合は何もしない。
   */
  cycleSibling(): void {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode || !currentNode.parent) return;
    const siblings = currentNode.parent.children;
    if (siblings.length < 2) return;
    const idx = siblings.findIndex((n) => n.id === currentNode.id);
    const next = siblings[(idx + 1) % siblings.length];
    if (!next) return;
    this.state.currentNodeId = next.id;
    this.syncProjections();
  }

  /**
   * currentNode を副分岐として削除する。主分岐の最初の子やルート自身は削除できない。
   * 戻り値: 削除に成功したか
   */
  deleteCurrentVariation(): boolean {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode || !currentNode.parent) return false;
    const siblings = currentNode.parent.children;
    if (siblings.length <= 1) return false; // 主分岐は消せない
    const idx = siblings.findIndex((n) => n.id === currentNode.id);
    if (idx <= 0) return false; // 主分岐(0番目)は消せない
    siblings.splice(idx, 1);
    // 親ノードの主分岐へ戻る
    this.state.currentNodeId = currentNode.parent.id;
    this.syncProjections();
    return true;
  }

  /**
   * currentNode を主分岐に昇格させる（他の兄弟は削除される）。
   * currentNode がすでに主分岐なら何も変わらない。
   */
  promoteCurrentToMain(): void {
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode || !currentNode.parent) return;
    const siblings = currentNode.parent.children;
    if (siblings.length === 0) return;
    const idx = siblings.findIndex((n) => n.id === currentNode.id);
    if (idx <= 0) {
      // すでに主分岐
      currentNode.isMainLine = true;
      for (const s of siblings) s.isMainLine = s.id === currentNode.id;
      return;
    }
    // currentNode を先頭に移動し、他の兄弟を削除
    const newSiblings = [currentNode];
    currentNode.isMainLine = true;
    for (const s of siblings) {
      if (s.id !== currentNode.id) {
        // 副分岐のサブツリーは削除（メモリリーク防止）
      }
    }
    currentNode.parent.children = newSiblings;
    this.syncProjections();
  }

  // ============================================================
  // 公開: 投影の同期（main line と sgfMoves / sgfIndex / nodeMarkers）
  // ============================================================

  /**
   * sgfTree と currentNodeId から sgfMoves / sgfIndex / nodeMarkers / rootMarkers / markers を再計算する。
   * 木の構造を変更した後、必ず呼ぶこと。
   */
  syncProjections(): void {
    const path = this.buildPathFromRoot(this.state.currentNodeId);
    // path[0] はルート、path[1] は最初の着手、...
    const moves: import("../types.js").Move[] = [];
    const nodeMarkers: import("../types.js").BoardMarker[][] = [];
    let rootMarkers = this.cloneNodeMarkers(this.state.sgfTree);
    for (let i = 1; i < path.length; i++) {
      const node = path[i];
      if (!node) continue;
      if (node.move) moves.push({ ...node.move });
      nodeMarkers.push(this.cloneNodeMarkers(node));
    }
    this.state.sgfMoves = moves;
    this.state.sgfIndex = moves.length;
    this.state.nodeMarkers = nodeMarkers;
    this.state.rootMarkers = rootMarkers;
    // markers は currentNode に紐付ける
    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (currentNode && currentNode.id !== "root") {
      this.state.markers = this.cloneNodeMarkers(currentNode);
    } else {
      this.state.markers = rootMarkers;
    }
  }

  private buildPathFromRoot(nodeId: string): import("../types.js").SGFNode[] {
    const path: import("../types.js").SGFNode[] = [];
    let current: import("../types.js").SGFNode | null = this.findNodeById(nodeId);
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  }

  private cloneNodeMarkers(node: import("../types.js").SGFNode): import("../types.js").BoardMarker[] {
    const ext = node as import("../types.js").SGFNode & { __markers?: import("../types.js").BoardMarker[] };
    if (!ext.__markers) return [];
    return ext.__markers.map((m) => ({
      pos: { ...m.pos },
      kind: m.kind,
      ...(m.label !== undefined ? { label: m.label } : {}),
    }));
  }

  private generateNodeId(parent: import("../types.js").SGFNode): string {
    // 衝突しないIDを生成（親ID-子index）
    return `${parent.id}-${parent.children.length}`;
  }

  /** 現 state に問題図が設定されているか */
  hasProblemDiagram(): boolean {
    return this.state.problemDiagramSet;
  }

  // ============================================================
  // 公開: SGF 読み込み時の状態初期化
  // ============================================================

  /**
   * SGF 読み込み前に盤サイズと盤面を初期化する。
   * newSize が指定された場合のみ boardSize を更新し、盤面をクリアする。
   * newSize が省略された場合は現在の boardSize で盤面だけクリアする。
   */
  prepareBoardForSgf(newSize?: number): void {
    if (newSize !== undefined && newSize !== this.state.boardSize) {
      this.state.boardSize = newSize;
    }
    this.state.board = createEmptyBoard(this.state.boardSize);
  }

  /**
   * SGF 読み込み時に状態を初期化する。履歴保存 + 盤サイズ/盤面変更 +
   * 各種フラグのリセットを行う。
   */
  resetForSgfLoad(sgfMovesCountBeforeLoad: number): void {
    this.history.save(
      `SGF読み込み前（${sgfMovesCountBeforeLoad}手）`,
      this.state
    );
    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberMode = false;
    this.state.numberStartIndex = 0;
    this.state.handicapStones = 0;
    this.state.sgfTree = this.createEmptyRoot();
    this.state.currentNodeId = 'root';
    this.state.studyMode = false;
    this.state.sgfLoadedFromExternal = true;
    this.state.handicapPositions = [];
    this.state.problemDiagramSet = false;
    this.state.problemDiagramBlack = [];
    this.state.problemDiagramWhite = [];
    this.state.startColor = 1;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.eraseMode = false;
    this.state.markers = [];
    this.state.rootMarkers = [];
    this.state.nodeMarkers = [];
    this.state.gameInfo = {
      ...this.state.gameInfo,
      title: '',
      komi: this.state.komi,
      handicap: null,
      playerBlack: null,
      playerWhite: null,
      result: null,
      boardSize: this.state.boardSize,
      handicapStones: 0,
      handicapPositions: [],
      startColor: 1,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: [],
    };
    this.cache.invalidate();
  }

  /**
   * SGF のメタ情報（先手色/置石/問題図）を state に適用する。
   * BoardCacheManager の初期盤面構築は呼び出し側で行う。
   */
  applySgfMeta(gameInfo: SGFGameInfo): void {
    if (gameInfo.startColor !== undefined) {
      this.state.startColor = gameInfo.startColor as StoneColor;
    }
    if (gameInfo.handicapStones !== undefined) {
      this.state.handicapStones = gameInfo.handicapStones;
    }
    if (gameInfo.handicapPositions) {
      this.state.handicapPositions = gameInfo.handicapPositions.map((pos) => ({ ...pos }));
    }
    if (gameInfo.problemDiagramBlack) {
      this.state.problemDiagramBlack = gameInfo.problemDiagramBlack.map((pos) => ({ ...pos }));
    }
    if (gameInfo.problemDiagramWhite) {
      this.state.problemDiagramWhite = gameInfo.problemDiagramWhite.map((pos) => ({ ...pos }));
    }
    if (gameInfo.problemDiagramSet !== undefined) {
      this.state.problemDiagramSet = gameInfo.problemDiagramSet;
    } else if (
      this.state.problemDiagramBlack.length > 0 ||
      this.state.problemDiagramWhite.length > 0
    ) {
      this.state.problemDiagramSet = true;
    }
  }

  /**
   * SGF メタ情報から gameInfo を更新する（対局者・コミ・結果・タイトル等）。
   * GameStore.updateGameInfo と同じ更新だが、boardSize/handicap 系は別途適用。
   */
  updateGameInfoFromSgf(sgfGameInfo: SGFGameInfo): void {
    this.state.gameInfo = {
      ...this.state.gameInfo,
      handicap: sgfGameInfo.handicap ?? this.state.gameInfo.handicap ?? null,
      boardSize: sgfGameInfo.boardSize ?? this.state.boardSize,
      handicapStones: sgfGameInfo.handicapStones ?? this.state.handicapStones,
      handicapPositions: sgfGameInfo.handicapPositions ?? this.state.handicapPositions,
      startColor: this.state.startColor,
      problemDiagramSet: this.state.problemDiagramSet,
      problemDiagramBlack: this.state.problemDiagramBlack,
      problemDiagramWhite: this.state.problemDiagramWhite,
    };
  }

  /**
   * SGF から読み込んだ手順を state.sgfMoves にセットし、sgfIndex を 0 にする。
   * BoardCacheManager 側の rebuild は呼び出し側で行う。
   */
  setSgfMoves(moves: import("../types.js").Move[]): void {
    this.state.sgfMoves = moves.map((move) => ({ ...move }));
    this.state.sgfIndex = 0;
  }

  /**
   * SGF のルート木を state.sgfTree にセットし、currentNodeId を 'root' にする。
   * SGF 読込直後に呼び出される。
   */
  setSgfTree(root: import("../types.js").SGFNode): void {
    this.state.sgfTree = root;
    this.state.currentNodeId = 'root';
  }

  // ============================================================
  // Internal
  // ============================================================

  private resetToEmptyEditState({
    preserveProblemDiagram,
  }: {
    preserveProblemDiagram: boolean;
  }): void {
    const size = this.state.boardSize;

    this.state.board = createEmptyBoard(size);

    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberStartIndex = 0;
    this.state.capturedCounts = createInitialCapturedCounts();

    this.state.numberMode = false;
    this.state.mode = "alt";
    this.state.eraseMode = false;

    this.state.markers = [];
    this.state.rootMarkers = [];
    this.state.nodeMarkers = [];

    if (!preserveProblemDiagram) {
      this.resetMetadataForNewBoard();
    }

    this.cache.invalidate();
  }

  private resetMetadataForNewBoard(): void {
    this.state.handicapStones = 0;
    this.state.handicapPositions = [];
    this.state.problemDiagramSet = false;
    this.state.problemDiagramBlack = [];
    this.state.problemDiagramWhite = [];
    this.state.sgfTree = this.createEmptyRoot();
    this.state.currentNodeId = 'root';
    this.state.studyMode = false;
    this.state.sgfLoadedFromExternal = false;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.gameInfo = {
      ...this.state.gameInfo,
      title: "",
    };
    this.state.capturedCounts = createInitialCapturedCounts();
  }

  private cloneMarkers(markers: import("../types.js").BoardMarker[] | undefined): import("../types.js").BoardMarker[] {
    if (!markers) return [];
    return markers.map((m) => ({ pos: { ...m.pos }, kind: m.kind }));
  }

  /** ルートのみの空SGFツリーを生成する（子を持たない初期状態） */
  private createEmptyRoot(): import("../types.js").SGFNode {
    return {
      id: 'root',
      parent: null,
      children: [],
      isMainLine: true,
    };
  }

  private hasGameData(): boolean {
    return hasGameData(this.state);
  }

  private saveToHistory(label: string): void {
    this.history.save(label, this.state);
  }

  /**
   * 内部: 現在の盤面を問題図として state.problemDiagram* にキャプチャする。
   * 履歴保存は行わない。setProblemDiagram と enterSolveMode の自動昇格から
   * 重複して履歴を積むのを避けるために分離している。
   */
  private captureBoardAsProblemDiagram(): void {
    const blackPositions: Position[] = [];
    const whitePositions: Position[] = [];

    for (let row = 0; row < this.state.boardSize; row++) {
      for (let col = 0; col < this.state.boardSize; col++) {
        const cell = this.state.board[row][col];
        if (cell === 1) {
          blackPositions.push({ col, row });
        } else if (cell === 2) {
          whitePositions.push({ col, row });
        }
      }
    }

    this.state.problemDiagramBlack = blackPositions.map((pos) => ({ ...pos }));
    this.state.problemDiagramWhite = whitePositions.map((pos) => ({ ...pos }));
    this.state.problemDiagramSet = true;
  }
}
