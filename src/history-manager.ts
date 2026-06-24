// ============ 履歴管理 (最小スナップショット専用) ============
// 仕様:
// - 大きい操作のみを最大5件まで記録する簡易スナップショット。
// - 記録対象: 盤サイズ変更前 / 全消去前 / 問題図確定 / SGF読込前 / ハンデ設定前 / 解答開始前など。
// - 解答・編集モードを問わず、同じスナップショットスタックを利用する。
// - 復元後のUI更新(Renderer.updateBoardSize/redraw等)は呼び出し側が実行する。
import {
  AnswerMode,
  CellState,
  GameState,
  HistoryItem,
  HistorySnapshot,
  HistorySnapshotState,
  Move,
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
    this.snapshots = this.snapshots.slice(index + 1);

    this.applySnapshot(saved, currentState);
    return true;
  }

  restoreLast(currentState: GameState): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    return this.restore(0, currentState);
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

  private cloneSnapshotState(state: GameState): HistorySnapshotState {
    return {
      boardSize: state.boardSize,
      board: this.cloneBoard(state.board),
      mode: state.mode,
      eraseMode: state.eraseMode,
      turn: state.turn,
      numberMode: state.numberMode,
      answerMode: state.answerMode,
      sgfMoves: this.cloneMoves(state.sgfMoves),
      sgfIndex: state.sgfIndex,
      numberStartIndex: state.numberStartIndex,
      komi: state.komi,
      problemDiagramSet: state.problemDiagramSet,
      problemDiagramBlack: this.clonePositions(state.problemDiagramBlack),
      problemDiagramWhite: this.clonePositions(state.problemDiagramWhite),
      handicapStones: state.handicapStones,
      handicapPositions: this.clonePositions(state.handicapPositions),
      startColor: state.startColor,
      sgfLoadedFromExternal: state.sgfLoadedFromExternal,
      capturedCounts: state.capturedCounts
        ? { ...state.capturedCounts }
        : { black: 0, white: 0 },
    };
  }

  private cloneBoard(board: CellState[][]): CellState[][] {
    return board.map((row) => [...row]) as CellState[][];
  }

  private cloneMoves(moves: Move[]): Move[] {
    return moves.map((move) => ({ ...move }));
  }

  private clonePositions(positions: Position[]): Position[] {
    return positions.map((pos) => ({ ...pos }));
  }

  private applySnapshot(saved: HistorySnapshotState, currentState: GameState): void {
    currentState.boardSize = saved.boardSize;
    currentState.board = this.cloneBoard(saved.board);
    currentState.mode = saved.mode;
    currentState.eraseMode = saved.eraseMode;
    currentState.turn = saved.turn;
    currentState.numberMode = saved.numberMode;
    currentState.answerMode = saved.answerMode as AnswerMode;
    currentState.sgfMoves = this.cloneMoves(saved.sgfMoves ?? []);
    currentState.sgfIndex = saved.sgfIndex ?? saved.sgfMoves?.length ?? 0;
    currentState.numberStartIndex = saved.numberStartIndex ?? 0;
    currentState.komi = saved.komi ?? currentState.komi;
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
    currentState.sgfLoadedFromExternal = saved.sgfLoadedFromExternal ?? false;
    currentState.capturedCounts = saved.capturedCounts
      ? { ...saved.capturedCounts }
      : { black: 0, white: 0 };
  }
}
