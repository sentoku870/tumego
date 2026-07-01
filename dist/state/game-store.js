// ============ GameStore (Facade) ============
// 盤面キャッシュ・置石・モード遷移・計測を内部の専用クラスへ委譲するファサード。
// 公開API（既存呼び出し側との互換性）は維持する。
// 内部の modeOps / cache / handicap / monitor は private であり、
// 外部コード（services, controllers）は GameStore の公開メソッド経由でのみ
// 状態書込を行う。直接アクセスが必要な操作は本クラスにラッパーを追加すること。
import { DEFAULT_CONFIG, } from "../types.js";
import { BoardCacheManager } from "./board-cache-manager.js";
import { HandicapSetter } from "./handicap-setter.js";
import { ModeOperations } from "./mode-operations.js";
import { PerformanceMonitor, } from "./performance-monitor.js";
import { cloneBoard, createInitialCapturedCounts, isValidPosition } from "./board-utils.js";
export class GameStore {
    constructor(state, engine, history) {
        var _a, _b;
        this.state = state;
        this.engine = engine;
        this.history = history;
        this.monitor = new PerformanceMonitor();
        this.cache = new BoardCacheManager(state, engine, this.monitor);
        this.modeOps = new ModeOperations(state, history, this.cache);
        this.handicap = new HandicapSetter(state, engine, history, this.modeOps, this.cache);
        if (!this.state.capturedCounts) {
            this.state.capturedCounts = createInitialCapturedCounts();
        }
        if (!this.state.gameInfo) {
            this.state.gameInfo = this.createDefaultGameInfo();
        }
        else {
            this.state.gameInfo = {
                ...this.createDefaultGameInfo(),
                ...this.state.gameInfo,
                komi: (_b = (_a = this.state.gameInfo.komi) !== null && _a !== void 0 ? _a : this.state.komi) !== null && _b !== void 0 ? _b : DEFAULT_CONFIG.DEFAULT_KOMI,
            };
        }
    }
    // ============================================================
    // 公開: 状態参照
    // ============================================================
    get snapshot() {
        return this.state;
    }
    get historyManager() {
        return this.history;
    }
    get currentColor() {
        if (this.state.numberMode) {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        if (this.state.mode === "alt") {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        return this.state.mode === "black" ? 1 : 2;
    }
    // ============================================================
    // 公開: ゲーム情報
    // ============================================================
    getGameInfo() {
        var _a, _b, _c, _d, _e, _f, _g;
        const info = (_a = this.state.gameInfo) !== null && _a !== void 0 ? _a : this.createDefaultGameInfo();
        return {
            title: (_b = info.title) !== null && _b !== void 0 ? _b : "",
            playerBlack: (_c = info.playerBlack) !== null && _c !== void 0 ? _c : null,
            playerWhite: (_d = info.playerWhite) !== null && _d !== void 0 ? _d : null,
            komi: (_f = (_e = info.komi) !== null && _e !== void 0 ? _e : this.state.komi) !== null && _f !== void 0 ? _f : DEFAULT_CONFIG.DEFAULT_KOMI,
            result: (_g = info.result) !== null && _g !== void 0 ? _g : null,
        };
    }
    updateGameInfo(patch) {
        const current = this.getGameInfo();
        const next = {
            ...current,
            ...patch,
        };
        if (patch.komi !== undefined) {
            if (typeof patch.komi === "number" && Number.isFinite(patch.komi)) {
                this.state.komi = patch.komi;
                next.komi = patch.komi;
            }
            else {
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
    tryMove(pos, record = true) {
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
            this.state.sgfIndex = this.state.sgfMoves.length;
        }
        this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
        return true;
    }
    removeStone(pos) {
        if (!this.isValidPosition(pos)) {
            return false;
        }
        const currentStone = this.state.board[pos.row][pos.col];
        if (currentStone === 0) {
            return false;
        }
        if (this.state.sgfLoadedFromExternal || this.state.numberMode) {
            const removeIndex = this.cache.findLastMoveIndex(pos, currentStone);
            if (removeIndex === -1) {
                this.state.board[pos.row][pos.col] = 0;
                this.cache.invalidate();
                return true;
            }
            this.state.sgfMoves = this.state.sgfMoves.slice(0, removeIndex);
            this.state.sgfIndex = this.state.sgfMoves.length;
            this.applyRebuildResult(this.cache.rebuildBoardFromMoves(this.state.sgfIndex));
            this.cache.invalidate();
            return true;
        }
        this.state.board[pos.row][pos.col] = 0;
        this.cache.invalidate();
        return true;
    }
    /** 編集モード専用: ルール無視で直接配置 */
    directPlace(pos, color) {
        if (!this.isValidPosition(pos))
            return false;
        const board = this.cloneBoard();
        board[pos.row][pos.col] = color;
        this.state.board = board;
        this.state.turn++;
        this.cache.invalidate();
        return true;
    }
    /** 編集モード専用: ルール適用して配置 */
    placeWithRulesInEdit(pos, color) {
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
    directRemove(pos) {
        if (!this.isValidPosition(pos))
            return false;
        if (this.state.board[pos.row][pos.col] === 0)
            return false;
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
    initBoard(size, options) {
        this.modeOps.initBoard(size, options);
    }
    undo() {
        const restored = this.history.restoreLast(this.state);
        if (restored) {
            this.applyAfterHistoryRestore();
        }
        return restored;
    }
    restoreHistorySnapshot(index) {
        const restored = this.history.restore(index, this.state);
        if (restored) {
            this.applyAfterHistoryRestore();
        }
        return restored;
    }
    setMoveIndex(index) {
        const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
        const result = this.cache.setMoveIndex(clamped);
        this.applyRebuildResult(result);
        this.state.sgfIndex = clamped;
    }
    /**
     * 後方互換のため公開。盤面タイムラインを指定手数まで再構築し state を更新する。
     * 戻り値は最終盤面（後方互換のため Board | null 型）。
     */
    rebuildBoardFromMoves(limit) {
        const result = this.cache.rebuildBoardFromMoves(limit);
        this.applyRebuildResult(result);
        return result.board;
    }
    // ============================================================
    // 公開: モード遷移（ModeOperations への委譲）
    // ============================================================
    setProblemDiagram() {
        this.modeOps.setProblemDiagram();
    }
    restoreProblemDiagram() {
        this.modeOps.restoreProblemDiagram();
    }
    hasProblemDiagram() {
        return this.modeOps.hasProblemDiagram();
    }
    enterSolveMode() {
        this.modeOps.enterSolveMode();
    }
    exitSolveModeToEmptyBoard() {
        this.modeOps.exitSolveModeToEmptyBoard();
    }
    resetForClearAll() {
        this.modeOps.resetForClearAll();
    }
    // ============================================================
    // 公開: 単純な状態書込 setter
    // ============================================================
    /** 配置モード（black/white/alt）を切り替える */
    setMode(mode) {
        this.state.mode = mode;
    }
    /** 消去モードをオン／オフする */
    setEraseMode(enabled) {
        this.state.eraseMode = enabled;
    }
    /** 先手色（黒/白）を切り替える */
    setStartColor(color) {
        this.state.startColor = color;
    }
    /** 解答モードでの先手色（黒先/白先）を切り替える */
    setAnswerMode(mode) {
        this.state.answerMode = mode;
    }
    /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
    resetInteractionModes() {
        this.state.mode = 'alt';
        this.state.numberMode = false;
        this.state.eraseMode = false;
    }
    // ============================================================
    // 公開: 置石（HandicapSetter への委譲）
    // ============================================================
    setHandicap(stones) {
        this.handicap.apply(stones);
    }
    // ============================================================
    // 公開: SGF 適用（ModeOperations への委譲ラッパー）
    // ============================================================
    /** SGF 読み込み前に盤サイズと盤面を初期化を委譲 */
    prepareBoardForSgf(newSize) {
        this.modeOps.prepareBoardForSgf(newSize);
    }
    /** SGF 読み込み時の状態初期化を委譲 */
    resetForSgfLoad(sgfMovesCountBeforeLoad) {
        this.modeOps.resetForSgfLoad(sgfMovesCountBeforeLoad);
    }
    /** SGF メタ情報（先手色/置石/問題図）の適用を委譲 */
    applySgfMeta(gameInfo) {
        this.modeOps.applySgfMeta(gameInfo);
    }
    /** SGF メタ情報から gameInfo を更新（boardSize/handicap 系）を委譲 */
    updateGameInfoFromSgf(sgfGameInfo) {
        this.modeOps.updateGameInfoFromSgf(sgfGameInfo);
    }
    /** SGF 手順のセットを委譲 */
    setSgfMoves(moves) {
        this.modeOps.setSgfMoves(moves);
    }
    // ============================================================
    // 公開: パフォーマンス計測
    // ============================================================
    setPerformanceDebugging(enabled, reset = true) {
        this.monitor.setEnabled(enabled, reset);
    }
    resetPerformanceMetrics() {
        this.monitor.reset();
    }
    getPerformanceMetrics() {
        return this.monitor.getMetrics();
    }
    // ============================================================
    // Internal
    // ============================================================
    createDefaultGameInfo() {
        var _a;
        return {
            title: "",
            playerBlack: null,
            playerWhite: null,
            komi: (_a = this.state.komi) !== null && _a !== void 0 ? _a : DEFAULT_CONFIG.DEFAULT_KOMI,
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
    applyRebuildResult(result) {
        this.state.board = result.board;
        this.state.history = result.history;
        this.state.turn = result.turn;
        this.state.capturedCounts = result.counts;
    }
    applyAfterHistoryRestore() {
        this.state.sgfIndex = Math.max(0, Math.min(this.state.sgfIndex, this.state.sgfMoves.length));
        this.state.numberStartIndex = Math.max(0, Math.min(this.state.numberStartIndex, this.state.sgfMoves.length));
        const result = this.cache.rebuildCacheFromHistoryRestore(this.state.sgfIndex, this.state.numberStartIndex);
        this.state.history = result.history;
        this.state.turn = result.turn;
        this.state.capturedCounts = result.counts;
        this.syncKomiToGameInfo();
    }
    syncKomiToGameInfo() {
        this.state.gameInfo = {
            ...this.state.gameInfo,
            komi: this.state.komi,
        };
    }
    cloneBoard() {
        return cloneBoard(this.state.board);
    }
    isValidPosition(pos) {
        return isValidPosition(this.state.boardSize, pos);
    }
}
//# sourceMappingURL=game-store.js.map