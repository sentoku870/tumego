// ============ モード遷移&局面管理 ============
// 編集モード ⇄ 解答モードの切り替え、問題図の確定・復元、初期化などを行う。
// 盤面タイムラインキャッシュの制御は BoardCacheManager に委譲する。
import { DEFAULT_CONFIG, } from "../types.js";
import { createEmptyBoard, createInitialCapturedCounts, hasGameData } from "./board-utils.js";
export class ModeOperations {
    constructor(state, history, cache) {
        this.state = state;
        this.history = history;
        this.cache = cache;
    }
    // ============================================================
    // 公開操作
    // ============================================================
    /**
     * 盤面サイズを変更する。skipHistory が false で既存データがある場合、
     * 履歴に保存する。
     */
    initBoard(size, options) {
        var _a;
        const skipHistory = (_a = options === null || options === void 0 ? void 0 : options.skipHistory) !== null && _a !== void 0 ? _a : false;
        if (!skipHistory && hasGameData(this.state)) {
            this.saveToHistory(`${this.state.boardSize}路盤→${size}路盤 変更前`);
        }
        this.state.boardSize = size;
        this.resetToEmptyEditState({ preserveProblemDiagram: false });
    }
    /** 「全消去」ボタン相当 */
    resetForClearAll() {
        if (hasGameData(this.state)) {
            this.saveToHistory(`全消去前（${this.state.boardSize}路盤）`);
        }
        this.resetToEmptyEditState({ preserveProblemDiagram: false });
    }
    /** 現在の盤面を問題図として固定する */
    setProblemDiagram() {
        if (hasGameData(this.state)) {
            this.saveToHistory("問題図確定");
        }
        const blackPositions = [];
        const whitePositions = [];
        for (let row = 0; row < this.state.boardSize; row++) {
            for (let col = 0; col < this.state.boardSize; col++) {
                const cell = this.state.board[row][col];
                if (cell === 1) {
                    blackPositions.push({ col, row });
                }
                else if (cell === 2) {
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
    }
    /** 問題図が設定済みの場合、問題図の状態に復元する */
    restoreProblemDiagram() {
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
    enterSolveMode() {
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
    exitSolveModeToEmptyBoard() {
        this.resetToEmptyEditState({ preserveProblemDiagram: true });
    }
    /** 現 state に問題図が設定されているか */
    hasProblemDiagram() {
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
    prepareBoardForSgf(newSize) {
        if (newSize !== undefined && newSize !== this.state.boardSize) {
            this.state.boardSize = newSize;
        }
        this.state.board = createEmptyBoard(this.state.boardSize);
    }
    /**
     * SGF 読み込み時に状態を初期化する。履歴保存 + 盤サイズ/盤面変更 +
     * 各種フラグのリセットを行う。
     */
    resetForSgfLoad(sgfMovesCountBeforeLoad) {
        this.history.save(`SGF読み込み前（${sgfMovesCountBeforeLoad}手）`, this.state);
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
    applySgfMeta(gameInfo) {
        if (gameInfo.startColor !== undefined) {
            this.state.startColor = gameInfo.startColor;
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
        }
        else if (this.state.problemDiagramBlack.length > 0 ||
            this.state.problemDiagramWhite.length > 0) {
            this.state.problemDiagramSet = true;
        }
    }
    /**
     * SGF メタ情報から gameInfo を更新する（対局者・コミ・結果・タイトル等）。
     * GameStore.updateGameInfo と同じ更新だが、boardSize/handicap 系は別途適用。
     */
    updateGameInfoFromSgf(sgfGameInfo) {
        var _a, _b, _c, _d, _e;
        this.state.gameInfo = {
            ...this.state.gameInfo,
            handicap: (_b = (_a = sgfGameInfo.handicap) !== null && _a !== void 0 ? _a : this.state.gameInfo.handicap) !== null && _b !== void 0 ? _b : null,
            boardSize: (_c = sgfGameInfo.boardSize) !== null && _c !== void 0 ? _c : this.state.boardSize,
            handicapStones: (_d = sgfGameInfo.handicapStones) !== null && _d !== void 0 ? _d : this.state.handicapStones,
            handicapPositions: (_e = sgfGameInfo.handicapPositions) !== null && _e !== void 0 ? _e : this.state.handicapPositions,
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
    setSgfMoves(moves) {
        this.state.sgfMoves = moves.map((move) => ({ ...move }));
        this.state.sgfIndex = 0;
    }
    // ============================================================
    // Internal
    // ============================================================
    resetToEmptyEditState({ preserveProblemDiagram, }) {
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
    resetMetadataForNewBoard() {
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
    hasGameData() {
        return hasGameData(this.state);
    }
    saveToHistory(label) {
        this.history.save(label, this.state);
    }
}
//# sourceMappingURL=mode-operations.js.map