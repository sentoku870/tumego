import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer.js';
import { BoardCaptureService } from '../../services/board-capture-service.js';
import { UIElements, PlayMode } from '../../types.js';
import { UIUpdater } from './feature-menu-controller.js';
import { UIInteractionState } from '../state/ui-interaction-state.js';

export class ToolbarController {
  private playButtons: HTMLButtonElement[] = [];
  private answerButton: HTMLButtonElement | null = null;
  private navigationButtons: HTMLButtonElement[] = [];
  private reviewTurnButtons: HTMLButtonElement[] = [];
  private reviewTurnContainer: HTMLElement | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly elements: UIElements,
    private readonly updateUI: UIUpdater,
    private readonly uiState: UIInteractionState
  ) {}

  initialize(): void {
    this.initSizeButtons();
    this.initBasicButtons();
    this.initGameButtons();
    this.initBoardSaveButton();
    this.initReviewTurnButtons();
  }

  disableEraseMode(): void {
    const state = this.store.snapshot;
    if (!state.eraseMode) {
      return;
    }

    state.eraseMode = false;
    const eraseBtn = document.getElementById('btn-erase');
    eraseBtn?.classList.remove('active');
    this.renderer.showMessage('');
  }

  updateAnswerButtonDisplay(): void {
    const state = this.store.snapshot;
    const answerBtn = document.getElementById('btn-answer');
    if (!answerBtn) {
      return;
    }

    if (state.answerMode === 'white') {
      answerBtn.textContent = '⚪ 白先';
      answerBtn.classList.add('white-mode');
    } else {
      answerBtn.textContent = '🔥 黒先';
      answerBtn.classList.remove('white-mode');
    }
  }

  triggerButton(selector: string): void {
    const button = document.querySelector(selector) as HTMLElement | null;
    button?.click();
  }

  private initSizeButtons(): void {
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const element = btn as HTMLElement;
        const size = parseInt(element.dataset.size!, 10);
        const state = this.store.snapshot;
        if (size === state.boardSize) {
          return;
        }

        if (state.sgfMoves.length > 0 || state.handicapStones > 0) {
          this.store.historyManager.save(`${state.boardSize}路→${size}路変更前`, state);
        }

        this.store.initBoard(size);
        this.updateUI();
        this.setActiveButton(element, 'size-btn');
      });
    });
  }

  private initBasicButtons(): void {
    const clearBtn = document.getElementById('btn-clear');
    clearBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (state.sgfMoves.length > 0 || state.handicapStones > 0 ||
        state.board.some(row => row.some(cell => cell !== 0))) {
        this.store.historyManager.save(`全消去前（${state.sgfMoves.length}手）`, state);
      }

      this.disableEraseMode();
      this.store.initBoard(state.boardSize);
      this.updateUI();
      // ★ SGF入力エリアを空にする（追加行）
      (document.getElementById("sgf-text") as HTMLTextAreaElement).value = "";
    });

    const undoBtn = document.getElementById('btn-undo');
    undoBtn?.addEventListener('click', () => {
      this.store.undo();
      this.updateUI();
    });

    const eraseBtn = document.getElementById('btn-erase');
    eraseBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      state.eraseMode = !state.eraseMode;
      if (state.eraseMode) {
        eraseBtn.classList.add('active');
        this.renderer.showMessage('消去モード');
      } else {
        eraseBtn.classList.remove('active');
        this.renderer.showMessage('');
      }
    });

    const blackBtn = document.getElementById('btn-black') as HTMLButtonElement | null;
    blackBtn?.addEventListener('click', () => this.setMode('black', blackBtn!));

    const whiteBtn = document.getElementById('btn-white') as HTMLButtonElement | null;
    whiteBtn?.addEventListener('click', () => this.setMode('white', whiteBtn!));

    const altBtn = document.getElementById('btn-alt') as HTMLButtonElement | null;
    altBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      state.startColor = state.startColor === 1 ? 2 : 1;
      this.setMode('alt', altBtn!);
    });

    this.playButtons = [blackBtn, altBtn, whiteBtn].filter(
      (btn): btn is HTMLButtonElement => Boolean(btn)
    );
  }

  private initGameButtons(): void {
    const prevBtn = document.getElementById('btn-prev-move') as HTMLButtonElement | null;
    prevBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (this.store.appMode === 'solve') {
        const baseIndex = state.numberStartIndex;
        if (state.sgfIndex > baseIndex) {
          this.store.setMoveIndex(state.sgfIndex - 1);
          this.updateUI();
        }
        return;
      }

      if (state.sgfIndex > 0) {
        this.store.setMoveIndex(state.sgfIndex - 1);
        this.updateUI();
      }
    });

    const nextBtn = document.getElementById('btn-next-move') as HTMLButtonElement | null;
    nextBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (this.store.appMode === 'solve') {
        const maxIndex = state.numberStartIndex + state.solutionMoveList.length;
        if (state.sgfIndex < maxIndex) {
          this.store.setMoveIndex(state.sgfIndex + 1);
          this.updateUI();
        }
        return;
      }

      if (state.sgfIndex < state.sgfMoves.length) {
        this.store.setMoveIndex(state.sgfIndex + 1);
        this.updateUI();
      }
    });

    this.navigationButtons = [prevBtn, nextBtn].filter(
      (btn): btn is HTMLButtonElement => Boolean(btn)
    );

    const answerBtn = document.getElementById('btn-answer') as HTMLButtonElement | null;
    this.answerButton = answerBtn;
    answerBtn?.addEventListener('click', () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        if (state.sgfMoves.length > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
          this.store.historyManager.save(`黒先解答開始前（${state.sgfMoves.length}手）`, state);
        }
        state.answerMode = 'black';
        this.store.startNumberMode(1);
      } else if (state.answerMode === 'black') {
        state.answerMode = 'white';
        this.store.startNumberMode(2);
      } else {
        state.answerMode = 'black';
        this.store.startNumberMode(1);
      }

      this.updateAnswerButtonDisplay();
      this.updateUI();
    });

    const historyBtn = document.getElementById('btn-history');
    historyBtn?.addEventListener('click', () => {
      this.store.historyManager.showHistoryDialog((index) => {
        if (this.store.historyManager.restore(index, this.store.snapshot)) {
          this.updateUI();
          this.renderer.showMessage('履歴を復元しました');
        }
      });
    });

    const problemBtn = document.getElementById('btn-problem');
    problemBtn?.addEventListener('click', () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        if (state.sgfMoves.length > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
          this.store.historyManager.save(`問題図確定前（${state.sgfMoves.length}手）`, state);
        }

        this.store.setProblemDiagram();
        state.answerMode = 'black';
        this.updateAnswerButtonDisplay();
        this.updateUI();
        this.renderer.showMessage('問題図を確定しました');
      } else {
        if (!this.store.hasProblemDiagram()) {
          this.renderer.showMessage('問題図が設定されていません');
          return;
        }

        this.store.restoreProblemDiagram();
        this.updateUI();
        this.renderer.showMessage('問題図に戻しました');
      }
    });

    this.elements.sliderEl?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      const mode = this.store.appMode;

      if (mode === 'review') {
        if (this.store.reviewActive) {
          this.store.resetReview();
        }

        this.store.setMoveIndex(parseInt(target.value, 10));
        this.updateUI();
        return;
      }

      if (mode === 'solve') {
        const state = this.store.snapshot;
        const offset = parseInt(target.value, 10);
        const baseIndex = state.numberStartIndex;
        this.store.setMoveIndex(baseIndex + offset);
        this.updateUI();
      }
    });
  }

  private initReviewTurnButtons(): void {
    const container = document.getElementById('review-turn-controls');
    const blackBtn = document.getElementById('btn-review-black') as HTMLButtonElement | null;
    const whiteBtn = document.getElementById('btn-review-white') as HTMLButtonElement | null;

    if (!container || !blackBtn || !whiteBtn) {
      return;
    }

    container.style.display = 'none';

    const setActive = (): void => {
      this.reviewTurnButtons.forEach((btn) =>
        btn.classList.toggle('active',
          (btn === blackBtn && this.uiState.reviewTurn === 'B') ||
          (btn === whiteBtn && this.uiState.reviewTurn === 'W'))
      );
    };

    blackBtn.addEventListener('click', () => {
      this.uiState.reviewTurn = 'B';
      setActive();
    });

    whiteBtn.addEventListener('click', () => {
      this.uiState.reviewTurn = 'W';
      setActive();
    });

    this.reviewTurnButtons = [blackBtn, whiteBtn];
    this.reviewTurnContainer = container;
    setActive();
  }

  private initBoardSaveButton(): void {
    const saveBtn = document.getElementById('btn-save-board');
    saveBtn?.addEventListener('click', () => {
      this.boardCapture.captureBoard().catch((error) => {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`盤面保存に失敗しました: ${message}`);
      });
    });
  }

  private setMode(mode: PlayMode, buttonElement: Element): void {
    this.disableEraseMode();
    const state = this.store.snapshot;
    state.playMode = mode;

    if (state.numberMode) {
      state.numberMode = false;
      state.turn = state.sgfIndex;
      state.answerMode = 'black';
      this.store.setAppMode('edit');
      this.updateAnswerButtonDisplay();
    }

    this.setActiveButton(buttonElement, 'play-btn');
    this.updateUI();
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document.querySelectorAll(`.${groupClass}`).forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
  }

  updateModeDependentUI(): void {
    const mode = this.store.appMode;
    const state = this.store.snapshot;
    const solveNavigationActive = mode === 'solve' && state.solutionMoveList.length > 0;

    this.setButtonsEnabled(this.playButtons, mode === 'edit');
    if (this.answerButton) {
      this.setButtonsEnabled([this.answerButton], mode === 'solve');
    }
    this.setButtonsEnabled(this.navigationButtons, mode === 'review' || solveNavigationActive);
    this.updateReviewTurnControls(mode === 'review');
  }

  private setButtonsEnabled(buttons: HTMLButtonElement[], enabled: boolean): void {
    buttons.forEach((button) => {
      button.disabled = !enabled;
      button.classList.toggle('disabled', !enabled);
      button.setAttribute('aria-disabled', String(!enabled));
    });
  }

  private updateReviewTurnControls(visible: boolean): void {
    if (!this.reviewTurnContainer || this.reviewTurnButtons.length === 0) {
      return;
    }

    this.reviewTurnContainer.style.display = visible ? 'flex' : 'none';
    this.setButtonsEnabled(this.reviewTurnButtons, visible);
    this.reviewTurnButtons.forEach((btn) => {
      const isBlack = btn.id === 'btn-review-black';
      const active = (isBlack && this.uiState.reviewTurn === 'B') || (!isBlack && this.uiState.reviewTurn === 'W');
      btn.classList.toggle('active', active);
    });
  }
}
