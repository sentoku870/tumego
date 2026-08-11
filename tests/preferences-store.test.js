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

  test("default longPressDuration is 'short'", () => {
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.edit.longPressDuration).toBe("short");
  });

  test("setLongPressDuration persists and updates state", () => {
    const store = new PreferencesStore(memoryStorage);
    store.setLongPressDuration("long");
    expect(store.state.edit.longPressDuration).toBe("long");
    const stored = JSON.parse(memoryStorage.getItem(STORAGE_KEY));
    expect(stored.edit.longPressDuration).toBe("long");
  });

  test("setLongPressDuration ignores invalid values", () => {
    const store = new PreferencesStore(memoryStorage);
    store.setLongPressDuration("invalid");
    expect(store.state.edit.longPressDuration).toBe("short");
  });

  test("falls back to default longPressDuration when missing in storage", () => {
    memoryStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ edit: { rulesMode: "free" } })
    );
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.edit.rulesMode).toBe("free");
    expect(store.state.edit.longPressDuration).toBe("short");
  });

  test("falls back to default longPressDuration when value is invalid", () => {
    memoryStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ edit: { longPressDuration: "medium" } })
    );
    const store = new PreferencesStore(memoryStorage);
    expect(store.state.edit.longPressDuration).toBe("short");
  });
});
