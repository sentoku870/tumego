// ============ HandicapDialog ============
// 置石設定用のモーダルダイアログを担当する。
// FeatureMenuController から分離し、独立してテスト・再利用できるようにする。
import { GameStore } from '../../../state/game-store.js';
import { Renderer } from '../../../renderer/renderer.js';
import { UIEventBus } from '../../../app/event-bus.js';
import { Modal } from '../../views/modal.js';

export type HandicapOption = number | 'even';

const HANDICAP_OPTIONS: Array<{ label: string; value: HandicapOption }> = [
  { label: '互先（コミあり）', value: 'even' },
  { label: '先（コミなし）', value: 0 },
  { label: '2子', value: 2 },
  { label: '3子', value: 3 },
  { label: '4子', value: 4 },
  { label: '5子', value: 5 },
  { label: '6子', value: 6 },
  { label: '7子', value: 7 },
  { label: '8子', value: 8 },
  { label: '9子', value: 9 }
];

export class HandicapDialog {
  private currentModal: Modal | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly eventBus: UIEventBus
  ) {}

  /** ダイアログを表示する */
  show(): void {
    this.currentModal?.close();
    this.currentModal = null;

    const root = document.createElement('div');
    root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
      <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
      <div id="handicap-options" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;"></div>
      <button id="handicap-cancel" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
    `;

    const optionContainer = root.querySelector('#handicap-options');
    HANDICAP_OPTIONS.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option.label;
      button.style.padding = '15px';
      button.style.background = option.value === 'even' ? '#2196F3' : option.value === 0 ? '#4CAF50' : '#FF9800';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '8px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '14px';
      button.addEventListener('click', () => {
        this.apply(option.value);
        this.currentModal?.close();
        this.currentModal = null;
      });
      optionContainer?.appendChild(button);
    });

    root.querySelector('#handicap-cancel')?.addEventListener('click', () => {
      this.currentModal?.close();
      this.currentModal = null;
    });

    this.currentModal = new Modal({
      id: 'handicap-popup',
      content: root,
      overlayOpacity: 0.8,
      maxWidth: '500px',
    });
    this.currentModal.open();
  }

  /** ダイアログを閉じる */
  close(): void {
    this.currentModal?.close();
    this.currentModal = null;
  }

  private apply(stones: HandicapOption): void {
    this.store.setHandicap(stones);
    this.eventBus.emitUIUpdate();

    if (stones === 'even') {
      this.renderer.showMessage('互先（黒番開始、コミ6.5目）に設定しました');
    } else if (stones === 0) {
      this.renderer.showMessage('先番（黒番開始、コミ0目）に設定しました');
    } else {
      this.renderer.showMessage(`${stones}子局（白番開始、コミ0目）に設定しました`);
    }
  }
}
