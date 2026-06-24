// ============ 履歴ビュー (UI層) ============
// HistoryManager のデータ層をラップしてダイアログ UI を提供する。
// 復元 / クリアは呼び出し側のコールバック (onRestore) と
// HistoryManager の clear() メソッドに委譲する。
import { HistoryItem } from '../../types.js';

export class HistoryView {
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

    const existing = document.getElementById('history-popup');
    existing?.remove();

    const popup = document.createElement('div');
    popup.id = 'history-popup';

    const historyButtons = historyItems
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
      .join('');

    popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%;
                  background:rgba(0,0,0,0.8); z-index:9999;
                  display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:15px;
                    text-align:center; max-width:500px; max-height:80vh;
                    overflow-y:auto;">
          <h2 style="margin-bottom:20px; color:#333;">📜 操作履歴</h2>
          <p style="margin-bottom:20px; color:#666; font-size:14px;">
            復元したい操作を選択してください（最新${historyItems.length}件）
          </p>
          <div style="margin:20px 0;">
            ${historyButtons}
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
        </div>
      </div>
    `;

    popup.addEventListener('click', (e) => {
      if (e.target === popup.querySelector('div')) {
        popup.remove();
      }
    });

    popup.querySelectorAll('.history-item-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.background = '#f0f0f0';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.background = '#fff';
      });
      btn.addEventListener('click', () => {
        const index = parseInt((btn as HTMLElement).dataset.index!);
        if (
          confirm(
            'この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。'
          )
        ) {
          popup.remove();
          onRestore(index);
        }
      });
    });

    popup.querySelector('#clear-history-btn')?.addEventListener('click', () => {
      if (
        confirm(
          '操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。'
        )
      ) {
        if (onClear) {
          onClear();
        }
        popup.remove();
        alert('操作履歴をクリアしました');
      }
    });

    popup.querySelector('#close-history-btn')?.addEventListener('click', () => {
      popup.remove();
    });

    document.body.appendChild(popup);
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
