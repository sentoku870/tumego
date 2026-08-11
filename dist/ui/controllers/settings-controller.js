export class SettingsController {
    constructor(preferences) {
        this.preferences = preferences;
        this.panel = null;
        this.toggleButton = null;
        this.tabButtons = [];
        this.tabContents = {};
        this.rulesSelect = null;
        this.longPressDurationSelect = null;
        this.deviceProfileSelect = null;
        this.showCapturedCheckbox = null;
        this.fullResetCheckbox = null;
        this.highlightLastMoveCheckbox = null;
        this.showSolutionMoveNumbersCheckbox = null;
        this.showMarkersCheckbox = null;
        this.allowMultiMarkerCheckbox = null;
        this.resetButton = null;
    }
    initialize() {
        this.panel = document.getElementById("settings-panel");
        this.toggleButton = document.getElementById("settings-toggle");
        this.tabButtons = Array.from(document.querySelectorAll("#settings-panel .settings-tab"));
        this.tabContents = {
            basic: document.getElementById("settings-tab-basic"),
            advanced: document.getElementById("settings-tab-advanced"),
        };
        this.rulesSelect = document.getElementById("setting-edit-rules-mode");
        this.longPressDurationSelect = document.getElementById("setting-edit-long-press-duration");
        this.deviceProfileSelect = document.getElementById("settings-device-profile");
        this.showCapturedCheckbox = document.getElementById("setting-show-captured");
        this.fullResetCheckbox = document.getElementById("setting-enable-reset");
        this.highlightLastMoveCheckbox = document.getElementById("setting-highlight-last-move");
        this.showSolutionMoveNumbersCheckbox = document.getElementById("setting-show-solution-move-numbers");
        this.showMarkersCheckbox = document.getElementById("setting-show-markers");
        this.allowMultiMarkerCheckbox = document.getElementById("setting-allow-multi-marker");
        this.resetButton = document.getElementById("setting-reset-button");
        this.bindEvents();
        this.selectTab("basic");
        this.syncUI(this.preferences.state);
        this.preferences.onChange((prefs) => this.syncUI(prefs));
    }
    bindEvents() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        (_a = this.toggleButton) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
            var _a;
            if (!this.panel)
                return;
            this.panel.hidden = !this.panel.hidden;
            (_a = this.toggleButton) === null || _a === void 0 ? void 0 : _a.setAttribute("aria-expanded", this.panel.hidden ? "false" : "true");
        });
        this.tabButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const tab = btn.dataset.tab;
                if (tab) {
                    this.selectTab(tab);
                }
            });
        });
        (_b = this.rulesSelect) === null || _b === void 0 ? void 0 : _b.addEventListener("change", (event) => {
            const value = event.target.value;
            this.preferences.setEditRulesMode(value);
        });
        (_c = this.longPressDurationSelect) === null || _c === void 0 ? void 0 : _c.addEventListener("change", (event) => {
            const value = event.target.value;
            this.preferences.setLongPressDuration(value);
        });
        (_d = this.showCapturedCheckbox) === null || _d === void 0 ? void 0 : _d.addEventListener("change", (event) => {
            this.preferences.setShowCapturedStones(event.target.checked);
        });
        (_e = this.fullResetCheckbox) === null || _e === void 0 ? void 0 : _e.addEventListener("change", (event) => {
            this.preferences.setEnableFullReset(event.target.checked);
        });
        (_f = this.highlightLastMoveCheckbox) === null || _f === void 0 ? void 0 : _f.addEventListener("change", (event) => {
            const value = event.target.checked;
            this.preferences.setHighlightLastMove(value);
        });
        (_g = this.showSolutionMoveNumbersCheckbox) === null || _g === void 0 ? void 0 : _g.addEventListener("change", (event) => {
            const value = event.target.checked;
            this.preferences.setShowSolutionMoveNumbers(value);
        });
        (_h = this.showMarkersCheckbox) === null || _h === void 0 ? void 0 : _h.addEventListener("change", (event) => {
            const value = event.target.checked;
            this.preferences.setShowMarkers(value);
        });
        (_j = this.allowMultiMarkerCheckbox) === null || _j === void 0 ? void 0 : _j.addEventListener("change", (event) => {
            const value = event.target.checked;
            this.preferences.setAllowMultiMarker(value);
        });
        (_k = this.deviceProfileSelect) === null || _k === void 0 ? void 0 : _k.addEventListener("change", (event) => {
            const value = event.target.value;
            this.preferences.setDeviceProfile(value);
        });
        (_l = this.resetButton) === null || _l === void 0 ? void 0 : _l.addEventListener("click", () => {
            this.preferences.reset();
            this.syncUI(this.preferences.state);
        });
    }
    syncUI(prefs) {
        if (this.rulesSelect) {
            this.rulesSelect.value = prefs.edit.rulesMode;
        }
        if (this.longPressDurationSelect) {
            this.longPressDurationSelect.value = prefs.edit.longPressDuration;
        }
        if (this.showCapturedCheckbox) {
            this.showCapturedCheckbox.checked = prefs.solve.showCapturedStones;
        }
        if (this.fullResetCheckbox) {
            this.fullResetCheckbox.checked = prefs.solve.enableFullReset;
        }
        if (this.highlightLastMoveCheckbox) {
            this.highlightLastMoveCheckbox.checked = prefs.solve.highlightLastMove;
        }
        if (this.showSolutionMoveNumbersCheckbox) {
            this.showSolutionMoveNumbersCheckbox.checked = prefs.solve.showSolutionMoveNumbers;
        }
        if (this.showMarkersCheckbox) {
            this.showMarkersCheckbox.checked = prefs.solve.showMarkers;
        }
        if (this.allowMultiMarkerCheckbox) {
            this.allowMultiMarkerCheckbox.checked = prefs.solve.allowMultiMarker;
        }
        if (this.deviceProfileSelect) {
            this.deviceProfileSelect.value = prefs.ui.deviceProfile;
        }
    }
    selectTab(tab) {
        this.tabButtons.forEach((btn) => {
            const isActive = btn.dataset.tab === tab;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        Object.entries(this.tabContents).forEach(([key, element]) => {
            if (!element)
                return;
            const isActive = key === tab;
            element.hidden = !isActive;
            element.classList.toggle("active", isActive);
        });
    }
}
//# sourceMappingURL=settings-controller.js.map