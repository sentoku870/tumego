import { DEFAULT_CONFIG } from '../types.js';
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
        var _a;
        const validated = this.validateParseResult(result);
        const initialized = this.runInitializationPhase({
            state: this.state,
            result: validated
        });
        const applied = this.runApplicationPhase(initialized);
        this.runHistoryAdjustmentPhase(applied);
        return {
            sgfText: (_a = validated.rawSGF) !== null && _a !== void 0 ? _a : this.parser.export(this.state)
        };
    }
    validateParseResult(result) {
        const { moves, gameInfo } = result;
        if (!moves || !Array.isArray(moves) || !gameInfo) {
            throw new Error('不正なSGF解析結果です');
        }
        return result;
    }
    runInitializationPhase(input) {
        const { state, result } = input;
        const { moves, gameInfo, rawSGF } = result;
        this.store.historyManager.save(`SGF読み込み前（${state.sgfMoves.length}手）`, state);
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
        state.sgfIndex = 0;
        state.numberMode = false;
        state.numberStartIndex = 0;
        state.handicapStones = 0;
        state.gameTree = null;
        state.sgfLoadedFromExternal = true;
        state.handicapPositions = [];
        state.problemDiagramSet = false;
        state.problemDiagramBlack = [];
        state.problemDiagramWhite = [];
        state.startColor = 1;
        state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
        state.eraseMode = false;
        state.gameInfo = {
            title: '',
            komi: state.komi,
            handicap: null,
            playerBlack: null,
            playerWhite: null,
            result: null,
            boardSize: state.boardSize,
            handicapStones: state.handicapStones,
            handicapPositions: state.handicapPositions,
            startColor: state.startColor,
            problemDiagramSet: state.problemDiagramSet,
            problemDiagramBlack: state.problemDiagramBlack,
            problemDiagramWhite: state.problemDiagramWhite,
        };
        return {
            state,
            moves,
            gameInfo,
            rawSGF
        };
    }
    runApplicationPhase(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const { state, moves, gameInfo } = input;
        if (gameInfo.startColor !== undefined)
            state.startColor = gameInfo.startColor;
        if (gameInfo.handicapStones !== undefined)
            state.handicapStones = gameInfo.handicapStones;
        if (gameInfo.handicapPositions) {
            state.handicapPositions = gameInfo.handicapPositions.map(pos => ({ ...pos }));
        }
        if (gameInfo.problemDiagramBlack) {
            state.problemDiagramBlack = gameInfo.problemDiagramBlack.map(pos => ({ ...pos }));
        }
        if (gameInfo.problemDiagramWhite) {
            state.problemDiagramWhite = gameInfo.problemDiagramWhite.map(pos => ({ ...pos }));
        }
        if (gameInfo.problemDiagramSet !== undefined) {
            state.problemDiagramSet = gameInfo.problemDiagramSet;
        }
        else if (state.problemDiagramBlack.length > 0 || state.problemDiagramWhite.length > 0) {
            state.problemDiagramSet = true;
        }
        this.store.updateGameInfo({
            title: (_b = (_a = gameInfo.title) !== null && _a !== void 0 ? _a : state.gameInfo.title) !== null && _b !== void 0 ? _b : '',
            playerBlack: (_c = gameInfo.playerBlack) !== null && _c !== void 0 ? _c : null,
            playerWhite: (_d = gameInfo.playerWhite) !== null && _d !== void 0 ? _d : null,
            komi: (_e = gameInfo.komi) !== null && _e !== void 0 ? _e : state.komi,
            result: (_f = gameInfo.result) !== null && _f !== void 0 ? _f : null,
        });
        state.gameInfo = {
            ...state.gameInfo,
            handicap: (_h = (_g = gameInfo.handicap) !== null && _g !== void 0 ? _g : state.gameInfo.handicap) !== null && _h !== void 0 ? _h : null,
            boardSize: (_j = gameInfo.boardSize) !== null && _j !== void 0 ? _j : state.boardSize,
            handicapStones: (_k = gameInfo.handicapStones) !== null && _k !== void 0 ? _k : state.handicapStones,
            handicapPositions: (_l = gameInfo.handicapPositions) !== null && _l !== void 0 ? _l : state.handicapPositions,
            startColor: state.startColor,
            problemDiagramSet: state.problemDiagramSet,
            problemDiagramBlack: state.problemDiagramBlack,
            problemDiagramWhite: state.problemDiagramWhite
        };
        state.sgfMoves = moves.map(move => ({ ...move }));
        state.sgfIndex = 0;
        return {
            state,
            appliedMoves: state.sgfMoves
        };
    }
    runHistoryAdjustmentPhase(input) {
        const firstIndex = this.store.snapshot.sgfMoves.length > 0 ? 1 : 0;
        this.store.setMoveIndex(firstIndex);
        return { state: input.state };
    }
    buildAnswerSequence(state = this.state) {
        if (!state.numberMode) {
            return '';
        }
        const startIndex = state.numberStartIndex || 0;
        const endIndex = Math.min(state.sgfIndex, state.sgfMoves.length);
        if (endIndex <= startIndex) {
            return '';
        }
        const sequence = [];
        for (let i = startIndex; i < endIndex; i++) {
            const move = state.sgfMoves[i];
            const coordinate = this.formatCoordinate(state, move);
            if (!coordinate)
                continue;
            const mark = move.color === 1 ? '■' : '□';
            const num = this.getAnswerNumber(i - startIndex + 1);
            sequence.push(`${mark}${num} ${coordinate}`);
        }
        return sequence.join(' ');
    }
    formatCoordinate(state, position) {
        const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
        const col = letters[position.col];
        if (!col)
            return null;
        const row = state.boardSize - position.row;
        return `${col}${row}`;
    }
    getAnswerNumber(order) {
        var _a;
        const circledNumbers = [
            '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
            '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'
        ];
        return (_a = circledNumbers[order - 1]) !== null && _a !== void 0 ? _a : order.toString();
    }
}
//# sourceMappingURL=sgf-service.js.map