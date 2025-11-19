import { DragState } from '../../types.js';

export class UIInteractionState {
  readonly drag: DragState = {
    dragging: false,
    dragColor: null,
    lastPos: null
  };

  boardHasFocus = false;
  touchStartY = 0;
  activeDropdown: { trigger: HTMLElement; dropdown: HTMLElement } | null = null;
  reviewTurn: 'B' | 'W' = 'B'; // PR68 review mode stone color

  resetDrag(): void {
    this.drag.dragging = false;
    this.drag.dragColor = null;
    this.drag.lastPos = null;
  }
}
