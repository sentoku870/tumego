import { StoneColor } from '../../types.js';

export type PointerDownDecision =
  | { type: 'ignore' }
  | { type: 'disableEraseMode' }
  | { type: 'startDrag'; dragColor: StoneColor | null };

export type PointerMoveDecision =
  | { type: 'ignore' }
  | { type: 'startDrag'; dragColor: StoneColor | null }
  | { type: 'processDrag' };

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
}
