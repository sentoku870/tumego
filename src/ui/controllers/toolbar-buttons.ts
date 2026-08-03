// ============ ツールバー: ボタン参照 & イベントバインド ============
// ボタンの DOM 参照保持と addEventListener バインドを担当する。
// 状態反映(有効/無効、表示テキスト変更)は ToolbarState に分離。
import { GameStore } from '../../state/game-store.js';
import { Renderer } from '../../renderer/renderer.js';
import { BoardCaptureService } from '../../services/board-capture-service.js';
import { SGFService } from '../../services/sgf-service.js';
import { UIElements, PlayMode, MarkerKind, MARKER_LETTER_SEQUENCE } from '../../types.js';
import { UIEventBus } from '../../app/event-bus.js';
import { HistoryView } from '../views/history-view.js';
import { DropdownManager } from './dropdown-manager.js';

const MARKER_KINDS: MarkerKind[] = ['CR', 'TR', 'SQ', 'MA', 'LB'];
const MARKER_GLYPHS: Record<MarkerKind, string> = {
  CR: '○',
  TR: '△',
  SQ: '□',
  MA: '×',
  LB: '文字',
};

export class ToolbarButtons {
  private _clearBtn: HTMLButtonElement | null = null;
  private _problemBtn: HTMLButtonElement | null = null;
  private _answerBtn: HTMLButtonElement | null = null;
  private _prevMoveBtn: HTMLButtonElement | null = null;
  private _nextMoveBtn: HTMLButtonElement | null = null;
  private _blackBtn: HTMLButtonElement | null = null;
  private _whiteBtn: HTMLButtonElement | null = null;
  private _eraseBtn: HTMLButtonElement | null = null;
  private _altBtn: HTMLButtonElement | null = null;
  private _undoBtn: HTMLButtonElement | null = null;
  private _exitSolveBtn: HTMLButtonElement | null = null;
  private _markerBtn: HTMLButtonElement | null = null;
  private _markerDropdown: HTMLElement | null = null;
  private _markerPaletteBtns: Partial<Record<MarkerKind, HTMLButtonElement | null>> = {};
  private _markerLetterBtn: HTMLButtonElement | null = null;
  private _markerClearBtn: HTMLButtonElement | null = null;

  // ============ ボタン参照の読み取り専用ゲッター ============
  // 外部からの直接 DOM 操作を防ぐため、書き込みはメソッド経由のみとする。
  get clearBtn(): HTMLButtonElement | null { return this._clearBtn; }
  get problemBtn(): HTMLButtonElement | null { return this._problemBtn; }
  get answerBtn(): HTMLButtonElement | null { return this._answerBtn; }
  get prevMoveBtn(): HTMLButtonElement | null { return this._prevMoveBtn; }
  get nextMoveBtn(): HTMLButtonElement | null { return this._nextMoveBtn; }
  get blackBtn(): HTMLButtonElement | null { return this._blackBtn; }
  get whiteBtn(): HTMLButtonElement | null { return this._whiteBtn; }
  get eraseBtn(): HTMLButtonElement | null { return this._eraseBtn; }
  get altBtn(): HTMLButtonElement | null { return this._altBtn; }
  get undoBtn(): HTMLButtonElement | null { return this._undoBtn; }
  get exitSolveBtn(): HTMLButtonElement | null { return this._exitSolveBtn; }
  get markerBtn(): HTMLButtonElement | null { return this._markerBtn; }
  get markerDropdown(): HTMLElement | null { return this._markerDropdown; }
  get markerPaletteBtns(): Partial<Record<MarkerKind, HTMLButtonElement | null>> { return this._markerPaletteBtns; }
  get markerLetterBtn(): HTMLButtonElement | null { return this._markerLetterBtn; }
  get markerClearBtn(): HTMLButtonElement | null { return this._markerClearBtn; }

  private unsubscribeFromEventBus: (() => void) | null = null;
  private unsubscribeMarkerDocument: (() => void) | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly renderer: Renderer,
    private readonly boardCapture: BoardCaptureService,
    private readonly sgfService: SGFService,
    private readonly elements: UIElements,
    private readonly eventBus: UIEventBus,
    private readonly dropdownManager: DropdownManager
  ) {}

  bindAll(): void {
    this.store.resetInteractionModes();

    this.bindSizeButtons();
    this.bindBasicButtons();
    this.bindGameButtons();
    this.bindBoardSaveButton();
    this.bindMarkerMenu();

    this.unsubscribeFromEventBus = this.eventBus.onEraseModeDisable(() => {
      this.dispatchDisableEraseMode();
    });
  }

  dispose(): void {
    this.unsubscribeFromEventBus?.();
    this.unsubscribeFromEventBus = null;
    this.unsubscribeMarkerDocument?.();
    this.unsubscribeMarkerDocument = null;
  }

  triggerButton(selector: string): void {
    const button = document.querySelector(selector) as HTMLElement | null;
    button?.click();
  }

  ensureButtonRefs(): void {
    this._clearBtn = this._clearBtn ?? (document.getElementById('btn-clear') as HTMLButtonElement | null);
    this._problemBtn = this._problemBtn ?? (document.getElementById('btn-problem') as HTMLButtonElement | null);
    this._answerBtn = this._answerBtn ?? (document.getElementById('btn-answer') as HTMLButtonElement | null);
    this._prevMoveBtn = this._prevMoveBtn ?? (document.getElementById('btn-prev-move') as HTMLButtonElement | null);
    this._nextMoveBtn = this._nextMoveBtn ?? (document.getElementById('btn-next-move') as HTMLButtonElement | null);
    this._blackBtn = this._blackBtn ?? (document.getElementById('btn-black') as HTMLButtonElement | null);
    this._whiteBtn = this._whiteBtn ?? (document.getElementById('btn-white') as HTMLButtonElement | null);
    this._eraseBtn = this._eraseBtn ?? (document.getElementById('btn-erase') as HTMLButtonElement | null);
    this._altBtn = this._altBtn ?? (document.getElementById('btn-alt') as HTMLButtonElement | null);
    this._undoBtn = this._undoBtn ?? (document.getElementById('btn-undo') as HTMLButtonElement | null);
    this._exitSolveBtn = this._exitSolveBtn ?? (document.getElementById('btn-exit-solve-edit') as HTMLButtonElement | null);
    this._markerBtn = this._markerBtn ?? (document.getElementById('btn-marker') as HTMLButtonElement | null);
    this._markerDropdown = this._markerDropdown ?? (document.getElementById('marker-dropdown') as HTMLElement | null);
    this._markerClearBtn = this._markerClearBtn ?? (document.getElementById('btn-marker-clear') as HTMLButtonElement | null);
    this._markerLetterBtn = this._markerLetterBtn ?? (document.getElementById('btn-marker-select-LB') as HTMLButtonElement | null);
    for (const kind of MARKER_KINDS) {
      if (kind === 'LB') continue; // LB は単一の cycling ボタン
      if (this._markerPaletteBtns[kind]) continue;
      this._markerPaletteBtns[kind] = document.getElementById(`btn-marker-select-${kind}`) as HTMLButtonElement | null;
    }
  }

  private dispatchDisableEraseMode(): void {
    const state = this.store.snapshot;
    if (!state.eraseMode) {
      return;
    }
    this.store.setEraseMode(false);
    this.eraseBtn?.classList.remove('active');
    this.renderer.showMessage('');
  }

  private bindSizeButtons(): void {
    document.querySelectorAll('.size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const element = btn as HTMLElement;
        const sizeRaw = element.dataset.size;
        if (sizeRaw === undefined) return;
        const size = parseInt(sizeRaw, 10);
        if (!Number.isFinite(size)) return;
        const state = this.store.snapshot;
        if (size === state.boardSize) {
          return;
        }

        this.store.initBoard(size);
        this.eventBus.emitUIUpdate();
        this.eventBus.emitAnswerButtonUpdate();
        this.setActiveButton(element, 'size-btn');
      });
    });
  }

  private bindBasicButtons(): void {
    this._clearBtn = document.getElementById('btn-clear') as HTMLButtonElement | null;
    if (this.clearBtn) {
      this.clearBtn.title = '盤面の石と履歴をすべて消して新しい盤面にします（Undoはできません）';
    }
    this.clearBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      this.dispatchDisableEraseMode();
      this.store.resetForClearAll();
      this.eventBus.emitUIUpdate();
      this.eventBus.emitAnswerButtonUpdate();
      (document.getElementById('sgf-text') as HTMLTextAreaElement).value = '';
    });

    this._undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    if (this.undoBtn) {
      this.undoBtn.title = '編集・解答の履歴から1つ前の状態に戻ります（履歴ダイアログと同じ履歴を使用）';
    }
    this.undoBtn?.addEventListener('click', () => {
      const restored = this.store.undo();
      if (restored) {
        this.renderer.updateBoardSize();
      }
      this.eventBus.emitUIUpdate();
    });

    this._eraseBtn = document.getElementById('btn-erase') as HTMLButtonElement | null;
    if (this.eraseBtn) {
      this.eraseBtn.title = '任意の石だけを消すモードをオン／オフします（盤面の他の状態は変わりません）';
    }
    this.eraseBtn?.addEventListener('click', () => {
      const next = !this.store.snapshot.eraseMode;
      this.store.setEraseMode(next);
      if (next) {
        this.eraseBtn?.classList.add('active');
        this.renderer.showMessage('消去モード');
      } else {
        this.eraseBtn?.classList.remove('active');
        this.renderer.showMessage('');
      }
    });

    this._blackBtn = document.getElementById('btn-black') as HTMLButtonElement | null;
    this.blackBtn?.addEventListener('click', () => {
      if (this.blackBtn) this.setMode('black', this.blackBtn);
    });

    this._whiteBtn = document.getElementById('btn-white') as HTMLButtonElement | null;
    this.whiteBtn?.addEventListener('click', () => {
      if (this.whiteBtn) this.setMode('white', this.whiteBtn);
    });

    this._altBtn = document.getElementById('btn-alt') as HTMLButtonElement | null;
    if (this.altBtn) {
      this.altBtn.title = '黒白交互に石を連続配置するモードです（先手色は黒先ボタンと連動）';
    }
    this.altBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      this.store.setStartColor(state.startColor === 1 ? 2 : 1);
      if (this.altBtn) this.setMode('alt', this.altBtn);
    });
  }

  private bindGameButtons(): void {
    this._prevMoveBtn = document.getElementById('btn-prev-move') as HTMLButtonElement | null;
    if (this.prevMoveBtn) {
      this.prevMoveBtn.title = '読み上げ用の手順を1手戻ります（Undoとは別の1手戻る）';
    }
    this.prevMoveBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (state.sgfIndex > 0) {
        this.store.setMoveIndex(state.sgfIndex - 1);
        this.eventBus.emitUIUpdate();
      }
    });

    this._nextMoveBtn = document.getElementById('btn-next-move') as HTMLButtonElement | null;
    if (this.nextMoveBtn) {
      this.nextMoveBtn.title = '読み上げ用の手順を1手進めます';
    }
    this.nextMoveBtn?.addEventListener('click', () => {
      const state = this.store.snapshot;
      if (state.sgfIndex < state.sgfMoves.length) {
        this.store.setMoveIndex(state.sgfIndex + 1);
        this.eventBus.emitUIUpdate();
      }
    });

    this._answerBtn = document.getElementById('btn-answer') as HTMLButtonElement | null;
    this.answerBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        return;
      }

      if (state.answerMode === 'black') {
        this.store.setAnswerMode('white');
        this.store.setStartColor(2);
      } else {
        this.store.setAnswerMode('black');
        this.store.setStartColor(1);
      }

      this.eventBus.emitUIUpdate();
    });

    this._exitSolveBtn = document.getElementById('btn-exit-solve-edit') as HTMLButtonElement | null;
    this.exitSolveBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();

      if (!this.store.snapshot.numberMode) {
        this.store.enterSolveMode();
        this.store.setAnswerMode('black');
        this.store.setStartColor(1);
      } else {
        this.store.exitSolveModeForEditing();
      }

      this.eventBus.emitUIUpdate();
    });

    const historyBtn = document.getElementById('btn-history') as HTMLButtonElement | null;
    if (historyBtn) {
      historyBtn.title = '編集・解答の履歴一覧を開き、任意の状態にジャンプします';
    }
    historyBtn?.addEventListener('click', () => {
      const historyView = new HistoryView();
      historyView.render(
        this.store.historyManager.getList(),
        (index) => {
          if (this.store.restoreHistorySnapshot(index)) {
            this.renderer.updateBoardSize();
            this.eventBus.emitUIUpdate();
            this.renderer.showMessage('履歴を復元しました');
          }
        },
        () => this.store.historyManager.clear()
      );
    });

    this._problemBtn = document.getElementById('btn-problem') as HTMLButtonElement | null;
    this.problemBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();
      const state = this.store.snapshot;

      if (!state.numberMode) {
        this.store.setProblemDiagram();
        this.store.setAnswerMode('black');
        this.store.enterSolveMode();
        this.refreshSgfTextarea();
        this.eventBus.emitUIUpdate();
        this.renderer.showMessage('問題図を確定して解答を開始しました');
      } else {
        if (!this.store.hasProblemDiagram()) {
          this.renderer.showMessage('問題図が設定されていません');
          return;
        }

        this.store.restoreProblemDiagram();
        this.eventBus.emitUIUpdate();
        this.renderer.showMessage('問題図に戻しました');
      }
    });

    this.elements.sliderEl?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      const value = parseInt(target.value, 10);
      if (Number.isFinite(value)) {
        this.store.setMoveIndex(value);
        this.eventBus.emitUIUpdate();
      }
    });
  }

  private bindBoardSaveButton(): void {
    const saveBtn = document.getElementById('btn-save-board');
    saveBtn?.addEventListener('click', () => {
      this.boardCapture.captureBoard().catch((error) => {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`盤面保存に失敗しました: ${message}`);
      });
    });
  }

  private bindMarkerMenu(): void {
    const btn = document.getElementById('btn-marker') as HTMLButtonElement | null;
    const dropdown = document.getElementById('marker-dropdown') as HTMLElement | null;
    if (btn) {
      btn.title = 'マーカー（○△□×／ラベル）パレットを開閉します';
    }
    // トリガーボタンはパレットの開閉専用。マーカー選択状態は触らない。
    btn?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!btn || !dropdown) return;
      const isOpen = dropdown.classList.contains('show');
      if (isOpen) {
        this.dropdownManager.hide(dropdown);
      } else {
        this.dispatchDisableEraseMode();
        this.dropdownManager.open(btn, dropdown);
      }
    });
    dropdown?.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    if (btn && !this.unsubscribeMarkerDocument) {
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
      this.unsubscribeMarkerDocument = () => {
        document.removeEventListener('click', documentHandler);
      };
    }

    // ○△□× を選んだとき: パレットは閉じず、選択種別だけ切り替える
    for (const kind of ['CR', 'TR', 'SQ', 'MA'] as const) {
      const item = document.getElementById(`btn-marker-select-${kind}`) as HTMLButtonElement | null;
      item?.addEventListener('click', () => {
        this.dispatchDisableEraseMode();
        this.handlePaletteItemSelect(kind, null);
      });
    }
    // 文字マーカー: アクティブでないとき A から開始。アクティブのとき再クリックで OFF。
    // 配置時の自動進行は GameStore.addMarkerAt で行う。
    const letterBtn = document.getElementById('btn-marker-select-LB') as HTMLButtonElement | null;
    letterBtn?.addEventListener('click', () => {
      this.dispatchDisableEraseMode();
      const state = this.store.snapshot;
      if (state.markerMode && state.activeMarkerKind === 'LB') {
        // 同じものを再クリック → トグル OFF
        this.store.setMarkerMode(null);
      } else {
        // 現在の activeMarkerLabel から開始（未設定なら A）
        const startLabel = state.activeMarkerLabel ?? MARKER_LETTER_SEQUENCE[0];
        this.store.setMarkerMode('LB', startLabel);
      }
      this.setActiveMarkerButton();
      this.eventBus.emitUIUpdate();
    });
    const clearBtn = document.getElementById('btn-marker-clear') as HTMLButtonElement | null;
    clearBtn?.addEventListener('click', () => {
      this.store.clearMarkers();
      this.eventBus.emitUIUpdate();
    });
    const closeBtn = document.getElementById('btn-marker-close') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => {
      // パレットを閉じると同時にマーカーモードも解除 → 黒配置/自由配置に戻れる
      this.store.setMarkerMode(null);
      this.dropdownManager.hide(dropdown);
      this.setActiveMarkerButton();
      this.eventBus.emitUIUpdate();
    });
  }

  private handlePaletteItemSelect(kind: MarkerKind, label: string | null): void {
    const state = this.store.snapshot;
    // 同じものを再クリック → トグル OFF
    if (state.markerMode && state.activeMarkerKind === kind && state.activeMarkerLabel === label) {
      this.store.setMarkerMode(null);
    } else {
      this.store.setMarkerMode(kind, label);
    }
    this.setActiveMarkerButton();
    this.eventBus.emitUIUpdate();
  }

  public setActiveMarkerButton(): void {
    this.ensureButtonRefs();
    const state = this.store.snapshot;
    const active = state.activeMarkerKind;
    const activeLabel = state.activeMarkerLabel;
    if (this.markerBtn) {
      this.markerBtn.classList.toggle('active', active !== null);
      let label = '🔘 マーカー';
      if (active) {
        if (active === 'LB' && activeLabel) {
          label = `🔘 マーカー (${activeLabel})`;
        } else {
          label = `🔘 マーカー (${MARKER_GLYPHS[active]})`;
        }
      }
      if (this.markerBtn.textContent !== label) {
        this.markerBtn.textContent = label;
      }
    }
    for (const kind of ['CR', 'TR', 'SQ', 'MA'] as const) {
      const btn = this.markerPaletteBtns[kind];
      if (!btn) continue;
      btn.classList.toggle('active', active === kind);
    }
    if (this.markerLetterBtn) {
      this.markerLetterBtn.classList.toggle('active', active === 'LB');
    }
  }

  /**
   * 盤面クリック時など、外部要因でマーカーパレットを閉じたいときに呼ぶ。
   * マーカー選択状態（markerMode）は維持したまま、パレットだけを閉じる。
   */
  public closeMarkerPalette(): void {
    this.ensureButtonRefs();
    if (this.markerDropdown && this.markerDropdown.classList.contains('show')) {
      this.dropdownManager.hide(this.markerDropdown);
    }
  }

  private setMode(mode: PlayMode, buttonElement: Element): void {
    this.dispatchDisableEraseMode();
    this.store.setMode(mode);

    this.setActiveButton(buttonElement, 'play-btn');

    this.eventBus.emitUIUpdate();
  }

  private refreshSgfTextarea(): void {
    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement | null;
    if (sgfTextarea) {
      sgfTextarea.value = this.sgfService.export();
    }
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document
      .querySelectorAll(`.${groupClass}`)
      .forEach((btn) => btn.classList.remove('active'));
    element.classList.add('active');
  }
}
