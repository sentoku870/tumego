export class HeaderEditor {
    constructor(store, renderer, eventBus) {
        this.store = store;
        this.renderer = renderer;
        this.eventBus = eventBus;
    }
    /** DOM フィールドを state.gameInfo から初期化する */
    populateFields() {
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
    /** イベントリスナーをバインドする */
    bindEvents() {
        const headerApplyBtn = document.getElementById('btn-header-apply');
        const headerResetBtn = document.getElementById('btn-header-reset');
        headerApplyBtn === null || headerApplyBtn === void 0 ? void 0 : headerApplyBtn.addEventListener('click', () => this.applyFromFields());
        headerResetBtn === null || headerResetBtn === void 0 ? void 0 : headerResetBtn.addEventListener('click', () => this.populateFields());
    }
    /** DOM フィールドから読み取って store.updateGameInfo() に反映する */
    applyFromFields() {
        var _a;
        const headerTitleInput = document.getElementById('header-title');
        const headerBlackInput = document.getElementById('header-black');
        const headerWhiteInput = document.getElementById('header-white');
        const headerKomiInput = document.getElementById('header-komi');
        const headerResultInput = document.getElementById('header-result');
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
        this.eventBus.emitUIUpdate();
        this.renderer.showMessage('対局情報を更新しました');
        this.populateFields();
    }
}
//# sourceMappingURL=header-editor.js.map