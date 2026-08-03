import {
  copyToClipboard,
  copyToClipboardFallback
} from '../../dist/utils/clipboard.js';

describe('copyToClipboard()', () => {
  let origClipboard;
  let origExecCommand;

  beforeEach(() => {
    document.body.innerHTML = '';
    origClipboard = global.navigator.clipboard;
    origExecCommand = document.execCommand;
  });

  afterEach(() => {
    if (origClipboard === undefined) {
      delete global.navigator.clipboard;
    } else {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: origClipboard,
        writable: true,
        configurable: true
      });
    }
    document.execCommand = origExecCommand;
  });

  test('writes via navigator.clipboard.writeText when available', async () => {
    let writtenText = null;
    global.navigator.clipboard = {
      writeText: async (text) => { writtenText = text; }
    };

    await copyToClipboard('hello world');

    expect(writtenText).toBe('hello world');
  });

  test('does not call fallback when clipboard API succeeds', async () => {
    global.navigator.clipboard = {
      writeText: async () => {}
    };
    document.execCommand = () => {
      throw new Error('execCommand should not be called');
    };

    await copyToClipboard('test');
  });

  test('falls back to execCommand when clipboard API throws', async () => {
    global.navigator.clipboard = {
      writeText: async () => { throw new Error('Permission denied'); }
    };
    document.execCommand = () => true;

    await copyToClipboard('fallback text');

    expect(document.body.querySelector('textarea')).toBeNull();
  });

  test('uses fallback when navigator.clipboard is undefined', async () => {
    delete global.navigator.clipboard;
    document.execCommand = () => true;

    await copyToClipboard('no-clipboard');
  });

  test('throws when both clipboard API and fallback fail', async () => {
    global.navigator.clipboard = {
      writeText: async () => { throw new Error('blocked'); }
    };
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
  });
});

describe('copyToClipboardFallback()', () => {
  let origExecCommand;
  let origCreateElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    origExecCommand = document.execCommand;
  });

  afterEach(() => {
    document.execCommand = origExecCommand;
    if (origCreateElement) {
      document.createElement = origCreateElement;
    }
  });

  test('returns true when execCommand returns true', () => {
    document.execCommand = () => true;
    expect(copyToClipboardFallback('text')).toBe(true);
  });

  test('returns false when execCommand returns false', () => {
    document.execCommand = () => false;
    expect(copyToClipboardFallback('text')).toBe(false);
  });

  test('removes the textarea after copy', () => {
    document.execCommand = () => true;
    copyToClipboardFallback('cleanup test');
    const textareas = document.body.querySelectorAll('textarea');
    expect(textareas.length).toBe(0);
  });

  test('sets textarea value to the provided text', () => {
    document.execCommand = () => true;
    let capturedTextarea = null;
    const orig = document.createElement;
    document.createElement = (tag) => {
      const el = orig.call(document, tag);
      if (tag === 'textarea') {
        capturedTextarea = el;
      }
      return el;
    };
    copyToClipboardFallback('my value');
    expect(capturedTextarea).not.toBeNull();
    expect(capturedTextarea.value).toBe('my value');
    document.createElement = orig;
  });

  test('returns false when execCommand throws', () => {
    document.execCommand = () => { throw new Error('copy failed'); };
    expect(copyToClipboardFallback('text')).toBe(false);
  });

  test('handles empty string', () => {
    document.execCommand = () => true;
    expect(copyToClipboardFallback('')).toBe(true);
  });

  test('handles multi-line text', () => {
    document.execCommand = () => true;
    expect(copyToClipboardFallback('line1\nline2\nline3')).toBe(true);
  });
});
