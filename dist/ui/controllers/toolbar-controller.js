import { ToolbarButtons } from './toolbar-buttons.js';
import { ToolbarState } from './toolbar/toolbar-state.js';
export class ToolbarController {
    constructor(store, renderer, boardCapture, sgfService, elements, eventBus, preferences, dropdownManager, handicapDialog, headerEditor) {
        this.store = store;
        this.renderer = renderer;
        this.boardCapture = boardCapture;
        this.sgfService = sgfService;
        this.elements = elements;
        this.eventBus = eventBus;
        this.preferences = preferences;
        this.dropdownManager = dropdownManager;
        this.buttons = new ToolbarButtons(store, renderer, boardCapture, sgfService, elements, eventBus, dropdownManager, handicapDialog, headerEditor);
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
    closeMarkerPalette() {
        this.buttons.closeMarkerPalette();
    }
}
//# sourceMappingURL=toolbar-controller.js.map