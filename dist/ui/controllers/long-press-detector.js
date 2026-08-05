// ============ LongPressDetector ============
// ポインタの長押し検出を行うユーティリティ。
// タイマー管理 + 移動量しきい値判定を担当し、純粋な状態機械として
// テスタビリティを担保する。
//
// 設計:
// - start(): ポインタ押下時に呼び出し、閾値 ms 経過後に onTrigger を発火。
// - cancel(): ポインタ解放 / 閾値超過 / モード変化時にタイマーを破棄。
// - isWithinThreshold(event): 移動量が MOVE_THRESHOLD_PX 未満か判定。
// - isActive(): タイマーが稼働中かどうか。
//
// 依存:
// - window.setTimeout / clearTimeout のみ（DOM イベントには直接依存しない）。
//   BoardInteractionController から呼ばれて、ポインタイベントに紐付けて使う。
export class LongPressDetector {
    constructor(options = {}) {
        var _a, _b, _c, _d;
        this.timerHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.triggerCallback = null;
        this.thresholdMs = (_a = options.thresholdMs) !== null && _a !== void 0 ? _a : 400;
        this.moveThresholdPx = (_b = options.moveThresholdPx) !== null && _b !== void 0 ? _b : 10;
        this.setTimeoutFn = (_c = options.setTimeoutFn) !== null && _c !== void 0 ? _c : ((h, ms) => setTimeout(h, ms));
        this.clearTimeoutFn =
            (_d = options.clearTimeoutFn) !== null && _d !== void 0 ? _d : ((h) => clearTimeout(h));
    }
    /**
     * 長押し検出を開始する。閾値到達時に onTrigger を発火する。
     * 既にタイマーが動作している場合は一旦キャンセルして再開する。
     */
    start(event, onTrigger) {
        this.cancel();
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.triggerCallback = onTrigger;
        this.timerHandle = this.setTimeoutFn(() => {
            this.timerHandle = null;
            const cb = this.triggerCallback;
            this.triggerCallback = null;
            cb === null || cb === void 0 ? void 0 : cb();
        }, this.thresholdMs);
    }
    /** タイマーを破棄して検出をキャンセルする（後始末用） */
    cancel() {
        if (this.timerHandle !== null) {
            this.clearTimeoutFn(this.timerHandle);
            this.timerHandle = null;
        }
        this.triggerCallback = null;
    }
    /**
     * 指定座標が押下開始点から移動量しきい値未満かどうかを返す。
     * タイマーが非アクティブのときは true（=判定しない）。
     */
    isWithinThreshold(event) {
        if (this.timerHandle === null)
            return true;
        const dx = event.clientX - this.startX;
        const dy = event.clientY - this.startY;
        return Math.hypot(dx, dy) < this.moveThresholdPx;
    }
    /** タイマーが動作中（閾値到達前）かどうか */
    isActive() {
        return this.timerHandle !== null;
    }
    /** テスト用: 現在の閾値設定（ms）を取得 */
    getThresholdMs() {
        return this.thresholdMs;
    }
    /** テスト用: 現在の移動量しきい値（px）を取得 */
    getMoveThresholdPx() {
        return this.moveThresholdPx;
    }
}
//# sourceMappingURL=long-press-detector.js.map