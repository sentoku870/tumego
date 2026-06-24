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

    this.state.handicapPositions = [];
    this.state.handicapStones = 0;
    this.state.gameTree = null;
    this.state.sgfLoadedFromExternal = false;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.turn = 0;
    this.state.numberMode = false;
    this.state.numberStartIndex = 0;
    this.state.history = [];

    const baseBoard = this.cache.applyInitialSetup();
    this.state.board = baseBoard;
    this.cache.invalidate();

    this.saveToHistory("問題図確定");
  }

  /** 問題図が設定済みの場合、問題図の状態に復元する */
  restoreProblemDiagram(): void {
    if (!this.state.problemDiagramSet) {
      return;
    }

    this.state.sgfIndex = 0;
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

    if (this.state.problemDiagramSet) {
      const baseBoard = this.cache.applyInitialSetup();
      this.state.board = baseBoard;
    }

    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;

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

  /** 番号付き解答記録モードを開始する */
  startNumberMode(color: StoneColor): void {
    this.state.numberMode = true;
    this.state.startColor = color;

    this.state.numberStartIndex = 0;
    this.state.sgfIndex = 0;

    this.state.turn = 0;
    this.state.history = [];
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
    this.state.gameTree = null;
    this.state.sgfLoadedFromExternal = true;
    this.state.handicapPositions = [];
    this.state.problemDiagramSet = false;
    this.state.problemDiagramBlack = [];
    this.state.problemDiagramWhite = [];
    this.state.startColor = 1;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.eraseMode = false;
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
    this.state.gameTree = null;
    this.state.sgfLoadedFromExternal = false;
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.gameInfo = {
      ...this.state.gameInfo,
      title: "",
    };
    this.state.capturedCounts = createInitialCapturedCounts();
  }

  private hasGameData(): boolean {
    return hasGameData(this.state);
  }

  private saveToHistory(label: string): void {
    this.history.save(label, this.state);
  }
}
