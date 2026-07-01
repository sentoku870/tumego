// ============ モーダル共通コンポーネント ============
// 4 箇所（QRManager, FeatureMenuController, HistoryView, BoardCaptureService）
// で重複していた「黒半透明オーバーレイ + 白カード + 閉じる」HTML を集約する。
// 既存見た目を維持しつつ、a11y 対応とライフサイクル管理を統一する。
export class Modal {
    constructor(options) {
        this.options = options;
        this.element = null;
        this.escHandler = null;
    }
    open() {
        var _a, _b;
        this.close();
        const overlayOpacity = (_a = this.options.overlayOpacity) !== null && _a !== void 0 ? _a : 0.85;
        const maxWidth = (_b = this.options.maxWidth) !== null && _b !== void 0 ? _b : '500px';
        const content = this.options.content;
        const overlay = document.createElement('div');
        overlay.id = this.options.id;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,${overlayOpacity}); z-index:9999; display:flex; justify-content:center; align-items:center;`;
        const card = document.createElement('div');
        card.className = 'modal-card';
        card.style.cssText = `background:white; padding:25px; border-radius:15px; text-align:center; max-width:${maxWidth}; max-height:90vh; overflow-y:auto; position:relative;`;
        if (typeof content === 'string') {
            card.innerHTML = content;
        }
        else {
            card.appendChild(content);
        }
        overlay.appendChild(card);
        if (this.options.closeOnBackdrop !== false) {
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    this.close();
                }
            });
        }
        if (this.options.closeOnEsc !== false) {
            this.escHandler = (event) => {
                if (event.key === 'Escape') {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escHandler);
        }
        document.body.appendChild(overlay);
        this.element = overlay;
    }
    close() {
        var _a, _b;
        if (!this.element) {
            return;
        }
        this.element.remove();
        this.element = null;
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        (_b = (_a = this.options).onClose) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    isOpen() {
        return this.element !== null;
    }
}
//# sourceMappingURL=modal.js.map