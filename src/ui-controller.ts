// ============ UI制御エンジン ============
import { GameState, UIElements, KeyBindings, DEFAULT_CONFIG } from "./types.js";
import { GoEngine } from "./go-engine.js";
import { Renderer } from "./renderer.js";
import { SGFParser } from "./sgf-parser.js";
import { QRManager } from "./qr-manager.js";
import { HistoryManager } from "./history-manager.js";
import { GameStore } from "./state/game-store.js";
import { BoardCaptureService } from "./services/board-capture-service.js";
import { SGFService } from "./services/sgf-service.js";
import { UIInteractionState } from "./ui/state/ui-interaction-state.js";
import { DropdownManager } from "./ui/controllers/dropdown-manager.js";
import { BoardInteractionController } from "./ui/controllers/board-interaction-controller.js";
import { KeyboardController } from "./ui/controllers/keyboard-controller.js";
import { ToolbarController } from "./ui/controllers/toolbar-controller.js";
import { FeatureMenuController } from "./ui/controllers/feature-menu-controller.js";
import { FileMenuController } from "./ui/controllers/file-menu-controller.js";

export class UIController {
  private engine: GoEngine;
  private renderer: Renderer;
  private sgfParser: SGFParser;
  private qrManager: QRManager;
  private historyManager: HistoryManager;
  private store: GameStore;
  private boardCapture: BoardCaptureService;
  private sgfService: SGFService;
  private uiState: UIInteractionState;
  private dropdownManager: DropdownManager;
  private boardController: BoardInteractionController;
  private keyboardController: KeyboardController;
  private toolbarController: ToolbarController;
  private featureMenuController: FeatureMenuController;
  private fileMenuController: FileMenuController;

  constructor(
    private readonly state: GameState,
    private readonly elements: UIElements
  ) {
    this.engine = new GoEngine();
    this.sgfParser = new SGFParser();
    this.qrManager = new QRManager();
    this.historyManager = new HistoryManager();
    this.store = new GameStore(state, this.engine, this.historyManager);
    this.renderer = new Renderer(
      this.store,
      elements,
      () => this.updateUI() // ← これを渡す！
    );

    this.boardCapture = new BoardCaptureService(elements.svg, this.renderer);
    this.sgfService = new SGFService(this.sgfParser, this.store);
    this.uiState = new UIInteractionState();
    this.dropdownManager = new DropdownManager(this.uiState);

    this.toolbarController = new ToolbarController(
      this.store,
      this.renderer,
      this.boardCapture,
      this.elements,
      () => this.updateUI()
    );

    this.boardController = new BoardInteractionController(
      this.store,
      this.elements,
      this.uiState,
      () => this.updateUI(),
      () => this.toolbarController.disableEraseMode()
    );

    this.keyboardController = new KeyboardController(this.uiState);

    this.featureMenuController = new FeatureMenuController(
      this.dropdownManager,
      this.renderer,
      this.elements,
      this.store,
      this.sgfService,
      () => this.updateUI()
    );

    this.fileMenuController = new FileMenuController(
      this.dropdownManager,
      this.sgfService,
      this.renderer,
      this.qrManager,
      () => this.updateUI(),
      (sgfText) => this.syncSgfTextarea(sgfText),
      () => this.toolbarController.updateAnswerButtonDisplay()
    );

    // デバッグ用：GameStore を globalThis から見えるようにする
    (globalThis as any).store = this.store;
  }

  initialize(): void {
    this.boardController.initialize();
    this.toolbarController.initialize();
    this.featureMenuController.initialize();
    this.fileMenuController.initialize();
    this.keyboardController.initialize(this.createKeyBindings());
    this.initResizeEvents();

    this.store.initBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);

    setTimeout(() => {
      this.renderer.updateBoardSize();
      this.updateUI();
    }, 100);

    this.updateUI();
    this.toolbarController.updateAnswerButtonDisplay();

    this.historyManager.clear();
    this.historyManager.save("アプリケーション開始", this.state);

    const urlResult = this.sgfService.loadFromURL();
    if (urlResult) {
      const applyResult = this.sgfService.apply(urlResult);
      this.renderer.updateBoardSize();
      this.updateUI();
      this.syncSgfTextarea(applyResult.sgfText);
      this.toolbarController.updateAnswerButtonDisplay();
      this.renderer.showMessage(
        `URL からSGF読み込み完了 (${urlResult.moves.length}手)`
      );
    }

    const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
    const altBtn = document.getElementById("btn-alt");
    sizeBtn?.classList.add("active");
    altBtn?.classList.add("active");
  }

  private updateUI(): void {
    this.renderer.render();
    this.renderer.updateInfo();
    this.renderer.updateSlider();

    // === 検討モード中は盤枠に色を付ける ===
    const wrapper = this.elements.boardWrapper;
    if (!wrapper) return;

    const state = this.store.snapshot;
    const reviewMoves = (this.store as any).reviewMoves as
      | { col: number; row: number }[]
      | undefined;
    const hasReview = Array.isArray(reviewMoves) && reviewMoves.length > 0;

    const inReviewMode = state.sgfLoadedFromExternal && hasReview;

    if (inReviewMode) {
      wrapper.classList.add("review-mode");
    } else {
      wrapper.classList.remove("review-mode");
    }
  }

  private syncSgfTextarea(text: string): void {
    const sgfTextarea = document.getElementById(
      "sgf-text"
    ) as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = text;
    }
  }

  private createKeyBindings(): KeyBindings {
    return {
      q: () => this.toolbarController.triggerButton('.size-btn[data-size="9"]'),
      w: () =>
        this.toolbarController.triggerButton('.size-btn[data-size="13"]'),
      e: () =>
        this.toolbarController.triggerButton('.size-btn[data-size="19"]'),
      a: () => this.toolbarController.triggerButton("#btn-clear"),
      s: () => this.toolbarController.triggerButton("#btn-undo"),
      d: () => this.toolbarController.triggerButton("#btn-erase"),
      z: () => this.toolbarController.triggerButton("#btn-black"),
      x: () => this.toolbarController.triggerButton("#btn-alt"),
      c: () => this.toolbarController.triggerButton("#btn-white"),
      ArrowLeft: () => this.toolbarController.triggerButton("#btn-prev-move"),
      ArrowRight: () => this.toolbarController.triggerButton("#btn-next-move"),
    };
  }

  private initResizeEvents(): void {
    const handleResize = () => {
      this.renderer.updateBoardSize();
      setTimeout(() => this.renderer.render(), 200);
      this.dropdownManager.repositionActive();
    };

    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("resize", handleResize);
  }
}
