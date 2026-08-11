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

export interface LongPressDetectorOptions {
  /** 長押し成立までの時間（ms）。既定 400ms。 */
  thresholdMs?: number;
  /** 長押しとみなす最大移動量（px）。既定 10px。 */
  moveThresholdPx?: number;
  /** タイマー実装（テスト時に差し替え可能） */
  setTimeoutFn?: (handler: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export class LongPressDetector {
  private thresholdMs: number;
  private readonly moveThresholdPx: number;
  private readonly setTimeoutFn: (handler: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;

  private timerHandle: unknown = null;
  private startX = 0;
  private startY = 0;
  private triggerCallback: (() => void) | null = null;

  constructor(options: LongPressDetectorOptions = {}) {
    this.thresholdMs = options.thresholdMs ?? 400;
    this.moveThresholdPx = options.moveThresholdPx ?? 10;
    this.setTimeoutFn = options.setTimeoutFn ?? ((h, ms) => setTimeout(h, ms));
    this.clearTimeoutFn =
      options.clearTimeoutFn ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /**
   * 長押し検出を開始する。閾値到達時に onTrigger を発火する。
   * 既にタイマーが動作している場合は一旦キャンセルして再開する。
   */
  start(event: { clientX: number; clientY: number }, onTrigger: () => void): void {
    this.cancel();
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.triggerCallback = onTrigger;
    this.timerHandle = this.setTimeoutFn(() => {
      this.timerHandle = null;
      const cb = this.triggerCallback;
      this.triggerCallback = null;
      cb?.();
    }, this.thresholdMs);
  }

  /** タイマーを破棄して検出をキャンセルする（後始末用） */
  cancel(): void {
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
  isWithinThreshold(event: { clientX: number; clientY: number }): boolean {
    if (this.timerHandle === null) return true;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    return Math.hypot(dx, dy) < this.moveThresholdPx;
  }

  /** タイマーが動作中（閾値到達前）かどうか */
  isActive(): boolean {
    return this.timerHandle !== null;
  }

  /** テスト用: 現在の閾値設定（ms）を取得 */
  getThresholdMs(): number {
    return this.thresholdMs;
  }

  /**
   * 閾値を動的に更新する。既にタイマーが走っている場合は次の start() から
   * 新しい閾値が適用される（実行中タイマーはそのまま）。
   */
  setThresholdMs(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.thresholdMs = ms;
  }

  /** テスト用: 現在の移動量しきい値（px）を取得 */
  getMoveThresholdPx(): number {
    return this.moveThresholdPx;
  }
}
