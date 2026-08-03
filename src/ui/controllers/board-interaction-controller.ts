// ============ BoardInteractionController (Facade) ============
// 盤面のポインタイベントとフォーカス管理を統合する。
// 座標変換は BoardPosition、mode 別処理は BoardPointerHandler に委譲。
import { UIElements, DEFAULT_CONFIG, GameState } from "../../types.js";
import { GameStore } from "../../state/game-store.js";
import { isValidPosition } from "../../state/board-utils.js";
import { UIInteractionState } from "../state/ui-interaction-state.js";
import {
  BoardInputStateMachine,
  PointerDownDecision,
  PointerMoveDecision,
} from "./board-input-state-machine.js";
import {
  normalizePointerInput,
  NormalizedPointerInput,
} from "./pointer-input.js";
import { UIEventBus } from "../../app/event-bus.js";
import { PreferencesStore } from "../../services/preferences-store.js";
import { BoardPosition } from "./board/board-position.js";
import { BoardPointerHandler } from "./board/board-pointer-handler.js";

export type BoardUpdateCallback = () => void;
export type EraseModeDisabler = () => void;

export class BoardInteractionController {
  private readonly inputStateMachine = new BoardInputStateMachine();
  private readonly position: BoardPosition;
  private readonly pointerHandler: BoardPointerHandler;

  private readonly pointerDownHandlers: Record<string, PointerDownHandler> = {
    "erase:primary:*": ({ stateMachine }) => stateMachine.onErasePrimaryDown(),
    "erase:secondary:*": ({ stateMachine }) =>
      stateMachine.onEraseSecondaryDown(),
    "erase:auxiliary:*": ({ stateMachine }) =>
      stateMachine.onEraseAuxiliaryDown(),
    "alt:primary:*": ({ stateMachine }) => stateMachine.onAltPrimaryDown(),
    "alt:secondary:*": ({ stateMachine }) => stateMachine.onAltSecondaryDown(),
    "alt:auxiliary:*": ({ stateMachine }) => stateMachine.onAltAuxiliaryDown(),
    "play:primary:*": ({ stateMachine, input }) =>
      stateMachine.onPlayPrimaryDown(input.colors.primary),
    "play:secondary:*": ({ stateMachine, input }) =>
      stateMachine.onPlaySecondaryDown(input.colors.secondary),
    "play:auxiliary:*": ({ stateMachine }) =>
      stateMachine.onPlayAuxiliaryDown(),
    "marker:primary:*": ({ stateMachine }) => stateMachine.onMarkerPrimaryDown(),
    "marker:secondary:*": ({ stateMachine }) =>
      stateMachine.onMarkerSecondaryDown(),
    "marker:auxiliary:*": ({ stateMachine }) =>
      stateMachine.onMarkerAuxiliaryDown(),
  };

  private readonly pointerMoveHandlers: Record<string, PointerMoveHandler> = {
    erase: ({ stateMachine, input, dragging }) =>
      dragging
        ? stateMachine.continueDrag()
        : stateMachine.startEraseDragFromMove(input.isPointerActive),
    alt: ({ stateMachine }) => stateMachine.ignoreMove(),
    play: ({ stateMachine, dragging }) =>
      dragging ? stateMachine.continueDrag() : stateMachine.ignoreMove(),
    marker: ({ stateMachine }) => stateMachine.ignoreMove(),
  };

  constructor(
    private readonly store: GameStore,
    private readonly elements: UIElements,
    private readonly uiState: UIInteractionState,
    private readonly eventBus: UIEventBus,
    private readonly preferences: PreferencesStore,
    private readonly onBoardInteraction?: () => void
  ) {
    this.position = new BoardPosition(elements.svg);
    this.pointerHandler = new BoardPointerHandler(
      store,
      uiState,
      eventBus,
      preferences
    );
  }

  initialize(): void {
    this.initBoardFocusEvents();
    this.initPointerEvents();
  }

  private get state(): Readonly<GameState> {
    return this.store.snapshot;
  }

  private initBoardFocusEvents(): void {
    const wrapper = this.elements.boardWrapper;
    wrapper.tabIndex = 0;

    wrapper.addEventListener("pointerenter", () => {
      this.uiState.boardHasFocus = true;
    });

    wrapper.addEventListener("pointerleave", () => {
      this.uiState.boardHasFocus = false;
    });

    wrapper.addEventListener("pointerdown", () => {
      this.uiState.boardHasFocus = true;
      wrapper.focus();
    });

    wrapper.addEventListener("blur", () => {
      this.uiState.boardHasFocus = false;
    });

    wrapper.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 1) {
          this.uiState.touchStartY = event.touches[0].clientY;
        }
      },
      { passive: true }
    );

    wrapper.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length === 1) {
          const touchY = event.touches[0].clientY;
          const deltaY = Math.abs(touchY - this.uiState.touchStartY);
          if (deltaY < 10) {
            event.preventDefault();
          }
        }
      },
      { passive: false }
    );
  }

  private initPointerEvents(): void {
    const svg = this.elements.svg;

    svg.addEventListener("pointerdown", (event) =>
      this.handlePointerDown(event)
    );
    svg.addEventListener("pointermove", (event) =>
      this.handlePointerMove(event)
    );
    svg.addEventListener("pointerup", (event) => this.handlePointerEnd(event));
    svg.addEventListener("pointercancel", (event) =>
      this.handlePointerEnd(event)
    );
    svg.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  private handlePointerDown(event: PointerEvent): void {
    this.focusBoard();

    // 盤面クリック時はマーカーパレットを閉じる（マーカー選択状態は維持）
    this.onBoardInteraction?.();

    const input = normalizePointerInput(event, this.state);

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
      dragging: this.uiState.drag.dragging,
    });

    if (!this.applyPointerMoveDecision(decision)) {
      return;
    }

    const pos = this.position.fromEvent(event);
    const last = this.uiState.drag.lastPos;
    if (last && last.col === pos.col && last.row === pos.row) {
      return;
    }

    this.uiState.drag.lastPos = pos;
    this.placeAtEvent(event);
  }

  private handlePointerEnd(event: PointerEvent): void {
    // pointercancel の場合も dragging フラグに関わらず capture を解放する
    if (this.elements.svg.hasPointerCapture(event.pointerId)) {
      this.elements.svg.releasePointerCapture(event.pointerId);
    }

    if (!this.uiState.drag.dragging) {
      return;
    }

    this.uiState.resetDrag();
  }

  private placeAtEvent(event: PointerEvent): void {
    const pos = this.position.fromEvent(event);
    if (!this.isValidPosition(pos)) {
      return;
    }
    this.pointerHandler.handleClick(pos);
  }

  private isValidPosition(pos: import("../../types.js").Position): boolean {
    return isValidPosition(this.state.boardSize, pos);
  }

  private focusBoard(): void {
    this.uiState.boardHasFocus = true;
    this.elements.boardWrapper.focus();
  }

  private resolvePointerDownHandler(
    input: NormalizedPointerInput
  ): PointerDownHandler | undefined {
    const specificKey = `${input.mode}:${input.button}:${input.device}`;
    const wildcardKey = `${input.mode}:${input.button}:*`;
    return (
      this.pointerDownHandlers[specificKey] ??
      this.pointerDownHandlers[wildcardKey]
    );
  }

  private applyPointerDownDecision(
    decision: PointerDownDecision,
    event: PointerEvent
  ): void {
    if (decision.type === "ignore") {
      return;
    }

    if (decision.type === "disableEraseMode") {
      this.eventBus.emitEraseModeDisable();
      return;
    }

    if (decision.type === "disableMarkerMode") {
      this.store.setMarkerMode(null);
      this.eventBus.emitUIUpdate();
      return;
    }

    if (decision.type === "toggleMarker") {
      this.placeAtEvent(event);
      return;
    }

    this.uiState.drag.dragging = true;
    this.uiState.drag.dragColor = decision.dragColor;
    this.uiState.drag.lastPos = null;
    this.elements.svg.setPointerCapture(event.pointerId);
    this.placeAtEvent(event);
  }

  private applyPointerMoveDecision(decision: PointerMoveDecision): boolean {
    if (decision.type === "ignore") {
      return false;
    }

    if (decision.type === "startDrag") {
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

// DEFAULT_CONFIG import は参照を保持するため
void DEFAULT_CONFIG;
