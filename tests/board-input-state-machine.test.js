import { BoardInputStateMachine } from '../dist/ui/controllers/board-input-state-machine.js';

describe('BoardInputStateMachine', () => {
  let machine;

  beforeEach(() => {
    machine = new BoardInputStateMachine();
  });

  describe('Erase mode - pointer down', () => {
    test('onErasePrimaryDown returns startDrag with null color', () => {
      const decision = machine.onErasePrimaryDown();
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(null);
      }
    });

    test('onEraseSecondaryDown returns disableEraseMode', () => {
      const decision = machine.onEraseSecondaryDown();
      expect(decision.type).toBe('disableEraseMode');
    });

    test('onEraseAuxiliaryDown returns ignore', () => {
      const decision = machine.onEraseAuxiliaryDown();
      expect(decision.type).toBe('ignore');
    });
  });

  describe('Alternating mode - pointer down', () => {
    test('onAltPrimaryDown returns startDrag with null color', () => {
      const decision = machine.onAltPrimaryDown();
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(null);
      }
    });

    test('onAltSecondaryDown returns ignore', () => {
      const decision = machine.onAltSecondaryDown();
      expect(decision.type).toBe('ignore');
    });

    test('onAltAuxiliaryDown returns ignore', () => {
      const decision = machine.onAltAuxiliaryDown();
      expect(decision.type).toBe('ignore');
    });
  });

  describe('Play mode - pointer down', () => {
    test('onPlayPrimaryDown with black color returns startDrag with black', () => {
      const decision = machine.onPlayPrimaryDown(1);
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(1);
      }
    });

    test('onPlayPrimaryDown with white color returns startDrag with white', () => {
      const decision = machine.onPlayPrimaryDown(2);
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(2);
      }
    });

    test('onPlayPrimaryDown with null color returns ignore', () => {
      const decision = machine.onPlayPrimaryDown(null);
      expect(decision.type).toBe('ignore');
    });

    test('onPlaySecondaryDown with black color returns startDrag with black', () => {
      const decision = machine.onPlaySecondaryDown(1);
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(1);
      }
    });

    test('onPlaySecondaryDown with white color returns startDrag with white', () => {
      const decision = machine.onPlaySecondaryDown(2);
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(2);
      }
    });

    test('onPlaySecondaryDown with null color returns ignore', () => {
      const decision = machine.onPlaySecondaryDown(null);
      expect(decision.type).toBe('ignore');
    });

    test('onPlayAuxiliaryDown returns ignore', () => {
      const decision = machine.onPlayAuxiliaryDown();
      expect(decision.type).toBe('ignore');
    });
  });

  describe('Pointer move', () => {
    test('startEraseDragFromMove with active pointer returns startDrag with null color', () => {
      const decision = machine.startEraseDragFromMove(true);
      expect(decision.type).toBe('startDrag');
      if (decision.type === 'startDrag') {
        expect(decision.dragColor).toBe(null);
      }
    });

    test('startEraseDragFromMove with inactive pointer returns ignore', () => {
      const decision = machine.startEraseDragFromMove(false);
      expect(decision.type).toBe('ignore');
    });

    test('ignoreMove returns ignore', () => {
      const decision = machine.ignoreMove();
      expect(decision.type).toBe('ignore');
    });

    test('continueDrag returns processDrag', () => {
      const decision = machine.continueDrag();
      expect(decision.type).toBe('processDrag');
    });
  });

  describe('Decision type discrimination', () => {
    test('all decisions are properly typed', () => {
      const decisions = [
        machine.onErasePrimaryDown(),
        machine.onEraseSecondaryDown(),
        machine.onEraseAuxiliaryDown(),
        machine.onAltPrimaryDown(),
        machine.onAltSecondaryDown(),
        machine.onAltAuxiliaryDown(),
        machine.onPlayPrimaryDown(1),
        machine.onPlayPrimaryDown(null),
        machine.onPlaySecondaryDown(2),
        machine.onPlaySecondaryDown(null),
        machine.onPlayAuxiliaryDown(),
        machine.startEraseDragFromMove(true),
        machine.startEraseDragFromMove(false),
        machine.ignoreMove(),
        machine.continueDrag()
      ];

      decisions.forEach((decision) => {
        const validTypes = ['ignore', 'disableEraseMode', 'startDrag', 'processDrag'];
        const isValid = validTypes.includes(decision.type);
        expect(isValid).toBe(true);
      });
    });

    test('startDrag decisions always have a dragColor field (which may be null)', () => {
      const decisions = [
        machine.onErasePrimaryDown(),
        machine.onAltPrimaryDown(),
        machine.onPlayPrimaryDown(1),
        machine.onPlaySecondaryDown(2)
      ];

      decisions.forEach((decision) => {
        if (decision.type === 'startDrag') {
          const hasField = 'dragColor' in decision;
          expect(hasField).toBe(true);
        }
      });
    });
  });
});
