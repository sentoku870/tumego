// ============ BoardInteractionController (Facade) ============
// 盤面のポインタイベントとフォーカス管理を統合する。
// 座標変換は BoardPosition、mode 別処理は BoardPointerHandler に委譲。
import { DEFAULT_CONFIG } from "../../types.js";
import { isValidPosition } from "../../state/board-utils.js";
import { BoardInputStateMachine, } from "./board-input-state-machine.js";
import { normalizePointerInput, } from "./pointer-input.js";
import { BoardPosition } from "./board/board-position.js";
import { BoardPointerHandler } from "./board/board-pointer-handler.js";
export class BoardInteractionController {
    constructor(store, elements, uiState, eventBus, preferences, onBoardInteraction) {
        this.store = store;
        this.elements = elements;
        this.uiState = uiState;
        this.eventBus = eventBus;
        this.preferences = preferences;
        this.onBoardInteraction = onBoardInteraction;
        this.inputStateMachine = new BoardInputStateMachine();
        this.pointerDownHandlers = {
            "erase:primary:*": ({ stateMachine }) => stateMachine.onErasePrimaryDown(),
            "erase:secondary:*": ({ stateMachine }) => stateMachine.onEraseSecondaryDown(),
            "erase:auxiliary:*": ({ stateMachine }) => stateMachine.onEraseAuxiliaryDown(),
            "alt:primary:*": ({ stateMachine }) => stateMachine.onAltPrimaryDown(),
            "alt:secondary:*": ({ stateMachine }) => stateMachine.onAltSecondaryDown(),
            "alt:auxiliary:*": ({ stateMachine }) => stateMachine.onAltAuxiliaryDown(),
            "play:primary:*": ({ stateMachine, input }) => stateMachine.onPlayPrimaryDown(input.colors.primary),
            "play:secondary:*": ({ stateMachine, input }) => stateMachine.onPlaySecondaryDown(input.colors.secondary),
            "play:auxiliary:*": ({ stateMachine }) => stateMachine.onPlayAuxiliaryDown(),
            "marker:primary:*": ({ stateMachine }) => stateMachine.onMarkerPrimaryDown(),
            "marker:secondary:*": ({ stateMachine }) => stateMachine.onMarkerSecondaryDown(),
            "marker:auxiliary:*": ({ stateMachine }) => stateMachine.onMarkerAuxiliaryDown(),
        };
        this.pointerMoveHandlers = {
            erase: ({ stateMachine, input, dragging }) => dragging
                ? stateMachine.continueDrag()
                : stateMachine.startEraseDragFromMove(input.isPointerActive),
            alt: ({ stateMachine }) => stateMachine.ignoreMove(),
            play: ({ stateMachine, dragging }) => dragging ? stateMachine.continueDrag() : stateMachine.ignoreMove(),
            marker: ({ stateMachine }) => stateMachine.ignoreMove(),
        };
        this.position = new BoardPosition(elements.svg);
        this.pointerHandler = new BoardPointerHandler(store, uiState, eventBus, preferences);
    }
    initialize() {
        this.initBoardFocusEvents();
        this.initPointerEvents();
    }
    get state() {
        return this.store.snapshot;
    }
    initBoardFocusEvents() {
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
        wrapper.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.uiState.touchStartY = event.touches[0].clientY;
            }
        }, { passive: true });
        wrapper.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                const touchY = event.touches[0].clientY;
                const deltaY = Math.abs(touchY - this.uiState.touchStartY);
                if (deltaY < 10) {
                    event.preventDefault();
                }
            }
        }, { passive: false });
    }
    initPointerEvents() {
        const svg = this.elements.svg;
        svg.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
        svg.addEventListener("pointermove", (event) => this.handlePointerMove(event));
        svg.addEventListener("pointerup", (event) => this.handlePointerEnd(event));
        svg.addEventListener("pointercancel", (event) => this.handlePointerEnd(event));
        svg.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });
    }
    handlePointerDown(event) {
        var _a;
        this.focusBoard();
        // 盤面クリック時はマーカーパレットを閉じる（マーカー選択状態は維持）
        (_a = this.onBoardInteraction) === null || _a === void 0 ? void 0 : _a.call(this);
        const input = normalizePointerInput(event, this.state);
        const handler = this.resolvePointerDownHandler(input);
        if (!handler) {
            return;
        }
        const decision = handler({ input, stateMachine: this.inputStateMachine });
        this.applyPointerDownDecision(decision, event);
    }
    handlePointerMove(event) {
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
    handlePointerEnd(event) {
        // pointercancel の場合も dragging フラグに関わらず capture を解放する
        if (this.elements.svg.hasPointerCapture(event.pointerId)) {
            this.elements.svg.releasePointerCapture(event.pointerId);
        }
        if (!this.uiState.drag.dragging) {
            return;
        }
        this.uiState.resetDrag();
    }
    placeAtEvent(event) {
        const pos = this.position.fromEvent(event);
        if (!this.isValidPosition(pos)) {
            return;
        }
        this.pointerHandler.handleClick(pos);
    }
    isValidPosition(pos) {
        return isValidPosition(this.state.boardSize, pos);
    }
    focusBoard() {
        this.uiState.boardHasFocus = true;
        this.elements.boardWrapper.focus();
    }
    resolvePointerDownHandler(input) {
        var _a;
        const specificKey = `${input.mode}:${input.button}:${input.device}`;
        const wildcardKey = `${input.mode}:${input.button}:*`;
        return ((_a = this.pointerDownHandlers[specificKey]) !== null && _a !== void 0 ? _a : this.pointerDownHandlers[wildcardKey]);
    }
    applyPointerDownDecision(decision, event) {
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
    applyPointerMoveDecision(decision) {
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
// DEFAULT_CONFIG import は参照を保持するため
void DEFAULT_CONFIG;
//# sourceMappingURL=board-interaction-controller.js.map