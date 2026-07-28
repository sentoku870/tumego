// ============ SGF処理エンジン ============
// SGF FF4 形式のテキストを SGFNode の木構造に解析する。
// 構文:
//   Collection    = GameTree { GameTree }
//   GameTree     = "(" Sequence { GameTree } ")"
//   Sequence     = Node { Node }
//   Node         = ";" { Property }
//   Property     = PropIdent PropValue { PropValue }
//   PropIdent    = UCLetter { UCLetter }
//   PropValue    = "[" CValueType "]"
//
// 本パーサのアルゴリズム:
// - トークン化してプロパティと構造記号を分離
// - currentParent + parentStack スタックで木を構築
// - `(` で currentParent を push、`)` で pop
// - `;` で currentParent の子として新ノードを生成
// - プロパティは currentNode に紐付ける（初期は root）
import { DEFAULT_CONFIG, } from "./types.js";
const MARKER_PROPERTIES = ["CR", "TR", "SQ", "MA", "LB"];
export class SGFParser {
    constructor() {
        // ============ エントリ ============
        // エクスポータ用一時キャッシュ（exportTree 呼び出し中に GameStore が設定）
        this._rootMarkerExportCache = null;
        this._nodeMarkerExportCache = null;
    }
    parse(sgfText) {
        var _a, _b;
        const rawText = sgfText.trim();
        const inner = this.extractInner(rawText);
        const gameInfo = {
            title: "",
            komi: DEFAULT_CONFIG.DEFAULT_KOMI,
            handicap: null,
            handicapStones: 0,
            handicapPositions: [],
            startColor: 1,
            problemDiagramSet: false,
            problemDiagramBlack: [],
            problemDiagramWhite: [],
            playerBlack: null,
            playerWhite: null,
            result: null,
        };
        const root = {
            id: "root",
            parent: null,
            children: [],
            isMainLine: true,
        };
        const tokens = this.tokenize(inner);
        // SGF 標準の解釈:
        // - Variations は main sequence 内の最後のノードの「位置」で分岐する
        // - Variation 内の `;` は variation 開始時点の lastMainSequenceNode.parent の子になる
        //   (すなわち、lastMainSequenceNode の兄弟)
        // - `;` 後の parentForNewNode は新しいノード自身になる（chain）
        const lastMainStack = []; // variation 開始時の lastMainSequenceNode を保存
        let lastMainSequenceNode = root; // 現在の main sequence の最後のノード
        let parentForNewNode = root; // 次の `;` の親
        let inVariation = false; // 現在 variation 内か
        let currentNode = root;
        let nodeCounter = 0;
        const newNodeId = () => {
            nodeCounter += 1;
            return `n${nodeCounter}`;
        };
        for (const token of tokens) {
            if (token.kind === "open") {
                // Variation 開始: 現在の main sequence の状態を保存し、
                // parentForNewNode を lastMainSequenceNode.parent に設定する
                lastMainStack.push(lastMainSequenceNode);
                parentForNewNode = (_a = lastMainSequenceNode.parent) !== null && _a !== void 0 ? _a : root;
                inVariation = true;
            }
            else if (token.kind === "close") {
                // Variation 終了: 保存した状態を復元
                const popped = lastMainStack.pop();
                lastMainSequenceNode = popped !== null && popped !== void 0 ? popped : root;
                // parentForNewNode は通常 lastMainSequenceNode（次の `;` で chain するため）
                parentForNewNode = lastMainSequenceNode;
                inVariation = lastMainStack.length > 0;
                currentNode = lastMainSequenceNode;
            }
            else if (token.kind === "semicolon") {
                const node = {
                    id: newNodeId(),
                    parent: parentForNewNode,
                    children: [],
                    isMainLine: !inVariation && parentForNewNode.children.length === 0,
                };
                parentForNewNode.children.push(node);
                parentForNewNode = node;
                lastMainSequenceNode = node;
                currentNode = node;
            }
            else if (token.kind === "property") {
                this.applyProperty(currentNode, token.ident, token.values, gameInfo, root);
            }
        }
        // ルート直下の最初の着手ノードがあれば、先手色を推定
        const firstMoveNode = root.children[0];
        if (firstMoveNode === null || firstMoveNode === void 0 ? void 0 : firstMoveNode.move) {
            if (!gameInfo.startColor || ((_b = gameInfo.handicapStones) !== null && _b !== void 0 ? _b : 0) === 0) {
                if (gameInfo.handicapStones && gameInfo.handicapStones > 0) {
                    // 置石ありは startColor を変えない
                }
                else {
                    gameInfo.startColor = firstMoveNode.move.color;
                }
            }
        }
        return {
            rootNode: root,
            rawSGF: rawText,
            gameInfo,
            // 後方互換: 主ラインの派生情報
            moves: this.extractMainLineMoves(root),
            rootMarkers: this.extractRootMarkers(root),
            nodeMarkers: this.extractMainLineNodeMarkers(root),
        };
    }
    // 後方互換用: 主ラインの着手配列
    extractMainLineMoves(root) {
        var _a, _b, _c;
        const moves = [];
        let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
        while (node && !node.move) {
            node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
        }
        while (node) {
            if (node.move)
                moves.push(node.move);
            node = (_c = node.children[0]) !== null && _c !== void 0 ? _c : null;
        }
        return moves;
    }
    // 後方互換用: ルート + 先頭セットアップノードのマーカー
    extractRootMarkers(root) {
        const out = [];
        const rootExt = root;
        if (rootExt.__markers) {
            for (const m of rootExt.__markers) {
                out.push({
                    pos: { ...m.pos },
                    kind: m.kind,
                    ...(m.label !== undefined ? { label: m.label } : {}),
                });
            }
        }
        const setup = root.children[0];
        if (setup && !setup.move) {
            const setupExt = setup;
            if (setupExt.__markers) {
                for (const m of setupExt.__markers) {
                    out.push({
                        pos: { ...m.pos },
                        kind: m.kind,
                        ...(m.label !== undefined ? { label: m.label } : {}),
                    });
                }
            }
        }
        return out;
    }
    // 後方互換用: 主ラインの各着手ノードのマーカー
    extractMainLineNodeMarkers(root) {
        var _a, _b, _c;
        const out = [];
        let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
        if (node && !node.move) {
            node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
        }
        while (node) {
            const ext = node;
            const list = [];
            if (ext.__markers) {
                for (const m of ext.__markers) {
                    list.push({
                        pos: { ...m.pos },
                        kind: m.kind,
                        ...(m.label !== undefined ? { label: m.label } : {}),
                    });
                }
            }
            out.push(list);
            node = (_c = node.children[0]) !== null && _c !== void 0 ? _c : null;
        }
        return out;
    }
    // ============ SGF出力 ============
    export(state) {
        var _a;
        let out = "(";
        // leading ; でセットアップノードを作成し、ルート属性をそのノードに紐付ける
        // これで再パース時に AB/AW 等のセットアップがセットアップノードに来る
        out += ";";
        out += this.exportGameInfo(state);
        out += this.markerPropsToString((_a = state.rootMarkers) !== null && _a !== void 0 ? _a : []);
        // 子ノードを再帰的に出力（深さ 0 = ルート直下から）
        for (const child of state.sgfTree.children) {
            out += this.exportSubtree(child, 0, state);
        }
        out += ")";
        return out;
    }
    exportTree(root, state) {
        // 後方互換のために残す
        return this.export(state);
    }
    exportGameInfo(state) {
        var _a, _b, _c, _d, _e, _f;
        let out = "";
        out += "GM[1]";
        out += "FF[4]";
        out += `SZ[${state.boardSize}]`;
        if (state.komi !== null && state.komi !== undefined) {
            out += `KM[${state.komi}]`;
        }
        const handicapMeta = (_a = state.gameInfo) === null || _a === void 0 ? void 0 : _a.handicap;
        const treatAsHandicap = ((_b = state.handicapStones) !== null && _b !== void 0 ? _b : 0) > 0 && !state.problemDiagramSet;
        const handicapValue = handicapMeta !== null && handicapMeta !== undefined
            ? handicapMeta
            : treatAsHandicap
                ? state.handicapStones
                : null;
        if (handicapValue !== null && handicapValue !== undefined) {
            out += `HA[${handicapValue}]`;
        }
        if ((_c = state.gameInfo) === null || _c === void 0 ? void 0 : _c.title) {
            out += `GN[${this.escapeValue(state.gameInfo.title)}]`;
        }
        if ((_d = state.gameInfo) === null || _d === void 0 ? void 0 : _d.playerBlack) {
            out += `PB[${this.escapeValue(state.gameInfo.playerBlack)}]`;
        }
        if ((_e = state.gameInfo) === null || _e === void 0 ? void 0 : _e.playerWhite) {
            out += `PW[${this.escapeValue(state.gameInfo.playerWhite)}]`;
        }
        if ((_f = state.gameInfo) === null || _f === void 0 ? void 0 : _f.result) {
            out += `RE[${this.escapeValue(state.gameInfo.result)}]`;
        }
        // 問題図 / 置石の AB / AW を出力する
        // 置石（HA あり）は handicapPositions として、なければ problemDiagramBlack/White として
        const initialBlack = state.problemDiagramSet
            ? state.problemDiagramBlack
            : state.handicapPositions;
        if (initialBlack && initialBlack.length > 0) {
            const blackCoords = initialBlack
                .map((pos) => `[${this.toCoord(pos.col)}${this.toCoord(pos.row)}]`)
                .join("");
            out += `AB${blackCoords}`;
        }
        if (state.problemDiagramSet &&
            state.problemDiagramWhite &&
            state.problemDiagramWhite.length > 0) {
            const whiteCoords = state.problemDiagramWhite
                .map((pos) => `[${this.toCoord(pos.col)}${this.toCoord(pos.row)}]`)
                .join("");
            out += `AW${whiteCoords}`;
        }
        return out;
    }
    /**
     * @param node 出力対象ノード
     * @param mainIndex 主ライン基準の深さ（ルート直下が 0）。state.nodeMarkers[i] の参照に使う。
     * @param state ゲーム状態
     */
    exportSubtree(node, mainIndex, state) {
        let out = "";
        if (node.move) {
            out += ";";
            const color = node.move.color === 1 ? "B" : "W";
            const coord = `${this.toCoord(node.move.col)}${this.toCoord(node.move.row)}`;
            out += `${color}[${coord}]`;
        }
        else if (node.id !== "root") {
            // move なしノード（セットアップ等）も ; 付きで出力する
            out += ";";
        }
        out += this.lookupNodeMarkers(node, mainIndex, state);
        if (node.children.length === 0) {
            return out;
        }
        // 主分岐（children[0]）はそのまま続き、以降の兄弟は (...) で括る
        const main = node.children[0];
        if (main) {
            out += this.exportSubtree(main, mainIndex + 1, state);
        }
        for (let i = 1; i < node.children.length; i++) {
            const sibling = node.children[i];
            if (!sibling)
                continue;
            out += "(";
            // 副分岐は独立した SGF ノードとして。先頭の ; はそのまま残す
            out += this.exportSubtree(sibling, mainIndex, state);
            out += ")";
        }
        return out;
    }
    /**
     * ノードに紐づくマーカーを文字列に変換する。
     * 優先順位:
     *   1) node.__markers（パース結果や直接付与されたマーカー）
     *   2) state.nodeMarkers[mainIndex]（主ラインの深さ基準）
     */
    lookupNodeMarkers(node, mainIndex, state) {
        var _a;
        const ext = node;
        if (ext.__markers && ext.__markers.length > 0) {
            return this.markerPropsToString(ext.__markers);
        }
        if (node.isMainLine && mainIndex >= 0) {
            const list = (_a = state.nodeMarkers) === null || _a === void 0 ? void 0 : _a[mainIndex];
            if (list && list.length > 0) {
                return this.markerPropsToString(list);
            }
        }
        return "";
    }
    // ============ 内部: プロパティ適用 ============
    applyProperty(node, ident, values, gameInfo, root) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const id = ident.toUpperCase();
        switch (id) {
            case "GM":
            case "FF":
                // メタのみ、保持不要
                return;
            case "SZ": {
                const size = parseInt((_a = values[0]) !== null && _a !== void 0 ? _a : "", 10);
                if (Number.isFinite(size)) {
                    gameInfo.boardSize = size;
                }
                return;
            }
            case "KM": {
                const k = parseFloat((_b = values[0]) !== null && _b !== void 0 ? _b : "");
                gameInfo.komi = Number.isNaN(k) ? null : k;
                return;
            }
            case "HA": {
                const h = parseInt((_c = values[0]) !== null && _c !== void 0 ? _c : "", 10);
                gameInfo.handicap = Number.isNaN(h) ? null : h;
                gameInfo.handicapStones = Number.isNaN(h) ? 0 : h;
                return;
            }
            case "GN":
                gameInfo.title = (_d = values[0]) !== null && _d !== void 0 ? _d : "";
                return;
            case "PB":
                gameInfo.playerBlack = values[0] || null;
                return;
            case "PW":
                gameInfo.playerWhite = values[0] || null;
                return;
            case "RE":
                gameInfo.result = values[0] || null;
                return;
            case "PL":
                gameInfo.startColor = ((_e = values[0]) !== null && _e !== void 0 ? _e : "").toUpperCase() === "W" ? 2 : 1;
                return;
            case "B":
            case "W": {
                const color = id === "B" ? 1 : 2;
                const coord = ((_f = values[0]) !== null && _f !== void 0 ? _f : "").toLowerCase();
                if (coord.length !== 2)
                    return;
                const col = coord.charCodeAt(0) - 97;
                const row = coord.charCodeAt(1) - 97;
                if (col < 0 || row < 0)
                    return;
                node.move = { col, row, color };
                return;
            }
            case "AB":
            case "AW": {
                // AB/AW はルートまたは任意のノードに置石を設定する。
                // 旧実装と同じく、全ノードから AB/AW を集約して
                // problemDiagramBlack/White に集約する。
                const positions = [];
                for (const raw of values) {
                    const coord = (raw !== null && raw !== void 0 ? raw : "").toLowerCase();
                    if (coord.length !== 2)
                        continue;
                    const col = coord.charCodeAt(0) - 97;
                    const row = coord.charCodeAt(1) - 97;
                    if (col < 0 || row < 0)
                        continue;
                    positions.push({ col, row });
                }
                if (id === "AB") {
                    if (((_g = gameInfo.handicapStones) !== null && _g !== void 0 ? _g : 0) > 0) {
                        gameInfo.handicapPositions = [
                            ...((_h = gameInfo.handicapPositions) !== null && _h !== void 0 ? _h : []),
                            ...positions,
                        ];
                        gameInfo.startColor = 2;
                    }
                    else {
                        gameInfo.problemDiagramBlack = [
                            ...((_j = gameInfo.problemDiagramBlack) !== null && _j !== void 0 ? _j : []),
                            ...positions,
                        ];
                    }
                }
                else {
                    gameInfo.problemDiagramWhite = [
                        ...((_k = gameInfo.problemDiagramWhite) !== null && _k !== void 0 ? _k : []),
                        ...positions,
                    ];
                }
                if ((((_l = gameInfo.problemDiagramBlack) === null || _l === void 0 ? void 0 : _l.length) || 0) > 0 ||
                    (((_m = gameInfo.problemDiagramWhite) === null || _m === void 0 ? void 0 : _m.length) || 0) > 0) {
                    gameInfo.problemDiagramSet = true;
                }
                return;
            }
            case "CR":
            case "TR":
            case "SQ":
            case "MA":
            case "LB": {
                // マーカー。ノードに紐付ける。
                // 注: 現状の storage は rootMarkers / nodeMarkers[][]
                // （深さ基準）なので、呼び出し側で吸収する想定。
                // ここではパース処理のみ markerPositions として一時保持。
                const markers = this.parseMarkersFromValues(id, values);
                if (markers.length > 0) {
                    const ext = node;
                    ext.__markers = [...((_o = ext.__markers) !== null && _o !== void 0 ? _o : []), ...markers];
                }
                return;
            }
            default:
                // C (comment), N (name), etc. は読み捨て（将来拡張余地）
                return;
        }
    }
    parseMarkersFromValues(kind, values) {
        var _a, _b;
        const out = [];
        for (const raw of values) {
            const v = raw !== null && raw !== void 0 ? raw : "";
            if (kind === "LB") {
                // LB[aa:A] 形式
                const m = v.match(/^([a-z]{2}):(.*)$/i);
                if (!m)
                    continue;
                const coord = ((_a = m[1]) !== null && _a !== void 0 ? _a : "").toLowerCase();
                const label = ((_b = m[2]) !== null && _b !== void 0 ? _b : "")
                    .replace(/\\:/g, ":")
                    .replace(/\\\]/g, "]")
                    .replace(/\\\\/g, "\\");
                if (coord.length !== 2)
                    continue;
                const col = coord.charCodeAt(0) - 97;
                const row = coord.charCodeAt(1) - 97;
                if (col < 0 || row < 0)
                    continue;
                out.push({ pos: { col, row }, kind: "LB", label });
            }
            else {
                if (v.length !== 2)
                    continue;
                const coord = v.toLowerCase();
                const col = coord.charCodeAt(0) - 97;
                const row = coord.charCodeAt(1) - 97;
                if (col < 0 || row < 0)
                    continue;
                out.push({ pos: { col, row }, kind });
            }
        }
        return out;
    }
    // ============ 内部: トークナイザ ============
    tokenize(text) {
        var _a, _b, _c;
        const tokens = [];
        let i = 0;
        while (i < text.length) {
            const c = text[i];
            if (c === "(") {
                tokens.push({ kind: "open" });
                i++;
                continue;
            }
            if (c === ")") {
                tokens.push({ kind: "close" });
                i++;
                continue;
            }
            if (c === ";") {
                tokens.push({ kind: "semicolon" });
                i++;
                continue;
            }
            if (!c) {
                i++;
                continue;
            }
            if (/[A-Z]/.test(c)) {
                let ident = "";
                while (i < text.length && /[A-Z]/.test((_a = text[i]) !== null && _a !== void 0 ? _a : "")) {
                    ident += text[i];
                    i++;
                }
                const values = [];
                while (i < text.length && text[i] === "[") {
                    let value = "";
                    i++;
                    while (i < text.length && text[i] !== "]") {
                        if (text[i] === "\\" && i + 1 < text.length) {
                            value += (_b = text[i + 1]) !== null && _b !== void 0 ? _b : "";
                            i += 2;
                        }
                        else {
                            value += (_c = text[i]) !== null && _c !== void 0 ? _c : "";
                            i++;
                        }
                    }
                    if (i < text.length && text[i] === "]")
                        i++;
                    values.push(value);
                }
                tokens.push({ kind: "property", ident, values });
                continue;
            }
            // Skip whitespace and other chars
            i++;
        }
        return tokens;
    }
    extractInner(rawText) {
        const openIdx = rawText.indexOf("(");
        const closeIdx = rawText.lastIndexOf(")");
        if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
            return rawText;
        }
        return rawText.slice(openIdx + 1, closeIdx);
    }
    // ============ 内部: エクスポータ補助 ============
    toCoord(n) {
        return String.fromCharCode(97 + n);
    }
    escapeValue(s) {
        return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
    }
    markerPropsToString(markers) {
        var _a;
        if (!markers || markers.length === 0)
            return "";
        const groupedElist = {};
        const labels = [];
        for (const m of markers) {
            if (m.kind === "LB") {
                labels.push(m);
            }
            else {
                const list = (_a = groupedElist[m.kind]) !== null && _a !== void 0 ? _a : [];
                list.push(m.pos);
                groupedElist[m.kind] = list;
            }
        }
        let out = "";
        for (const kind of MARKER_PROPERTIES) {
            if (kind === "LB") {
                if (labels.length === 0)
                    continue;
                const items = labels
                    .map((m) => {
                    var _a;
                    const coord = `${this.toCoord(m.pos.col)}${this.toCoord(m.pos.row)}`;
                    const safe = ((_a = m.label) !== null && _a !== void 0 ? _a : "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
                    return `[${coord}:${safe}]`;
                })
                    .join("");
                out += `LB${items}`;
                continue;
            }
            const points = groupedElist[kind];
            if (!points || points.length === 0)
                continue;
            const coords = points
                .map((p) => `[${this.toCoord(p.col)}${this.toCoord(p.row)}]`)
                .join("");
            out += `${kind}${coords}`;
        }
        return out;
    }
}
//# sourceMappingURL=sgf-parser.js.map