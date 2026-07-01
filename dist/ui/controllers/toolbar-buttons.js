import { HistoryView } from '../views/history-view.js';
export class ToolbarButtons {
    constructor(store, renderer, boardCapture, elements, eventBus) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.elements = elements;
        this.eventBus = eventBus;
        this.clearBtn = null;
        this.problemBtn = null;
        this.answerBtn = null;
        this.prevMoveBtn = null;
        this.nextMoveBtn = null;
        this.blackBtn = null;
        this.whiteBtn = null;
        this.eraseBtn = null;
        this.altBtn = null;
        this.undoBtn = null;
        this.exitSolveBtn = null;
        this.unsubscribeFromEventBus = null;
    }
    bindAll() {
        this.store.resetInteractionModes();
        this.bindSizeButtons();
        this.bindBasicButtons();
        this.bindGameButtons();
        this.bindBoardSaveButton();
        this.unsubscribeFromEventBus = this.eventBus.onEraseModeDisable(() => {
            this.dispatchDisableEraseMode();
        });
    }
    dispose() {
        var _a;
        (_a = this.unsubscribeFromEventBus) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribeFromEventBus = null;
    }
    triggerButton(selector) {
        const button = document.querySelector(selector);
        button === null || button === void 0 ? void 0 : button.click();
    }
    ensureButtonRefs() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        this.clearBtn = (_a = this.clearBtn) !== null && _a !== void 0 ? _a : document.getElementById('btn-clear');
        this.problemBtn = (_b = this.problemBtn) !== null && _b !== void 0 ? _b : document.getElementById('btn-problem');
        this.answerBtn = (_c = this.answerBtn) !== null && _c !== void 0 ? _c : document.getElementById('btn-answer');
        this.prevMoveBtn = (_d = this.prevMoveBtn) !== null && _d !== void 0 ? _d : document.getElementById('btn-prev-move');
        this.nextMoveBtn = (_e = this.nextMoveBtn) !== null && _e !== void 0 ? _e : document.getElementById('btn-next-move');
        this.blackBtn = (_f = this.blackBtn) !== null && _f !== void 0 ? _f : document.getElementById('btn-black');
        this.whiteBtn = (_g = this.whiteBtn) !== null && _g !== void 0 ? _g : document.getElementById('btn-white');
        this.eraseBtn = (_h = this.eraseBtn) !== null && _h !== void 0 ? _h : document.getElementById('btn-erase');
        this.altBtn = (_j = this.altBtn) !== null && _j !== void 0 ? _j : document.getElementById('btn-alt');
        this.undoBtn = (_k = this.undoBtn) !== null && _k !== void 0 ? _k : document.getElementById('btn-undo');
        this.exitSolveBtn = (_l = this.exitSolveBtn) !== null && _l !== void 0 ? _l : document.getElementById('btn-exit-solve-edit');
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
        this.clearBtn = document.getElementById('btn-clear');
        if (this.clearBtn) {
            this.clearBtn.title = '盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）';
        }
        (_a = this.clearBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            const state = this.store.snapshot;
            this.dispatchDisableEraseMode();
            this.store.resetForClearAll();
            this.eventBus.emitUIUpdate();
            this.eventBus.emitAnswerButtonUpdate();
            document.getElementById('sgf-text').value = '';
        });
        this.undoBtn = document.getElementById('btn-undo');
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
        this.eraseBtn = document.getElementById('btn-erase');
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
        this.blackBtn = document.getElementById('btn-black');
        (_d = this.blackBtn) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            if (this.blackBtn)
                this.setMode('black', this.blackBtn);
        });
        this.whiteBtn = document.getElementById('btn-white');
        (_e = this.whiteBtn) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            if (this.whiteBtn)
                this.setMode('white', this.whiteBtn);
        });
        this.altBtn = document.getElementById('btn-alt');
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
        this.prevMoveBtn = document.getElementById('btn-prev-move');
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
        this.nextMoveBtn = document.getElementById('btn-next-move');
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
        this.answerBtn = document.getElementById('btn-answer');
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
        this.exitSolveBtn = document.getElementById('btn-exit-solve-edit');
        (_d = this.exitSolveBtn) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            if (!this.store.snapshot.numberMode) {
                this.store.enterSolveMode();
                this.store.setAnswerMode('black');
                this.store.setStartColor(1);
            }
            else {
                this.store.exitSolveModeToEmptyBoard();
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
        this.problemBtn = document.getElementById('btn-problem');
        (_e = this.problemBtn) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            this.dispatchDisableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                this.store.setProblemDiagram();
                this.store.setAnswerMode('black');
                this.eventBus.emitUIUpdate();
                this.renderer.showMessage('問題図を確定しました');
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
    setMode(mode, buttonElement) {
        this.dispatchDisableEraseMode();
        this.store.setMode(mode);
        this.setActiveButton(buttonElement, 'play-btn');
        this.eventBus.emitUIUpdate();
    }
    setActiveButton(element, groupClass) {
        document
            .querySelectorAll(`.${groupClass}`)
            .forEach((btn) => btn.classList.remove('active'));
        element.classList.add('active');
    }
}
//# sourceMappingURL=toolbar-buttons.js.map