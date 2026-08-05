import { LongPressDetector } from '../../dist/ui/controllers/long-press-detector.js';

describe('LongPressDetector', () => {
  /** 仮想タイマー: ハンドラを記録し、手動で発火できる */
  const createVirtualTimers = () => {
    const handles = [];
    const handlers = new Map();
    let nextId = 1;

    const setTimeoutFn = (handler, ms) => {
      const id = nextId++;
      handles.push({ id, handler, ms });
      handlers.set(id, handler);
      return id;
    };
    const clearTimeoutFn = (handle) => {
      const id = typeof handle === 'object' ? handle.id : handle;
      handlers.delete(id);
      const idx = handles.findIndex((h) => h.id === id);
      if (idx >= 0) handles.splice(idx, 1);
    };

    return {
      setTimeoutFn,
      clearTimeoutFn,
      handles,
      handlers,
      /** 待機中のハンドラを全て発火する */
      fireAll() {
        const snapshot = handles.slice();
        snapshot.forEach((h) => handlers.get(h.id)?.());
      },
    };
  };

  test('starts timer and triggers callback after threshold', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      thresholdMs: 400,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    let called = 0;
    detector.start({ clientX: 10, clientY: 20 }, () => {
      called++;
    });

    expect(detector.isActive()).toBe(true);
    expect(timers.handles.length).toBe(1);
    expect(timers.handles[0].ms).toBe(400);

    timers.fireAll();

    expect(called).toBe(1);
    expect(detector.isActive()).toBe(false);
  });

  test('cancel() prevents trigger', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    let called = 0;
    detector.start({ clientX: 0, clientY: 0 }, () => {
      called++;
    });

    detector.cancel();

    expect(detector.isActive()).toBe(false);
    timers.fireAll();
    expect(called).toBe(0);
  });

  test('start() while active restarts the timer', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    let firstCalled = 0;
    detector.start({ clientX: 0, clientY: 0 }, () => {
      firstCalled++;
    });

    // 2回目の start は前のタイマーをキャンセルして新規起動
    let secondCalled = 0;
    detector.start({ clientX: 5, clientY: 5 }, () => {
      secondCalled++;
    });

    timers.fireAll();

    expect(firstCalled).toBe(0);
    expect(secondCalled).toBe(1);
  });

  test('isWithinThreshold returns true when not active', () => {
    const detector = new LongPressDetector();
    expect(detector.isWithinThreshold({ clientX: 9999, clientY: 9999 })).toBe(true);
  });

  test('isWithinThreshold returns true for small movement', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      moveThresholdPx: 10,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    detector.start({ clientX: 100, clientY: 100 }, () => {});

    // 5px の移動はしきい値未満
    expect(detector.isWithinThreshold({ clientX: 105, clientY: 100 })).toBe(true);
    expect(detector.isWithinThreshold({ clientX: 100, clientY: 105 })).toBe(true);
  });

  test('isWithinThreshold returns false for large movement', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      moveThresholdPx: 10,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    detector.start({ clientX: 100, clientY: 100 }, () => {});

    // 20px の移動はしきい値超過
    expect(detector.isWithinThreshold({ clientX: 120, clientY: 100 })).toBe(false);
    // 対角線上 14.14px も超過
    expect(detector.isWithinThreshold({ clientX: 110, clientY: 110 })).toBe(false);
  });

  test('default threshold is 400ms', () => {
    const detector = new LongPressDetector();
    expect(detector.getThresholdMs()).toBe(400);
  });

  test('default move threshold is 10px', () => {
    const detector = new LongPressDetector();
    expect(detector.getMoveThresholdPx()).toBe(10);
  });

  test('cancel() 後の start() は新しいタイマーで動作する', () => {
    const timers = createVirtualTimers();
    const detector = new LongPressDetector({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    detector.start({ clientX: 0, clientY: 0 }, () => {});
    detector.cancel();

    let called = 0;
    detector.start({ clientX: 10, clientY: 10 }, () => {
      called++;
    });
    timers.fireAll();

    expect(called).toBe(1);
  });
});
