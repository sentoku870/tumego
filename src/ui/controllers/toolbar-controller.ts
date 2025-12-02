import { GameStore } from "../../state/game-store.js";
import { Renderer } from "../../renderer.js";
import { BoardCaptureService } from "../../services/board-capture-service.js";
import { UIElements, PlayMode, Preferences } from "../../types.js";
import { UIUpdater } from "./feature-menu-controller.js";

export class ToolbarController {
  private clearBtn: HTMLButtonElement | null = null;
  private problemBtn: HTMLButtonElement | null = null;
  private answerBtn: HTMLButtonElement | null = null;
  private prevMoveBtn: HTMLButtonElement | null = null;
  private nextMoveBtn: HTMLButtonElement | null = null;
  private blackBtn: HTMLButtonElement | null = null;
  private whiteBtn: HTMLButtonElement | null = null;
  private eraseBtn: HTMLButtonElement | null = null;
  private altBtn: HTMLButtonElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private exitSolveBtn: HTMLButtonElement | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly elements: UIElements,
    private readonly updateUI: UIUpdater,
    private readonly getPreferences: () => Preferences
  ) {}

  initialize(): void {
    const state = this.store.snapshot;
    state.mode = "alt"; // 黒→白→黒→白（編集モードでの交互配置）
    state.numberMode = false; // 解答モードではない
    state.eraseMode = false;

    this.initSizeButtons();
    this.initBasicButtons();
    this.initGameButtons();
    this.initBoardSaveButton();
    this.updateFullResetVisibility();
  }

  disableEraseMode(): void {
    const state = this.store.snapshot;
    if (!state.eraseMode) {
      return;
    }

    state.eraseMode = false;
    const eraseBtn = document.getElementById("btn-erase");
    eraseBtn?.classList.remove("active");
    this.renderer.showMessage("");
  }

  // 黒先ボタン / 解答開始ボタンの表示更新
  updateAnswerButtonDisplay(): void {
    this.ensureButtonRefs();
    const state = this.store.snapshot;

    if (this.answerBtn) {
      // ラベルと見た目
      if (state.answerMode === "white") {
        this.answerBtn.textContent = "⚪ 白先";
        this.answerBtn.classList.add("white-mode");
      } else {
        this.answerBtn.textContent = "🔥 黒先";
        this.answerBtn.classList.remove("white-mode");
      }

      // ツールチップ
      if (state.numberMode) {
        this.answerBtn.title =
          state.answerMode === "white"
            ? "この問題を白番から解答します"
            : "この問題を黒番から解答します";
      } else {
        // 編集モード中は「解答モード専用」であることだけ伝える
        this.answerBtn.title = "解答モード中のみ使用できます";
      }
    }

    if (this.exitSolveBtn) {
      if (state.numberMode) {
        this.exitSolveBtn.textContent = "編集に戻る";
        this.exitSolveBtn.title = "解答を終了して編集モードに戻ります";
      } else {
        this.exitSolveBtn.textContent = "解答開始";
        this.exitSolveBtn.title = "問題図から解答モードを開始します";
      }
      // 常に表示しておく（CSS 側のレイアウトに任せる）
      this.exitSolveBtn.style.display = "";
    }
  }

  triggerButton(selector: string): void {
    const button = document.querySelector(selector) as HTMLElement | null;
    button?.click();
  }

  private initSizeButtons(): void {
    document.querySelectorAll(".size-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const element = btn as HTMLElement;
        const size = parseInt(element.dataset.size!, 10);
        const state = this.store.snapshot;
        if (size === state.boardSize) {
          return;
        }

        this.store.initBoard(size);
        this.updateUI();
        this.setActiveButton(element, "size-btn");
      });
    });
  }

   private initBasicButtons(): void {
    this.clearBtn = document.getElementById("btn-clear") as HTMLButtonElement | null;
    if (this.clearBtn) {
      this.clearBtn.title = "盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）";
    }
    this.clearBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      this.disableEraseMode();
      this.store.resetForClearAll();
      this.updateUI();
      this.updateAnswerButtonDisplay();
      (document.getElementById("sgf-text") as HTMLTextAreaElement).value = "";
    });

    this.undoBtn = document.getElementById("btn-undo") as HTMLButtonElement | null;
    if (this.undoBtn) {
      this.undoBtn.title = "編集・解答の履歴から1つ前の状態に戻ります（履歴ダイアログと同じ履歴を使用）";
    }
    this.undoBtn?.addEventListener("click", () => {
      const restored = this.store.undo();
      if (restored) {
        this.renderer.updateBoardSize();
      }
      this.updateUI();
    });

    this.eraseBtn = document.getElementById("btn-erase") as HTMLButtonElement | null;
    if (this.eraseBtn) {
      this.eraseBtn.title = "任意の石だけを消すモードをオン／オフします（盤面の他の状態は変わりません）";
    }
    this.eraseBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      state.eraseMode = !state.eraseMode;
      if (state.eraseMode) {
        this.eraseBtn?.classList.add("active");
        this.renderer.showMessage("消去モード");
      } else {
        this.eraseBtn?.classList.remove("active");
        this.renderer.showMessage("");
      }
    });

    this.blackBtn = document.getElementById("btn-black") as HTMLButtonElement | null;
    this.blackBtn?.addEventListener("click", () => this.setMode("black", this.blackBtn!));

    this.whiteBtn = document.getElementById("btn-white") as HTMLButtonElement | null;
    this.whiteBtn?.addEventListener("click", () => this.setMode("white", this.whiteBtn!));

    this.altBtn = document.getElementById("btn-alt") as HTMLButtonElement | null;
    if (this.altBtn) {
      this.altBtn.title = "黒白交互に石を連続配置するモードです（先手色は黒先ボタンと連動）";
    }
    this.altBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      state.startColor = state.startColor === 1 ? 2 : 1;
      this.setMode("alt", this.altBtn!);
    });
  }


    private initGameButtons(): void {
    this.prevMoveBtn = document.getElementById("btn-prev-move") as HTMLButtonElement | null;
    if (this.prevMoveBtn) {
      this.prevMoveBtn.title = "読み上げ用の手順を1手戻ります（Undoとは別の1手戻る）";
    }
    this.prevMoveBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      if (state.sgfIndex > 0) {
        this.store.setMoveIndex(state.sgfIndex - 1);
        this.updateUI();
      }
    });

    this.nextMoveBtn = document.getElementById("btn-next-move") as HTMLButtonElement | null;
    if (this.nextMoveBtn) {
      this.nextMoveBtn.title = "読み上げ用の手順を1手進めます";
    }
    this.nextMoveBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      if (state.sgfIndex < state.sgfMoves.length) {
        this.store.setMoveIndex(state.sgfIndex + 1);
        this.updateUI();
      }
    });

    this.answerBtn = document.getElementById("btn-answer") as HTMLButtonElement | null;
    this.answerBtn?.addEventListener("click", () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        return;
      }

      if (state.answerMode === "black") {
        state.answerMode = "white";
        state.startColor = 2;
      } else {
        state.answerMode = "black";
        state.startColor = 1;
      }

      this.updateAnswerButtonDisplay();
      this.updateUI();
    });

    this.exitSolveBtn = document.getElementById("btn-exit-solve-edit") as HTMLButtonElement | null;
    this.exitSolveBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      this.disableEraseMode();

      if (!state.numberMode) {
        this.store.enterSolveMode();
        state.answerMode = "black";
        state.startColor = 1;
        this.updateFullResetVisibility();
      } else {
        this.store.exitSolveModeToEmptyBoard();
        this.updateFullResetVisibility();
      }

      this.updateAnswerButtonDisplay();
      this.updateUI();
    });

    const historyBtn = document.getElementById("btn-history") as HTMLButtonElement | null;
    if (historyBtn) {
      historyBtn.title = "編集・解答の履歴一覧を開き、任意の状態にジャンプします";
    }
    historyBtn?.addEventListener("click", () => {
      this.store.historyManager.showHistoryDialog((index) => {
        if (this.store.restoreHistorySnapshot(index)) {
          this.renderer.updateBoardSize();
          this.updateUI();
          this.renderer.showMessage("履歴を復元しました");
        }
      });
    });

    this.problemBtn = document.getElementById("btn-problem") as HTMLButtonElement | null;
    this.problemBtn?.addEventListener("click", () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        this.store.setProblemDiagram();
        state.answerMode = "black";
        this.updateAnswerButtonDisplay();
        this.updateUI();
        this.renderer.showMessage("問題図を確定しました");
      } else {
        if (!this.store.hasProblemDiagram()) {
          this.renderer.showMessage("問題図が設定されていません");
          return;
        }

        this.store.restoreProblemDiagram();
        this.updateUI();
        this.renderer.showMessage("問題図に戻しました");
      }
    });

    this.elements.sliderEl?.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      this.store.setMoveIndex(parseInt(target.value, 10));
      this.updateUI();
    });
  }


  private initBoardSaveButton(): void {
    const saveBtn = document.getElementById("btn-save-board");
    saveBtn?.addEventListener("click", () => {
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

    // 編集モード／解答モードに関係なく「色変更」だけ行う
    state.mode = mode;

    // ボタンの active 切り替え
    this.setActiveButton(buttonElement, "play-btn");

    // UI 更新
    this.updateUI();
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document
      .querySelectorAll(`.${groupClass}`)
      .forEach((btn) => btn.classList.remove("active"));
    element.classList.add("active");
  }

  private isEditMode(): boolean {
    return !this.store.snapshot.numberMode;
  }

  private isSolveMode(): boolean {
    return this.store.snapshot.numberMode;
  }

  updateToolbarState(): void {
    this.ensureButtonRefs();
    this.updateFullResetVisibility();

    const state = this.store.snapshot;
    const isSolve = this.isSolveMode();
    const hasHistorySnapshots = this.store.historyManager.getList().length > 0;
    const hasSolveMoves = state.sgfIndex > state.numberStartIndex;
    const undoAvailable = isSolve ? hasSolveMoves : hasHistorySnapshots;

    this.setDisabled(this.undoBtn, !undoAvailable);

    if (isSolve) {
      this.disableEraseMode();
    }
    this.setDisabled(this.eraseBtn, isSolve);
    this.setDisabled(this.altBtn, isSolve);
    this.setDisabled(this.blackBtn, isSolve);
    this.setDisabled(this.whiteBtn, isSolve);

    this.setDisabled(this.answerBtn, !isSolve);
    if (this.exitSolveBtn) {
      this.exitSolveBtn.disabled = false;
    }

    const hasPrevMove = state.sgfIndex > 0;
    const hasNextMove = state.sgfIndex < state.sgfMoves.length;
    this.setDisabled(this.prevMoveBtn, !hasPrevMove);
    this.setDisabled(this.nextMoveBtn, !hasNextMove);

    this.updateProblemButtonState();
    // 黒先ボタン / 解答開始ボタンのラベル・ツールチップを最新状態に
    this.updateAnswerButtonDisplay();
  }

  private setDisabled(button: HTMLButtonElement | null, disabled: boolean): void {
    if (!button) {
      return;
    }
    button.disabled = disabled;
  }

  private ensureButtonRefs(): void {
    this.clearBtn = this.clearBtn ?? (document.getElementById("btn-clear") as HTMLButtonElement | null);
    this.problemBtn = this.problemBtn ?? (document.getElementById("btn-problem") as HTMLButtonElement | null);
    this.answerBtn = this.answerBtn ?? (document.getElementById("btn-answer") as HTMLButtonElement | null);
    this.prevMoveBtn = this.prevMoveBtn ?? (document.getElementById("btn-prev-move") as HTMLButtonElement | null);
    this.nextMoveBtn = this.nextMoveBtn ?? (document.getElementById("btn-next-move") as HTMLButtonElement | null);
    this.blackBtn = this.blackBtn ?? (document.getElementById("btn-black") as HTMLButtonElement | null);
    this.whiteBtn = this.whiteBtn ?? (document.getElementById("btn-white") as HTMLButtonElement | null);
    this.eraseBtn = this.eraseBtn ?? (document.getElementById("btn-erase") as HTMLButtonElement | null);
    this.altBtn = this.altBtn ?? (document.getElementById("btn-alt") as HTMLButtonElement | null);
    this.undoBtn = this.undoBtn ?? (document.getElementById("btn-undo") as HTMLButtonElement | null);
    this.exitSolveBtn =
      this.exitSolveBtn ?? (document.getElementById("btn-exit-solve-edit") as HTMLButtonElement | null);
  }

  private updateProblemButtonState(): void {
    if (!this.problemBtn) {
      this.problemBtn = document.getElementById("btn-problem") as HTMLButtonElement | null;
    }
    if (!this.problemBtn) {
      return;
    }

    const isSolve = this.isSolveMode();
    this.problemBtn.textContent = isSolve ? "🧩 初期図" : "🧩 問題図";
    this.problemBtn.title = isSolve
      ? "解答をすべて消して問題図の初期状態に戻します"
      : "現在の盤面を問題図として保存します";
    this.problemBtn.disabled = false;
  }

  updateFullResetVisibility(): void {
    if (!this.clearBtn) {
      this.clearBtn = document.getElementById("btn-clear") as HTMLButtonElement | null;
    }
    if (!this.clearBtn) {
      return;
    }

    const prefs = this.getPreferences();
    const isSolve = this.store.snapshot.numberMode;
    const enableFullResetInSolve = prefs.solve.enableFullReset === "on";

    // 他のボタンと同様に、常に表示したまま状態だけ切り替える
    this.clearBtn.style.display = "";

    if (!isSolve) {
      // 編集モード中は常に有効
      this.clearBtn.disabled = false;
      this.clearBtn.title =
        "盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）";
    } else if (enableFullResetInSolve) {
      // 解答モード中で、設定で許可されている場合
      this.clearBtn.disabled = false;
      this.clearBtn.title =
        "解答中の盤面と履歴をすべて消して最初からやり直します（Undoはできません）";
    } else {
      // 解答モード中だが、設定で無効化されている場合（グレーアウト）
      this.clearBtn.disabled = true;
      this.clearBtn.title =
        "解答モード中の全消去はデフォルトで無効です（設定→「解答モードで全て消すボタンを有効にする」で変更できます）";
    }
  }

}
