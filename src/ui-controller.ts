// ============ UI制御エンジン ============
import {
  GameState,
  UIElements,
  KeyBindings,
  DEFAULT_CONFIG
} from './types.js';
import { GoEngine } from './go-engine.js';
import { Renderer } from './renderer.js';
import { SGFParser } from './sgf-parser.js';
import { QRManager } from './qr-manager.js';
import { HistoryManager } from './history-manager.js';
import { GameStore } from './state/game-store.js';
import { BoardCaptureService } from './services/board-capture-service.js';
import { SGFService } from './services/sgf-service.js';
import { UIInteractionState } from './ui/state/ui-interaction-state.js';
import { DropdownManager } from './ui/controllers/dropdown-manager.js';
import { BoardInteractionController } from './ui/controllers/board-interaction-controller.js';
import { KeyboardController } from './ui/controllers/keyboard-controller.js';
import { ToolbarController } from './ui/controllers/toolbar-controller.js';
import { FeatureMenuController } from './ui/controllers/feature-menu-controller.js';
import { FileMenuController } from './ui/controllers/file-menu-controller.js';
import { debugLog } from './ui/debug-logger.js';

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
  }

  initialize(): void {
    this.boardController.initialize();
    this.toolbarController.initialize();
    this.featureMenuController.initialize();
    this.fileMenuController.initialize();
    this.keyboardController.initialize(this.createKeyBindings());
    this.initResizeEvents();
    this.initDebugLogging();

    this.store.initBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);

    setTimeout(() => {
      this.renderer.updateBoardSize();
      this.updateUI();
    }, 100);

    this.updateUI();
    this.toolbarController.updateAnswerButtonDisplay();

    this.historyManager.clear();
    this.historyManager.save('アプリケーション開始', this.state);

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
  }

  private initDebugLogging(): void {
    this.registerDebugButtonLog('btn-answer', () => {
      const state = this.store.snapshot;
      return `解答モードボタン押下: mode=${state.answerMode}, numberMode=${state.numberMode}`;
    });
    this.registerDebugButtonLog('btn-erase', '編集モードボタン押下: 消去');

    this.registerDebugButtonLog('btn-black', () => `配置モード切替: 黒配置 startColor=${this.store.snapshot.startColor}`);
    this.registerDebugButtonLog('btn-white', () => `配置モード切替: 白配置 startColor=${this.store.snapshot.startColor}`);
    this.registerDebugButtonLog('btn-alt', () => `配置モード切替: 交互配置 startColor=${this.store.snapshot.startColor}`);

    const slider = this.elements.sliderEl;
    slider?.addEventListener('input', () => {
      const state = this.store.snapshot;
      debugLog.log(`スライダー変更: index=${slider.value}/${state.sgfMoves.length}`);
    });

    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    sgfTextarea?.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text') ?? '';
      debugLog.log(`SGF貼り付け検知: ${pasted.length}文字`);
    });

    const debugToggle = document.getElementById('btn-debug-toggle');
    if (debugToggle) {
      this.updateDebugToggleLabel(debugToggle);
      debugToggle.addEventListener('click', () => {
        const nextEnabled = !debugLog.enabled;
        if (!nextEnabled) {
          debugLog.log('デバッグログを無効化');
        }
        debugLog.enabled = nextEnabled;
        this.updateDebugToggleLabel(debugToggle);
        if (nextEnabled) {
          debugLog.log('デバッグログを有効化');
        }
      });
    }
  }

  private registerDebugButtonLog(elementId: string, message: string | (() => string)): void {
    const button = document.getElementById(elementId);
    if (!button) {
      return;
    }

    button.addEventListener('click', () => {
      const text = typeof message === 'function' ? message() : message;
      debugLog.log(text);
    });
  }

  private updateDebugToggleLabel(element: Element): void {
    const button = element as HTMLElement;
    button.textContent = debugLog.enabled ? 'ログOFF' : 'ログON';
  }

  private syncSgfTextarea(text: string): void {
    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = text;
    }
  }

  private createKeyBindings(): KeyBindings {
    return {
      'q': () => this.toolbarController.triggerButton('.size-btn[data-size="9"]'),
      'w': () => this.toolbarController.triggerButton('.size-btn[data-size="13"]'),
      'e': () => this.toolbarController.triggerButton('.size-btn[data-size="19"]'),
      'a': () => this.toolbarController.triggerButton('#btn-clear'),
      's': () => this.toolbarController.triggerButton('#btn-undo'),
      'd': () => this.toolbarController.triggerButton('#btn-erase'),
      'z': () => this.toolbarController.triggerButton('#btn-black'),
      'x': () => this.toolbarController.triggerButton('#btn-alt'),
      'c': () => this.toolbarController.triggerButton('#btn-white'),
      'ArrowLeft': () => this.toolbarController.triggerButton('#btn-prev-move'),
      'ArrowRight': () => this.toolbarController.triggerButton('#btn-next-move')
    };
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
}
