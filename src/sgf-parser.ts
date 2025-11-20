// ============ SGF処理エンジン ============
import { GameState, Move, Position, SGFParseResult, DEFAULT_CONFIG } from './types.js';
import { debugLog } from './ui/debug-logger.js';

export class SGFParser {
  // ============ SGF解析 ============
  parse(sgfText: string): SGFParseResult {
    const rawText = sgfText.trim();
    debugLog.log(`SGF解析開始 (${rawText.length}文字)`);

    const moves: Move[] = [];
    const gameInfo: Partial<GameState> = {
      komi: DEFAULT_CONFIG.DEFAULT_KOMI,
      handicapStones: 0,
      handicapPositions: [],
      startColor: 1,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: []
    };

    // 盤サイズの解析
    const sizeMatch = rawText.match(/SZ\[(\d+)\]/i);
    if (sizeMatch) {
      gameInfo.boardSize = parseInt(sizeMatch[1], 10);
      debugLog.log(`盤サイズ検出: ${gameInfo.boardSize}`);
    }

    // コミの解析
    const komiMatch = rawText.match(/KM\[([0-9.]+)\]/i);
    if (komiMatch) {
      gameInfo.komi = parseFloat(komiMatch[1]);
      debugLog.log(`コミ検出: ${gameInfo.komi}`);
    }

    // ハンディキャップ（置石数）の解析
    const handicapMatch = rawText.match(/HA\[(\d+)\]/i);
    if (handicapMatch) {
      gameInfo.handicapStones = parseInt(handicapMatch[1], 10);
      debugLog.log(`置石数検出: ${gameInfo.handicapStones}`);
    }

    const initialBlack: Position[] = [];
    const initialWhite: Position[] = [];

    const collectSetup = (property: string, target: Position[]): void => {
      const pattern = new RegExp(`${property}(?:\\[[a-z]{2}\\])+`, 'gi');
      const matches = rawText.match(pattern);
      if (!matches) return;

      matches.forEach(match => {
        const coords = match.match(/\[([a-z]{2})\]/gi);
        if (!coords) return;

        coords.forEach(coord => {
          const clean = coord.slice(1, -1).toLowerCase();
          if (clean.length !== 2) return;
          const col = clean.charCodeAt(0) - 97;
          const row = clean.charCodeAt(1) - 97;
          if (col >= 0 && row >= 0) {
            target.push({ col, row });
            debugLog.log(`${property} 初期配置: col=${col}, row=${row}`);
          }
        });
      });
    };

    collectSetup('AB', initialBlack);
    collectSetup('AW', initialWhite);

    if (initialBlack.length > 0) {
      if ((gameInfo.handicapStones || 0) > 0) {
        gameInfo.handicapPositions = initialBlack;
        gameInfo.startColor = 2;
        debugLog.log('白番開始に設定');
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
        debugLog.log(`パス着手を検出: ${match[0]}`);
        continue;
      }
      const col = coord.charCodeAt(0) - 97;
      const row = coord.charCodeAt(1) - 97;
      if (col < 0 || row < 0) continue;
      debugLog.log(`ノード解析: 手数=${moves.length + 1} color=${color} col=${col} row=${row}`);
      moves.push({ col, row, color: color as 1 | 2 });
    }

    if (!handicapMatch && moves.length > 0 && !rawText.match(/PL\[(B|W)\]/i)) {
      gameInfo.startColor = moves[0].color;
    }

    const playerMatch = rawText.match(/PL\[(B|W)\]/i);
    if (playerMatch) {
      gameInfo.startColor = playerMatch[1].toUpperCase() === 'B' ? 1 : 2;
    }

    debugLog.log(`SGF解析完了 - 着手数: ${moves.length}, 置石数: ${gameInfo.handicapPositions?.length || 0}`);
    return { moves, gameInfo, rawSGF: rawText };
  }

  // ============ SGF出力 ============
  export(state: GameState): string {
    let sgf = `(;GM[1]FF[4]SZ[${state.boardSize}]KM[${state.komi}]`;

    // 置石がある場合はハンディキャップとして記録
    const treatAsHandicap = state.handicapStones > 0 && !state.problemDiagramSet;
    if (treatAsHandicap) {
      sgf += `HA[${state.handicapStones}]`;
    }

    const initialBlack = state.problemDiagramSet ? state.problemDiagramBlack : state.handicapPositions;
    if (initialBlack.length > 0) {
      const blackCoords = initialBlack
        .map(pos => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
        .join('');
      sgf += `AB${blackCoords}`;
    }

    if (state.problemDiagramSet && state.problemDiagramWhite.length > 0) {
      const whiteCoords = state.problemDiagramWhite
        .map(pos => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
        .join('');
      sgf += `AW${whiteCoords}`;
    }

    // 着手を記録
    for (const move of state.sgfMoves) {
      const color = move.color === 1 ? 'B' : 'W';
      const coord = `${String.fromCharCode(97 + move.col)}${String.fromCharCode(97 + move.row)}`;
      sgf += `;${color}[${coord}]`;
    }

    sgf += ')';
    debugLog.log(`SGF出力完了 (${state.sgfMoves.length}手, ${state.boardSize}路)`);
    return sgf;
  }

  // ============ SGFデータ圧縮 ============
  compress(sgfData: string): string {
    try {
      let compressed = sgfData
        .replace(/\s+/g, ' ')           // 複数の空白を1つに
        .replace(/\s*;\s*/g, ';')       // セミコロン周りの空白削除
        .replace(/\s*\[\s*/g, '[')      // 括弧周りの空白削除
        .replace(/\s*\]\s*/g, ']')
        .replace(/\s*\(\s*/g, '(')      // 丸括弧周りの空白削除
        .replace(/\s*\)\s*/g, ')')
        .trim();

      debugLog.log(`SGF圧縮: ${sgfData.length}文字 → ${compressed.length}文字`);
      return compressed;
    } catch (error) {
      debugLog.log(`圧縮エラー: ${(error as Error).message}`);
      return sgfData;
    }
  }

  // ============ URL共有用エンコード ============
  encodeForURL(sgfData: string): string {
    try {
      return btoa(sgfData);
    } catch (error) {
      debugLog.log(`URL エンコードエラー: ${(error as Error).message}`);
      return '';
    }
  }

  // ============ URL共有用デコード ============
  decodeFromURL(encodedData: string): string {
    try {
      return atob(encodedData);
    } catch (error) {
      debugLog.log(`URL デコードエラー: ${(error as Error).message}`);
      return '';
    }
  }

  // ============ ファイル読み込み ============
  async loadFromFile(file: File): Promise<SGFParseResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = this.parse(reader.result as string);
          debugLog.log(`ファイル読み込み完了: ${result.moves.length}手`);
          resolve(result);
        } catch (error) {
          debugLog.log(`SGF読み込みエラー: ${(error as Error).message}`);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('ファイル読み込みに失敗しました'));
      };
      
      reader.readAsText(file);
    });
  }

  // ============ クリップボード処理 ============
  async loadFromClipboard(): Promise<SGFParseResult> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        throw new Error('クリップボードにSGFがありません');
      }

      const result = this.parse(text);
      debugLog.log(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
      return result;
    } catch (error) {
      debugLog.log(`クリップボード読み込み失敗: ${(error as Error).message}`);
      throw error;
    }
  }

  async copyToClipboard(sgfData: string): Promise<void> {
    const canUseClipboardApi = typeof navigator !== 'undefined' &&
                               navigator.clipboard &&
                               typeof navigator.clipboard.writeText === 'function';

    if (canUseClipboardApi) {
      try {
        await navigator.clipboard.writeText(sgfData);
        debugLog.log('SGF をクリップボードにコピーしました');
        return;
      } catch (error) {
        debugLog.log(`クリップボードAPIでのコピーに失敗。フォールバックを試みます: ${(error as Error).message}`);
      }
    }

    if (this.copyToClipboardFallback(sgfData)) {
      debugLog.log('フォールバックでクリップボードにコピーしました');
      return;
    }

    throw new Error('クリップボードにコピーできませんでした');
  }

  private copyToClipboardFallback(text: string): boolean {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.top = '0';
      textArea.style.left = '0';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (error) {
      debugLog.log(`フォールバックコピーに失敗: ${(error as Error).message}`);
      return false;
    }
  }

  // ============ ファイル保存 ============
  async saveToFile(sgfData: string, filename?: string): Promise<void> {
    const now = new Date();
    const timestamp = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0') + '_' +
                     String(now.getHours()).padStart(2, '0') + 
                     String(now.getMinutes()).padStart(2, '0');
    const defaultFilename = `${timestamp}.sgf`;
    const finalFilename = filename || defaultFilename;

    try {
      if ('showSaveFilePicker' in window) {
        // Modern File System Access API
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: finalFilename,
          types: [{
            description: 'SGF files',
            accept: { 'application/x-go-sgf': ['.sgf'] }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(sgfData);
        await writable.close();
        debugLog.log('SGFファイルを保存しました');
      } else {
        // Fallback: download via blob
        const blob = new Blob([sgfData], { type: 'application/x-go-sgf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        debugLog.log('SGFファイルをダウンロードしました');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        debugLog.log(`SGF保存エラー: ${(error as Error).message}`);
        throw error;
      }
    }
  }

  // ============ URL共有機能 ============
  createShareURL(sgfData: string, baseURL?: string): string {
    const compressed = this.encodeForURL(sgfData);
    const base = baseURL || 
                 (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
                   ? 'https://sentoku870.github.io/tumego/'
                   : window.location.origin + window.location.pathname);
    
    return base + '?sgf=' + compressed;
  }

  // ============ URL からSGF読み込み ============
  loadFromURL(): SGFParseResult | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sgfParam = urlParams.get('sgf');
      
      if (sgfParam) {
        debugLog.log('URL SGFパラメータ発見');
        const sgfData = this.decodeFromURL(sgfParam);
        const result = this.parse(sgfData);
        
        // URL パラメータをクリア（履歴を汚さない）
        if (window.history && window.history.replaceState) {
          const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({}, document.title, newURL);
        }

        debugLog.log(`URL からSGF読み込み完了: ${result.moves.length}手`);
        return result;
      }

      return null;
    } catch (error) {
      debugLog.log(`URL からのSGF読み込みエラー: ${(error as Error).message}`);
      return null;
    }
  }
}