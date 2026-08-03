// ============ FeatureMenuController (Facade) ============
// 「機能」メニュー (レイアウト切替/盤面回転/置石/解答コピー) の
// イベントバインドとフロー制御を担当する。
// 個別の責務は HandicapDialog / AnswerCopy に分離。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements } from '../../types.js';
import { DropdownManager } from './dropdown-manager.js';
import { UIEventBus } from '../../app/event-bus.js';
import { HandicapDialog } from './feature-menu/handicap-dialog.js';
import { AnswerCopy } from './feature-menu/answer-copy.js';

export type UIUpdater = () => void;

export class FeatureMenuController {
  private isHorizontal = document.body.classList.contains('horizontal');
  private copyAnswerButton: HTMLButtonElement | null = null;
  private readonly handicapDialog: HandicapDialog;
  private readonly answerCopy: AnswerCopy;

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly renderer: Renderer,
    private readonly elements: UIElements,
    private readonly store: GameStore,
    sgfService: SGFService,
    private readonly eventBus: UIEventBus
  ) {
    this.handicapDialog = new HandicapDialog(store, renderer, eventBus);
    this.answerCopy = new AnswerCopy(store, renderer, sgfService);
  }

  initialize(): void {
    const featureBtn = document.getElementById('btn-feature') as HTMLButtonElement | null;
    const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
    const featureLayoutBtn = document.getElementById('btn-feature-layout');
    const featureRotateBtn = document.getElementById('btn-feature-rotate');
    const featureHandicapBtn = document.getElementById('btn-feature-handicap');
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

    document.addEventListener('click', () => {
      this.dropdownManager.hide(featureDropdown);
    });

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

    featureHandicapBtn?.addEventListener('click', () => {
      this.dropdownManager.hide(featureDropdown);
      this.handicapDialog.show();
    });

    this.copyAnswerButton?.addEventListener('click', () => {
      this.answerCopy.copy();
    });
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
