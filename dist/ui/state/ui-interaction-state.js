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
    }
    resetDrag() {
        this.drag.dragging = false;
        this.drag.dragColor = null;
        this.drag.lastPos = null;
    }
}
//# sourceMappingURL=ui-interaction-state.js.map