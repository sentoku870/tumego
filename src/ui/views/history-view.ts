// ============ 履歴ビュー (UI層) ============
// HistoryManager のデータ層をラップしてダイアログ UI を提供する。
// 復元 / クリアは呼び出し側のコールバック (onRestore) と
// HistoryManager の clear() メソッドに委譲する。
// モーダル UI は共通コンポーネント (Modal) に委譲する。
import { HistoryItem } from '../../types.js';
import { Modal } from './modal.js';

export class HistoryView {
  private currentModal: Modal | null = null;

  /**
   * 履歴一覧を表示する。空のときは alert で通知して終了。
   * @param historyItems 表示する履歴一覧
   * @param onRestore (index: number) => void 履歴選択時のコールバック
   * @param onClear 履歴クリア時のコールバック(undefined なら内部で何もしない)
   */
  render(
    historyItems: HistoryItem[],
    onRestore: (index: number) => void,
    onClear?: () => void
  ): void {
    if (historyItems.length === 0) {
      alert(
        "📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。"
      );
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
          .map(
            (item) => `
              <button data-index="${item.index}" class="history-item-btn"
                      style="display:block; width:100%; margin:5px 0; padding:12px;
                             background:#fff; border:1px solid #ddd; border-radius:6px;
                             cursor:pointer; text-align:left; font-size:14px;
                             transition:background 0.2s;">
                <div style="font-weight:600; color:#333;">${HistoryView.escapeHtml(item.label)}</div>
                <div style="font-size:12px; color:#666; margin-top:4px;">${item.timeString}</div>
              </button>
            `
          )
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

  private attachItemHandlers(
    root: HTMLElement,
    onRestore: (index: number) => void
  ): void {
    root.querySelectorAll('.history-item-btn').forEach((btn) => {
      const element = btn as HTMLElement;
      element.addEventListener('mouseenter', () => {
        element.style.background = '#f0f0f0';
      });
      element.addEventListener('mouseleave', () => {
        element.style.background = '#fff';
      });
      element.addEventListener('click', () => {
        const index = parseInt(element.dataset.index!, 10);
        if (
          confirm(
            'この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。'
          )
        ) {
          this.currentModal?.close();
          this.currentModal = null;
          onRestore(index);
        }
      });
    });
  }

  private attachFooterHandlers(
    root: HTMLElement,
    onClear: (() => void) | undefined
  ): void {
    root.querySelector('#clear-history-btn')?.addEventListener('click', () => {
      if (
        confirm(
          '操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。'
        )
      ) {
        if (onClear) {
          onClear();
        }
        this.currentModal?.close();
        this.currentModal = null;
        alert('操作履歴をクリアしました');
      }
    });

    root.querySelector('#close-history-btn')?.addEventListener('click', () => {
      this.currentModal?.close();
      this.currentModal = null;
    });
  }

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
