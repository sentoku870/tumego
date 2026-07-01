// ============ SGF I/O ============
// ファイル・クリップボード経由の SGF 読み書きを担当する。
// 内部で SGFParser を参照して SGF テキストの解析/出力を行う。
import { SGFParser } from '../sgf-parser.js';
import { SGFParseResult } from '../types.js';
import { copyToClipboard } from '../utils/clipboard.js';

export class SGFIO {
  constructor(private readonly parser: SGFParser) {}

  // ============ ファイル読み込み ============
  async loadFromFile(file: File): Promise<SGFParseResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const result = this.parser.parse(reader.result as string);
          resolve(result);
        } catch (error) {
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

      const result = this.parser.parse(text);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async copyToClipboard(sgfData: string): Promise<void> {
    await copyToClipboard(sgfData);
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
        const showSaveFilePicker = (window as Window & {
          showSaveFilePicker?: (options?: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (data: string) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }).showSaveFilePicker;
        if (showSaveFilePicker) {
          const fileHandle = await showSaveFilePicker({
            suggestedName: finalFilename,
            types: [{
              description: 'SGF files',
              accept: { 'application/x-go-sgf': ['.sgf'] }
            }]
          });

          const writable = await fileHandle.createWritable();
          await writable.write(sgfData);
          await writable.close();
        }
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
      }
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name !== 'AbortError') {
        throw error;
      }
    }
  }
}
