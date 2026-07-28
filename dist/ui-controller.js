// ============ UI制御エンジン ============
import { DEFAULT_CONFIG } from './types.js';
import { compositionRoot } from './app/composition-root.js';
function countMainLineMoves(root) {
    var _a, _b;
    let count = 0;
    let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
    while (node) {
        if (node.move)
            count++;
        node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
    }
    return count;
}
/** 自動プロファイル判定でスマートフォンと判定する window.innerWidth の上限 (px) */
const PHONE_BREAKPOINT = 640;
/** 自動プロファイル判定でタブレットと判定する window.innerWidth の上限 (px) */
const TABLET_BREAKPOINT = 1024;
export class UIController {
    constructor(state, elements, app) {
        this.state = state;
        this.elements = elements;
        this.app = app !== null && app !== void 0 ? app : compositionRoot(state, elements);
        this.app.eventBus.onSgfApplied((sgfText) => this.syncSgfTextarea(sgfText));
    }
    syncSgfTextarea(text) {
        const sgfTextarea = document.getElementById('sgf-text');
        if (sgfTextarea) {
            sgfTextarea.value = text;
        }
    }
    initialize() {
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
            const moveCount = countMainLineMoves(urlResult.rootNode);
            renderer.showMessage(`URL からSGF読み込み完了 (${moveCount}手)`);
        }
        const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
        const altBtn = document.getElementById('btn-alt');
        sizeBtn === null || sizeBtn === void 0 ? void 0 : sizeBtn.classList.add('active');
        altBtn === null || altBtn === void 0 ? void 0 : altBtn.classList.add('active');
    }
    initResizeEvents() {
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
    applyPreferences() {
        const { controllers, renderer, preferences } = this.app;
        const prefs = preferences.state;
        controllers.toolbar.updateFullResetVisibility();
        renderer.updateCapturedStones(prefs.solve.showCapturedStones);
        this.applyDeviceProfileClass(prefs.ui.deviceProfile);
    }
    getEffectiveDeviceProfile(preference) {
        if (preference !== 'auto') {
            return preference;
        }
        const width = window.innerWidth;
        if (width < PHONE_BREAKPOINT)
            return 'phone';
        if (width < TABLET_BREAKPOINT)
            return 'tablet';
        return 'desktop';
    }
    applyDeviceProfileClass(preference) {
        const effectiveProfile = this.getEffectiveDeviceProfile(preference);
        const body = document.body;
        body.classList.remove('device-desktop', 'device-phone', 'device-tablet');
        body.classList.add(`device-${effectiveProfile}`);
    }
}
//# sourceMappingURL=ui-controller.js.map