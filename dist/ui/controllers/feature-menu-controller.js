import { OutsideClickListener } from '../../services/outside-click-listener.js';
import { AnswerCopy } from './feature-menu/answer-copy.js';
export class FeatureMenuController {
    constructor(dropdownManager, renderer, elements, store, sgfService, eventBus) {
        this.dropdownManager = dropdownManager;
        this.renderer = renderer;
        this.elements = elements;
        this.store = store;
        this.eventBus = eventBus;
        this.isHorizontal = document.body.classList.contains('horizontal');
        this.copyAnswerButton = null;
        this.unsubscribeOutsideClick = null;
        this.answerCopy = new AnswerCopy(store, renderer, sgfService);
    }
    initialize() {
        var _a;
        const featureBtn = document.getElementById('btn-feature');
        const featureDropdown = document.getElementById('feature-dropdown');
        const featureLayoutBtn = document.getElementById('btn-feature-layout');
        const featureRotateBtn = document.getElementById('btn-feature-rotate');
        this.copyAnswerButton = document.getElementById('feature-copy-answer-sequence');
        if (featureLayoutBtn) {
            featureLayoutBtn.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
        }
        featureBtn === null || featureBtn === void 0 ? void 0 : featureBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileDropdown = document.getElementById('file-dropdown');
            const isOpen = featureDropdown === null || featureDropdown === void 0 ? void 0 : featureDropdown.classList.contains('show');
            this.dropdownManager.hide(fileDropdown);
            if (featureDropdown && featureBtn) {
                if (isOpen) {
                    this.dropdownManager.hide(featureDropdown);
                }
                else {
                    this.dropdownManager.open(featureBtn, featureDropdown);
                }
            }
        });
        if (featureDropdown) {
            const listener = new OutsideClickListener();
            this.unsubscribeOutsideClick = listener.subscribe([featureDropdown], () => this.dropdownManager.hide(featureDropdown));
        }
        featureDropdown === null || featureDropdown === void 0 ? void 0 : featureDropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        featureLayoutBtn === null || featureLayoutBtn === void 0 ? void 0 : featureLayoutBtn.addEventListener('click', () => {
            this.toggleLayout(featureLayoutBtn, featureDropdown);
        });
        featureRotateBtn === null || featureRotateBtn === void 0 ? void 0 : featureRotateBtn.addEventListener('click', () => {
            this.rotateBoard();
            this.dropdownManager.hide(featureDropdown);
        });
        (_a = this.copyAnswerButton) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.answerCopy.copy();
        });
    }
    /**
     * 登録した document-level リスナーを解放する。
     * HMR やテストで initialize() を再呼び出しする際に呼び出す
     * （2026-08-12 修正: B-10 リスナーリーク）。
     */
    dispose() {
        var _a;
        (_a = this.unsubscribeOutsideClick) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribeOutsideClick = null;
    }
    /**
     * body.horizontal クラスから現在のレイアウト状態を再読込する。
     * 外部要因（CSS リロード、DevTools）でクラスが変わった場合に
     * 内部状態を同期する（2026-08-12 修正: B-12 isHorizontal 不整合）。
     * @returns 再読込後のレイアウト状態（true: 横レイアウト）
     */
    syncLayoutState() {
        this.isHorizontal = document.body.classList.contains('horizontal');
        return this.isHorizontal;
    }
    updateMenuState() {
        const state = this.store.snapshot;
        const enabled = this.answerCopy.shouldEnable(state);
        this.setButtonEnabled(this.copyAnswerButton, enabled);
    }
    setButtonEnabled(button, enabled) {
        if (!button)
            return;
        button.disabled = !enabled;
        button.classList.toggle('disabled', !enabled);
    }
    toggleLayout(button, dropdown) {
        this.isHorizontal = !this.isHorizontal;
        document.body.classList.toggle('horizontal', this.isHorizontal);
        button.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
        this.dropdownManager.hide(dropdown);
        this.renderer.updateBoardSize();
    }
    rotateBoard() {
        const svg = this.elements.svg;
        const isRotated = svg.classList.contains('rotated');
        if (isRotated) {
            svg.classList.remove('rotated');
            this.renderer.showMessage('盤面を元に戻しました');
        }
        else {
            svg.classList.add('rotated');
            this.renderer.showMessage('盤面を180度回転しました');
        }
    }
}
//# sourceMappingURL=feature-menu-controller.js.map