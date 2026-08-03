// ============ AnswerCopy ============
// 解答シーケンスを Discord spoiler 形式 (||...||) でクリップボードへコピーする。
// 失敗時は SGF テキスト欄にフォールバックする。
import { GameStore } from '../../../state/game-store.js';
import { Renderer } from '../../../renderer/renderer.js';
import { SGFService } from '../../../services/sgf-service.js';
import { copyToClipboard } from '../../../utils/clipboard.js';

export class AnswerCopy {
  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly sgfService: SGFService
  ) {}

  /** 解答ボタンを活性化する条件: 解答モード && 着手あり */
  shouldEnable(state = this.store.snapshot): boolean {
    return state.numberMode === true && (state.sgfIndex ?? 0) > (state.numberStartIndex ?? 0);
  }

  /** 解答シーケンスをコピーする。戻り値は成功/失敗 */
  async copy(): Promise<boolean> {
    const state = this.store.snapshot;

    if (!state.numberMode) {
      this.renderer.showMessage('解答モード中のみ使用できます');
      return false;
    }

    const sequence = this.sgfService.buildAnswerSequence(state);
    if (!sequence) {
      this.renderer.showMessage('解答手順がありません');
      return false;
    }

    const spoilerText = `||${sequence}||`;

    try {
      await copyToClipboard(spoilerText);
      this.renderer.showMessage('解答手順をクリップボードにコピーしました');
      return true;
    } catch (error) {
      // 失敗時は SGF テキスト欄にフォールバック
    }

    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = spoilerText;
    }
    this.renderer.showMessage('解答手順をクリップボードにコピーできなかったため、SGFテキスト欄に出力しました');
    return false;
  }
}
