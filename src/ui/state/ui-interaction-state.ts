import { DragState } from '../../types.js';

export class UIInteractionState {
  readonly drag: DragState = {
    dragging: false,
    dragColor: null,
    lastPos: null,
    grabbedStone: null
  };

  boardHasFocus = false;
  touchStartY = 0;
  activeDropdown: { trigger: HTMLElement; dropdown: HTMLElement } | null = null;

  resetDrag(): void {
    this.drag.dragging = false;
    this.drag.dragColor = null;
    this.drag.lastPos = null;
    this.drag.grabbedStone = null;
  }

  /** 掴み状態を明示的に解除する（移動コミット/キャンセル時に使用） */
  releaseGrabbedStone(): void {
    this.drag.grabbedStone = null;
  }
}
