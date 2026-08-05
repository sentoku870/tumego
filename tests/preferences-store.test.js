import {
  PreferencesStore,
  DEFAULT_PREFERENCES,
  STORAGE_KEY,
} from "../dist/services/preferences-store.js";

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

describe("PreferencesStore", () => {
  let memoryStorage;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
  });

  test("falls back to defaults when storage is empty", () => {
    const store = new PreferencesStore(memoryStorage);
    expect(store.state).toEqual(DEFAULT_PREFERENCES);
  });

  test("persists updates to localStorage", () => {
    const store = new PreferencesStore(memoryStorage);
    store.setEditRulesMode("free");
    const stored = JSON.parse(memoryStorage.getItem(STORAGE_KEY));
    expect(stored.edit.rulesMode).toBe("free");
  });

  test("reset clears overrides and restores defaults", () => {
    const store = new PreferencesStore(memoryStorage);
    store.setEnableFullReset(false);
    store.reset();
    expect(store.state).toEqual(DEFAULT_PREFERENCES);
    expect(memoryStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("migrates legacy 'on'/'off' showCapturedStones to boolean", () => {
    memoryStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ solve: { showCapturedStones: "on" } })
    );
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.solve.showCapturedStones).toBe(true);
  });

  test("migrates legacy 'off' enableFullReset to false", () => {
    memoryStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ solve: { enableFullReset: "off" } })
    );
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.solve.enableFullReset).toBe(false);
  });

  test("falls back to default when legacy value is neither 'on' nor 'off'", () => {
    memoryStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ solve: { showCapturedStones: "maybe" } })
    );
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.solve.showCapturedStones).toBe(true);
  });

  describe("panelPosition", () => {
    test("defaults to 'board-left'", () => {
      const store = new PreferencesStore(memoryStorage);
      expect(store.state.ui.panelPosition).toBe("board-left");
    });

    test("setPanelPosition updates state and persists", () => {
      const store = new PreferencesStore(memoryStorage);
      store.setPanelPosition("board-right");
      expect(store.state.ui.panelPosition).toBe("board-right");
      const stored = JSON.parse(memoryStorage.getItem(STORAGE_KEY));
      expect(stored.ui.panelPosition).toBe("board-right");
    });

    test("setPanelPosition ignores invalid values", () => {
      const store = new PreferencesStore(memoryStorage);
      store.setPanelPosition("invalid");
      expect(store.state.ui.panelPosition).toBe("board-left");
    });

    test("normalizes legacy storage missing panelPosition to default", () => {
      memoryStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ui: { deviceProfile: "desktop" } })
      );
      const store = new PreferencesStore(memoryStorage);
      expect(store.state.ui.panelPosition).toBe("board-left");
    });

    test("normalizes invalid stored panelPosition to default", () => {
      memoryStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ui: { panelPosition: "side" } })
      );
      const store = new PreferencesStore(memoryStorage);
      expect(store.state.ui.panelPosition).toBe("board-left");
    });

    test("reset restores default panelPosition", () => {
      const store = new PreferencesStore(memoryStorage);
      store.setPanelPosition("board-right");
      store.reset();
      expect(store.state.ui.panelPosition).toBe("board-left");
    });
  });
});
