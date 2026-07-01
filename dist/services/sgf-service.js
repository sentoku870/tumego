import { toCircledNumber } from '../utils/format.js';
export class SGFService {
    constructor(parser, store, io, share) {
        this.parser = parser;
        this.store = store;
        this.io = io;
        this.share = share;
    }
    get state() {
        return this.store.snapshot;
    }
    parse(text) {
        return this.parser.parse(text);
    }
    async loadFromFile(file) {
        return this.io.loadFromFile(file);
    }
    async loadFromClipboard() {
        return this.io.loadFromClipboard();
    }
    export() {
        return this.parser.export(this.state);
    }
    async copyToClipboard(text) {
        await this.io.copyToClipboard(text);
    }
    async saveToFile(text) {
        await this.io.saveToFile(text);
    }
    loadFromURL() {
        return this.share.loadFromURL();
    }
    /**
     * SGF 解析結果を state に適用する。
     * 状態書込はすべて ModeOperations 経由。
     */
    apply(result) {
        var _a, _b, _c, _d, _e, _f;
        const validated = this.validateParseResult(result);
        const { moves, gameInfo, rawSGF } = validated;
        // 1) 盤サイズ変更と盤面再生成
        this.store.prepareBoardForSgf(gameInfo.boardSize);
        // 2) 履歴保存 + フラグ類リセット
        this.store.resetForSgfLoad(this.state.sgfMoves.length);
        // 3) メタ情報適用（startColor, handicap, problemDiagram）
        this.store.applySgfMeta(gameInfo);
        // 4) 対局者・コミ・結果・タイトル等
        this.store.updateGameInfo({
            title: (_b = (_a = gameInfo.title) !== null && _a !== void 0 ? _a : this.state.gameInfo.title) !== null && _b !== void 0 ? _b : '',
            playerBlack: (_c = gameInfo.playerBlack) !== null && _c !== void 0 ? _c : null,
            playerWhite: (_d = gameInfo.playerWhite) !== null && _d !== void 0 ? _d : null,
            komi: (_e = gameInfo.komi) !== null && _e !== void 0 ? _e : this.state.komi,
            result: (_f = gameInfo.result) !== null && _f !== void 0 ? _f : null,
        });
        this.store.updateGameInfoFromSgf(gameInfo);
        // 5) 着手履歴セット + 0 手目に進める（手順があれば 1 手目）
        this.store.setSgfMoves(moves);
        const firstIndex = this.state.sgfMoves.length > 0 ? 1 : 0;
        this.store.setMoveIndex(firstIndex);
        return {
            sgfText: rawSGF !== null && rawSGF !== void 0 ? rawSGF : this.parser.export(this.state)
        };
    }
    validateParseResult(result) {
        const { moves, gameInfo } = result;
        if (!moves || !Array.isArray(moves) || !gameInfo) {
            throw new Error('不正なSGF解析結果です');
        }
        return result;
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
            const num = toCircledNumber(i - startIndex + 1);
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
}
//# sourceMappingURL=sgf-service.js.map