// ============ BoardPointerHandler ============
// Pointer イベントから mode 別の処理 (place / erase / marker / drag) を
// ディスパッチする。BoardInteractionController から分離。
import { Position } from '../../../types.js';
import { GameStore } from '../../../state/game-store.js';
import { PreferencesStore } from '../../../services/preferences-store.js';
import { UIEventBus } from '../../../app/event-bus.js';
import { UIInteractionState } from '../../state/ui-interaction-state.js';

export interface PointerActionResult {
  /** true の場合、UI 更新イベントを発火する */
  requiresUiUpdate: boolean;
}

/**
 * クリック/ドラッグ位置に対して、状態に応じた操作を実行する。
 * numberMode (解答モード) / markerMode / eraseMode の優先度で分岐する。
 */
export class BoardPointerHandler {
  constructor(
    private readonly store: GameStore,
    private readonly uiState: UIInteractionState,
    private readonly eventBus: UIEventBus,
    private readonly preferences: PreferencesStore
  ) {}

  /**
   * クリック位置に対して現在のモードに応じた操作を実行する。
   * 副作用として EventBus.emitUIUpdate() を呼ぶ。
   */
  handleClick(pos: Position): void {
    const state = this.store.snapshot;

    // マーカーモードが優先。解答モード中であってもユーザーが明示的に
    // マーカーを選択している場合は石配置よりマーカー配置を優先する。
    if (state.markerMode) {
      this.toggleMarker(pos);
      return;
    }

    if (state.numberMode) {
      this.placeStone(pos);
      return;
    }

    if (state.eraseMode) {
      this.erase(pos);
    } else {
      this.placeStone(pos);
    }
  }

  /** 石を配置する (解答/編集両モード) */
  placeStone(pos: Position): void {
    const state = this.store.snapshot;

    // === 解答モード（numberMode = true）==========================
    if (state.numberMode) {
      if (this.store.tryMove(pos)) {
        this.eventBus.emitUIUpdate();
      }
      return;
    }

    // === 編集モード（numberMode = false）==========================
    const rulesMode = this.preferences.state.edit.rulesMode;
    const color = this.uiState.drag.dragColor ?? this.store.currentColor;
    const placed =
      rulesMode === 'standard'
        ? this.store.placeWithRulesInEdit(pos, color)
        : this.store.directPlace(pos, color);
    if (placed) {
      this.eventBus.emitUIUpdate();
    }
  }

  /** 石を削除する (解答: SGF 編集 / 編集: 直接削除) */
  erase(pos: Position): boolean {
    const state = this.store.snapshot;

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

  /** マーカーをトグル配置する */
  toggleMarker(pos: Position): void {
    if (!this.store.snapshot.activeMarkerKind) {
      return;
    }
    const allowMulti = Boolean(this.preferences.state.solve.allowMultiMarker);
    this.store.toggleMarker(pos, allowMulti);
    this.eventBus.emitUIUpdate();
  }
}
