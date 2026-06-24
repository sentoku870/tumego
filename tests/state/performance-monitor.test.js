import { PerformanceMonitor } from '../../dist/state/performance-monitor.js';

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('default state', () => {
    test('starts disabled', () => {
      expect(monitor.isEnabled()).toBe(false);
    });

    test('all metrics are zero', () => {
      const m = monitor.getMetrics();
      expect(m.rebuildBoardFromMoves.callCount).toBe(0);
      expect(m.rebuildBoardFromMoves.totalDurationMs).toBe(0);
      expect(m.rebuildBoardFromMoves.lastDurationMs).toBe(0);
      expect(m.rebuildBoardFromMoves.lastLimit).toBe(0);
      expect(m.rebuildBoardFromMoves.lastAppliedMoves).toBe(0);
    });
  });

  describe('setEnabled', () => {
    test('enables and disables', () => {
      monitor.setEnabled(true, false);
      expect(monitor.isEnabled()).toBe(true);

      monitor.setEnabled(false, false);
      expect(monitor.isEnabled()).toBe(false);
    });

    test('resets metrics by default', () => {
      monitor.setEnabled(true, false);
      const finalize = monitor.startRebuildProfiling(5);
      finalize(3);
      expect(monitor.getMetrics().rebuildBoardFromMoves.callCount).toBe(1);

      monitor.setEnabled(true, true);
      expect(monitor.getMetrics().rebuildBoardFromMoves.callCount).toBe(0);
    });

    test('does not reset when reset=false', () => {
      monitor.setEnabled(true, false);
      const finalize = monitor.startRebuildProfiling(5);
      finalize(3);
      expect(monitor.getMetrics().rebuildBoardFromMoves.callCount).toBe(1);

      monitor.setEnabled(true, false);
      expect(monitor.getMetrics().rebuildBoardFromMoves.callCount).toBe(1);
    });
  });

  describe('startRebuildProfiling', () => {
    test('returns no-op when disabled', () => {
      const finalize = monitor.startRebuildProfiling(5);
      finalize(3);
      const m = monitor.getMetrics();
      expect(m.rebuildBoardFromMoves.callCount).toBe(0);
    });

    test('accumulates metrics when enabled', () => {
      monitor.setEnabled(true, true);
      const finalize1 = monitor.startRebuildProfiling(5);
      finalize1(3);
      const finalize2 = monitor.startRebuildProfiling(10);
      finalize2(7);

      const m = monitor.getMetrics();
      expect(m.rebuildBoardFromMoves.callCount).toBe(2);
      expect(m.rebuildBoardFromMoves.lastLimit).toBe(10);
      expect(m.rebuildBoardFromMoves.lastAppliedMoves).toBe(7);
    });
  });

  describe('reset', () => {
    test('clears all metrics', () => {
      monitor.setEnabled(true, false);
      const finalize = monitor.startRebuildProfiling(5);
      finalize(3);

      monitor.reset();
      const m = monitor.getMetrics();
      expect(m.rebuildBoardFromMoves.callCount).toBe(0);
      expect(m.rebuildBoardFromMoves.totalDurationMs).toBe(0);
      expect(m.rebuildBoardFromMoves.lastDurationMs).toBe(0);
      expect(m.rebuildBoardFromMoves.lastLimit).toBe(0);
      expect(m.rebuildBoardFromMoves.lastAppliedMoves).toBe(0);
    });
  });

  describe('getMetrics isolation', () => {
    test('returns a copy that does not affect internal state', () => {
      const m1 = monitor.getMetrics();
      m1.rebuildBoardFromMoves.callCount = 999;
      const m2 = monitor.getMetrics();
      expect(m2.rebuildBoardFromMoves.callCount).toBe(0);
    });

    test('consecutive calls return distinct objects', () => {
      const m1 = monitor.getMetrics();
      const m2 = monitor.getMetrics();
      expect(m1).not.toBe(m2);
      expect(m1.rebuildBoardFromMoves).not.toBe(m2.rebuildBoardFromMoves);
    });
  });
});
