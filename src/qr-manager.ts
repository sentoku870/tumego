// ============ QRコード管理 ============
import { DEFAULT_CONFIG, GameState } from './types.js';
import { SGFParser } from './sgf-parser.js';
import { SGFShare } from './services/sgf-share.js';
import { Modal } from './ui/views/modal.js';

const SHARE_URL_LENGTH_LIMIT = 2000;

export class QRManager {
  private currentShareMethodModal: Modal | null = null;
  private currentQrModal: Modal | null = null;

  constructor(
    private readonly sgfParser: SGFParser = new SGFParser(),
    private readonly sgfShare: SGFShare = new SGFShare(this.sgfParser)
  ) {}

  // ============ QRコード作成 ============
  createSGFQRCode(state: GameState): void {
    try {
      const sgfData = this.sgfParser.export(state);

      if (!sgfData || sgfData.trim() === '' || sgfData === '(;GM[1]FF[4]SZ[9])') {
        alert('SGFデータがありません。まず石を配置してください。');
        return;
      }

      this.showShareMethodSelection(sgfData);
    } catch (error) {
      console.error('QRコード作成エラー:', error);
      alert('エラー: ' + (error as Error).message);
    }
  }

  async createDiscordShareLink(state: GameState): Promise<void> {
    try {
      const sgfData = this.sgfParser.export(state);

      if (!sgfData || sgfData.trim() === '' || sgfData === '(;GM[1]FF[4]SZ[9])') {
        alert('SGFデータがありません。まず石を配置してください。');
        return;
      }

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
        await navigator.clipboard.writeText(markdownLink);
      } catch (error) {
        this.copyToClipboardFallback(markdownLink);
      }

      alert(`Discord共有用のリンクをコピーしました！\n\n${markdownLink}`);
    } catch (error) {
      console.error('Discord共有リンク作成エラー:', error);
      alert('エラー: ' + (error as Error).message);
    }
  }

  // ============ 共有方法選択 ============
  private showShareMethodSelection(sgfData: string): void {
    this.currentShareMethodModal?.close();
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

    const autoLoadBtn = root.querySelector<HTMLButtonElement>('#share-auto-load');
    autoLoadBtn?.addEventListener('click', () => {
      this.currentShareMethodModal?.close();
      this.currentShareMethodModal = null;
      this.createAutoLoadQR(sgfData);
    });

    const directSgfBtn = root.querySelector<HTMLButtonElement>('#share-direct-sgf');
    directSgfBtn?.addEventListener('click', () => {
      this.currentShareMethodModal?.close();
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
  private createAutoLoadQR(sgfData: string): void {
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
  private createDirectSGFQR(sgfData: string): void {
    const dataLength = sgfData.length;
    let qrSize: string, errorCorrectionLevel: string, warningMessage = '';

    if (dataLength <= DEFAULT_CONFIG.QR_DATA_SMALL) {
      qrSize = DEFAULT_CONFIG.QR_IMAGE_SMALL;
      errorCorrectionLevel = 'M';
    } else if (dataLength <= DEFAULT_CONFIG.QR_DATA_MEDIUM) {
      qrSize = DEFAULT_CONFIG.QR_IMAGE_MEDIUM;
      errorCorrectionLevel = 'L';
    } else if (dataLength <= DEFAULT_CONFIG.QR_DATA_LARGE) {
      qrSize = DEFAULT_CONFIG.QR_IMAGE_LARGE;
      errorCorrectionLevel = 'L';
      warningMessage = '⚠️ データが大きいため、ハイエンドスマホでの読み取りを推奨します';
    } else {
      alert('データが大きすぎます。SGFファイルとして保存することをお勧めします。');
      return;
    }

    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&ecc=${errorCorrectionLevel}&data=${encodeURIComponent(sgfData)}`;
    this.showQRCodePopup(qrURL, sgfData, '📱 SGFデータQRコード', warningMessage || 'QRコードを読み取ってSGFデータをコピーしてください');
  }

  // ============ QRコードポップアップ表示 ============
  private showQRCodePopup(qrURL: string, data: string, title: string, description: string): void {
    this.currentQrModal?.close();
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

    const copyBtn = root.querySelector<HTMLButtonElement>('#qr-copy');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data);
        alert('📋 データをクリップボードにコピーしました！');
      } catch (error) {
        console.error('コピー失敗:', error);
        this.copyToClipboardFallback(data);
        alert('📋 データをクリップボードにコピーしました！');
      }
    });

    const closeBtn = root.querySelector<HTMLButtonElement>('#qr-close');
    closeBtn?.addEventListener('click', () => {
      this.currentQrModal?.close();
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

  private copyToClipboardFallback(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  private buildDefaultDiscordLabel(state: GameState): string {
    const moveCount = state.sgfMoves ? state.sgfMoves.length : 0;
    const boardSize = state.boardSize || 9;
    const answer = state.answerMode === 'white' ? '白先' : '黒先';
    const prefix = state.problemDiagramSet ? '問題図' : '詰碁';
    return `${prefix} ${boardSize}路 ${moveCount}手 ${answer}`;
  }
}
