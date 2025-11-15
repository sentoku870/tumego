import { DEFAULT_CONFIG } from '../types.js';
import { getCircleNumber } from '../renderer.js';
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
        const { moves, gameInfo, rawSGF } = result;
        if (!moves || !Array.isArray(moves) || !gameInfo) {
            throw new Error('不正なSGF解析結果です');
        }
        const state = this.state;
        if (state.sgfMoves.length > 0 || state.handicapStones > 0 ||
            state.board.some(row => row.some(cell => cell !== 0))) {
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
        if (gameInfo.komi !== undefined)
            state.komi = gameInfo.komi;
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
        state.sgfMoves = moves.map(move => ({ ...move }));
        state.sgfIndex = 0;
        this.store.setMoveIndex(0);
        return {
            sgfText: rawSGF !== null && rawSGF !== void 0 ? rawSGF : this.parser.export(state)
        };
    }
    buildAnswerSequence() {
        const state = this.state;
        if (!state.numberMode || state.sgfMoves.length === 0) {
            return null;
        }
        const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
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
            const mark = move.color === 1 ? '■' : '□';
            const num = getCircleNumber(i - startIndex + 1);
            if (col) {
                sequence.push(`${mark}${num} ${col}${row}`);
            }
        }
        return sequence.length ? sequence.join(' ') : null;
    }
}
//# sourceMappingURL=sgf-service.js.map