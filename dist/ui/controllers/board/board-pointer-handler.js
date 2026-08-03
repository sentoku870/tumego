/**
 * クリック/ドラッグ位置に対して、状態に応じた操作を実行する。
 * numberMode (解答モード) / markerMode / eraseMode の優先度で分岐する。
 */
export class BoardPointerHandler {
    constructor(store, uiState, eventBus, preferences) {
        this.store = store;
        this.uiState = uiState;
        this.eventBus = eventBus;
        this.preferences = preferences;
    }
    /**
     * クリック位置に対して現在のモードに応じた操作を実行する。
     * 副作用として EventBus.emitUIUpdate() を呼ぶ。
     */
    handleClick(pos) {
        const state = this.store.snapshot;
        // In solve mode, marker/erase modes are meaningless (you are playing
        // through the solution). Always treat the click as a stone placement
        // regardless of stale markerMode/eraseMode flags.
        if (state.numberMode) {
            this.placeStone(pos);
            return;
        }
        if (state.markerMode) {
            this.toggleMarker(pos);
            return;
        }
        if (state.eraseMode) {
            this.erase(pos);
        }
        else {
            this.placeStone(pos);
        }
    }
    /** 石を配置する (解答/編集両モード) */
    placeStone(pos) {
        var _a;
        const state = this.store.snapshot;
        // === 解答モード（numberMode = true）==========================
        if (state.numberMode) {
            if (this.store.tryMove(pos)) {
                this.eventBus.emitUIUpdate();
            }
            return;
        }
        // === 編集モード（numberMode = false）==========================
        const rulesMode = this.preferences.state.edit.rulesMode;
        const color = (_a = this.uiState.drag.dragColor) !== null && _a !== void 0 ? _a : this.store.currentColor;
        const placed = rulesMode === 'standard'
            ? this.store.placeWithRulesInEdit(pos, color)
            : this.store.directPlace(pos, color);
        if (placed) {
            this.eventBus.emitUIUpdate();
        }
    }
    /** 石を削除する (解答: SGF 編集 / 編集: 直接削除) */
    erase(pos) {
        const state = this.store.snapshot;
        // === 解答モード：SGF編集としての削除 ==========================
        if (state.numberMode) {
            if (this.store.removeStone(pos)) {
                this.eventBus.emitUIUpdate();
                return true;
            }
            return false;
        }
        // === 編集モード：盤面直接消し ==========================
        if (this.store.directRemove(pos)) {
            this.eventBus.emitUIUpdate();
            return true;
        }
        return false;
    }
    /** マーカーをトグル配置する */
    toggleMarker(pos) {
        if (!this.store.snapshot.activeMarkerKind) {
            return;
        }
        const allowMulti = Boolean(this.preferences.state.solve.allowMultiMarker);
        this.store.toggleMarker(pos, allowMulti);
        this.eventBus.emitUIUpdate();
    }
}
//# sourceMappingURL=board-pointer-handler.js.map