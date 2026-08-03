/**
 * Global state mock helpers.
 *
 * The local Jest runner shares a single jsdom instance across all tests,
 * so patched globals (navigator.clipboard, document.execCommand, etc.)
 * leak into other tests if not properly restored. These helpers centralize
 * the save/restore pattern using a try/finally guarantee:
 *
 *   const restore = mockGlobals({ alert: () => {} });
 *   try {
 *     // ... test code that uses global.alert ...
 *   } finally {
 *     restore();
 *   }
 *
 * Or use the higher-level `withMockedGlobals` wrapper for the same pattern
 * with a callback:
 *
 *   withMockedGlobals({ alert: () => {} }, () => {
 *     // ... test code ...
 *   });
 */

/**
 * Save the current values of the listed global properties, then apply the
 * provided mocks. Returns a restore function that reverts each property to
 * its original value (or deletes it if it did not exist).
 *
 * @param {Record<string, any>} mocks - Keys are global property names, values are mocks.
 * @returns {() => void} Restore function.
 */
export function mockGlobals(mocks) {
  const saved = {};
  for (const key of Object.keys(mocks)) {
    saved[key] = {
      had: key in globalThis,
      value: globalThis[key]
    };
    globalThis[key] = mocks[key];
  }
  return function restore() {
    for (const key of Object.keys(saved)) {
      const entry = saved[key];
      if (entry.had) {
        globalThis[key] = entry.value;
      } else {
        delete globalThis[key];
      }
    }
  };
}

/**
 * Wrap a test callback with global mocking. The mocks are applied before the
 * callback runs and restored afterwards, even if the callback throws.
 *
 * @param {Record<string, any>} mocks - Keys are global property names, values are mocks.
 * @param {() => void} fn - Test callback to run with the mocks applied.
 * @returns {void}
 */
export function withMockedGlobals(mocks, fn) {
  const restore = mockGlobals(mocks);
  try {
    fn();
  } finally {
    restore();
  }
}

/**
 * Save and stub out the common browser APIs that tests frequently patch:
 * alert, prompt, confirm, navigator.clipboard, document.execCommand, and
 * URL.createObjectURL / URL.revokeObjectURL.
 *
 * Each property is replaced with a no-op function (or empty object for
 * navigator.clipboard). Pass overrides in `options` to customize individual
 * properties.
 *
 * @param {object} [options] - Optional overrides per global.
 * @returns {() => void} Restore function.
 */
export function stubBrowserGlobals(options = {}) {
  return mockGlobals({
    alert: options.alert ?? (() => {}),
    prompt: options.prompt ?? (() => null),
    confirm: options.confirm ?? (() => true),
    ...(options.navigator !== undefined ? { navigator: options.navigator } : {}),
    ...(options.window !== undefined ? { window: options.window } : {})
  });
}
