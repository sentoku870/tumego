// ============ ShareModal ============
// QR / SGF 共有 UI で使うモーダル表示を担当する。
// Modal (ui/views/modal.ts) をベースに、共有方法選択と QR コード表示の
// 2 種類のポップアップを提供する。サービス層 (qr-manager) から UI 層への
// 直接依存を解消するために分離。
import { Modal } from '../../ui/views/modal.js';
import { copyToClipboard as copyTextToClipboard } from '../../utils/clipboard.js';

export type ShareMethod = 'auto' | 'direct';

export class ShareModal {
  private currentShareMethodModal: Modal | null = null;
  private currentQrModal: Modal | null = null;

  /**
   * 共有方法選択モーダルを表示する。
   * ユーザーが選択した方法に対応するコールバックを呼び出す。
   * コールバックが指定されない場合は何も起こらない（モーダルを閉じた場合も同様）。
   */
  promptShareMethod(
    sgfData: string,
    onSelect: (method: ShareMethod) => void
  ): void {
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
      onSelect('auto');
    });

    const directSgfBtn = root.querySelector<HTMLButtonElement>('#share-direct-sgf');
    directSgfBtn?.addEventListener('click', () => {
      this.currentShareMethodModal?.close();
      this.currentShareMethodModal = null;
      onSelect('direct');
    });

    this.currentShareMethodModal = new Modal({
      id: 'share-method-popup',
      content: root,
      overlayOpacity: 0.8,
      maxWidth: '500px',
    });
    this.currentShareMethodModal.open();
  }

  /**
   * QR コードポップアップを表示する。
   * 「データコピー」ボタンでデータをクリップボードにコピー、
   * 「閉じる」ボタンでモーダルを閉じる。
   */
  showQRCode(qrURL: string, data: string, title: string, description: string): void {
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
        await copyTextToClipboard(data);
        alert('📋 データをクリップボードにコピーしました！');
      } catch (error) {
        console.error('コピー失敗:', error);
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

  /** すべてのモーダルを閉じる */
  closeAll(): void {
    this.currentShareMethodModal?.close();
    this.currentShareMethodModal = null;
    this.currentQrModal?.close();
    this.currentQrModal = null;
  }
}
