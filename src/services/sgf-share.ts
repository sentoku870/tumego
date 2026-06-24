// ============ SGF 共有 ============
// URL/Base64/圧縮/URL シェア生成/URL からの読み込みを担当する。
// 内部で SGFParser を参照して SGF テキストの解析を行う。
import { SGFParser } from '../sgf-parser.js';
import { SGFParseResult } from '../types.js';

export class SGFShare {
  constructor(private readonly parser: SGFParser) {}

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
        const sgfData = this.decodeFromURL(sgfParam);
        const result = this.parser.parse(sgfData);

        // URL パラメータをクリア（履歴を汚さない）
        if (window.history && window.history.replaceState) {
          const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({}, document.title, newURL);
        }

        return result;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}
