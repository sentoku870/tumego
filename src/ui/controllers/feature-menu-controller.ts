// ============ FeatureMenuController (Facade) ============
// 「機能」メニュー (レイアウト切替/盤面回転/解答コピー) の
// イベントバインドとフロー制御を担当する。
// 個別の責務は AnswerCopy に分離。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements } from '../../types.js';
import { OutsideClickListener } from '../../services/outside-click-listener.js';
import { DropdownManager } from './dropdown-manager.js';
import { UIEventBus } from '../../app/event-bus.js';
import { AnswerCopy } from './feature-menu/answer-copy.js';

export type UIUpdater = () => void;

export class FeatureMenuController {
  private isHorizontal = document.body.classList.contains('horizontal');
  private copyAnswerButton: HTMLButtonElement | null = null;
  private readonly answerCopy: AnswerCopy;
  private unsubscribeOutsideClick: (() => void) | null = null;

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly renderer: Renderer,
    private readonly elements: UIElements,
    private readonly store: GameStore,
    sgfService: SGFService,
    private readonly eventBus: UIEventBus
  ) {
    this.answerCopy = new AnswerCopy(store, renderer, sgfService);
  }

  initialize(): void {
    const featureBtn = document.getElementById('btn-feature') as HTMLButtonElement | null;
    const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
    const featureLayoutBtn = document.getElementById('btn-feature-layout');
    const featureRotateBtn = document.getElementById('btn-feature-rotate');
    this.copyAnswerButton = document.getElementById('feature-copy-answer-sequence') as HTMLButtonElement | null;

    if (featureLayoutBtn) {
      featureLayoutBtn.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
    }

    featureBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const fileDropdown = document.getElementById('file-dropdown') as HTMLElement | null;
      const isOpen = featureDropdown?.classList.contains('show');
      this.dropdownManager.hide(fileDropdown);
      if (featureDropdown && featureBtn) {
        if (isOpen) {
          this.dropdownManager.hide(featureDropdown);
        } else {
          this.dropdownManager.open(featureBtn, featureDropdown);
        }
      }
    });

    if (featureDropdown) {
      const listener = new OutsideClickListener();
      this.unsubscribeOutsideClick = listener.subscribe(
        [featureDropdown],
        () => this.dropdownManager.hide(featureDropdown)
      );
    }

    featureDropdown?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    featureLayoutBtn?.addEventListener('click', () => {
      this.toggleLayout(featureLayoutBtn, featureDropdown);
    });

    featureRotateBtn?.addEventListener('click', () => {
      this.rotateBoard();
      this.dropdownManager.hide(featureDropdown);
    });

    this.copyAnswerButton?.addEventListener('click', () => {
      this.answerCopy.copy();
    });
  }

  /**
   * 登録した document-level リスナーを解放する。
   * HMR やテストで initialize() を再呼び出しする際に呼び出す
   * （2026-08-12 修正: B-10 リスナーリーク）。
   */
  dispose(): void {
    this.unsubscribeOutsideClick?.();
    this.unsubscribeOutsideClick = null;
  }

  /**
   * body.horizontal クラスから現在のレイアウト状態を再読込する。
   * 外部要因（CSS リロード、DevTools）でクラスが変わった場合に
   * 内部状態を同期する（2026-08-12 修正: B-12 isHorizontal 不整合）。
   * @returns 再読込後のレイアウト状態（true: 横レイアウト）
   */
  syncLayoutState(): boolean {
    this.isHorizontal = document.body.classList.contains('horizontal');
    return this.isHorizontal;
  }

  updateMenuState(): void {
    const state = this.store.snapshot;
    const enabled = this.answerCopy.shouldEnable(state);
    this.setButtonEnabled(this.copyAnswerButton, enabled);
  }

  private setButtonEnabled(button: HTMLButtonElement | null, enabled: boolean): void {
    if (!button) return;
    button.disabled = !enabled;
    button.classList.toggle('disabled', !enabled);
  }

  private toggleLayout(button: HTMLElement, dropdown: HTMLElement | null): void {
    this.isHorizontal = !this.isHorizontal;
    document.body.classList.toggle('horizontal', this.isHorizontal);
    button.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
    this.dropdownManager.hide(dropdown);
    this.renderer.updateBoardSize();
  }

  private rotateBoard(): void {
    const svg = this.elements.svg;
    const isRotated = svg.classList.contains('rotated');

    if (isRotated) {
      svg.classList.remove('rotated');
      this.renderer.showMessage('盤面を元に戻しました');
    } else {
      svg.classList.add('rotated');
      this.renderer.showMessage('盤面を180度回転しました');
    }
  }
}
