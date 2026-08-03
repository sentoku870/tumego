import {
  nextMarkerLetter,
  MARKER_LETTER_SEQUENCE
} from '../dist/types.js';

describe('nextMarkerLetter()', () => {
  test('returns first letter when current is null', () => {
    expect(nextMarkerLetter(null)).toBe('A');
  });

  test('returns first letter when current is undefined', () => {
    expect(nextMarkerLetter(undefined)).toBe('A');
  });

  test('returns first letter when current is empty string', () => {
    expect(nextMarkerLetter('')).toBe('A');
  });

  test('returns first letter when current is not in sequence', () => {
    expect(nextMarkerLetter('Z')).toBe('A');
    expect(nextMarkerLetter('1')).toBe('A');
    expect(nextMarkerLetter('AA')).toBe('A');
  });

  test('advances through the sequence A -> B -> C -> D -> E', () => {
    expect(nextMarkerLetter('A')).toBe('B');
    expect(nextMarkerLetter('B')).toBe('C');
    expect(nextMarkerLetter('C')).toBe('D');
    expect(nextMarkerLetter('D')).toBe('E');
  });

  test('wraps from the last letter back to the first', () => {
    const lastLetter = MARKER_LETTER_SEQUENCE[MARKER_LETTER_SEQUENCE.length - 1];
    expect(nextMarkerLetter(lastLetter)).toBe('A');
  });

  test('MARKER_LETTER_SEQUENCE contains A through E', () => {
    expect(MARKER_LETTER_SEQUENCE).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('preserves sequence length across multiple wrap-around cycles', () => {
    let current = null;
    const seen = [];
    for (let i = 0; i < MARKER_LETTER_SEQUENCE.length * 3; i++) {
      current = nextMarkerLetter(current);
      seen.push(current);
    }
    expect(seen.length).toBe(MARKER_LETTER_SEQUENCE.length * 3);
    const expected = MARKER_LETTER_SEQUENCE.concat(MARKER_LETTER_SEQUENCE).concat(MARKER_LETTER_SEQUENCE);
    expect(seen).toEqual(expected);
  });
});
