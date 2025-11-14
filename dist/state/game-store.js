/**
 * Centralizes all state mutations and provides a narrow API for UI layers.
 * This acts as the single point where the mutable {@link GameState} is
 * manipulated, allowing UI controllers to remain declarative.
 */
export class GameStore {
    constructor(state, engine, history) {
        this.state = state;
        this.engine = engine;
        this.history = history;
    }
    get snapshot() {
        return this.state;
    }
    getEngine() {
        return this.engine;
    }
    get historyManager() {
        return this.history;
    }
    tryMove(pos, color, record = true) {
        return this.engine.tryMove(pos, color, record);
    }
    removeStone(pos) {
        return this.engine.removeStoneAt(pos);
    }
    initBoard(size) {
        this.engine.initBoard(size);
    }
    undo() {
        this.engine.undo();
    }
    setMoveIndex(index) {
        this.engine.setMoveIndex(index);
    }
    startNumberMode(color) {
        this.engine.startNumberMode(color);
    }
    setProblemDiagram() {
        this.engine.setProblemDiagram();
    }
    restoreProblemDiagram() {
        this.engine.restoreProblemDiagram();
    }
    hasProblemDiagram() {
        return this.engine.hasProblemDiagram();
    }
    setHandicap(stones) {
        this.engine.setHandicap(stones);
    }
    get currentColor() {
        return this.engine.getCurrentColor();
    }
}
//# sourceMappingURL=game-store.js.map