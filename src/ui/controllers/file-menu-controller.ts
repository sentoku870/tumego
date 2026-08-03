// ============ FileMenuController (Facade) ============
// ファイルメニュー (SGF 読み込み/書き出し/QR/Discord 共有) の
// イベントバインドとフロー制御を担当する。
// ヘッダー編集は HeaderEditor に分離。
import { DropdownManager } from './dropdown-manager.js';
import { SGFService } from '../../services/sgf-service.js';
import { Renderer } from '../../renderer/renderer.js';
import { QRManager } from '../../qr-manager.js';
import { SGFParseResult } from '../../types.js';
import { GameStore } from '../../state/game-store.js';
import { UIEventBus } from '../../app/event-bus.js';
import { HeaderEditor } from './file-menu/header-editor.js';

export type SgfApplyCallback = (sgfText: string) => void;
export type AnswerButtonUpdater = () => void;

export class FileMenuController {
  private readonly headerEditor: HeaderEditor;

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly sgfService: SGFService,
    private readonly renderer: Renderer,
    private readonly qrManager: QRManager,
    private readonly store: GameStore,
    private readonly eventBus: UIEventBus
  ) {
    this.headerEditor = new HeaderEditor(store, renderer, eventBus);
  }

  syncHeaderEditor(): void {
    this.headerEditor.populateFields();
  }

  initialize(): void {
    const fileBtn = document.getElementById('btn-file') as HTMLButtonElement | null;
    const fileDropdown = document.getElementById('file-dropdown') as HTMLElement | null;
    const fileSelectBtn = document.getElementById('btn-file-select');
    const fileLoadBtn = document.getElementById('btn-file-load');
    const fileCopyBtn = document.getElementById('btn-file-copy');
    const fileFinalizeBtn = document.getElementById('btn-file-finalize');
    const fileSaveBtn = document.getElementById('btn-file-save');
    const fileQRBtn = document.getElementById('btn-file-qr');
    const fileDiscordBtn = document.getElementById('btn-file-discord');
    const sgfInput = document.getElementById('sgf-input') as HTMLInputElement | null;

    fileBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
      const isOpen = fileDropdown?.classList.contains('show');
      this.dropdownManager.hide(featureDropdown);
      this.headerEditor.populateFields();
      if (fileDropdown && fileBtn) {
        if (isOpen) {
          this.dropdownManager.hide(fileDropdown);
        } else {
          this.dropdownManager.open(fileBtn, fileDropdown);
        }
      }
    });

    document.addEventListener('click', () => {
      this.dropdownManager.hide(fileDropdown);
    });

    fileDropdown?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    fileSelectBtn?.addEventListener('click', () => {
      sgfInput?.click();
      this.dropdownManager.hide(fileDropdown);
    });

    sgfInput?.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const result = await this.sgfService.loadFromFile(file);
        this.applySgf(result);
        this.renderer.showMessage(`SGF読み込み完了 (${result.moves.length}手)`);
      } catch (error) {
        console.error('SGF読み込み失敗', error);
        this.renderer.showMessage('SGF読み込みに失敗しました');
      }
    });

    fileLoadBtn?.addEventListener('click', async () => {
      this.dropdownManager.hide(fileDropdown);
      try {
        const result = await this.sgfService.loadFromClipboard();
        this.applySgf(result);
        this.renderer.showMessage(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
      } catch (error) {
        const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
        if (sgfTextarea?.value.trim()) {
          try {
            const parsed = this.sgfService.parse(sgfTextarea.value.trim());
            this.applySgf(parsed);
            this.renderer.showMessage('テキストエリアからSGF読み込み完了');
          } catch (parseError) {
            console.error('SGF文字列解析失敗', parseError);
            this.renderer.showMessage('SGF読み込みに失敗しました');
          }
        } else {
          this.renderer.showMessage('クリップボードまたはテキストエリアにSGFがありません');
        }
      }
    });

    fileCopyBtn?.addEventListener('click', async () => {
      this.dropdownManager.hide(fileDropdown);
      const sgfData = this.sgfService.export();
      const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
      if (sgfTextarea) {
        sgfTextarea.value = sgfData;
      }

      try {
        await this.sgfService.copyToClipboard(sgfData);
        this.renderer.showMessage('SGF をコピーしました');
      } catch (error) {
        this.renderer.showMessage('SGF をテキストエリアに表示しました');
      }
    });

    fileFinalizeBtn?.addEventListener('click', () => {
      this.dropdownManager.hide(fileDropdown);
      if (!this.store.snapshot.numberMode) {
        this.renderer.showMessage('解答モード中のみ確定できます');
        return;
      }
      try {
        const applyResult = this.sgfService.applyGeneratedSgf();
        this.renderer.updateBoardSize();
        const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
        if (sgfTextarea) {
          sgfTextarea.value = applyResult.sgfText;
        }
        this.eventBus.emitUIUpdate();
        this.headerEditor.populateFields();
        this.eventBus.emitSgfApplied(applyResult.sgfText);
        this.eventBus.emitAnswerButtonUpdate();
        this.renderer.showMessage('SGF を確定しました（編集モードへ移行）');
      } catch (error) {
        console.error('SGF確定失敗', error);
        this.renderer.showMessage('SGF確定に失敗しました');
      }
    });

    fileSaveBtn?.addEventListener('click', async () => {
      this.dropdownManager.hide(fileDropdown);
      const sgfData = this.sgfService.export();

      try {
        await this.sgfService.saveToFile(sgfData);
        this.renderer.showMessage('SGFファイルを保存しました');
      } catch (error) {
        console.error('SGF保存失敗', error);
        this.renderer.showMessage('SGFファイルの保存に失敗しました');
      }
    });

    fileQRBtn?.addEventListener('click', () => {
      this.dropdownManager.hide(fileDropdown);
      this.qrManager.createSGFQRCode(this.sgfService.state);
    });

    fileDiscordBtn?.addEventListener('click', () => {
      this.dropdownManager.hide(fileDropdown);
      this.qrManager.createDiscordShareLink(this.sgfService.state);
    });

    this.headerEditor.bindEvents();
    this.headerEditor.populateFields();
  }

  private applySgf(result: SGFParseResult): void {
    const applyResult = this.sgfService.apply(result);
    this.renderer.updateBoardSize();
    this.eventBus.emitUIUpdate();
    this.headerEditor.populateFields();
    this.eventBus.emitSgfApplied(applyResult.sgfText);
    this.eventBus.emitAnswerButtonUpdate();
  }
}
