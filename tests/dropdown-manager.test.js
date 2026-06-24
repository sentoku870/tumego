import './helpers/dom-setup.js';
import { DropdownManager } from '../dist/ui/controllers/dropdown-manager.js';
import { UIInteractionState } from '../dist/ui/state/ui-interaction-state.js';

describe('DropdownManager', () => {
  let uiState, manager, trigger, dropdown;

  beforeEach(() => {
    uiState = new UIInteractionState();
    manager = new DropdownManager(uiState);
    trigger = document.createElement('button');
    dropdown = document.createElement('div');
  });

  describe('open()', () => {
    test('adds show class to dropdown', () => {
      manager.open(trigger, dropdown);
      expect(dropdown.classList.contains('show')).toBe(true);
    });

    test('sets activeDropdown in uiState', () => {
      manager.open(trigger, dropdown);
      expect(uiState.activeDropdown).not.toBe(null);
      if (uiState.activeDropdown) {
        expect(uiState.activeDropdown.trigger).toBe(trigger);
        expect(uiState.activeDropdown.dropdown).toBe(dropdown);
      }
    });
  });

  describe('hide()', () => {
    test('removes show class from dropdown', () => {
      manager.open(trigger, dropdown);
      manager.hide(dropdown);
      expect(dropdown.classList.contains('show')).toBe(false);
    });

    test('clears style properties', () => {
      manager.open(trigger, dropdown);
      manager.hide(dropdown);
      expect(dropdown.style.position).toBe('');
    });

    test('clears activeDropdown when hiding the active one', () => {
      manager.open(trigger, dropdown);
      manager.hide(dropdown);
      expect(uiState.activeDropdown).toBe(null);
    });

    test('does not clear activeDropdown when hiding a non-active dropdown', () => {
      manager.open(trigger, dropdown);
      const otherDropdown = document.createElement('div');
      manager.hide(otherDropdown);
      expect(uiState.activeDropdown).not.toBe(null);
    });

    test('handles null dropdown gracefully', () => {
      manager.open(trigger, dropdown);
      manager.hide(null);
      // activeDropdown should still be set
      expect(uiState.activeDropdown).not.toBe(null);
    });

    test('handles undefined dropdown gracefully', () => {
      manager.open(trigger, dropdown);
      manager.hide(undefined);
      expect(uiState.activeDropdown).not.toBe(null);
    });
  });

  describe('repositionActive()', () => {
    test('does nothing when no active dropdown', () => {
      let threw = false;
      try {
        manager.repositionActive();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('clears activeDropdown if show class is removed', () => {
      manager.open(trigger, dropdown);
      dropdown.classList.remove('show');
      manager.repositionActive();
      expect(uiState.activeDropdown).toBe(null);
    });

    test('repositions when active dropdown still has show class', () => {
      manager.open(trigger, dropdown);
      // Should not throw
      let threw = false;
      try {
        manager.repositionActive();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });
});
