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
    const exitSolveBtn = document.getElementById("btn-exit-solve-edit");
    if (!answerBtn) {
      return;
    }

    if (state.answerMode === "white") {
      answerBtn.textContent = "⚪ 白先";
      answerBtn.classList.add("white-mode");
    } else {
      answerBtn.textContent = "🔥 黒先";
      answerBtn.classList.remove("white-mode");
    }

    if (exitSolveBtn) {
      exitSolveBtn.style.display = state.numberMode ? "" : "none";
    }
    // ここにイベントリスナーの定義は不要
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
      const state = this.store.snapshot;
      this.disableEraseMode();
      this.store.resetForClearAll();
      this.updateUI();
      this.updateAnswerButtonDisplay();
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
        // === 編集モード → 解答モード へ入るとき ===
        // 解答用の公式初期化
      this.store.enterSolveMode();

      // 黒先で開始
      state.answerMode = "black";
      state.startColor = 1;
      this.updateFullResetVisibility();
    } else {
      // === 解答モード中：黒先 / 白先 の切り替えだけ ===
      if (state.answerMode === "black") {
        state.answerMode = "white";
        state.startColor = 2;
        } else {
          state.answerMode = "black";
          state.startColor = 1;
        }
      }

      this.updateAnswerButtonDisplay();
      this.updateUI();
    });

    const exitSolveBtn = document.getElementById("btn-exit-solve-edit");
    exitSolveBtn?.addEventListener("click", () => {
      if (!this.isSolveMode()) {
        return;
      }

      this.disableEraseMode();
      this.store.exitSolveModeToEmptyBoard();
      this.updateAnswerButtonDisplay();
      this.updateUI();
      this.updateFullResetVisibility();
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
        this.updateAnswerButtonDisplay();
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

  private isEditMode(): boolean {
    return !this.store.snapshot.numberMode;
  }

  private isSolveMode(): boolean {
    return this.store.snapshot.numberMode;
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
    this.clearBtn.disabled = !shouldShow && this.store.snapshot.numberMode;
  }
}
