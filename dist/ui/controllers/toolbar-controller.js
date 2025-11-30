export class ToolbarController {
    constructor(store, renderer, boardCapture, elements, updateUI, getPreferences) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.elements = elements;
        this.updateUI = updateUI;
        this.getPreferences = getPreferences;
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
    }
    initialize() {
        const state = this.store.snapshot;
        state.mode = "alt"; // 黒→白→黒→白（編集モードでの交互配置）
        state.numberMode = false; // 解答モードではない
        state.eraseMode = false;
        this.initSizeButtons();
        this.initBasicButtons();
        this.initGameButtons();
        this.initBoardSaveButton();
        this.updateFullResetVisibility();
    }
    disableEraseMode() {
        const state = this.store.snapshot;
        if (!state.eraseMode) {
            return;
        }
        state.eraseMode = false;
        const eraseBtn = document.getElementById("btn-erase");
        eraseBtn === null || eraseBtn === void 0 ? void 0 : eraseBtn.classList.remove("active");
        this.renderer.showMessage("");
    }
    // 黒先ボタン / 解答開始ボタンの表示更新
    updateAnswerButtonDisplay() {
        this.ensureButtonRefs();
        const state = this.store.snapshot;
        if (this.answerBtn) {
            // ラベルと見た目
            if (state.answerMode === "white") {
                this.answerBtn.textContent = "⚪ 白先";
                this.answerBtn.classList.add("white-mode");
            }
            else {
                this.answerBtn.textContent = "🔥 黒先";
                this.answerBtn.classList.remove("white-mode");
            }
            // ツールチップ
            if (state.numberMode) {
                this.answerBtn.title =
                    state.answerMode === "white"
                        ? "この問題を白番から解答します"
                        : "この問題を黒番から解答します";
            }
            else {
                // 編集モード中は「解答モード専用」であることだけ伝える
                this.answerBtn.title = "解答モード中のみ使用できます";
            }
        }
        if (this.exitSolveBtn) {
            if (state.numberMode) {
                this.exitSolveBtn.textContent = "編集に戻る";
                this.exitSolveBtn.title = "解答を終了して編集モードに戻ります";
            }
            else {
                this.exitSolveBtn.textContent = "解答開始";
                this.exitSolveBtn.title = "問題図から解答モードを開始します";
            }
            // 常に表示しておく（CSS 側のレイアウトに任せる）
            this.exitSolveBtn.style.display = "";
        }
    }
    triggerButton(selector) {
        const button = document.querySelector(selector);
        button === null || button === void 0 ? void 0 : button.click();
    }
    initSizeButtons() {
        document.querySelectorAll(".size-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const element = btn;
                const size = parseInt(element.dataset.size, 10);
                const state = this.store.snapshot;
                if (size === state.boardSize) {
                    return;
                }
                this.store.initBoard(size);
                this.updateUI();
                this.setActiveButton(element, "size-btn");
            });
        });
    }
    initBasicButtons() {
        var _a, _b, _c, _d, _e, _f;
        this.clearBtn = document.getElementById("btn-clear");
        if (this.clearBtn) {
            this.clearBtn.title = "盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）";
        }
        (_a = this.clearBtn) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
            const state = this.store.snapshot;
            this.disableEraseMode();
            this.store.resetForClearAll();
            this.updateUI();
            this.updateAnswerButtonDisplay();
            document.getElementById("sgf-text").value = "";
        });
        this.undoBtn = document.getElementById("btn-undo");
        if (this.undoBtn) {
            this.undoBtn.title = "編集・解答の履歴から1つ前の状態に戻ります（履歴ダイアログと同じ履歴を使用）";
        }
        (_b = this.undoBtn) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
            const restored = this.store.undo();
            if (restored) {
                this.renderer.updateBoardSize();
            }
            this.updateUI();
        });
        this.eraseBtn = document.getElementById("btn-erase");
        if (this.eraseBtn) {
            this.eraseBtn.title = "任意の石だけを消すモードをオン／オフします（盤面の他の状態は変わりません）";
        }
        (_c = this.eraseBtn) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
            var _a, _b;
            const state = this.store.snapshot;
            state.eraseMode = !state.eraseMode;
            if (state.eraseMode) {
                (_a = this.eraseBtn) === null || _a === void 0 ? void 0 : _a.classList.add("active");
                this.renderer.showMessage("消去モード");
            }
            else {
                (_b = this.eraseBtn) === null || _b === void 0 ? void 0 : _b.classList.remove("active");
                this.renderer.showMessage("");
            }
        });
        this.blackBtn = document.getElementById("btn-black");
        (_d = this.blackBtn) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => this.setMode("black", this.blackBtn));
        this.whiteBtn = document.getElementById("btn-white");
        (_e = this.whiteBtn) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => this.setMode("white", this.whiteBtn));
        this.altBtn = document.getElementById("btn-alt");
        if (this.altBtn) {
            this.altBtn.title = "黒白交互に石を連続配置するモードです（先手色は黒先ボタンと連動）";
        }
        (_f = this.altBtn) === null || _f === void 0 ? void 0 : _f.addEventListener("click", () => {
            const state = this.store.snapshot;
            state.startColor = state.startColor === 1 ? 2 : 1;
            this.setMode("alt", this.altBtn);
        });
    }
    initGameButtons() {
        var _a, _b, _c, _d, _e, _f;
        this.prevMoveBtn = document.getElementById("btn-prev-move");
        if (this.prevMoveBtn) {
            this.prevMoveBtn.title = "読み上げ用の手順を1手戻ります（Undoとは別の1手戻る）";
        }
        (_a = this.prevMoveBtn) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
            const state = this.store.snapshot;
            if (state.sgfIndex > 0) {
                this.store.setMoveIndex(state.sgfIndex - 1);
                this.updateUI();
            }
        });
        this.nextMoveBtn = document.getElementById("btn-next-move");
        if (this.nextMoveBtn) {
            this.nextMoveBtn.title = "読み上げ用の手順を1手進めます";
        }
        (_b = this.nextMoveBtn) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
            const state = this.store.snapshot;
            if (state.sgfIndex < state.sgfMoves.length) {
                this.store.setMoveIndex(state.sgfIndex + 1);
                this.updateUI();
            }
        });
        this.answerBtn = document.getElementById("btn-answer");
        (_c = this.answerBtn) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
            this.disableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                return;
            }
            if (state.answerMode === "black") {
                state.answerMode = "white";
                state.startColor = 2;
            }
            else {
                state.answerMode = "black";
                state.startColor = 1;
            }
            this.updateAnswerButtonDisplay();
            this.updateUI();
        });
        this.exitSolveBtn = document.getElementById("btn-exit-solve-edit");
        (_d = this.exitSolveBtn) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => {
            const state = this.store.snapshot;
            this.disableEraseMode();
            if (!state.numberMode) {
                this.store.enterSolveMode();
                state.answerMode = "black";
                state.startColor = 1;
                this.updateFullResetVisibility();
            }
            else {
                this.store.exitSolveModeToEmptyBoard();
                this.updateFullResetVisibility();
            }
            this.updateAnswerButtonDisplay();
            this.updateUI();
        });
        const historyBtn = document.getElementById("btn-history");
        if (historyBtn) {
            historyBtn.title = "編集・解答の履歴一覧を開き、任意の状態にジャンプします";
        }
        historyBtn === null || historyBtn === void 0 ? void 0 : historyBtn.addEventListener("click", () => {
            this.store.historyManager.showHistoryDialog((index) => {
                if (this.store.restoreHistorySnapshot(index)) {
                    this.renderer.updateBoardSize();
                    this.updateUI();
                    this.renderer.showMessage("履歴を復元しました");
                }
            });
        });
        this.problemBtn = document.getElementById("btn-problem");
        (_e = this.problemBtn) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => {
            this.disableEraseMode();
            const state = this.store.snapshot;
            if (!state.numberMode) {
                this.store.setProblemDiagram();
                state.answerMode = "black";
                this.updateAnswerButtonDisplay();
                this.updateUI();
                this.renderer.showMessage("問題図を確定しました");
            }
            else {
                if (!this.store.hasProblemDiagram()) {
                    this.renderer.showMessage("問題図が設定されていません");
                    return;
                }
                this.store.restoreProblemDiagram();
                this.updateUI();
                this.renderer.showMessage("問題図に戻しました");
            }
        });
        (_f = this.elements.sliderEl) === null || _f === void 0 ? void 0 : _f.addEventListener("input", (event) => {
            const target = event.target;
            this.store.setMoveIndex(parseInt(target.value, 10));
            this.updateUI();
        });
    }
    initBoardSaveButton() {
        const saveBtn = document.getElementById("btn-save-board");
        saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.addEventListener("click", () => {
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
        // 編集モード／解答モードに関係なく「色変更」だけ行う
        state.mode = mode;
        // ボタンの active 切り替え
        this.setActiveButton(buttonElement, "play-btn");
        // UI 更新
        this.updateUI();
    }
    setActiveButton(element, groupClass) {
        document
            .querySelectorAll(`.${groupClass}`)
            .forEach((btn) => btn.classList.remove("active"));
        element.classList.add("active");
    }
    isEditMode() {
        return !this.store.snapshot.numberMode;
    }
    isSolveMode() {
        return this.store.snapshot.numberMode;
    }
    updateToolbarState() {
        this.ensureButtonRefs();
        this.updateFullResetVisibility();
        const state = this.store.snapshot;
        const isSolve = this.isSolveMode();
        const hasHistorySnapshots = this.store.historyManager.getList().length > 0;
        this.setDisabled(this.undoBtn, !hasHistorySnapshots);
        if (isSolve) {
            this.disableEraseMode();
        }
        this.setDisabled(this.eraseBtn, isSolve);
        this.setDisabled(this.altBtn, isSolve);
        this.setDisabled(this.blackBtn, isSolve);
        this.setDisabled(this.whiteBtn, isSolve);
        this.setDisabled(this.answerBtn, !isSolve);
        if (this.exitSolveBtn) {
            this.exitSolveBtn.disabled = false;
        }
        const hasPrevMove = state.sgfIndex > 0;
        const hasNextMove = state.sgfIndex < state.sgfMoves.length;
        this.setDisabled(this.prevMoveBtn, !hasPrevMove);
        this.setDisabled(this.nextMoveBtn, !hasNextMove);
        this.updateProblemButtonState();
        // 黒先ボタン / 解答開始ボタンのラベル・ツールチップを最新状態に
        this.updateAnswerButtonDisplay();
    }
    setDisabled(button, disabled) {
        if (!button) {
            return;
        }
        button.disabled = disabled;
    }
    ensureButtonRefs() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        this.clearBtn = (_a = this.clearBtn) !== null && _a !== void 0 ? _a : document.getElementById("btn-clear");
        this.problemBtn = (_b = this.problemBtn) !== null && _b !== void 0 ? _b : document.getElementById("btn-problem");
        this.answerBtn = (_c = this.answerBtn) !== null && _c !== void 0 ? _c : document.getElementById("btn-answer");
        this.prevMoveBtn = (_d = this.prevMoveBtn) !== null && _d !== void 0 ? _d : document.getElementById("btn-prev-move");
        this.nextMoveBtn = (_e = this.nextMoveBtn) !== null && _e !== void 0 ? _e : document.getElementById("btn-next-move");
        this.blackBtn = (_f = this.blackBtn) !== null && _f !== void 0 ? _f : document.getElementById("btn-black");
        this.whiteBtn = (_g = this.whiteBtn) !== null && _g !== void 0 ? _g : document.getElementById("btn-white");
        this.eraseBtn = (_h = this.eraseBtn) !== null && _h !== void 0 ? _h : document.getElementById("btn-erase");
        this.altBtn = (_j = this.altBtn) !== null && _j !== void 0 ? _j : document.getElementById("btn-alt");
        this.undoBtn = (_k = this.undoBtn) !== null && _k !== void 0 ? _k : document.getElementById("btn-undo");
        this.exitSolveBtn =
            (_l = this.exitSolveBtn) !== null && _l !== void 0 ? _l : document.getElementById("btn-exit-solve-edit");
    }
    updateProblemButtonState() {
        if (!this.problemBtn) {
            this.problemBtn = document.getElementById("btn-problem");
        }
        if (!this.problemBtn) {
            return;
        }
        const isSolve = this.isSolveMode();
        this.problemBtn.textContent = isSolve ? "🧩 初期図" : "🧩 問題図";
        this.problemBtn.title = isSolve
            ? "解答をすべて消して問題図の初期状態に戻します"
            : "現在の盤面を問題図として保存します";
        this.problemBtn.disabled = false;
    }
    updateFullResetVisibility() {
        if (!this.clearBtn) {
            this.clearBtn = document.getElementById("btn-clear");
        }
        if (!this.clearBtn) {
            return;
        }
        const prefs = this.getPreferences();
        const isSolve = this.store.snapshot.numberMode;
        const enableFullResetInSolve = prefs.solve.enableFullReset === "on";
        // 他のボタンと同様に、常に表示したまま状態だけ切り替える
        this.clearBtn.style.display = "";
        if (!isSolve) {
            // 編集モード中は常に有効
            this.clearBtn.disabled = false;
            this.clearBtn.title =
                "盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）";
        }
        else if (enableFullResetInSolve) {
            // 解答モード中で、設定で許可されている場合
            this.clearBtn.disabled = false;
            this.clearBtn.title =
                "解答中の盤面と履歴をすべて消して最初からやり直します（Undoはできません）";
        }
        else {
            // 解答モード中だが、設定で無効化されている場合（グレーアウト）
            this.clearBtn.disabled = true;
            this.clearBtn.title =
                "解答モード中の全消去はデフォルトで無効です（設定→「解答モードで全て消すボタンを有効にする」で変更できます）";
        }
    }
}
//# sourceMappingURL=toolbar-controller.js.map