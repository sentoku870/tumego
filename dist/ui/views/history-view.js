import { Modal } from './modal.js';
export class HistoryView {
    constructor() {
        this.currentModal = null;
    }
    /**
     * 履歴一覧を表示する。空のときは alert で通知して終了。
     * @param historyItems 表示する履歴一覧
     * @param onRestore (index: number) => void 履歴選択時のコールバック
     * @param onClear 履歴クリア時のコールバック(undefined なら内部で何もしない)
     */
    render(historyItems, onRestore, onClear) {
        if (historyItems.length === 0) {
            alert("📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。");
            return;
        }
        const root = document.createElement('div');
        root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">📜 操作履歴</h2>
      <p style="margin-bottom:20px; color:#666; font-size:14px;">
        復元したい操作を選択してください（最新${historyItems.length}件）
      </p>
      <div class="history-list" style="margin:20px 0;">
        ${historyItems
            .map((item) => `
              <button data-index="${item.index}" class="history-item-btn"
                      style="display:block; width:100%; margin:5px 0; padding:12px;
                             background:#fff; border:1px solid #ddd; border-radius:6px;
                             cursor:pointer; text-align:left; font-size:14px;
                             transition:background 0.2s;">
                <div style="font-weight:600; color:#333;">${HistoryView.escapeHtml(item.label)}</div>
                <div style="font-size:12px; color:#666; margin-top:4px;">${item.timeString}</div>
              </button>
            `)
            .join('')}
      </div>
      <div style="margin-top:20px; padding-top:15px; border-top:1px solid #eee;">
        <button id="clear-history-btn"
                style="margin:5px; padding:8px 16px; background:#ff6b35; color:white;
                       border:none; border-radius:6px; cursor:pointer; font-size:13px;">
          🗑️ 履歴クリア
        </button>
        <button id="close-history-btn"
                style="margin:5px; padding:8px 16px; background:#666; color:white;
                       border:none; border-radius:6px; cursor:pointer; font-size:13px;">
          ❌ 閉じる
        </button>
      </div>
      <div style="font-size:11px; color:#999; margin-top:10px;">
        ⚠️ 履歴復元後は、復元時点以降の操作が失われます
      </div>
    `;
        this.attachItemHandlers(root, onRestore);
        this.attachFooterHandlers(root, onClear);
        this.currentModal = new Modal({
            id: 'history-popup',
            content: root,
            overlayOpacity: 0.8,
            maxWidth: '500px',
        });
        this.currentModal.open();
    }
    attachItemHandlers(root, onRestore) {
        root.querySelectorAll('.history-item-btn').forEach((btn) => {
            const element = btn;
            element.addEventListener('mouseenter', () => {
                element.style.background = '#f0f0f0';
            });
            element.addEventListener('mouseleave', () => {
                element.style.background = '#fff';
            });
            element.addEventListener('click', () => {
                var _a;
                const indexRaw = element.dataset.index;
                if (indexRaw === undefined)
                    return;
                const index = parseInt(indexRaw, 10);
                if (!Number.isFinite(index))
                    return;
                if (confirm('この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。')) {
                    (_a = this.currentModal) === null || _a === void 0 ? void 0 : _a.close();
                    this.currentModal = null;
                    onRestore(index);
                }
            });
        });
    }
    attachFooterHandlers(root, onClear) {
        var _a, _b;
        (_a = root.querySelector('#clear-history-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            var _a;
            if (confirm('操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。')) {
                if (onClear) {
                    onClear();
                }
                (_a = this.currentModal) === null || _a === void 0 ? void 0 : _a.close();
                this.currentModal = null;
                alert('操作履歴をクリアしました');
            }
        });
        (_b = root.querySelector('#close-history-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a;
            (_a = this.currentModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentModal = null;
        });
    }
    static escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
//# sourceMappingURL=history-view.js.map