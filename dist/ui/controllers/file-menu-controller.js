export class FileMenuController {
    constructor(dropdownManager, sgfService, renderer, qrManager, updateUI, onSgfApplied, updateAnswerButtonDisplay, store) {
        this.dropdownManager = dropdownManager;
        this.sgfService = sgfService;
        this.renderer = renderer;
        this.qrManager = qrManager;
        this.updateUI = updateUI;
        this.onSgfApplied = onSgfApplied;
        this.updateAnswerButtonDisplay = updateAnswerButtonDisplay;
        this.store = store;
    }
    syncHeaderEditor() {
        this.populateHeaderFields();
    }
    initialize() {
        const fileBtn = document.getElementById('btn-file');
        const fileDropdown = document.getElementById('file-dropdown');
        const fileSelectBtn = document.getElementById('btn-file-select');
        const fileLoadBtn = document.getElementById('btn-file-load');
        const fileCopyBtn = document.getElementById('btn-file-copy');
        const fileSaveBtn = document.getElementById('btn-file-save');
        const fileQRBtn = document.getElementById('btn-file-qr');
        const fileDiscordBtn = document.getElementById('btn-file-discord');
        const sgfInput = document.getElementById('sgf-input');
        const headerTitleInput = document.getElementById('header-title');
        const headerBlackInput = document.getElementById('header-black');
        const headerWhiteInput = document.getElementById('header-white');
        const headerKomiInput = document.getElementById('header-komi');
        const headerResultInput = document.getElementById('header-result');
        const headerApplyBtn = document.getElementById('btn-header-apply');
        const headerResetBtn = document.getElementById('btn-header-reset');
        fileBtn === null || fileBtn === void 0 ? void 0 : fileBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const featureDropdown = document.getElementById('feature-dropdown');
            const isOpen = fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.classList.contains('show');
            this.dropdownManager.hide(featureDropdown);
            this.populateHeaderFields();
            if (fileDropdown && fileBtn) {
                if (isOpen) {
                    this.dropdownManager.hide(fileDropdown);
                }
                else {
                    this.dropdownManager.open(fileBtn, fileDropdown);
                }
            }
        });
        document.addEventListener('click', () => {
            this.dropdownManager.hide(fileDropdown);
        });
        fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        fileSelectBtn === null || fileSelectBtn === void 0 ? void 0 : fileSelectBtn.addEventListener('click', () => {
            sgfInput === null || sgfInput === void 0 ? void 0 : sgfInput.click();
            this.dropdownManager.hide(fileDropdown);
        });
        sgfInput === null || sgfInput === void 0 ? void 0 : sgfInput.addEventListener('change', async (event) => {
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
        fileLoadBtn === null || fileLoadBtn === void 0 ? void 0 : fileLoadBtn.addEventListener('click', async () => {
            this.dropdownManager.hide(fileDropdown);
            try {
                const result = await this.sgfService.loadFromClipboard();
                this.applySgf(result);
                this.renderer.showMessage(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
            }
            catch (error) {
                const sgfTextarea = document.getElementById('sgf-text');
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
        });
        fileCopyBtn === null || fileCopyBtn === void 0 ? void 0 : fileCopyBtn.addEventListener('click', async () => {
            this.dropdownManager.hide(fileDropdown);
            const sgfData = this.sgfService.export();
            const sgfTextarea = document.getElementById('sgf-text');
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
        fileSaveBtn === null || fileSaveBtn === void 0 ? void 0 : fileSaveBtn.addEventListener('click', async () => {
            this.dropdownManager.hide(fileDropdown);
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
        fileQRBtn === null || fileQRBtn === void 0 ? void 0 : fileQRBtn.addEventListener('click', () => {
            this.dropdownManager.hide(fileDropdown);
            this.qrManager.createSGFQRCode(this.sgfService.state);
        });
        fileDiscordBtn === null || fileDiscordBtn === void 0 ? void 0 : fileDiscordBtn.addEventListener('click', () => {
            this.dropdownManager.hide(fileDropdown);
            this.qrManager.createDiscordShareLink(this.sgfService.state);
        });
        headerApplyBtn === null || headerApplyBtn === void 0 ? void 0 : headerApplyBtn.addEventListener('click', () => {
            var _a;
            const patch = {
                title: (_a = headerTitleInput === null || headerTitleInput === void 0 ? void 0 : headerTitleInput.value.trim()) !== null && _a !== void 0 ? _a : '',
                playerBlack: (headerBlackInput === null || headerBlackInput === void 0 ? void 0 : headerBlackInput.value.trim()) || null,
                playerWhite: (headerWhiteInput === null || headerWhiteInput === void 0 ? void 0 : headerWhiteInput.value.trim()) || null,
                result: (headerResultInput === null || headerResultInput === void 0 ? void 0 : headerResultInput.value.trim()) || null,
            };
            const komiRaw = headerKomiInput === null || headerKomiInput === void 0 ? void 0 : headerKomiInput.value.trim();
            if (komiRaw) {
                const parsed = parseFloat(komiRaw);
                if (!Number.isNaN(parsed)) {
                    patch.komi = parsed;
                }
            }
            this.store.updateGameInfo(patch);
            this.updateUI();
            this.renderer.showMessage('対局情報を更新しました');
            this.populateHeaderFields();
        });
        headerResetBtn === null || headerResetBtn === void 0 ? void 0 : headerResetBtn.addEventListener('click', () => {
            this.populateHeaderFields();
        });
        this.populateHeaderFields();
    }
    applySgf(result) {
        const applyResult = this.sgfService.apply(result);
        this.renderer.updateBoardSize();
        this.updateUI();
        this.populateHeaderFields();
        this.onSgfApplied(applyResult.sgfText);
        this.updateAnswerButtonDisplay();
    }
    populateHeaderFields() {
        var _a, _b, _c, _d;
        const headerTitleInput = document.getElementById('header-title');
        const headerBlackInput = document.getElementById('header-black');
        const headerWhiteInput = document.getElementById('header-white');
        const headerKomiInput = document.getElementById('header-komi');
        const headerResultInput = document.getElementById('header-result');
        if (!headerTitleInput || !headerBlackInput || !headerWhiteInput || !headerKomiInput || !headerResultInput) {
            return;
        }
        const info = this.store.getGameInfo();
        headerTitleInput.value = (_a = info.title) !== null && _a !== void 0 ? _a : '';
        headerBlackInput.value = (_b = info.playerBlack) !== null && _b !== void 0 ? _b : '';
        headerWhiteInput.value = (_c = info.playerWhite) !== null && _c !== void 0 ? _c : '';
        headerKomiInput.value = info.komi !== null && info.komi !== undefined ? String(info.komi) : '';
        headerResultInput.value = (_d = info.result) !== null && _d !== void 0 ? _d : '';
    }
}
//# sourceMappingURL=file-menu-controller.js.map