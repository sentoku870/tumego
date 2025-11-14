import { UIElements, Position, StoneColor, DEFAULT_CONFIG } from '../../types.js';
import { GameStore } from '../../state/game-store.js';
import { UIInteractionState } from '../state/ui-interaction-state.js';

export type BoardUpdateCallback = () => void;
export type EraseModeDisabler = () => void;

export class BoardInteractionController {
  constructor(
    private readonly store: GameStore,
    private readonly elements: UIElements,
    private readonly uiState: UIInteractionState,
    private readonly onBoardUpdated: BoardUpdateCallback,
    private readonly disableEraseMode: EraseModeDisabler
  ) {}

  initialize(): void {
    this.initBoardFocusEvents();
    this.initPointerEvents();
  }

  private get state() {
    return this.store.snapshot;
  }

  private initBoardFocusEvents(): void {
    const wrapper = this.elements.boardWrapper;
    wrapper.tabIndex = 0;

    wrapper.addEventListener('pointerenter', () => {
      this.uiState.boardHasFocus = true;
    });

    wrapper.addEventListener('pointerleave', () => {
      this.uiState.boardHasFocus = false;
    });

    wrapper.addEventListener('pointerdown', () => {
      this.uiState.boardHasFocus = true;
      wrapper.focus();
    });

    wrapper.addEventListener('blur', () => {
      this.uiState.boardHasFocus = false;
    });

    wrapper.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        this.uiState.touchStartY = event.touches[0].clientY;
      }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (event) => {
      if (event.touches.length === 1) {
        const touchY = event.touches[0].clientY;
        const deltaY = Math.abs(touchY - this.uiState.touchStartY);
        if (deltaY < 10) {
          event.preventDefault();
        }
      }
    }, { passive: false });
  }

  private initPointerEvents(): void {
    const svg = this.elements.svg;

    svg.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    svg.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    svg.addEventListener('pointerup', (event) => this.handlePointerEnd(event));
    svg.addEventListener('pointercancel', (event) => this.handlePointerEnd(event));
    svg.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private handlePointerDown(event: PointerEvent): void {
    this.uiState.boardHasFocus = true;
    this.elements.boardWrapper.focus();

    if (event.button === 2) {
      event.preventDefault();
    }

    if (this.state.eraseMode) {
      if (event.button === 2) {
        this.disableEraseMode();
        return;
      }
      this.uiState.drag.dragColor = null;
    } else if (this.state.mode === 'alt') {
      if (event.button === 0) {
        this.uiState.drag.dragColor = null;
      } else {
        return;
      }
    } else {
      const leftColor: StoneColor = this.state.mode === 'white' ? 2 : 1;
      const rightColor: StoneColor = this.state.mode === 'white' ? 1 : 2;
      this.uiState.drag.dragColor = event.button === 0
        ? leftColor
        : event.button === 2
          ? rightColor
          : null;
    }

    this.uiState.drag.dragging = true;
    this.uiState.drag.lastPos = null;
    this.elements.svg.setPointerCapture(event.pointerId);
    this.placeAtEvent(event);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.uiState.drag.dragging) {
      if (this.state.eraseMode && event.buttons) {
        this.uiState.drag.dragging = true;
        this.uiState.drag.lastPos = null;
      } else {
        return;
      }
    }

    if (this.state.mode === 'alt' && !this.state.eraseMode) {
      return;
    }

    const pos = this.getPositionFromEvent(event);
    const last = this.uiState.drag.lastPos;
    if (last && last.col === pos.col && last.row === pos.row) {
      return;
    }

    this.uiState.drag.lastPos = pos;
    this.placeAtEvent(event);
  }

  private handlePointerEnd(event: PointerEvent): void {
    if (!this.uiState.drag.dragging) {
      return;
    }

    this.uiState.resetDrag();
    this.elements.svg.releasePointerCapture(event.pointerId);
  }

  private placeAtEvent(event: PointerEvent): void {
    const pos = this.getPositionFromEvent(event);
    if (!this.isValidPosition(pos)) {
      return;
    }

    if (this.state.eraseMode) {
      this.handleErase(pos);
    } else {
      this.handlePlaceStone(pos);
    }
  }

  private handlePlaceStone(pos: Position): void {
    const color = this.uiState.drag.dragColor ?? this.store.currentColor;
    if (this.store.tryMove(pos, color)) {
      this.onBoardUpdated();
    }
  }

  private handleErase(pos: Position): boolean {
    if (this.store.removeStone(pos)) {
      this.onBoardUpdated();
      return true;
    }
    return false;
  }

  private getPositionFromEvent(event: PointerEvent): Position {
    try {
      const point = this.elements.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;

      const ctm = this.elements.svg.getScreenCTM();
      if (!ctm) {
        return { col: -1, row: -1 };
      }

      const svgPoint = point.matrixTransform(ctm.inverse());
      const col = Math.round((svgPoint.x - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
      const row = Math.round((svgPoint.y - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
      return { col, row };
    } catch (error) {
      console.error('座標変換エラー:', error);
      return { col: -1, row: -1 };
    }
  }

  private isValidPosition(pos: Position): boolean {
    return pos.col >= 0 && pos.col < this.state.boardSize &&
      pos.row >= 0 && pos.row < this.state.boardSize;
  }
}
