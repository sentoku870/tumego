// ============ SGF処理エンジン ============
import { GameState, Move, Position, SGFParseResult, DEFAULT_CONFIG } from './types.js';

export class SGFParser {
  // ============ SGF解析 ============
  parse(sgfText: string): SGFParseResult {
    console.log('SGF解析開始:', sgfText);
    
    const moves: Move[] = [];
    const gameInfo: Partial<GameState> = {};

    // 盤サイズの解析
    const sizeMatch = sgfText.match(/SZ\[(\d+)\]/i);
    if (sizeMatch) {
      gameInfo.boardSize = parseInt(sizeMatch[1], 10);
      console.log('盤サイズ:', gameInfo.boardSize);
    }

    // 初期設定
    gameInfo.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    gameInfo.handicapStones = 0;
    gameInfo.handicapPositions = [];
    gameInfo.startColor = 1; // デフォルトは黒先

    // コミの解析
    const komiMatch = sgfText.match(/KM\[([0-9.]+)\]/i);
    if (komiMatch) {
      gameInfo.komi = parseFloat(komiMatch[1]);
      console.log('コミ:', gameInfo.komi);
    }

    // ハンディキャップ（置石数）の解析
    const handicapMatch = sgfText.match(/HA\[(\d+)\]/i);
    if (handicapMatch) {
      gameInfo.handicapStones = parseInt(handicapMatch[1], 10);
      console.log('置石数:', gameInfo.handicapStones);
    }

    const blackSetup: Position[] = [];
    const whiteSetup: Position[] = [];

    // 置石位置（AB: Add Black）の解析
    const addBlackMatches = sgfText.match(/AB(?:\[[a-z]{2}\])+/gi);
    if (addBlackMatches) {
      console.log('置石情報:', addBlackMatches);

      addBlackMatches.forEach(match => {
        const coordinates = match.match(/\[([a-z]{2})\]/g);
        if (coordinates) {
          coordinates.forEach(coord => {
            const clean = coord.slice(1, -1); // [cc] → cc
            const col = clean.charCodeAt(0) - 97;
            const row = clean.charCodeAt(1) - 97;
            blackSetup.push({ col, row });
            console.log('置石位置:', col, row);
          });
        }
      });
    }

    // 白石初期配置（AW: Add White）の解析
    const addWhiteMatches = sgfText.match(/AW(?:\[[a-z]{2}\])+/gi);
    if (addWhiteMatches) {
      console.log('初期白石情報:', addWhiteMatches);

      addWhiteMatches.forEach(match => {
        const coordinates = match.match(/\[([a-z]{2})\]/g);
        if (coordinates) {
          coordinates.forEach(coord => {
            const clean = coord.slice(1, -1);
            const col = clean.charCodeAt(0) - 97;
            const row = clean.charCodeAt(1) - 97;
            whiteSetup.push({ col, row });
            console.log('初期白石位置:', col, row);
          });
        }
      });
    }

    if (blackSetup.length > 0) {
      if (gameInfo.handicapStones && gameInfo.handicapStones > 0) {
        gameInfo.handicapPositions = blackSetup;
        gameInfo.startColor = 2;
        console.log('白番開始に設定');
      } else {
        gameInfo.problemDiagramBlack = blackSetup;
      }
    }

    if (whiteSetup.length > 0) {
      gameInfo.problemDiagramWhite = whiteSetup;
    }

    if ((gameInfo.problemDiagramBlack && gameInfo.problemDiagramBlack.length > 0) ||
        (gameInfo.problemDiagramWhite && gameInfo.problemDiagramWhite.length > 0)) {
      gameInfo.problemDiagramSet = true;
    }

    // 着手の解析
    const moveMatches = sgfText.matchAll(/;([BW])\[([a-z]{2})\]/g);
    for (const match of moveMatches) {
      const color = match[1] === 'B' ? 1 : 2;
      const col = match[2].charCodeAt(0) - 97;
      const row = match[2].charCodeAt(1) - 97;
      moves.push({ col, row, color: color as 1 | 2 });
    }

    console.log('解析完了 - 着手数:', moves.length, '置石数:', gameInfo.handicapPositions?.length || 0);
    return { moves, gameInfo };
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
    console.log('SGF出力:', sgf);
    return sgf;
  }

  // ============ URL共有用エンコード ============
  encodeForURL(sgfData: string): string {
    try {
      return encodeURIComponent(btoa(sgfData));
    } catch (error) {
      console.error('URL エンコードエラー:', error);
      return '';
    }
  }

  // ============ URL共有用デコード ============
  decodeFromURL(encodedData: string): string {
    try {
      return atob(decodeURIComponent(encodedData));
    } catch (error) {
      console.error('URL デコードエラー:', error);
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
          console.log(`ファイル読み込み完了: ${result.moves.length}手`);
          resolve(result);
        } catch (error) {
          console.error('SGF読み込みエラー:', error);
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
      console.log('クリップボードからSGF読み込み完了');
      return result;
    } catch (error) {
      console.error('クリップボードの読み込みに失敗:', error);
      throw error;
    }
  }

  async copyToClipboard(sgfData: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(sgfData);
      console.log('SGF をクリップボードにコピーしました');
    } catch (error) {
      console.error('クリップボードコピー失敗:', error);
      throw error;
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
        console.log('SGFファイルを保存しました');
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
        console.log('SGFファイルをダウンロードしました');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('SGF保存エラー:', error);
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
        console.log('URL SGFパラメータ発見');
        const sgfData = this.decodeFromURL(sgfParam);
        const result = this.parse(sgfData);
        
        // URL パラメータをクリア（履歴を汚さない）
        if (window.history && window.history.replaceState) {
          const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({}, document.title, newURL);
        }
        
        console.log(`URL からSGF読み込み完了: ${result.moves.length}手`);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('URL からのSGF読み込みエラー:', error);
      return null;
    }
  }
}