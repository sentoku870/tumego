import { HistoryView } from '../views/history-view.js';
import { ToolbarMarkerPalette } from './toolbar/toolbar-marker-palette.js';
export class ToolbarButtons {
    // ============ ボタン参照の読み取り専用ゲッター ============
    // 外部からの直接 DOM 操作を防ぐため、書き込みはメソッド経由のみとする。
    get clearBtn() { return this._clearBtn; }
    get problemBtn() { return this._problemBtn; }
    get answerBtn() { return this._answerBtn; }
    get prevMoveBtn() { return this._prevMoveBtn; }
    get nextMoveBtn() { return this._nextMoveBtn; }
    get blackBtn() { return this._blackBtn; }
    get whiteBtn() { return this._whiteBtn; }
    get eraseBtn() { return this._eraseBtn; }
    get altBtn() { return this._altBtn; }
    get undoBtn() { return this._undoBtn; }
    get exitSolveBtn() { return this._exitSolveBtn; }
    get markerBtn() { var _a, _b; return (_b = (_a = this._markerPalette) === null || _a === void 0 ? void 0 : _a._markerBtn) !== null && _b !== void 0 ? _b : null; }
    get markerDropdown() { var _a, _b; return (_b = (_a = this._markerPalette) === null || _a === void 0 ? void 0 : _a._markerDropdown) !== null && _b !== void 0 ? _b : null; }
    get markerPaletteBtns() { var _a, _b; return (_b = (_a = this._markerPalette) === null || _a === void 0 ? void 0 : _a._markerPaletteBtns) !== null && _b !== void 0 ? _b : {}; }
    get markerLetterBtn() { var _a, _b; return (_b = (_a = this._markerPalette) === null || _a === void 0 ? void 0 : _a._markerLetterBtn) !== null && _b !== void 0 ? _b : null; }
    get markerClearBtn() { var _a, _b; return (_b = (_a = this._markerPalette) === null || _a === void 0 ? void 0 : _a._markerClearBtn) !== null && _b !== void 0 ? _b : null; }
    constructor(store, renderer, boardCapture, sgfService, elements, eventBus, dropdownManager, handicapDialog) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.sgfService = sgfService;
        this.elements = elements;
        this.eventBus = eventBus;
        this.dropdownManager = dropdownManager;
        this.handicapDialog = handicapDialog;
        this._clearBtn = null;
        this._problemBtn = null;
        this._answerBtn = null;
        this._prevMoveBtn = null;
        this._nextMoveBtn = null;
        this._blackBtn = null;
        this._whiteBtn = null;
        this._eraseBtn = null;
        this._altBtn = null;
        this._undoBtn = null;
        this._exitSolveBtn = null;
        this.unsubscribeFromEventBus = null;
        this._markerPalette = new ToolbarMarkerPalette(store, eventBus, dropdownManager, () => this.dispatchDisableEraseMode());
    }
    bindAll() {
        this.store.resetInteractionModes();
        this.bindSizeButtons();
        this.bindBasicButtons();
        this.bindGameButtons();
        this.bindBoardSaveButton();
        this.bindHandicapButton();
        this._markerPalette.bindEvents();
        this.unsubscribeFromEventBus = this.eventBus.onEraseModeDisable(() => {
            this.dispatchDisableEraseMode();
        });
    }
    dispose() {
        var _a;
        (_a = this.unsubscribeFromEventBus) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribeFromEventBus = null;
        this._markerPalette.dispose();
    }
    triggerButton(selector) {
        const button = document.querySelector(selector);
        button === null || button === void 0 ? void 0 : button.click();
    }
    ensureButtonRefs() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        this._clearBtn = (_a = this._clearBtn) !== null && _a !== void 0 ? _a : document.getElementById('btn-clear');
        this._problemBtn = (_b = this._problemBtn) !== null && _b !== void 0 ? _b : document.getElementById('btn-problem');
        this._answerBtn = (_c = this._answerBtn) !== null && _c !== void 0 ? _c : document.getElementById('btn-answer');
        this._prevMoveBtn = (_d = this._prevMoveBtn) !== null && _d !== void 0 ? _d : document.getElementById('btn-prev-move');
        this._nextMoveBtn = (_e = this._nextMoveBtn) !== null && _e !== void 0 ? _e : document.getElementById('btn-next-move');
        this._blackBtn = (_f = this._blackBtn) !== null && _f !== void 0 ? _f : document.getElementById('btn-black');
        this._whiteBtn = (_g = this._whiteBtn) !== null && _g !== void 0 ? _g : document.getElementById('btn-white');
        this._eraseBtn = (_h = this._eraseBtn) !== null && _h !== void 0 ? _h : document.getElementById('btn-erase');
        this._altBtn = (_j = this._altBtn) !== null && _j !== void 0 ? _j : document.getElementById('btn-alt');
        this._undoBtn = (_k = this._undoBtn) !== null && _k !== void 0 ? _k : document.getElementById('btn-undo');
        this._exitSolveBtn = (_l = this._exitSolveBtn) !== null && _l !== void 0 ? _l : document.getElementById('btn-exit-solve-edit');
        this._markerPalette.ensureButtonRefs();
    }
    /** マーカー UI の active 表示を更新 (ToolbarState から呼ばれる) */
    setActiveMarkerButton() {
        this._markerPalette.setActiveButton();
    }
    /** マーカーパレットを閉じる (composition-root から呼ばれる) */
    closeMarkerPalette() {
        this._markerPalette.closePalette();
    }
    /** マーカーパレットへの直接アクセス (テスト用) */
    get markerPalette() {
        return this._markerPalette;
    }
    dispatchDisableEraseMode() {
        var _a;
        const state = this.store.snapshot;
        if (!state.eraseMode) {
            return;
        }
        this.store.setEraseMode(false);
        (_a = this.eraseBtn) === null || _a === void 0 ? void 0 : _a.classList.remove('active');
        this.renderer.showMessage('');
    }
    bindSizeButtons() {
        document.querySelectorAll('.size-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const element = btn;
                const sizeRaw = element.dataset.size;
                if (sizeRaw === undefined)
                    return;
                const size = parseInt(sizeRaw, 10);
                if (!Number.isFinite(size))
                    return;
                const state = this.store.snapshot;
                if (size === state.boardSize) {
                    return;
                }
                this.store.initBoard(size);
                this.eventBus.emitUIUpdate();
                this.eventBus.emitAnswerButtonUpdate();
                this.setActiveButton(element, 'size-btn');
            });
        });
    }
    bindBasicButtons() {
        var _a, _b, _c, _d, _e, _f;
        this._clearBtn = document.getElementById('btn-clear');
        if (this.clearBtn) {
            this.clearBtn.title = '盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）';
        }
        (_a = this.clearBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            this.store.resetForClearAll();
            this.eventBus.emitUIUpdate();
            this.eventBus.emitAnswerButtonUpdate();
            document.getElementById('sgf-text').value = '';
        });
        this._undoBtn = document.getElementById('btn-undo');
        if (this.undoBtn) {
            this.undoBtn.title = '編集・解答の履歴から1つ前の状態に戻ります（履歴ダイアログと同じ履歴を使用）';
        }
        (_b = this.undoBtn) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            const restored = this.store.undo();
            if (restored) {
                this.renderer.updateBoardSize();
            }
            this.eventBus.emitUIUpdate();
        });
        this._eraseBtn = document.getElementById('btn-erase');
        if (this.eraseBtn) {
            this.eraseBtn.title = '任意の石だけを消すモードをオン／オフします（盤面の他の状態は変わりません）';
        }
        (_c = this.eraseBtn) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            var _a, _b;
            const next = !this.store.snapshot.eraseMode;
            this.store.setEraseMode(next);
            if (next) {
                (_a = this.eraseBtn) === null || _a === void 0 ? void 0 : _a.classList.add('active');
                this.renderer.showMessage('消去モード');
            }
            else {
                (_b = this.eraseBtn) === null || _b === void 0 ? void 0 : _b.classList.remove('active');
                this.renderer.showMessage('');
            }
        });
        this._blackBtn = document.getElementById('btn-black');
        (_d = this.blackBtn) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            if (this.blackBtn)
                this.setMode('black', this.blackBtn);
        });
        this._whiteBtn = document.getElementById('btn-white');
        (_e = this.whiteBtn) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            if (this.whiteBtn)
                this.setMode('white', this.whiteBtn);
        });
        this._altBtn = document.getElementById('btn-alt');
        if (this.altBtn) {
            this.altBtn.title = '黒白交互に石を連続配置するモードです（先手色は黒先ボタンと連動）';
        }
        (_f = this.altBtn) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => {
            const state = this.store.snapshot;
            this.store.setStartColor(state.startColor === 1 ? 2 : 1);
            if (this.altBtn)
                this.setMode('alt', this.altBtn);
        });
    }
    bindGameButtons() {
        var _a, _b, _c, _d, _e, _f;
        this._prevMoveBtn = document.getElementById('btn-prev-move');
        if (this.prevMoveBtn) {
            this.prevMoveBtn.title = '読み上げ用の手順を1手戻ります（Undoとは別の1手戻る）';
        }
        (_a = this.prevMoveBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            const state = this.store.snapshot;
            if (state.sgfIndex > 0) {
                this.store.setMoveIndex(state.sgfIndex - 1);
                this.eventBus.emitUIUpdate();
            }
        });
        this._nextMoveBtn = document.getElementById('btn-next-move');
        if (this.nextMoveBtn) {
            this.nextMoveBtn.title = '読み上げ用の手順を1手進めます';
        }
        (_b = this.nextMoveBtn) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            const state = this.store.snapshot;
            if (state.sgfIndex < state.sgfMoves.length) {
                this.store.setMoveIndex(state.sgfIndex + 1);
                this.eventBus.emitUIUpdate();
            }
        });
        this._answerBtn = document.getElementById('btn-answer');
        (_c = this.answerBtn) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                return;
            }
            if (state.answerMode === 'black') {
                this.store.setAnswerMode('white');
                this.store.setStartColor(2);
            }
            else {
                this.store.setAnswerMode('black');
                this.store.setStartColor(1);
            }
            this.eventBus.emitUIUpdate();
        });
        this._exitSolveBtn = document.getElementById('btn-exit-solve-edit');
        (_d = this.exitSolveBtn) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            if (!this.store.snapshot.numberMode) {
                this.store.enterSolveMode();
                this.store.setAnswerMode('black');
                this.store.setStartColor(1);
            }
            else {
                this.store.exitSolveModeForEditing();
            }
            this.eventBus.emitUIUpdate();
        });
        const historyBtn = document.getElementById('btn-history');
        if (historyBtn) {
            historyBtn.title = '編集・解答の履歴一覧を開き、任意の状態にジャンプします';
        }
        historyBtn === null || historyBtn === void 0 ? void 0 : historyBtn.addEventListener('click', () => {
            const historyView = new HistoryView();
            historyView.render(this.store.historyManager.getList(), (index) => {
                if (this.store.restoreHistorySnapshot(index)) {
                    this.renderer.updateBoardSize();
                    this.eventBus.emitUIUpdate();
                    this.renderer.showMessage('履歴を復元しました');
                }
            }, () => this.store.historyManager.clear());
        });
        this._problemBtn = document.getElementById('btn-problem');
        (_e = this.problemBtn) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                this.store.setProblemDiagram();
                this.store.setAnswerMode('black');
                this.store.enterSolveMode();
                this.refreshSgfTextarea();
                this.eventBus.emitUIUpdate();
                this.renderer.showMessage('問題図を確定して解答を開始しました');
            }
            else {
                if (!this.store.hasProblemDiagram()) {
                    this.renderer.showMessage('問題図が設定されていません');
                    return;
                }
                this.store.restoreProblemDiagram();
                this.eventBus.emitUIUpdate();
                this.renderer.showMessage('問題図に戻しました');
            }
        });
        (_f = this.elements.sliderEl) === null || _f === void 0 ? void 0 : _f.addEventListener('input', (event) => {
            const target = event.target;
            const value = parseInt(target.value, 10);
            if (Number.isFinite(value)) {
                this.store.setMoveIndex(value);
                this.eventBus.emitUIUpdate();
            }
        });
    }
    bindBoardSaveButton() {
        const saveBtn = document.getElementById('btn-save-board');
        saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.addEventListener('click', () => {
            this.boardCapture.captureBoard().catch((error) => {
                console.error(error);
                const message = error instanceof Error ? error.message : String(error);
                alert(`盤面保存に失敗しました: ${message}`);
            });
        });
    }
    bindHandicapButton() {
        const handicapBtn = document.getElementById('btn-handicap');
        handicapBtn === null || handicapBtn === void 0 ? void 0 : handicapBtn.addEventListener('click', () => {
            this.handicapDialog.show();
        });
    }
    setMode(mode, buttonElement) {
        this.dispatchDisableEraseMode();
        this.store.setMode(mode);
        this.setActiveButton(buttonElement, 'play-btn');
        this.eventBus.emitUIUpdate();
    }
    refreshSgfTextarea() {
        const sgfTextarea = document.getElementById('sgf-text');
        if (sgfTextarea) {
            sgfTextarea.value = this.sgfService.export();
        }
    }
    setActiveButton(element, groupClass) {
        document
            .querySelectorAll(`.${groupClass}`)
            .forEach((btn) => btn.classList.remove('active'));
        element.classList.add('active');
    }
}
//# sourceMappingURL=toolbar-buttons.js.map