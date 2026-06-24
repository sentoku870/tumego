// ============ SGF 共有 ============
// URL/Base64 共有生成/URL からの読み込みを担当する。
// 内部で SGFParser を参照して SGF テキストの解析を行う。
import { SGFParser } from '../sgf-parser.js';
import { SGFParseResult } from '../types.js';

export class SGFShare {
  constructor(private readonly parser: SGFParser) {}

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
