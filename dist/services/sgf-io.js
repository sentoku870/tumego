import { copyToClipboard } from '../utils/clipboard.js';
export class SGFIO {
    constructor(parser) {
        this.parser = parser;
    }
    // ============ ファイル読み込み ============
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const result = this.parser.parse(reader.result);
                    resolve(result);
                }
                catch (error) {
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
    async loadFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                throw new Error('クリップボードにSGFがありません');
            }
            const result = this.parser.parse(text);
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    async copyToClipboard(sgfData) {
        await copyToClipboard(sgfData);
    }
    // ============ ファイル保存 ============
    async saveToFile(sgfData, filename) {
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
                const showSaveFilePicker = window.showSaveFilePicker;
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
            }
            else {
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
        }
        catch (error) {
            const err = error;
            if (err.name !== 'AbortError') {
                throw error;
            }
        }
    }
}
//# sourceMappingURL=sgf-io.js.map