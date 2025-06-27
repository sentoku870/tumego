export class HistoryManager {
    constructor() {
        this.snapshots = [];
        this.maxSnapshots = 5;
    }
    // ============ 履歴保存 ============
    save(description, state) {
        const snapshot = {
            timestamp: new Date(),
            description: description,
            state: this.cloneGameState(state)
        };
        this.snapshots.unshift(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.pop();
        }
        console.log(`操作履歴保存: ${description}`, this.snapshots.length);
    }
    // ============ 履歴復元 ============
    restore(index, currentState) {
        if (index < 0 || index >= this.snapshots.length)
            return false;
        const snapshot = this.snapshots[index];
        const savedState = snapshot.state;
        // 状態を復元
        Object.assign(currentState, {
            boardSize: savedState.boardSize,
            board: this.cloneBoard(savedState.board),
            mode: savedState.mode,
            sgfMoves: [...savedState.sgfMoves],
            sgfIndex: savedState.sgfIndex,
            numberStartIndex: savedState.numberStartIndex,
            handicapStones: savedState.handicapStones,
            handicapPositions: [...savedState.handicapPositions],
            komi: savedState.komi,
            startColor: savedState.startColor,
            numberMode: savedState.numberMode,
            answerMode: savedState.answerMode,
            turn: savedState.turn,
            eraseMode: false // 復元時は消去モードを無効化
        });
        console.log(`履歴復元: ${snapshot.description}`);
        return true;
    }
    // ============ 履歴一覧取得 ============
    getList() {
        return this.snapshots.map((snapshot, index) => ({
            index: index,
            description: snapshot.description,
            timestamp: snapshot.timestamp,
            timeString: snapshot.timestamp.toLocaleTimeString()
        }));
    }
    // ============ 履歴クリア ============
    clear() {
        this.snapshots = [];
    }
    // ============ 履歴ダイアログ表示 ============
    showHistoryDialog(onRestore) {
        var _a, _b;
        const historyList = this.getList();
        if (historyList.length === 0) {
            alert('📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。');
            return;
        }
        // 既存のポップアップがあれば削除
        const existing = document.getElementById('history-popup');
        existing === null || existing === void 0 ? void 0 : existing.remove();
        const popup = document.createElement('div');
        popup.id = 'history-popup';
        const historyItems = historyList.map((item) => `
      <button data-index="${item.index}" class="history-item-btn"
              style="display:block; width:100%; margin:5px 0; padding:12px; 
                     background:#fff; border:1px solid #ddd; border-radius:6px; 
                     cursor:pointer; text-align:left; font-size:14px; 
                     transition:background 0.2s;">
        <div style="font-weight:600; color:#333;">${this.escapeHtml(item.description)}</div>
        <div style="font-size:12px; color:#666; margin-top:4px;">${item.timeString}</div>
      </button>
    `).join('');
        popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; 
                  background:rgba(0,0,0,0.8); z-index:9999; 
                  display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:15px; 
                    text-align:center; max-width:500px; max-height:80vh; 
                    overflow-y:auto;">
          <h2 style="margin-bottom:20px; color:#333;">📜 操作履歴</h2>
          <p style="margin-bottom:20px; color:#666; font-size:14px;">
            復元したい操作を選択してください（最新${historyList.length}件）
          </p>
          <div style="margin:20px 0;">
            ${historyItems}
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
        // イベントリスナー
        popup.addEventListener('click', (e) => {
            if (e.target === popup.querySelector('div')) {
                popup.remove();
            }
        });
        // 履歴項目のホバー効果
        popup.querySelectorAll('.history-item-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f0f0f0';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#fff';
            });
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                if (confirm('この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。')) {
                    popup.remove();
                    onRestore(index);
                }
            });
        });
        (_a = popup.querySelector('#clear-history-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            if (confirm('操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。')) {
                this.clear();
                popup.remove();
                alert('操作履歴をクリアしました');
            }
        });
        (_b = popup.querySelector('#close-history-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            popup.remove();
        });
        document.body.appendChild(popup);
    }
    // ============ ユーティリティ ============
    cloneGameState(state) {
        return {
            ...state,
            board: this.cloneBoard(state.board),
            history: state.history.map(board => this.cloneBoard(board)),
            sgfMoves: [...state.sgfMoves],
            handicapPositions: [...state.handicapPositions]
        };
    }
    cloneBoard(board) {
        return board.map(row => [...row]);
    }
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
//# sourceMappingURL=history-manager.js.map