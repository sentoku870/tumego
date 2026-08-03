import {
  copyToClipboard,
  copyToClipboardFallback
} from '../../dist/utils/clipboard.js';
import { mockGlobals } from '../helpers/global-mocks.js';

describe('copyToClipboard()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('writes via navigator.clipboard.writeText when available', async () => {
    let writtenText = null;
    const restore = mockGlobals({
      navigator: {
        ...global.navigator,
        clipboard: {
          writeText: async (text) => { writtenText = text; }
        }
      }
    });
    try {
      await copyToClipboard('hello world');
      expect(writtenText).toBe('hello world');
    } finally {
      restore();
    }
  });

  test('does not call fallback when clipboard API succeeds', async () => {
    const restore = mockGlobals({
      navigator: {
        ...global.navigator,
        clipboard: {
          writeText: async () => {}
        }
      }
    });
    try {
      const origExecCommand = document.execCommand;
      document.execCommand = () => {
        throw new Error('execCommand should not be called');
      };
      await copyToClipboard('test');
      document.execCommand = origExecCommand;
    } finally {
      restore();
    }
  });

  test('falls back to execCommand when clipboard API throws', async () => {
    const restore = mockGlobals({
      navigator: {
        ...global.navigator,
        clipboard: {
          writeText: async () => { throw new Error('Permission denied'); }
        }
      }
    });
    try {
      const origExecCommand = document.execCommand;
      document.execCommand = () => true;
      await copyToClipboard('fallback text');
      expect(document.body.querySelector('textarea')).toBeNull();
      document.execCommand = origExecCommand;
    } finally {
      restore();
    }
  });

  test('uses fallback when navigator.clipboard is undefined', async () => {
    const restore = mockGlobals({
      navigator: {
        ...global.navigator,
        clipboard: undefined
      }
    });
    try {
      const origExecCommand = document.execCommand;
      document.execCommand = () => true;
      await copyToClipboard('no-clipboard');
      document.execCommand = origExecCommand;
    } finally {
      restore();
    }
  });

  test('throws when both clipboard API and fallback fail', async () => {
    const restore = mockGlobals({
      navigator: {
        ...global.navigator,
        clipboard: {
          writeText: async () => { throw new Error('blocked'); }
        }
      }
    });
    try {
      const origExecCommand = document.execCommand;
      document.execCommand = () => false;
      let threw = false;
      let message = '';
      try {
        await copyToClipboard('test');
      } catch (e) {
        threw = true;
        message = e.message;
      }
      expect(threw).toBe(true);
      expect(message.includes('クリップボード')).toBe(true);
      document.execCommand = origExecCommand;
    } finally {
      restore();
    }
  });
});

describe('copyToClipboardFallback()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('returns true when execCommand returns true', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => true;
    expect(copyToClipboardFallback('text')).toBe(true);
    document.execCommand = origExecCommand;
  });

  test('returns false when execCommand returns false', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => false;
    expect(copyToClipboardFallback('text')).toBe(false);
    document.execCommand = origExecCommand;
  });

  test('removes the textarea after copy', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => true;
    copyToClipboardFallback('cleanup test');
    const textareas = document.body.querySelectorAll('textarea');
    expect(textareas.length).toBe(0);
    document.execCommand = origExecCommand;
  });

  test('sets textarea value to the provided text', () => {
    const origExecCommand = document.execCommand;
    let capturedTextarea = null;
    const origCreateElement = document.createElement;
    document.execCommand = () => true;
    document.createElement = (tag) => {
      const el = origCreateElement.call(document, tag);
      if (tag === 'textarea') {
        capturedTextarea = el;
      }
      return el;
    };
    copyToClipboardFallback('my value');
    expect(capturedTextarea).not.toBeNull();
    expect(capturedTextarea.value).toBe('my value');
    document.createElement = origCreateElement;
    document.execCommand = origExecCommand;
  });

  test('returns false when execCommand throws', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => { throw new Error('copy failed'); };
    expect(copyToClipboardFallback('text')).toBe(false);
    document.execCommand = origExecCommand;
  });

  test('handles empty string', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => true;
    expect(copyToClipboardFallback('')).toBe(true);
    document.execCommand = origExecCommand;
  });

  test('handles multi-line text', () => {
    const origExecCommand = document.execCommand;
    document.execCommand = () => true;
    expect(copyToClipboardFallback('line1\nline2\nline3')).toBe(true);
    document.execCommand = origExecCommand;
  });
});
