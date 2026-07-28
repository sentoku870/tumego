import { toCircledNumber } from '../utils/format.js';
/**
 * 木の主ラインを Move[] として抽出する。
 * 着手を持たないセットアップノード（先頭）はスキップする。
 * children[0] を主分岐として辿る。
 */
export function extractMainLineMoves(root) {
    var _a, _b, _c;
    const moves = [];
    let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
    // セットアップノードをスキップ（move を持たない限り子を辿る）
    while (node && !node.move) {
        node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
    }
    while (node) {
        if (node.move) {
            moves.push(node.move);
        }
        node = (_c = node.children[0]) !== null && _c !== void 0 ? _c : null;
    }
    return moves;
}
/**
 * 木の主ライン上の各ノードのマーカーを、深さ基準の配列として抽出する。
 * まずルート自体のマーカーを rootMarkers に入れ、
 * その上で先頭のセットアップノード（move なし）のマーカーも rootMarkers に追加する。
 * index 0 は主ラインの最初の着手ノードのマーカー。
 */
export function extractMainLineMarkers(root) {
    var _a, _b, _c;
    const rootMarkers = [];
    const nodeMarkers = [];
    // ルート自体のマーカー
    rootMarkers.push(...extractNodeMarkers(root));
    let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
    // 先頭のセットアップノード（move なし）のマーカーも rootMarkers へ
    if (node && !node.move) {
        rootMarkers.push(...extractNodeMarkers(node));
        node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
    }
    while (node) {
        nodeMarkers.push(extractNodeMarkers(node));
        node = (_c = node.children[0]) !== null && _c !== void 0 ? _c : null;
    }
    return { rootMarkers, nodeMarkers };
}
function extractNodeMarkers(node) {
    const ext = node;
    if (!ext.__markers)
        return [];
    return ext.__markers.map((m) => ({
        pos: { ...m.pos },
        kind: m.kind,
        ...(m.label !== undefined ? { label: m.label } : {}),
    }));
}
/**
 * 旧 API 互換: 線形の着手配列から単純な SGFNode 木を構築する。
 * 分岐を持たない、ルート → 主ラインのチェーンを生成する。
 */
function buildLinearTreeFromMoves(moves) {
    const root = {
        id: "root",
        parent: null,
        children: [],
        isMainLine: true,
    };
    let parent = root;
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        if (!move)
            continue;
        const node = {
            id: `n${i + 1}`,
            parent,
            children: [],
            isMainLine: true,
            move: { ...move },
        };
        parent.children.push(node);
        parent = node;
    }
    return root;
}
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
     * 状態書込はすべて ModeOperations / GameStore 経由。
     * 旧 API 互換: rootNode がない場合は result.moves から線形木を合成する。
     */
    apply(result) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const validated = this.validateParseResult(result);
        const { rawSGF, gameInfo } = validated;
        // rootNode がない場合は moves から線形木を合成（旧 API 互換）
        const rootNode = (_a = validated.rootNode) !== null && _a !== void 0 ? _a : buildLinearTreeFromMoves((_b = validated.moves) !== null && _b !== void 0 ? _b : []);
        // 主ラインを投影（sgfMoves と各ノードのマーカー）
        const moves = extractMainLineMoves(rootNode);
        const { rootMarkers, nodeMarkers } = extractMainLineMarkers(rootNode);
        // 1) 盤サイズ変更と盤面再生成
        this.store.prepareBoardForSgf(gameInfo.boardSize);
        // 2) 履歴保存 + フラグ類リセット
        this.store.resetForSgfLoad(this.state.sgfMoves.length);
        // 3) 着手木のセット（解析したルートで上書き）
        this.store.setSgfTree(rootNode);
        // 4) メタ情報適用（startColor, handicap, problemDiagram）
        this.store.applySgfMeta(gameInfo);
        // 5) 対局者・コミ・結果・タイトル等
        this.store.updateGameInfo({
            title: (_d = (_c = gameInfo.title) !== null && _c !== void 0 ? _c : this.state.gameInfo.title) !== null && _d !== void 0 ? _d : '',
            playerBlack: (_e = gameInfo.playerBlack) !== null && _e !== void 0 ? _e : null,
            playerWhite: (_f = gameInfo.playerWhite) !== null && _f !== void 0 ? _f : null,
            komi: (_g = gameInfo.komi) !== null && _g !== void 0 ? _g : this.state.komi,
            result: (_h = gameInfo.result) !== null && _h !== void 0 ? _h : null,
        });
        this.store.updateGameInfoFromSgf(gameInfo);
        // 6) 着手履歴セット + 0 手目に進める（手順があれば 1 手目）
        this.store.setSgfMoves(moves);
        // 7) マーカー（ルート + 各着手ノード）
        this.store.setNodeMarkers(rootMarkers, nodeMarkers);
        const firstIndex = moves.length > 0 ? 1 : 0;
        this.store.setMoveIndex(firstIndex);
        return {
            sgfText: rawSGF !== null && rawSGF !== void 0 ? rawSGF : this.parser.export(this.state)
        };
    }
    validateParseResult(result) {
        if (!result || !result.gameInfo) {
            throw new Error('不正なSGF解析結果です');
        }
        if (!result.rootNode && !result.moves) {
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