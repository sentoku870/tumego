// ============ QRコード管理 ============
import { GameState } from './types.js';
import { SGFParser } from './sgf-parser.js';

export class QRManager {
  private sgfParser: SGFParser;

  constructor() {
    this.sgfParser = new SGFParser();
  }

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

  // ============ 共有方法選択 ============
  private showShareMethodSelection(sgfData: string): void {
    const existing = document.getElementById('share-method-popup');
    existing?.remove();

    const dataLength = sgfData.length;
    const popup = document.createElement('div');
    popup.id = 'share-method-popup';
    popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">
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
          <button id="share-close" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
        </div>
      </div>
    `;

    // イベントリスナー
    popup.addEventListener('click', (e) => {
      if (e.target === popup.querySelector('div')) {
        popup.remove();
      }
    });

    popup.querySelector('#share-auto-load')?.addEventListener('click', () => {
      popup.remove();
      this.createAutoLoadQR(sgfData);
    });

    popup.querySelector('#share-direct-sgf')?.addEventListener('click', () => {
      popup.remove();
      this.createDirectSGFQR(sgfData);
    });

    popup.querySelector('#share-close')?.addEventListener('click', () => {
      popup.remove();
    });

    document.body.appendChild(popup);
  }

  // ============ 自動表示QR作成 ============
  private createAutoLoadQR(sgfData: string): void {
    const compressed = this.sgfParser.encodeForURL(sgfData);

    if (!compressed) {
      alert('SGFデータのエンコードに失敗しました。');
      return;
    }

    const baseURL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
      ? 'https://sentoku870.github.io/tumego/'
      : window.location.origin + window.location.pathname;
    const shareURL = baseURL + '?sgf=' + compressed;

    if (shareURL.length > 2000) {
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
    let qrSize, errorCorrectionLevel, warningMessage = '';

    if (dataLength <= 800) {
      qrSize = '300x300';
      errorCorrectionLevel = 'M';
    } else if (dataLength <= 1500) {
      qrSize = '400x400';
      errorCorrectionLevel = 'L';
    } else if (dataLength <= 2500) {
      qrSize = '500x500';
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
    const existing = document.getElementById('qr-popup');
    existing?.remove();

    const popup = document.createElement('div');
    popup.id = 'qr-popup';
    popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:15px; text-align:center; max-width:90%; max-height:90%; overflow:auto;">
          <h2 style="margin-bottom:20px; color:#333;">${title}</h2>
          <p style="margin-bottom:20px; color:#666;">${description}</p>
          <div style="margin:20px 0;">
            <img src="${qrURL}" style="max-width:100%; max-height:70vh; border:2px solid #ddd; border-radius:10px;" alt="QR Code">
          </div>
          <div style="margin:20px 0;">
            <button id="qr-copy" style="margin:5px; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">📋 データコピー</button>
            <button id="qr-close" style="margin:5px; padding:12px 20px; background:#f44336; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">❌ 閉じる</button>
          </div>
        </div>
      </div>
    `;

    // イベントリスナー
    popup.addEventListener('click', (e) => {
      if (e.target === popup.querySelector('div')) {
        popup.remove();
      }
    });

    popup.querySelector('#qr-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data);
        alert('📋 データをクリップボードにコピーしました！');
      } catch (error) {
        console.error('コピー失敗:', error);
        const textArea = document.createElement('textarea');
        textArea.value = data;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('📋 データをクリップボードにコピーしました！');
      }
    });

    popup.querySelector('#qr-close')?.addEventListener('click', () => {
      popup.remove();
    });

    document.body.appendChild(popup);
  }
}