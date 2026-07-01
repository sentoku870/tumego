const STORAGE_KEY = "tumego.preferences";
const DEFAULT_PREFERENCES = {
    edit: { rulesMode: "standard" },
    solve: {
        showCapturedStones: true,
        enableFullReset: true,
        highlightLastMove: true,
        showSolutionMoveNumbers: false,
    },
    ui: { deviceProfile: "auto" },
};
function clonePreferences(prefs) {
    return JSON.parse(JSON.stringify(prefs));
}
function isRulesMode(value) {
    return value === "standard" || value === "free";
}
function isDeviceProfile(value) {
    return value === "auto" || value === "desktop" || value === "phone" || value === "tablet";
}
function isBooleanPreference(value) {
    return typeof value === "boolean";
}
/**
 * Legacy migration: previous schema stored these as "on"/"off" strings.
 * Convert to boolean so the rest of the code can use them directly.
 */
function legacyToggleToBoolean(value) {
    if (value === "on")
        return true;
    if (value === "off")
        return false;
    return null;
}
/**
 * Read a typed property from a possibly-undefined container.
 * The trailing `!` is required because TypeScript does not narrow the
 * container's presence from a successful type-guard on one of its
 * properties. Equivalent runtime behavior to `container?.prop`.
 */
function readField(container, key, guard) {
    if (container === undefined)
        return undefined;
    const value = container[key];
    return guard(value) ? value : undefined;
}
function normalizePreferences(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!raw || typeof raw !== "object") {
        return clonePreferences(DEFAULT_PREFERENCES);
    }
    try {
        const parsed = raw;
        const edit = parsed.edit;
        const solve = parsed.solve;
        const ui = parsed.ui;
        const rulesMode = (_a = readField(edit, 'rulesMode', isRulesMode)) !== null && _a !== void 0 ? _a : DEFAULT_PREFERENCES.edit.rulesMode;
        const showCapturedStones = (_c = (_b = readField(solve, 'showCapturedStones', isBooleanPreference)) !== null && _b !== void 0 ? _b : legacyToggleToBoolean(solve === null || solve === void 0 ? void 0 : solve.showCapturedStones)) !== null && _c !== void 0 ? _c : DEFAULT_PREFERENCES.solve.showCapturedStones;
        const enableFullReset = (_e = (_d = readField(solve, 'enableFullReset', isBooleanPreference)) !== null && _d !== void 0 ? _d : legacyToggleToBoolean(solve === null || solve === void 0 ? void 0 : solve.enableFullReset)) !== null && _e !== void 0 ? _e : DEFAULT_PREFERENCES.solve.enableFullReset;
        const highlightLastMove = (_f = readField(solve, 'highlightLastMove', isBooleanPreference)) !== null && _f !== void 0 ? _f : DEFAULT_PREFERENCES.solve.highlightLastMove;
        const showSolutionMoveNumbers = (_g = readField(solve, 'showSolutionMoveNumbers', isBooleanPreference)) !== null && _g !== void 0 ? _g : DEFAULT_PREFERENCES.solve.showSolutionMoveNumbers;
        const deviceProfile = (_h = readField(ui, 'deviceProfile', isDeviceProfile)) !== null && _h !== void 0 ? _h : DEFAULT_PREFERENCES.ui.deviceProfile;
        return {
            edit: { rulesMode },
            solve: { showCapturedStones, enableFullReset, highlightLastMove, showSolutionMoveNumbers },
            ui: { deviceProfile },
        };
    }
    catch (error) {
        console.warn("Failed to normalize preferences", error);
        return clonePreferences(DEFAULT_PREFERENCES);
    }
}
export class PreferencesStore {
    constructor(storage = typeof window !== "undefined" ? window.localStorage : null) {
        this.storage = storage;
        this.prefs = clonePreferences(DEFAULT_PREFERENCES);
        this.listeners = [];
        this.prefs = this.loadFromStorage();
    }
    get state() {
        return this.prefs;
    }
    onChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((fn) => fn !== listener);
        };
    }
    setEditRulesMode(mode) {
        if (!isRulesMode(mode))
            return;
        this.updatePrefs({ edit: { rulesMode: mode } });
    }
    setShowCapturedStones(value) {
        if (!isBooleanPreference(value))
            return;
        this.updatePrefs({ solve: { showCapturedStones: value } });
    }
    setEnableFullReset(value) {
        if (!isBooleanPreference(value))
            return;
        this.updatePrefs({ solve: { enableFullReset: value } });
    }
    setHighlightLastMove(value) {
        if (!isBooleanPreference(value))
            return;
        this.updatePrefs({ solve: { highlightLastMove: value } });
    }
    setShowSolutionMoveNumbers(value) {
        if (!isBooleanPreference(value))
            return;
        this.updatePrefs({ solve: { showSolutionMoveNumbers: value } });
    }
    setDeviceProfile(value) {
        if (!isDeviceProfile(value))
            return;
        this.updatePrefs({ ui: { deviceProfile: value } });
    }
    reset() {
        this.prefs = clonePreferences(DEFAULT_PREFERENCES);
        if (this.storage) {
            try {
                this.storage.removeItem(STORAGE_KEY);
            }
            catch (error) {
                console.warn("Failed to clear preferences", error);
            }
        }
        this.emit();
    }
    updatePrefs(partial) {
        var _a, _b, _c;
        this.prefs = {
            edit: { ...this.prefs.edit, ...((_a = partial.edit) !== null && _a !== void 0 ? _a : {}) },
            solve: { ...this.prefs.solve, ...((_b = partial.solve) !== null && _b !== void 0 ? _b : {}) },
            ui: { ...this.prefs.ui, ...((_c = partial.ui) !== null && _c !== void 0 ? _c : {}) },
        };
        this.persist();
        this.emit();
    }
    emit() {
        this.listeners.forEach((listener) => listener(this.prefs));
    }
    persist() {
        if (!this.storage)
            return;
        try {
            this.storage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
        }
        catch (error) {
            console.warn("Failed to persist preferences", error);
        }
    }
    loadFromStorage() {
        if (!this.storage) {
            return clonePreferences(DEFAULT_PREFERENCES);
        }
        try {
            const raw = this.storage.getItem(STORAGE_KEY);
            if (!raw) {
                return clonePreferences(DEFAULT_PREFERENCES);
            }
            const parsed = JSON.parse(raw);
            return normalizePreferences(parsed);
        }
        catch (error) {
            console.warn("Failed to load preferences", error);
            return clonePreferences(DEFAULT_PREFERENCES);
        }
    }
}
export { DEFAULT_PREFERENCES, STORAGE_KEY };
//# sourceMappingURL=preferences-store.js.map