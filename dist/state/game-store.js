import { DEFAULT_CONFIG } from '../types.js';
import { debugLog } from '../ui/debug-logger.js';
/**
 * Centralizes all mutations against {@link GameState}. Rendering and UI layers
 * interact through this class to keep domain logic encapsulated.
 */
export class GameStore {
    constructor(state, engine, history) {
        this.state = state;
        this.engine = engine;
        this.history = history;
        // === Cache-related fields (from PR57) ===
        this.cachedBoardState = null;
        this.cachedAppliedMoveIndex = null;
        this.cachedBoardTimeline = [];
        this.cachedMoveApplied = [];
        // === Performance metrics (from main branch) ===
        this.performanceDebug = false;
        this.performanceMetrics = {
            rebuildBoardFromMoves: this.createRebuildMetrics()
        };
    }
    get snapshot() {
        return this.state;
    }
    get historyManager() {
        return this.history;
    }
    setPerformanceDebugging(enabled, reset = true) {
        this.performanceDebug = enabled;
        if (reset) {
            this.resetPerformanceMetrics();
        }
    }
    resetPerformanceMetrics() {
        this.performanceMetrics.rebuildBoardFromMoves = this.createRebuildMetrics();
    }
    getPerformanceMetrics() {
        return {
            rebuildBoardFromMoves: { ...this.performanceMetrics.rebuildBoardFromMoves }
        };
    }
    tryMove(pos, color, record = true) {
        const result = this.engine.playMove(this.state, pos, color);
        if (!result) {
            return false;
        }
        this.pushHistorySnapshot();
        this.state.board = result.board;
        this.state.turn++;
        if (record) {
            this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
            this.state.sgfMoves.push({ col: pos.col, row: pos.row, color });
            this.state.sgfIndex = this.state.sgfMoves.length;
        }
        this.invalidateCache();
        debugLog.log(`石を配置: color=${color} col=${pos.col} row=${pos.row} index=${this.state.sgfIndex}`);
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
            const removeIndex = this.findLastMoveIndex(pos, currentStone);
            if (removeIndex === -1) {
                const board = this.cloneBoard();
                board[pos.row][pos.col] = 0;
                this.state.board = board;
                this.invalidateCache();
                debugLog.log(`石を削除（ローカル）: col=${pos.col} row=${pos.row}`);
                return true;
            }
            this.state.sgfMoves = this.state.sgfMoves.slice(0, removeIndex);
            this.state.sgfIndex = this.state.sgfMoves.length;
            this.rebuildBoardFromMoves(this.state.sgfIndex);
            this.invalidateCache();
            debugLog.log(`着手履歴から石を削除: index=${removeIndex}, col=${pos.col}, row=${pos.row}`);
            return true;
        }
        const board = this.cloneBoard();
        board[pos.row][pos.col] = 0;
        this.state.board = board;
        this.invalidateCache();
        debugLog.log(`石を削除: col=${pos.col} row=${pos.row}`);
        return true;
    }
    initBoard(size) {
        if (this.hasGameData()) {
            this.saveToHistory(`${this.state.boardSize}路盤（${this.state.sgfMoves.length}手）`);
        }
        this.state.boardSize = size;
        this.state.board = Array.from({ length: size }, () => Array(size).fill(0));
        this.resetGameState();
        this.invalidateCache();
        debugLog.log(`盤面初期化: size=${size}`);
    }
    undo() {
        if (this.state.numberMode) {
            this.state.sgfIndex = Math.max(this.state.numberStartIndex, this.state.sgfIndex - 1);
            this.setMoveIndex(this.state.sgfIndex);
            return true;
        }
        if (this.state.turn > 0) {
            this.state.turn = Math.max(0, this.state.turn - 1);
            const snapshot = this.state.history[this.state.turn];
            if (snapshot) {
                this.state.board = this.cloneBoard(snapshot);
            }
            this.invalidateCache();
            return true;
        }
        return false;
    }
    setMoveIndex(index) {
        var _a;
        const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
        let board = this.resolveBoardThroughCache(clamped);
        if (!board) {
            this.performFullReset(clamped);
            board = (_a = this.cachedBoardTimeline[clamped]) !== null && _a !== void 0 ? _a : this.cachedBoardState;
        }
        if (!board) {
            board = this.cloneBoard();
        }
        this.applyCachedBoard(clamped, board);
        debugLog.log(`手順移動: sgfIndex=${clamped}`);
    }
    startNumberMode(color) {
        this.state.numberMode = true;
        this.state.startColor = color;
        this.state.numberStartIndex = this.state.sgfMoves.length;
        this.state.sgfIndex = this.state.sgfMoves.length;
        this.state.turn = 0;
        this.state.history = [];
        this.invalidateCache();
        debugLog.log(`解答モード開始: color=${color}, startIndex=${this.state.numberStartIndex}`);
    }
    setProblemDiagram() {
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
        this.state.problemDiagramBlack = blackPositions.map(pos => ({ ...pos }));
        this.state.problemDiagramWhite = whitePositions.map(pos => ({ ...pos }));
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
        this.applyInitialSetup();
        this.invalidateCache();
        debugLog.log('問題図を確定');
    }
    restoreProblemDiagram() {
        if (!this.state.problemDiagramSet) {
            return;
        }
        this.state.sgfIndex = 0;
        this.rebuildBoardFromMoves(0);
        this.invalidateCache();
        if (this.state.numberMode) {
            this.state.turn = 0;
            this.state.history = [];
        }
        debugLog.log('問題図を復元');
    }
    hasProblemDiagram() {
        return this.state.problemDiagramSet;
    }
    /**
     * テンプレートメソッド。以下の順序で処理を行う:
     * 1. {@link resetBoardForHandicap} 盤面のリセット
     * 2. {@link placeHandicapStones} 置石の配置
     * 3. {@link updateHandicapMetadata} メタデータの更新
     */
    setHandicap(stones) {
        if (this.hasGameData()) {
            this.saveToHistory(`置石変更前（${this.state.handicapStones}子）`);
        }
        const context = this.createHandicapContext(stones);
        this.resetBoardForHandicap(context);
        this.placeHandicapStones(context);
        this.updateHandicapMetadata(context);
        this.invalidateCache();
        debugLog.log(`置石設定: mode=${context.mode}, stones=${context.stones}`);
    }
    get currentColor() {
        if (this.state.numberMode) {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        if (this.state.mode === 'alt') {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        return this.state.mode === 'black' ? 1 : 2;
    }
    pushHistorySnapshot() {
        this.state.history.push(this.cloneBoard());
    }
    cloneBoard(board = this.state.board) {
        return board.map(row => row.slice());
    }
    applyInitialSetup() {
        const size = this.state.boardSize;
        const board = Array.from({ length: size }, () => Array(size).fill(0));
        if (this.state.handicapPositions.length > 0) {
            this.state.handicapPositions.forEach(pos => {
                if (this.isValidPosition(pos)) {
                    board[pos.row][pos.col] = 1;
                }
            });
        }
        if (this.state.problemDiagramSet) {
            this.state.problemDiagramBlack.forEach(pos => {
                if (this.isValidPosition(pos)) {
                    board[pos.row][pos.col] = 1;
                }
            });
            this.state.problemDiagramWhite.forEach(pos => {
                if (this.isValidPosition(pos)) {
                    board[pos.row][pos.col] = 2;
                }
            });
        }
        this.state.board = board;
    }
    setMode(mode) {
        const previous = this.state.mode;
        this.state.mode = mode;
        if (this.state.numberMode) {
            this.state.numberMode = false;
            this.state.turn = this.state.sgfIndex;
            this.state.answerMode = 'black';
        }
        debugLog.log(`モード切替: ${previous} -> ${mode} (startColor=${this.state.startColor})`);
    }
    rebuildBoardFromMoves(limit) {
        const profiling = this.performanceDebug;
        let startTime = 0;
        if (profiling) {
            startTime = this.getTimestamp();
            const metrics = this.performanceMetrics.rebuildBoardFromMoves;
            metrics.callCount++;
            metrics.lastLimit = limit;
        }
        this.state.history = [];
        this.state.turn = 0;
        this.applyInitialSetup();
        const baseBoard = this.cloneBoard();
        this.cachedBoardTimeline = [];
        this.cachedBoardTimeline[0] = baseBoard;
        this.cachedMoveApplied = [];
        const { board, newlyApplied } = this.ensureBoardForIndex(limit);
        const finalBoard = board !== null && board !== void 0 ? board : baseBoard;
        this.cachedBoardTimeline[limit] = finalBoard;
        this.cachedBoardState = finalBoard;
        this.cachedAppliedMoveIndex = limit;
        this.state.history = [];
        for (let i = 0; i < limit; i++) {
            if (!this.cachedMoveApplied[i]) {
                continue;
            }
            const snapshot = this.cachedBoardTimeline[i];
            if (snapshot) {
                this.state.history.push(this.cloneBoard(snapshot));
            }
        }
        this.state.board = this.cloneBoard(finalBoard);
        if (this.state.numberMode) {
            this.state.turn = Math.max(0, limit - this.state.numberStartIndex);
        }
        else {
            this.state.turn = limit;
        }
        if (profiling) {
            const metrics = this.performanceMetrics.rebuildBoardFromMoves;
            const duration = this.getTimestamp() - startTime;
            metrics.totalDurationMs += duration;
            metrics.lastDurationMs = duration;
            metrics.lastAppliedMoves = newlyApplied;
        }
        return finalBoard;
    }
    findLastMoveIndex(pos, color) {
        for (let i = this.state.sgfMoves.length - 1; i >= 0; i--) {
            const move = this.state.sgfMoves[i];
            if (move.col === pos.col && move.row === pos.row && move.color === color) {
                return i;
            }
        }
        return -1;
    }
    hasGameData() {
        return this.state.sgfMoves.length > 0 ||
            this.state.handicapStones > 0 ||
            this.state.board.some(row => row.some(cell => cell !== 0));
    }
    resetGameState() {
        this.state.history = [];
        this.state.turn = 0;
        this.state.sgfMoves = [];
        this.state.sgfIndex = 0;
        this.state.numberStartIndex = 0;
        this.state.eraseMode = false;
        this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
        this.state.handicapStones = 0;
        this.state.handicapPositions = [];
        this.state.problemDiagramSet = false;
        this.state.problemDiagramBlack = [];
        this.state.problemDiagramWhite = [];
        this.state.gameTree = null;
        this.state.numberMode = false;
        this.state.sgfLoadedFromExternal = false;
    }
    invalidateCache() {
        this.cachedBoardState = null;
        this.cachedAppliedMoveIndex = null;
        this.cachedBoardTimeline = [];
        this.cachedMoveApplied = [];
    }
    canUseCache() {
        if (this.cachedBoardState === null ||
            this.cachedAppliedMoveIndex === null ||
            !this.cachedBoardTimeline[this.cachedAppliedMoveIndex]) {
            return false;
        }
        return (this.boardsEqual(this.cachedBoardTimeline[this.cachedAppliedMoveIndex], this.cachedBoardState) &&
            this.boardsEqual(this.state.board, this.cachedBoardState));
    }
    performFullReset(target) {
        const board = this.rebuildBoardFromMoves(target);
        if (board) {
            this.cachedBoardTimeline[target] = board;
            this.cachedBoardState = board;
            this.cachedAppliedMoveIndex = target;
        }
    }
    resolveBoardThroughCache(target) {
        if (!this.canUseCache()) {
            return null;
        }
        if (this.cachedAppliedMoveIndex === null) {
            return null;
        }
        if (target === this.cachedAppliedMoveIndex && this.cachedBoardState) {
            return this.cachedBoardState;
        }
        const { board } = this.ensureBoardForIndex(target);
        return board;
    }
    applyCachedBoard(target, board) {
        this.cachedBoardTimeline[target] = board;
        this.cachedBoardState = board;
        this.cachedAppliedMoveIndex = target;
        this.state.board = this.cloneBoard(board);
        this.state.history = [];
        for (let i = 0; i < target; i++) {
            if (!this.cachedMoveApplied[i]) {
                continue;
            }
            const snapshot = this.cachedBoardTimeline[i];
            if (snapshot) {
                this.state.history.push(this.cloneBoard(snapshot));
            }
        }
        this.state.sgfIndex = target;
        this.state.turn = this.state.numberMode
            ? Math.max(0, target - this.state.numberStartIndex)
            : target;
    }
    ensureBoardForIndex(target) {
        var _a;
        if (target < 0) {
            return { board: null, newlyApplied: 0 };
        }
        const nearest = this.findNearestCachedIndex(target);
        if (nearest === -1) {
            return { board: null, newlyApplied: 0 };
        }
        let board = this.cachedBoardTimeline[nearest];
        let applied = 0;
        for (let index = nearest; index < target; index++) {
            const nextIndex = index + 1;
            const cached = this.cachedBoardTimeline[nextIndex];
            if (cached) {
                board = cached;
                continue;
            }
            const move = this.state.sgfMoves[index];
            if (!move) {
                this.cachedBoardTimeline[nextIndex] = board;
                this.cachedMoveApplied[index] = false;
                continue;
            }
            const workingBoard = this.cloneBoard(board);
            const result = this.engine.playMove(this.state, move, move.color, workingBoard);
            if (!result) {
                this.cachedBoardTimeline[nextIndex] = board;
                this.cachedMoveApplied[index] = false;
                continue;
            }
            board = result.board;
            this.cachedBoardTimeline[nextIndex] = board;
            this.cachedMoveApplied[index] = true;
            applied++;
        }
        return {
            board: (_a = this.cachedBoardTimeline[target]) !== null && _a !== void 0 ? _a : board,
            newlyApplied: applied
        };
    }
    findNearestCachedIndex(target) {
        for (let index = Math.min(target, this.cachedBoardTimeline.length - 1); index >= 0; index--) {
            if (this.cachedBoardTimeline[index]) {
                return index;
            }
        }
        return -1;
    }
    boardsEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        for (let row = 0; row < a.length; row++) {
            const rowA = a[row];
            const rowB = b[row];
            if (rowA.length !== rowB.length) {
                return false;
            }
            for (let col = 0; col < rowA.length; col++) {
                if (rowA[col] !== rowB[col]) {
                    return false;
                }
            }
        }
        return true;
    }
    saveToHistory(description) {
        this.history.save(description, this.state);
    }
    createRebuildMetrics() {
        return {
            callCount: 0,
            totalDurationMs: 0,
            lastDurationMs: 0,
            lastLimit: 0,
            lastAppliedMoves: 0
        };
    }
    getTimestamp() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }
    isValidPosition(pos) {
        return pos.col >= 0 && pos.col < this.state.boardSize &&
            pos.row >= 0 && pos.row < this.state.boardSize;
    }
    createHandicapContext(stones) {
        if (stones === 'even') {
            return { mode: 'even', stones: 0, positions: [] };
        }
        const numeric = Number(stones);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new Error(`無効な置石数: ${stones}`);
        }
        if (numeric === 0) {
            return { mode: 'no-komi', stones: 0, positions: [] };
        }
        const positions = this.engine.generateHandicapPositions(this.state.boardSize, numeric);
        console.log(`置石設定: ${stones}子, 位置:`, positions);
        console.log(`${this.state.boardSize}路盤 ${stones}子局の置石位置:`, positions);
        return { mode: 'fixed', stones: numeric, positions };
    }
    resetBoardForHandicap(_context) {
        this.initBoard(this.state.boardSize);
    }
    placeHandicapStones(context) {
        if (context.mode !== 'fixed') {
            return;
        }
        context.positions.forEach(pos => {
            if (this.isValidPosition(pos)) {
                this.state.board[pos.row][pos.col] = 1;
            }
        });
    }
    updateHandicapMetadata(context) {
        if (context.mode === 'even') {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
            this.state.startColor = 1;
            return;
        }
        if (context.mode === 'no-komi') {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = 0;
            this.state.startColor = 1;
            return;
        }
        this.state.handicapStones = context.stones;
        this.state.handicapPositions = context.positions.map(pos => ({ ...pos }));
        this.state.komi = 0;
        this.state.startColor = 2;
        this.state.turn = 0;
    }
}
//# sourceMappingURL=game-store.js.map