import { DeviceProfile, PanelPosition, Preferences, RulesMode } from "../../types.js";
import { PreferencesStore } from "../../services/preferences-store.js";

export class SettingsController {
  private panel: HTMLElement | null = null;
  private toggleButton: HTMLButtonElement | null = null;
  private tabButtons: HTMLButtonElement[] = [];
  private tabContents: Record<string, HTMLElement | null> = {};
  private rulesSelect: HTMLSelectElement | null = null;
  private deviceProfileSelect: HTMLSelectElement | null = null;
  private panelPositionSelect: HTMLSelectElement | null = null;
  private showCapturedCheckbox: HTMLInputElement | null = null;
  private fullResetCheckbox: HTMLInputElement | null = null;
  private highlightLastMoveCheckbox: HTMLInputElement | null = null;
  private showSolutionMoveNumbersCheckbox: HTMLInputElement | null = null;
  private showMarkersCheckbox: HTMLInputElement | null = null;
  private allowMultiMarkerCheckbox: HTMLInputElement | null = null;
  private resetButton: HTMLButtonElement | null = null;

  constructor(private readonly preferences: PreferencesStore) {}

  initialize(): void {
    this.panel = document.getElementById("settings-panel");
    this.toggleButton = document.getElementById("settings-toggle") as HTMLButtonElement | null;
    this.tabButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#settings-panel .settings-tab")
    );
    this.tabContents = {
      basic: document.getElementById("settings-tab-basic"),
      advanced: document.getElementById("settings-tab-advanced"),
    };
    this.rulesSelect = document.getElementById("setting-edit-rules-mode") as HTMLSelectElement | null;
    this.deviceProfileSelect = document.getElementById("settings-device-profile") as HTMLSelectElement | null;
    this.panelPositionSelect = document.getElementById("setting-panel-position") as HTMLSelectElement | null;
    this.showCapturedCheckbox = document.getElementById("setting-show-captured") as HTMLInputElement | null;
    this.fullResetCheckbox = document.getElementById("setting-enable-reset") as HTMLInputElement | null;
    this.highlightLastMoveCheckbox = document.getElementById("setting-highlight-last-move") as HTMLInputElement | null;
    this.showSolutionMoveNumbersCheckbox = document.getElementById("setting-show-solution-move-numbers") as HTMLInputElement | null;
    this.showMarkersCheckbox = document.getElementById("setting-show-markers") as HTMLInputElement | null;
    this.allowMultiMarkerCheckbox = document.getElementById("setting-allow-multi-marker") as HTMLInputElement | null;
    this.resetButton = document.getElementById("setting-reset-button") as HTMLButtonElement | null;

    this.bindEvents();
    this.selectTab("basic");
    this.syncUI(this.preferences.state);
    this.preferences.onChange((prefs) => this.syncUI(prefs));
  }

  private bindEvents(): void {
    this.toggleButton?.addEventListener("click", () => {
      if (!this.panel) return;
      this.panel.hidden = !this.panel.hidden;
      this.toggleButton?.setAttribute("aria-expanded", this.panel.hidden ? "false" : "true");
    });

    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab) {
          this.selectTab(tab);
        }
      });
    });

    this.rulesSelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value as RulesMode;
      this.preferences.setEditRulesMode(value);
    });

    this.showCapturedCheckbox?.addEventListener("change", (event) => {
      this.preferences.setShowCapturedStones((event.target as HTMLInputElement).checked);
    });

    this.fullResetCheckbox?.addEventListener("change", (event) => {
      this.preferences.setEnableFullReset((event.target as HTMLInputElement).checked);
    });

    this.highlightLastMoveCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked;
      this.preferences.setHighlightLastMove(value);
    });

    this.showSolutionMoveNumbersCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked;
      this.preferences.setShowSolutionMoveNumbers(value);
    });

    this.showMarkersCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked;
      this.preferences.setShowMarkers(value);
    });

    this.allowMultiMarkerCheckbox?.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).checked;
      this.preferences.setAllowMultiMarker(value);
    });

    this.deviceProfileSelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value as DeviceProfile;
      this.preferences.setDeviceProfile(value);
    });

    this.panelPositionSelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value as PanelPosition;
      this.preferences.setPanelPosition(value);
      // 即時にレイアウトへ反映（リスナー chain に依存しない直接パス）
      this.applyPanelPositionNow(value);
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
    if (this.panelPositionSelect) {
      this.panelPositionSelect.value = prefs.ui.panelPosition;
    }
  }

  private selectTab(tab: string): void {
    this.tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    Object.entries(this.tabContents).forEach(([key, element]) => {
      if (!element) return;
      const isActive = key === tab;
      element.hidden = !isActive;
      element.classList.toggle("active", isActive);
    });
  }

  /**
   * パネル左右設定を即時にレイアウトへ反映する。
   * CSSキャッシュや listener chain の遅延を避け、
   * change イベント発火時点で直接 inline style を書き換える。
   */
  private applyPanelPositionNow(position: PanelPosition): void {
    const body = document.body;
    body.classList.toggle("panel-right", position === "board-right");
    const layout = document.getElementById("layout");
    const isHorizontal = body.classList.contains("horizontal");
    if (layout) {
      if (isHorizontal && position === "board-right") {
        layout.style.flexDirection = "row-reverse";
      } else {
        layout.style.flexDirection = "";
      }
    }
  }
}
