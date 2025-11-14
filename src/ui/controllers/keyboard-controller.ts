import { KeyBindings } from '../../types.js';
import { UIInteractionState } from '../state/ui-interaction-state.js';

export class KeyboardController {
  private bindings: KeyBindings = {};

  constructor(private readonly uiState: UIInteractionState) {}

  initialize(bindings: KeyBindings): void {
    this.bindings = bindings;
    document.addEventListener('keydown', (event) => this.handleKeyDown(event));
  }

  private handleKeyDown(event: KeyboardEvent): void {
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
