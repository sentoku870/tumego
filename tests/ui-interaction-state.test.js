import { UIInteractionState } from '../dist/ui/state/ui-interaction-state.js';

describe('UIInteractionState', () => {
  let uiState;

  beforeEach(() => {
    uiState = new UIInteractionState();
  });

  describe('initial state', () => {
    test('drag.dragging is false', () => {
      expect(uiState.drag.dragging).toBe(false);
    });

    test('drag.dragColor is null', () => {
      expect(uiState.drag.dragColor).toBe(null);
    });

    test('drag.lastPos is null', () => {
      expect(uiState.drag.lastPos).toBe(null);
    });

    test('boardHasFocus is false', () => {
      expect(uiState.boardHasFocus).toBe(false);
    });

    test('touchStartY is 0', () => {
      expect(uiState.touchStartY).toBe(0);
    });

    test('activeDropdown is null', () => {
      expect(uiState.activeDropdown).toBe(null);
    });
  });

  describe('resetDrag()', () => {
    test('resets drag.dragging to false', () => {
      uiState.drag.dragging = true;
      uiState.resetDrag();
      expect(uiState.drag.dragging).toBe(false);
    });

    test('resets drag.dragColor to null', () => {
      uiState.drag.dragColor = 1;
      uiState.resetDrag();
      expect(uiState.drag.dragColor).toBe(null);
    });

    test('resets drag.lastPos to null', () => {
      uiState.drag.lastPos = { col: 3, row: 4 };
      uiState.resetDrag();
      expect(uiState.drag.lastPos).toBe(null);
    });

    test('resets all drag fields together', () => {
      uiState.drag.dragging = true;
      uiState.drag.dragColor = 2;
      uiState.drag.lastPos = { col: 0, row: 0 };
      uiState.resetDrag();
      expect(uiState.drag.dragging).toBe(false);
      expect(uiState.drag.dragColor).toBe(null);
      expect(uiState.drag.lastPos).toBe(null);
    });
  });

  describe('state mutation', () => {
    test('can set boardHasFocus', () => {
      uiState.boardHasFocus = true;
      expect(uiState.boardHasFocus).toBe(true);
    });

    test('can set touchStartY', () => {
      uiState.touchStartY = 100;
      expect(uiState.touchStartY).toBe(100);
    });

    test('can set activeDropdown', () => {
      const trigger = { id: 'trigger' };
      const dropdown = { id: 'dropdown' };
      uiState.activeDropdown = { trigger, dropdown };
      expect(uiState.activeDropdown).not.toBe(null);
      if (uiState.activeDropdown) {
        expect(uiState.activeDropdown.trigger).toBe(trigger);
        expect(uiState.activeDropdown.dropdown).toBe(dropdown);
      }
    });

    test('can clear activeDropdown by setting to null', () => {
      const trigger = { id: 'trigger' };
      const dropdown = { id: 'dropdown' };
      uiState.activeDropdown = { trigger, dropdown };
      uiState.activeDropdown = null;
      expect(uiState.activeDropdown).toBe(null);
    });
  });

  describe('multiple instances', () => {
    test('different instances have independent state', () => {
      const a = new UIInteractionState();
      const b = new UIInteractionState();
      a.drag.dragging = true;
      expect(b.drag.dragging).toBe(false);
    });
  });
});
