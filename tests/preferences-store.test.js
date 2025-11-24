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
    store.setEnableFullReset("off");
    store.reset();
    expect(store.state).toEqual(DEFAULT_PREFERENCES);
    expect(memoryStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
