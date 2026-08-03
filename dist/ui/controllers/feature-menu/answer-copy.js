import { copyToClipboard } from '../../../utils/clipboard.js';
export class AnswerCopy {
    constructor(store, renderer, sgfService) {
        this.store = store;
        this.renderer = renderer;
        this.sgfService = sgfService;
    }
    /** 解答ボタンを活性化する条件: 解答モード && 着手あり */
    shouldEnable(state = this.store.snapshot) {
        var _a, _b;
        return state.numberMode === true && ((_a = state.sgfIndex) !== null && _a !== void 0 ? _a : 0) > ((_b = state.numberStartIndex) !== null && _b !== void 0 ? _b : 0);
    }
    /** 解答シーケンスをコピーする。戻り値は成功/失敗 */
    async copy() {
        const state = this.store.snapshot;
        if (!state.numberMode) {
            this.renderer.showMessage('解答モード中のみ使用できます');
            return false;
        }
        const sequence = this.sgfService.buildAnswerSequence(state);
        if (!sequence) {
            this.renderer.showMessage('解答手順がありません');
            return false;
        }
        const spoilerText = `||${sequence}||`;
        try {
            await copyToClipboard(spoilerText);
            this.renderer.showMessage('解答手順をクリップボードにコピーしました');
            return true;
        }
        catch (error) {
            // 失敗時は SGF テキスト欄にフォールバック
        }
        const sgfTextarea = document.getElementById('sgf-text');
        if (sgfTextarea) {
            sgfTextarea.value = spoilerText;
        }
        this.renderer.showMessage('解答手順をクリップボードにコピーできなかったため、SGFテキスト欄に出力しました');
        return false;
    }
}
//# sourceMappingURL=answer-copy.js.map