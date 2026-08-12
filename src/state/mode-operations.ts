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
import { createEmptyBoard, createInitialCapturedCounts, hasGameData, cloneMarkers } from "./board-utils.js";
import { HistoryManager } from "../history-manager.js";
import { BoardCacheManager } from "./board-cache-manager.js";
import { GameInfoStore } from "./game-info-store.js";

export class ModeOperations {
  constructor(
    private readonly state: GameState,
    private readonly history: HistoryManager,
    private readonly cache: BoardCacheManager,
    private readonly gameInfoStore: GameInfoStore
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
    this.state.markers = cloneMarkers(this.state.rootMarkers);
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
    if (hasGameData(this.state)) {
      this.saveToHistory(`解答開始前（${this.state.sgfMoves.length}手）`);
    }

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
    this.state.markers = cloneMarkers(this.state.rootMarkers);

    this.state.numberMode = true;
    this.state.numberStartIndex = 0;
    this.state.eraseMode = false;

    this.state.turn = 0;
    this.state.capturedCounts = createInitialCapturedCounts();
    this.state.history = [];
    this.cache.invalidate();
  }

  /**
   * 解答モードから問題図を盤面に展開して編集モードへ戻す。
   *
   * - 問題図が設定されていれば、それを盤面に復元して編集モード（numberMode=false）に戻る
   * - 問題図が未設定なら、従来どおり空盤面の編集モードへ戻る
   * - 解答中の手順（sgfMoves）は破棄される
   */
  exitSolveModeForEditing(): void {
    if (!this.state.problemDiagramSet) {
      this.resetToEmptyEditState({ preserveProblemDiagram: false });
      return;
    }

    if (this.state.sgfMoves.length > 0) {
      this.saveToHistory(`解答中断前（${this.state.sgfMoves.length}手）`);
    }

    this.state.board = this.cache.applyInitialSetup();
    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberStartIndex = 0;
    this.state.capturedCounts = createInitialCapturedCounts();
    this.state.markers = cloneMarkers(this.state.rootMarkers);
    this.state.numberMode = false;
    this.state.eraseMode = false;
    this.state.mode = "alt";
    this.cache.invalidate();
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
   * 各種フラグのリセットを行う。customLabel を指定すると、履歴スナップショットの
   * ラベルを「SGF読み込み前（X手）」の代わりにその値にする（SGF確定などで利用）。
   */
  resetForSgfLoad(sgfMovesCountBeforeLoad: number, customLabel?: string): void {
    const label = customLabel ?? `SGF読み込み前（${sgfMovesCountBeforeLoad}手）`;
    this.history.save(label, this.state);
    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberMode = false;
    this.state.numberStartIndex = 0;
    this.state.handicapStones = 0;
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
    this.state.koPoint = null;
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
    this.state.koPoint = null;

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
    this.state.sgfLoadedFromExternal = false;
    this.state.capturedCounts = createInitialCapturedCounts();
    // 全消去時はページの初期化と同じ扱いにするため、先手も黒番（デフォルト）
    // に戻す。置石 4 子で白番にしたあとの全消去で手番が白番のままだと
    // ユーザーの感覚とずれるため。
    this.state.startColor = 1;

    // 対局情報（タイトル・対局者・コミ・結果・SGF拡張フィールド）を
    // 既定値に戻す。SGF 読込後のタイトル等を残さないため。
    // GameInfoStore.resetToDefault() に委譲し、createDefault() を
    // 正しく経由することで型と整合性を保つ。
    this.gameInfoStore.resetToDefault();
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
