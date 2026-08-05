export class BoardInputStateMachine {
    onErasePrimaryDown() {
        return { type: 'startDrag', dragColor: null };
    }
    onEraseSecondaryDown() {
        return { type: 'disableEraseMode' };
    }
    onEraseAuxiliaryDown() {
        return { type: 'ignore' };
    }
    onAltPrimaryDown() {
        return { type: 'startDrag', dragColor: null };
    }
    onAltSecondaryDown() {
        return { type: 'ignore' };
    }
    onAltAuxiliaryDown() {
        return { type: 'ignore' };
    }
    onPlayPrimaryDown(color) {
        if (color === null) {
            return { type: 'ignore' };
        }
        return { type: 'startDrag', dragColor: color };
    }
    onPlaySecondaryDown(color) {
        if (color === null) {
            return { type: 'ignore' };
        }
        return { type: 'startDrag', dragColor: color };
    }
    onPlayAuxiliaryDown() {
        return { type: 'ignore' };
    }
    onMarkerPrimaryDown() {
        return { type: 'toggleMarker' };
    }
    onMarkerSecondaryDown() {
        return { type: 'disableMarkerMode' };
    }
    onMarkerAuxiliaryDown() {
        return { type: 'ignore' };
    }
    startEraseDragFromMove(isPointerActive) {
        if (!isPointerActive) {
            return { type: 'ignore' };
        }
        return { type: 'startDrag', dragColor: null };
    }
    ignoreMove() {
        return { type: 'ignore' };
    }
    continueDrag() {
        return { type: 'processDrag' };
    }
    /**
     * タイマー閾値到達時の長押し判定。
     * 編集モード（numberMode === false）かつ、消去/マーカーモードがオフで、
     * 指定位置に石があるときのみ「grabStone」を返す。
     */
    evaluateLongPress(state, pos) {
        var _a;
        if (state.numberMode)
            return { type: 'ignore' };
        if (state.eraseMode)
            return { type: 'ignore' };
        if (state.markerMode)
            return { type: 'ignore' };
        if (pos.col < 0 || pos.row < 0)
            return { type: 'ignore' };
        if (pos.col >= state.boardSize || pos.row >= state.boardSize) {
            return { type: 'ignore' };
        }
        const cell = (_a = state.board[pos.row]) === null || _a === void 0 ? void 0 : _a[pos.col];
        if (cell !== 1 && cell !== 2)
            return { type: 'ignore' };
        return { type: 'grabStone', pos, color: cell };
    }
}
//# sourceMappingURL=board-input-state-machine.js.map