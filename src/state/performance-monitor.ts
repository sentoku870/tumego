// ============ パフォーマンス計測 ============
// BoardCacheManager.rebuildBoardFromMoves のプロファイリングを集約する。
// 計測が不要なときはクロージャで no-op 化することで、呼び出し側のオーバーヘッドを抑える。

export interface RebuildMetrics {
  callCount: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastLimit: number;
  lastAppliedMoves: number;
}

export interface PerformanceMetrics {
  rebuildBoardFromMoves: RebuildMetrics;
}

export class PerformanceMonitor {
  private enabled = false;
  private metrics: PerformanceMetrics;

  constructor() {
    this.metrics = {
      rebuildBoardFromMoves: this.createRebuildMetrics(),
    };
  }

  setEnabled(enabled: boolean, reset = true): void {
    this.enabled = enabled;
    if (reset) {
      this.reset();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  reset(): void {
    this.metrics.rebuildBoardFromMoves = this.createRebuildMetrics();
  }

  getMetrics(): PerformanceMetrics {
    return {
      rebuildBoardFromMoves: {
        ...this.metrics.rebuildBoardFromMoves,
      },
    };
  }

  /**
   * rebuildBoardFromMoves の計測を開始する。
   * 戻り値のクロージャで計測を確定する。無効時は no-op を返す。
   */
  startRebuildProfiling(limit: number): (newlyApplied: number) => void {
    if (!this.enabled) {
      return () => {};
    }
    const startTime = this.getTimestamp();
    const metrics = this.metrics.rebuildBoardFromMoves;
    metrics.callCount++;
    metrics.lastLimit = limit;
    return (newlyApplied: number) => {
      const duration = this.getTimestamp() - startTime;
      metrics.totalDurationMs += duration;
      metrics.lastDurationMs = duration;
      metrics.lastAppliedMoves = newlyApplied;
    };
  }

  private createRebuildMetrics(): RebuildMetrics {
    return {
      callCount: 0,
      totalDurationMs: 0,
      lastDurationMs: 0,
      lastLimit: 0,
      lastAppliedMoves: 0,
    };
  }

  private getTimestamp(): number {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      return performance.now();
    }
    return Date.now();
  }
}
