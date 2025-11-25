import { DeviceProfile, Preferences, RulesMode, ToggleSetting } from "../types.js";

const STORAGE_KEY = "tumego.preferences";

const DEFAULT_PREFERENCES: Preferences = {
  edit: { rulesMode: "standard" },
  solve: {
    showCapturedStones: "on",
    enableFullReset: "on",
  },
  ui: { deviceProfile: "auto" },
};

function clonePreferences(prefs: Preferences): Preferences {
  return JSON.parse(JSON.stringify(prefs)) as Preferences;
}

function isRulesMode(value: unknown): value is RulesMode {
  return value === "standard" || value === "free";
}

function isToggleSetting(value: unknown): value is ToggleSetting {
  return value === "on" || value === "off";
}

function isDeviceProfile(value: unknown): value is DeviceProfile {
  return value === "auto" || value === "desktop" || value === "phone" || value === "tablet";
}

function normalizePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object") {
    return clonePreferences(DEFAULT_PREFERENCES);
  }

  try {
    const parsed = raw as Record<string, unknown>;
    const edit = parsed.edit as Record<string, unknown> | undefined;
    const solve = parsed.solve as Record<string, unknown> | undefined;
    const ui = parsed.ui as Record<string, unknown> | undefined;

    const rulesMode = isRulesMode(edit?.rulesMode) ? edit!.rulesMode : DEFAULT_PREFERENCES.edit.rulesMode;
    const showCapturedStones = isToggleSetting(solve?.showCapturedStones)
      ? solve!.showCapturedStones
      : DEFAULT_PREFERENCES.solve.showCapturedStones;
    const enableFullReset = isToggleSetting(solve?.enableFullReset)
      ? solve!.enableFullReset
      : DEFAULT_PREFERENCES.solve.enableFullReset;
    const deviceProfile = isDeviceProfile(ui?.deviceProfile)
      ? ui!.deviceProfile
      : DEFAULT_PREFERENCES.ui.deviceProfile;

    return {
      edit: { rulesMode },
      solve: { showCapturedStones, enableFullReset },
      ui: { deviceProfile },
    };
  } catch (error) {
    console.warn("Failed to normalize preferences", error);
    return clonePreferences(DEFAULT_PREFERENCES);
  }
}

export class PreferencesStore {
  private prefs: Preferences = clonePreferences(DEFAULT_PREFERENCES);
  private listeners: Array<(prefs: Preferences) => void> = [];

  constructor(private readonly storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null) {
    this.prefs = this.loadFromStorage();
  }

  get state(): Preferences {
    return this.prefs;
  }

  onChange(listener: (prefs: Preferences) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }

  setEditRulesMode(mode: RulesMode): void {
    if (!isRulesMode(mode)) return;
    this.updatePrefs({ edit: { rulesMode: mode } });
  }

  setShowCapturedStones(value: ToggleSetting): void {
    if (!isToggleSetting(value)) return;
    this.updatePrefs({ solve: { showCapturedStones: value } });
  }

  setEnableFullReset(value: ToggleSetting): void {
    if (!isToggleSetting(value)) return;
    this.updatePrefs({ solve: { enableFullReset: value } });
  }

  setDeviceProfile(value: DeviceProfile): void {
    if (!isDeviceProfile(value)) return;
    this.updatePrefs({ ui: { deviceProfile: value } });
  }

  reset(): void {
    this.prefs = clonePreferences(DEFAULT_PREFERENCES);
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to clear preferences", error);
      }
    }
    this.emit();
  }

  private updatePrefs(partial: {
    edit?: Partial<Preferences["edit"]>;
    solve?: Partial<Preferences["solve"]>;
    ui?: Partial<Preferences["ui"]>;
  }): void {
    this.prefs = {
      edit: { ...this.prefs.edit, ...(partial.edit ?? {}) },
      solve: { ...this.prefs.solve, ...(partial.solve ?? {}) },
      ui: { ...this.prefs.ui, ...(partial.ui ?? {}) },
    };
    this.persist();
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.prefs));
  }

  private persist(): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch (error) {
      console.warn("Failed to persist preferences", error);
    }
  }

  private loadFromStorage(): Preferences {
    if (!this.storage) {
      return clonePreferences(DEFAULT_PREFERENCES);
    }

    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) {
        return clonePreferences(DEFAULT_PREFERENCES);
      }

      const parsed = JSON.parse(raw) as unknown;
      return normalizePreferences(parsed);
    } catch (error) {
      console.warn("Failed to load preferences", error);
      return clonePreferences(DEFAULT_PREFERENCES);
    }
  }
}

export { DEFAULT_PREFERENCES, STORAGE_KEY };
