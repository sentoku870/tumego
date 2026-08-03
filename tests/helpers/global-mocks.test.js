import {
  mockGlobals,
  withMockedGlobals,
  stubBrowserGlobals
} from '../helpers/global-mocks.js';

describe('mockGlobals()', () => {
  test('applies the provided mocks to globalThis', () => {
    const restore = mockGlobals({ alert: () => 'mocked' });
    try {
      expect(globalThis.alert()).toBe('mocked');
    } finally {
      restore();
    }
  });

  test('restores original values after restore()', () => {
    const original = globalThis.alert;
    const restore = mockGlobals({ alert: () => 'mocked' });
    restore();
    expect(globalThis.alert).toBe(original);
  });

  test('deletes properties that did not exist before', () => {
    delete globalThis.tumegoTestProp;
    const restore = mockGlobals({ tumegoTestProp: 'temp' });
    expect(globalThis.tumegoTestProp).toBe('temp');
    restore();
    expect('tumegoTestProp' in globalThis).toBe(false);
  });

  test('restores multiple properties', () => {
    const origAlert = globalThis.alert;
    const origPrompt = globalThis.prompt;
    const restore = mockGlobals({
      alert: () => 'a',
      prompt: () => 'p'
    });
    restore();
    expect(globalThis.alert).toBe(origAlert);
    expect(globalThis.prompt).toBe(origPrompt);
  });
});

describe('withMockedGlobals()', () => {
  test('applies mocks inside the callback', () => {
    withMockedGlobals({ alert: () => 'inside' }, () => {
      expect(globalThis.alert()).toBe('inside');
    });
  });

  test('restores mocks even when the callback throws', () => {
    const original = globalThis.alert;
    let threw = false;
    try {
      withMockedGlobals({ alert: () => 'mocked' }, () => {
        throw new Error('boom');
      });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(globalThis.alert).toBe(original);
  });
});

describe('stubBrowserGlobals()', () => {
  test('stubs alert, prompt, confirm with no-op defaults', () => {
    const restore = stubBrowserGlobals();
    try {
      expect(typeof globalThis.alert).toBe('function');
      expect(typeof globalThis.prompt).toBe('function');
      expect(typeof globalThis.confirm).toBe('function');
      const alertResult = globalThis.alert();
      expect(alertResult === undefined).toBe(true);
      expect(globalThis.prompt()).toBe(null);
      expect(globalThis.confirm()).toBe(true);
    } finally {
      restore();
    }
  });

  test('accepts overrides for individual properties', () => {
    const restore = stubBrowserGlobals({
      alert: () => 'custom alert'
    });
    try {
      expect(globalThis.alert()).toBe('custom alert');
      expect(globalThis.confirm()).toBe(true);
    } finally {
      restore();
    }
  });
});
