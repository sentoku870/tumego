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
import {
  BoardMarker,
  DEFAULT_CONFIG,
  MarkerKind,
  Move,
  Position,
  SGFGameInfo,
  SGFNode,
  SGFParseResult,
  StoneColor,
} from "./types.js";

const MARKER_PROPERTIES: MarkerKind[] = ["CR", "TR", "SQ", "MA", "LB"];

interface PropertyToken {
  kind: "property";
  ident: string;
  values: string[];
}

interface StructureToken {
  kind: "open" | "close" | "semicolon";
}

type Token = PropertyToken | StructureToken;

export class SGFParser {
  // ============ エントリ ============

  parse(sgfText: string): SGFParseResult {
    const rawText = sgfText.trim();
    const inner = this.extractInner(rawText);

    const gameInfo: SGFGameInfo = {
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

    const root: SGFNode = {
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
    const lastMainStack: SGFNode[] = []; // variation 開始時の lastMainSequenceNode を保存
    let lastMainSequenceNode: SGFNode = root; // 現在の main sequence の最後のノード
    let parentForNewNode: SGFNode = root; // 次の `;` の親
    let inVariation: boolean = false; // 現在 variation 内か
    let currentNode: SGFNode = root;
    let nodeCounter = 0;

    const newNodeId = (): string => {
      nodeCounter += 1;
      return `n${nodeCounter}`;
    };

    for (const token of tokens) {
      if (token.kind === "open") {
        // Variation 開始: 現在の main sequence の状態を保存し、
        // parentForNewNode を lastMainSequenceNode.parent に設定する
        lastMainStack.push(lastMainSequenceNode);
        parentForNewNode = lastMainSequenceNode.parent ?? root;
        inVariation = true;
      } else if (token.kind === "close") {
        // Variation 終了: 保存した状態を復元
        const popped = lastMainStack.pop();
        lastMainSequenceNode = popped ?? root;
        // parentForNewNode は通常 lastMainSequenceNode（次の `;` で chain するため）
        parentForNewNode = lastMainSequenceNode;
        inVariation = lastMainStack.length > 0;
        currentNode = lastMainSequenceNode;
      } else if (token.kind === "semicolon") {
        const node: SGFNode = {
          id: newNodeId(),
          parent: parentForNewNode,
          children: [],
          isMainLine: !inVariation && parentForNewNode.children.length === 0,
        };
        parentForNewNode.children.push(node);
        parentForNewNode = node;
        lastMainSequenceNode = node;
        currentNode = node;
      } else if (token.kind === "property") {
        this.applyProperty(currentNode, token.ident, token.values, gameInfo, root);
      }
    }

    // ルート直下の最初の着手ノードがあれば、先手色を推定
    const firstMoveNode = root.children[0];
    if (firstMoveNode?.move) {
      if (!gameInfo.startColor || (gameInfo.handicapStones ?? 0) === 0) {
        if (gameInfo.handicapStones && gameInfo.handicapStones > 0) {
          // 置石ありは startColor を変えない
        } else {
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
  private extractMainLineMoves(root: SGFNode): Move[] {
    const moves: Move[] = [];
    let node: SGFNode | null = root.children[0] ?? null;
    while (node && !node.move) {
      node = node.children[0] ?? null;
    }
    while (node) {
      if (node.move) moves.push(node.move);
      node = node.children[0] ?? null;
    }
    return moves;
  }

  // 後方互換用: ルート + 先頭セットアップノードのマーカー
  private extractRootMarkers(root: SGFNode): BoardMarker[] {
    const out: BoardMarker[] = [];
    const rootExt = root as SGFNode & { __markers?: BoardMarker[] };
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
      const setupExt = setup as SGFNode & { __markers?: BoardMarker[] };
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
  private extractMainLineNodeMarkers(root: SGFNode): BoardMarker[][] {
    const out: BoardMarker[][] = [];
    let node: SGFNode | null = root.children[0] ?? null;
    if (node && !node.move) {
      node = node.children[0] ?? null;
    }
    while (node) {
      const ext = node as SGFNode & { __markers?: BoardMarker[] };
      const list: BoardMarker[] = [];
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
      node = node.children[0] ?? null;
    }
    return out;
  }

  // ============ SGF出力 ============
  export(state: import("./types.js").GameState): string {
    let out = "(";

    // leading ; でセットアップノードを作成し、ルート属性をそのノードに紐付ける
    // これで再パース時に AB/AW 等のセットアップがセットアップノードに来る
    out += ";";

    out += this.exportGameInfo(state);
    out += this.markerPropsToString(state.rootMarkers ?? []);

    // 子ノードを再帰的に出力（深さ 0 = ルート直下から）
    for (const child of state.sgfTree.children) {
      out += this.exportSubtree(child, 0, state);
    }

    out += ")";
    return out;
  }

  exportTree(root: SGFNode, state: import("./types.js").GameState): string {
    // 後方互換のために残す
    return this.export(state);
  }

  private exportGameInfo(state: import("./types.js").GameState): string {
    let out = "";
    out += "GM[1]";
    out += "FF[4]";
    out += `SZ[${state.boardSize}]`;

    if (state.komi !== null && state.komi !== undefined) {
      out += `KM[${state.komi}]`;
    }

    const handicapMeta = state.gameInfo?.handicap;
    const treatAsHandicap =
      (state.handicapStones ?? 0) > 0 && !state.problemDiagramSet;
    const handicapValue =
      handicapMeta !== null && handicapMeta !== undefined
        ? handicapMeta
        : treatAsHandicap
          ? state.handicapStones
          : null;
    if (handicapValue !== null && handicapValue !== undefined) {
      out += `HA[${handicapValue}]`;
    }

    if (state.gameInfo?.title) {
      out += `GN[${this.escapeValue(state.gameInfo.title)}]`;
    }

    if (state.gameInfo?.playerBlack) {
      out += `PB[${this.escapeValue(state.gameInfo.playerBlack)}]`;
    }
    if (state.gameInfo?.playerWhite) {
      out += `PW[${this.escapeValue(state.gameInfo.playerWhite)}]`;
    }
    if (state.gameInfo?.result) {
      out += `RE[${this.escapeValue(state.gameInfo.result)}]`;
    }

    // 問題図 / 置石の AB / AW を出力する
    // 置石（HA あり）は handicapPositions として、なければ problemDiagramBlack/White として
    const initialBlack = state.problemDiagramSet
      ? state.problemDiagramBlack
      : state.handicapPositions;
    if (initialBlack && initialBlack.length > 0) {
      const blackCoords = initialBlack
        .map(
          (pos: Position) =>
            `[${this.toCoord(pos.col)}${this.toCoord(pos.row)}]`
        )
        .join("");
      out += `AB${blackCoords}`;
    }

    if (
      state.problemDiagramSet &&
      state.problemDiagramWhite &&
      state.problemDiagramWhite.length > 0
    ) {
      const whiteCoords = state.problemDiagramWhite
        .map(
          (pos: Position) =>
            `[${this.toCoord(pos.col)}${this.toCoord(pos.row)}]`
        )
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
  private exportSubtree(
    node: SGFNode,
    mainIndex: number,
    state: import("./types.js").GameState
  ): string {
    let out = "";
    if (node.move) {
      out += ";";
      const color = node.move.color === 1 ? "B" : "W";
      const coord = `${this.toCoord(node.move.col)}${this.toCoord(node.move.row)}`;
      out += `${color}[${coord}]`;
    } else if (node.id !== "root") {
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
      if (!sibling) continue;
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
  private lookupNodeMarkers(
    node: SGFNode,
    mainIndex: number,
    state: import("./types.js").GameState
  ): string {
    const ext = node as SGFNode & { __markers?: BoardMarker[] };
    if (ext.__markers && ext.__markers.length > 0) {
      return this.markerPropsToString(ext.__markers);
    }
    if (node.isMainLine && mainIndex >= 0) {
      const list = state.nodeMarkers?.[mainIndex];
      if (list && list.length > 0) {
        return this.markerPropsToString(list);
      }
    }
    return "";
  }

  // エクスポータ用一時キャッシュ（exportTree 呼び出し中に GameStore が設定）
  private _rootMarkerExportCache: BoardMarker[] | null = null;
  private _nodeMarkerExportCache: Map<string, BoardMarker[]> | null = null;

  // ============ 内部: プロパティ適用 ============

  private applyProperty(
    node: SGFNode,
    ident: string,
    values: string[],
    gameInfo: SGFGameInfo,
    root: SGFNode
  ): void {
    const id = ident.toUpperCase();

    switch (id) {
      case "GM":
      case "FF":
        // メタのみ、保持不要
        return;
      case "SZ": {
        const size = parseInt(values[0] ?? "", 10);
        if (Number.isFinite(size)) {
          gameInfo.boardSize = size;
        }
        return;
      }
      case "KM": {
        const k = parseFloat(values[0] ?? "");
        gameInfo.komi = Number.isNaN(k) ? null : k;
        return;
      }
      case "HA": {
        const h = parseInt(values[0] ?? "", 10);
        gameInfo.handicap = Number.isNaN(h) ? null : h;
        gameInfo.handicapStones = Number.isNaN(h) ? 0 : h;
        return;
      }
      case "GN":
        gameInfo.title = values[0] ?? "";
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
        gameInfo.startColor = (values[0] ?? "").toUpperCase() === "W" ? 2 : 1;
        return;
      case "B":
      case "W": {
        const color: StoneColor = id === "B" ? 1 : 2;
        const coord = (values[0] ?? "").toLowerCase();
        if (coord.length !== 2) return;
        const col = coord.charCodeAt(0) - 97;
        const row = coord.charCodeAt(1) - 97;
        if (col < 0 || row < 0) return;
        node.move = { col, row, color };
        return;
      }
      case "AB":
      case "AW": {
        // AB/AW はルートまたは任意のノードに置石を設定する。
        // 旧実装と同じく、全ノードから AB/AW を集約して
        // problemDiagramBlack/White に集約する。
        const positions: Position[] = [];
        for (const raw of values) {
          const coord = (raw ?? "").toLowerCase();
          if (coord.length !== 2) continue;
          const col = coord.charCodeAt(0) - 97;
          const row = coord.charCodeAt(1) - 97;
          if (col < 0 || row < 0) continue;
          positions.push({ col, row });
        }
        if (id === "AB") {
          if ((gameInfo.handicapStones ?? 0) > 0) {
            gameInfo.handicapPositions = [
              ...(gameInfo.handicapPositions ?? []),
              ...positions,
            ];
            gameInfo.startColor = 2;
          } else {
            gameInfo.problemDiagramBlack = [
              ...(gameInfo.problemDiagramBlack ?? []),
              ...positions,
            ];
          }
        } else {
          gameInfo.problemDiagramWhite = [
            ...(gameInfo.problemDiagramWhite ?? []),
            ...positions,
          ];
        }
        if (
          (gameInfo.problemDiagramBlack?.length || 0) > 0 ||
          (gameInfo.problemDiagramWhite?.length || 0) > 0
        ) {
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
        const markers = this.parseMarkersFromValues(id as MarkerKind, values);
        if (markers.length > 0) {
          const ext = node as SGFNode & { __markers?: BoardMarker[] };
          ext.__markers = [...(ext.__markers ?? []), ...markers];
        }
        return;
      }
      default:
        // C (comment), N (name), etc. は読み捨て（将来拡張余地）
        return;
    }
  }

  private parseMarkersFromValues(
    kind: MarkerKind,
    values: string[]
  ): BoardMarker[] {
    const out: BoardMarker[] = [];
    for (const raw of values) {
      const v = raw ?? "";
      if (kind === "LB") {
        // LB[aa:A] 形式
        const m = v.match(/^([a-z]{2}):(.*)$/i);
        if (!m) continue;
        const coord = (m[1] ?? "").toLowerCase();
        const label = (m[2] ?? "")
          .replace(/\\:/g, ":")
          .replace(/\\\]/g, "]")
          .replace(/\\\\/g, "\\");
        if (coord.length !== 2) continue;
        const col = coord.charCodeAt(0) - 97;
        const row = coord.charCodeAt(1) - 97;
        if (col < 0 || row < 0) continue;
        out.push({ pos: { col, row }, kind: "LB", label });
      } else {
        if (v.length !== 2) continue;
        const coord = v.toLowerCase();
        const col = coord.charCodeAt(0) - 97;
        const row = coord.charCodeAt(1) - 97;
        if (col < 0 || row < 0) continue;
        out.push({ pos: { col, row }, kind });
      }
    }
    return out;
  }

  // ============ 内部: トークナイザ ============

  private tokenize(text: string): Token[] {
    const tokens: Token[] = [];
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
        while (i < text.length && /[A-Z]/.test(text[i] ?? "")) {
          ident += text[i];
          i++;
        }
        const values: string[] = [];
        while (i < text.length && text[i] === "[") {
          let value = "";
          i++;
          while (i < text.length && text[i] !== "]") {
            if (text[i] === "\\" && i + 1 < text.length) {
              value += text[i + 1] ?? "";
              i += 2;
            } else {
              value += text[i] ?? "";
              i++;
            }
          }
          if (i < text.length && text[i] === "]") i++;
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

  private extractInner(rawText: string): string {
    const openIdx = rawText.indexOf("(");
    const closeIdx = rawText.lastIndexOf(")");
    if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
      return rawText;
    }
    return rawText.slice(openIdx + 1, closeIdx);
  }

  // ============ 内部: エクスポータ補助 ============

  private toCoord(n: number): string {
    return String.fromCharCode(97 + n);
  }

  private escapeValue(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
  }

  private markerPropsToString(markers: BoardMarker[] | undefined): string {
    if (!markers || markers.length === 0) return "";
    const groupedElist: Partial<Record<Exclude<MarkerKind, "LB">, Position[]>> = {};
    const labels: BoardMarker[] = [];
    for (const m of markers) {
      if (m.kind === "LB") {
        labels.push(m);
      } else {
        const list = groupedElist[m.kind] ?? [];
        list.push(m.pos);
        groupedElist[m.kind] = list;
      }
    }
    let out = "";
    for (const kind of MARKER_PROPERTIES) {
      if (kind === "LB") {
        if (labels.length === 0) continue;
        const items = labels
          .map((m) => {
            const coord = `${this.toCoord(m.pos.col)}${this.toCoord(m.pos.row)}`;
            const safe = (m.label ?? "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
            return `[${coord}:${safe}]`;
          })
          .join("");
        out += `LB${items}`;
        continue;
      }
      const points = groupedElist[kind];
      if (!points || points.length === 0) continue;
      const coords = points
        .map((p) => `[${this.toCoord(p.col)}${this.toCoord(p.row)}]`)
        .join("");
      out += `${kind}${coords}`;
    }
    return out;
  }
}
