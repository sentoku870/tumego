import { positionToSgf, sgfToPosition } from './sgf-coordinates.js';
import { extractMetadata, createDefaultGameInfo, sgfColorToStoneColor } from './sgf-metadata.js';
const MARKER_PROPERTIES = ['CR', 'TR', 'SQ', 'MA', 'LB'];
export class SGFParser {
    // ============ SGF解析 ============
    parse(sgfText) {
        const rawText = sgfText.trim();
        const gameInfo = extractMetadata(rawText, createDefaultGameInfo());
        const moves = this.parseMoves(rawText, gameInfo);
        const { initialBlack, initialWhite } = this.parseSetupPositions(rawText, gameInfo);
        // 着手履歴の先頭色から startColor を推定 (HA / PL 未指定の場合)
        const playerMatch = rawText.match(/PL\[(B|W)\]/i);
        if (playerMatch) {
            gameInfo.startColor = sgfColorToStoneColor(playerMatch[1]);
        }
        else if (!rawText.match(/HA\[/i) && moves.length > 0) {
            gameInfo.startColor = moves[0].color;
        }
        // 置石 or 問題図として Black/White を適用
        this.applySetupToGameInfo(gameInfo, initialBlack, initialWhite);
        // マーカー（CR/TR/SQ/MA）をノード別に解析
        const { rootMarkers, nodeMarkers } = this.parseMarkersPerNode(rawText, moves.length);
        return {
            moves,
            gameInfo,
            rawSGF: rawText,
            rootMarkers,
            nodeMarkers,
        };
    }
    parseMoves(rawText, _gameInfo) {
        const moves = [];
        const moveMatches = rawText.matchAll(/;([BW])\[((?:[a-z]{2})?)\]/gi);
        for (const match of moveMatches) {
            const color = sgfColorToStoneColor(match[1]);
            const coord = (match[2] || '').toLowerCase();
            if (coord.length !== 2) {
                // パス着手はスキップ
                continue;
            }
            const pos = sgfToPosition(coord);
            if (!pos)
                continue;
            moves.push({ col: pos.col, row: pos.row, color });
        }
        return moves;
    }
    parseSetupPositions(rawText, _gameInfo) {
        const initialBlack = [];
        const initialWhite = [];
        const collectSetup = (property, target) => {
            var _a;
            // \b で SGF プロパティ識別子の境界を保証し、
            // lookahead で「次のプロパティ識別子」「;」「)」「終端」のいずれかを
            // 要求することで、AB[aa][bb]AW[cc] のような隣接プロパティで
            // AW 側の座標を AB 側に巻き込まないようにする (B2 修正)。
            const pattern = new RegExp(`\\b${property}((?:\\[[a-z]{2}\\])+)(?=[A-Z]\\w*\\[|;|\\)|$)`, 'gi');
            const matches = rawText.matchAll(pattern);
            for (const match of matches) {
                const coordGroup = (_a = match[1]) !== null && _a !== void 0 ? _a : '';
                const coords = coordGroup.match(/\[([a-z]{2})\]/gi);
                if (!coords)
                    continue;
                coords.forEach(coord => {
                    const clean = coord.slice(1, -1).toLowerCase();
                    const pos = sgfToPosition(clean);
                    if (pos) {
                        target.push(pos);
                    }
                });
            }
        };
        collectSetup('AB', initialBlack);
        collectSetup('AW', initialWhite);
        return { initialBlack, initialWhite };
    }
    applySetupToGameInfo(gameInfo, initialBlack, initialWhite) {
        var _a, _b;
        if (initialBlack.length > 0) {
            if ((gameInfo.handicapStones || 0) > 0) {
                gameInfo.handicapPositions = initialBlack;
                gameInfo.startColor = 2;
            }
            else {
                gameInfo.problemDiagramBlack = initialBlack;
            }
        }
        if (initialWhite.length > 0) {
            gameInfo.problemDiagramWhite = initialWhite;
        }
        if ((((_a = gameInfo.problemDiagramBlack) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0 ||
            (((_b = gameInfo.problemDiagramWhite) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0) {
            gameInfo.problemDiagramSet = true;
        }
    }
    /**
     * SGFテキストを「;B[..] / ;W[..]」の開始位置で分割し、各ノード内の
     * CR/TR/SQ/MA を集めてルート用・着手ノード用の配列として返す。
     * パス（座標なし）の着手があっても nodeMarkers の長さは sgfMoves.length に揃える。
     */
    parseMarkersPerNode(rawText, moveCount) {
        const inner = this.extractInner(rawText);
        // 着手ノード境界（;B[..] / ;W[..]）のインデックスを順に抽出
        const moveBoundary = new RegExp(';([BW])\\[[^\\]]*\\]', 'gi');
        const boundaries = [];
        let m;
        while ((m = moveBoundary.exec(inner)) !== null) {
            boundaries.push(m.index);
        }
        if (boundaries.length === 0) {
            return { rootMarkers: this.collectMarkersInNode(inner), nodeMarkers: this.emptyNodeMarkers(moveCount) };
        }
        // ルートチャンク: 先頭の手前まで
        const rootChunk = inner.slice(0, boundaries[0]);
        const rootMarkers = this.collectMarkersInNode(rootChunk);
        // 着手チャンク: 各境界から次の境界まで
        const nodeMarkers = [];
        for (let i = 0; i < moveCount; i++) {
            const start = boundaries[i];
            const end = i + 1 < boundaries.length ? boundaries[i + 1] : inner.length;
            const chunk = inner.slice(start, end);
            nodeMarkers.push(this.collectMarkersInNode(chunk));
        }
        return { rootMarkers, nodeMarkers };
    }
    extractInner(rawText) {
        const openIdx = rawText.indexOf('(');
        const closeIdx = rawText.lastIndexOf(')');
        if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
            return rawText;
        }
        return rawText.slice(openIdx + 1, closeIdx);
    }
    collectMarkersInNode(chunk) {
        var _a, _b, _c;
        const out = [];
        // CR/TR/SQ/MA は elist 形式: TR[aa][bb][cc]
        for (const kind of MARKER_PROPERTIES) {
            if (kind === 'LB') {
                // LB は coord:label のシンプル形式: LB[aa:A][bb:黒]
                const pattern = /\bLB((?:\[[a-z]{2}:[^\]]*\])+)(?=[A-Z]\w*\[|;|\)|$)/gi;
                const matches = chunk.matchAll(pattern);
                for (const m of matches) {
                    const group = (_a = m[1]) !== null && _a !== void 0 ? _a : '';
                    const items = group.matchAll(/\[([a-z]{2}):([^\]]*)\]/gi);
                    for (const item of items) {
                        const pos = sgfToPosition(item[1].toLowerCase());
                        if (!pos)
                            continue;
                        const label = ((_b = item[2]) !== null && _b !== void 0 ? _b : '').replace(/\\:/g, ':').replace(/\\\]/g, ']');
                        out.push({ pos, kind: 'LB', label });
                    }
                }
                continue;
            }
            const pattern = new RegExp(`\\b${kind}((?:\\[[a-z]{2}\\])+)(?=[A-Z]\\w*\\[|;|\\)|$)`, 'gi');
            const matches = chunk.matchAll(pattern);
            for (const m of matches) {
                const coordGroup = (_c = m[1]) !== null && _c !== void 0 ? _c : '';
                const coords = coordGroup.match(/\[([a-z]{2})\]/gi);
                if (!coords)
                    continue;
                for (const coord of coords) {
                    const clean = coord.slice(1, -1).toLowerCase();
                    const pos = sgfToPosition(clean);
                    if (!pos)
                        continue;
                    out.push({ pos, kind });
                }
            }
        }
        return out;
    }
    emptyNodeMarkers(moveCount) {
        const out = [];
        for (let i = 0; i < moveCount; i++)
            out.push([]);
        return out;
    }
    // ============ SGF出力 ============
    export(state) {
        var _a, _b, _c, _d, _e, _f, _g;
        const komi = (_a = state.komi) !== null && _a !== void 0 ? _a : (_b = state.gameInfo) === null || _b === void 0 ? void 0 : _b.komi;
        const handicapMeta = (_c = state.gameInfo) === null || _c === void 0 ? void 0 : _c.handicap;
        let sgf = `(;GM[1]FF[4]SZ[${state.boardSize}]`;
        if (komi !== null && komi !== undefined) {
            sgf += `KM[${komi}]`;
        }
        if ((_d = state.gameInfo) === null || _d === void 0 ? void 0 : _d.title) {
            sgf += `GN[${state.gameInfo.title}]`;
        }
        // 置石がある場合はハンディキャップとして記録
        const treatAsHandicap = state.handicapStones > 0 && !state.problemDiagramSet;
        const handicapValue = handicapMeta !== null && handicapMeta !== undefined
            ? handicapMeta
            : treatAsHandicap
                ? state.handicapStones
                : null;
        if (handicapValue !== null && handicapValue !== undefined) {
            sgf += `HA[${handicapValue}]`;
        }
        const initialBlack = state.problemDiagramSet ? state.problemDiagramBlack : state.handicapPositions;
        if (initialBlack.length > 0) {
            const blackCoords = initialBlack.map(positionToSgf).map(s => `[${s}]`).join('');
            sgf += `AB${blackCoords}`;
        }
        if (state.problemDiagramSet && state.problemDiagramWhite.length > 0) {
            const whiteCoords = state.problemDiagramWhite.map(positionToSgf).map(s => `[${s}]`).join('');
            sgf += `AW${whiteCoords}`;
        }
        if ((_e = state.gameInfo) === null || _e === void 0 ? void 0 : _e.playerBlack) {
            sgf += `PB[${state.gameInfo.playerBlack}]`;
        }
        if ((_f = state.gameInfo) === null || _f === void 0 ? void 0 : _f.playerWhite) {
            sgf += `PW[${state.gameInfo.playerWhite}]`;
        }
        if ((_g = state.gameInfo) === null || _g === void 0 ? void 0 : _g.result) {
            sgf += `RE[${state.gameInfo.result}]`;
        }
        // ルートレベルのマーカー
        sgf += this.markerPropsToString(state.rootMarkers);
        // 着手を記録（マーカーはその着手ノードのプロパティとして後に並べる）
        state.sgfMoves.forEach((move, idx) => {
            var _a, _b;
            const color = move.color === 1 ? 'B' : 'W';
            const coord = positionToSgf(move);
            sgf += `;${color}[${coord}]`;
            const nodeMarkers = (_b = (_a = state.nodeMarkers) === null || _a === void 0 ? void 0 : _a[idx]) !== null && _b !== void 0 ? _b : [];
            sgf += this.markerPropsToString(nodeMarkers);
        });
        sgf += ')';
        return sgf;
    }
    markerPropsToString(markers) {
        var _a;
        if (!markers || markers.length === 0)
            return '';
        const groupedElist = {};
        const labels = [];
        for (const m of markers) {
            if (m.kind === 'LB') {
                labels.push(m);
            }
            else {
                const list = (_a = groupedElist[m.kind]) !== null && _a !== void 0 ? _a : [];
                list.push(m.pos);
                groupedElist[m.kind] = list;
            }
        }
        let out = '';
        for (const kind of MARKER_PROPERTIES) {
            if (kind === 'LB') {
                if (labels.length === 0)
                    continue;
                const items = labels
                    .map((m) => {
                    var _a;
                    const coord = positionToSgf(m.pos);
                    const safe = ((_a = m.label) !== null && _a !== void 0 ? _a : '').replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
                    return `[${coord}:${safe}]`;
                })
                    .join('');
                out += `LB${items}`;
                continue;
            }
            const points = groupedElist[kind];
            if (!points || points.length === 0)
                continue;
            const coords = points.map(positionToSgf).map(s => `[${s}]`).join('');
            out += `${kind}${coords}`;
        }
        return out;
    }
}
//# sourceMappingURL=sgf-parser.js.map