import { isPointerActive } from '../dist/ui/utils/pointer-utils.js';

describe('isPointerActive', () => {
  test('returns true when buttons > 0 (mouse primary)', () => {
    const event = { buttons: 1, pointerType: 'mouse' };
    expect(isPointerActive(event)).toBe(true);
  });

  test('returns true when buttons = 2 (mouse secondary)', () => {
    const event = { buttons: 2, pointerType: 'mouse' };
    expect(isPointerActive(event)).toBe(true);
  });

  test('returns true when buttons = 3 (mouse both)', () => {
    const event = { buttons: 3, pointerType: 'mouse' };
    expect(isPointerActive(event)).toBe(true);
  });

  test('returns false when buttons = 0 and pointerType is mouse', () => {
    const event = { buttons: 0, pointerType: 'mouse' };
    expect(isPointerActive(event)).toBe(false);
  });

  test('returns true when pointerType is touch and buttons = 0', () => {
    const event = { buttons: 0, pointerType: 'touch' };
    expect(isPointerActive(event)).toBe(true);
  });

  test('returns true when pointerType is pen and buttons = 0', () => {
    const event = { buttons: 0, pointerType: 'pen' };
    expect(isPointerActive(event)).toBe(true);
  });

  test('returns false when pointerType is unknown and buttons = 0', () => {
    const event = { buttons: 0, pointerType: 'unknown' };
    expect(isPointerActive(event)).toBe(false);
  });

  test('returns false when pointerType is empty string and buttons = 0', () => {
    const event = { buttons: 0, pointerType: '' };
    expect(isPointerActive(event)).toBe(false);
  });

  test('returns true when buttons > 0 regardless of pointerType', () => {
    expect(isPointerActive({ buttons: 1, pointerType: 'mouse' })).toBe(true);
    expect(isPointerActive({ buttons: 1, pointerType: 'touch' })).toBe(true);
    expect(isPointerActive({ buttons: 1, pointerType: 'pen' })).toBe(true);
  });

  test('treats missing pointerType as empty', () => {
    const event = { buttons: 0 };
    expect(isPointerActive(event)).toBe(false);
  });
});
