// ============ SGF処理エンジン ============
// SGF テキストのパースと GameState からの SGF 出力を担当する。
// 座標変換・メタデータ抽出は専用モジュールに委譲:
//
//   - sgf-coordinates.ts: 座標 ('aa' 〜 'ss') <-> (col, row)
//   - sgf-metadata.ts:    メタデータ抽出 (GN/SZ/KM/HA/PB/PW/RE)
import {
  BoardMarker,
  MarkerKind,
  Move,
  Position,
  GameState,
  SGFParseResult,
  SGFGameInfo
} from './types.js';
import {
  positionToSgf,
  sgfToPosition
} from './sgf-coordinates.js';
import {
  extractMetadata,
  createDefaultGameInfo,
  sgfColorToStoneColor
} from './sgf-metadata.js';

const MARKER_PROPERTIES: MarkerKind[] = ['CR', 'TR', 'SQ', 'MA', 'LB'];

export class SGFParser {
  // ============ SGF解析 ============
  parse(sgfText: string): SGFParseResult {
    const rawText = sgfText.trim();
    const gameInfo = extractMetadata(rawText, createDefaultGameInfo());
    const moves = this.parseMoves(rawText, gameInfo);
    const { initialBlack, initialWhite } = this.parseSetupPositions(rawText, gameInfo);

    // 着手履歴の先頭色から startColor を推定 (HA / PL 未指定の場合)
    const playerMatch = rawText.match(/PL\[(B|W)\]/i);
    if (playerMatch) {
      gameInfo.startColor = sgfColorToStoneColor(playerMatch[1]);
    } else if (!rawText.match(/HA\[/i) && moves.length > 0) {
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

  private parseMoves(rawText: string, _gameInfo: SGFGameInfo): Move[] {
    const moves: Move[] = [];
    const moveMatches = rawText.matchAll(/;([BW])\[((?:[a-z]{2})?)\]/gi);
    for (const match of moveMatches) {
      const color = sgfColorToStoneColor(match[1]);
      const coord = (match[2] || '').toLowerCase();
      if (coord.length !== 2) {
        // パス着手はスキップ
        continue;
      }
      const pos = sgfToPosition(coord);
      if (!pos) continue;
      moves.push({ col: pos.col, row: pos.row, color });
    }
    return moves;
  }

  private parseSetupPositions(rawText: string, _gameInfo: SGFGameInfo): { initialBlack: Position[]; initialWhite: Position[] } {
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

  private applySetupToGameInfo(
    gameInfo: SGFGameInfo,
    initialBlack: Position[],
    initialWhite: Position[]
  ): void {
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
  }

  /**
   * SGFテキストを「;B[..] / ;W[..]」の開始位置で分割し、各ノード内の
   * CR/TR/SQ/MA を集めてルート用・着手ノード用の配列として返す。
   * パス（座標なし）の着手があっても nodeMarkers の長さは sgfMoves.length に揃える。
   */
  private parseMarkersPerNode(
    rawText: string,
    moveCount: number
  ): { rootMarkers: BoardMarker[]; nodeMarkers: BoardMarker[][] } {
    const inner = this.extractInner(rawText);

    // 着手ノード境界（;B[..] / ;W[..]）のインデックスを順に抽出
    const moveBoundary = new RegExp(';([BW])\\[[^\\]]*\\]', 'gi');
    const boundaries: number[] = [];
    let m: RegExpExecArray | null;
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
    const nodeMarkers: BoardMarker[][] = [];
    for (let i = 0; i < moveCount; i++) {
      const start = boundaries[i];
      const end = i + 1 < boundaries.length ? boundaries[i + 1] : inner.length;
      const chunk = inner.slice(start, end);
      nodeMarkers.push(this.collectMarkersInNode(chunk));
    }
    return { rootMarkers, nodeMarkers };
  }

  private extractInner(rawText: string): string {
    const openIdx = rawText.indexOf('(');
    const closeIdx = rawText.lastIndexOf(')');
    if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
      return rawText;
    }
    return rawText.slice(openIdx + 1, closeIdx);
  }

  private collectMarkersInNode(chunk: string): BoardMarker[] {
    const out: BoardMarker[] = [];
    // CR/TR/SQ/MA は elist 形式: TR[aa][bb][cc]
    for (const kind of MARKER_PROPERTIES) {
      if (kind === 'LB') {
        // LB は coord:label のシンプル形式: LB[aa:A][bb:黒]
        const pattern = /\bLB((?:\[[a-z]{2}:[^\]]*\])+)(?=[A-Z]\w*\[|;|\)|$)/gi;
        const matches = chunk.matchAll(pattern);
        for (const m of matches) {
          const group = m[1] ?? '';
          const items = group.matchAll(/\[([a-z]{2}):([^\]]*)\]/gi);
          for (const item of items) {
            const pos = sgfToPosition(item[1].toLowerCase());
            if (!pos) continue;
            const label = (item[2] ?? '').replace(/\\:/g, ':').replace(/\\\]/g, ']');
            out.push({ pos, kind: 'LB', label });
          }
        }
        continue;
      }
      const pattern = new RegExp(
        `\\b${kind}((?:\\[[a-z]{2}\\])+)(?=[A-Z]\\w*\\[|;|\\)|$)`,
        'gi'
      );
      const matches = chunk.matchAll(pattern);
      for (const m of matches) {
        const coordGroup = m[1] ?? '';
        const coords = coordGroup.match(/\[([a-z]{2})\]/gi);
        if (!coords) continue;
        for (const coord of coords) {
          const clean = coord.slice(1, -1).toLowerCase();
          const pos = sgfToPosition(clean);
          if (!pos) continue;
          out.push({ pos, kind });
        }
      }
    }
    return out;
  }

  private emptyNodeMarkers(moveCount: number): BoardMarker[][] {
    const out: BoardMarker[][] = [];
    for (let i = 0; i < moveCount; i++) out.push([]);
    return out;
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
      const blackCoords = initialBlack.map(positionToSgf).map(s => `[${s}]`).join('');
      sgf += `AB${blackCoords}`;
    }

    if (state.problemDiagramSet && state.problemDiagramWhite.length > 0) {
      const whiteCoords = state.problemDiagramWhite.map(positionToSgf).map(s => `[${s}]`).join('');
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

    // ルートレベルのマーカー
    sgf += this.markerPropsToString(state.rootMarkers);

    // 着手を記録（マーカーはその着手ノードのプロパティとして後に並べる）
    state.sgfMoves.forEach((move, idx) => {
      const color = move.color === 1 ? 'B' : 'W';
      const coord = positionToSgf(move);
      sgf += `;${color}[${coord}]`;
      const nodeMarkers = state.nodeMarkers?.[idx] ?? [];
      sgf += this.markerPropsToString(nodeMarkers);
    });

    sgf += ')';
    return sgf;
  }

  private markerPropsToString(markers: BoardMarker[] | undefined): string {
    if (!markers || markers.length === 0) return '';
    const groupedElist: Partial<Record<Exclude<MarkerKind, 'LB'>, Position[]>> = {};
    const labels: BoardMarker[] = [];
    for (const m of markers) {
      if (m.kind === 'LB') {
        labels.push(m);
      } else {
        const list = groupedElist[m.kind] ?? [];
        list.push(m.pos);
        groupedElist[m.kind] = list;
      }
    }
    let out = '';
    for (const kind of MARKER_PROPERTIES) {
      if (kind === 'LB') {
        if (labels.length === 0) continue;
        const items = labels
          .map((m) => {
            const coord = positionToSgf(m.pos);
            const safe = (m.label ?? '').replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
            return `[${coord}:${safe}]`;
          })
          .join('');
        out += `LB${items}`;
        continue;
      }
      const points = groupedElist[kind];
      if (!points || points.length === 0) continue;
      const coords = points.map(positionToSgf).map(s => `[${s}]`).join('');
      out += `${kind}${coords}`;
    }
    return out;
  }
}
