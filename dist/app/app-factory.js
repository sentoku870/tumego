import { GoEngine } from '../go-engine.js';
import { SGFParser } from '../sgf-parser.js';
import { QRManager } from '../qr-manager.js';
import { HistoryManager } from '../history-manager.js';
import { GameStore } from '../state/game-store.js';
import { Renderer } from '../renderer/renderer.js';
import { RendererSnapshotAdapter } from '../renderer/renderer-snapshot.js';
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
import { HandicapDialog } from '../ui/controllers/feature-menu/handicap-dialog.js';
import { UIEventBus } from './event-bus.js';
import { UIUpdateCoordinator } from './ui-update-coordinator.js';
/**
 * 依存を組み立てて AppContext を生成する Factory。
 * register() でテスト時の依存差し替えが可能。
 */
export class AppFactory {
    constructor() {
        this.engineOverride = null;
        this.sgfParserOverride = null;
    }
    /** テスト用: Engine を差し替え */
    registerEngine(engine) {
        this.engineOverride = engine;
        return this;
    }
    /** テスト用: SGFParser を差し替え */
    registerSgfParser(parser) {
        this.sgfParserOverride = parser;
        return this;
    }
    /** アプリケーションコンテキストを生成する */
    create(state, elements) {
        var _a, _b;
        const eventBus = new UIEventBus();
        const engine = (_a = this.engineOverride) !== null && _a !== void 0 ? _a : new GoEngine();
        const sgfParser = (_b = this.sgfParserOverride) !== null && _b !== void 0 ? _b : new SGFParser();
        const historyManager = new HistoryManager();
        const uiState = new UIInteractionState();
        const preferences = new PreferencesStore();
        const dropdownManager = new DropdownManager(uiState);
        const store = new GameStore(state, engine, historyManager);
        const renderer = new Renderer(store, elements, () => preferences.state, uiState);
        const renderSnapshot = new RendererSnapshotAdapter(renderer);
        const boardCapture = new BoardCaptureService(elements.svg, renderSnapshot, (msg) => renderer.showMessage(msg));
        const sgfIO = new SGFIO(sgfParser);
        const sgfShare = new SGFShare(sgfParser);
        const qrManager = new QRManager(sgfParser, sgfShare);
        const sgfService = new SGFService(sgfParser, store, sgfIO, sgfShare);
        const handicapDialog = new HandicapDialog(store, renderer, eventBus);
        const toolbar = new ToolbarController(store, renderer, boardCapture, sgfService, elements, eventBus, preferences, dropdownManager, handicapDialog);
        const board = new BoardInteractionController(store, elements, uiState, eventBus, preferences, () => toolbar.closeMarkerPalette());
        const feature = new FeatureMenuController(dropdownManager, renderer, elements, store, sgfService, eventBus);
        const file = new FileMenuController(dropdownManager, sgfService, renderer, qrManager, store, eventBus);
        const settings = new SettingsController(preferences);
        // EventBus と Renderer の接続:
        // emitUIUpdate() が呼ばれたときに盤面を再描画する。
        // 更新手順は UIUpdateCoordinator に集約。
        const uiUpdateCoordinator = new UIUpdateCoordinator(renderer, feature, toolbar, preferences);
        eventBus.onUIUpdate(() => uiUpdateCoordinator.applyUIUpdate());
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
}
/**
 * 後方互換: 既存の compositionRoot() 関数呼び出しは引き続き動作する。
 * 内部的には AppFactory.create() に委譲する。
 */
export function compositionRoot(state, elements) {
    return new AppFactory().create(state, elements);
}
//# sourceMappingURL=app-factory.js.map