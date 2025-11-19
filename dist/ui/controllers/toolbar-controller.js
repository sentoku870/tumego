export class ToolbarController {
    constructor(store, renderer, boardCapture, elements, updateUI) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.elements = elements;
        this.updateUI = updateUI;
        this.playButtons = [];
        this.answerButton = null;
        this.navigationButtons = [];
    }
    initialize() {
        this.initSizeButtons();
        this.initBasicButtons();
        this.initGameButtons();
        this.initBoardSaveButton();
    }
    disableEraseMode() {
        const state = this.store.snapshot;
        if (!state.eraseMode) {
            return;
        }
        state.eraseMode = false;
        const eraseBtn = document.getElementById('btn-erase');
        eraseBtn === null || eraseBtn === void 0 ? void 0 : eraseBtn.classList.remove('active');
        this.renderer.showMessage('');
    }
    updateAnswerButtonDisplay() {
        const state = this.store.snapshot;
        const answerBtn = document.getElementById('btn-answer');
        if (!answerBtn) {
            return;
        }
        if (state.answerMode === 'white') {
            answerBtn.textContent = '⚪ 白先';
            answerBtn.classList.add('white-mode');
        }
        else {
            answerBtn.textContent = '🔥 黒先';
            answerBtn.classList.remove('white-mode');
        }
    }
    triggerButton(selector) {
        const button = document.querySelector(selector);
        button === null || button === void 0 ? void 0 : button.click();
    }
    initSizeButtons() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const element = btn;
                const size = parseInt(element.dataset.size, 10);
                const state = this.store.snapshot;
                if (size === state.boardSize) {
                    return;
                }
                if (state.sgfMoves.length > 0 || state.handicapStones > 0) {
                    this.store.historyManager.save(`${state.boardSize}路→${size}路変更前`, state);
                }
                this.store.initBoard(size);
                this.updateUI();
                this.setActiveButton(element, 'size-btn');
            });
        });
    }
    initBasicButtons() {
        const clearBtn = document.getElementById('btn-clear');
        clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
            const state = this.store.snapshot;
            if (state.sgfMoves.length > 0 || state.handicapStones > 0 ||
                state.board.some(row => row.some(cell => cell !== 0))) {
                this.store.historyManager.save(`全消去前（${state.sgfMoves.length}手）`, state);
            }
            this.disableEraseMode();
            this.store.initBoard(state.boardSize);
            this.updateUI();
        });
        const undoBtn = document.getElementById('btn-undo');
        undoBtn === null || undoBtn === void 0 ? void 0 : undoBtn.addEventListener('click', () => {
            this.store.undo();
            this.updateUI();
        });
        const eraseBtn = document.getElementById('btn-erase');
        eraseBtn === null || eraseBtn === void 0 ? void 0 : eraseBtn.addEventListener('click', () => {
            const state = this.store.snapshot;
            state.eraseMode = !state.eraseMode;
            if (state.eraseMode) {
                eraseBtn.classList.add('active');
                this.renderer.showMessage('消去モード');
            }
            else {
                eraseBtn.classList.remove('active');
                this.renderer.showMessage('');
            }
        });
        const blackBtn = document.getElementById('btn-black');
        blackBtn === null || blackBtn === void 0 ? void 0 : blackBtn.addEventListener('click', () => this.setMode('black', blackBtn));
        const whiteBtn = document.getElementById('btn-white');
        whiteBtn === null || whiteBtn === void 0 ? void 0 : whiteBtn.addEventListener('click', () => this.setMode('white', whiteBtn));
        const altBtn = document.getElementById('btn-alt');
        altBtn === null || altBtn === void 0 ? void 0 : altBtn.addEventListener('click', () => this.setMode('alt', altBtn));
        this.playButtons = [blackBtn, altBtn, whiteBtn].filter((btn) => Boolean(btn));
    }
    initGameButtons() {
        var _a;
        const prevBtn = document.getElementById('btn-prev-move');
        prevBtn === null || prevBtn === void 0 ? void 0 : prevBtn.addEventListener('click', () => {
            const state = this.store.snapshot;
            if (state.sgfIndex > 0) {
                this.store.setMoveIndex(state.sgfIndex - 1);
                this.updateUI();
            }
        });
        const nextBtn = document.getElementById('btn-next-move');
        nextBtn === null || nextBtn === void 0 ? void 0 : nextBtn.addEventListener('click', () => {
            const state = this.store.snapshot;
            if (state.sgfIndex < state.sgfMoves.length) {
                this.store.setMoveIndex(state.sgfIndex + 1);
                this.updateUI();
            }
        });
        this.navigationButtons = [prevBtn, nextBtn].filter((btn) => Boolean(btn));
        const answerBtn = document.getElementById('btn-answer');
        this.answerButton = answerBtn;
        answerBtn === null || answerBtn === void 0 ? void 0 : answerBtn.addEventListener('click', () => {
            this.disableEraseMode();
            const state = this.store.snapshot;
            state.answerMode = state.answerMode === 'white' ? 'black' : 'white';
            state.startColor = state.answerMode === 'white' ? 2 : 1;
            this.store.enterSolveMode();
            this.updateAnswerButtonDisplay();
            this.updateUI();
        });
        const historyBtn = document.getElementById('btn-history');
        historyBtn === null || historyBtn === void 0 ? void 0 : historyBtn.addEventListener('click', () => {
            this.store.historyManager.showHistoryDialog((index) => {
                if (this.store.historyManager.restore(index, this.store.snapshot)) {
                    this.updateUI();
                    this.renderer.showMessage('履歴を復元しました');
                }
            });
        });
        const problemBtn = document.getElementById('btn-problem');
        problemBtn === null || problemBtn === void 0 ? void 0 : problemBtn.addEventListener('click', () => {
            this.disableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                if (state.sgfMoves.length > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
                    this.store.historyManager.save(`問題図確定前（${state.sgfMoves.length}手）`, state);
                }
                this.store.setProblemDiagram();
                state.answerMode = 'black';
                this.updateAnswerButtonDisplay();
                this.updateUI();
                this.renderer.showMessage('問題図を確定しました');
            }
            else {
                if (!this.store.hasProblemDiagram()) {
                    this.renderer.showMessage('問題図が設定されていません');
                    return;
                }
                this.store.restoreProblemDiagram();
                this.updateUI();
                this.renderer.showMessage('問題図に戻しました');
            }
        });
        (_a = this.elements.sliderEl) === null || _a === void 0 ? void 0 : _a.addEventListener('input', (event) => {
            const target = event.target;
            const mode = this.store.appMode;
            if (mode !== 'review' && mode !== 'solve') {
                return;
            }
            if (mode === 'review' && this.store.reviewActive) {
                this.store.resetReview();
            }
            this.store.setMoveIndex(parseInt(target.value, 10));
            this.updateUI();
        });
    }
    initBoardSaveButton() {
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
        const currentMode = this.store.appMode;
        if (currentMode === 'review') {
            if (mode === 'black' || mode === 'white') {
                this.store.setReviewTurn(mode === 'black' ? 1 : 2);
                this.setActiveButton(buttonElement, 'play-btn');
                this.updateUI();
            }
            return;
        }
        if (currentMode !== 'edit') {
            return;
        }
        this.disableEraseMode();
        const state = this.store.snapshot;
        state.playMode = mode;
        this.setActiveButton(buttonElement, 'play-btn');
        this.updateUI();
    }
    setActiveButton(element, groupClass) {
        document.querySelectorAll(`.${groupClass}`).forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
    updateModeDependentUI() {
        const mode = this.store.appMode;
        const timeline = this.store.getMoveTimeline();
        const altButton = this.playButtons.find((btn) => btn.id === 'btn-alt');
        const colorButtons = this.playButtons.filter((btn) => btn.id !== 'btn-alt');
        this.setButtonsEnabled(colorButtons, mode === 'edit' || mode === 'review');
        if (altButton) {
            this.setButtonsEnabled([altButton], mode === 'edit');
        }
        if (this.answerButton) {
            this.setButtonsEnabled([this.answerButton], mode === 'solve');
        }
        const navEnabled = (mode === 'solve' || mode === 'review') && timeline.effectiveLength > 0;
        this.setButtonsEnabled(this.navigationButtons, navEnabled);
    }
    setButtonsEnabled(buttons, enabled) {
        buttons.forEach((button) => {
            button.disabled = !enabled;
            button.classList.toggle('disabled', !enabled);
            button.setAttribute('aria-disabled', String(!enabled));
        });
    }
}
//# sourceMappingURL=toolbar-controller.js.map