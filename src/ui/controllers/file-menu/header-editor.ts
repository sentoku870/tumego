// ============ HeaderEditor ============
// ファイルメニュー内の「対局情報」編集 UI を担当する。
// タイトル・対局者・コミ・結果の DOM 入力フィールドと GameStore.gameInfo を
// 双方向に同期する。GameStore / Renderer / UIEventBus に依存。
import { GameInfo } from '../../../types.js';
import { GameStore } from '../../../state/game-store.js';
import { Renderer } from '../../../renderer/renderer.js';
import { UIEventBus } from '../../../app/event-bus.js';

export class HeaderEditor {
  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly eventBus: UIEventBus
  ) {}

  /** DOM フィールドを state.gameInfo から初期化する */
  populateFields(): void {
    const headerTitleInput = document.getElementById('header-title') as HTMLInputElement | null;
    const headerBlackInput = document.getElementById('header-black') as HTMLInputElement | null;
    const headerWhiteInput = document.getElementById('header-white') as HTMLInputElement | null;
    const headerKomiInput = document.getElementById('header-komi') as HTMLInputElement | null;
    const headerResultInput = document.getElementById('header-result') as HTMLInputElement | null;

    if (!headerTitleInput || !headerBlackInput || !headerWhiteInput || !headerKomiInput || !headerResultInput) {
      return;
    }

    const info = this.store.getGameInfo();
    headerTitleInput.value = info.title ?? '';
    headerBlackInput.value = info.playerBlack ?? '';
    headerWhiteInput.value = info.playerWhite ?? '';
    headerKomiInput.value = info.komi !== null && info.komi !== undefined ? String(info.komi) : '';
    headerResultInput.value = info.result ?? '';
  }

  /** イベントリスナーをバインドする */
  bindEvents(): void {
    const headerApplyBtn = document.getElementById('btn-header-apply') as HTMLButtonElement | null;
    const headerResetBtn = document.getElementById('btn-header-reset') as HTMLButtonElement | null;

    headerApplyBtn?.addEventListener('click', () => this.applyFromFields());
    headerResetBtn?.addEventListener('click', () => this.resetGameInfo());
  }

  /**
   * 「対局情報リセット」ボタン: store の対局情報をクリアし、DOM も再描画する。
   *
   * 旧実装は populateFields() を呼ぶだけだったため、store の値を DOM に
   * 書き戻す「再表示」になり、リセットになっていなかった。
   * SGF 棋譜を読込んだ後に押しても対局情報が消えないバグの修正。
   */
  private resetGameInfo(): void {
    this.store.resetGameInfo();
    this.populateFields();
    this.eventBus.emitUIUpdate();
    this.renderer.showMessage('対局情報をリセットしました');
  }

  /** DOM フィールドから読み取って store.updateGameInfo() に反映する */
  private applyFromFields(): void {
    const headerTitleInput = document.getElementById('header-title') as HTMLInputElement | null;
    const headerBlackInput = document.getElementById('header-black') as HTMLInputElement | null;
    const headerWhiteInput = document.getElementById('header-white') as HTMLInputElement | null;
    const headerKomiInput = document.getElementById('header-komi') as HTMLInputElement | null;
    const headerResultInput = document.getElementById('header-result') as HTMLInputElement | null;

    const patch: Partial<GameInfo> = {
      title: headerTitleInput?.value.trim() ?? '',
      playerBlack: headerBlackInput?.value.trim() || null,
      playerWhite: headerWhiteInput?.value.trim() || null,
      result: headerResultInput?.value.trim() || null,
    };

    const komiRaw = headerKomiInput?.value.trim();
    if (komiRaw) {
      const parsed = parseFloat(komiRaw);
      if (!Number.isNaN(parsed)) {
        patch.komi = parsed;
      }
    }

    this.store.updateGameInfo(patch);
    this.eventBus.emitUIUpdate();
    this.renderer.showMessage('対局情報を更新しました');
    this.populateFields();
  }
}
