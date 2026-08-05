export class UIInteractionState {
    constructor() {
        this.drag = {
            dragging: false,
            dragColor: null,
            lastPos: null,
            grabbedStone: null
        };
        this.boardHasFocus = false;
        this.touchStartY = 0;
        this.activeDropdown = null;
    }
    resetDrag() {
        this.drag.dragging = false;
        this.drag.dragColor = null;
        this.drag.lastPos = null;
        this.drag.grabbedStone = null;
    }
    /** 掴み状態を明示的に解除する（移動コミット/キャンセル時に使用） */
    releaseGrabbedStone() {
        this.drag.grabbedStone = null;
    }
}
//# sourceMappingURL=ui-interaction-state.js.map