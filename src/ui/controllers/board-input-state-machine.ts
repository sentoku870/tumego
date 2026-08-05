import { GameState, Position, StoneColor } from '../../types.js';

export type PointerDownDecision =
  | { type: 'ignore' }
  | { type: 'disableEraseMode' }
  | { type: 'disableMarkerMode' }
  | { type: 'toggleMarker' }
  | { type: 'startDrag'; dragColor: StoneColor | null };

export type PointerMoveDecision =
  | { type: 'ignore' }
  | { type: 'startDrag'; dragColor: StoneColor | null }
  | { type: 'processDrag' };

/**
 * 長押し成立時に返される決定。
 * - grabStone: その位置にある石を掴む（編集モードでのみ発生）
 * - ignore: 掴まない（編集モードでない / 石がない / 既に掴んでいる等）
 */
export type LongPressDecision =
  | { type: 'grabStone'; pos: Position; color: StoneColor }
  | { type: 'ignore' };

export class BoardInputStateMachine {
  onErasePrimaryDown(): PointerDownDecision {
    return { type: 'startDrag', dragColor: null };
  }

  onEraseSecondaryDown(): PointerDownDecision {
    return { type: 'disableEraseMode' };
  }

  onEraseAuxiliaryDown(): PointerDownDecision {
    return { type: 'ignore' };
  }

  onAltPrimaryDown(): PointerDownDecision {
    return { type: 'startDrag', dragColor: null };
  }

  onAltSecondaryDown(): PointerDownDecision {
    return { type: 'ignore' };
  }

  onAltAuxiliaryDown(): PointerDownDecision {
    return { type: 'ignore' };
  }

  onPlayPrimaryDown(color: StoneColor | null): PointerDownDecision {
    if (color === null) {
      return { type: 'ignore' };
    }
    return { type: 'startDrag', dragColor: color };
  }

  onPlaySecondaryDown(color: StoneColor | null): PointerDownDecision {
    if (color === null) {
      return { type: 'ignore' };
    }
    return { type: 'startDrag', dragColor: color };
  }

  onPlayAuxiliaryDown(): PointerDownDecision {
    return { type: 'ignore' };
  }

  onMarkerPrimaryDown(): PointerDownDecision {
    return { type: 'toggleMarker' };
  }

  onMarkerSecondaryDown(): PointerDownDecision {
    return { type: 'disableMarkerMode' };
  }

  onMarkerAuxiliaryDown(): PointerDownDecision {
    return { type: 'ignore' };
  }

  startEraseDragFromMove(isPointerActive: boolean): PointerMoveDecision {
    if (!isPointerActive) {
      return { type: 'ignore' };
    }
    return { type: 'startDrag', dragColor: null };
  }

  ignoreMove(): PointerMoveDecision {
    return { type: 'ignore' };
  }

  continueDrag(): PointerMoveDecision {
    return { type: 'processDrag' };
  }

  /**
   * タイマー閾値到達時の長押し判定。
   * 編集モード（numberMode === false）かつ、消去/マーカーモードがオフで、
   * 指定位置に石があるときのみ「grabStone」を返す。
   */
  evaluateLongPress(state: GameState, pos: Position): LongPressDecision {
    if (state.numberMode) return { type: 'ignore' };
    if (state.eraseMode) return { type: 'ignore' };
    if (state.markerMode) return { type: 'ignore' };

    if (pos.col < 0 || pos.row < 0) return { type: 'ignore' };
    if (pos.col >= state.boardSize || pos.row >= state.boardSize) {
      return { type: 'ignore' };
    }

    const cell = state.board[pos.row]?.[pos.col];
    if (cell !== 1 && cell !== 2) return { type: 'ignore' };

    return { type: 'grabStone', pos, color: cell as StoneColor };
  }
}
