// ============ ツールバー: 状態反映ヘルパ ============
// ボタンの有効/無効、表示テキスト、状態に応じたスタイル更新を担当する。
// イベントバインドは ToolbarButtons に分離。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { PreferencesStore } from '../../services/preferences-store.js';
import { UIEventBus } from '../../app/event-bus.js';
import { ToolbarButtons } from './toolbar-buttons.js';

export class ToolbarState {
  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly preferences: PreferencesStore,
    private readonly eventBus: UIEventBus,
    private readonly buttons: ToolbarButtons
  ) {}

  updateAll(): void {
    this.updateFullResetVisibility();
    this.updateToolbarState();
  }

  disableEraseMode(): void {
    const state = this.store.snapshot;
    if (!state.eraseMode) {
      return;
    }
    state.eraseMode = false;
    this.buttons.eraseBtn?.classList.remove('active');
    this.renderer.showMessage('');
  }

  updateAnswerButtonDisplay(): void {
    this.buttons.ensureButtonRefs();
    const state = this.store.snapshot;

    if (this.buttons.answerBtn) {
      if (state.answerMode === 'white') {
        this.buttons.answerBtn.textContent = '⚪ 白先';
        this.buttons.answerBtn.classList.add('white-mode');
      } else {
        this.buttons.answerBtn.textContent = '🔥 黒先';
        this.buttons.answerBtn.classList.remove('white-mode');
      }

      if (state.numberMode) {
        this.buttons.answerBtn.title =
          state.answerMode === 'white'
            ? 'この問題を白番から解答します'
            : 'この問題を黒番から解答します';
      } else {
        this.buttons.answerBtn.title = '解答モード中のみ使用できます';
      }
    }

    if (this.buttons.exitSolveBtn) {
      if (state.numberMode) {
        this.buttons.exitSolveBtn.textContent = '編集に戻る';
        this.buttons.exitSolveBtn.title = '解答を終了して編集モードに戻ります';
      } else {
        this.buttons.exitSolveBtn.textContent = '解答開始';
        this.buttons.exitSolveBtn.title = '問題図から解答モードを開始します';
      }
      this.buttons.exitSolveBtn.style.display = '';
    }
  }

  updateToolbarState(): void {
    this.buttons.ensureButtonRefs();
    this.updateFullResetVisibility();

    const state = this.store.snapshot;
    const isSolve = state.numberMode;
    const hasHistorySnapshots = this.store.historyManager.getList().length > 0;

    this.setDisabled(this.buttons.undoBtn, !hasHistorySnapshots);

    if (isSolve) {
      this.disableEraseMode();
    }
    this.setDisabled(this.buttons.eraseBtn, isSolve);
    this.setDisabled(this.buttons.altBtn, isSolve);
    this.setDisabled(this.buttons.blackBtn, isSolve);
    this.setDisabled(this.buttons.whiteBtn, isSolve);

    this.setDisabled(this.buttons.answerBtn, !isSolve);
    if (this.buttons.exitSolveBtn) {
      this.buttons.exitSolveBtn.disabled = false;
    }

    const hasPrevMove = state.sgfIndex > 0;
    const hasNextMove = state.sgfIndex < state.sgfMoves.length;
    this.setDisabled(this.buttons.prevMoveBtn, !hasPrevMove);
    this.setDisabled(this.buttons.nextMoveBtn, !hasNextMove);

    this.updateProblemButtonState();
    this.updateAnswerButtonDisplay();
  }

  updateFullResetVisibility(): void {
    if (!this.buttons.clearBtn) {
      this.buttons.clearBtn = document.getElementById('btn-clear') as HTMLButtonElement | null;
    }
    if (!this.buttons.clearBtn) {
      return;
    }

    const prefs = this.preferences.state;
    const isSolve = this.store.snapshot.numberMode;
    const enableFullResetInSolve = prefs.solve.enableFullReset === 'on';

    this.buttons.clearBtn.style.display = '';

    if (!isSolve) {
      this.buttons.clearBtn.disabled = false;
      this.buttons.clearBtn.title =
        '盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）';
    } else if (enableFullResetInSolve) {
      this.buttons.clearBtn.disabled = false;
      this.buttons.clearBtn.title =
        '解答中の盤面と履歴をすべて消して最初からやり直します（Undoはできません）';
    } else {
      this.buttons.clearBtn.disabled = true;
      this.buttons.clearBtn.title =
        '解答モード中の全消去はデフォルトで無効です（設定→「解答モードで全て消すボタンを有効にする」で変更できます）';
    }
  }

  private setDisabled(button: HTMLButtonElement | null, disabled: boolean): void {
    if (!button) {
      return;
    }
    button.disabled = disabled;
  }

  private updateProblemButtonState(): void {
    if (!this.buttons.problemBtn) {
      this.buttons.problemBtn = document.getElementById('btn-problem') as HTMLButtonElement | null;
    }
    if (!this.buttons.problemBtn) {
      return;
    }

    const isSolve = this.store.snapshot.numberMode;
    this.buttons.problemBtn.textContent = isSolve ? '🧩 初期図' : '🧩 問題図';
    this.buttons.problemBtn.title = isSolve
      ? '解答をすべて消して問題図の初期状態に戻します'
      : '現在の盤面を問題図として保存します';
    this.buttons.problemBtn.disabled = false;
  }
}
