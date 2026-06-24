import { SettingsController } from '../dist/ui/controllers/settings-controller.js';
import { PreferencesStore } from '../dist/services/preferences-store.js';

const setupSettingsDOM = () => {
  // Create settings panel
  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.hidden = true;
  document.body.appendChild(panel);

  // Toggle button
  const toggle = document.createElement('button');
  toggle.id = 'settings-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  document.body.appendChild(toggle);

  // Tab buttons
  const tabBasic = document.createElement('button');
  tabBasic.className = 'settings-tab';
  tabBasic.dataset.tab = 'basic';
  const tabAdvanced = document.createElement('button');
  tabAdvanced.className = 'settings-tab';
  tabAdvanced.dataset.tab = 'advanced';
  panel.appendChild(tabBasic);
  panel.appendChild(tabAdvanced);

  // Tab contents
  const tabBasicContent = document.createElement('div');
  tabBasicContent.id = 'settings-tab-basic';
  const tabAdvancedContent = document.createElement('div');
  tabAdvancedContent.id = 'settings-tab-advanced';
  panel.appendChild(tabBasicContent);
  panel.appendChild(tabAdvancedContent);

  // Form elements
  const rulesSelect = document.createElement('select');
  rulesSelect.id = 'setting-edit-rules-mode';
  ['standard', 'free'].forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    rulesSelect.appendChild(opt);
  });
  panel.appendChild(rulesSelect);

  const deviceProfileSelect = document.createElement('select');
  deviceProfileSelect.id = 'settings-device-profile';
  ['auto', 'desktop', 'phone', 'tablet'].forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    deviceProfileSelect.appendChild(opt);
  });
  panel.appendChild(deviceProfileSelect);

  const showCaptured = document.createElement('input');
  showCaptured.type = 'checkbox';
  showCaptured.id = 'setting-show-captured';
  panel.appendChild(showCaptured);

  const enableReset = document.createElement('input');
  enableReset.type = 'checkbox';
  enableReset.id = 'setting-enable-reset';
  panel.appendChild(enableReset);

  const highlightLast = document.createElement('input');
  highlightLast.type = 'checkbox';
  highlightLast.id = 'setting-highlight-last-move';
  panel.appendChild(highlightLast);

  const showSolutionMoveNumbers = document.createElement('input');
  showSolutionMoveNumbers.type = 'checkbox';
  showSolutionMoveNumbers.id = 'setting-show-solution-move-numbers';
  panel.appendChild(showSolutionMoveNumbers);

  const resetBtn = document.createElement('button');
  resetBtn.id = 'setting-reset-button';
  panel.appendChild(resetBtn);

  return {
    panel, toggle, tabBasic, tabAdvanced,
    tabBasicContent, tabAdvancedContent,
    rulesSelect, deviceProfileSelect,
    showCaptured, enableReset, highlightLast, showSolutionMoveNumbers,
    resetBtn
  };
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
};

describe('SettingsController', () => {
  let prefs, controller, elements;

  beforeEach(() => {
    cleanupDOM();
    elements = setupSettingsDOM();
    prefs = new PreferencesStore(null);
    controller = new SettingsController(prefs);
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('initialize()', () => {
    test('does not throw when DOM is set up', () => {
      let threw = false;
      try {
        controller.initialize();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test('selects the basic tab by default', () => {
      controller.initialize();
      expect(elements.tabBasic.classList.contains('active')).toBe(true);
      expect(elements.tabAdvanced.classList.contains('active')).toBe(false);
    });

    test('hides advanced tab content by default', () => {
      controller.initialize();
      expect(elements.tabBasicContent.hidden).toBe(false);
      expect(elements.tabAdvancedContent.hidden).toBe(true);
    });

    test('syncs UI with current preferences', () => {
      controller.initialize();
      expect(elements.showCaptured.checked).toBe(true);
      expect(elements.enableReset.checked).toBe(true);
    });
  });

  describe('toggle button', () => {
    test('clicking toggle shows hidden panel', () => {
      controller.initialize();
      expect(elements.panel.hidden).toBe(true);
      elements.toggle.click();
      expect(elements.panel.hidden).toBe(false);
    });

    test('clicking toggle again hides panel', () => {
      controller.initialize();
      elements.toggle.click();
      elements.toggle.click();
      expect(elements.panel.hidden).toBe(true);
    });

    test('toggle updates aria-expanded', () => {
      controller.initialize();
      elements.toggle.click();
      expect(elements.toggle.getAttribute('aria-expanded')).toBe('true');
      elements.toggle.click();
      expect(elements.toggle.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('tab switching', () => {
    beforeEach(() => {
      controller.initialize();
    });

    test('clicking advanced tab activates it', () => {
      elements.tabAdvanced.click();
      expect(elements.tabAdvanced.classList.contains('active')).toBe(true);
      expect(elements.tabBasic.classList.contains('active')).toBe(false);
    });

    test('tab content visibility reflects selection', () => {
      elements.tabAdvanced.click();
      expect(elements.tabAdvancedContent.hidden).toBe(false);
      expect(elements.tabBasicContent.hidden).toBe(true);
    });

    test('aria-selected reflects selection', () => {
      elements.tabAdvanced.click();
      expect(elements.tabAdvanced.getAttribute('aria-selected')).toBe('true');
      expect(elements.tabBasic.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('form interactions', () => {
    beforeEach(() => {
      controller.initialize();
    });

    test('changing rules select updates preferences', () => {
      elements.rulesSelect.value = 'free';
      elements.rulesSelect.dispatchEvent(new Event('change'));
      expect(prefs.state.edit.rulesMode).toBe('free');
    });

    test('toggling show captured updates preferences', () => {
      elements.showCaptured.checked = false;
      elements.showCaptured.dispatchEvent(new Event('change'));
      expect(prefs.state.solve.showCapturedStones).toBe(false);
    });

    test('toggling enable full reset updates preferences', () => {
      elements.enableReset.checked = false;
      elements.enableReset.dispatchEvent(new Event('change'));
      expect(prefs.state.solve.enableFullReset).toBe(false);
    });

    test('toggling highlight last move updates preferences', () => {
      elements.highlightLast.checked = false;
      elements.highlightLast.dispatchEvent(new Event('change'));
      expect(prefs.state.solve.highlightLastMove).toBe(false);
    });

    test('toggling show solution move numbers updates preferences', () => {
      elements.showSolutionMoveNumbers.checked = true;
      elements.showSolutionMoveNumbers.dispatchEvent(new Event('change'));
      expect(prefs.state.solve.showSolutionMoveNumbers).toBe(true);
    });

    test('changing device profile updates preferences', () => {
      elements.deviceProfileSelect.value = 'desktop';
      elements.deviceProfileSelect.dispatchEvent(new Event('change'));
      expect(prefs.state.ui.deviceProfile).toBe('desktop');
    });
  });

  describe('reset button', () => {
    test('clicking reset restores default preferences', () => {
      controller.initialize();
      // Modify preferences
      elements.showCaptured.checked = false;
      elements.showCaptured.dispatchEvent(new Event('change'));
      expect(prefs.state.solve.showCapturedStones).toBe(false);

      // Click reset
      elements.resetBtn.click();
      // Should be back to default
      expect(prefs.state.solve.showCapturedStones).toBe(true);
    });

    test('reset syncs UI back to default values', () => {
      controller.initialize();
      elements.showCaptured.checked = false;
      elements.showCaptured.dispatchEvent(new Event('change'));
      // After change, UI should reflect the change
      expect(elements.showCaptured.checked).toBe(false);

      // Click reset
      elements.resetBtn.click();
      // UI should sync back to default (on → checked)
      expect(elements.showCaptured.checked).toBe(true);
    });
  });

  describe('reactivity to external preference changes', () => {
    test('external change to preferences updates UI', () => {
      controller.initialize();
      prefs.setShowCapturedStones(false);
      // UI should reflect the change
      expect(elements.showCaptured.checked).toBe(false);
    });

    test('external change to rules mode updates UI', () => {
      controller.initialize();
      prefs.setEditRulesMode('free');
      expect(elements.rulesSelect.value).toBe('free');
    });
  });
});
