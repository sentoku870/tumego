import { DEFAULT_CONFIG } from '../types.js';
/**
 * Centralizes all mutations against {@link GameState}. Rendering and UI layers
 * interact through this class to keep domain logic encapsulated.
 */
export class GameStore {
    constructor(state, engine, history) {
        this.state = state;
        this.engine = engine;
        this.history = history;
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
        const handicapIndex = this.state.handicapPositions.findIndex(handicap => handicap.col === pos.col && handicap.row === pos.row);
        if (handicapIndex !== -1) {
            this.state.handicapPositions.splice(handicapIndex, 1);
            this.state.handicapStones = this.state.handicapPositions.length;
            this.rebuildBoardFromMoves(this.state.sgfIndex);
            return true;
        }
        const removeIndex = this.findLastMoveIndex(pos, currentStone);
        if (removeIndex === -1) {
            const board = this.cloneBoard();
            board[pos.row][pos.col] = 0;
            this.state.board = board;
            return true;
        }
        const updatedMoves = [...this.state.sgfMoves];
        updatedMoves.splice(removeIndex, 1);
        if (this.state.numberMode && removeIndex < this.state.numberStartIndex) {
            this.state.numberStartIndex = Math.max(0, this.state.numberStartIndex - 1);
        }
        this.state.sgfMoves = updatedMoves;
        if (this.state.numberMode) {
            this.state.numberStartIndex = Math.min(this.state.numberStartIndex, this.state.sgfMoves.length);
        }
        if (this.state.sgfIndex > removeIndex) {
            this.state.sgfIndex = Math.max(removeIndex, this.state.sgfIndex - 1);
        }
        else if (this.state.sgfIndex > this.state.sgfMoves.length) {
            this.state.sgfIndex = this.state.sgfMoves.length;
        }
        this.rebuildBoardFromMoves(this.state.sgfIndex);
        return true;
    }
    initBoard(size) {
        if (this.hasGameData()) {
            this.saveToHistory(`${this.state.boardSize}路盤（${this.state.sgfMoves.length}手）`);
        }
        this.state.boardSize = size;
        this.state.board = Array.from({ length: size }, () => Array(size).fill(0));
        this.resetGameState();
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
            return true;
        }
        return false;
    }
    setMoveIndex(index) {
        const clamped = Math.max(0, Math.min(index, this.state.sgfMoves.length));
        this.state.history = [];
        this.state.turn = 0;
        this.applyInitialSetup();
        for (let i = 0; i < clamped; i++) {
            const move = this.state.sgfMoves[i];
            const result = this.engine.playMove(this.state, move, move.color);
            if (!result)
                continue;
            this.pushHistorySnapshot();
            this.state.board = result.board;
        }
        this.state.history = [];
        this.state.sgfIndex = clamped;
        this.state.turn = this.state.numberMode
            ? Math.max(0, clamped - this.state.numberStartIndex)
            : clamped;
    }
    startNumberMode(color) {
        this.state.numberMode = true;
        this.state.startColor = color;
        this.state.numberStartIndex = this.state.sgfMoves.length;
        this.state.sgfIndex = this.state.sgfMoves.length;
        this.state.turn = 0;
        this.state.history = [];
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
        this.state.sgfMoves = [];
        this.state.sgfIndex = 0;
        this.state.turn = 0;
        this.state.numberMode = false;
        this.state.numberStartIndex = 0;
        this.state.history = [];
        this.applyInitialSetup();
    }
    restoreProblemDiagram() {
        if (!this.state.problemDiagramSet) {
            return;
        }
        this.state.sgfIndex = 0;
        this.rebuildBoardFromMoves(0);
        if (this.state.numberMode) {
            this.state.turn = 0;
            this.state.history = [];
        }
    }
    hasProblemDiagram() {
        return this.state.problemDiagramSet;
    }
    setHandicap(stones) {
        if (this.hasGameData()) {
            this.saveToHistory(`置石変更前（${this.state.handicapStones}子）`);
        }
        if (stones === 'even') {
            this.initBoard(this.state.boardSize);
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
            this.state.startColor = 1;
            return;
        }
        if (stones === 0) {
            this.initBoard(this.state.boardSize);
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = 0;
            this.state.startColor = 1;
            return;
        }
        this.initBoard(this.state.boardSize);
        const count = Number(stones);
        const handicapPositions = this.engine.generateHandicapPositions(this.state.boardSize, count);
        console.log(`置石設定: ${stones}子, 位置:`, handicapPositions);
        console.log(`${this.state.boardSize}路盤 ${stones}子局の置石位置:`, handicapPositions);
        handicapPositions.forEach(pos => {
            if (this.isValidPosition(pos)) {
                this.state.board[pos.row][pos.col] = 1;
            }
        });
        this.state.handicapStones = count;
        this.state.handicapPositions = handicapPositions;
        this.state.komi = 0;
        this.state.startColor = 2;
        this.state.turn = 0;
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
    rebuildBoardFromMoves(limit) {
        const profiling = this.performanceDebug;
        let startTime = 0;
        let appliedMoves = 0;
        if (profiling) {
            startTime = this.getTimestamp();
            const metrics = this.performanceMetrics.rebuildBoardFromMoves;
            metrics.callCount++;
            metrics.lastLimit = limit;
        }
        this.state.history = [];
        this.state.turn = 0;
        this.applyInitialSetup();
        for (let i = 0; i < limit; i++) {
            const move = this.state.sgfMoves[i];
            const result = this.engine.playMove(this.state, move, move.color);
            if (!result)
                continue;
            this.pushHistorySnapshot();
            this.state.board = result.board;
            this.state.turn++;
            appliedMoves++;
        }
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
            metrics.lastAppliedMoves = appliedMoves;
        }
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
}
//# sourceMappingURL=game-store.js.map