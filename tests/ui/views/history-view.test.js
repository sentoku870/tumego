import { HistoryView } from '../../../dist/ui/views/history-view.js';

const createHistoryItems = (count) => {
  const items = [];
  const baseTime = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < count; i++) {
    items.push({
      index: i,
      label: `Label ${i}`,
      timestamp: new Date(baseTime.getTime() + i * 1000),
      timeString: new Date(baseTime.getTime() + i * 1000).toISOString()
    });
  }
  return items;
};

describe('HistoryView', () => {
  let view;

  beforeEach(() => {
    document.body.innerHTML = '';
    view = new HistoryView();
    global.alert = () => {};
  });

  describe('render() with empty history', () => {
    test('shows alert and does not create modal', () => {
      let alertCalled = false;
      global.alert = () => { alertCalled = true; };

      view.render([], () => {});

      expect(alertCalled).toBe(true);
      expect(document.getElementById('history-popup')).toBeNull();
    });
  });

  describe('render() with history items', () => {
    test('creates modal popup with id "history-popup"', () => {
      const items = createHistoryItems(3);
      view.render(items, () => {});
      const popup = document.getElementById('history-popup');
      expect(popup).not.toBeNull();
    });

    test('renders one button per history item', () => {
      const items = createHistoryItems(3);
      view.render(items, () => {});
      const buttons = document.querySelectorAll('.history-item-btn');
      expect(buttons.length).toBe(3);
    });

    test('each button carries the item index as data-index', () => {
      const items = createHistoryItems(3);
      view.render(items, () => {});
      const buttons = Array.from(document.querySelectorAll('.history-item-btn'));
      const indices = buttons.map((btn) => btn.getAttribute('data-index'));
      expect(indices).toEqual(['0', '1', '2']);
    });

    test('renders item label and time text inside each button', () => {
      const items = createHistoryItems(2);
      view.render(items, () => {});
      const popup = document.getElementById('history-popup');
      expect(popup.textContent).toContain('Label 0');
      expect(popup.textContent).toContain('Label 1');
      expect(popup.textContent).toContain('最新2件');
    });

    test('renders clear and close footer buttons', () => {
      view.render(createHistoryItems(1), () => {});
      expect(document.getElementById('clear-history-btn')).not.toBeNull();
      expect(document.getElementById('close-history-btn')).not.toBeNull();
    });
  });

  describe('item click handler', () => {
    test('calls onRestore with the clicked item index when confirm returns true', () => {
      let restoredIndex = null;
      global.confirm = () => true;

      view.render(createHistoryItems(2), (idx) => { restoredIndex = idx; });

      const buttons = document.querySelectorAll('.history-item-btn');
      buttons[1].click();

      expect(restoredIndex).toBe(1);
    });

    test('does not call onRestore when confirm returns false', () => {
      let restoredIndex = null;
      global.confirm = () => false;

      view.render(createHistoryItems(2), (idx) => { restoredIndex = idx; });

      const buttons = document.querySelectorAll('.history-item-btn');
      buttons[0].click();

      expect(restoredIndex).toBeNull();
    });

    test('closes the modal after confirming restore', () => {
      global.confirm = () => true;

      view.render(createHistoryItems(1), () => {});
      expect(document.getElementById('history-popup')).not.toBeNull();

      const button = document.querySelector('.history-item-btn');
      button.click();

      expect(document.getElementById('history-popup')).toBeNull();
    });
  });

  describe('clear button handler', () => {
    test('calls onClear when confirm returns true', () => {
      let cleared = false;
      global.confirm = () => true;

      view.render(createHistoryItems(1), () => {}, () => { cleared = true; });
      document.getElementById('clear-history-btn').click();

      expect(cleared).toBe(true);
    });

    test('does not call onClear when confirm returns false', () => {
      let cleared = false;
      global.confirm = () => false;

      view.render(createHistoryItems(1), () => {}, () => { cleared = true; });
      document.getElementById('clear-history-btn').click();

      expect(cleared).toBe(false);
    });

    test('works when onClear callback is not provided', () => {
      global.confirm = () => true;
      let alertCalled = false;
      global.alert = () => { alertCalled = true; };

      view.render(createHistoryItems(1), () => {});
      document.getElementById('clear-history-btn').click();

      expect(alertCalled).toBe(true);
      expect(document.getElementById('history-popup')).toBeNull();
    });
  });

  describe('close button handler', () => {
    test('closes the modal without calling onRestore or onClear', () => {
      let restored = false;
      let cleared = false;

      view.render(createHistoryItems(2), () => { restored = true; }, () => { cleared = true; });
      document.getElementById('close-history-btn').click();

      expect(restored).toBe(false);
      expect(cleared).toBe(false);
      expect(document.getElementById('history-popup')).toBeNull();
    });
  });

  describe('reopening', () => {
    test('removes existing item buttons when re-rendered', () => {
      view.render(createHistoryItems(2), () => {});
      expect(document.querySelectorAll('.history-item-btn').length).toBe(2);

      document.body.innerHTML = '';
      view.render(createHistoryItems(5), () => {});
      expect(document.querySelectorAll('.history-item-btn').length).toBe(5);
    });
  });
});
