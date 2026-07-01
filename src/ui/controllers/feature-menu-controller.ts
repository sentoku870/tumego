import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements } from '../../types.js';
import { DropdownManager } from './dropdown-manager.js';
import { UIEventBus } from '../../app/event-bus.js';
import { Modal } from '../views/modal.js';
import { copyToClipboard } from '../../utils/clipboard.js';

export type UIUpdater = () => void;

export class FeatureMenuController {
  private isHorizontal = document.body.classList.contains('horizontal');
  private copyAnswerButton: HTMLButtonElement | null = null;
  private currentHandicapModal: Modal | null = null;

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly renderer: Renderer,
    private readonly elements: UIElements,
    private readonly store: GameStore,
    private readonly sgfService: SGFService,
    private readonly eventBus: UIEventBus
  ) {}

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
      this.showHandicapDialog();
    });

    this.copyAnswerButton?.addEventListener('click', async () => {
      const state = this.store.snapshot;

      if (!state.numberMode) {
        this.renderer.showMessage('解答モード中のみ使用できます');
        return;
      }

      const sequence = this.sgfService.buildAnswerSequence(state);

      if (!sequence) {
        this.renderer.showMessage('解答手順がありません');
        return;
      }

      const spoilerText = `||${sequence}||`;

      try {
        await copyToClipboard(spoilerText);
        this.renderer.showMessage('解答手順をクリップボードにコピーしました');
        return;
      } catch (error) {
        // 失敗時は SGF テキスト欄にフォールバック
      }

      const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
      if (sgfTextarea) {
        sgfTextarea.value = spoilerText;
      }
      this.renderer.showMessage('解答手順をクリップボードにコピーできなかったため、SGFテキスト欄に出力しました');
    });
  }

  updateMenuState(): void {
    const state = this.store.snapshot;
    const hasAnswerMoves =
      state.numberMode === true && (state.sgfIndex ?? 0) > (state.numberStartIndex ?? 0);

    this.setButtonEnabled(this.copyAnswerButton, hasAnswerMoves);
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

  private showHandicapDialog(): void {
    this.currentHandicapModal?.close();
    this.currentHandicapModal = null;

    const root = document.createElement('div');
    root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
      <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
      <div id="handicap-options" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;"></div>
      <button id="handicap-cancel" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
    `;

    const options = [
      { label: '互先（コミあり）', value: 'even' as const },
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

    const optionContainer = root.querySelector('#handicap-options');
    options.forEach(option => {
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
        this.setHandicap(option.value);
        this.currentHandicapModal?.close();
        this.currentHandicapModal = null;
      });
      optionContainer?.appendChild(button);
    });

    root.querySelector('#handicap-cancel')?.addEventListener('click', () => {
      this.currentHandicapModal?.close();
      this.currentHandicapModal = null;
    });

    this.currentHandicapModal = new Modal({
      id: 'handicap-popup',
      content: root,
      overlayOpacity: 0.8,
      maxWidth: '500px',
    });
    this.currentHandicapModal.open();
  }

  private setHandicap(stones: number | 'even'): void {
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
