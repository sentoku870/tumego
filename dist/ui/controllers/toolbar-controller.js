import { ToolbarButtons } from './toolbar-buttons.js';
import { ToolbarState } from './toolbar-state.js';
export class ToolbarController {
    constructor(store, renderer, boardCapture, elements, eventBus, preferences) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.elements = elements;
        this.eventBus = eventBus;
        this.preferences = preferences;
        this.buttons = new ToolbarButtons(store, renderer, boardCapture, elements, eventBus);
        this.state = new ToolbarState(store, renderer, preferences, eventBus, this.buttons);
    }
    initialize() {
        this.buttons.bindAll();
        this.state.updateAll();
    }
    dispose() {
        this.buttons.dispose();
    }
    disableEraseMode() {
        this.state.disableEraseMode();
    }
    updateAnswerButtonDisplay() {
        this.state.updateAnswerButtonDisplay();
    }
    triggerButton(selector) {
        this.buttons.triggerButton(selector);
    }
    updateToolbarState() {
        this.state.updateToolbarState();
    }
    updateFullResetVisibility() {
        this.state.updateFullResetVisibility();
    }
}
//# sourceMappingURL=toolbar-controller.js.map