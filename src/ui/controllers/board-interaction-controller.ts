import { UIElements, Position, DEFAULT_CONFIG } from '../../types.js';
import { GameStore } from '../../state/game-store.js';
import { UIInteractionState } from '../state/ui-interaction-state.js';
import { BoardInputStateMachine, PointerDownDecision, PointerMoveDecision } from './board-input-state-machine.js';
import { normalizePointerInput, NormalizedPointerInput, PointerButtonKind } from './pointer-input.js';

export type BoardUpdateCallback = () => void;
export type EraseModeDisabler = () => void;

export class BoardInteractionController {
  private readonly inputStateMachine = new BoardInputStateMachine();

  private readonly pointerDownHandlers: Record<string, PointerDownHandler> = {
    'erase:primary:*': ({ stateMachine }) => stateMachine.onErasePrimaryDown(),
    'erase:secondary:*': ({ stateMachine }) => stateMachine.onEraseSecondaryDown(),
    'erase:auxiliary:*': ({ stateMachine }) => stateMachine.onEraseAuxiliaryDown(),
    'alt:primary:*': ({ stateMachine }) => stateMachine.onAltPrimaryDown(),
    'alt:secondary:*': ({ stateMachine }) => stateMachine.onAltSecondaryDown(),
    'alt:auxiliary:*': ({ stateMachine }) => stateMachine.onAltAuxiliaryDown(),
    'play:primary:*': ({ stateMachine, input }) => stateMachine.onPlayPrimaryDown(input.colors.primary),
    'play:secondary:*': ({ stateMachine, input }) => stateMachine.onPlaySecondaryDown(input.colors.secondary),
    'play:auxiliary:*': ({ stateMachine }) => stateMachine.onPlayAuxiliaryDown()
  };

  private readonly pointerMoveHandlers: Record<string, PointerMoveHandler> = {
    erase: ({ stateMachine, input, dragging }) => dragging
      ? stateMachine.continueDrag()
      : stateMachine.startEraseDragFromMove(input.isPointerActive),
    alt: ({ stateMachine }) => stateMachine.ignoreMove(),
    play: ({ stateMachine, dragging }) => dragging
      ? stateMachine.continueDrag()
      : stateMachine.ignoreMove()
  };

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
    this.focusBoard();

    const input = normalizePointerInput(event, this.state);
    this.preventContextMenu(event, input.button);

    const handler = this.resolvePointerDownHandler(input);
    if (!handler) {
      return;
    }

    const decision = handler({ input, stateMachine: this.inputStateMachine });
    this.applyPointerDownDecision(decision, event);
  }

  private handlePointerMove(event: PointerEvent): void {
    const input = normalizePointerInput(event, this.state);
    const handler = this.pointerMoveHandlers[input.mode];

    const decision = handler({
      input,
      stateMachine: this.inputStateMachine,
      dragging: this.uiState.drag.dragging
    });

    if (!this.applyPointerMoveDecision(decision)) {
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

  private focusBoard(): void {
    this.uiState.boardHasFocus = true;
    this.elements.boardWrapper.focus();
  }

  private preventContextMenu(event: PointerEvent, button: PointerButtonKind): void {
    if (button === 'secondary') {
      event.preventDefault();
    }
  }

  private resolvePointerDownHandler(input: NormalizedPointerInput): PointerDownHandler | undefined {
    const specificKey = `${input.mode}:${input.button}:${input.device}`;
    const wildcardKey = `${input.mode}:${input.button}:*`;
    return this.pointerDownHandlers[specificKey] ?? this.pointerDownHandlers[wildcardKey];
  }

  private applyPointerDownDecision(decision: PointerDownDecision, event: PointerEvent): void {
    if (decision.type === 'ignore') {
      return;
    }

    if (decision.type === 'disableEraseMode') {
      this.disableEraseMode();
      return;
    }

    this.uiState.drag.dragging = true;
    this.uiState.drag.dragColor = decision.dragColor;
    this.uiState.drag.lastPos = null;
    this.elements.svg.setPointerCapture(event.pointerId);
    this.placeAtEvent(event);
  }

  private applyPointerMoveDecision(decision: PointerMoveDecision): boolean {
    if (decision.type === 'ignore') {
      return false;
    }

    if (decision.type === 'startDrag') {
      this.uiState.drag.dragging = true;
      this.uiState.drag.dragColor = decision.dragColor;
      this.uiState.drag.lastPos = null;
      return true;
    }

    return true;
  }
}

interface PointerDownContext {
  readonly input: NormalizedPointerInput;
  readonly stateMachine: BoardInputStateMachine;
}

type PointerDownHandler = (context: PointerDownContext) => PointerDownDecision;

interface PointerMoveContext {
  readonly input: NormalizedPointerInput;
  readonly stateMachine: BoardInputStateMachine;
  readonly dragging: boolean;
}

type PointerMoveHandler = (context: PointerMoveContext) => PointerMoveDecision;
