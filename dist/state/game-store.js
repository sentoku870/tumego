import { BoardCacheManager } from './board-cache-manager.js';
import { GameInfoStore } from './game-info-store.js';
import { HandicapSetter } from './handicap-setter.js';
import { MarkerStore } from './marker-store.js';
import { ModeController } from './mode-controller.js';
import { ModeOperations } from './mode-operations.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { cloneBoard, createInitialCapturedCounts, isValidPosition } from './board-utils.js';
export class GameStore {
    constructor(state, engine, history) {
        this.state = state;
        this.engine = engine;
        this.history = history;
        this.monitor = new PerformanceMonitor();
        this.cache = new BoardCacheManager(state, engine, this.monitor);
        this.modeOps = new ModeOperations(state, history, this.cache);
        this.handicap = new HandicapSetter(state, engine, history, this.modeOps, this.cache);
        this.markers = new MarkerStore(state);
        this.modeController = new ModeController(state);
        this.gameInfoStore = new GameInfoStore(state);
        if (!this.state.capturedCounts) {
            this.state.capturedCounts = createInitialCapturedCounts();
        }
        this.markers.ensureDefaults();
        this.gameInfoStore.ensureDefaults();
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
        return this.modeController.currentColor;
    }
    // ============================================================
    // 公開: ゲーム情報 (GameInfoStore への委譲)
    // ============================================================
    getGameInfo() {
        return this.gameInfoStore.getGameInfo();
    }
    updateGameInfo(patch) {
        this.gameInfoStore.updateGameInfo(patch);
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
            this.state.nodeMarkers = this.state.nodeMarkers.slice(0, this.state.sgfIndex);
            this.state.nodeMarkers.push([]);
            this.state.sgfIndex = this.state.sgfMoves.length;
            this.markers.syncToCurrentNode();
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
    /**
     * 編集モード専用: 石を別の交点へ移動する。
     * from に石がなく、to が盤外、from === to のいずれかの場合は false。
     * 移動先に既存石がある場合は上書き（directPlace と同じ挙動）。
     * 履歴は記録しない（細かい編集は履歴に積まない既存方針と整合）。
     * @returns 移動に成功したか
     */
    moveStone(from, to) {
        if (!this.isValidPosition(from))
            return false;
        if (!this.isValidPosition(to))
            return false;
        if (from.col === to.col && from.row === to.row)
            return false;
        const color = this.state.board[from.row][from.col];
        if (color === 0)
            return false;
        // 移動先で同色の石に上書きする場合は実質「無変化」だが、
        // directPlace に揃えて上書き動作とする（仕様: 上書き）
        const board = this.cloneBoard();
        board[from.row][from.col] = 0;
        board[to.row][to.col] = color;
        this.state.board = board;
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
        this.markers.syncToCurrentNode();
    }
    /**
     * 後方互換のため公開。盤面タイムラインを指定手数まで再構築し state を更新する。
     * 戻り値は最終盤面（後方互換のため Board | null 型）。
     */
    rebuildBoardFromMoves(limit) {
        const result = this.cache.rebuildBoardFromMoves(limit);
        this.applyRebuildResult(result);
        this.markers.syncToCurrentNode();
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
    exitSolveModeForEditing() {
        this.modeOps.exitSolveModeForEditing();
    }
    resetForClearAll() {
        this.modeOps.resetForClearAll();
    }
    // ============================================================
    // 公開: 単純な状態書込 setter (ModeController への委譲)
    // ============================================================
    /** 配置モード (black/white/alt) を切り替える */
    setMode(mode) {
        this.modeController.setMode(mode);
    }
    /** 消去モードをオン／オフする */
    setEraseMode(enabled) {
        this.modeController.setEraseMode(enabled);
    }
    /** 先手色 (黒/白) を切り替える */
    setStartColor(color) {
        this.modeController.setStartColor(color);
    }
    /** 解答モードでの先手色 (黒先/白先) を切り替える */
    setAnswerMode(mode) {
        this.modeController.setAnswerMode(mode);
    }
    /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
    resetInteractionModes() {
        this.modeController.resetInteractionModes();
    }
    // ============================================================
    // 公開: マーカー (MarkerStore への委譲)
    // ============================================================
    setMarkerMode(kind, label = null) {
        this.markers.setMarkerMode(kind, label);
    }
    toggleMarker(pos, allowMulti = false) {
        return this.markers.toggleMarker(pos, allowMulti);
    }
    addMarker(pos, kind, label) {
        return this.markers.addMarker(pos, kind, label);
    }
    removeMarker(pos, kind, label) {
        return this.markers.removeMarker(pos, kind, label);
    }
    clearMarkers() {
        this.markers.clearMarkers();
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
    prepareBoardForSgf(newSize) {
        this.modeOps.prepareBoardForSgf(newSize);
    }
    resetForSgfLoad(sgfMovesCountBeforeLoad, customLabel) {
        this.modeOps.resetForSgfLoad(sgfMovesCountBeforeLoad, customLabel);
    }
    applySgfMeta(gameInfo) {
        this.modeOps.applySgfMeta(gameInfo);
    }
    updateGameInfoFromSgf(sgfGameInfo) {
        this.modeOps.updateGameInfoFromSgf(sgfGameInfo);
    }
    setSgfMoves(moves) {
        this.modeOps.setSgfMoves(moves);
    }
    setNodeMarkers(rootMarkers, nodeMarkers) {
        this.markers.setNodeMarkers(rootMarkers, nodeMarkers);
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
        this.markers.syncToCurrentNode();
        this.gameInfoStore.syncKomiToGameInfo();
    }
    cloneBoard() {
        return cloneBoard(this.state.board);
    }
    isValidPosition(pos) {
        return isValidPosition(this.state.boardSize, pos);
    }
}
//# sourceMappingURL=game-store.js.map