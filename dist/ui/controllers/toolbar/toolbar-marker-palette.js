import { MARKER_LETTER_SEQUENCE } from '../../../types.js';
const MARKER_KINDS = ['CR', 'TR', 'SQ', 'MA', 'LB'];
const MARKER_GLYPHS = {
    CR: '○',
    TR: '△',
    SQ: '□',
    MA: '×',
    LB: '文字',
};
export class ToolbarMarkerPalette {
    constructor(store, eventBus, dropdownManager, onBeforeOpen = () => { }) {
        this.store = store;
        this.eventBus = eventBus;
        this.dropdownManager = dropdownManager;
        this.onBeforeOpen = onBeforeOpen;
        this.__markerBtn = null;
        this.__markerDropdown = null;
        this.__markerPaletteBtns = {};
        this.__markerLetterBtn = null;
        this.__markerClearBtn = null;
        this.unsubscribeDocument = null;
    }
    /** パレットの DOM 参照を確保する（冪等） */
    ensureButtonRefs() {
        var _a, _b, _c, _d;
        this.__markerBtn = (_a = this.__markerBtn) !== null && _a !== void 0 ? _a : document.getElementById('btn-marker');
        this.__markerDropdown = (_b = this.__markerDropdown) !== null && _b !== void 0 ? _b : document.getElementById('marker-dropdown');
        this.__markerClearBtn = (_c = this.__markerClearBtn) !== null && _c !== void 0 ? _c : document.getElementById('btn-marker-clear');
        this.__markerLetterBtn = (_d = this.__markerLetterBtn) !== null && _d !== void 0 ? _d : document.getElementById('btn-marker-select-LB');
        for (const kind of MARKER_KINDS) {
            if (kind === 'LB')
                continue; // LB は単一の cycling ボタン
            if (this.__markerPaletteBtns[kind])
                continue;
            this.__markerPaletteBtns[kind] = document.getElementById(`btn-marker-select-${kind}`);
        }
    }
    /** イベントリスナーをバインドする */
    bindEvents() {
        var _a, _b;
        this.ensureButtonRefs();
        if (this.__markerBtn) {
            this.__markerBtn.title = 'マーカー（○△□×／ラベル）パレットを開閉します';
        }
        // トリガーボタンはパレットの開閉専用。マーカー選択状態は触らない。
        (_a = this.__markerBtn) === null || _a === void 0 ? void 0 : _a.addEventListener('click', (event) => {
            event.stopPropagation();
            const dropdown = this.__markerDropdown;
            const btn = this.__markerBtn;
            if (!btn || !dropdown)
                return;
            const isOpen = dropdown.classList.contains('show');
            if (isOpen) {
                this.dropdownManager.hide(dropdown);
            }
            else {
                this.onBeforeOpen();
                this.dropdownManager.open(btn, dropdown);
            }
        });
        (_b = this.__markerDropdown) === null || _b === void 0 ? void 0 : _b.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        // パレット外クリックで閉じる
        if (this.__markerBtn && !this.unsubscribeDocument) {
            const btn = this.__markerBtn;
            const dropdown = this.__markerDropdown;
            const documentHandler = (event) => {
                if (!dropdown)
                    return;
                if (!dropdown.classList.contains('show'))
                    return;
                const target = event.target;
                if (target && (dropdown.contains(target) || btn.contains(target))) {
                    return;
                }
                this.dropdownManager.hide(dropdown);
            };
            document.addEventListener('click', documentHandler);
            this.unsubscribeDocument = () => {
                document.removeEventListener('click', documentHandler);
            };
        }
        // ○△□× を選んだとき: パレットは閉じず、選択種別だけ切り替える
        for (const kind of ['CR', 'TR', 'SQ', 'MA']) {
            const item = document.getElementById(`btn-marker-select-${kind}`);
            item === null || item === void 0 ? void 0 : item.addEventListener('click', () => {
                this.onBeforeOpen();
                this.handlePaletteItemSelect(kind, null);
            });
        }
        // 文字マーカー: アクティブでないとき A から開始。アクティブのとき再クリックで OFF。
        const letterBtn = this.__markerLetterBtn;
        letterBtn === null || letterBtn === void 0 ? void 0 : letterBtn.addEventListener('click', () => {
            var _a;
            this.onBeforeOpen();
            const state = this.store.snapshot;
            if (state.markerMode && state.activeMarkerKind === 'LB') {
                // 同じものを再クリック → トグル OFF
                this.store.setMarkerMode(null);
            }
            else {
                // 現在の activeMarkerLabel から開始（未設定なら A）
                const startLabel = (_a = state.activeMarkerLabel) !== null && _a !== void 0 ? _a : MARKER_LETTER_SEQUENCE[0];
                this.store.setMarkerMode('LB', startLabel);
            }
            this.setActiveButton();
            this.eventBus.emitUIUpdate();
        });
        const clearBtn = this.__markerClearBtn;
        clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
            this.store.clearMarkers();
            this.eventBus.emitUIUpdate();
        });
        const closeBtn = document.getElementById('btn-marker-close');
        closeBtn === null || closeBtn === void 0 ? void 0 : closeBtn.addEventListener('click', () => {
            // パレットを閉じると同時にマーカーモードも解除 → 黒配置/自由配置に戻れる
            this.store.setMarkerMode(null);
            if (this.__markerDropdown) {
                this.dropdownManager.hide(this.__markerDropdown);
            }
            this.setActiveButton();
            this.eventBus.emitUIUpdate();
        });
    }
    /** アンマウント時のクリーンアップ */
    dispose() {
        var _a;
        (_a = this.unsubscribeDocument) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribeDocument = null;
    }
    // ============ ボタン参照の読み取り専用ゲッター ============
    // ToolbarButtons から透過的にアクセスするため
    get _markerBtn() { return this.__markerBtn; }
    get _markerDropdown() { return this.__markerDropdown; }
    get _markerPaletteBtns() { return this.__markerPaletteBtns; }
    get _markerLetterBtn() { return this.__markerLetterBtn; }
    get _markerClearBtn() { return this.__markerClearBtn; }
    /** マーカートリガーボタンの active 状態とラベル、palette の選択表示を更新 */
    setActiveButton() {
        this.ensureButtonRefs();
        const state = this.store.snapshot;
        const active = state.activeMarkerKind;
        const activeLabel = state.activeMarkerLabel;
        if (this.__markerBtn) {
            this.__markerBtn.classList.toggle('active', active !== null);
            let label = '🔘 マーカー';
            if (active) {
                if (active === 'LB' && activeLabel) {
                    label = `🔘 マーカー (${activeLabel})`;
                }
                else {
                    label = `🔘 マーカー (${MARKER_GLYPHS[active]})`;
                }
            }
            if (this.__markerBtn.textContent !== label) {
                this.__markerBtn.textContent = label;
            }
        }
        for (const kind of ['CR', 'TR', 'SQ', 'MA']) {
            const btn = this.__markerPaletteBtns[kind];
            if (!btn)
                continue;
            btn.classList.toggle('active', active === kind);
        }
        if (this.__markerLetterBtn) {
            this.__markerLetterBtn.classList.toggle('active', active === 'LB');
        }
    }
    /**
     * 盤面クリック時など、外部要因でマーカーパレットを閉じたいときに呼ぶ。
     * マーカー選択状態 (markerMode) は維持したまま、パレットだけを閉じる。
     */
    closePalette() {
        this.ensureButtonRefs();
        if (this.__markerDropdown && this.__markerDropdown.classList.contains('show')) {
            this.dropdownManager.hide(this.__markerDropdown);
        }
    }
    handlePaletteItemSelect(kind, label) {
        const state = this.store.snapshot;
        // 同じものを再クリック → トグル OFF
        if (state.markerMode && state.activeMarkerKind === kind && state.activeMarkerLabel === label) {
            this.store.setMarkerMode(null);
        }
        else {
            this.store.setMarkerMode(kind, label);
        }
        this.setActiveButton();
        this.eventBus.emitUIUpdate();
    }
}
//# sourceMappingURL=toolbar-marker-palette.js.map