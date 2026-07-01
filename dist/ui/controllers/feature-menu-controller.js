import { Modal } from '../views/modal.js';
import { copyToClipboard } from '../../utils/clipboard.js';
export class FeatureMenuController {
    constructor(dropdownManager, renderer, elements, store, sgfService, eventBus) {
        this.dropdownManager = dropdownManager;
        this.renderer = renderer;
        this.elements = elements;
        this.store = store;
        this.sgfService = sgfService;
        this.eventBus = eventBus;
        this.isHorizontal = document.body.classList.contains('horizontal');
        this.copyAnswerButton = null;
        this.currentHandicapModal = null;
    }
    initialize() {
        var _a;
        const featureBtn = document.getElementById('btn-feature');
        const featureDropdown = document.getElementById('feature-dropdown');
        const featureLayoutBtn = document.getElementById('btn-feature-layout');
        const featureRotateBtn = document.getElementById('btn-feature-rotate');
        const featureHandicapBtn = document.getElementById('btn-feature-handicap');
        this.copyAnswerButton = document.getElementById('feature-copy-answer-sequence');
        if (featureLayoutBtn) {
            featureLayoutBtn.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
        }
        featureBtn === null || featureBtn === void 0 ? void 0 : featureBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileDropdown = document.getElementById('file-dropdown');
            const isOpen = featureDropdown === null || featureDropdown === void 0 ? void 0 : featureDropdown.classList.contains('show');
            this.dropdownManager.hide(fileDropdown);
            if (featureDropdown && featureBtn) {
                if (isOpen) {
                    this.dropdownManager.hide(featureDropdown);
                }
                else {
                    this.dropdownManager.open(featureBtn, featureDropdown);
                }
            }
        });
        document.addEventListener('click', () => {
            this.dropdownManager.hide(featureDropdown);
        });
        featureDropdown === null || featureDropdown === void 0 ? void 0 : featureDropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        featureLayoutBtn === null || featureLayoutBtn === void 0 ? void 0 : featureLayoutBtn.addEventListener('click', () => {
            this.toggleLayout(featureLayoutBtn, featureDropdown);
        });
        featureRotateBtn === null || featureRotateBtn === void 0 ? void 0 : featureRotateBtn.addEventListener('click', () => {
            this.rotateBoard();
            this.dropdownManager.hide(featureDropdown);
        });
        featureHandicapBtn === null || featureHandicapBtn === void 0 ? void 0 : featureHandicapBtn.addEventListener('click', () => {
            this.dropdownManager.hide(featureDropdown);
            this.showHandicapDialog();
        });
        (_a = this.copyAnswerButton) === null || _a === void 0 ? void 0 : _a.addEventListener('click', async () => {
            const state = this.store.snapshot;
            if (!state.numberMode) {
                this.renderer.showMessage('解答モード中のみ使用できます');
                return;
            }
            const sequence = this.sgfService.buildAnswerSequence(state);
            if (!sequence) {
                this.renderer.showMessage('解答手順がありません');
                return;
            }
            const spoilerText = `||${sequence}||`;
            try {
                await copyToClipboard(spoilerText);
                this.renderer.showMessage('解答手順をクリップボードにコピーしました');
                return;
            }
            catch (error) {
                // 失敗時は SGF テキスト欄にフォールバック
            }
            const sgfTextarea = document.getElementById('sgf-text');
            if (sgfTextarea) {
                sgfTextarea.value = spoilerText;
            }
            this.renderer.showMessage('解答手順をクリップボードにコピーできなかったため、SGFテキスト欄に出力しました');
        });
    }
    updateMenuState() {
        var _a, _b;
        const state = this.store.snapshot;
        const hasAnswerMoves = state.numberMode === true && ((_a = state.sgfIndex) !== null && _a !== void 0 ? _a : 0) > ((_b = state.numberStartIndex) !== null && _b !== void 0 ? _b : 0);
        this.setButtonEnabled(this.copyAnswerButton, hasAnswerMoves);
    }
    setButtonEnabled(button, enabled) {
        if (!button)
            return;
        button.disabled = !enabled;
        button.classList.toggle('disabled', !enabled);
    }
    toggleLayout(button, dropdown) {
        this.isHorizontal = !this.isHorizontal;
        document.body.classList.toggle('horizontal', this.isHorizontal);
        button.textContent = this.isHorizontal ? '縦レイアウト' : '横レイアウト';
        this.dropdownManager.hide(dropdown);
        this.renderer.updateBoardSize();
    }
    rotateBoard() {
        const svg = this.elements.svg;
        const isRotated = svg.classList.contains('rotated');
        if (isRotated) {
            svg.classList.remove('rotated');
            this.renderer.showMessage('盤面を元に戻しました');
        }
        else {
            svg.classList.add('rotated');
            this.renderer.showMessage('盤面を180度回転しました');
        }
    }
    showHandicapDialog() {
        var _a, _b;
        (_a = this.currentHandicapModal) === null || _a === void 0 ? void 0 : _a.close();
        this.currentHandicapModal = null;
        const root = document.createElement('div');
        root.innerHTML = `
      <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
      <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
      <div id="handicap-options" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;"></div>
      <button id="handicap-cancel" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
    `;
        const options = [
            { label: '互先（コミあり）', value: 'even' },
            { label: '先（コミなし）', value: 0 },
            { label: '2子', value: 2 },
            { label: '3子', value: 3 },
            { label: '4子', value: 4 },
            { label: '5子', value: 5 },
            { label: '6子', value: 6 },
            { label: '7子', value: 7 },
            { label: '8子', value: 8 },
            { label: '9子', value: 9 }
        ];
        const optionContainer = root.querySelector('#handicap-options');
        options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option.label;
            button.style.padding = '15px';
            button.style.background = option.value === 'even' ? '#2196F3' : option.value === 0 ? '#4CAF50' : '#FF9800';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '8px';
            button.style.cursor = 'pointer';
            button.style.fontSize = '14px';
            button.addEventListener('click', () => {
                var _a;
                this.setHandicap(option.value);
                (_a = this.currentHandicapModal) === null || _a === void 0 ? void 0 : _a.close();
                this.currentHandicapModal = null;
            });
            optionContainer === null || optionContainer === void 0 ? void 0 : optionContainer.appendChild(button);
        });
        (_b = root.querySelector('#handicap-cancel')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a;
            (_a = this.currentHandicapModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentHandicapModal = null;
        });
        this.currentHandicapModal = new Modal({
            id: 'handicap-popup',
            content: root,
            overlayOpacity: 0.8,
            maxWidth: '500px',
        });
        this.currentHandicapModal.open();
    }
    setHandicap(stones) {
        this.store.setHandicap(stones);
        this.eventBus.emitUIUpdate();
        if (stones === 'even') {
            this.renderer.showMessage('互先（黒番開始、コミ6.5目）に設定しました');
        }
        else if (stones === 0) {
            this.renderer.showMessage('先番（黒番開始、コミ0目）に設定しました');
        }
        else {
            this.renderer.showMessage(`${stones}子局（白番開始、コミ0目）に設定しました`);
        }
    }
}
//# sourceMappingURL=feature-menu-controller.js.map