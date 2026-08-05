// ============ GameStore (Facade) ============
// 盤面キャッシュ・置石・モード遷移・計測・マーカー・ゲーム情報を
// 内部の専用クラスへ委譲するファサード。
// 公開 API (既存呼び出し側との互換性) は維持する。
//
// 内部クラス:
//   - BoardCacheManager: 盤面タイムラインキャッシュ
//   - EditorOps: 編集モード専用 石操作 (直接配置/ルール配置/削除/移動)
//   - HandicapSetter: 置石の適用
//   - MarkerStore: マーカー配置
//   - ModeOperations: 編集⇄解答モード遷移 / SGF 適用
//   - ModeController: 単純なモード setMode/setEraseMode/...
//   - GameInfoStore: 対局情報 (タイトル/対局者/コミ/結果)
//   - PerformanceMonitor: 計測
import {
  Board,
  BoardMarker,
  CapturedCounts,
  GameState,
  MarkerKind,
  Move,
  PlayMode,
  Position,
  SGFGameInfo,
  StoneColor
} from '../types.js';
import { GoEngine } from '../go-engine.js';
import { HistoryManager } from '../history-manager.js';
import { BoardCacheManager } from './board-cache-manager.js';
import { EditorOps } from './editor-ops.js';
import { GameInfoStore } from './game-info-store.js';
import { HandicapSetter } from './handicap-setter.js';
import { MarkerStore } from './marker-store.js';
import { ModeController } from './mode-controller.js';
import { ModeOperations } from './mode-operations.js';
import {
  PerformanceMetrics,
  PerformanceMonitor
} from './performance-monitor.js';
import { cloneBoard, createInitialCapturedCounts, isValidPosition } from './board-utils.js';

export class GameStore {
  private readonly cache: BoardCacheManager;
  private readonly editor: EditorOps;
  private readonly modeOps: ModeOperations;
  private readonly handicap: HandicapSetter;
  private readonly monitor: PerformanceMonitor;
  private readonly markers: MarkerStore;
  private readonly modeController: ModeController;
  private readonly gameInfoStore: GameInfoStore;

  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {
    this.monitor = new PerformanceMonitor();
    this.cache = new BoardCacheManager(state, engine, this.monitor);
    this.editor = new EditorOps(state, engine, this.cache);
    this.gameInfoStore = new GameInfoStore(state);
    this.modeOps = new ModeOperations(state, history, this.cache, this.gameInfoStore);
    this.handicap = new HandicapSetter(state, engine, history, this.modeOps, this.cache);
    this.markers = new MarkerStore(state);
    this.modeController = new ModeController(state);

    if (!this.state.capturedCounts) {
      this.state.capturedCounts = createInitialCapturedCounts();
    }

    this.markers.ensureDefaults();
    this.gameInfoStore.ensureDefaults();
  }

  // ============================================================
  // 公開: 状態参照
  // ============================================================

  get snapshot(): Readonly<GameState> {
    return this.state;
  }

  get historyManager(): HistoryManager {
    return this.history;
  }

  get currentColor(): StoneColor {
    return this.modeController.currentColor;
  }

  // ============================================================
  // 公開: ゲーム情報 (GameInfoStore への委譲)
  // ============================================================

  getGameInfo() {
    return this.gameInfoStore.getGameInfo();
  }

  updateGameInfo(patch: Parameters<GameInfoStore['updateGameInfo']>[0]): void {
    this.gameInfoStore.updateGameInfo(patch);
  }

  /**
   * 対局情報（タイトル・対局者・コミ・結果・SGFSGF 拡張フィールド）を
   * 既定値にリセットする。「全消去」「対局情報リセット」ボタンから呼ばれる。
   */
  resetGameInfo(): void {
    this.gameInfoStore.resetToDefault();
  }

  // ============================================================
  // 公開: 着手・石操作
  // ============================================================

  tryMove(pos: Position, record = true): boolean {
    const moveColor = this.currentColor;
    const result = this.engine.playMove(this.state, pos, moveColor);
    if (!result) {
      return false;
    }

    this.state.board = result.board;
    this.state.turn++;

    if (record) {
      this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
      this.state.sgfMoves.push({ col: pos.col, row: pos.row, color: moveColor });
      this.state.nodeMarkers = this.state.nodeMarkers.slice(0, this.state.sgfIndex);
      this.state.nodeMarkers.push([]);
      this.state.sgfIndex = this.state.sgfMoves.length;
      this.markers.syncToCurrentNode();
    }

    this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
    return true;
  }

  removeStone(pos: Position): boolean {
    if (!isValidPosition(this.state.boardSize, pos)) {
      return false;
    }

    const currentStone = this.state.board[pos.row][pos.col];
    if (currentStone === 0) {
      return false;
    }

    if (this.state.sgfLoadedFromExternal || this.state.numberMode) {
      const removeIndex = this.cache.findLastMoveIndex(
        pos,
        currentStone as StoneColor
      );

      if (removeIndex === -1) {
        this.state.board[pos.row][pos.col] = 0;
        this.cache.invalidate();
        return true;
      }

      this.state.sgfMoves = this.state.sgfMoves.slice(0, removeIndex);
      this.state.nodeMarkers = this.state.nodeMarkers.slice(0, removeIndex);
      this.state.sgfIndex = this.state.sgfMoves.length;
      this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
      this.markers.syncToCurrentNode();
      this.cache.invalidate();
      return true;
    }

    this.state.board[pos.row][pos.col] = 0;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: ルール無視で直接配置 */
  directPlace(pos: Position, color: StoneColor): boolean {
    return this.editor.directPlace(pos, color);
  }

  /** 編集モード専用: ルール適用して配置 */
  placeWithRulesInEdit(pos: Position, color: StoneColor): boolean {
    return this.editor.placeWithRulesInEdit(pos, color);
  }

  /** 編集モード専用: 石を直接削除 */
  directRemove(pos: Position): boolean {
    return this.editor.directRemove(pos);
  }

  /**
   * 編集モード専用: 石を別の交点へ移動する。
   * from に石がなく、to が盤外、from === to のいずれかの場合は false。
   * 移動先に既存石がある場合は上書き（directPlace と同じ挙動）。
   * 履歴は記録しない（細かい編集は履歴に積まない既存方針と整合）。
   * @returns 移動に成功したか
   */
  moveStone(from: Position, to: Position): boolean {
    return this.editor.moveStone(from, to);
  }

  // ============================================================
  // 公開: 盤面初期化・履歴復元・手数移動
  // ============================================================

  initBoard(size: number, options?: { skipHistory?: boolean }): void {
    this.modeOps.initBoard(size, options);
  }

  undo(): boolean {
    const restored = this.history.restoreLast(this.state);
    if (restored) {
      this.applyAfterHistoryRestore();
    }
    return restored;
  }

  restoreHistorySnapshot(index: number): boolean {
    const restored = this.history.restore(index, this.state);
    if (restored) {
      this.applyAfterHistoryRestore();
    }
    return restored;
  }

  setMoveIndex(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
    const result = this.cache.setMoveIndex(clamped);
    this.applyRebuildResult(result);
    this.state.sgfIndex = clamped;
    this.markers.syncToCurrentNode();
  }

  /**
   * 後方互換のため公開。盤面タイムラインを指定手数まで再構築し state を更新する。
   * 戻り値は最終盤面（後方互換のため Board | null 型）。
   */
  rebuildBoardFromMoves(limit: number): Board | null {
    const result = this.cache.rebuildBoardFromMoves(limit);
    this.applyRebuildResult(result);
    this.markers.syncToCurrentNode();
    return result.board;
  }


  // ============================================================
  // 公開: モード遷移（ModeOperations への委譲）
  // ============================================================

  setProblemDiagram(): void {
    this.modeOps.setProblemDiagram();
  }

  restoreProblemDiagram(): void {
    this.modeOps.restoreProblemDiagram();
  }

  hasProblemDiagram(): boolean {
    return this.modeOps.hasProblemDiagram();
  }

  enterSolveMode(): void {
    this.modeOps.enterSolveMode();
  }

  exitSolveModeForEditing(): void {
    this.modeOps.exitSolveModeForEditing();
  }

  resetForClearAll(): void {
    this.modeOps.resetForClearAll();
  }

  // ============================================================
  // 公開: 単純な状態書込 setter (ModeController への委譲)
  // ============================================================

  /** 配置モード (black/white/alt) を切り替える */
  setMode(mode: PlayMode): void {
    this.modeController.setMode(mode);
  }

  /** 消去モードをオン／オフする */
  setEraseMode(enabled: boolean): void {
    this.modeController.setEraseMode(enabled);
  }

  /** 先手色 (黒/白) を切り替える */
  setStartColor(color: StoneColor): void {
    this.modeController.setStartColor(color);
  }

  /** 解答モードでの先手色 (黒先/白先) を切り替える */
  setAnswerMode(mode: Parameters<ModeController['setAnswerMode']>[0]): void {
    this.modeController.setAnswerMode(mode);
  }

  /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
  resetInteractionModes(): void {
    this.modeController.resetInteractionModes();
  }

  // ============================================================
  // 公開: マーカー (MarkerStore への委譲)
  // ============================================================

  setMarkerMode(kind: MarkerKind | null, label: string | null = null): void {
    this.markers.setMarkerModeDisablingErase(kind, label);
  }

  toggleMarker(pos: Position, allowMulti = false): boolean {
    return this.markers.toggleMarker(pos, allowMulti);
  }

  addMarker(pos: Position, kind: MarkerKind, label?: string): boolean {
    return this.markers.addMarker(pos, kind, label);
  }

  removeMarker(pos: Position, kind?: MarkerKind, label?: string): boolean {
    return this.markers.removeMarker(pos, kind, label);
  }

  clearMarkers(): void {
    this.markers.clearMarkers();
  }

  // ============================================================
  // 公開: 置石（HandicapSetter への委譲）
  // ============================================================

  setHandicap(stones: number | string): void {
    this.handicap.apply(stones);
  }

  // ============================================================
  // 公開: SGF 適用（ModeOperations への委譲ラッパー）
  // ============================================================

  prepareBoardForSgf(newSize?: number): void {
    this.modeOps.prepareBoardForSgf(newSize);
  }

  resetForSgfLoad(sgfMovesCountBeforeLoad: number, customLabel?: string): void {
    this.modeOps.resetForSgfLoad(sgfMovesCountBeforeLoad, customLabel);
  }

  applySgfMeta(gameInfo: SGFGameInfo): void {
    this.modeOps.applySgfMeta(gameInfo);
  }

  updateGameInfoFromSgf(sgfGameInfo: SGFGameInfo): void {
    this.modeOps.updateGameInfoFromSgf(sgfGameInfo);
  }

  setSgfMoves(moves: Move[]): void {
    this.modeOps.setSgfMoves(moves);
  }

  setNodeMarkers(rootMarkers: BoardMarker[], nodeMarkers: BoardMarker[][]): void {
    this.markers.setNodeMarkers(rootMarkers, nodeMarkers);
  }

  // ============================================================
  // 公開: パフォーマンス計測
  // ============================================================

  setPerformanceDebugging(enabled: boolean, reset = true): void {
    this.monitor.setEnabled(enabled, reset);
  }

  resetPerformanceMetrics(): void {
    this.monitor.reset();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.monitor.getMetrics();
  }

  // ============================================================
  // Internal
  // ============================================================

  private applyRebuildResult(result: {
    board: Board;
    history: Board[];
    turn: number;
    counts: CapturedCounts;
  }): void {
    this.state.board = result.board;
    this.state.history = result.history;
    this.state.turn = result.turn;
    this.state.capturedCounts = result.counts;
  }

  private applyAfterHistoryRestore(): void {
    this.state.sgfIndex = Math.max(
      0,
      Math.min(this.state.sgfIndex, this.state.sgfMoves.length)
    );
    this.state.numberStartIndex = Math.max(
      0,
      Math.min(this.state.numberStartIndex, this.state.sgfMoves.length)
    );

    const result = this.cache.rebuildCacheFromHistoryRestore(
      this.state.sgfIndex,
      this.state.numberStartIndex
    );
    this.state.history = result.history;
    this.state.turn = result.turn;
    this.state.capturedCounts = result.counts;

    this.markers.syncToCurrentNode();
    this.gameInfoStore.syncKomiToGameInfo();
  }

  private cloneBoard(): Board {
    return cloneBoard(this.state.board);
  }
}
