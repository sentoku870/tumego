import { GameStore } from "../../state/game-store.js";
import { Renderer } from "../../renderer.js";
import { BoardCaptureService } from "../../services/board-capture-service.js";
import { UIElements, PlayMode, Preferences } from "../../types.js";
import { UIUpdater } from "./feature-menu-controller.js";

export class ToolbarController {
  private clearBtn: HTMLButtonElement | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly elements: UIElements,
    private readonly updateUI: UIUpdater,
    private readonly getPreferences: () => Preferences
  )
  {}

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
    this.refreshControls();
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

  updateAnswerButtonDisplay(): void {
    const state = this.store.snapshot;
    const firstPlayerBtn = document.getElementById(
      "btn-first-player"
    ) as HTMLButtonElement | null;
    if (!firstPlayerBtn) {
      return;
    }

    const label = state.startColor === 1 ? "黒先" : "白先";
    firstPlayerBtn.textContent = `黒先・白先（${label}）`;
    firstPlayerBtn.classList.toggle("white-mode", state.startColor === 2);
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
    const clearBtn = document.getElementById("btn-clear");
    this.clearBtn = clearBtn as HTMLButtonElement | null;
    clearBtn?.addEventListener("click", () => {
      if (this.isSolveMode() && this.shouldDisableFullReset()) {
        return;
      }
      const state = this.store.snapshot;
      this.disableEraseMode();
      this.store.resetForClearAll();
      this.store.historyManager.clear();
      const sizeBtn = document.querySelector(
        '.size-btn[data-size="' + state.boardSize + '"]'
      );
      if (sizeBtn) {
        this.setActiveButton(sizeBtn, "size-btn");
      }
      const altBtnEl = document.getElementById("btn-alt");
      if (altBtnEl) {
        this.setActiveButton(altBtnEl, "play-btn");
      }
      this.updateUI();
      this.updateAnswerButtonDisplay();
      // ★ SGF入力エリアを空にする（追加行）
      (document.getElementById("sgf-text") as HTMLTextAreaElement).value = "";
    });

    const undoBtn = document.getElementById("btn-undo");
    undoBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      let restored = false;

      if (state.numberMode && this.store.historyManager.getList().length > 0) {
        state.numberMode = false;
        restored = this.store.undo();
      }

      if (!restored) {
        restored = this.store.undo();
      }

      if (restored) {
        this.renderer.updateBoardSize();
        this.updateUI();
        this.updateAnswerButtonDisplay();
        this.updateFullResetVisibility();
        this.refreshControls();
      }
    });

    const eraseBtn = document.getElementById("btn-erase");
    eraseBtn?.addEventListener("click", () => {
      if (this.isSolveMode()) {
        return;
      }
      const state = this.store.snapshot;
      state.eraseMode = !state.eraseMode;
      if (state.eraseMode) {
        eraseBtn.classList.add("active");
        this.renderer.showMessage("消去モード");
      } else {
        eraseBtn.classList.remove("active");
        this.renderer.showMessage("");
      }
    });

    const blackBtn = document.getElementById("btn-black");
    blackBtn?.addEventListener("click", () => this.setMode("black", blackBtn!));

    const whiteBtn = document.getElementById("btn-white");
    whiteBtn?.addEventListener("click", () => this.setMode("white", whiteBtn!));

    const altBtn = document.getElementById("btn-alt");
    altBtn?.addEventListener("click", () => {
      if (this.isSolveMode()) {
        return;
      }
      const state = this.store.snapshot;
      state.startColor = state.startColor === 1 ? 2 : 1;
      this.setMode("alt", altBtn!);
    });
  }

  private initGameButtons(): void {
    const prevBtn = document.getElementById("btn-prev-move");
    prevBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      if (state.sgfIndex > 0) {
        this.store.setMoveIndex(state.sgfIndex - 1);
        this.updateUI();
      }
    });

    const nextBtn = document.getElementById("btn-next-move");
    nextBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      if (state.sgfIndex < state.sgfMoves.length) {
        this.store.setMoveIndex(state.sgfIndex + 1);
        this.updateUI();
      }
    });

    const modeToggleBtn = document.getElementById("btn-mode-toggle");
    modeToggleBtn?.addEventListener("click", () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (this.isEditMode()) {
        this.store.historyManager.save("解答開始前", state);
        this.store.enterSolveMode();
        state.answerMode = "black";
        state.startColor = 1;
        this.renderer.showMessage("解答モードを開始しました");
      } else {
        this.store.historyManager.save("編集モードに戻る前", state);
        this.store.exitSolveModeToEmptyBoard();
        state.answerMode = "black";
        state.startColor = 1;
        this.renderer.showMessage("編集モードに戻りました");
      }

      this.updateAnswerButtonDisplay();
      this.updateUI();
      this.updateFullResetVisibility();
      this.refreshControls();
    });

    const firstPlayerBtn = document.getElementById("btn-first-player");
    firstPlayerBtn?.addEventListener("click", () => {
      if (!this.isSolveMode()) {
        return;
      }

      this.store.historyManager.save("先手色変更前", this.store.snapshot);
      const state = this.store.snapshot;
      state.answerMode = state.answerMode === "black" ? "white" : "black";
      state.startColor = state.startColor === 1 ? 2 : 1;
      this.store.restoreProblemDiagram();

      this.updateAnswerButtonDisplay();
      this.updateUI();
      this.refreshControls();
    });

    const historyBtn = document.getElementById("btn-history");
    historyBtn?.addEventListener("click", () => {
      this.store.historyManager.showHistoryDialog((index) => {
        if (this.store.historyManager.restore(index, this.store.snapshot)) {
          this.renderer.updateBoardSize();
          this.updateUI();
          this.renderer.showMessage("履歴を復元しました");
          this.refreshControls();
        }
      });
    });

    const problemBtn = document.getElementById("btn-problem");
    problemBtn?.addEventListener("click", () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        // === 編集モード中：問題図の確定だけ行う ===
        this.store.setProblemDiagram();
        state.answerMode = "black";
        this.updateAnswerButtonDisplay();
        this.updateUI();
        this.renderer.showMessage("問題図を確定しました");
      } else {
        // === 解答モード中：問題図に戻す ===
        if (!this.store.hasProblemDiagram()) {
          this.renderer.showMessage("問題図が設定されていません");
          return;
        }

        this.store.historyManager.save("初期図に戻る前", state);
        this.store.restoreProblemDiagram();
        this.updateUI();
        this.renderer.showMessage("初期図に戻しました");
      }

      this.refreshControls();
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
    if (this.isSolveMode()) {
      return;
    }
    this.disableEraseMode();
    const state = this.store.snapshot;

    // === 編集モードでの配置色変更のみ ===
    state.mode = mode;

    // === ボタンの active 切り替え ===
    this.setActiveButton(buttonElement, "play-btn");

    // === UI 更新 ===
    this.updateUI();
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document
      .querySelectorAll(`.${groupClass}`)
      .forEach((btn) => btn.classList.remove("active"));
    element.classList.add("active");
  }

  private syncActiveButtons(selector: string, isActive: (el: Element) => boolean): void {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.classList.toggle("active", isActive(btn));
    });
  }

  private isEditMode(): boolean {
    return !this.store.snapshot.numberMode;
  }

  private isSolveMode(): boolean {
    return this.store.snapshot.numberMode;
  }

  refreshControls(): void {
    this.updateAnswerButtonDisplay();
    this.updateFullResetVisibility();

    const state = this.store.snapshot;
    const prefs = this.getPreferences();
    const isSolve = this.isSolveMode();
    const hasHistory = this.store.historyManager.getList().length > 0;
    const hasReplay = state.sgfMoves.length > 0;

    const clearBtn =
      this.clearBtn || (document.getElementById("btn-clear") as HTMLButtonElement | null);
    if (clearBtn) {
      clearBtn.disabled = isSolve && prefs.solve.enableFullReset !== "on";
    }

    const undoBtn = document.getElementById("btn-undo") as HTMLButtonElement | null;
    if (undoBtn) {
      const canUndoHistory = hasHistory;
      const canUndoSolve = isSolve && state.sgfIndex > state.numberStartIndex;
      undoBtn.disabled = !(canUndoHistory || canUndoSolve);
    }

    const eraseBtn = document.getElementById("btn-erase") as HTMLButtonElement | null;
    if (eraseBtn) {
      eraseBtn.disabled = isSolve;
      if (isSolve) {
        eraseBtn.classList.remove("active");
      }
    }

    const altBtn = document.getElementById("btn-alt") as HTMLButtonElement | null;
    if (altBtn) {
      altBtn.disabled = isSolve;
    }

    const blackBtn = document.getElementById("btn-black") as HTMLButtonElement | null;
    const whiteBtn = document.getElementById("btn-white") as HTMLButtonElement | null;
    if (blackBtn) {
      blackBtn.disabled = isSolve;
    }
    if (whiteBtn) {
      whiteBtn.disabled = isSolve;
    }

    const prevBtn = document.getElementById("btn-prev-move") as HTMLButtonElement | null;
    if (prevBtn) {
      const canPrev = isSolve
        ? state.sgfIndex > 0
        : hasReplay && state.sgfIndex > 0;
      prevBtn.disabled = !canPrev;
    }

    const nextBtn = document.getElementById("btn-next-move") as HTMLButtonElement | null;
    if (nextBtn) {
      const canNext = isSolve
        ? state.sgfIndex < state.sgfMoves.length
        : hasReplay && state.sgfIndex < state.sgfMoves.length;
      nextBtn.disabled = !canNext;
    }

    const modeToggleBtn = document.getElementById(
      "btn-mode-toggle"
    ) as HTMLButtonElement | null;
    if (modeToggleBtn) {
      modeToggleBtn.textContent = isSolve ? "編集（盤を空に）" : "解答開始";
    }

    const problemBtn = document.getElementById("btn-problem") as HTMLButtonElement | null;
    if (problemBtn) {
      problemBtn.textContent = isSolve ? "🧩 初期図" : "🧩 問題図";
      problemBtn.disabled = isSolve && !this.store.hasProblemDiagram();
    }

    const firstPlayerBtn = document.getElementById(
      "btn-first-player"
    ) as HTMLButtonElement | null;
    if (firstPlayerBtn) {
      firstPlayerBtn.disabled = !isSolve;
      firstPlayerBtn.classList.toggle("active", isSolve);
    }

    const answerStepsBtn = document.getElementById(
      "btn-answer-steps"
    ) as HTMLButtonElement | null;
    if (answerStepsBtn) {
      answerStepsBtn.disabled = state.sgfMoves.length === 0;
    }

    this.syncActiveButtons(
      ".size-btn",
      (btn) => parseInt((btn as HTMLElement).dataset.size || "0", 10) === state.boardSize
    );

    this.syncActiveButtons(".play-btn", (btn) => {
      if (isSolve) {
        return false;
      }
      switch ((btn as HTMLElement).id) {
        case "btn-black":
          return state.mode === "black";
        case "btn-white":
          return state.mode === "white";
        case "btn-alt":
          return state.mode === "alt";
        default:
          return false;
      }
    });
  }

  private shouldDisableFullReset(): boolean {
    const prefs = this.getPreferences();
    return this.isSolveMode() && prefs.solve.enableFullReset !== "on";
  }

  updateFullResetVisibility(): void {
    if (!this.clearBtn) {
      this.clearBtn = document.getElementById("btn-clear") as HTMLButtonElement | null;
    }
    if (!this.clearBtn) {
      return;
    }

    const prefs = this.getPreferences();
    const shouldShow =
      !this.store.snapshot.numberMode || prefs.solve.enableFullReset === "on";
    this.clearBtn.style.display = shouldShow ? "" : "none";
    this.clearBtn.disabled = this.shouldDisableFullReset();
  }
}
