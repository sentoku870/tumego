export class FileMenuController {
    constructor(dropdownManager, sgfService, renderer, qrManager, updateUI, updateAnswerButtonDisplay) {
        this.dropdownManager = dropdownManager;
        this.sgfService = sgfService;
        this.renderer = renderer;
        this.qrManager = qrManager;
        this.updateUI = updateUI;
        this.updateAnswerButtonDisplay = updateAnswerButtonDisplay;
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
        fileBtn === null || fileBtn === void 0 ? void 0 : fileBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const featureDropdown = document.getElementById('feature-dropdown');
            const isOpen = fileDropdown === null || fileDropdown === void 0 ? void 0 : fileDropdown.classList.contains('show');
            this.dropdownManager.hide(featureDropdown);
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
            try {
                await this.sgfService.copyToClipboard(sgfData);
                this.renderer.showMessage('SGF をコピーしました');
            }
            catch (error) {
                this.renderer.showMessage('クリップボードにコピーできませんでした');
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
    }
    applySgf(result) {
        var _a, _b, _c, _d, _e, _f;
        this.sgfService.apply(result);
        this.renderer.updateBoardSize();
        this.updateUI();
        this.updateAnswerButtonDisplay();
        // ===== SGF対局情報のUI表示処理 =====
        const info = result.gameInfo;
        const metaBox = document.getElementById("sgf-meta");
        if (metaBox) {
            metaBox.innerHTML = `
      黒番: ${(_a = info.blackName) !== null && _a !== void 0 ? _a : '-'}　
      白番: ${(_b = info.whiteName) !== null && _b !== void 0 ? _b : '-'}　
      結果: ${(_c = info.result) !== null && _c !== void 0 ? _c : '-'}<br>
      コミ: ${(_d = info.komi) !== null && _d !== void 0 ? _d : '-'}　
      置石: ${(_e = info.handicapStones) !== null && _e !== void 0 ? _e : '-'}　
      日時: ${(_f = info.date) !== null && _f !== void 0 ? _f : '-'}
    `;
        }
    }
}
//# sourceMappingURL=file-menu-controller.js.map