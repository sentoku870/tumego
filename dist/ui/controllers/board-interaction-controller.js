import { DEFAULT_CONFIG } from '../../types.js';
import { BoardInputStateMachine } from './board-input-state-machine.js';
import { normalizePointerInput } from './pointer-input.js';
export class BoardInteractionController {
    constructor(store, elements, uiState, onBoardUpdated, disableEraseMode) {
        this.store = store;
        this.elements = elements;
        this.uiState = uiState;
        this.onBoardUpdated = onBoardUpdated;
        this.disableEraseMode = disableEraseMode;
        this.inputStateMachine = new BoardInputStateMachine();
        this.pointerDownHandlers = {
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
        this.pointerMoveHandlers = {
            erase: ({ stateMachine, input, dragging }) => dragging
                ? stateMachine.continueDrag()
                : stateMachine.startEraseDragFromMove(input.isPointerActive),
            alt: ({ stateMachine }) => stateMachine.ignoreMove(),
            play: ({ stateMachine, dragging }) => dragging
                ? stateMachine.continueDrag()
                : stateMachine.ignoreMove()
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
    initPointerEvents() {
        const svg = this.elements.svg;
        svg.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        svg.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        svg.addEventListener('pointerup', (event) => this.handlePointerEnd(event));
        svg.addEventListener('pointercancel', (event) => this.handlePointerEnd(event));
        svg.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    handlePointerDown(event) {
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
    handlePointerMove(event) {
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
    handlePointerEnd(event) {
        if (!this.uiState.drag.dragging) {
            return;
        }
        this.uiState.resetDrag();
        this.elements.svg.releasePointerCapture(event.pointerId);
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
        const color = (_a = this.uiState.drag.dragColor) !== null && _a !== void 0 ? _a : this.store.currentColor;
        // === SGF を外部から読み込んでいる間は、すべて「検討手」として扱う ===
        if (this.state.appMode === 'review') {
            this.store.tryMove(pos, color, false);
            this.onBoardUpdated();
            return;
        }
        // 通常モード時のみ、本譜として着手を記録
        if (this.store.tryMove(pos, color)) {
            this.onBoardUpdated();
        }
    }
    handleErase(pos) {
        const removed = this.store.removeStone(pos);
        // ★ 成功/失敗に関係なく UI は必ず更新する
        this.onBoardUpdated();
        return removed;
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
            console.error('座標変換エラー:', error);
            return { col: -1, row: -1 };
        }
    }
    isValidPosition(pos) {
        return pos.col >= 0 && pos.col < this.state.boardSize &&
            pos.row >= 0 && pos.row < this.state.boardSize;
    }
    focusBoard() {
        this.uiState.boardHasFocus = true;
        this.elements.boardWrapper.focus();
    }
    preventContextMenu(event, button) {
        if (button === 'secondary') {
            event.preventDefault();
        }
    }
    resolvePointerDownHandler(input) {
        var _a;
        const specificKey = `${input.mode}:${input.button}:${input.device}`;
        const wildcardKey = `${input.mode}:${input.button}:*`;
        return (_a = this.pointerDownHandlers[specificKey]) !== null && _a !== void 0 ? _a : this.pointerDownHandlers[wildcardKey];
    }
    applyPointerDownDecision(decision, event) {
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
    applyPointerMoveDecision(decision) {
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
//# sourceMappingURL=board-interaction-controller.js.map