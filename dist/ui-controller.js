// ============ UI制御エンジン ============
import { DEFAULT_CONFIG } from './types.js';
import { GoEngine } from './go-engine.js';
import { Renderer } from './renderer.js';
import { SGFParser } from './sgf-parser.js';
import { QRManager } from './qr-manager.js';
import { HistoryManager } from './history-manager.js';
export class UIController {
    constructor(state, elements) {
        this.state = state;
        this.elements = elements;
        this.dragState = {
            dragging: false,
            dragColor: null,
            lastPos: null
        };
        this.boardHasFocus = false;
        this.touchStartY = 0;
        this.boardLongPressTimer = null;
        this.boardLongPressPointerId = null;
        this.boardLongPressStart = null;
        this.boardLongPressTarget = null;
        this.iosCopyOverlay = null;
        this.engine = new GoEngine(state);
        this.renderer = new Renderer(state, elements);
        this.sgfParser = new SGFParser();
        this.qrManager = new QRManager();
        this.historyManager = new HistoryManager();
        // エンジンに履歴管理を設定
        this.engine.setHistoryManager(this.historyManager);
        this.initEventListeners();
    }
    // ============ イベントリスナー初期化 ============
    initEventListeners() {
        this.initBoardEvents();
        this.initSVGEvents();
        this.initButtonEvents();
        this.initKeyboardEvents();
        this.initResizeEvents();
        this.initMovesCopyListener();
    }
    // ============ 盤面イベント ============
    initBoardEvents() {
        this.elements.boardWrapper.tabIndex = 0;
        this.elements.boardWrapper.addEventListener('pointerenter', () => {
            this.boardHasFocus = true;
        });
        this.elements.boardWrapper.addEventListener('pointerleave', () => {
            this.boardHasFocus = false;
        });
        this.elements.boardWrapper.addEventListener('pointerdown', () => {
            this.boardHasFocus = true;
            this.elements.boardWrapper.focus();
        });
        this.elements.boardWrapper.addEventListener('blur', () => {
            this.boardHasFocus = false;
        });
        // タッチイベント処理
        this.elements.boardWrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });
        this.elements.boardWrapper.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touchY = e.touches[0].clientY;
                const deltaY = Math.abs(touchY - this.touchStartY);
                if (deltaY < 10) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }
    // ============ SVGイベント ============
    initSVGEvents() {
        this.elements.svg.addEventListener('pointerdown', (e) => {
            this.startBoardLongPress(e);
            this.handlePointerDown(e);
        });
        this.elements.svg.addEventListener('pointermove', (e) => {
            this.handleBoardLongPressMove(e);
            this.handlePointerMove(e);
        });
        this.elements.svg.addEventListener('pointerup', (e) => {
            this.handlePointerEnd(e);
            this.resetBoardLongPressState();
        });
        this.elements.svg.addEventListener('pointercancel', (e) => {
            this.handlePointerEnd(e);
            this.resetBoardLongPressState();
        });
        this.elements.svg.addEventListener('pointerleave', () => {
            this.cancelBoardLongPressTimer();
        });
        this.elements.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    // ============ ポインターイベント処理 ============
    handlePointerDown(e) {
        this.boardHasFocus = true;
        this.elements.boardWrapper.focus();
        this.removeIOSCopyOverlay();
        if (e.button === 2)
            e.preventDefault();
        if (this.state.eraseMode) {
            //　右クリックで消去モード終了
            if (e.button === 2) {
                this.disableEraseMode();
                return;
            }
            this.dragState.dragColor = null;
        }
        else if (this.state.mode === 'alt') {
            if (e.button === 0) {
                this.dragState.dragColor = null; // 交互配置に従う
            }
            else {
                return; // 右クリックは無効
            }
        }
        else {
            const leftColor = this.state.mode === 'white' ? 2 : 1;
            const rightColor = this.state.mode === 'white' ? 1 : 2;
            this.dragState.dragColor = e.button === 0 ? leftColor :
                e.button === 2 ? rightColor : null;
        }
        this.dragState.dragging = true;
        this.dragState.lastPos = null;
        this.elements.svg.setPointerCapture(e.pointerId);
        this.placeAtEvent(e);
    }
    handlePointerMove(e) {
        if (!this.dragState.dragging) {
            if (this.state.eraseMode && e.buttons) {
                this.dragState.dragging = true;
                this.dragState.lastPos = null;
            }
            else {
                return;
            }
        }
        // 交互配置モードではドラッグ無効
        if (this.state.mode === 'alt' && !this.state.eraseMode) {
            return;
        }
        const pos = this.getPositionFromEvent(e);
        if (this.dragState.lastPos &&
            this.dragState.lastPos.col === pos.col &&
            this.dragState.lastPos.row === pos.row) {
            return;
        }
        this.dragState.lastPos = pos;
        this.placeAtEvent(e);
    }
    handlePointerEnd(e) {
        if (!this.dragState.dragging)
            return;
        this.dragState.dragging = false;
        this.dragState.dragColor = null;
        this.dragState.lastPos = null;
        this.elements.svg.releasePointerCapture(e.pointerId);
    }
    startBoardLongPress(event) {
        if (this.boardLongPressTimer !== null) {
            window.clearTimeout(this.boardLongPressTimer);
            this.boardLongPressTimer = null;
        }
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }
        const target = event.target;
        if (!target || !target.classList.contains('stone')) {
            this.boardLongPressTarget = null;
            return;
        }
        this.boardLongPressPointerId = event.pointerId;
        this.boardLongPressStart = { x: event.clientX, y: event.clientY };
        this.boardLongPressTarget = target;
        this.boardLongPressTimer = window.setTimeout(() => {
            this.boardLongPressTimer = null;
            void this.handleBoardImageLongPress();
        }, 650);
    }
    handleBoardLongPressMove(event) {
        if (this.boardLongPressTimer === null || !this.boardLongPressStart) {
            return;
        }
        const deltaX = Math.abs(event.clientX - this.boardLongPressStart.x);
        const deltaY = Math.abs(event.clientY - this.boardLongPressStart.y);
        if (Math.max(deltaX, deltaY) > 10) {
            this.cancelBoardLongPressTimer();
        }
    }
    cancelBoardLongPressTimer() {
        if (this.boardLongPressTimer !== null) {
            window.clearTimeout(this.boardLongPressTimer);
            this.boardLongPressTimer = null;
        }
    }
    resetBoardLongPressState() {
        this.cancelBoardLongPressTimer();
        this.boardLongPressPointerId = null;
        this.boardLongPressStart = null;
        this.boardLongPressTarget = null;
    }
    async handleBoardImageLongPress() {
        if (!this.boardLongPressTarget) {
            return;
        }
        this.dragState.dragging = false;
        this.dragState.dragColor = null;
        this.dragState.lastPos = null;
        if (this.boardLongPressPointerId !== null) {
            try {
                this.elements.svg.releasePointerCapture(this.boardLongPressPointerId);
            }
            catch (error) {
                console.warn('Pointer capture release failed:', error);
            }
            this.boardLongPressPointerId = null;
        }
        try {
            const blob = await this.renderer.exportBoardAsPNG();
            if (this.isIOSDevice()) {
                const dataUrl = await this.blobToDataUrl(blob);
                this.showIOSCopyOverlay(dataUrl);
                this.renderer.showMessage('画像を長押しでコピーしてください');
            }
            else if (navigator.clipboard && 'write' in navigator.clipboard) {
                if (typeof ClipboardItem === 'undefined') {
                    throw new Error('ClipboardItem がサポートされていません');
                }
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                this.renderer.showMessage('碁盤画像をクリップボードにコピーしました');
            }
            else {
                throw new Error('クリップボード API が利用できません');
            }
        }
        catch (error) {
            console.error('碁盤画像コピーに失敗しました:', error);
            this.renderer.showMessage('碁盤画像のコピーに失敗しました');
        }
        finally {
            this.boardLongPressTarget = null;
        }
    }
    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('画像データの作成に失敗しました'));
            reader.readAsDataURL(blob);
        });
    }
    isIOSDevice() {
        if (typeof navigator === 'undefined') {
            return false;
        }
        const ua = navigator.userAgent;
        return /iP(hone|od|ad)/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    }
    showIOSCopyOverlay(dataUrl) {
        this.removeIOSCopyOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'ios-copy-overlay';
        const content = document.createElement('div');
        content.className = 'ios-copy-overlay__content';
        const message = document.createElement('p');
        message.className = 'ios-copy-overlay__message';
        message.textContent = '画像を長押しするとコピーできます';
        const image = document.createElement('img');
        image.className = 'ios-copy-overlay__image';
        image.src = dataUrl;
        image.alt = '碁盤の画像';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ios-copy-overlay__close';
        closeBtn.textContent = '閉じる';
        closeBtn.addEventListener('click', () => this.removeIOSCopyOverlay());
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.removeIOSCopyOverlay();
            }
        });
        content.appendChild(message);
        content.appendChild(image);
        content.appendChild(closeBtn);
        overlay.appendChild(content);
        this.elements.boardWrapper.appendChild(overlay);
        this.iosCopyOverlay = overlay;
    }
    removeIOSCopyOverlay() {
        if (this.iosCopyOverlay) {
            this.iosCopyOverlay.remove();
            this.iosCopyOverlay = null;
        }
    }
    initMovesCopyListener() {
        const movesEl = this.elements.movesEl;
        if (!movesEl)
            return;
        let longPressTimer = null;
        let longPressArmed = false;
        const clearTimer = () => {
            if (longPressTimer !== null) {
                window.clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            longPressArmed = false;
        };
        const copyMoves = async () => {
            var _a, _b;
            const targetText = (_a = movesEl.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (!targetText)
                return false;
            const textToCopy = `||${targetText}||`;
            try {
                if (!((_b = navigator.clipboard) === null || _b === void 0 ? void 0 : _b.writeText)) {
                    throw new Error('クリップボード API が利用できません');
                }
                await navigator.clipboard.writeText(textToCopy);
                return true;
            }
            catch (clipboardError) {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    textarea.setAttribute('readonly', 'true');
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    textarea.style.pointerEvents = 'none';
                    textarea.style.top = '0';
                    textarea.style.left = '0';
                    document.body.appendChild(textarea);
                    try {
                        textarea.focus({ preventScroll: true });
                    }
                    catch (_c) {
                        textarea.focus();
                    }
                    textarea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (!successful) {
                        throw clipboardError;
                    }
                    return true;
                }
                catch (fallbackError) {
                    console.error('解答手順のコピーに失敗しました:', fallbackError);
                    return false;
                }
            }
        };
        const startPress = (event) => {
            var _a;
            const text = (_a = movesEl.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (!text) {
                return;
            }
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }
            event.preventDefault();
            clearTimer();
            longPressTimer = window.setTimeout(() => {
                longPressTimer = null;
                longPressArmed = true;
            }, 600);
        };
        const handlePressEnd = (event) => {
            if (longPressArmed) {
                event.preventDefault();
                const performCopy = async () => {
                    const success = await copyMoves();
                    this.renderer.showMessage(success ? '解答手順をコピーしました' : '解答手順のコピーに失敗しました');
                };
                performCopy();
            }
            clearTimer();
        };
        movesEl.addEventListener('pointerdown', startPress);
        movesEl.addEventListener('pointerup', handlePressEnd);
        movesEl.addEventListener('pointercancel', handlePressEnd);
        movesEl.addEventListener('pointerleave', clearTimer);
        movesEl.addEventListener('contextmenu', (event) => event.preventDefault());
    }
    setupDoubleTapZoomBlock(button) {
        if (!button)
            return;
        button.style.touchAction = 'manipulation';
        let lastTap = 0;
        button.addEventListener('touchend', (event) => {
            if (event.touches.length > 0 || event.changedTouches.length !== 1) {
                lastTap = Date.now();
                return;
            }
            const now = Date.now();
            if (now - lastTap < 350) {
                event.preventDefault();
                button.click();
            }
            lastTap = now;
        }, { passive: false });
    }
    // ============ 着手処理 ============
    placeAtEvent(event) {
        const pos = this.getPositionFromEvent(event);
        if (!this.isValidPosition(pos))
            return;
        if (this.state.eraseMode) {
            this.handleErase(pos);
        }
        else {
            this.handlePlaceStone(pos);
        }
    }
    handlePlaceStone(pos) {
        const color = this.dragState.dragColor || this.engine.getCurrentColor();
        if (this.engine.tryMove(pos, color)) {
            this.updateUI();
        }
    }
    handleErase(pos) {
        if (this.engine.removeStoneAt(pos)) {
            this.updateUI();
            return true;
        }
        return false;
    }
    // ============ 座標変換 ============
    getPositionFromEvent(event) {
        try {
            const pt = this.elements.svg.createSVGPoint();
            pt.x = event.clientX;
            pt.y = event.clientY;
            const ctm = this.elements.svg.getScreenCTM();
            if (!ctm)
                return { col: -1, row: -1 };
            const svgPoint = pt.matrixTransform(ctm.inverse());
            const col = Math.round((svgPoint.x - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
            const row = Math.round((svgPoint.y - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
            return { col, row };
        }
        catch (error) {
            console.error('座標変換エラー:', error);
            return { col: -1, row: -1 };
        }
    }
    isValidPosition(pos) {
        return pos.col >= 0 && pos.col < this.state.boardSize &&
            pos.row >= 0 && pos.row < this.state.boardSize;
    }
    // ============ ボタンイベント ============
    initButtonEvents() {
        // 盤サイズボタン
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const element = btn;
                const size = parseInt(element.dataset.size, 10);
                if (size !== this.state.boardSize) {
                    // 現在と違うサイズの場合のみ履歴保存
                    if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0) {
                        this.historyManager.save(`${this.state.boardSize}路→${size}路変更前`, this.state);
                    }
                    this.engine.initBoard(size);
                    this.updateUI();
                    this.setActiveButton(element, 'size-btn');
                }
            });
        });
        // 基本操作ボタン
        this.initBasicButtons();
        this.initGameButtons();
        this.initFileButtons();
    }
    initBasicButtons() {
        // 全消去
        const clearBtn = document.getElementById('btn-clear');
        clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
            // 履歴保存（現在の状態が意味がある場合のみ）
            if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0 ||
                this.state.board.some(row => row.some(cell => cell !== 0))) {
                this.historyManager.save(`全消去前（${this.state.sgfMoves.length}手）`, this.state);
            }
            this.disableEraseMode();
            this.engine.initBoard(this.state.boardSize);
            this.updateUI();
        });
        // 戻る
        const undoBtn = document.getElementById('btn-undo');
        undoBtn === null || undoBtn === void 0 ? void 0 : undoBtn.addEventListener('click', () => {
            this.engine.undo();
            this.updateUI();
        });
        // 消去モード
        const eraseBtn = document.getElementById('btn-erase');
        eraseBtn === null || eraseBtn === void 0 ? void 0 : eraseBtn.addEventListener('click', () => {
            this.state.eraseMode = !this.state.eraseMode;
            if (this.state.eraseMode) {
                eraseBtn.classList.add('active');
                this.renderer.showMessage('消去モード');
            }
            else {
                eraseBtn.classList.remove('active');
                this.renderer.showMessage('');
            }
        });
        // 配置モードボタン
        const blackBtn = document.getElementById('btn-black');
        blackBtn === null || blackBtn === void 0 ? void 0 : blackBtn.addEventListener('click', () => this.setMode('black', blackBtn));
        const whiteBtn = document.getElementById('btn-white');
        whiteBtn === null || whiteBtn === void 0 ? void 0 : whiteBtn.addEventListener('click', () => this.setMode('white', whiteBtn));
        const altBtn = document.getElementById('btn-alt');
        altBtn === null || altBtn === void 0 ? void 0 : altBtn.addEventListener('click', () => {
            this.state.startColor = this.state.startColor === 1 ? 2 : 1;
            this.setMode('alt', altBtn);
        });
    }
    initGameButtons() {
        var _a;
        // 手順移動
        const prevBtn = document.getElementById('btn-prev-move');
        prevBtn === null || prevBtn === void 0 ? void 0 : prevBtn.addEventListener('click', () => {
            if (this.state.sgfIndex > 0) {
                this.engine.setMoveIndex(this.state.sgfIndex - 1);
                this.updateUI();
            }
        });
        this.setupDoubleTapZoomBlock(prevBtn);
        const nextBtn = document.getElementById('btn-next-move');
        nextBtn === null || nextBtn === void 0 ? void 0 : nextBtn.addEventListener('click', () => {
            if (this.state.sgfIndex < this.state.sgfMoves.length) {
                this.engine.setMoveIndex(this.state.sgfIndex + 1);
                this.updateUI();
            }
        });
        this.setupDoubleTapZoomBlock(nextBtn);
        // 解答ボタン
        const answerBtn = document.getElementById('btn-answer');
        answerBtn === null || answerBtn === void 0 ? void 0 : answerBtn.addEventListener('click', () => {
            this.disableEraseMode();
            if (!this.state.numberMode) {
                if (this.state.sgfMoves.length > 0 || this.state.board.some(row => row.some(cell => cell !== 0))) {
                    this.historyManager.save(`黒先解答開始前（${this.state.sgfMoves.length}手）`, this.state);
                }
                this.state.answerMode = 'black';
                this.engine.startNumberMode(1);
            }
            else if (this.state.answerMode === 'black') {
                this.state.answerMode = 'white';
                this.engine.startNumberMode(2);
            }
            else {
                this.state.answerMode = 'black';
                this.engine.startNumberMode(1);
            }
            this.updateAnswerButtonDisplay();
            this.updateUI();
        });
        // 置石ボタン
        const handicapBtn = document.getElementById('btn-handicap');
        handicapBtn === null || handicapBtn === void 0 ? void 0 : handicapBtn.addEventListener('click', () => {
            this.showHandicapDialog();
        });
        // レイアウト切り替え
        const layoutBtn = document.getElementById('btn-layout');
        if (layoutBtn) {
            let isHorizontal = false;
            layoutBtn.addEventListener('click', () => {
                isHorizontal = !isHorizontal;
                document.body.classList.toggle('horizontal', isHorizontal);
                layoutBtn.textContent = isHorizontal ? '縦レイアウト' : '横レイアウト';
                this.renderer.updateBoardSize();
            });
        }
        // 盤面回転ボタン
        const rotateBtn = document.getElementById('btn-rotate');
        rotateBtn === null || rotateBtn === void 0 ? void 0 : rotateBtn.addEventListener('click', () => {
            this.rotateBoardView();
        });
        // 履歴ボタン
        const historyBtn = document.getElementById('btn-history');
        historyBtn === null || historyBtn === void 0 ? void 0 : historyBtn.addEventListener('click', () => {
            this.historyManager.showHistoryDialog((index) => {
                if (this.historyManager.restore(index, this.state)) {
                    this.updateUI();
                    this.renderer.showMessage(`履歴を復元しました`);
                }
            });
        });
        const problemBtn = document.getElementById('btn-problem');
        problemBtn === null || problemBtn === void 0 ? void 0 : problemBtn.addEventListener('click', () => {
            this.disableEraseMode();
            if (!this.state.numberMode) {
                if (this.state.sgfMoves.length > 0 || this.state.board.some(row => row.some(cell => cell !== 0))) {
                    this.historyManager.save(`問題図確定前（${this.state.sgfMoves.length}手）`, this.state);
                }
                this.engine.setProblemDiagram();
                this.state.answerMode = 'black';
                this.updateAnswerButtonDisplay();
                this.updateUI();
                this.renderer.showMessage('問題図を確定しました');
            }
            else {
                if (!this.engine.hasProblemDiagram()) {
                    this.renderer.showMessage('問題図が設定されていません');
                    return;
                }
                this.engine.restoreProblemDiagram();
                this.updateUI();
                this.renderer.showMessage('問題図に戻しました');
            }
        });
        // スライダー
        (_a = this.elements.sliderEl) === null || _a === void 0 ? void 0 : _a.addEventListener('input', (e) => {
            const target = e.target;
            this.engine.setMoveIndex(parseInt(target.value, 10));
            this.updateUI();
        });
    }
    initFileButtons() {
        // ファイルメニュー
        const fileBtn = document.getElementById('btn-file');
        const fileDropdown = document.getElementById('file-dropdown');
        fileBtn === null || fileBtn === void 0 ? void 0 : fileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.classList.remove('show');
        });
        fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        // SGF操作
        this.initSGFButtons();
    }
    initSGFButtons() {
        // SGFファイル選択
        const sgfInput = document.getElementById('sgf-input');
        const fileSelectBtn = document.getElementById('btn-file-select');
        fileSelectBtn === null || fileSelectBtn === void 0 ? void 0 : fileSelectBtn.addEventListener('click', () => {
            var _a;
            sgfInput === null || sgfInput === void 0 ? void 0 : sgfInput.click();
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
        });
        sgfInput === null || sgfInput === void 0 ? void 0 : sgfInput.addEventListener('change', async (e) => {
            var _a;
            const target = e.target;
            const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (file) {
                try {
                    const result = await this.sgfParser.loadFromFile(file);
                    this.applySGFResult(result);
                    this.renderer.showMessage(`SGF読み込み完了 (${result.moves.length}手)`);
                }
                catch (error) {
                    this.renderer.showMessage('SGF読み込みに失敗しました');
                }
            }
        });
        // SGF読み込み（クリップボード）
        const fileLoadBtn = document.getElementById('btn-file-load');
        fileLoadBtn === null || fileLoadBtn === void 0 ? void 0 : fileLoadBtn.addEventListener('click', async () => {
            var _a;
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
            try {
                const result = await this.sgfParser.loadFromClipboard();
                this.applySGFResult(result);
                this.renderer.showMessage(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
            }
            catch (error) {
                // テキストエリアから読み込みを試行
                const sgfTextarea = document.getElementById('sgf-text');
                if (sgfTextarea === null || sgfTextarea === void 0 ? void 0 : sgfTextarea.value.trim()) {
                    try {
                        const result = this.sgfParser.parse(sgfTextarea.value.trim());
                        this.applySGFResult({ moves: result.moves, gameInfo: result.gameInfo });
                        this.renderer.showMessage('テキストエリアからSGF読み込み完了');
                    }
                    catch (parseError) {
                        this.renderer.showMessage('SGF読み込みに失敗しました');
                    }
                }
                else {
                    this.renderer.showMessage('クリップボードまたはテキストエリアにSGFがありません');
                }
            }
        });
        // SGFコピー
        const fileCopyBtn = document.getElementById('btn-file-copy');
        fileCopyBtn === null || fileCopyBtn === void 0 ? void 0 : fileCopyBtn.addEventListener('click', async () => {
            var _a;
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
            const sgfData = this.sgfParser.export(this.state);
            const sgfTextarea = document.getElementById('sgf-text');
            if (sgfTextarea)
                sgfTextarea.value = sgfData;
            try {
                await this.sgfParser.copyToClipboard(sgfData);
                this.renderer.showMessage('SGF をコピーしました');
            }
            catch (error) {
                this.renderer.showMessage('SGF をテキストエリアに表示しました');
            }
        });
        // SGF保存
        const fileSaveBtn = document.getElementById('btn-file-save');
        fileSaveBtn === null || fileSaveBtn === void 0 ? void 0 : fileSaveBtn.addEventListener('click', async () => {
            var _a;
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
            const sgfData = this.sgfParser.export(this.state);
            try {
                await this.sgfParser.saveToFile(sgfData);
                this.renderer.showMessage('SGFファイルを保存しました');
            }
            catch (error) {
                this.renderer.showMessage('SGFファイルの保存に失敗しました');
            }
        });
        // QR共有ボタン
        const fileQRBtn = document.getElementById('btn-file-qr');
        fileQRBtn === null || fileQRBtn === void 0 ? void 0 : fileQRBtn.addEventListener('click', () => {
            var _a;
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
            this.qrManager.createSGFQRCode(this.state);
        });
        const fileDiscordBtn = document.getElementById('btn-file-discord');
        fileDiscordBtn === null || fileDiscordBtn === void 0 ? void 0 : fileDiscordBtn.addEventListener('click', () => {
            var _a;
            (_a = document.getElementById('file-dropdown')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
            this.qrManager.createDiscordShareLink(this.state);
        });
    }
    // ============ ヘルパーメソッド ============
    setMode(mode, buttonElement) {
        this.disableEraseMode();
        this.state.mode = mode;
        if (this.state.numberMode) {
            this.state.numberMode = false;
            this.state.turn = this.state.sgfIndex;
            this.state.answerMode = 'black';
            this.updateAnswerButtonDisplay();
        }
        this.setActiveButton(buttonElement, 'play-btn');
        this.updateUI();
    }
    disableEraseMode() {
        if (this.state.eraseMode) {
            this.state.eraseMode = false;
            const eraseBtn = document.getElementById('btn-erase');
            eraseBtn === null || eraseBtn === void 0 ? void 0 : eraseBtn.classList.remove('active');
            this.renderer.showMessage('');
        }
    }
    updateAnswerButtonDisplay() {
        const answerBtn = document.getElementById('btn-answer');
        if (!answerBtn)
            return;
        if (this.state.answerMode === 'white') {
            answerBtn.textContent = '⚪ 白先';
            answerBtn.classList.add('white-mode');
        }
        else {
            answerBtn.textContent = '🔥 黒先';
            answerBtn.classList.remove('white-mode');
        }
    }
    setActiveButton(element, groupClass) {
        document.querySelectorAll(`.${groupClass}`).forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
    applySGFResult(result) {
        // SGF読み込み前に履歴保存
        if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0 ||
            this.state.board.some(row => row.some(cell => cell !== 0))) {
            this.historyManager.save(`SGF読み込み前（${this.state.sgfMoves.length}手）`, this.state);
        }
        // ゲーム情報を適用
        if (result.gameInfo.boardSize) {
            this.engine.initBoard(result.gameInfo.boardSize);
        }
        this.state.problemDiagramSet = false;
        this.state.problemDiagramBlack = [];
        this.state.problemDiagramWhite = [];
        Object.assign(this.state, result.gameInfo);
        // 着手を設定
        this.state.sgfMoves = result.moves;
        this.state.sgfIndex = 0;
        this.engine.setMoveIndex(0);
        // 置石がある場合は盤面を再描画
        if (this.state.handicapPositions.length > 0) {
            this.updateUI();
        }
        // SGFテキストエリアの更新
        const sgfTextarea = document.getElementById('sgf-text');
        if (sgfTextarea) {
            sgfTextarea.value = this.sgfParser.export(this.state);
        }
        this.updateAnswerButtonDisplay();
    }
    showHandicapDialog() {
        // 既存のポップアップがあれば削除
        const existing = document.getElementById('handicap-popup');
        existing === null || existing === void 0 ? void 0 : existing.remove();
        const popup = document.createElement('div');
        popup.id = 'handicap-popup';
        popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="this.parentElement.remove()">
        <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;" onclick="event.stopPropagation()">
          <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
          <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;">
            <button onclick="window.tumegoUIController.setHandicap('even')" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">互先（コミあり）</button>
            <button onclick="window.tumegoUIController.setHandicap(0)" style="padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">先（コミなし）</button>
            <button onclick="window.tumegoUIController.setHandicap(2)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">2子</button>
            <button onclick="window.tumegoUIController.setHandicap(3)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">3子</button>
            <button onclick="window.tumegoUIController.setHandicap(4)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">4子</button>
            <button onclick="window.tumegoUIController.setHandicap(5)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">5子</button>
            <button onclick="window.tumegoUIController.setHandicap(6)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">6子</button>
            <button onclick="window.tumegoUIController.setHandicap(7)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">7子</button>
            <button onclick="window.tumegoUIController.setHandicap(8)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">8子</button>
            <button onclick="window.tumegoUIController.setHandicap(9)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">9子</button>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
        </div>
      </div>
    `;
        document.body.appendChild(popup);
    }
    // ============ キーボードショートカット ============
    initKeyboardEvents() {
        const keyBindings = {
            'q': () => this.clickButton('.size-btn[data-size="9"]'),
            'w': () => this.clickButton('.size-btn[data-size="13"]'),
            'e': () => this.clickButton('.size-btn[data-size="19"]'),
            'a': () => this.clickButton('#btn-clear'),
            's': () => this.clickButton('#btn-undo'),
            'd': () => this.clickButton('#btn-erase'),
            'z': () => this.clickButton('#btn-black'),
            'x': () => this.clickButton('#btn-alt'),
            'c': () => this.clickButton('#btn-white'),
            'ArrowLeft': () => this.clickButton('#btn-prev-move'),
            'ArrowRight': () => this.clickButton('#btn-next-move')
        };
        document.addEventListener('keydown', (e) => {
            if (!this.boardHasFocus)
                return;
            const handler = keyBindings[e.key];
            if (handler) {
                e.preventDefault();
                handler();
            }
        });
    }
    clickButton(selector) {
        const button = document.querySelector(selector);
        button === null || button === void 0 ? void 0 : button.click();
    }
    // ============ リサイズ対応 ============
    initResizeEvents() {
        window.addEventListener('orientationchange', () => {
            this.renderer.updateBoardSize();
            setTimeout(() => this.renderer.render(), 200);
        });
        window.addEventListener('resize', () => {
            this.renderer.updateBoardSize();
            setTimeout(() => this.renderer.render(), 200);
        });
    }
    // ============ 盤面回転機能 ============
    rotateBoardView() {
        // SVG要素に回転クラスを追加/削除
        const isRotated = this.elements.svg.classList.contains('rotated');
        if (isRotated) {
            this.elements.svg.classList.remove('rotated');
            this.renderer.showMessage('盤面を元に戻しました');
        }
        else {
            this.elements.svg.classList.add('rotated');
            this.renderer.showMessage('盤面を180度回転しました');
        }
    }
    // ============ UI更新 ============
    updateUI() {
        this.renderer.render();
        this.renderer.updateInfo();
        this.renderer.updateSlider();
    }
    // ============ 公開メソッド ============
    setHandicap(stones) {
        const popup = document.getElementById('handicap-popup');
        popup === null || popup === void 0 ? void 0 : popup.remove();
        this.engine.setHandicap(stones);
        this.updateUI();
        if (stones === 'even') {
            this.renderer.showMessage('互先（黒番開始、コミ6.5目）に設定しました');
        }
        else if (stones === 0) {
            this.renderer.showMessage('先番（黒番開始、コミ0目）に設定しました');
        }
        else {
            this.renderer.showMessage(`${stones}子局（白番開始、コミ0目）に設定しました`);
        }
    }
    initialize() {
        // 初期化処理
        this.engine.initBoard(9);
        // 盤面サイズを強制的に更新（モバイル最適化の影響を回避）
        setTimeout(() => {
            this.renderer.updateBoardSize();
            this.updateUI();
        }, 100);
        this.updateUI();
        // 履歴機能の初期化
        this.historyManager.clear();
        this.historyManager.save('アプリケーション開始', this.state);
        // URL からの SGF 読み込み
        const urlResult = this.sgfParser.loadFromURL();
        if (urlResult) {
            this.applySGFResult(urlResult);
            this.renderer.showMessage(`URL からSGF読み込み完了 (${urlResult.moves.length}手)`);
        }
        // 初期ボタン状態
        const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
        const altBtn = document.getElementById('btn-alt');
        this.setActiveButton(sizeBtn, 'size-btn');
        this.setActiveButton(altBtn, 'play-btn');
        this.updateAnswerButtonDisplay();
        console.log('Tumego UI Controller 初期化完了');
    }
}
//# sourceMappingURL=ui-controller.js.map