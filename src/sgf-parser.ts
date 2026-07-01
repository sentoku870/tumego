// ============ SGF処理エンジン ============
import {
  Move,
  Position,
  GameState,
  SGFGameInfo,
  SGFParseResult,
  DEFAULT_CONFIG
} from './types.js';

export class SGFParser {
  // ============ SGF解析 ============
  parse(sgfText: string): SGFParseResult {
    const rawText = sgfText.trim();

    const moves: Move[] = [];
    const gameInfo: SGFGameInfo = {
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

    const initialBlack: Position[] = [];
    const initialWhite: Position[] = [];

    const collectSetup = (property: string, target: Position[]): void => {
      // \b で SGF プロパティ識別子の境界を保証し、
      // lookahead で「次のプロパティ識別子」「;」「)」「終端」のいずれかを
      // 要求することで、AB[aa][bb]AW[cc] のような隣接プロパティで
      // AW 側の座標を AB 側に巻き込まないようにする (B2 修正)。
      const pattern = new RegExp(`\\b${property}((?:\\[[a-z]{2}\\])+)(?=[A-Z]\\w*\\[|;|\\)|$)`, 'gi');
      const matches = rawText.matchAll(pattern);
      for (const match of matches) {
        const coordGroup = match[1] ?? '';
        const coords = coordGroup.match(/\[([a-z]{2})\]/gi);
        if (!coords) continue;

        coords.forEach(coord => {
          const clean = coord.slice(1, -1).toLowerCase();
          if (clean.length !== 2) return;
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
      } else {
        gameInfo.problemDiagramBlack = initialBlack;
      }
    }

    if (initialWhite.length > 0) {
      gameInfo.problemDiagramWhite = initialWhite;
    }

    if ((gameInfo.problemDiagramBlack?.length || 0) > 0 ||
        (gameInfo.problemDiagramWhite?.length || 0) > 0) {
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
      if (col < 0 || row < 0) continue;
      moves.push({ col, row, color: color as 1 | 2 });
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
  export(state: GameState): string {
    const komi = state.komi ?? state.gameInfo?.komi;
    const handicapMeta = state.gameInfo?.handicap;
    let sgf = `(;GM[1]FF[4]SZ[${state.boardSize}]`;

    if (komi !== null && komi !== undefined) {
      sgf += `KM[${komi}]`;
    }

    if (state.gameInfo?.title) {
      sgf += `GN[${state.gameInfo.title}]`;
    }

    // 置石がある場合はハンディキャップとして記録
    const treatAsHandicap = state.handicapStones > 0 && !state.problemDiagramSet;
    const handicapValue =
      handicapMeta !== null && handicapMeta !== undefined
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
        .map((pos: Position) => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
        .join('');
      sgf += `AB${blackCoords}`;
    }

    if (state.problemDiagramSet && state.problemDiagramWhite.length > 0) {
      const whiteCoords = state.problemDiagramWhite
        .map((pos: Position) => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
        .join('');
      sgf += `AW${whiteCoords}`;
    }

    if (state.gameInfo?.playerBlack) {
      sgf += `PB[${state.gameInfo.playerBlack}]`;
    }

    if (state.gameInfo?.playerWhite) {
      sgf += `PW[${state.gameInfo.playerWhite}]`;
    }

    if (state.gameInfo?.result) {
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