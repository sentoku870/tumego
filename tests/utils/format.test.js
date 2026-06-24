import { toCircledNumber } from '../../dist/utils/format.js';

describe('toCircledNumber', () => {
  test('returns ①-⑳ for 1-20', () => {
    expect(toCircledNumber(1)).toBe('①');
    expect(toCircledNumber(10)).toBe('⑩');
    expect(toCircledNumber(20)).toBe('⑳');
  });

  test('returns ㉑-㉟ for 21-35', () => {
    expect(toCircledNumber(21)).toBe('㉑');
    expect(toCircledNumber(35)).toBe('㉟');
  });

  test('returns ㊱-㊿ for 36-50', () => {
    expect(toCircledNumber(36)).toBe('㊱');
    expect(toCircledNumber(50)).toBe('㊿');
  });

  test('falls back to plain number for out-of-range', () => {
    expect(toCircledNumber(0)).toBe('0');
    expect(toCircledNumber(51)).toBe('51');
    expect(toCircledNumber(-1)).toBe('-1');
  });
});
