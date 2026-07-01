// ============ UI制御エンジン ============
import { GameState, UIElements, DEFAULT_CONFIG, DeviceProfile } from './types.js';
import { AppContext, compositionRoot } from './app/composition-root.js';

/** 自動プロファイル判定でスマートフォンと判定する window.innerWidth の上限 (px) */
const PHONE_BREAKPOINT = 640;
/** 自動プロファイル判定でタブレットと判定する window.innerWidth の上限 (px) */
const TABLET_BREAKPOINT = 1024;

export class UIController {
  constructor(
    private readonly state: GameState,
    private readonly elements: UIElements,
    app?: AppContext
  ) {
    this.app = app ?? compositionRoot(state, elements);
    this.app.eventBus.onSgfApplied((sgfText) => this.syncSgfTextarea(sgfText));
  }

  private readonly app: AppContext;

  syncSgfTextarea(text: string): void {
    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = text;
    }
  }

  initialize(): void {
    const { controllers, store, eventBus, renderer, sgfService, preferences } = this.app;

    controllers.board.initialize();
    controllers.toolbar.initialize();
    controllers.feature.initialize();
    controllers.file.initialize();
    controllers.settings.initialize();

    this.applyPreferences();
    preferences.onChange(() => {
      this.applyPreferences();
      eventBus.emitUIUpdate();
    });

    this.initResizeEvents();

    store.initBoard(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE);

    setTimeout(() => {
      renderer.updateBoardSize();
      eventBus.emitUIUpdate();
    }, 100);

    eventBus.emitUIUpdate();
    eventBus.emitAnswerButtonUpdate();

    controllers.toolbar.updateAnswerButtonDisplay();

    store.historyManager.clear();

    const urlResult = sgfService.loadFromURL();
    if (urlResult) {
      const applyResult = sgfService.apply(urlResult);
      renderer.updateBoardSize();
      eventBus.emitUIUpdate();
      eventBus.emitSgfApplied(applyResult.sgfText);
      eventBus.emitAnswerButtonUpdate();
      controllers.file.syncHeaderEditor();
      renderer.showMessage(`URL からSGF読み込み完了 (${urlResult.moves.length}手)`);
    }

    const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
    const altBtn = document.getElementById('btn-alt');
    sizeBtn?.classList.add('active');
    altBtn?.classList.add('active');
  }

  private initResizeEvents(): void {
    const { renderer, dropdownManager, preferences } = this.app;

    const handleResize = () => {
      renderer.updateBoardSize();
      setTimeout(() => renderer.render(), 200);
      dropdownManager.repositionActive();
      if (preferences.state.ui.deviceProfile === 'auto') {
        this.applyDeviceProfileClass('auto');
      }
    };

    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);
  }

  private applyPreferences(): void {
    const { controllers, renderer, preferences } = this.app;
    const prefs = preferences.state;
    controllers.toolbar.updateFullResetVisibility();
    renderer.updateCapturedStones(
      prefs.solve.showCapturedStones
    );
    this.applyDeviceProfileClass(prefs.ui.deviceProfile);
  }

  private getEffectiveDeviceProfile(preference: DeviceProfile): DeviceProfile {
    if (preference !== 'auto') {
      return preference;
    }

    const width = window.innerWidth;
    if (width < PHONE_BREAKPOINT) return 'phone';
    if (width < TABLET_BREAKPOINT) return 'tablet';
    return 'desktop';
  }

  private applyDeviceProfileClass(preference: DeviceProfile): void {
    const effectiveProfile = this.getEffectiveDeviceProfile(preference);
    const body = document.body;
    body.classList.remove('device-desktop', 'device-phone', 'device-tablet');
    body.classList.add(`device-${effectiveProfile}`);
  }
}
