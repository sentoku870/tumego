import './helpers/dom-setup.js';
import { SGFIO } from '../dist/services/sgf-io.js';
import { SGFParser } from '../dist/sgf-parser.js';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SGFIO', () => {
  let io;
  let parser;

  beforeEach(() => {
    parser = new SGFParser();
    io = new SGFIO(parser);
  });

  // Note: loadFromFile() cannot be tested under jsdom because
  // jsdom's FileReader.readAsText() rejects File objects created
  // by jsdom's File constructor. The function is exercised manually
  // via the file-input change handler in the browser.

  describe('loadFromClipboard', () => {
    test('parses SGF from clipboard text', async () => {
      const sgfText = '(;GM[1]FF[4]SZ[9];B[dd])';
      global.navigator.clipboard = { readText: async () => sgfText };
      const result = await io.loadFromClipboard();
      const dd = result.moves[0];
      if (!dd || dd.col !== 3 || dd.row !== 3 || dd.color !== 1) {
        throw new Error(`unexpected move: ${JSON.stringify(dd)}`);
      }
    });

    test('throws when clipboard is empty', async () => {
      global.navigator.clipboard = { readText: async () => '' };
      let thrown = null;
      try {
        await io.loadFromClipboard();
      } catch (e) {
        thrown = e;
      }
      if (thrown === null) throw new Error('expected throw');
    });
  });

  describe('copyToClipboard', () => {
    test('writes text via navigator.clipboard.writeText when available', async () => {
      let written = null;
      global.navigator.clipboard = {
        writeText: async (text) => { written = text; },
      };
      await io.copyToClipboard('(;B[aa])');
      if (written !== '(;B[aa])') throw new Error(`expected written '(;B[aa])', got ${written}`);
    });

    test('falls back to execCommand when clipboard API throws', async () => {
      global.navigator.clipboard = {
        writeText: async () => { throw new Error('blocked'); },
      };
      document.execCommand = () => true;
      let threw = null;
      try {
        await io.copyToClipboard('(;B[aa])');
      } catch (e) {
        threw = e;
      }
      if (threw !== null) throw new Error(`unexpected throw: ${threw}`);
    });

    test('throws when both clipboard API and fallback fail', async () => {
      global.navigator.clipboard = {
        writeText: async () => { throw new Error('blocked'); },
      };
      document.execCommand = () => false;
      let thrown = null;
      try {
        await io.copyToClipboard('(;B[aa])');
      } catch (e) {
        thrown = e;
      }
      if (thrown === null) throw new Error('expected throw');
    });
  });

  describe('saveToFile', () => {
    test('uses download fallback when showSaveFilePicker is unavailable', async () => {
      const originalPicker = global.window.showSaveFilePicker;
      delete global.window.showSaveFilePicker;

      const createdUrls = [];
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = (blob) => {
        const url = 'blob:fake-' + createdUrls.length;
        createdUrls.push(url);
        return url;
      };
      URL.revokeObjectURL = () => {};

      const clicked = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          const origClick = el.click;
          el.click = () => { clicked.push(el.download); origClick.call(el); };
        }
        return el;
      };

      try {
        await io.saveToFile('(;B[aa])', 'custom.sgf');
        await flushMicrotasks();
        if (!clicked.includes('custom.sgf')) {
          throw new Error(`expected click on custom.sgf, got ${JSON.stringify(clicked)}`);
        }
      } finally {
        if (originalPicker) global.window.showSaveFilePicker = originalPicker;
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        document.createElement = origCreate;
      }
    });
  });
});
