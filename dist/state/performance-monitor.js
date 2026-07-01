// ============ パフォーマンス計測 ============
// BoardCacheManager.rebuildBoardFromMoves のプロファイリングを集約する。
// 計測が不要なときはクロージャで no-op 化することで、呼び出し側のオーバーヘッドを抑える。
export class PerformanceMonitor {
    constructor() {
        this.enabled = false;
        this.metrics = {
            rebuildBoardFromMoves: this.createRebuildMetrics(),
        };
    }
    setEnabled(enabled, reset = true) {
        this.enabled = enabled;
        if (reset) {
            this.reset();
        }
    }
    isEnabled() {
        return this.enabled;
    }
    reset() {
        this.metrics.rebuildBoardFromMoves = this.createRebuildMetrics();
    }
    getMetrics() {
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
    startRebuildProfiling(limit) {
        if (!this.enabled) {
            return () => { };
        }
        const startTime = this.getTimestamp();
        const metrics = this.metrics.rebuildBoardFromMoves;
        metrics.callCount++;
        metrics.lastLimit = limit;
        return (newlyApplied) => {
            const duration = this.getTimestamp() - startTime;
            metrics.totalDurationMs += duration;
            metrics.lastDurationMs = duration;
            metrics.lastAppliedMoves = newlyApplied;
        };
    }
    createRebuildMetrics() {
        return {
            callCount: 0,
            totalDurationMs: 0,
            lastDurationMs: 0,
            lastLimit: 0,
            lastAppliedMoves: 0,
        };
    }
    getTimestamp() {
        if (typeof performance !== "undefined" &&
            typeof performance.now === "function") {
            return performance.now();
        }
        return Date.now();
    }
}
//# sourceMappingURL=performance-monitor.js.map