// ============ 履歴管理 (最小スナップショット専用) ============
// 仕様:
// - 大きい操作のみを最大5件まで記録する簡易スナップショット。
// - 記録対象: 盤サイズ変更前 / 全消去前 / 問題図確定前 / SGF読込前 / ハンデ設定前。
// - 保存フィールドは盤面復元に必要な最低限のみ（SGF関連は含めない）。
// - 復元後のUI更新(Renderer.updateBoardSize/redraw等)は呼び出し側が実行する。
import {
  AnswerMode,
  CellState,
  GameState,
  HistoryItem,
  HistorySnapshot,
  HistorySnapshotState,
  OperationHistory,
  Position,
} from "./types.js";

export class HistoryManager implements OperationHistory {
  private snapshots: HistorySnapshot[] = [];
  private readonly maxSnapshots = 5;

  save(label: string, state: GameState): void {
    const snapshot: HistorySnapshot = {
      timestamp: new Date(),
      label,
      state: this.cloneSnapshotState(state),
    };

    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.pop();
    }
  }

  restore(index: number, currentState: GameState): boolean {
    if (index < 0 || index >= this.snapshots.length) return false;

    const saved = this.snapshots[index].state as HistorySnapshotState;

    currentState.boardSize = saved.boardSize;
    currentState.board = this.cloneBoard(saved.board);
    currentState.turn = saved.turn;
    currentState.numberMode = saved.numberMode;
    currentState.answerMode = saved.answerMode as AnswerMode;
    currentState.problemDiagramSet = saved.problemDiagramSet;
    currentState.problemDiagramBlack = this.clonePositions(
      saved.problemDiagramBlack
    );
    currentState.problemDiagramWhite = this.clonePositions(
      saved.problemDiagramWhite
    );
    currentState.handicapStones = saved.handicapStones;
    currentState.handicapPositions = this.clonePositions(
      saved.handicapPositions
    );
    currentState.startColor = saved.startColor;
    currentState.eraseMode = false;

    return true;
  }

  restoreLast(currentState: GameState): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    const restored = this.restore(0, currentState);
    if (restored) {
      this.snapshots.shift();
    }

    return restored;
  }

  getList(): HistoryItem[] {
    return this.snapshots.map((snapshot, index) => ({
      index,
      label: snapshot.label,
      timestamp: snapshot.timestamp,
      timeString: snapshot.timestamp.toLocaleTimeString(),
    }));
  }

  clear(): void {
    this.snapshots = [];
  }

  showHistoryDialog(onRestore: (index: number) => void): void {
    const historyList = this.getList();

    if (historyList.length === 0) {
      alert(
        "📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。"
      );
      return;
    }

    const existing = document.getElementById("history-popup");
    existing?.remove();

    const popup = document.createElement("div");
    popup.id = "history-popup";

    const historyItems = historyList
      .map(
        (item) => `
      <button data-index="${item.index}" class="history-item-btn"
              style="display:block; width:100%; margin:5px 0; padding:12px;
                     background:#fff; border:1px solid #ddd; border-radius:6px;
                     cursor:pointer; text-align:left; font-size:14px;
                     transition:background 0.2s;">
        <div style="font-weight:600; color:#333;">${this.escapeHtml(item.label)}</div>
        <div style="font-size:12px; color:#666; margin-top:4px;">${item.timeString}</div>
      </button>
    `
      )
      .join("");

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

    popup.addEventListener("click", (e) => {
      if (e.target === popup.querySelector("div")) {
        popup.remove();
      }
    });

    popup.querySelectorAll(".history-item-btn").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        (btn as HTMLElement).style.background = "#f0f0f0";
      });
      btn.addEventListener("mouseleave", () => {
        (btn as HTMLElement).style.background = "#fff";
      });
      btn.addEventListener("click", () => {
        const index = parseInt((btn as HTMLElement).dataset.index!);
        if (
          confirm(
            "この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。"
          )
        ) {
          popup.remove();
          onRestore(index);
        }
      });
    });

    popup.querySelector("#clear-history-btn")?.addEventListener("click", () => {
      if (
        confirm(
          "操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。"
        )
      ) {
        this.clear();
        popup.remove();
        alert("操作履歴をクリアしました");
      }
    });

    popup.querySelector("#close-history-btn")?.addEventListener("click", () => {
      popup.remove();
    });

    document.body.appendChild(popup);
  }

  private cloneSnapshotState(state: GameState): HistorySnapshotState {
    return {
      boardSize: state.boardSize,
      board: this.cloneBoard(state.board),
      turn: state.turn,
      numberMode: state.numberMode,
      answerMode: state.answerMode,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: this.clonePositions(state.problemDiagramBlack),
      problemDiagramWhite: this.clonePositions(state.problemDiagramWhite),
      handicapStones: state.handicapStones,
      handicapPositions: this.clonePositions(state.handicapPositions),
      startColor: state.startColor,
    };
  }

  private cloneBoard(board: CellState[][]): CellState[][] {
    return board.map((row) => [...row]) as CellState[][];
  }

  private clonePositions(positions: Position[]): Position[] {
    return positions.map((pos) => ({ ...pos }));
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
