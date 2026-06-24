import { Modal } from '../../dist/ui/views/modal.js';

describe('Modal', () => {
  let modal;

  afterEach(() => {
    modal?.close();
    document.body.innerHTML = '';
  });

  describe('open/close', () => {
    test('appends element with the given id to document.body', () => {
      modal = new Modal({ id: 'test-modal', content: 'hello' });
      modal.open();
      const el = document.getElementById('test-modal');
      expect(el).not.toBeNull();
    });

    test('removes element on close', () => {
      modal = new Modal({ id: 'test-modal', content: 'hello' });
      modal.open();
      modal.close();
      expect(document.getElementById('test-modal')).toBeNull();
    });

    test('isOpen reflects state', () => {
      modal = new Modal({ id: 'test-modal', content: 'hello' });
      expect(modal.isOpen()).toBe(false);
      modal.open();
      expect(modal.isOpen()).toBe(true);
      modal.close();
      expect(modal.isOpen()).toBe(false);
    });

    test('accepts HTMLElement content', () => {
      const content = document.createElement('p');
      content.textContent = 'test content';
      modal = new Modal({ id: 'test-modal-elem', content });
      modal.open();
      const el = document.getElementById('test-modal-elem');
      expect(el.querySelector('p')?.textContent).toBe('test content');
    });

    test('accepts string content', () => {
      modal = new Modal({ id: 'test-modal-str', content: '<p>inline</p>' });
      modal.open();
      const el = document.getElementById('test-modal-str');
      expect(el.querySelector('p')?.textContent).toBe('inline');
    });
  });

  describe('a11y attributes', () => {
    test('sets role=dialog and aria-modal=true', () => {
      modal = new Modal({ id: 'test-modal-a11y', content: 'x' });
      modal.open();
      const el = document.getElementById('test-modal-a11y');
      expect(el.getAttribute('role')).toBe('dialog');
      expect(el.getAttribute('aria-modal')).toBe('true');
    });
  });

  describe('closeOnEsc', () => {
    test('default: Esc closes the modal', () => {
      modal = new Modal({ id: 'test-modal-esc', content: 'x' });
      modal.open();
      expect(modal.isOpen()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(modal.isOpen()).toBe(false);
    });

    test('closeOnEsc=false: Esc does not close', () => {
      modal = new Modal({ id: 'test-modal-esc-off', content: 'x', closeOnEsc: false });
      modal.open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(modal.isOpen()).toBe(true);
    });
  });

  describe('closeOnBackdrop', () => {
    test('default: clicking the overlay closes the modal', () => {
      modal = new Modal({ id: 'test-modal-back', content: 'x' });
      modal.open();
      const el = document.getElementById('test-modal-back');
      el.click();
      expect(modal.isOpen()).toBe(false);
    });

    test('clicking inside the card does not close', () => {
      modal = new Modal({ id: 'test-modal-card', content: 'x' });
      modal.open();
      const el = document.getElementById('test-modal-card');
      el.querySelector('.modal-card')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(modal.isOpen()).toBe(true);
    });

    test('closeOnBackdrop=false: clicking the overlay does not close', () => {
      modal = new Modal({ id: 'test-modal-back-off', content: 'x', closeOnBackdrop: false });
      modal.open();
      const el = document.getElementById('test-modal-back-off');
      el.click();
      expect(modal.isOpen()).toBe(true);
    });
  });

  describe('onClose callback', () => {
    test('fires on close()', () => {
      let called = 0;
      const onClose = () => { called++; };
      modal = new Modal({ id: 'test-modal-cb', content: 'x', onClose });
      modal.open();
      modal.close();
      modal = null; // suppress afterEach double-close
      expect(called).toBe(1);
    });

    test('does not fire when close() is called on an already-closed modal', () => {
      let called = 0;
      const onClose = () => { called++; };
      modal = new Modal({ id: 'test-modal-ccb', content: 'x', onClose });
      modal.open();
      modal.close();
      modal.close();
      expect(called).toBe(1);
    });
  });
});
