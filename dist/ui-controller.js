// ============ UI制御エンジン ============
import { DEFAULT_CONFIG, } from "./types.js";
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
    constructor(state, elements) {
        this.state = state;
        this.elements = elements;
        this.appModeButtons = {};
        this.modeToggleContainer = null;
        this.sgfTextArea = null;
        this.engine = new GoEngine();
        this.sgfParser = new SGFParser();
        this.qrManager = new QRManager();
        this.historyManager = new HistoryManager();
        this.store = new GameStore(state, this.engine, this.historyManager);
        this.renderer = new Renderer(this.store, elements, () => this.updateUI() // ← これを渡す！
        );
        this.boardCapture = new BoardCaptureService(elements.svg, this.renderer);
        this.sgfService = new SGFService(this.sgfParser, this.store);
        this.uiState = new UIInteractionState();
        this.dropdownManager = new DropdownManager(this.uiState);
        this.toolbarController = new ToolbarController(this.store, this.renderer, this.boardCapture, this.elements, () => this.updateUI());
        this.boardController = new BoardInteractionController(this.store, this.elements, this.uiState, () => this.updateUI(), () => this.toolbarController.disableEraseMode());
        this.keyboardController = new KeyboardController(this.uiState);
        this.featureMenuController = new FeatureMenuController(this.dropdownManager, this.renderer, this.elements, this.store, this.sgfService, () => this.updateUI());
        this.fileMenuController = new FileMenuController(this.dropdownManager, this.sgfService, this.renderer, this.qrManager, () => this.updateUI(), () => this.updateSGFPanel(), () => this.toolbarController.updateAnswerButtonDisplay());
        // デバッグ用：GameStore を globalThis から見えるようにする
        globalThis.store = this.store;
        this.sgfTextArea = document.getElementById("sgf-text");
    }
    initialize() {
        this.initAppModeToggle();
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
            this.sgfService.apply(urlResult);
            this.renderer.updateBoardSize();
            this.updateUI();
            this.toolbarController.updateAnswerButtonDisplay();
            this.renderer.showMessage(`URL からSGF読み込み完了 (${urlResult.moves.length}手)`);
        }
        const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
        const altBtn = document.getElementById("btn-alt");
        sizeBtn === null || sizeBtn === void 0 ? void 0 : sizeBtn.classList.add("active");
        altBtn === null || altBtn === void 0 ? void 0 : altBtn.classList.add("active");
    }
    updateUI() {
        this.syncSGFStateWithMode();
        this.renderer.render();
        this.renderer.updateInfo();
        this.renderer.updateSlider();
        this.toolbarController.updateModeDependentUI();
        this.updateAppModeToggleUI();
        this.updateLayoutForMode();
        this.updateSGFPanel();
    }
    syncSGFStateWithMode() {
        if (this.store.appMode === "edit") {
            this.sgfService.updateProblemSGFFromBoard();
        }
        else if (this.store.appMode === "solve") {
            this.sgfService.buildSolutionSGF();
        }
    }
    updateLayoutForMode() {
        const wrapper = this.elements.boardWrapper;
        const slider = this.elements.sliderEl;
        if (!wrapper)
            return;
        const mode = this.store.appMode;
        wrapper.classList.remove("mode-edit", "mode-solve");
        wrapper.classList.add(`mode-${mode}`);
        if (slider) {
            const timeline = this.store.getMoveTimeline();
            const hasMoves = timeline.effectiveLength > 0;
            slider.disabled = !hasMoves;
            slider.classList.toggle("mode-locked", !hasMoves);
        }
    }
    updateSGFPanel() {
        if (!this.sgfTextArea) {
            return;
        }
        const mode = this.store.appMode;
        const s = this.store.snapshot;
        if (mode === "edit") {
            this.sgfTextArea.value = s.problemSGF;
        }
        if (mode === "solve") {
            this.sgfTextArea.value = s.solutionSGF;
        }
    }
    createKeyBindings() {
        return {
            q: () => this.toolbarController.triggerButton('.size-btn[data-size="9"]'),
            w: () => this.toolbarController.triggerButton('.size-btn[data-size="13"]'),
            e: () => this.toolbarController.triggerButton('.size-btn[data-size="19"]'),
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
    initResizeEvents() {
        const handleResize = () => {
            this.renderer.updateBoardSize();
            setTimeout(() => this.renderer.render(), 200);
            this.dropdownManager.repositionActive();
        };
        window.addEventListener("orientationchange", handleResize);
        window.addEventListener("resize", handleResize);
    }
    initAppModeToggle() {
        if (this.modeToggleContainer) {
            return;
        }
        const controls = document.getElementById("controls");
        if (!controls) {
            return;
        }
        const container = document.createElement("div");
        container.classList.add("app-mode-toggle");
        container.style.gridColumn = "1 / -1";
        const modes = [
            { mode: "edit", label: "✏️ 編集" },
            { mode: "solve", label: "🧠 解答" },
        ];
        modes.forEach(({ mode, label }) => {
            const button = document.createElement("button");
            button.type = "button";
            button.classList.add("ctrl-btn", "mode-btn");
            button.dataset.mode = mode;
            button.textContent = label;
            button.addEventListener("click", () => this.handleAppModeToggle(mode));
            container.appendChild(button);
            this.appModeButtons[mode] = button;
        });
        controls.prepend(container);
        this.modeToggleContainer = container;
        this.updateAppModeToggleUI();
    }
    handleAppModeToggle(mode) {
        if (this.store.appMode === mode) {
            return;
        }
        const state = this.store.snapshot;
        if (mode === "edit") {
            if (state.numberMode) {
                state.numberMode = false;
                state.turn = state.sgfIndex;
                state.answerMode = "black";
                this.toolbarController.updateAnswerButtonDisplay();
            }
            this.enterEditMode();
        }
        else if (mode === "solve") {
            this.enterSolveMode();
        }
        this.updateUI();
    }
    enterEditMode() {
        this.sgfService.applyProblemSGFToBoard();
        const state = this.store.snapshot;
        state.solutionMoveList = [];
        state.originalMoveList = [];
        state.sgfMoves = [];
        state.history = [];
        state.sgfIndex = 0;
        state.numberStartIndex = 0;
        state.turn = 0;
        state.numberMode = false;
        this.store.setAppMode("edit");
    }
    enterSolveMode() {
        this.sgfService.applyProblemSGFToBoard();
        const state = this.store.snapshot;
        state.solutionMoveList = [];
        state.originalMoveList = [];
        state.sgfMoves = [];
        state.history = [];
        state.sgfIndex = 0;
        state.numberStartIndex = 0;
        state.turn = 0;
        state.numberMode = false;
        state.startColor = state.answerMode === "white" ? 2 : 1;
        state.solutionSGF = state.problemSGF;
        this.store.setAppMode("solve");
    }
    updateAppModeToggleUI() {
        const currentMode = this.store.appMode;
        Object.entries(this.appModeButtons).forEach(([mode, button]) => {
            if (!button) {
                return;
            }
            const isActive = mode === currentMode;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }
}
//# sourceMappingURL=ui-controller.js.map