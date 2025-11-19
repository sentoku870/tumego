export class UIInteractionState {
    constructor() {
        this.drag = {
            dragging: false,
            dragColor: null,
            lastPos: null
        };
        this.boardHasFocus = false;
        this.touchStartY = 0;
        this.activeDropdown = null;
        this.reviewTurn = 'B'; // PR68 review mode stone color
    }
    resetDrag() {
        this.drag.dragging = false;
        this.drag.dragColor = null;
        this.drag.lastPos = null;
    }
}
//# sourceMappingURL=ui-interaction-state.js.map