import { DEFAULT_CONFIG, } from "../types.js";
import { SGFParser } from "../sgf-parser.js";
/**
 * Centralizes all mutations against {@link GameState}. Rendering and UI layers
 * interact through this class to keep domain logic encapsulated.
 */
export class GameStore {
    constructor(state, engine, history) {
        var _a, _b;
        this.state = state;
        this.engine = engine;
        this.history = history;
        // === Cache-related fields (from PR57) ===
        this.cachedBoardState = null;
        this.cachedAppliedMoveIndex = null;
        this.cachedBoardTimeline = [];
        this.cachedMoveApplied = [];
        this.sgfParser = new SGFParser();
        this.solveBaseBoard = null;
        // === Performance metrics (from main branch) ===
        this.performanceDebug = false;
        this.performanceMetrics = {
            rebuildBoardFromMoves: this.createRebuildMetrics(),
        };
        (_b = (_a = this.boardHistory).initializeBoardHistory) === null || _b === void 0 ? void 0 : _b.call(_a, this.state.board);
    }
    get boardHistory() {
        return this.history;
    }
    get snapshot() {
        return this.state;
    }
    get historyManager() {
        return this.history;
    }
    get appMode() {
        return this.state.appMode;
    }
    setAppMode(mode) {
        if (this.state.appMode === mode) {
            return;
        }
        this.state.appMode = mode;
    }
    enterSolveMode(startColor) {
        var _a, _b;
        if (this.state.appMode === "solve") {
            return;
        }
        this.setAppMode("solve");
        this.state.startColor = startColor;
        this.state.answerMode = startColor === 1 ? "black" : "white";
        this.state.originalMoveList = this.state.sgfMoves.map((move) => ({ ...move }));
        this.state.solutionMoveList = [];
        this.state.sgfMoves = [];
        this.state.sgfIndex = 0;
        this.state.numberStartIndex = 0;
        this.state.solutionSGF = this.state.problemSGF;
        this.state.turn = 0;
        this.state.history = [];
        this.state.numberMode = false;
        const board = this.buildBoardFromProblemSGF();
        this.solveBaseBoard = this.cloneBoard(board);
        this.state.boardSize = board.length;
        this.state.board = this.cloneBoard(board);
        (_b = (_a = this.boardHistory).initializeBoardHistory) === null || _b === void 0 ? void 0 : _b.call(_a, this.state.board);
        this.invalidateCache();
    }
    enterEditMode() {
        if (this.state.appMode === "edit") {
            return;
        }
        this.setAppMode("edit");
        this.state.solutionMoveList = [];
        this.state.solutionSGF = this.state.problemSGF;
        this.state.sgfMoves = this.state.originalMoveList.map((move) => ({ ...move }));
        const board = this.buildBoardFromProblemSGF();
        this.state.boardSize = board.length;
        this.state.board = this.cloneBoard(board);
        this.state.turn = 0;
        this.state.history = [];
        this.state.playMode = "black";
        this.state.answerMode = "black";
        this.resetEditHistory();
        this.invalidateCache();
    }
    initializeEditTimeline() {
        this.resetEditHistory();
    }
    getMoveTimeline() {
        var _a, _b, _c, _d, _e, _f;
        if (this.state.appMode === "solve") {
            return {
                baseMoves: [],
                extraMoves: this.state.solutionMoveList,
                currentIndex: this.state.sgfIndex,
                effectiveLength: this.state.solutionMoveList.length,
            };
        }
        return {
            baseMoves: [],
            extraMoves: [],
            currentIndex: (_c = (_b = (_a = this.boardHistory).getBoardHistoryIndex) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : this.state.sgfIndex,
            effectiveLength: (_f = (_e = (_d = this.boardHistory).getBoardHistoryLength) === null || _e === void 0 ? void 0 : _e.call(_d)) !== null && _f !== void 0 ? _f : this.state.sgfMoves.length,
        };
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
            rebuildBoardFromMoves: {
                ...this.performanceMetrics.rebuildBoardFromMoves,
            },
        };
    }
    tryMove(pos, color, record = true) {
        if (this.state.appMode === "solve") {
            this.prepareSolveModeForNewMove();
            const applied = this.performMove(pos, color, true);
            if (applied) {
                this.state.solutionMoveList.push({ col: pos.col, row: pos.row, color });
                this.rebuildSolutionSGF();
            }
            return applied;
        }
        return this.performMove(pos, color, record);
    }
    removeStone(pos) {
        if (this.state.appMode === "edit") {
            if (this.state.sgfLoadedFromExternal && this.state.sgfIndex > 0) {
                const lastIndex = this.state.sgfIndex - 1;
                const lastMove = this.state.sgfMoves[lastIndex];
                if (lastMove && lastMove.col === pos.col && lastMove.row === pos.row) {
                    this.state.sgfMoves.splice(lastIndex, 1);
                    this.state.originalMoveList = this.state.originalMoveList.slice(0, this.state.sgfMoves.length);
                    this.state.sgfIndex = Math.min(lastIndex, this.state.sgfMoves.length);
                    this.rebuildBoardFromMoves(this.state.sgfIndex);
                    this.invalidateCache();
                    this.resetEditHistory();
                    return true;
                }
            }
            const board = this.cloneBoard();
            if (board[pos.row][pos.col] !== 0) {
                board[pos.row][pos.col] = 0;
                this.state.board = board;
                this.invalidateCache();
                this.handleEditBoardMutation();
                return true;
            }
            return false;
        }
        if (this.state.appMode === "solve") {
            if (this.state.sgfIndex > 0) {
                const lastMove = this.state.sgfMoves[this.state.sgfIndex - 1];
                if (lastMove.col === pos.col && lastMove.row === pos.row) {
                    this.state.sgfMoves.pop();
                    if (this.state.solutionMoveList.length > 0) {
                        this.state.solutionMoveList.pop();
                    }
                    this.state.sgfIndex--;
                    this.rebuildBoardFromMoves(this.state.sgfIndex);
                    this.invalidateCache();
                    this.rebuildSolutionSGF();
                    return true;
                }
            }
            return false;
        }
        return false;
    }
    initBoard(size) {
        if (this.hasGameData()) {
            this.saveToHistory(`${this.state.boardSize}路盤（${this.state.sgfMoves.length}手）`);
        }
        this.state.boardSize = size;
        this.state.board = Array.from({ length: size }, () => Array(size).fill(0));
        this.resetGameState();
        this.state.problemSGF = this.sgfParser.buildProblemSGFFromSetup(size, [], []);
        this.resetEditHistory();
        this.invalidateCache();
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
        const timeline = this.getMoveTimeline();
        const clamped = Math.max(0, Math.min(index, timeline.effectiveLength));
        if (this.state.appMode === "edit") {
            if (!this.restoreEditHistory(clamped)) {
                this.state.sgfIndex = Math.min(clamped, this.state.sgfMoves.length);
                this.rebuildBoardFromMoves(this.state.sgfIndex);
                this.resetEditHistory();
            }
            return;
        }
        if (this.handleSolveModeRewind(clamped)) {
            this.invalidateCache();
        }
        let board = this.resolveBoardThroughCache(clamped);
        if (!board) {
            this.performFullReset(clamped);
            board = (_a = this.cachedBoardTimeline[clamped]) !== null && _a !== void 0 ? _a : this.cachedBoardState;
        }
        if (!board) {
            board = this.cloneBoard();
        }
        this.applyCachedBoard(clamped, board);
    }
    startNumberMode(color) {
        this.startSolveMode(color);
    }
    startSolveMode(color) {
        this.setAppMode("solve");
        this.state.numberMode = true;
        this.state.startColor = color;
        this.state.originalMoveList = this.state.sgfMoves.map((move) => ({
            ...move,
        }));
        this.state.solutionMoveList = [];
        this.state.numberStartIndex = this.state.sgfMoves.length;
        this.state.sgfIndex = this.state.sgfMoves.length;
        this.state.turn = 0;
        this.state.history = [];
        this.invalidateCache();
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
        this.applyInitialSetup();
        this.state.problemSGF = this.buildProblemSGFFromBoard();
        this.resetEditHistory();
        this.invalidateCache();
    }
    restoreProblemDiagram() {
        if (!this.state.problemDiagramSet) {
            return;
        }
        this.state.sgfIndex = 0;
        this.rebuildBoardFromMoves(0);
        this.invalidateCache();
        this.resetEditHistory();
        if (this.state.numberMode) {
            this.state.turn = 0;
            this.state.history = [];
        }
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
    }
    get currentColor() {
        if (this.state.numberMode) {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        if (this.state.playMode === "alt") {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        return this.state.playMode === "black" ? 1 : 2;
    }
    pushHistorySnapshot() {
        this.state.history.push(this.cloneBoard());
    }
    buildBoardFromProblemSGF() {
        const problemText = this.state.problemSGF || "";
        const sizeMatch = problemText.match(/SZ\[(\d+)\]/i);
        const boardSize = sizeMatch ? parseInt(sizeMatch[1], 10) : this.state.boardSize;
        const size = Number.isFinite(boardSize) ? boardSize : this.state.boardSize;
        const board = Array.from({ length: size }, () => Array(size).fill(0));
        const applySetup = (property, color) => {
            const pattern = new RegExp(`${property}(?:\\[[a-z]{2}\\])+`, "gi");
            const matches = problemText.match(pattern);
            if (!matches) {
                return;
            }
            matches.forEach((match) => {
                const coords = match.match(/\[([a-z]{2})\]/gi);
                coords === null || coords === void 0 ? void 0 : coords.forEach((coord) => {
                    const clean = coord.slice(1, -1).toLowerCase();
                    if (clean.length !== 2) {
                        return;
                    }
                    const col = clean.charCodeAt(0) - 97;
                    const row = clean.charCodeAt(1) - 97;
                    if (col >= 0 && col < size && row >= 0 && row < size) {
                        board[row][col] = color;
                    }
                });
            });
        };
        applySetup("AB", 1);
        applySetup("AW", 2);
        return board;
    }
    rebuildSolutionSGF() {
        let base = this.state.problemSGF;
        if (!base || !base.trim()) {
            base = this.buildProblemSGFFromBoard();
        }
        this.state.solutionSGF = this.state.solutionMoveList.reduce((sgf, move) => this.sgfParser.appendSolutionMove(sgf, move, this.state.boardSize), base);
    }
    resetEditHistory() {
        var _a, _b, _c, _d;
        (_b = (_a = this.boardHistory).initializeBoardHistory) === null || _b === void 0 ? void 0 : _b.call(_a, this.state.board);
        const historyIndex = (_d = (_c = this.boardHistory).getBoardHistoryIndex) === null || _d === void 0 ? void 0 : _d.call(_c);
        if (historyIndex !== undefined) {
            this.state.sgfIndex = historyIndex;
        }
        this.state.originalMoveList = this.state.sgfMoves.map((move) => ({ ...move }));
        if (!this.state.problemSGF) {
            this.state.problemSGF = this.buildProblemSGFFromBoard();
        }
    }
    handleEditBoardMutation() {
        var _a, _b, _c, _d, _e;
        if (this.state.appMode !== "edit") {
            return;
        }
        const { black, white } = this.collectBoardPositions();
        this.state.problemDiagramBlack = black.map((pos) => ({ ...pos }));
        this.state.problemDiagramWhite = white.map((pos) => ({ ...pos }));
        this.state.problemDiagramSet = true;
        this.state.handicapPositions = [];
        this.state.handicapStones = 0;
        (_b = (_a = this.boardHistory).pushBoardHistory) === null || _b === void 0 ? void 0 : _b.call(_a, this.state.board);
        this.state.sgfIndex = (_e = (_d = (_c = this.boardHistory).getBoardHistoryIndex) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : this.state.sgfIndex;
        this.state.problemSGF = this.buildProblemSGFFromBoard();
        this.state.originalMoveList = this.state.sgfMoves.map((move) => ({ ...move }));
    }
    collectBoardPositions() {
        const black = [];
        const white = [];
        for (let row = 0; row < this.state.board.length; row++) {
            for (let col = 0; col < this.state.board[row].length; col++) {
                if (this.state.board[row][col] === 1) {
                    black.push({ col, row });
                }
                else if (this.state.board[row][col] === 2) {
                    white.push({ col, row });
                }
            }
        }
        return { black, white };
    }
    buildProblemSGFFromBoard() {
        const { black, white } = this.collectBoardPositions();
        return this.sgfParser.buildProblemSGFFromSetup(this.state.boardSize, black, white);
    }
    restoreEditHistory(index) {
        var _a, _b;
        const board = (_b = (_a = this.boardHistory).restoreBoardHistory) === null || _b === void 0 ? void 0 : _b.call(_a, index);
        if (!board) {
            return false;
        }
        this.state.board = board;
        this.state.turn = index;
        this.state.sgfIndex = index;
        this.invalidateCache();
        return true;
    }
    performMove(pos, color, recordMove) {
        const result = this.engine.playMove(this.state, pos, color);
        if (!result) {
            return false;
        }
        this.pushHistorySnapshot();
        this.state.board = result.board;
        this.state.turn++;
        if (recordMove) {
            this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
            this.state.sgfMoves.push({ col: pos.col, row: pos.row, color });
            this.state.sgfIndex = this.state.sgfMoves.length;
        }
        this.invalidateCache();
        this.handleEditBoardMutation();
        return true;
    }
    prepareSolveModeForNewMove() {
        if (this.state.appMode !== "solve") {
            return;
        }
        const desiredSolutions = Math.max(0, this.state.sgfIndex);
        if (desiredSolutions < this.state.solutionMoveList.length) {
            this.state.solutionMoveList = this.state.solutionMoveList.slice(0, desiredSolutions);
            this.state.sgfMoves = this.state.sgfMoves.slice(0, desiredSolutions);
            this.rebuildSolutionSGF();
        }
    }
    handleSolveModeRewind(target) {
        if (this.state.appMode !== "solve") {
            return false;
        }
        const desiredSolutions = Math.max(0, target);
        if (desiredSolutions === this.state.solutionMoveList.length) {
            return false;
        }
        this.state.solutionMoveList = this.state.solutionMoveList.slice(0, Math.max(0, desiredSolutions));
        this.state.sgfMoves = this.state.sgfMoves.slice(0, desiredSolutions);
        this.state.sgfIndex = desiredSolutions;
        this.rebuildSolutionSGF();
        return true;
    }
    cloneBoard(board = this.state.board) {
        return board.map((row) => row.slice());
    }
    applyInitialSetup() {
        const size = this.state.boardSize;
        const board = Array.from({ length: size }, () => Array(size).fill(0));
        if (this.state.handicapPositions.length > 0) {
            this.state.handicapPositions.forEach((pos) => {
                if (this.isValidPosition(pos)) {
                    board[pos.row][pos.col] = 1;
                }
            });
        }
        if (this.state.problemDiagramSet) {
            this.state.problemDiagramBlack.forEach((pos) => {
                if (this.isValidPosition(pos)) {
                    board[pos.row][pos.col] = 1;
                }
            });
            this.state.problemDiagramWhite.forEach((pos) => {
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
            if (move.col === pos.col &&
                move.row === pos.row &&
                move.color === color) {
                return i;
            }
        }
        return -1;
    }
    hasGameData() {
        return (this.state.sgfMoves.length > 0 ||
            this.state.handicapStones > 0 ||
            this.state.board.some((row) => row.some((cell) => cell !== 0)));
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
        this.setAppMode("edit");
        this.state.originalMoveList = [];
        this.state.solutionMoveList = [];
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
        return (this.boardsEqual(this.cachedBoardTimeline[this.cachedAppliedMoveIndex], this.cachedBoardState) && this.boardsEqual(this.state.board, this.cachedBoardState));
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
            newlyApplied: applied,
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
            lastAppliedMoves: 0,
        };
    }
    getTimestamp() {
        if (typeof performance !== "undefined" &&
            typeof performance.now === "function") {
            return performance.now();
        }
        return Date.now();
    }
    isValidPosition(pos) {
        return (pos.col >= 0 &&
            pos.col < this.state.boardSize &&
            pos.row >= 0 &&
            pos.row < this.state.boardSize);
    }
    createHandicapContext(stones) {
        if (stones === "even") {
            return { mode: "even", stones: 0, positions: [] };
        }
        const numeric = Number(stones);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new Error(`無効な置石数: ${stones}`);
        }
        if (numeric === 0) {
            return { mode: "no-komi", stones: 0, positions: [] };
        }
        const positions = this.engine.generateHandicapPositions(this.state.boardSize, numeric);
        console.log(`置石設定: ${stones}子, 位置:`, positions);
        console.log(`${this.state.boardSize}路盤 ${stones}子局の置石位置:`, positions);
        return { mode: "fixed", stones: numeric, positions };
    }
    resetBoardForHandicap(_context) {
        this.initBoard(this.state.boardSize);
    }
    placeHandicapStones(context) {
        if (context.mode !== "fixed") {
            return;
        }
        context.positions.forEach((pos) => {
            if (this.isValidPosition(pos)) {
                this.state.board[pos.row][pos.col] = 1;
            }
        });
    }
    updateHandicapMetadata(context) {
        if (context.mode === "even") {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
            this.state.startColor = 1;
            return;
        }
        if (context.mode === "no-komi") {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = 0;
            this.state.startColor = 1;
            return;
        }
        this.state.handicapStones = context.stones;
        this.state.handicapPositions = context.positions.map((pos) => ({ ...pos }));
        this.state.komi = 0;
        this.state.startColor = 2;
        this.state.turn = 0;
    }
}
//# sourceMappingURL=game-store.js.map