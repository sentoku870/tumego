// ============ 履歴管理 ============
import {
  GameState,
  HistorySnapshot,
  HistoryItem,
  CellState,
  GameTree,
  SGFNode,
  Move,
  OperationHistory,
} from "./types.js";

interface RestoreFieldMapping {
  readonly key: keyof GameState;
  readonly apply: (current: GameState, saved: GameState) => void;
}

export class HistoryManager implements OperationHistory {
  private snapshots: HistorySnapshot[] = [];
  private readonly maxSnapshots = 5;
  private readonly restoreFieldMappings: RestoreFieldMapping[] = [
    {
      key: "boardSize",
      apply: (current, saved) => {
        current.boardSize = saved.boardSize;
      },
    },
    {
      key: "board",
      apply: (current, saved) => {
        current.board = this.cloneBoard(saved.board);
      },
    },
    {
      key: "mode",
      apply: (current, saved) => {
        current.mode = saved.mode;
      },
    },
    {
      key: "sgfMoves",
      apply: (current, saved) => {
        current.sgfMoves = saved.sgfMoves.map((move) => ({ ...move }));
      },
    },
    {
      key: "sgfIndex",
      apply: (current, saved) => {
        current.sgfIndex = saved.sgfIndex;
      },
    },
    {
      key: "numberStartIndex",
      apply: (current, saved) => {
        current.numberStartIndex = saved.numberStartIndex;
      },
    },
    {
      key: "handicapStones",
      apply: (current, saved) => {
        current.handicapStones = saved.handicapStones;
      },
    },
    {
      key: "handicapPositions",
      apply: (current, saved) => {
        current.handicapPositions = saved.handicapPositions.map((pos) => ({
          ...pos,
        }));
      },
    },
    {
      key: "komi",
      apply: (current, saved) => {
        current.komi = saved.komi;
      },
    },
    {
      key: "startColor",
      apply: (current, saved) => {
        current.startColor = saved.startColor;
      },
    },
    {
      key: "numberMode",
      apply: (current, saved) => {
        current.numberMode = saved.numberMode;
      },
    },
    {
      key: "answerMode",
      apply: (current, saved) => {
        current.answerMode = saved.answerMode;
      },
    },
    {
      key: "problemDiagramSet",
      apply: (current, saved) => {
        current.problemDiagramSet = saved.problemDiagramSet;
      },
    },
    {
      key: "problemDiagramBlack",
      apply: (current, saved) => {
        current.problemDiagramBlack = saved.problemDiagramBlack.map((pos) => ({
          ...pos,
        }));
      },
    },
    {
      key: "problemDiagramWhite",
      apply: (current, saved) => {
        current.problemDiagramWhite = saved.problemDiagramWhite.map((pos) => ({
          ...pos,
        }));
      },
    },
    {
      key: "turn",
      apply: (current, saved) => {
        current.turn = saved.turn;
      },
    },
    {
      key: "history",
      apply: (current, saved) => {
        current.history = this.cloneHistory(saved.history);
      },
    },
    {
      key: "gameTree",
      apply: (current, saved) => {
        current.gameTree = saved.gameTree
          ? this.cloneGameTree(saved.gameTree)
          : null;
      },
    },
    {
      key: "sgfLoadedFromExternal",
      apply: (current, saved) => {
        current.sgfLoadedFromExternal = saved.sgfLoadedFromExternal;
      },
    },
    {
      key: "sgfMeta",
      apply: (current, saved) => {
        if ((saved as any).sgfMeta === undefined) {
          // remove any existing sgfMeta to fully restore saved shape
          delete (current as any).sgfMeta;
        } else {
          (current as any).sgfMeta = { ...(saved as any).sgfMeta };
        }
      },
    },
  ];

  // ============ 履歴保存 ============
  save(description: string, state: GameState): void {
    const snapshot: HistorySnapshot = {
      timestamp: new Date(),
      description: description,
      state: this.cloneGameState(state),
    };

    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.pop();
    }

    console.log(`操作履歴保存: ${description}`, this.snapshots.length);
  }

  // ============ 履歴復元 ============
  restore(index: number, currentState: GameState): boolean {
    if (index < 0 || index >= this.snapshots.length) return false;

    const snapshot = this.snapshots[index];
    const savedState = snapshot.state;

    this.restoreFieldMappings.forEach((mapping) => {
      mapping.apply(currentState, savedState);
    });

    currentState.eraseMode = false; // 復元時は消去モードを無効化

    console.log(`履歴復元: ${snapshot.description}`);
    return true;
  }

  // ============ 履歴一覧取得 ============
  getList(): HistoryItem[] {
    return this.snapshots.map((snapshot, index) => ({
      index: index,
      description: snapshot.description,
      timestamp: snapshot.timestamp,
      timeString: snapshot.timestamp.toLocaleTimeString(),
    }));
  }

  // ============ 履歴クリア ============
  clear(): void {
    this.snapshots = [];
  }

  // ============ 履歴ダイアログ表示 ============
  showHistoryDialog(onRestore: (index: number) => void): void {
    const historyList = this.getList();

    if (historyList.length === 0) {
      alert(
        "📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。"
      );
      return;
    }

    // 既存のポップアップがあれば削除
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
        <div style="font-weight:600; color:#333;">${this.escapeHtml(
          item.description
        )}</div>
        <div style="font-size:12px; color:#666; margin-top:4px;">${
          item.timeString
        }</div>
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

    // イベントリスナー
    popup.addEventListener("click", (e) => {
      if (e.target === popup.querySelector("div")) {
        popup.remove();
      }
    });

    // 履歴項目のホバー効果
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

  // ============ ユーティリティ ============
  private cloneGameState(state: GameState): GameState {
    return {
      ...state,
      board: this.cloneBoard(state.board),
      history: this.cloneHistory(state.history),
      sgfMoves: state.sgfMoves.map((move) => ({ ...move })),
      handicapPositions: state.handicapPositions.map((pos) => ({ ...pos })),
      problemDiagramBlack: state.problemDiagramBlack.map((pos) => ({ ...pos })),
      problemDiagramWhite: state.problemDiagramWhite.map((pos) => ({ ...pos })),
      gameTree: state.gameTree ? this.cloneGameTree(state.gameTree) : null,
    };
  }

  private cloneBoard(board: CellState[][]): CellState[][] {
    return board.map((row) => [...row]) as CellState[][];
  }

  private cloneHistory(history: CellState[][][]): CellState[][][] {
    return history.map((board) => this.cloneBoard(board));
  }

  private cloneGameTree(tree: GameTree): GameTree {
    const nodeMap = new Map<SGFNode, SGFNode>();

    const cloneNode = (node: SGFNode, parent?: SGFNode): SGFNode => {
      const clonedMove = node.move ? ({ ...node.move } as Move) : undefined;
      const clonedNode: SGFNode = {
        id: node.id,
        move: clonedMove,
        comment: node.comment,
        label: node.label,
        mainLine: node.mainLine,
        parent,
        children: [],
      };

      nodeMap.set(node, clonedNode);
      clonedNode.children = node.children.map((child) =>
        cloneNode(child, clonedNode)
      );
      return clonedNode;
    };

    const rootClone = cloneNode(tree.rootNode);
    const currentClone = nodeMap.get(tree.currentNode) || rootClone;
    const pathClone = tree.currentPath
      .map((node) => nodeMap.get(node))
      .filter((node): node is SGFNode => Boolean(node));

    return {
      rootNode: rootClone,
      currentNode: currentClone,
      currentPath: pathClone,
    };
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
