// ============ モーダル共通コンポーネント ============
// 4 箇所（QRManager, FeatureMenuController, HistoryView, BoardCaptureService）
// で重複していた「黒半透明オーバーレイ + 白カード + 閉じる」HTML を集約する。
// 既存見た目を維持しつつ、a11y 対応とライフサイクル管理を統一する。

export interface ModalOptions {
  /** DOM 要素の一意 id（既存コードとの互換のため） */
  id: string;
  /** モーダル内に表示するコンテンツ（HTMLElement または HTML 文字列） */
  content: HTMLElement | string;
  /** 背景の不透明度 (0-1)。省略時は 0.85 */
  overlayOpacity?: number;
  /** カードの最大幅 (CSS)。省略時は 500px */
  maxWidth?: string;
  /** Esc キーで閉じるか。デフォルト true */
  closeOnEsc?: boolean;
  /** 背景クリックで閉じるか。デフォルト true */
  closeOnBackdrop?: boolean;
  /** 閉じるときのコールバック */
  onClose?: () => void;
}

export class Modal {
  private element: HTMLElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly options: ModalOptions) {}

  open(): void {
    this.close();

    const overlayOpacity = this.options.overlayOpacity ?? 0.85;
    const maxWidth = this.options.maxWidth ?? '500px';
    const content = this.options.content;

    const overlay = document.createElement('div');
    overlay.id = this.options.id;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,${overlayOpacity}); z-index:9999; display:flex; justify-content:center; align-items:center;`;

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.cssText = `background:white; padding:25px; border-radius:15px; text-align:center; max-width:${maxWidth}; max-height:90vh; overflow-y:auto; position:relative;`;

    if (typeof content === 'string') {
      card.innerHTML = content;
    } else {
      card.appendChild(content);
    }

    overlay.appendChild(card);

    if (this.options.closeOnBackdrop !== false) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          this.close();
        }
      });
    }

    if (this.options.closeOnEsc !== false) {
      this.escHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escHandler);
    }

    document.body.appendChild(overlay);
    this.element = overlay;
  }

  close(): void {
    if (!this.element) {
      return;
    }
    this.element.remove();
    this.element = null;
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
    this.options.onClose?.();
  }

  isOpen(): boolean {
    return this.element !== null;
  }
}
