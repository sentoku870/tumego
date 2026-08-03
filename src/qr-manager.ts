// ============ QR / 共有サービス ============
// SGF データの共有 (QR / Discord / URL) を担当する。
// UI (モーダル) は ShareModal に分離し、サービス層は状態判定と
// データ生成・変換に専念する。
import { DEFAULT_CONFIG, GameState } from './types.js';
import { SGFParser } from './sgf-parser.js';
import { SGFShare } from './services/sgf-share.js';
import { ShareModal } from './services/share/share-modal.js';
import { copyToClipboard as copyTextToClipboard } from './utils/clipboard.js';

const SHARE_URL_LENGTH_LIMIT = 2000;

export class QRManager {
  constructor(
    private readonly sgfParser: SGFParser = new SGFParser(),
    private readonly sgfShare: SGFShare = new SGFShare(this.sgfParser),
    private readonly shareModal: ShareModal = new ShareModal()
  ) {}

  // ============ ユーティリティ ============
  /**
   * 盤面状態に「共有すべき内容」が無いとみなせるかを判定する。
   * - sgfMoves に着手が無く
   * - 問題図もセットされておらず
   * - 置石も無く
   * - 盤上にも石が無い
   * 場合に true を返す。
   */
  private hasNoContent(state: GameState): boolean {
    if (state.sgfMoves.length > 0) return false;
    if (state.problemDiagramSet) return false;
    if (state.handicapStones > 0) return false;

    const board = state.board;
    if (!Array.isArray(board)) return true;
    for (const row of board) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (cell !== 0) return false;
      }
    }
    return true;
  }

  // ============ 公開 API ============
  createSGFQRCode(state: GameState): void {
    try {
      if (this.hasNoContent(state)) {
        alert('SGFデータがありません。まず石を配置してください。');
        return;
      }

      const sgfData = this.sgfParser.export(state);
      this.shareModal.promptShareMethod(sgfData, (method) => {
        if (method === 'auto') {
          this.createAutoLoadQR(sgfData);
        } else {
          this.createDirectSGFQR(sgfData);
        }
      });
    } catch (error) {
      console.error('QRコード作成エラー:', error);
      alert('エラー: ' + (error as Error).message);
    }
  }

  async createDiscordShareLink(state: GameState): Promise<void> {
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
      } catch (error) {
        console.error('Discord共有リンクのクリップボード書き込みに失敗:', error);
      }

      alert(`Discord共有用のリンクをコピーしました！\n\n${markdownLink}`);
    } catch (error) {
      console.error('Discord共有リンク作成エラー:', error);
      alert('エラー: ' + (error as Error).message);
    }
  }

  // ============ 内部: QR 生成 ============
  private createAutoLoadQR(sgfData: string): void {
    const shareURL = this.sgfShare.createShareURL(sgfData);

    if (shareURL.length > SHARE_URL_LENGTH_LIMIT) {
      alert('⚠️ データが大きすぎてURL形式では共有できません。\nSGFデータ直接方式を使用します。');
      this.createDirectSGFQR(sgfData);
      return;
    }

    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&data=${encodeURIComponent(shareURL)}`;
    this.shareModal.showQRCode(qrURL, shareURL, '🌐 自動表示QRコード', '読み取ると自動的にブラウザで碁盤が開きます！');
  }

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
    this.shareModal.showQRCode(qrURL, sgfData, '📱 SGFデータQRコード', warningMessage || 'QRコードを読み取ってSGFデータをコピーしてください');
  }

  private buildDefaultDiscordLabel(state: GameState): string {
    const moveCount = state.sgfMoves ? state.sgfMoves.length : 0;
    const boardSize = state.boardSize || 9;
    const answer = state.answerMode === 'white' ? '白先' : '黒先';
    const prefix = state.problemDiagramSet ? '問題図' : '詰碁';
    return `${prefix} ${boardSize}路 ${moveCount}手 ${answer}`;
  }
}
