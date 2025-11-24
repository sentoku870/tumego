// ============ UI制御エンジン ============
import { GameState, UIElements, DEFAULT_CONFIG } from './types.js';
import { GoEngine } from './go-engine.js';
import { Renderer } from './renderer.js';
import { SGFParser } from './sgf-parser.js';
import { QRManager } from './qr-manager.js';
import { HistoryManager } from './history-manager.js';
import { GameStore } from './state/game-store.js';
import { BoardCaptureService } from './services/board-capture-service.js';
import { PreferencesStore } from './services/preferences-store.js';
import { SGFService } from './services/sgf-service.js';
import { UIInteractionState } from './ui/state/ui-interaction-state.js';
import { DropdownManager } from './ui/controllers/dropdown-manager.js';
import { BoardInteractionController } from './ui/controllers/board-interaction-controller.js';
import { ToolbarController } from './ui/controllers/toolbar-controller.js';
import { FeatureMenuController } from './ui/controllers/feature-menu-controller.js';
import { FileMenuController } from './ui/controllers/file-menu-controller.js';
import { SettingsController } from './ui/controllers/settings-controller.js';

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
  private toolbarController: ToolbarController;
  private featureMenuController: FeatureMenuController;
  private fileMenuController: FileMenuController;
  private settingsController: SettingsController;
  private preferences: PreferencesStore;

  constructor(
    private readonly state: GameState,
    private readonly elements: UIElements
  ) {
    this.engine = new GoEngine();
    this.sgfParser = new SGFParser();
    this.qrManager = new QRManager();
    this.historyManager = new HistoryManager();
    this.store = new GameStore(state, this.engine, this.historyManager);
    this.preferences = new PreferencesStore();
    this.renderer = new Renderer(this.store, elements);
    this.boardCapture = new BoardCaptureService(elements.svg, this.renderer);
    this.sgfService = new SGFService(this.sgfParser, this.store);
    this.uiState = new UIInteractionState();
    this.dropdownManager = new DropdownManager(this.uiState);

    this.toolbarController = new ToolbarController(
      this.store,
      this.renderer,
      this.boardCapture,
      this.elements,
      () => this.updateUI(),
      () => this.preferences.state
    );

    this.boardController = new BoardInteractionController(
      this.store,
      this.elements,
      this.uiState,
      () => this.updateUI(),
      () => this.toolbarController.disableEraseMode(),
      () => this.preferences.state
    );

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

    this.settingsController = new SettingsController(this.preferences);
  }

  
  initialize(): void {
    this.boardController.initialize();
    this.toolbarController.initialize();
    this.featureMenuController.initialize();
    this.fileMenuController.initialize();
    this.settingsController.initialize();

    this.applyPreferences();
    this.preferences.onChange(() => this.applyPreferences());

    this.initResizeEvents();

    this.store.initBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);

    setTimeout(() => {
      this.renderer.updateBoardSize();
      this.updateUI();
    }, 100);

    this.updateUI();
    this.toolbarController.updateAnswerButtonDisplay();

    this.historyManager.clear();

    const urlResult = this.sgfService.loadFromURL();
    if (urlResult) {
      const applyResult = this.sgfService.apply(urlResult);
      this.renderer.updateBoardSize();
      this.updateUI();
      this.syncSgfTextarea(applyResult.sgfText);
      this.toolbarController.updateAnswerButtonDisplay();
      this.renderer.showMessage(`URL からSGF読み込み完了 (${urlResult.moves.length}手)`);
    }

    const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
    const altBtn = document.getElementById('btn-alt');
    sizeBtn?.classList.add('active');
    altBtn?.classList.add('active');
  }

  private updateUI(): void {
    this.renderer.render();
    this.renderer.updateInfo();
    this.renderer.updateSlider();
    this.renderer.updateCapturedStones(
      this.preferences.state.solve.showCapturedStones === "on"
    );
    this.toolbarController.refreshControls();
  }

  private syncSgfTextarea(text: string): void {
    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = text;
    }
  }


  private initResizeEvents(): void {
    const handleResize = () => {
      this.renderer.updateBoardSize();
      setTimeout(() => this.renderer.render(), 200);
      this.dropdownManager.repositionActive();
    };

    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);
  }

  private applyPreferences(): void {
    const prefs = this.preferences.state;
    this.toolbarController.refreshControls();
    this.renderer.updateCapturedStones(
      prefs.solve.showCapturedStones === "on"
    );
  }
}
