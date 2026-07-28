// ============ GameStore (Facade) ============
// 盤面キャッシュ・置石・モード遷移・計測を内部の専用クラスへ委譲するファサード。
// 公開API（既存呼び出し側との互換性）は維持する。
// 内部の modeOps / cache / handicap / monitor は private であり、
// 外部コード（services, controllers）は GameStore の公開メソッド経由でのみ
// 状態書込を行う。直接アクセスが必要な操作は本クラスにラッパーを追加すること。
import {
  AnswerMode,
  Board,
  BoardMarker,
  CapturedCounts,
  DEFAULT_CONFIG,
  GameInfo,
  GameState,
  MarkerKind,
  Move,
  PlayMode,
  Position,
  SGFGameInfo,
  StoneColor,
} from "../types.js";
import { GoEngine } from "../go-engine.js";
import { HistoryManager } from "../history-manager.js";
import { BoardCacheManager } from "./board-cache-manager.js";
import { HandicapSetter } from "./handicap-setter.js";
import { ModeOperations } from "./mode-operations.js";
import {
  PerformanceMetrics,
  PerformanceMonitor,
} from "./performance-monitor.js";
import { cloneBoard, createInitialCapturedCounts, isValidPosition } from "./board-utils.js";

export class GameStore {
  private readonly cache: BoardCacheManager;
  private readonly modeOps: ModeOperations;
  private readonly handicap: HandicapSetter;
  private readonly monitor: PerformanceMonitor;

  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {
    this.monitor = new PerformanceMonitor();
    this.cache = new BoardCacheManager(state, engine, this.monitor);
    this.modeOps = new ModeOperations(state, history, this.cache);
    this.handicap = new HandicapSetter(state, engine, history, this.modeOps, this.cache);

    if (!this.state.capturedCounts) {
      this.state.capturedCounts = createInitialCapturedCounts();
    }

    if (!this.state.markers) {
      this.state.markers = [];
    }
    if (this.state.activeMarkerLabel === undefined) {
      this.state.activeMarkerLabel = null;
    }
    if (!this.state.rootMarkers) {
      this.state.rootMarkers = [];
    }
    if (!this.state.nodeMarkers) {
      this.state.nodeMarkers = [];
    }

    if (!this.state.gameInfo) {
      this.state.gameInfo = this.createDefaultGameInfo();
    } else {
      this.state.gameInfo = {
        ...this.createDefaultGameInfo(),
        ...this.state.gameInfo,
        komi:
          this.state.gameInfo.komi ??
          this.state.komi ??
          DEFAULT_CONFIG.DEFAULT_KOMI,
      };
    }
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
    if (this.state.numberMode) {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }

    if (this.state.mode === "alt") {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }

    return this.state.mode === "black" ? 1 : 2;
  }

  // ============================================================
  // 公開: ゲーム情報
  // ============================================================

  getGameInfo(): GameInfo {
    const info = this.state.gameInfo ?? this.createDefaultGameInfo();

    return {
      title: info.title ?? "",
      playerBlack: info.playerBlack ?? null,
      playerWhite: info.playerWhite ?? null,
      komi:
        info.komi ?? this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: info.result ?? null,
    };
  }

  updateGameInfo(patch: Partial<GameInfo>): void {
    const current = this.getGameInfo();
    const next: GameInfo = {
      ...current,
      ...patch,
    };

    if (patch.komi !== undefined) {
      if (typeof patch.komi === "number" && Number.isFinite(patch.komi)) {
        this.state.komi = patch.komi;
        next.komi = patch.komi;
      } else {
        next.komi = current.komi;
      }
    }

    this.state.gameInfo = {
      ...this.state.gameInfo,
      ...next,
      komi: next.komi,
    };
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
      this.syncMarkersToCurrentNode();
    }

    this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
    return true;
  }

  removeStone(pos: Position): boolean {
    if (!this.isValidPosition(pos)) {
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
      this.syncMarkersToCurrentNode();
      this.cache.invalidate();
      return true;
    }

    this.state.board[pos.row][pos.col] = 0;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: ルール無視で直接配置 */
  directPlace(pos: Position, color: StoneColor): boolean {
    if (!this.isValidPosition(pos)) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = color;
    this.state.board = board;
    this.state.turn++;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: ルール適用して配置 */
  placeWithRulesInEdit(pos: Position, color: StoneColor): boolean {
    const result = this.engine.playMove(this.state, pos, color);
    if (!result) {
      return false;
    }

    this.state.board = result.board;
    this.state.turn++;
    this.cache.invalidate();
    return true;
  }

  /** 編集モード専用: 石を直接削除 */
  directRemove(pos: Position): boolean {
    if (!this.isValidPosition(pos)) return false;
    if (this.state.board[pos.row][pos.col] === 0) return false;

    const board = this.cloneBoard();
    board[pos.row][pos.col] = 0;
    this.state.board = board;
    this.state.turn = Math.max(0, this.state.turn - 1);
    this.cache.invalidate();
    return true;
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
    this.syncMarkersToCurrentNode();
  }

  /**
   * 後方互換のため公開。盤面タイムラインを指定手数まで再構築し state を更新する。
   * 戻り値は最終盤面（後方互換のため Board | null 型）。
   */
  rebuildBoardFromMoves(limit: number): Board | null {
    const result = this.cache.rebuildBoardFromMoves(limit);
    this.applyRebuildResult(result);
    this.syncMarkersToCurrentNode();
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

  exitSolveModeToEmptyBoard(): void {
    this.modeOps.exitSolveModeToEmptyBoard();
  }

  resetForClearAll(): void {
    this.modeOps.resetForClearAll();
  }

  // ============================================================
  // 公開: 単純な状態書込 setter
  // ============================================================

  /** 配置モード（black/white/alt）を切り替える */
  setMode(mode: PlayMode): void {
    this.state.mode = mode;
  }

  /** 消去モードをオン／オフする */
  setEraseMode(enabled: boolean): void {
    this.state.eraseMode = enabled;
  }

  /** 先手色（黒/白）を切り替える */
  setStartColor(color: StoneColor): void {
    this.state.startColor = color;
  }

  /** 解答モードでの先手色（黒先/白先）を切り替える */
  setAnswerMode(mode: AnswerMode): void {
    this.state.answerMode = mode;
  }

  /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
  resetInteractionModes(): void {
    this.state.mode = 'alt';
    this.state.numberMode = false;
    this.state.eraseMode = false;
  }

  // ============================================================
  // 公開: マーカー
  // ============================================================

  /** マーカーモードのオン/オフとアクティブ種別をまとめて切り替える */
  setMarkerMode(kind: MarkerKind | null, label: string | null = null): void {
    this.state.activeMarkerKind = kind;
    this.state.activeMarkerLabel = kind === 'LB' ? label : null;
    this.state.markerMode = kind !== null;
    this.dispatchDisableEraseModeIfActive();
  }

  /** アクティブ種別のマーカーを pos にトグル配置する。 */
  toggleMarker(pos: Position, allowMulti = false): boolean {
    const kind = this.state.activeMarkerKind;
    if (!kind) return false;
    if (!this.isValidPosition(pos)) return false;
    const label = this.state.activeMarkerLabel ?? undefined;

    const existing = this.findMarkerAt(pos, kind, label);
    if (existing) {
      this.removeMarkerAt(pos, kind, label);
      return false;
    }
    if (!allowMulti) {
      const any = this.findMarkerAt(pos);
      if (any && !allowMulti) {
        this.removeMarkerAt(pos, any.kind, any.label);
      }
    }
    this.addMarkerAt(pos, kind, label);
    return true;
  }

  /** 明示的にマーカーを追加（同種がすでにある場合は何もしない） */
  addMarker(pos: Position, kind: MarkerKind, label?: string): boolean {
    if (!this.isValidPosition(pos)) return false;
    return this.addMarkerAt(pos, kind, label);
  }

  /** 指定種別のマーカーを削除。kind を省略すると pos の全マーカーを削除 */
  removeMarker(pos: Position, kind?: MarkerKind, label?: string): boolean {
    if (!this.isValidPosition(pos)) return false;
    if (kind === undefined) {
      const before = this.state.markers.length;
      this.state.markers = this.state.markers.filter(
        (m) => m.pos.col !== pos.col || m.pos.row !== pos.row
      );
      const changed = this.state.markers.length !== before;
      if (changed) this.persistMarkersToCurrentNode();
      return changed;
    }
    return this.removeMarkerAt(pos, kind, label);
  }

  /** 表示中ノードのマーカーを全消去 */
  clearMarkers(): void {
    if (this.state.markers.length === 0) return;
    this.state.markers = [];
    this.persistMarkersToCurrentNode();
  }

  // ============================================================
  // Internal: マーカー
  // ============================================================

  private findMarkerAt(pos: Position, kind?: MarkerKind, label?: string): BoardMarker | undefined {
    return this.state.markers.find(
      (m) =>
        m.pos.col === pos.col &&
        m.pos.row === pos.row &&
        (kind === undefined || m.kind === kind) &&
        (label === undefined || m.label === label)
    );
  }

  private addMarkerAt(pos: Position, kind: MarkerKind, label?: string): boolean {
    const exists = this.state.markers.some(
      (m) =>
        m.pos.col === pos.col &&
        m.pos.row === pos.row &&
        m.kind === kind &&
        m.label === label
    );
    if (exists) return false;
    const marker: BoardMarker = { pos: { col: pos.col, row: pos.row }, kind };
    if (label !== undefined) marker.label = label;
    this.state.markers.push(marker);
    this.persistMarkersToCurrentNode();
    return true;
  }

  private removeMarkerAt(pos: Position, kind: MarkerKind, label?: string): boolean {
    const before = this.state.markers.length;
    this.state.markers = this.state.markers.filter(
      (m) =>
        !(
          m.pos.col === pos.col &&
          m.pos.row === pos.row &&
          m.kind === kind &&
          (label === undefined || m.label === label)
        )
    );
    const changed = this.state.markers.length !== before;
    if (changed) this.persistMarkersToCurrentNode();
    return changed;
  }

  /**
   * 表示中のマーカー一覧を、現在の sgfIndex に対応する永続スロットに書き戻す。
   * sgfIndex === 0 は問題図レベル（rootMarkers）、それ以降は nodeMarkers[sgfIndex - 1]。
   */
  private persistMarkersToCurrentNode(): void {
    const clone = this.cloneMarkers(this.state.markers);
    if (this.state.sgfIndex === 0) {
      this.state.rootMarkers = clone;
    } else {
      const slot = this.state.sgfIndex - 1;
      this.state.nodeMarkers[slot] = clone;
    }
  }

  /** sgfIndex に応じて state.markers を rootMarkers / nodeMarkers から復元する */
  private syncMarkersToCurrentNode(): void {
    if (this.state.sgfIndex === 0) {
      this.state.markers = this.cloneMarkers(this.state.rootMarkers);
    } else {
      const slot = this.state.sgfIndex - 1;
      const slotMarkers = this.state.nodeMarkers[slot];
      this.state.markers = slotMarkers ? this.cloneMarkers(slotMarkers) : [];
    }
  }

  private cloneMarkers(markers: BoardMarker[]): BoardMarker[] {
    return markers.map((m) => {
      const clone: BoardMarker = { pos: { ...m.pos }, kind: m.kind };
      if (m.label !== undefined) clone.label = m.label;
      return clone;
    });
  }

  private dispatchDisableEraseModeIfActive(): void {
    if (this.state.eraseMode) {
      this.state.eraseMode = false;
    }
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

  /** SGF 読み込み前に盤サイズと盤面を初期化を委譲 */
  prepareBoardForSgf(newSize?: number): void {
    this.modeOps.prepareBoardForSgf(newSize);
  }

  /** SGF 読み込み時の状態初期化を委譲 */
  resetForSgfLoad(sgfMovesCountBeforeLoad: number): void {
    this.modeOps.resetForSgfLoad(sgfMovesCountBeforeLoad);
  }

  /** SGF メタ情報（先手色/置石/問題図）の適用を委譲 */
  applySgfMeta(gameInfo: SGFGameInfo): void {
    this.modeOps.applySgfMeta(gameInfo);
  }

  /** SGF メタ情報から gameInfo を更新（boardSize/handicap 系）を委譲 */
  updateGameInfoFromSgf(sgfGameInfo: SGFGameInfo): void {
    this.modeOps.updateGameInfoFromSgf(sgfGameInfo);
  }

  /** SGF 手順のセットを委譲 */
  setSgfMoves(moves: Move[]): void {
    this.modeOps.setSgfMoves(moves);
  }

  /** SGF パース結果から復元した問題図レベル/着手ノード別のマーカーをセット */
  setNodeMarkers(rootMarkers: BoardMarker[], nodeMarkers: BoardMarker[][]): void {
    this.state.rootMarkers = rootMarkers.map((m) => ({ pos: { ...m.pos }, kind: m.kind }));
    this.state.nodeMarkers = nodeMarkers.map((group) =>
      group.map((m) => ({ pos: { ...m.pos }, kind: m.kind }))
    );
    this.syncMarkersToCurrentNode();
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

  private createDefaultGameInfo(): SGFGameInfo {
    return {
      title: "",
      playerBlack: null,
      playerWhite: null,
      komi: this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: null,
      handicap: null,
      handicapStones: 0,
      handicapPositions: [],
      boardSize: this.state.boardSize,
      startColor: this.state.startColor,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: [],
    };
  }

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

    this.syncMarkersToCurrentNode();
    this.syncKomiToGameInfo();
  }

  private syncKomiToGameInfo(): void {
    this.state.gameInfo = {
      ...this.state.gameInfo,
      komi: this.state.komi,
    };
  }

  private cloneBoard(): Board {
    return cloneBoard(this.state.board);
  }

  private isValidPosition(pos: Position): boolean {
    return isValidPosition(this.state.boardSize, pos);
  }
}
