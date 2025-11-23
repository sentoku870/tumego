import { GameStore } from "../../state/game-store.js";
import { Renderer } from "../../renderer.js";
import { BoardCaptureService } from "../../services/board-capture-service.js";
import { UIElements, PlayMode } from "../../types.js";
import { UIUpdater } from "./feature-menu-controller.js";

export class ToolbarController {
  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly elements: UIElements,
    private readonly updateUI: UIUpdater
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
    this.initBoardSizeToggle();
    this.initStartColorButton();
    this.initAnswerStepsShortcut();
    this.initBoardSaveButton();
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

  // --- toolbar-controller.ts の updateAnswerButtonDisplay() ---
  updateAnswerButtonDisplay(): void {
    const state = this.store.snapshot;
    const answerBtn = document.getElementById("btn-answer");
    const startColorBtn = document.getElementById("btn-start-color");
    if (!answerBtn) {
      return;
    }

    answerBtn.textContent = state.numberMode ? "編集に戻る" : "解答開始";

    if (startColorBtn) {
      startColorBtn.textContent = state.startColor === 2 ? "白先" : "黒先";
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
        this.updateBoardSizeButtonLabel();
      });
    });
  }

  private initBasicButtons(): void {
    const clearBtn = document.getElementById("btn-clear");
    clearBtn?.addEventListener("click", () => {
      const state = this.store.snapshot;
      this.disableEraseMode();
      this.store.resetForClearAll();
      this.updateUI();
      this.updateToolbarUI();
      // ★ SGF入力エリアを空にする（追加行）
      (document.getElementById("sgf-text") as HTMLTextAreaElement).value = "";
    });

    const undoBtn = document.getElementById("btn-undo");
    undoBtn?.addEventListener("click", () => {
      const restored = this.store.undo();
      if (restored) {
        this.renderer.updateBoardSize();
      }
      this.updateUI();
    });

    const eraseBtn = document.getElementById("btn-erase");
    eraseBtn?.addEventListener("click", () => {
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

    const answerBtn = document.getElementById("btn-answer");
    answerBtn?.addEventListener("click", () => {
      this.disableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        this.store.enterSolveMode();
        state.answerMode = "black";
        state.startColor = 1;
      } else {
        this.store.exitSolveModeToEmptyBoard();
        state.answerMode = "black";
        state.startColor = 1;
      }

      this.updateToolbarUI();
      this.updateUI();
    });

    const historyBtn = document.getElementById("btn-history");
    historyBtn?.addEventListener("click", () => {
      this.store.historyManager.showHistoryDialog((index) => {
        if (this.store.historyManager.restore(index, this.store.snapshot)) {
          this.renderer.updateBoardSize();
          this.updateUI();
          this.renderer.showMessage("履歴を復元しました");
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
        this.updateToolbarUI();
        this.updateUI();
        this.renderer.showMessage("問題図を確定しました");
      } else {
        // === 解答モード中：問題図に戻す ===
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

  private initBoardSizeToggle(): void {
    const boardSizeBtn = document.getElementById("btn-board-size");
    boardSizeBtn?.addEventListener("click", () => {
      const nextSizeBtn = this.getNextBoardSizeButton();
      nextSizeBtn?.click();
      this.updateBoardSizeButtonLabel();
    });

    this.updateBoardSizeButtonLabel();
  }

  private initStartColorButton(): void {
    const startColorBtn = document.getElementById("btn-start-color");
    startColorBtn?.addEventListener("click", () => {
      if (!this.isSolveMode()) {
        return;
      }

      const state = this.store.snapshot;
      state.startColor = state.startColor === 1 ? 2 : 1;
      state.answerMode = state.startColor === 1 ? "black" : "white";

      this.updateToolbarUI();
      this.updateUI();
    });
  }

  private initAnswerStepsShortcut(): void {
    const shortcutBtn = document.getElementById("btn-answer-steps-shortcut");
    const originalBtn = document.getElementById("btn-answer-steps");
    shortcutBtn?.addEventListener("click", () => {
      if (!this.isSolveMode()) {
        return;
      }
      originalBtn?.click();
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

    // === 編集モード／解答モードに関係なく「色変更」だけ行う ===
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

  updateToolbarUI(): void {
    this.updateAnswerButtonDisplay();
    this.updateBoardSizeButtonLabel();
    this.updateModeDependentControls();
  }

  private updateBoardSizeButtonLabel(): void {
    const boardSizeBtn = document.getElementById("btn-board-size");
    if (!boardSizeBtn) {
      return;
    }

    const activeBtn = this.getActiveSizeButton();
    const size = activeBtn?.dataset.size || this.store.snapshot.boardSize.toString();
    boardSizeBtn.textContent = `${size}路`;
  }

  private getActiveSizeButton(): HTMLElement | null {
    const active = document.querySelector(".size-btn.active");
    if (active) {
      return active as HTMLElement;
    }

    return document.querySelector(
      `.size-btn[data-size="${this.store.snapshot.boardSize}"]`
    ) as HTMLElement | null;
  }

  private getNextBoardSizeButton(): HTMLElement | null {
    const sizes = ["9", "13", "19"];
    const active = this.getActiveSizeButton();
    const currentSize = active?.dataset.size || sizes[0];
    const currentIndex = sizes.indexOf(currentSize);
    const nextIndex = (currentIndex + 1) % sizes.length;

    return document.querySelector(
      `.size-btn[data-size="${sizes[nextIndex]}"]`
    ) as HTMLElement | null;
  }

  private updateModeDependentControls(): void {
    const isSolveMode = this.isSolveMode();

    this.setDisabledState(["btn-black", "btn-white", "btn-alt"], isSolveMode);
    this.setDisabledState(
      [
        "btn-start-color",
        "btn-prev-move",
        "btn-next-move",
        "btn-answer-steps-shortcut",
      ],
      !isSolveMode
    );

    this.setDisabledState(
      [
        "btn-clear",
        "btn-undo",
        "btn-erase",
        "btn-board-size",
        "btn-file",
        "btn-history",
        "btn-feature",
        "btn-save-board",
      ],
      false
    );

    if (this.elements.sliderEl) {
      this.elements.sliderEl.disabled = !isSolveMode;
    }
  }

  private setDisabledState(ids: string[], disabled: boolean): void {
    ids.forEach((id) => {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (button) {
        button.disabled = disabled;
      }
    });
  }

  private isEditMode(): boolean {
    return !this.store.snapshot.numberMode;
  }

  private isSolveMode(): boolean {
    return this.store.snapshot.numberMode;
  }
}
