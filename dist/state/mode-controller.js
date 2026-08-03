export class ModeController {
    constructor(state) {
        this.state = state;
    }
    /** 配置モード (black/white/alt) を切り替える */
    setMode(mode) {
        this.state.mode = mode;
    }
    /** 消去モードをオン／オフする */
    setEraseMode(enabled) {
        this.state.eraseMode = enabled;
    }
    /** 先手色 (黒/白) を切り替える */
    setStartColor(color) {
        this.state.startColor = color;
    }
    /** 解答モードでの先手色 (黒先/白先) を切り替える */
    setAnswerMode(mode) {
        this.state.answerMode = mode;
    }
    /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
    resetInteractionModes() {
        this.state.mode = 'alt';
        this.state.numberMode = false;
        this.state.eraseMode = false;
    }
    /** 現在の着手色を計算する */
    get currentColor() {
        if (this.state.numberMode) {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        if (this.state.mode === 'alt') {
            return this.state.turn % 2 === 0
                ? this.state.startColor
                : (3 - this.state.startColor);
        }
        return this.state.mode === 'black' ? 1 : 2;
    }
}
//# sourceMappingURL=mode-controller.js.map