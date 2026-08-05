// ============ BoardInteractionController (Facade) ============
// 盤面のポインタイベントとフォーカス管理を統合する。
// 座標変換は BoardPosition、mode 別処理は BoardPointerHandler に委譲。
// 長押し検出は LongPressDetector に委譲。
import { UIElements, DEFAULT_CONFIG, GameState, Position } from "../../types.js";
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
import { LongPressDetector } from "./long-press-detector.js";

export type BoardUpdateCallback = () => void;
export type EraseModeDisabler = () => void;

export class BoardInteractionController {
  private readonly inputStateMachine = new BoardInputStateMachine();
  private readonly position: BoardPosition;
  private readonly pointerHandler: BoardPointerHandler;
  private readonly longPressDetector = new LongPressDetector();

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
    this.initKeyboardEvents();
  }

  /** テスト用: 内部の LongPressDetector を取得する */
  getLongPressDetector(): LongPressDetector {
    return this.longPressDetector;
  }

  /** 現在のポインタ座標から盤上交点 (col, row) を取得する（テストでも利用） */
  getPositionFromEvent(event: PointerEvent): Position {
    return this.position.fromEvent(event);
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

  private initKeyboardEvents(): void {
    const handler = (event: KeyboardEvent) => {
      // 盤面がフォーカスを持つときのみ反応（他要素への干渉防止）
      if (!this.uiState.boardHasFocus) return;
      if (event.key !== "Escape") return;
      if (!this.uiState.drag.grabbedStone) return;
      // 掴み状態のキャンセル（元位置への復帰は不要：未コミットのため）
      this.longPressDetector.cancel();
      this.uiState.releaseGrabbedStone();
      this.eventBus.emitUIUpdate();
    };
    document.addEventListener("keydown", handler);
  }

  private handlePointerDown(event: PointerEvent): void {
    this.focusBoard();

    // 盤面クリック時はマーカーパレットを閉じる（マーカー選択状態は維持）
    this.onBoardInteraction?.();

    const input = normalizePointerInput(event, this.state);

    const handler = this.resolvePointerDownHandler(input);
    if (!handler) {
      // ハンドラ未解決でも長押しは試みる（クリック位置で石をつかめる可能性）
      this.startLongPressIfApplicable(event);
      return;
    }

    const decision = handler({ input, stateMachine: this.inputStateMachine });
    this.applyPointerDownDecision(decision, event);

    // 通常ドラッグ（タップ・ドラッグ配置）でも、長押し判定は並行して走らせる。
    // 閾値到達時に既存ドラッグ動作を中断して石を掴むモードへ遷移する。
    this.startLongPressIfApplicable(event);
  }

  private handlePointerMove(event: PointerEvent): void {
    // 掴み中のドラッグ処理：実際のコミットは pointerup まで遅延。
    // 描画は render パスで uiState.drag.grabbedStone を参照するため、
    // pointermove 中の再描画は不要（掴んでいる石の位置は不変）。
    if (this.uiState.drag.grabbedStone) {
      return;
    }

    // 長押しタイマー中の距離監視：現在のポインタ位置と押下位置の距離が
    // しきい値を超えたら長押し判定をキャンセル（ドラッグ配置動作を優先）
    if (this.longPressDetector.isActive()) {
      if (!this.longPressDetector.isWithinThreshold(event)) {
        this.longPressDetector.cancel();
      }
    }

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

    const pos = this.getPositionFromEvent(event);
    const last = this.uiState.drag.lastPos;
    if (last && last.col === pos.col && last.row === pos.row) {
      return;
    }

    this.uiState.drag.lastPos = pos;
    this.placeAtEvent(event);
  }

  private handlePointerEnd(event: PointerEvent): void {
    // タイマーが残っている場合は必ずキャンセル（メモリリーク防止）
    this.longPressDetector.cancel();

    // pointercancel の場合も dragging フラグに関わらず capture を解放する
    if (this.elements.svg.hasPointerCapture(event.pointerId)) {
      this.elements.svg.releasePointerCapture(event.pointerId);
    }

    // 掴み中の場合はドロップ位置でコミット
    if (this.uiState.drag.grabbedStone) {
      const dropPos = this.getPositionFromEvent(event);
      const grabbed = this.uiState.drag.grabbedStone;
      if (
        isValidPosition(this.state.boardSize, dropPos) &&
        (dropPos.col !== grabbed.pos.col || dropPos.row !== grabbed.pos.row)
      ) {
        const moved = this.store.moveStone(grabbed.pos, dropPos);
        if (moved) {
          this.eventBus.emitUIUpdate();
        }
      }
      this.uiState.releaseGrabbedStone();
      // ドラッグ状態自体は触らない（drag.dragging はそのまま、次の通常配置を継続可能）
      // ただし lastPos は維持（最後に置いた位置を記憶）
      return;
    }

    if (!this.uiState.drag.dragging) {
      return;
    }

    this.uiState.resetDrag();
  }

  private placeAtEvent(event: PointerEvent): void {
    const pos = this.position.fromEvent(event);
    if (!isValidPosition(this.state.boardSize, pos)) {
      return;
    }
    this.pointerHandler.handleClick(pos);
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

  /**
   * 押下時に長押しタイマーを起動する。
   * 編集モード + 石がある交点でのみ意味がある。
   * 閾値到達時は evaluateLongPress() を呼んで grabStone 判定する。
   */
  private startLongPressIfApplicable(event: PointerEvent): void {
    // 既に掴んでいる状態なら新たにタイマーを起動しない
    if (this.uiState.drag.grabbedStone) return;

    // 編集モード以外 / 消去/マーカーモード / 解答モードでは長押し判定しない
    const state = this.state;
    if (state.numberMode) return;
    if (state.eraseMode) return;
    if (state.markerMode) return;

    // 押下座標が盤外なら判定しない
    const pos = this.getPositionFromEvent(event);
    if (!isValidPosition(this.state.boardSize, pos)) return;

    // 押下位置に石がなければ掴めない
    const cell = state.board[pos.row]?.[pos.col];
    if (cell !== 1 && cell !== 2) return;

    this.longPressDetector.start(event, () => {
      this.onLongPressTrigger(pos);
    });
  }

  /** タイマー閾値到達時の処理: 状態機械の判定で石を掴む */
  private onLongPressTrigger(pos: Position): void {
    if (!this.uiState.drag.dragging) {
      // ドラッグモードに入っていない場合（例: セカンダリボタンのみ押下）はスキップ
      return;
    }
    const decision = this.inputStateMachine.evaluateLongPress(this.state, pos);
    if (decision.type === "grabStone") {
      // 既に掴んでいる石があれば何もしない（2重発火防止）
      if (this.uiState.drag.grabbedStone) return;

      this.uiState.drag.grabbedStone = { pos: decision.pos, color: decision.color };
      this.eventBus.emitUIUpdate();
    }
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
