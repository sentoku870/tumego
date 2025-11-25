import { DeviceProfile, Preferences, RulesMode, ToggleSetting } from "../../types.js";
import { PreferencesStore } from "../../services/preferences-store.js";

export class SettingsController {
  private panel: HTMLElement | null = null;
  private toggleButton: HTMLButtonElement | null = null;
  private rulesSelect: HTMLSelectElement | null = null;
  private deviceProfileSelect: HTMLSelectElement | null = null;
  private showCapturedCheckbox: HTMLInputElement | null = null;
  private fullResetCheckbox: HTMLInputElement | null = null;
  private resetButton: HTMLButtonElement | null = null;

  constructor(private readonly preferences: PreferencesStore) {}

  initialize(): void {
    this.panel = document.getElementById("settings-panel");
    this.toggleButton = document.getElementById("settings-toggle") as HTMLButtonElement | null;
    this.rulesSelect = document.getElementById("setting-edit-rules-mode") as HTMLSelectElement | null;
    this.deviceProfileSelect = document.getElementById("settings-device-profile") as HTMLSelectElement | null;
    this.showCapturedCheckbox = document.getElementById("setting-show-captured") as HTMLInputElement | null;
    this.fullResetCheckbox = document.getElementById("setting-enable-reset") as HTMLInputElement | null;
    this.resetButton = document.getElementById("setting-reset-button") as HTMLButtonElement | null;

    this.bindEvents();
    this.syncUI(this.preferences.state);
    this.preferences.onChange((prefs) => this.syncUI(prefs));
  }

  private bindEvents(): void {
    this.toggleButton?.addEventListener("click", () => {
      if (!this.panel) return;
      this.panel.hidden = !this.panel.hidden;
      this.toggleButton?.setAttribute("aria-expanded", this.panel.hidden ? "false" : "true");
    });

    this.rulesSelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value as RulesMode;
      this.preferences.setEditRulesMode(value);
    });

    this.showCapturedCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked ? "on" : "off";
      this.preferences.setShowCapturedStones(value as ToggleSetting);
    });

    this.fullResetCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked ? "on" : "off";
      this.preferences.setEnableFullReset(value as ToggleSetting);
    });

    this.deviceProfileSelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value as DeviceProfile;
      this.preferences.setDeviceProfile(value);
    });

    this.resetButton?.addEventListener("click", () => {
      this.preferences.reset();
      this.syncUI(this.preferences.state);
    });
  }

  private syncUI(prefs: Preferences): void {
    if (this.rulesSelect) {
      this.rulesSelect.value = prefs.edit.rulesMode;
    }
    if (this.showCapturedCheckbox) {
      this.showCapturedCheckbox.checked = prefs.solve.showCapturedStones === "on";
    }
    if (this.fullResetCheckbox) {
      this.fullResetCheckbox.checked = prefs.solve.enableFullReset === "on";
    }
    if (this.deviceProfileSelect) {
      this.deviceProfileSelect.value = prefs.ui.deviceProfile;
    }
  }
}
