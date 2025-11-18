export class ToolbarController {
    constructor(store, renderer, boardCapture, elements, updateUI) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.elements = elements;
        this.updateUI = updateUI;
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
            // ★ SGF入力エリアを空にする（追加行）
            document.getElementById("sgf-text").value = "";
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
        altBtn === null || altBtn === void 0 ? void 0 : altBtn.addEventListener('click', () => {
            const state = this.store.snapshot;
            state.startColor = state.startColor === 1 ? 2 : 1;
            this.setMode('alt', altBtn);
        });
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
        const answerBtn = document.getElementById('btn-answer');
        answerBtn === null || answerBtn === void 0 ? void 0 : answerBtn.addEventListener('click', () => {
            this.disableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                if (state.sgfMoves.length > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
                    this.store.historyManager.save(`黒先解答開始前（${state.sgfMoves.length}手）`, state);
                }
                state.answerMode = 'black';
                this.store.startNumberMode(1);
            }
            else if (state.answerMode === 'black') {
                state.answerMode = 'white';
                this.store.startNumberMode(2);
            }
            else {
                state.answerMode = 'black';
                this.store.startNumberMode(1);
            }
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
            this.store.setMoveIndex(parseInt(target.value, 10));
            // ← これを追加（reviewモード強制解除）
            this.store.reviewMoves = [];
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
        this.disableEraseMode();
        const state = this.store.snapshot;
        state.mode = mode;
        if (state.numberMode) {
            state.numberMode = false;
            state.turn = state.sgfIndex;
            state.answerMode = 'black';
            this.updateAnswerButtonDisplay();
        }
        this.setActiveButton(buttonElement, 'play-btn');
        this.updateUI();
    }
    setActiveButton(element, groupClass) {
        document.querySelectorAll(`.${groupClass}`).forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
}
//# sourceMappingURL=toolbar-controller.js.map