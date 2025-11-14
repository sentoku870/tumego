import { GameState, Position, StoneColor } from '../types.js';
import { GoEngine } from '../go-engine.js';
import { HistoryManager } from '../history-manager.js';

/**
 * Centralizes all state mutations and provides a narrow API for UI layers.
 * This acts as the single point where the mutable {@link GameState} is
 * manipulated, allowing UI controllers to remain declarative.
 */
export class GameStore {
  constructor(
    private readonly state: GameState,
    private readonly engine: GoEngine,
    private readonly history: HistoryManager
  ) {}

  get snapshot(): GameState {
    return this.state;
  }

  getEngine(): GoEngine {
    return this.engine;
  }

  get historyManager(): HistoryManager {
    return this.history;
  }

  tryMove(pos: Position, color: StoneColor, record = true): boolean {
    return this.engine.tryMove(pos, color, record);
  }

  removeStone(pos: Position): boolean {
    return this.engine.removeStoneAt(pos);
  }

  initBoard(size: number): void {
    this.engine.initBoard(size);
  }

  undo(): void {
    this.engine.undo();
  }

  setMoveIndex(index: number): void {
    this.engine.setMoveIndex(index);
  }

  startNumberMode(color: StoneColor): void {
    this.engine.startNumberMode(color);
  }

  setProblemDiagram(): void {
    this.engine.setProblemDiagram();
  }

  restoreProblemDiagram(): void {
    this.engine.restoreProblemDiagram();
  }

  hasProblemDiagram(): boolean {
    return this.engine.hasProblemDiagram();
  }

  setHandicap(stones: number | string): void {
    this.engine.setHandicap(stones);
  }

  get currentColor(): StoneColor {
    return this.engine.getCurrentColor();
  }
}
