import { DropdownManager } from './dropdown-manager.js';
import { SGFService } from '../../services/sgf-service.js';
import { Renderer } from '../../renderer.js';
import { QRManager } from '../../qr-manager.js';
import { UIUpdater } from './feature-menu-controller.js';
import { GameInfo, SGFParseResult } from '../../types.js';
import { GameStore } from '../../state/game-store.js';

export type SgfApplyCallback = (sgfText: string) => void;
export type AnswerButtonUpdater = () => void;

export class FileMenuController {
  constructor(
    private readonly dropdownManager: DropdownManager,
    private readonly sgfService: SGFService,
    private readonly renderer: Renderer,
    private readonly qrManager: QRManager,
    private readonly updateUI: UIUpdater,
    private readonly onSgfApplied: SgfApplyCallback,
    private readonly updateAnswerButtonDisplay: AnswerButtonUpdater,
    private readonly store: GameStore
  ) {}

  syncHeaderEditor(): void {
    this.populateHeaderFields();
  }

  initialize(): void {
    const fileBtn = document.getElementById('btn-file') as HTMLButtonElement | null;
    const fileDropdown = document.getElementById('file-dropdown') as HTMLElement | null;
    const fileSelectBtn = document.getElementById('btn-file-select');
    const fileLoadBtn = document.getElementById('btn-file-load');
    const fileCopyBtn = document.getElementById('btn-file-copy');
    const fileSaveBtn = document.getElementById('btn-file-save');
    const fileQRBtn = document.getElementById('btn-file-qr');
    const fileDiscordBtn = document.getElementById('btn-file-discord');
    const sgfInput = document.getElementById('sgf-input') as HTMLInputElement | null;
    const headerTitleInput = document.getElementById('header-title') as HTMLInputElement | null;
    const headerBlackInput = document.getElementById('header-black') as HTMLInputElement | null;
    const headerWhiteInput = document.getElementById('header-white') as HTMLInputElement | null;
    const headerKomiInput = document.getElementById('header-komi') as HTMLInputElement | null;
    const headerResultInput = document.getElementById('header-result') as HTMLInputElement | null;
    const headerApplyBtn = document.getElementById('btn-header-apply') as HTMLButtonElement | null;
    const headerResetBtn = document.getElementById('btn-header-reset') as HTMLButtonElement | null;

    fileBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const featureDropdown = document.getElementById('feature-dropdown') as HTMLElement | null;
      const isOpen = fileDropdown?.classList.contains('show');
      this.dropdownManager.hide(featureDropdown);
      this.populateHeaderFields();
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

    headerApplyBtn?.addEventListener('click', () => {
      const patch: Partial<GameInfo> = {
        title: headerTitleInput?.value.trim() ?? '',
        playerBlack: headerBlackInput?.value.trim() || null,
        playerWhite: headerWhiteInput?.value.trim() || null,
        result: headerResultInput?.value.trim() || null,
      };

      const komiRaw = headerKomiInput?.value.trim();
      if (komiRaw) {
        const parsed = parseFloat(komiRaw);
        if (!Number.isNaN(parsed)) {
          patch.komi = parsed;
        }
      }

      this.store.updateGameInfo(patch);
      this.updateUI();
      this.renderer.showMessage('対局情報を更新しました');
      this.populateHeaderFields();
    });

    headerResetBtn?.addEventListener('click', () => {
      this.populateHeaderFields();
    });

    this.populateHeaderFields();
  }

  private applySgf(result: SGFParseResult): void {
    const applyResult = this.sgfService.apply(result);
    this.renderer.updateBoardSize();
    this.updateUI();
    this.populateHeaderFields();
    this.onSgfApplied(applyResult.sgfText);
    this.updateAnswerButtonDisplay();
  }

  private populateHeaderFields(): void {
    const headerTitleInput = document.getElementById('header-title') as HTMLInputElement | null;
    const headerBlackInput = document.getElementById('header-black') as HTMLInputElement | null;
    const headerWhiteInput = document.getElementById('header-white') as HTMLInputElement | null;
    const headerKomiInput = document.getElementById('header-komi') as HTMLInputElement | null;
    const headerResultInput = document.getElementById('header-result') as HTMLInputElement | null;

    if (!headerTitleInput || !headerBlackInput || !headerWhiteInput || !headerKomiInput || !headerResultInput) {
      return;
    }

    const info = this.store.getGameInfo();
    headerTitleInput.value = info.title ?? '';
    headerBlackInput.value = info.playerBlack ?? '';
    headerWhiteInput.value = info.playerWhite ?? '';
    headerKomiInput.value = info.komi !== null && info.komi !== undefined ? String(info.komi) : '';
    headerResultInput.value = info.result ?? '';
  }
}
