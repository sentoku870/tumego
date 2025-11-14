export class KeyboardController {
    constructor(uiState) {
        this.uiState = uiState;
        this.bindings = {};
    }
    initialize(bindings) {
        this.bindings = bindings;
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    }
    handleKeyDown(event) {
        if (!this.uiState.boardHasFocus) {
            return;
        }
        const handler = this.bindings[event.key];
        if (handler) {
            event.preventDefault();
            handler();
        }
    }
}
//# sourceMappingURL=keyboard-controller.js.map