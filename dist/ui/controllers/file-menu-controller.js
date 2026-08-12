import { HeaderEditor } from './file-menu/header-editor.js';
import { getSgfTextarea } from '../../utils/dom-elements.js';
import { OutsideClickListener } from '../../services/outside-click-listener.js';
export class FileMenuController {
    constructor(dropdownManager, sgfService, renderer, qrManager, store, eventBus, 
    /** 共有 HeaderEditor。null の場合は内部生成にフォールバック */
    headerEditor) {
        this.dropdownManager = dropdownManager;
        this.sgfService = sgfService;
        this.renderer = renderer;
        this.qrManager = qrManager;
        this.store = store;
        this.eventBus = eventBus;
        this.elements = null;
        this.unsubscribeOutsideClick = null;
        this.headerEditor = headerEditor !== null && headerEditor !== void 0 ? headerEditor : new HeaderEditor(store, renderer, eventBus);
    }
    syncHeaderEditor() {
        this.headerEditor.populateFields();
    }
    initialize() {
        this.elements = this.cacheElements();
        const els = this.elements;
        this.bindDropdownControl(els);
        this.bindFileSelect(els);
        this.bindFileLoad(els);
        this.bindCopy(els);
        this.bindFinalize(els);
        this.bindSave(els);
        this.bindQR(els);
        this.bindDiscord(els);
        this.headerEditor.bindEvents();
        this.headerEditor.populateFields();
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
    cacheElements() {
        return {
            fileBtn: document.getElementById('btn-file'),
            fileDropdown: document.getElementById('file-dropdown'),
            fileSelectBtn: document.getElementById('btn-file-select'),
            fileLoadBtn: document.getElementById('btn-file-load'),
            fileCopyBtn: document.getElementById('btn-file-copy'),
            fileFinalizeBtn: document.getElementById('btn-file-finalize'),
            fileSaveBtn: document.getElementById('btn-file-save'),
            fileQRBtn: document.getElementById('btn-file-qr'),
            fileDiscordBtn: document.getElementById('btn-file-discord'),
            sgfInput: document.getElementById('sgf-input'),
        };
    }
    bindDropdownControl(els) {
        var _a, _b;
        (_a = els.fileBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', (event) => {
            var _a;
            event.stopPropagation();
            const featureDropdown = document.getElementById('feature-dropdown');
            const isOpen = (_a = els.fileDropdown) === null || _a === void 0 ? void 0 : _a.classList.contains('show');
            this.dropdownManager.hide(featureDropdown);
            if (els.fileDropdown && els.fileBtn) {
                if (isOpen) {
                    // 閉じるときは編集中のヘッダを上書きしない
                    // （2026-08-12 修正: B-9 編集中ヘッダ破棄）
                    this.dropdownManager.hide(els.fileDropdown);
                }
                else {
                    // 開くときだけ最新状態を反映
                    this.headerEditor.populateFields();
                    this.dropdownManager.open(els.fileBtn, els.fileDropdown);
                }
            }
        });
        if (els.fileDropdown) {
            const dropdown = els.fileDropdown;
            const listener = new OutsideClickListener();
            this.unsubscribeOutsideClick = listener.subscribe([dropdown], () => this.dropdownManager.hide(dropdown));
        }
        (_b = els.fileDropdown) === null || _b === void 0 ? void 0 : _b.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
    bindFileSelect(els) {
        var _a, _b;
        (_a = els.fileSelectBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            var _a;
            (_a = els.sgfInput) === null || _a === void 0 ? void 0 : _a.click();
            this.dropdownManager.hide(els.fileDropdown);
        });
        (_b = els.sgfInput) === null || _b === void 0 ? void 0 : _b.addEventListener('change', async (event) => {
            var _a;
            const target = event.target;
            const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!file) {
                return;
            }
            try {
                const result = await this.sgfService.loadFromFile(file);
                this.applySgf(result);
                this.renderer.showMessage(`SGF読み込み完了 (${result.moves.length}手)`);
            }
            catch (error) {
                console.error('SGF読み込み失敗', error);
                this.renderer.showMessage('SGF読み込みに失敗しました');
            }
        });
    }
    bindFileLoad(els) {
        var _a;
        (_a = els.fileLoadBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', async () => {
            this.dropdownManager.hide(els.fileDropdown);
            try {
                const result = await this.sgfService.loadFromClipboard();
                this.applySgf(result);
                this.renderer.showMessage(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
            }
            catch (error) {
                this.handleClipboardLoadFallback();
            }
        });
    }
    /** クリップボードからの読込に失敗したとき、テキストエリア内容を試す */
    handleClipboardLoadFallback() {
        const sgfTextarea = getSgfTextarea();
        if (sgfTextarea === null || sgfTextarea === void 0 ? void 0 : sgfTextarea.value.trim()) {
            try {
                const parsed = this.sgfService.parse(sgfTextarea.value.trim());
                this.applySgf(parsed);
                this.renderer.showMessage('テキストエリアからSGF読み込み完了');
            }
            catch (parseError) {
                console.error('SGF文字列解析失敗', parseError);
                this.renderer.showMessage('SGF読み込みに失敗しました');
            }
        }
        else {
            this.renderer.showMessage('クリップボードまたはテキストエリアにSGFがありません');
        }
    }
    bindCopy(els) {
        var _a;
        (_a = els.fileCopyBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', async () => {
            this.dropdownManager.hide(els.fileDropdown);
            const sgfData = this.sgfService.export();
            const sgfTextarea = getSgfTextarea();
            if (sgfTextarea) {
                sgfTextarea.value = sgfData;
            }
            try {
                await this.sgfService.copyToClipboard(sgfData);
                this.renderer.showMessage('SGF をコピーしました');
            }
            catch (error) {
                this.renderer.showMessage('SGF をテキストエリアに表示しました');
            }
        });
    }
    bindFinalize(els) {
        var _a;
        (_a = els.fileFinalizeBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.dropdownManager.hide(els.fileDropdown);
            if (!this.store.snapshot.numberMode) {
                this.renderer.showMessage('解答モード中のみ確定できます');
                return;
            }
            try {
                const applyResult = this.sgfService.applyGeneratedSgf();
                this.renderer.updateBoardSize();
                const sgfTextarea = getSgfTextarea();
                if (sgfTextarea) {
                    sgfTextarea.value = applyResult.sgfText;
                }
                this.eventBus.emitUIUpdate();
                this.headerEditor.populateFields();
                this.eventBus.emitSgfApplied(applyResult.sgfText);
                this.eventBus.emitAnswerButtonUpdate();
                this.renderer.showMessage('SGF を確定しました（編集モードへ移行）');
            }
            catch (error) {
                console.error('SGF確定失敗', error);
                this.renderer.showMessage('SGF確定に失敗しました');
            }
        });
    }
    bindSave(els) {
        var _a;
        (_a = els.fileSaveBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', async () => {
            this.dropdownManager.hide(els.fileDropdown);
            const sgfData = this.sgfService.export();
            try {
                await this.sgfService.saveToFile(sgfData);
                this.renderer.showMessage('SGFファイルを保存しました');
            }
            catch (error) {
                console.error('SGF保存失敗', error);
                this.renderer.showMessage('SGFファイルの保存に失敗しました');
            }
        });
    }
    bindQR(els) {
        var _a;
        (_a = els.fileQRBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.dropdownManager.hide(els.fileDropdown);
            this.qrManager.createSGFQRCode(this.sgfService.state);
        });
    }
    bindDiscord(els) {
        var _a;
        (_a = els.fileDiscordBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.dropdownManager.hide(els.fileDropdown);
            this.qrManager.createDiscordShareLink(this.sgfService.state);
        });
    }
    applySgf(result) {
        const applyResult = this.sgfService.apply(result);
        this.renderer.updateBoardSize();
        this.eventBus.emitUIUpdate();
        this.headerEditor.populateFields();
        this.eventBus.emitSgfApplied(applyResult.sgfText);
        this.eventBus.emitAnswerButtonUpdate();
    }
}
//# sourceMappingURL=file-menu-controller.js.map