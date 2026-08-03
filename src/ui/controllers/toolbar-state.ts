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
    if (!this.store.snapshot.eraseMode) {
      return;
    }
    this.store.setEraseMode(false);
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
        this.buttons.exitSolveBtn.title = '解答を中断して問題図の配置を編集モードで開きます';
      } else {
        this.buttons.exitSolveBtn.textContent = 'SGF配置';
        this.buttons.exitSolveBtn.title = '問題図から解答モード（SGF配置）を開始します';
      }
      this.buttons.exitSolveBtn.style.display = '';
    }
  }

  updateToolbarState(): void {
    this.buttons.ensureButtonRefs();
    this.updateFullResetVisibility();

    const state = this.store.snapshot;
    const isSolve = state.numberMode;
    const isMarker = state.markerMode;
    const hasHistorySnapshots = this.store.historyManager.getList().length > 0;

    this.setDisabled(this.buttons.undoBtn, !hasHistorySnapshots);

    if (isSolve) {
      this.disableEraseMode();
    }
    if (isMarker) {
      this.disableEraseMode();
    }
    this.setDisabled(this.buttons.eraseBtn, isSolve);
    this.setDisabled(this.buttons.altBtn, isSolve || isMarker);
    this.setDisabled(this.buttons.blackBtn, isSolve || isMarker);
    this.setDisabled(this.buttons.whiteBtn, isSolve || isMarker);

    this.setDisabled(this.buttons.answerBtn, !isSolve);
    if (this.buttons.exitSolveBtn) {
      this.buttons.exitSolveBtn.disabled = false;
    }

    // 編集モード用と解答モード用の 2 ボタン群を排他的に切替
    // 編集モード(isSolve=false): 黒配置・白配置 を表示、1手戻る・1手進む を非表示
    // 解答モード(isSolve=true) : 1手戻る・1手進む を表示、黒配置・白配置 を非表示
    const editGroupVisible = !isSolve;
    this.setVisible(this.buttons.blackBtn, editGroupVisible);
    this.setVisible(this.buttons.whiteBtn, editGroupVisible);
    this.setVisible(this.buttons.prevMoveBtn, !editGroupVisible);
    this.setVisible(this.buttons.nextMoveBtn, !editGroupVisible);

    // 非表示側の disabled は状態判定上意味を持たないが、
    // 内部ロジック (sgfIndex 範囲) は解答モード時にのみ活きるので常に評価しておく
    const hasPrevMove = state.sgfIndex > 0;
    const hasNextMove = state.sgfIndex < state.sgfMoves.length;
    this.setDisabled(this.buttons.prevMoveBtn, !hasPrevMove);
    this.setDisabled(this.buttons.nextMoveBtn, !hasNextMove);

    this.buttons.setActiveMarkerButton();
    this.setDisabled(this.buttons.markerClearBtn, !state.markers || state.markers.length === 0);

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
    const enableFullResetInSolve = prefs.solve.enableFullReset;

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

  private setVisible(button: HTMLButtonElement | null, visible: boolean): void {
    if (!button) {
      return;
    }
    button.style.display = visible ? '' : 'none';
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
