export class UIEventBus {
    constructor() {
        this.uiUpdateListeners = new Set();
        this.answerButtonListeners = new Set();
        this.eraseModeDisablers = new Set();
        this.sgfAppliedListeners = new Set();
    }
    onUIUpdate(listener) {
        this.uiUpdateListeners.add(listener);
        return () => this.uiUpdateListeners.delete(listener);
    }
    emitUIUpdate() {
        this.uiUpdateListeners.forEach((listener) => listener());
    }
    onAnswerButtonUpdate(listener) {
        this.answerButtonListeners.add(listener);
        return () => this.answerButtonListeners.delete(listener);
    }
    emitAnswerButtonUpdate() {
        this.answerButtonListeners.forEach((listener) => listener());
    }
    onEraseModeDisable(listener) {
        this.eraseModeDisablers.add(listener);
        return () => this.eraseModeDisablers.delete(listener);
    }
    emitEraseModeDisable() {
        this.eraseModeDisablers.forEach((listener) => listener());
    }
    onSgfApplied(listener) {
        this.sgfAppliedListeners.add(listener);
        return () => this.sgfAppliedListeners.delete(listener);
    }
    emitSgfApplied(sgfText) {
        this.sgfAppliedListeners.forEach((listener) => listener(sgfText));
    }
}
//# sourceMappingURL=event-bus.js.map