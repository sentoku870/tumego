// ============ ToolbarMarkerPalette ============
// ツールバー右端のマーカー関連 UI を担当する。
// トリガーボタン (○△□×/ラベル パレット開閉)、パレット内の選択ボタン、
// クリアボタン、閉じるボタンを管理する。
// マーカー選択状態 (markerMode) は触らず、UI 状態の反映のみを担う。
import { GameStore } from '../../../state/game-store.js';
import { UIEventBus } from '../../../app/event-bus.js';
import { DropdownManager } from '../dropdown-manager.js';
import { MarkerKind, MARKER_LETTER_SEQUENCE } from '../../../types.js';

const MARKER_KINDS: MarkerKind[] = ['CR', 'TR', 'SQ', 'MA', 'LB'];
const MARKER_GLYPHS: Record<MarkerKind, string> = {
  CR: '○',
  TR: '△',
  SQ: '□',
  MA: '×',
  LB: '文字',
};

export class ToolbarMarkerPalette {
  private __markerBtn: HTMLButtonElement | null = null;
  private __markerDropdown: HTMLElement | null = null;
  private __markerPaletteBtns: Partial<Record<MarkerKind, HTMLButtonElement | null>> = {};
  private __markerLetterBtn: HTMLButtonElement | null = null;
  private __markerClearBtn: HTMLButtonElement | null = null;
  private unsubscribeDocument: (() => void) | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly eventBus: UIEventBus,
    private readonly dropdownManager: DropdownManager,
    private readonly onBeforeOpen: () => void = () => {}
  ) {}

  /** パレットの DOM 参照を確保する（冪等） */
  ensureButtonRefs(): void {
    this.__markerBtn = this.__markerBtn ?? (document.getElementById('btn-marker') as HTMLButtonElement | null);
    this.__markerDropdown = this.__markerDropdown ?? (document.getElementById('marker-dropdown') as HTMLElement | null);
    this.__markerClearBtn = this.__markerClearBtn ?? (document.getElementById('btn-marker-clear') as HTMLButtonElement | null);
    this.__markerLetterBtn = this.__markerLetterBtn ?? (document.getElementById('btn-marker-select-LB') as HTMLButtonElement | null);
    for (const kind of MARKER_KINDS) {
      if (kind === 'LB') continue; // LB は単一の cycling ボタン
      if (this.__markerPaletteBtns[kind]) continue;
      this.__markerPaletteBtns[kind] = document.getElementById(`btn-marker-select-${kind}`) as HTMLButtonElement | null;
    }
  }

  /** イベントリスナーをバインドする */
  bindEvents(): void {
    this.ensureButtonRefs();

    if (this.__markerBtn) {
      this.__markerBtn.title = 'マーカー（○△□×／ラベル）パレットを開閉します';
    }

    // トリガーボタンはパレットの開閉専用。マーカー選択状態は触らない。
    this.__markerBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = this.__markerDropdown;
      const btn = this.__markerBtn;
      if (!btn || !dropdown) return;
      const isOpen = dropdown.classList.contains('show');
      if (isOpen) {
        this.dropdownManager.hide(dropdown);
      } else {
        this.onBeforeOpen();
        this.dropdownManager.open(btn, dropdown);
      }
    });

    this.__markerDropdown?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    // パレット外クリックで閉じる
    if (this.__markerBtn && !this.unsubscribeDocument) {
      const btn = this.__markerBtn;
      const dropdown = this.__markerDropdown;
      const documentHandler = (event: MouseEvent) => {
        if (!dropdown) return;
        if (!dropdown.classList.contains('show')) return;
        const target = event.target as Node | null;
        if (target && (dropdown.contains(target) || btn.contains(target))) {
          return;
        }
        this.dropdownManager.hide(dropdown);
      };
      document.addEventListener('click', documentHandler);
      this.unsubscribeDocument = () => {
        document.removeEventListener('click', documentHandler);
      };
    }

    // ○△□× を選んだとき: パレットは閉じず、選択種別だけ切り替える
    for (const kind of ['CR', 'TR', 'SQ', 'MA'] as const) {
      const item = document.getElementById(`btn-marker-select-${kind}`) as HTMLButtonElement | null;
      item?.addEventListener('click', () => {
        this.onBeforeOpen();
        this.handlePaletteItemSelect(kind, null);
      });
    }

    // 文字マーカー: アクティブでないとき A から開始。アクティブのとき再クリックで OFF。
    const letterBtn = this.__markerLetterBtn;
    letterBtn?.addEventListener('click', () => {
      this.onBeforeOpen();
      const state = this.store.snapshot;
      if (state.markerMode && state.activeMarkerKind === 'LB') {
        // 同じものを再クリック → トグル OFF
        this.store.setMarkerMode(null);
      } else {
        // 現在の activeMarkerLabel から開始（未設定なら A）
        const startLabel = state.activeMarkerLabel ?? MARKER_LETTER_SEQUENCE[0];
        this.store.setMarkerMode('LB', startLabel);
      }
      this.setActiveButton();
      this.eventBus.emitUIUpdate();
    });

    const clearBtn = this.__markerClearBtn;
    clearBtn?.addEventListener('click', () => {
      this.store.clearMarkers();
      this.eventBus.emitUIUpdate();
    });

    const closeBtn = document.getElementById('btn-marker-close') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => {
      // パレットを閉じると同時にマーカーモードも解除 → 黒配置/自由配置に戻れる
      this.store.setMarkerMode(null);
      if (this.__markerDropdown) {
        this.dropdownManager.hide(this.__markerDropdown);
      }
      this.setActiveButton();
      this.eventBus.emitUIUpdate();
    });
  }

  /** アンマウント時のクリーンアップ */
  dispose(): void {
    this.unsubscribeDocument?.();
    this.unsubscribeDocument = null;
  }

  // ============ ボタン参照の読み取り専用ゲッター ============
  // ToolbarButtons から透過的にアクセスするため
  get _markerBtn(): HTMLButtonElement | null { return this.__markerBtn; }
  get _markerDropdown(): HTMLElement | null { return this.__markerDropdown; }
  get _markerPaletteBtns(): Partial<Record<MarkerKind, HTMLButtonElement | null>> { return this.__markerPaletteBtns; }
  get _markerLetterBtn(): HTMLButtonElement | null { return this.__markerLetterBtn; }
  get _markerClearBtn(): HTMLButtonElement | null { return this.__markerClearBtn; }

  /** マーカートリガーボタンの active 状態とラベル、palette の選択表示を更新 */
  setActiveButton(): void {
    this.ensureButtonRefs();
    const state = this.store.snapshot;
    const active = state.activeMarkerKind;
    const activeLabel = state.activeMarkerLabel;
    if (this.__markerBtn) {
      this.__markerBtn.classList.toggle('active', active !== null);
      let label = '🔘 マーカー';
      if (active) {
        if (active === 'LB' && activeLabel) {
          label = `🔘 マーカー (${activeLabel})`;
        } else {
          label = `🔘 マーカー (${MARKER_GLYPHS[active]})`;
        }
      }
      if (this.__markerBtn.textContent !== label) {
        this.__markerBtn.textContent = label;
      }
    }
    for (const kind of ['CR', 'TR', 'SQ', 'MA'] as const) {
      const btn = this.__markerPaletteBtns[kind];
      if (!btn) continue;
      btn.classList.toggle('active', active === kind);
    }
    if (this.__markerLetterBtn) {
      this.__markerLetterBtn.classList.toggle('active', active === 'LB');
    }
  }

  /**
   * 盤面クリック時など、外部要因でマーカーパレットを閉じたいときに呼ぶ。
   * マーカー選択状態 (markerMode) は維持したまま、パレットだけを閉じる。
   */
  closePalette(): void {
    this.ensureButtonRefs();
    if (this.__markerDropdown && this.__markerDropdown.classList.contains('show')) {
      this.dropdownManager.hide(this.__markerDropdown);
    }
  }

  private handlePaletteItemSelect(kind: MarkerKind, label: string | null): void {
    const state = this.store.snapshot;
    // 同じものを再クリック → トグル OFF
    if (state.markerMode && state.activeMarkerKind === kind && state.activeMarkerLabel === label) {
      this.store.setMarkerMode(null);
    } else {
      this.store.setMarkerMode(kind, label);
    }
    this.setActiveButton();
    this.eventBus.emitUIUpdate();
  }
}
