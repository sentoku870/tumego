import { cloneBoard } from "./state/board-utils.js";
export class HistoryManager {
    constructor() {
        this.snapshots = [];
        this.maxSnapshots = 5;
    }
    save(label, state) {
        const snapshot = {
            timestamp: new Date(),
            label,
            state: this.cloneSnapshotState(state),
        };
        this.snapshots.unshift(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.pop();
        }
    }
    restore(index, currentState) {
        if (index < 0 || index >= this.snapshots.length)
            return false;
        const saved = this.snapshots[index].state;
        this.snapshots = this.snapshots.slice(index + 1);
        this.applySnapshot(saved, currentState);
        return true;
    }
    restoreLast(currentState) {
        if (this.snapshots.length === 0) {
            return false;
        }
        return this.restore(0, currentState);
    }
    getList() {
        return this.snapshots.map((snapshot, index) => ({
            index,
            label: snapshot.label,
            timestamp: snapshot.timestamp,
            timeString: snapshot.timestamp.toLocaleTimeString(),
        }));
    }
    clear() {
        this.snapshots = [];
    }
    cloneSnapshotState(state) {
        return {
            boardSize: state.boardSize,
            board: cloneBoard(state.board),
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
    cloneMoves(moves) {
        return moves.map((move) => ({ ...move }));
    }
    clonePositions(positions) {
        return positions.map((pos) => ({ ...pos }));
    }
    applySnapshot(saved, currentState) {
        var _a, _b, _c, _d, _e, _f, _g;
        currentState.boardSize = saved.boardSize;
        currentState.board = cloneBoard(saved.board);
        currentState.mode = saved.mode;
        currentState.eraseMode = saved.eraseMode;
        currentState.turn = saved.turn;
        currentState.numberMode = saved.numberMode;
        currentState.answerMode = saved.answerMode;
        currentState.sgfMoves = this.cloneMoves((_a = saved.sgfMoves) !== null && _a !== void 0 ? _a : []);
        currentState.sgfIndex = (_d = (_b = saved.sgfIndex) !== null && _b !== void 0 ? _b : (_c = saved.sgfMoves) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0;
        currentState.numberStartIndex = (_e = saved.numberStartIndex) !== null && _e !== void 0 ? _e : 0;
        currentState.komi = (_f = saved.komi) !== null && _f !== void 0 ? _f : currentState.komi;
        currentState.problemDiagramSet = saved.problemDiagramSet;
        currentState.problemDiagramBlack = this.clonePositions(saved.problemDiagramBlack);
        currentState.problemDiagramWhite = this.clonePositions(saved.problemDiagramWhite);
        currentState.handicapStones = saved.handicapStones;
        currentState.handicapPositions = this.clonePositions(saved.handicapPositions);
        currentState.startColor = saved.startColor;
        currentState.sgfLoadedFromExternal = (_g = saved.sgfLoadedFromExternal) !== null && _g !== void 0 ? _g : false;
        currentState.capturedCounts = saved.capturedCounts
            ? { ...saved.capturedCounts }
            : { black: 0, white: 0 };
    }
}
//# sourceMappingURL=history-manager.js.map