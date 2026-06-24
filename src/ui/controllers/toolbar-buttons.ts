// ============ ツールバー: ボタン参照 & イベントバインド ============
// ボタンの DOM 参照保持と addEventListener バインドを担当する。
// 状態反映(有効/無効、表示テキスト変更)は ToolbarState に分離。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer.js';
import { BoardCaptureService } from '../../services/board-capture-service.js';
import { UIElements, PlayMode } from '../../types.js';
import { UIEventBus } from '../../app/event-bus.js';
import { HistoryView } from '../views/history-view.js';

export class ToolbarButtons {
  public clearBtn: HTMLButtonElement | null = null;
  public problemBtn: HTMLButtonElement | null = null;
  public answerBtn: HTMLButtonElement | null = null;
  public prevMoveBtn: HTMLButtonElement | null = null;
  public nextMoveBtn: HTMLButtonElement | null = null;
  public blackBtn: HTMLButtonElement | null = null;
  public whiteBtn: HTMLButtonElement | null = null;
  public eraseBtn: HTMLButtonElement | null = null;
  public altBtn: HTMLButtonElement | null = null;
  public undoBtn: HTMLButtonElement | null = null;
  public exitSolveBtn: HTMLButtonElement | null = null;

  private unsubscribeFromEventBus: (() => void) | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly elements: UIElements,
    private readonly eventBus: UIEventBus
  ) {}

  bindAll(): void {
    const state = this.store.snapshot;
    state.mode = 'alt';
    state.numberMode = false;
    state.eraseMode = false;

    this.bindSizeButtons();
    this.bindBasicButtons();
    this.bindGameButtons();
    this.bindBoardSaveButton();

    this.unsubscribeFromEventBus = this.eventBus.onEraseModeDisable(() => {
      this.dispatchDisableEraseMode();
    });
  }

  dispose(): void {
    this.unsubscribeFromEventBus?.();
    this.unsubscribeFromEventBus = null;
  }

  triggerButton(selector: string): void {
    const button = document.querySelector(selector) as HTMLElement | null;
    button?.click();
  }

  ensureButtonRefs(): void {
    this.clearBtn = this.clearBtn ?? (document.getElementById('btn-clear') as HTMLButtonElement | null);
    this.problemBtn = this.problemBtn ?? (document.getElementById('btn-problem') as HTMLButtonElement | null);
    this.answerBtn = this.answerBtn ?? (document.getElementById('btn-answer') as HTMLButtonElement | null);
    this.prevMoveBtn = this.prevMoveBtn ?? (document.getElementById('btn-prev-move') as HTMLButtonElement | null);
    this.nextMoveBtn = this.nextMoveBtn ?? (document.getElementById('btn-next-move') as HTMLButtonElement | null);
    this.blackBtn = this.blackBtn ?? (document.getElementById('btn-black') as HTMLButtonElement | null);
    this.whiteBtn = this.whiteBtn ?? (document.getElementById('btn-white') as HTMLButtonElement | null);
    this.eraseBtn = this.eraseBtn ?? (document.getElementById('btn-erase') as HTMLButtonElement | null);
    this.altBtn = this.altBtn ?? (document.getElementById('btn-alt') as HTMLButtonElement | null);
    this.undoBtn = this.undoBtn ?? (document.getElementById('btn-undo') as HTMLButtonElement | null);
    this.exitSolveBtn = this.exitSolveBtn ?? (document.getElementById('btn-exit-solve-edit') as HTMLButtonElement | null);
  }

  private dispatchDisableEraseMode(): void {
    const state = this.store.snapshot;
    if (!state.eraseMode) {
      return;
    }
    state.eraseMode = false;
    this.eraseBtn?.classList.remove('active');
    this.renderer.showMessage('');
  }

  private bindSizeButtons(): void {
    document.querySelectorAll('.size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const element = btn as HTMLElement;
        const size = parseInt(element.dataset.size!, 10);
        const state = this.store.snapshot;
        if (size === state.boardSize) {
          return;
        }

        this.store.initBoard(size);
        this.eventBus.emitUIUpdate();
        this.eventBus.emitAnswerButtonUpdate();
        this.setActiveButton(element, 'size-btn');
      });
    });
  }

  private bindBasicButtons(): void {
    this.clearBtn = document.getElementById('btn-clear') as HTMLButtonElement | null;
    if (this.clearBtn) {
      this.clearBtn.title = '盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）';
    }
    this.clearBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      this.dispatchDisableEraseMode();
      this.store.resetForClearAll();
      this.eventBus.emitUIUpdate();
      this.eventBus.emitAnswerButtonUpdate();
      (document.getElementById('sgf-text') as HTMLTextAreaElement).value = '';
    });

    this.undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    if (this.undoBtn) {
      this.undoBtn.title = '編集・解答の履歴から1つ前の状態に戻ります（履歴ダイアログと同じ履歴を使用）';
    }
    this.undoBtn?.addEventListener('click', () => {
      const restored = this.store.undo();
      if (restored) {
        this.renderer.updateBoardSize();
      }
      this.eventBus.emitUIUpdate();
    });

    this.eraseBtn = document.getElementById('btn-erase') as HTMLButtonElement | null;
    if (this.eraseBtn) {
      this.eraseBtn.title = '任意の石だけを消すモードをオン／オフします（盤面の他の状態は変わりません）';
    }
    this.eraseBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      state.eraseMode = !state.eraseMode;
      if (state.eraseMode) {
        this.eraseBtn?.classList.add('active');
        this.renderer.showMessage('消去モード');
      } else {
        this.eraseBtn?.classList.remove('active');
        this.renderer.showMessage('');
      }
    });

    this.blackBtn = document.getElementById('btn-black') as HTMLButtonElement | null;
    this.blackBtn?.addEventListener('click', () => this.setMode('black', this.blackBtn!));

    this.whiteBtn = document.getElementById('btn-white') as HTMLButtonElement | null;
    this.whiteBtn?.addEventListener('click', () => this.setMode('white', this.whiteBtn!));

    this.altBtn = document.getElementById('btn-alt') as HTMLButtonElement | null;
    if (this.altBtn) {
      this.altBtn.title = '黒白交互に石を連続配置するモードです（先手色は黒先ボタンと連動）';
    }
    this.altBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      state.startColor = state.startColor === 1 ? 2 : 1;
      this.setMode('alt', this.altBtn!);
    });
  }

  private bindGameButtons(): void {
    this.prevMoveBtn = document.getElementById('btn-prev-move') as HTMLButtonElement | null;
    if (this.prevMoveBtn) {
      this.prevMoveBtn.title = '読み上げ用の手順を1手戻ります（Undoとは別の1手戻る）';
    }
    this.prevMoveBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (state.sgfIndex > 0) {
        this.store.setMoveIndex(state.sgfIndex - 1);
        this.eventBus.emitUIUpdate();
      }
    });

    this.nextMoveBtn = document.getElementById('btn-next-move') as HTMLButtonElement | null;
    if (this.nextMoveBtn) {
      this.nextMoveBtn.title = '読み上げ用の手順を1手進めます';
    }
    this.nextMoveBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (state.sgfIndex < state.sgfMoves.length) {
        this.store.setMoveIndex(state.sgfIndex + 1);
        this.eventBus.emitUIUpdate();
      }
    });

    this.answerBtn = document.getElementById('btn-answer') as HTMLButtonElement | null;
    this.answerBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        return;
      }

      if (state.answerMode === 'black') {
        state.answerMode = 'white';
        state.startColor = 2;
      } else {
        state.answerMode = 'black';
        state.startColor = 1;
      }

      this.eventBus.emitUIUpdate();
    });

    this.exitSolveBtn = document.getElementById('btn-exit-solve-edit') as HTMLButtonElement | null;
    this.exitSolveBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();

      if (!this.store.snapshot.numberMode) {
        this.store.enterSolveMode();
        this.store.snapshot.answerMode = 'black';
        this.store.snapshot.startColor = 1;
      } else {
        this.store.exitSolveModeToEmptyBoard();
      }

      this.eventBus.emitUIUpdate();
    });

    const historyBtn = document.getElementById('btn-history') as HTMLButtonElement | null;
    if (historyBtn) {
      historyBtn.title = '編集・解答の履歴一覧を開き、任意の状態にジャンプします';
    }
    historyBtn?.addEventListener('click', () => {
      const historyView = new HistoryView();
      historyView.render(
        this.store.historyManager.getList(),
        (index) => {
          if (this.store.restoreHistorySnapshot(index)) {
            this.renderer.updateBoardSize();
            this.eventBus.emitUIUpdate();
            this.renderer.showMessage('履歴を復元しました');
          }
        },
        () => this.store.historyManager.clear()
      );
    });

    this.problemBtn = document.getElementById('btn-problem') as HTMLButtonElement | null;
    this.problemBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        this.store.setProblemDiagram();
        state.answerMode = 'black';
        this.eventBus.emitUIUpdate();
        this.renderer.showMessage('問題図を確定しました');
      } else {
        if (!this.store.hasProblemDiagram()) {
          this.renderer.showMessage('問題図が設定されていません');
          return;
        }

        this.store.restoreProblemDiagram();
        this.eventBus.emitUIUpdate();
        this.renderer.showMessage('問題図に戻しました');
      }
    });

    this.elements.sliderEl?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      this.store.setMoveIndex(parseInt(target.value, 10));
      this.eventBus.emitUIUpdate();
    });
  }

  private bindBoardSaveButton(): void {
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
    this.dispatchDisableEraseMode();
    const state = this.store.snapshot;

    state.mode = mode;

    this.setActiveButton(buttonElement, 'play-btn');

    this.eventBus.emitUIUpdate();
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document
      .querySelectorAll(`.${groupClass}`)
      .forEach((btn) => btn.classList.remove('active'));
    element.classList.add('active');
  }
}
