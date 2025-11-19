import { DropdownManager } from './dropdown-manager.js';
import { SGFService } from '../../services/sgf-service.js';
import { Renderer } from '../../renderer.js';
import { QRManager } from '../../qr-manager.js';
import { UIUpdater } from './feature-menu-controller.js';
import { SGFParseResult, AppMode } from '../../types.js';

export type SgfApplyCallback = (sgfText: string) => void;
export type AnswerButtonUpdater = () => void;

export class FileMenuController {
  private fileDropdown: HTMLElement | null = null;
  private fileCopyBtn: HTMLButtonElement | null = null;
  private fileSaveBtn: HTMLButtonElement | null = null;

  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly sgfService: SGFService,
    private readonly renderer: Renderer,
    private readonly qrManager: QRManager,
    private readonly updateUI: UIUpdater,
    private readonly onSgfApplied: SgfApplyCallback,
    private readonly updateAnswerButtonDisplay: AnswerButtonUpdater
  ) {}

  initialize(): void {
    const fileBtn = document.getElementById('btn-file') as HTMLButtonElement | null;
    const fileDropdown = document.getElementById('file-dropdown') as HTMLElement | null;
    const fileSelectBtn = document.getElementById('btn-file-select');
    const fileLoadBtn = document.getElementById('btn-file-load');
    const fileCopyBtn = document.getElementById('btn-file-copy') as HTMLButtonElement | null;
    const fileSaveBtn = document.getElementById('btn-file-save') as HTMLButtonElement | null;
    const fileQRBtn = document.getElementById('btn-file-qr');
    const fileDiscordBtn = document.getElementById('btn-file-discord');
    const sgfInput = document.getElementById('sgf-input') as HTMLInputElement | null;

    this.fileDropdown = fileDropdown;
    this.fileCopyBtn = fileCopyBtn;
    this.fileSaveBtn = fileSaveBtn;

    fileBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
      const isOpen = fileDropdown?.classList.contains('show');
      this.dropdownManager.hide(featureDropdown);
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

    fileSaveBtn?.addEventListener('click', async () => {
      this.dropdownManager.hide(fileDropdown);
      if (this.sgfService.state.appMode === 'review') {
        this.renderer.showMessage('検討モードでは SGF を保存できません');
        return;
      }

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
  }

  updateModeDependentUI(mode: AppMode): void {
    if (!this.fileSaveBtn) {
      return;
    }

    const disabled = mode === 'review';
    this.fileSaveBtn.disabled = disabled;
    this.fileSaveBtn.classList.toggle('disabled', disabled);
    this.fileSaveBtn.setAttribute('aria-disabled', String(disabled));
  }

private applySgf(result: SGFParseResult): void {
  const applyResult = this.sgfService.apply(result);
  this.renderer.updateBoardSize();
  this.updateUI();
  this.onSgfApplied(applyResult.sgfText);
  this.updateAnswerButtonDisplay();

  // ===== SGF対局情報のUI表示処理 =====
  const info = result.gameInfo;
  const metaBox = document.getElementById("sgf-meta");

  if (metaBox) {
    metaBox.innerHTML = `
      黒番: ${info.blackName ?? '-'}　
      白番: ${info.whiteName ?? '-'}　
      結果: ${info.result ?? '-'}<br>
      コミ: ${info.komi ?? '-'}　
      置石: ${info.handicapStones ?? '-'}　
      日時: ${info.date ?? '-'}
    `;
  }
}
}