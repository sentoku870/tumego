import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements } from '../../types.js';
import { DropdownManager } from './dropdown-manager.js';

export type UIUpdater = () => void;

export class FeatureMenuController {
  private isHorizontal = document.body.classList.contains('horizontal');

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly renderer: Renderer,
    private readonly elements: UIElements,
    private readonly store: GameStore,
    private readonly sgfService: SGFService,
    private readonly updateUI: UIUpdater
  ) {}

  initialize(): void {
    const featureBtn = document.getElementById('btn-feature') as HTMLButtonElement | null;
    const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
    const featureLayoutBtn = document.getElementById('btn-feature-layout');
    const featureRotateBtn = document.getElementById('btn-feature-rotate');
    const featureHandicapBtn = document.getElementById('btn-feature-handicap');
    const answerStepsBtn = document.getElementById('btn-answer-steps');

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

    answerStepsBtn?.addEventListener('click', async () => {
      const sequence = this.sgfService.buildAnswerSequence();
      if (!sequence) {
        this.renderer.showMessage('解答手順がありません');
        return;
      }

      const spoilerText = `||${sequence}||`;
      try {
        await this.sgfService.copyToClipboard(spoilerText);
        this.renderer.showMessage('解答手順をコピーしました');
      } catch (error) {
        console.error('解答手順コピー失敗', error);
        window.prompt('コピーに失敗しました。以下のテキストをコピーしてください。', spoilerText);
        this.renderer.showMessage('クリップボードにコピーできませんでした');
      }
    });
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
    const existing = document.getElementById('handicap-popup');
    existing?.remove();

    const popup = document.createElement('div');
    popup.id = 'handicap-popup';
    popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;">
          <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
          <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
          <div id="handicap-options" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;"></div>
          <button id="handicap-cancel" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
        </div>
      </div>
    `;

    const overlay = popup.firstElementChild as HTMLElement | null;
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) {
        popup.remove();
      }
    });

    const container = overlay?.firstElementChild as HTMLElement | null;
    container?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

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

    const optionContainer = popup.querySelector('#handicap-options');
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
        popup.remove();
      });
      optionContainer?.appendChild(button);
    });

    popup.querySelector('#handicap-cancel')?.addEventListener('click', () => {
      popup.remove();
    });

    document.body.appendChild(popup);
  }

  private setHandicap(stones: number | 'even'): void {
    this.store.setHandicap(stones);
    this.updateUI();

    if (stones === 'even') {
      this.renderer.showMessage('互先（黒番開始、コミ6.5目）に設定しました');
    } else if (stones === 0) {
      this.renderer.showMessage('先番（黒番開始、コミ0目）に設定しました');
    } else {
      this.renderer.showMessage(`${stones}子局（白番開始、コミ0目）に設定しました`);
    }
  }
}
