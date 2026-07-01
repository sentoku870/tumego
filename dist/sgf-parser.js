// ============ SGF処理エンジン ============
import { DEFAULT_CONFIG } from './types.js';
export class SGFParser {
    // ============ SGF解析 ============
    parse(sgfText) {
        var _a, _b;
        const rawText = sgfText.trim();
        const moves = [];
        const gameInfo = {
            title: '',
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
            result: null
        };
        const titleMatch = rawText.match(/GN\[([^\]]*)\]/i);
        if (titleMatch) {
            gameInfo.title = titleMatch[1] || '';
        }
        // 盤サイズの解析
        const sizeMatch = rawText.match(/SZ\[(\d+)\]/i);
        if (sizeMatch) {
            gameInfo.boardSize = parseInt(sizeMatch[1], 10);
        }
        // コミの解析
        const komiMatch = rawText.match(/KM\[([^\]]+)\]/i);
        if (komiMatch) {
            const parsedKomi = parseFloat(komiMatch[1]);
            gameInfo.komi = Number.isNaN(parsedKomi) ? null : parsedKomi;
        }
        // ハンディキャップ（置石数）の解析
        const handicapMatch = rawText.match(/HA\[([^\]]+)\]/i);
        if (handicapMatch) {
            const parsedHandicap = parseInt(handicapMatch[1], 10);
            gameInfo.handicap = Number.isNaN(parsedHandicap) ? null : parsedHandicap;
            gameInfo.handicapStones = Number.isNaN(parsedHandicap)
                ? 0
                : parsedHandicap;
        }
        const playerBlackMatch = rawText.match(/PB\[([^\]]*)\]/i);
        if (playerBlackMatch) {
            gameInfo.playerBlack = playerBlackMatch[1] || null;
        }
        const playerWhiteMatch = rawText.match(/PW\[([^\]]*)\]/i);
        if (playerWhiteMatch) {
            gameInfo.playerWhite = playerWhiteMatch[1] || null;
        }
        const resultMatch = rawText.match(/RE\[([^\]]*)\]/i);
        if (resultMatch) {
            gameInfo.result = resultMatch[1] || null;
        }
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
                    if (clean.length !== 2)
                        return;
                    const col = clean.charCodeAt(0) - 97;
                    const row = clean.charCodeAt(1) - 97;
                    if (col >= 0 && row >= 0) {
                        target.push({ col, row });
                    }
                });
            }
        };
        collectSetup('AB', initialBlack);
        collectSetup('AW', initialWhite);
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
        // 着手の解析
        const moveMatches = rawText.matchAll(/;([BW])\[((?:[a-z]{2})?)\]/gi);
        for (const match of moveMatches) {
            const color = match[1].toUpperCase() === 'B' ? 1 : 2;
            const coord = (match[2] || '').toLowerCase();
            if (coord.length !== 2) {
                // パス着手はスキップ
                continue;
            }
            const col = coord.charCodeAt(0) - 97;
            const row = coord.charCodeAt(1) - 97;
            if (col < 0 || row < 0)
                continue;
            moves.push({ col, row, color: color });
        }
        if (!handicapMatch && moves.length > 0 && !rawText.match(/PL\[(B|W)\]/i)) {
            gameInfo.startColor = moves[0].color;
        }
        const playerMatch = rawText.match(/PL\[(B|W)\]/i);
        if (playerMatch) {
            gameInfo.startColor = playerMatch[1].toUpperCase() === 'B' ? 1 : 2;
        }
        return { moves, gameInfo, rawSGF: rawText };
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
            const blackCoords = initialBlack
                .map((pos) => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
                .join('');
            sgf += `AB${blackCoords}`;
        }
        if (state.problemDiagramSet && state.problemDiagramWhite.length > 0) {
            const whiteCoords = state.problemDiagramWhite
                .map((pos) => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
                .join('');
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
        // 着手を記録
        for (const move of state.sgfMoves) {
            const color = move.color === 1 ? 'B' : 'W';
            const coord = `${String.fromCharCode(97 + move.col)}${String.fromCharCode(97 + move.row)}`;
            sgf += `;${color}[${coord}]`;
        }
        sgf += ')';
        return sgf;
    }
}
//# sourceMappingURL=sgf-parser.js.map