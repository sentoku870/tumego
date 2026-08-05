// ============ Toolbar Controller (Facade) ============
// ボタンバインド (ToolbarButtons) と状態反映 (ToolbarState) を束ねるファサード。
// 公開 API は従来互換を維持し、内部でサブクラスへ委譲する。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { BoardCaptureService } from '../../services/board-capture-service.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements } from '../../types.js';
import { PreferencesStore } from '../../services/preferences-store.js';
import { UIEventBus } from '../../app/event-bus.js';
import { ToolbarButtons } from './toolbar-buttons.js';
import { ToolbarState } from './toolbar/toolbar-state.js';
import { DropdownManager } from './dropdown-manager.js';
import { HandicapDialog } from './feature-menu/handicap-dialog.js';

export class ToolbarController {
  private readonly buttons: ToolbarButtons;
  private readonly state: ToolbarState;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly sgfService: SGFService,
    private readonly elements: UIElements,
    private readonly eventBus: UIEventBus,
    private readonly preferences: PreferencesStore,
    private readonly dropdownManager: DropdownManager,
    handicapDialog: HandicapDialog
  ) {
    this.buttons = new ToolbarButtons(
      store,
      renderer,
      boardCapture,
      sgfService,
      elements,
      eventBus,
      dropdownManager,
      handicapDialog
    );
    this.state = new ToolbarState(
      store,
      renderer,
      preferences,
      eventBus,
      this.buttons
    );
  }

  initialize(): void {
    this.buttons.bindAll();
    this.state.updateAll();
  }

  dispose(): void {
    this.buttons.dispose();
  }

  disableEraseMode(): void {
    this.state.disableEraseMode();
  }

  updateAnswerButtonDisplay(): void {
    this.state.updateAnswerButtonDisplay();
  }

  triggerButton(selector: string): void {
    this.buttons.triggerButton(selector);
  }

  updateToolbarState(): void {
    this.state.updateToolbarState();
  }

  updateFullResetVisibility(): void {
    this.state.updateFullResetVisibility();
  }

  closeMarkerPalette(): void {
    this.buttons.closeMarkerPalette();
  }
}
