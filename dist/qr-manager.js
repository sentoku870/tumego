// ============ QRコード管理 ============
import { DEFAULT_CONFIG } from './types.js';
import { SGFParser } from './sgf-parser.js';
import { SGFShare } from './services/sgf-share.js';
import { Modal } from './ui/views/modal.js';
import { copyToClipboard as copyTextToClipboard } from './utils/clipboard.js';
const SHARE_URL_LENGTH_LIMIT = 2000;
export class QRManager {
    constructor(sgfParser = new SGFParser(), sgfShare = new SGFShare(this.sgfParser)) {
        this.sgfParser = sgfParser;
        this.sgfShare = sgfShare;
        this.currentShareMethodModal = null;
        this.currentQrModal = null;
    }
    // ============ ユーティリティ ============
    /**
     * 盤面状態に「共有すべき内容」が無いとみなせるかを判定する。
     * - sgfMoves に着手が無く
     * - 問題図もセットされておらず
     * - 置石も無く
     * - 盤上にも石が無い
     * 場合に true を返す。
     * 旧実装はエクスポート済み SGF の固定文字列と比較していたが、
     * 13/19 路盤や KM 付きの場合に誤って「空ではない」と判定していたため修正。
     */
    hasNoContent(state) {
        if (state.sgfMoves.length > 0)
            return false;
        if (state.problemDiagramSet)
            return false;
        if (state.handicapStones > 0)
            return false;
        const board = state.board;
        if (!Array.isArray(board))
            return true;
        for (const row of board) {
            if (!Array.isArray(row))
                continue;
            for (const cell of row) {
                if (cell !== 0)
                    return false;
            }
        }
        return true;
    }
    // ============ QRコード作成 ============
    createSGFQRCode(state) {
        try {
            if (this.hasNoContent(state)) {
                alert('SGFデータがありません。まず石を配置してください。');
                return;
            }
            const sgfData = this.sgfParser.export(state);
            this.showShareMethodSelection(sgfData);
        }
        catch (error) {
            console.error('QRコード作成エラー:', error);
            alert('エラー: ' + error.message);
        }
    }
    async createDiscordShareLink(state) {
        try {
            if (this.hasNoContent(state)) {
                alert('SGFデータがありません。まず石を配置してください。');
                return;
            }
            const sgfData = this.sgfParser.export(state);
            const shareURL = this.sgfShare.createShareURL(sgfData);
            if (shareURL.length > SHARE_URL_LENGTH_LIMIT) {
                alert('⚠️ データが大きすぎてURL形式では共有できません。\nSGFデータ直接方式を使用してください。');
                return;
            }
            const defaultLabel = this.buildDefaultDiscordLabel(state);
            const labelInput = prompt('Discordに表示する文字列を入力してください', defaultLabel);
            if (labelInput === null) {
                return;
            }
            const label = labelInput.trim();
            if (!label) {
                alert('共有テキストが空です。もう一度入力してください。');
                return;
            }
            const markdownLink = `[${label}](${shareURL})`;
            try {
                await copyTextToClipboard(markdownLink);
            }
            catch (error) {
                console.error('Discord共有リンクのクリップボード書き込みに失敗:', error);
            }
            alert(`Discord共有用のリンクをコピーしました！\n\n${markdownLink}`);
        }
        catch (error) {
            console.error('Discord共有リンク作成エラー:', error);
            alert('エラー: ' + error.message);
        }
    }
    // ============ 共有方法選択 ============
    showShareMethodSelection(sgfData) {
        var _a;
        (_a = this.currentShareMethodModal) === null || _a === void 0 ? void 0 : _a.close();
        this.currentShareMethodModal = null;
        const dataLength = sgfData.length;
        const root = document.createElement('div');
        root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">📱 共有方法を選択</h2>
      <p style="margin-bottom:25px; color:#666;">SGFデータ（${dataLength}文字）をどの形式で共有しますか？</p>
      <div style="margin:20px 0;">
        <button id="share-auto-load" style="display:block; width:100%; margin:10px 0; padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🌐 自動表示QR（読み取ると碁盤が開く）</button>
        <button id="share-direct-sgf" style="display:block; width:100%; margin:10px 0; padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 SGFデータQR（データをコピー）</button>
      </div>
      <div style="font-size:12px; color:#999; margin-top:15px;">
        自動表示: QRコードを読み取ると直接碁盤が表示<br>
        SGFデータ: QRコードからSGFデータを取得して手動で貼り付け
      </div>
    `;
        const autoLoadBtn = root.querySelector('#share-auto-load');
        autoLoadBtn === null || autoLoadBtn === void 0 ? void 0 : autoLoadBtn.addEventListener('click', () => {
            var _a;
            (_a = this.currentShareMethodModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentShareMethodModal = null;
            this.createAutoLoadQR(sgfData);
        });
        const directSgfBtn = root.querySelector('#share-direct-sgf');
        directSgfBtn === null || directSgfBtn === void 0 ? void 0 : directSgfBtn.addEventListener('click', () => {
            var _a;
            (_a = this.currentShareMethodModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentShareMethodModal = null;
            this.createDirectSGFQR(sgfData);
        });
        this.currentShareMethodModal = new Modal({
            id: 'share-method-popup',
            content: root,
            overlayOpacity: 0.8,
            maxWidth: '500px',
        });
        this.currentShareMethodModal.open();
    }
    // ============ 自動表示QR作成 ============
    createAutoLoadQR(sgfData) {
        const shareURL = this.sgfShare.createShareURL(sgfData);
        if (shareURL.length > SHARE_URL_LENGTH_LIMIT) {
            alert('⚠️ データが大きすぎてURL形式では共有できません。\nSGFデータ直接方式を使用します。');
            this.createDirectSGFQR(sgfData);
            return;
        }
        const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&data=${encodeURIComponent(shareURL)}`;
        this.showQRCodePopup(qrURL, shareURL, '🌐 自動表示QRコード', '読み取ると自動的にブラウザで碁盤が開きます！');
    }
    // ============ 直接SGF QR作成 ============
    createDirectSGFQR(sgfData) {
        const dataLength = sgfData.length;
        let qrSize, errorCorrectionLevel, warningMessage = '';
        if (dataLength <= DEFAULT_CONFIG.QR_DATA_SMALL) {
            qrSize = DEFAULT_CONFIG.QR_IMAGE_SMALL;
            errorCorrectionLevel = 'M';
        }
        else if (dataLength <= DEFAULT_CONFIG.QR_DATA_MEDIUM) {
            qrSize = DEFAULT_CONFIG.QR_IMAGE_MEDIUM;
            errorCorrectionLevel = 'L';
        }
        else if (dataLength <= DEFAULT_CONFIG.QR_DATA_LARGE) {
            qrSize = DEFAULT_CONFIG.QR_IMAGE_LARGE;
            errorCorrectionLevel = 'L';
            warningMessage = '⚠️ データが大きいため、ハイエンドスマホでの読み取りを推奨します';
        }
        else {
            alert('データが大きすぎます。SGFファイルとして保存することをお勧めします。');
            return;
        }
        const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&ecc=${errorCorrectionLevel}&data=${encodeURIComponent(sgfData)}`;
        this.showQRCodePopup(qrURL, sgfData, '📱 SGFデータQRコード', warningMessage || 'QRコードを読み取ってSGFデータをコピーしてください');
    }
    // ============ QRコードポップアップ表示 ============
    showQRCodePopup(qrURL, data, title, description) {
        var _a;
        (_a = this.currentQrModal) === null || _a === void 0 ? void 0 : _a.close();
        this.currentQrModal = null;
        const root = document.createElement('div');
        root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">${title}</h2>
      <p style="margin-bottom:20px; color:#666;">${description}</p>
      <div style="margin:20px 0;">
        <img src="${qrURL}" style="max-width:100%; max-height:70vh; border:2px solid #ddd; border-radius:10px;" alt="QR Code">
      </div>
      <div style="margin:20px 0;">
        <button id="qr-copy" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 データコピー</button>
        <button id="qr-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>
      </div>
    `;
        const copyBtn = root.querySelector('#qr-copy');
        copyBtn === null || copyBtn === void 0 ? void 0 : copyBtn.addEventListener('click', async () => {
            try {
                await copyTextToClipboard(data);
                alert('📋 データをクリップボードにコピーしました！');
            }
            catch (error) {
                console.error('コピー失敗:', error);
            }
        });
        const closeBtn = root.querySelector('#qr-close');
        closeBtn === null || closeBtn === void 0 ? void 0 : closeBtn.addEventListener('click', () => {
            var _a;
            (_a = this.currentQrModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentQrModal = null;
        });
        this.currentQrModal = new Modal({
            id: 'qr-popup',
            content: root,
            overlayOpacity: 0.85,
            maxWidth: '90%',
        });
        this.currentQrModal.open();
    }
    buildDefaultDiscordLabel(state) {
        const moveCount = state.sgfMoves ? state.sgfMoves.length : 0;
        const boardSize = state.boardSize || 9;
        const answer = state.answerMode === 'white' ? '白先' : '黒先';
        const prefix = state.problemDiagramSet ? '問題図' : '詰碁';
        return `${prefix} ${boardSize}路 ${moveCount}手 ${answer}`;
    }
}
//# sourceMappingURL=qr-manager.js.map