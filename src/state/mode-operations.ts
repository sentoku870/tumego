// ============ モード遷移&局面管理 ============
// 編集モード ⇄ 解答モードの切り替え、問題図の確定・復元、初期化などを行う。
// 盤面タイムラインキャッシュの制御は BoardCacheManager に委譲する。
import {
  CellState,
  DEFAULT_CONFIG,
  GameState,
  Position,
  StoneColor,
} from "../types.js";
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

    if (!skipHistory && this.hasGameData()) {
      this.saveToHistory(`${this.state.boardSize}路盤→${size}路盤 変更前`);
    }

    this.state.boardSize = size;
    this.resetToEmptyEditState({ preserveProblemDiagram: false });
  }

  /** 「全消去」ボタン相当 */
  resetForClearAll(): void {
    if (this.hasGameData()) {
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
    this.state.capturedCounts = { black: 0, white: 0 };
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
  // Internal
  // ============================================================

  private resetToEmptyEditState({
    preserveProblemDiagram,
  }: {
    preserveProblemDiagram: boolean;
  }): void {
    const size = this.state.boardSize;

    this.state.board = Array.from({ length: size }, () =>
      Array<CellState>(size).fill(0)
    );

    this.state.history = [];
    this.state.turn = 0;
    this.state.sgfMoves = [];
    this.state.sgfIndex = 0;
    this.state.numberStartIndex = 0;
    this.state.capturedCounts = { black: 0, white: 0 };

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
    this.state.capturedCounts = { black: 0, white: 0 };
  }

  private hasGameData(): boolean {
    return (
      this.state.sgfMoves.length > 0 ||
      this.state.handicapStones > 0 ||
      this.state.board.some((row) => row.some((cell) => cell !== 0))
    );
  }

  private saveToHistory(label: string): void {
    this.history.save(label, this.state);
  }
}
