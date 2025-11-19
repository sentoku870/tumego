import { DEFAULT_CONFIG, } from "../types.js";
import { getCircleNumber } from "../renderer.js";
export class SGFService {
    constructor(parser, store) {
        this.parser = parser;
        this.store = store;
    }
    get state() {
        return this.store.snapshot;
    }
    parse(text) {
        return this.parser.parse(text);
    }
    async loadFromFile(file) {
        return this.parser.loadFromFile(file);
    }
    async loadFromClipboard() {
        return this.parser.loadFromClipboard();
    }
    export() {
        return this.parser.export(this.state);
    }
    async copyToClipboard(text) {
        await this.parser.copyToClipboard(text);
    }
    async saveToFile(text) {
        await this.parser.saveToFile(text);
    }
    loadFromURL() {
        return this.parser.loadFromURL();
    }
    apply(result) {
        var _a, _b;
        const validated = this.validateParseResult(result);
        const initialized = this.runInitializationPhase({
            state: this.state,
            result: validated,
        });
        const applied = this.runApplicationPhase(initialized);
        this.runHistoryAdjustmentPhase(applied);
        return {
            sgfText: (_b = (_a = validated.originalSGF) !== null && _a !== void 0 ? _a : validated.rawSGF) !== null && _b !== void 0 ? _b : this.parser.export(this.state),
        };
    }
    validateParseResult(result) {
        const { moves, gameInfo } = result;
        if (!moves || !Array.isArray(moves) || !gameInfo) {
            throw new Error("不正なSGF解析結果です");
        }
        return result;
    }
    runInitializationPhase(input) {
        var _a;
        const { state, result } = input;
        const { moves, gameInfo, rawSGF, originalSGF, problemSGF } = result;
        if (state.sgfMoves.length > 0 ||
            state.handicapStones > 0 ||
            state.board.some((row) => row.some((cell) => cell !== 0))) {
            this.store.historyManager.save(`SGF読み込み前（${state.sgfMoves.length}手）`, state);
        }
        if (gameInfo.boardSize && gameInfo.boardSize !== state.boardSize) {
            const newSize = gameInfo.boardSize;
            state.boardSize = newSize;
            state.board = Array.from({ length: newSize }, () => Array.from({ length: newSize }, () => 0));
        }
        else {
            const currentSize = state.boardSize;
            state.board = Array.from({ length: currentSize }, () => Array.from({ length: currentSize }, () => 0));
        }
        state.history = [];
        state.turn = 0;
        state.sgfMoves = [];
        state.originalMoveList = [];
        state.solutionMoveList = [];
        state.sgfIndex = 0;
        state.numberMode = false;
        state.numberStartIndex = 0;
        state.handicapStones = 0;
        state.gameTree = null;
        state.sgfLoadedFromExternal = true;
        this.store.setAppMode("review");
        state.handicapPositions = [];
        state.problemDiagramSet = false;
        state.problemDiagramBlack = [];
        state.problemDiagramWhite = [];
        state.startColor = 1;
        state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
        state.eraseMode = false;
        state.originalSGF = (_a = originalSGF !== null && originalSGF !== void 0 ? originalSGF : rawSGF) !== null && _a !== void 0 ? _a : "";
        state.problemSGF =
            problemSGF !== null && problemSGF !== void 0 ? problemSGF : this.parser.buildProblemSGFFromSetup(state.boardSize, [], []);
        state.solutionSGF = state.problemSGF;
        return {
            state,
            moves,
            gameInfo,
            rawSGF,
            originalSGF,
            problemSGF,
        };
    }
    runApplicationPhase(input) {
        var _a, _b, _c, _d;
        const { state, moves, gameInfo, problemSGF } = input;
        if (gameInfo.komi !== undefined)
            state.komi = gameInfo.komi;
        if (gameInfo.startColor !== undefined)
            state.startColor = gameInfo.startColor;
        if (gameInfo.handicapStones !== undefined)
            state.handicapStones = gameInfo.handicapStones;
        if (gameInfo.handicapPositions) {
            state.handicapPositions = gameInfo.handicapPositions.map((pos) => ({
                ...pos,
            }));
        }
        if (gameInfo.problemDiagramBlack) {
            state.problemDiagramBlack = gameInfo.problemDiagramBlack.map((pos) => ({
                ...pos,
            }));
        }
        if (gameInfo.problemDiagramWhite) {
            state.problemDiagramWhite = gameInfo.problemDiagramWhite.map((pos) => ({
                ...pos,
            }));
        }
        if (gameInfo.problemDiagramSet !== undefined) {
            state.problemDiagramSet = gameInfo.problemDiagramSet;
        }
        else if (state.problemDiagramBlack.length > 0 ||
            state.problemDiagramWhite.length > 0) {
            state.problemDiagramSet = true;
        }
        // SGF メタ情報を state に取り込む（優先順: sgfMeta -> gameInfo フィールド）
        const sgfMeta = gameInfo === null || gameInfo === void 0 ? void 0 : gameInfo.sgfMeta;
        if (sgfMeta) {
            state.sgfMeta = { ...sgfMeta };
            // プレイヤー名 / 結果 / 日時 を同期
            if (sgfMeta.PB)
                state.blackName = sgfMeta.PB;
            if (sgfMeta.PW)
                state.whiteName = sgfMeta.PW;
            if (sgfMeta.RE)
                state.result = sgfMeta.RE;
            if (sgfMeta.DT)
                state.date = sgfMeta.DT;
            if (sgfMeta.KM && state.komi === undefined) {
                const parsed = parseFloat(sgfMeta.KM);
                if (!Number.isNaN(parsed))
                    state.komi = parsed;
            }
        }
        else {
            if (gameInfo.blackName)
                state.blackName = gameInfo.blackName;
            if (gameInfo.whiteName)
                state.whiteName = gameInfo.whiteName;
            if (gameInfo.result)
                state.result = gameInfo.result;
            if (gameInfo.date)
                state.date = gameInfo.date;
        }
        state.sgfMoves = moves.map((move) => ({ ...move }));
        state.originalMoveList = moves.map((move) => ({ ...move }));
        state.solutionMoveList = [];
        state.sgfIndex = 0;
        state.problemSGF =
            problemSGF !== null && problemSGF !== void 0 ? problemSGF : this.buildProblemSGFFromState(state);
        state.solutionSGF = state.problemSGF;
        // === 正規化: state の個別フィールドを一次情報として sgfMeta を再構築 ===
        const incomingMeta = gameInfo === null || gameInfo === void 0 ? void 0 : gameInfo.sgfMeta;
        state.sgfMeta = {
            PB: (_a = state.blackName) !== null && _a !== void 0 ? _a : incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.PB,
            PW: (_b = state.whiteName) !== null && _b !== void 0 ? _b : incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.PW,
            BR: incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.BR,
            WR: incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.WR,
            KM: state.komi !== undefined ? String(state.komi) : incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.KM,
            RE: (_c = state.result) !== null && _c !== void 0 ? _c : incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.RE,
            DT: (_d = state.date) !== null && _d !== void 0 ? _d : incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.DT,
            GN: incomingMeta === null || incomingMeta === void 0 ? void 0 : incomingMeta.GN,
        };
        return {
            state,
            appliedMoves: state.sgfMoves,
        };
    }
    runHistoryAdjustmentPhase(input) {
        this.store.setMoveIndex(0);
        return { state: input.state };
    }
    buildAnswerSequence() {
        const state = this.state;
        if (!state.numberMode || state.sgfMoves.length === 0) {
            return null;
        }
        const letters = "ABCDEFGHJKLMNOPQRSTUV".slice(0, state.boardSize).split("");
        const startIndex = state.numberStartIndex || 0;
        const endIndex = state.sgfIndex;
        if (endIndex <= startIndex) {
            return null;
        }
        const sequence = [];
        for (let i = startIndex; i < endIndex; i++) {
            const move = state.sgfMoves[i];
            if (!move)
                continue;
            const col = letters[move.col];
            const row = state.boardSize - move.row;
            const mark = move.color === 1 ? "■" : "□";
            const num = getCircleNumber(i - startIndex + 1);
            if (col) {
                sequence.push(`${mark}${num} ${col}${row}`);
            }
        }
        return sequence.length ? sequence.join(" ") : null;
    }
    appendSolutionMove(move) {
        const cloned = { ...move };
        this.state.solutionMoveList.push(cloned);
        this.state.solutionSGF = this.parser.appendSolutionMove(this.state.solutionSGF, cloned, this.state.boardSize);
        return this.state.solutionSGF;
    }
    buildProblemSGFFromState(state) {
        const blackSetup = state.problemDiagramSet
            ? state.problemDiagramBlack
            : state.handicapPositions;
        const whiteSetup = state.problemDiagramSet
            ? state.problemDiagramWhite
            : [];
        return this.parser.buildProblemSGFFromSetup(state.boardSize, blackSetup, whiteSetup);
    }
}
//# sourceMappingURL=sgf-service.js.map