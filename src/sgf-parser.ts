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

    // 置石位置（AB: Add Black）の解析
    const addBlackMatches = sgfText.match(/AB(?:\[[a-z]{2}\])+/gi);
    if (addBlackMatches) {
      console.log('置石情報:', addBlackMatches);
      gameInfo.handicapPositions = [];
      
      addBlackMatches.forEach(match => {
        const coordinates = match.match(/\[([a-z]{2})\]/g);
        if (coordinates) {
          coordinates.forEach(coord => {
            const clean = coord.slice(1, -1); // [cc] → cc
            const col = clean.charCodeAt(0) - 97;
            const row = clean.charCodeAt(1) - 97;
            gameInfo.handicapPositions!.push({ col, row });
            console.log('置石位置:', col, row);
          });
        }
      });

      // 置石がある場合は白番から開始
      if (gameInfo.handicapPositions.length > 0) {
        gameInfo.startColor = 2;
        console.log('白番開始に設定');
      }
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
    if (state.handicapStones > 0) {
      sgf += `HA[${state.handicapStones}]`;

      // 置石位置を記録（AB: Add Black）
      if (state.handicapPositions.length > 0) {
        const handicapCoords = state.handicapPositions
          .map(pos => `[${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}]`)
          .join('');
        sgf += `AB${handicapCoords}`;
      }
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

      console.log(`圧縮前: ${sgfData.length}文字 → 圧縮後: ${compressed.length}文字`);
      return compressed;
    } catch (error) {
      console.error('圧縮エラー:', error);
      return sgfData;
    }
  }

  // ============ URL共有用エンコード ============
  encodeForURL(sgfData: string): string {
    try {
      return btoa(sgfData);
    } catch (error) {
      console.error('URL エンコードエラー:', error);
      return '';
    }
  }

  // ============ URL共有用デコード ============
  decodeFromURL(encodedData: string): string {
    try {
      return atob(encodedData);
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