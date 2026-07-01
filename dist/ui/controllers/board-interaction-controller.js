import { DEFAULT_CONFIG } from "../../types.js";
import { isValidPosition } from "../../state/board-utils.js";
import { BoardInputStateMachine, } from "./board-input-state-machine.js";
import { normalizePointerInput, } from "./pointer-input.js";
export class BoardInteractionController {
    constructor(store, elements, uiState, eventBus, preferences) {
        this.store = store;
        this.elements = elements;
        this.uiState = uiState;
        this.eventBus = eventBus;
        this.preferences = preferences;
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
        };
        this.pointerMoveHandlers = {
            erase: ({ stateMachine, input, dragging }) => dragging
                ? stateMachine.continueDrag()
                : stateMachine.startEraseDragFromMove(input.isPointerActive),
            alt: ({ stateMachine }) => stateMachine.ignoreMove(),
            play: ({ stateMachine, dragging }) => dragging ? stateMachine.continueDrag() : stateMachine.ignoreMove(),
        };
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
        this.focusBoard();
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
        const pos = this.getPositionFromEvent(event);
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
        const pos = this.getPositionFromEvent(event);
        if (!this.isValidPosition(pos)) {
            return;
        }
        if (this.state.eraseMode) {
            this.handleErase(pos);
        }
        else {
            this.handlePlaceStone(pos);
        }
    }
    handlePlaceStone(pos) {
        var _a;
        const state = this.state;
        // === 解答モード（numberMode = true） ==========================
        if (state.numberMode) {
            if (this.store.tryMove(pos)) {
                this.eventBus.emitUIUpdate();
            }
            return;
        }
        // === 編集モード（numberMode = false） ==========================
        const rulesMode = this.preferences.state.edit.rulesMode;
        const color = (_a = this.uiState.drag.dragColor) !== null && _a !== void 0 ? _a : this.store.currentColor;
        const placed = rulesMode === "standard"
            ? this.store.placeWithRulesInEdit(pos, color)
            : this.store.directPlace(pos, color);
        if (placed) {
            this.eventBus.emitUIUpdate();
        }
    }
    handleErase(pos) {
        const state = this.state;
        // === 解答モード：SGF編集としての削除 ==========================
        if (state.numberMode) {
            if (this.store.removeStone(pos)) {
                this.eventBus.emitUIUpdate();
                return true;
            }
            return false;
        }
        // === 編集モード：盤面直接消し ==========================
        if (this.store.directRemove(pos)) {
            this.eventBus.emitUIUpdate();
            return true;
        }
        return false;
    }
    getPositionFromEvent(event) {
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
        }
        catch (error) {
            console.error("座標変換エラー:", error);
            return { col: -1, row: -1 };
        }
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
//# sourceMappingURL=board-interaction-controller.js.map