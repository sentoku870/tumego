import { GoEngine } from '../go-engine.js';
import { SGFParser } from '../sgf-parser.js';
import { QRManager } from '../qr-manager.js';
import { HistoryManager } from '../history-manager.js';
import { GameStore } from '../state/game-store.js';
import { Renderer } from '../renderer/renderer.js';
import { BoardCaptureService } from '../services/board-capture-service.js';
import { SGFService } from '../services/sgf-service.js';
import { SGFIO } from '../services/sgf-io.js';
import { SGFShare } from '../services/sgf-share.js';
import { PreferencesStore } from '../services/preferences-store.js';
import { UIInteractionState } from '../ui/state/ui-interaction-state.js';
import { DropdownManager } from '../ui/controllers/dropdown-manager.js';
import { BoardInteractionController } from '../ui/controllers/board-interaction-controller.js';
import { ToolbarController } from '../ui/controllers/toolbar-controller.js';
import { FeatureMenuController } from '../ui/controllers/feature-menu-controller.js';
import { FileMenuController } from '../ui/controllers/file-menu-controller.js';
import { SettingsController } from '../ui/controllers/settings-controller.js';
import { UIEventBus } from './event-bus.js';
export function compositionRoot(state, elements) {
    const eventBus = new UIEventBus();
    const engine = new GoEngine();
    const sgfParser = new SGFParser();
    const historyManager = new HistoryManager();
    const uiState = new UIInteractionState();
    const preferences = new PreferencesStore();
    const dropdownManager = new DropdownManager(uiState);
    const store = new GameStore(state, engine, historyManager);
    const renderer = new Renderer(store, elements, () => preferences.state);
    const boardCapture = new BoardCaptureService(elements.svg, renderer);
    const sgfIO = new SGFIO(sgfParser);
    const sgfShare = new SGFShare(sgfParser);
    const qrManager = new QRManager(sgfParser, sgfShare);
    const sgfService = new SGFService(sgfParser, store, sgfIO, sgfShare);
    const toolbar = new ToolbarController(store, renderer, boardCapture, elements, eventBus, preferences);
    const board = new BoardInteractionController(store, elements, uiState, eventBus, preferences);
    const feature = new FeatureMenuController(dropdownManager, renderer, elements, store, sgfService, eventBus);
    const file = new FileMenuController(dropdownManager, sgfService, renderer, qrManager, store, eventBus);
    const settings = new SettingsController(preferences);
    // EventBus と Renderer の接続:
    // emitUIUpdate() が呼ばれたときに盤面を再描画する。
    // 過去の UIController.updateUI() メソッドの動作を復元する形。
    eventBus.onUIUpdate(() => {
        renderer.render();
        renderer.updateInfo();
        renderer.updateSlider();
        renderer.updateCapturedStones(preferences.state.solve.showCapturedStones);
        feature.updateMenuState();
        toolbar.updateToolbarState();
    });
    return {
        store,
        renderer,
        sgfService,
        preferences,
        qrManager,
        boardCapture,
        dropdownManager,
        eventBus,
        controllers: { board, toolbar, feature, file, settings }
    };
}
//# sourceMappingURL=composition-root.js.map