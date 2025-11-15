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
}
//# sourceMappingURL=board-input-state-machine.js.map