// ============ MarkersDrawer 単体テスト ============
import { MarkersDrawer } from '../../../dist/renderer/drawers/markers-drawer.js';
import { SvgElementFactory } from '../../../dist/renderer/drawers/svg-helpers.js';
import { DEFAULT_CONFIG } from '../../../dist/types.js';

function createSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('MarkersDrawer', () => {
  let svg;
  let factory;
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = createSvg();
    factory = new SvgElementFactory(svg);
    drawer = new MarkersDrawer(factory);
  });

  test('draws nothing for empty array', () => {
    drawer.draw([]);
    expect(svg.children).toHaveLength(0);
  });

  test('draws nothing for null/undefined input', () => {
    drawer.draw(null);
    drawer.draw(undefined);
    expect(svg.children).toHaveLength(0);
  });

  describe('CR (circle marker)', () => {
    test('draws one circle element', () => {
      drawer.draw([{ kind: 'CR', cx: 50, cy: 50, radius: 15, label: '' }]);
      expect(svg.querySelectorAll('circle')).toHaveLength(1);
    });

    test('applies marker-cr class', () => {
      drawer.draw([{ kind: 'CR', cx: 50, cy: 50, radius: 15, label: '' }]);
      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('class')).toBe('marker marker-cr');
    });
  });

  describe('TR (triangle marker)', () => {
    test('draws one polygon element', () => {
      drawer.draw([{ kind: 'TR', cx: 50, cy: 50, radius: 15, label: '' }]);
      expect(svg.querySelectorAll('polygon')).toHaveLength(1);
    });

    test('applies marker-tr class', () => {
      drawer.draw([{ kind: 'TR', cx: 50, cy: 50, radius: 15, label: '' }]);
      const polygon = svg.querySelector('polygon');
      expect(polygon.getAttribute('class')).toBe('marker marker-tr');
    });

    test('produces three points forming a triangle', () => {
      drawer.draw([{ kind: 'TR', cx: 50, cy: 50, radius: 15, label: '' }]);
      const polygon = svg.querySelector('polygon');
      const points = polygon.getAttribute('points').trim().split(/\s+/);
      expect(points).toHaveLength(3);
    });
  });

  describe('SQ (square marker)', () => {
    test('draws one rect element', () => {
      drawer.draw([{ kind: 'SQ', cx: 50, cy: 50, radius: 15, label: '' }]);
      expect(svg.querySelectorAll('rect')).toHaveLength(1);
    });

    test('applies marker-sq class', () => {
      drawer.draw([{ kind: 'SQ', cx: 50, cy: 50, radius: 15, label: '' }]);
      const rect = svg.querySelector('rect');
      expect(rect.getAttribute('class')).toBe('marker marker-sq');
    });

    test('sets width and height to diameter (radius * 2 * 0.85)', () => {
      drawer.draw([{ kind: 'SQ', cx: 100, cy: 100, radius: 20, label: '' }]);
      const rect = svg.querySelector('rect');
      const expectedSize = (20 * 0.85 * 2).toString();
      expect(rect.getAttribute('width')).toBe(expectedSize);
      expect(rect.getAttribute('height')).toBe(expectedSize);
    });
  });

  describe('MA (cross/X marker)', () => {
    test('draws two line elements (for × shape)', () => {
      drawer.draw([{ kind: 'MA', cx: 50, cy: 50, radius: 15, label: '' }]);
      expect(svg.querySelectorAll('line')).toHaveLength(2);
    });

    test('both lines share marker-ma class', () => {
      drawer.draw([{ kind: 'MA', cx: 50, cy: 50, radius: 15, label: '' }]);
      const lines = svg.querySelectorAll('line');
      lines.forEach((line) => {
        expect(line.getAttribute('class')).toBe('marker marker-ma');
      });
    });

    test('lines are diagonal (x1,y1 to x2,y2 in opposite directions)', () => {
      drawer.draw([{ kind: 'MA', cx: 100, cy: 100, radius: 20, label: '' }]);
      const lines = Array.from(svg.querySelectorAll('line'));
      // 1本目: (100-d, 100-d) -> (100+d, 100+d)
      // 2本目: (100+d, 100-d) -> (100-d, 100+d)
      const xs = lines.map((l) => l.getAttribute('x1'));
      expect(xs).toContain((100 - 20 * 0.7).toString());
      expect(xs).toContain((100 + 20 * 0.7).toString());
    });
  });

  describe('LB (label marker)', () => {
    test('draws background circle + text element', () => {
      drawer.draw([{ kind: 'LB', cx: 50, cy: 50, radius: 15, label: 'A' }]);
      expect(svg.querySelectorAll('circle')).toHaveLength(1);
      expect(svg.querySelectorAll('text')).toHaveLength(1);
    });

    test('applies marker-lb class to background circle', () => {
      drawer.draw([{ kind: 'LB', cx: 50, cy: 50, radius: 15, label: 'A' }]);
      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('class')).toBe('marker marker-lb');
    });

    test('sets text content to label', () => {
      drawer.draw([{ kind: 'LB', cx: 50, cy: 50, radius: 15, label: 'X' }]);
      const text = svg.querySelector('text');
      expect(text.textContent).toBe('X');
    });

    test('truncates label to 3 characters', () => {
      drawer.draw([{ kind: 'LB', cx: 50, cy: 50, radius: 15, label: 'ABCDE' }]);
      const text = svg.querySelector('text');
      expect(text.textContent).toBe('ABC');
    });

    test('skips drawing when label is empty', () => {
      drawer.draw([{ kind: 'LB', cx: 50, cy: 50, radius: 15, label: '' }]);
      expect(svg.children).toHaveLength(0);
    });
  });

  describe('mixed markers', () => {
    test('draws multiple markers of different kinds', () => {
      drawer.draw([
        { kind: 'CR', cx: 10, cy: 10, radius: 5, label: '' },
        { kind: 'TR', cx: 20, cy: 20, radius: 5, label: '' },
        { kind: 'SQ', cx: 30, cy: 30, radius: 5, label: '' },
        { kind: 'MA', cx: 40, cy: 40, radius: 5, label: '' }
      ]);
      expect(svg.querySelectorAll('circle')).toHaveLength(1); // CR
      expect(svg.querySelectorAll('polygon')).toHaveLength(1); // TR
      expect(svg.querySelectorAll('rect')).toHaveLength(1); // SQ
      expect(svg.querySelectorAll('line')).toHaveLength(2); // MA
    });
  });

  describe('common attributes', () => {
    test('uses MARKER_STROKE_WIDTH from config', () => {
      drawer.draw([{ kind: 'CR', cx: 10, cy: 10, radius: 5, label: '' }]);
      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('stroke-width')).toBe(
        DEFAULT_CONFIG.MARKER_STROKE_WIDTH.toString()
      );
    });

    test('includes stroke style for accent color', () => {
      drawer.draw([{ kind: 'CR', cx: 10, cy: 10, radius: 5, label: '' }]);
      const circle = svg.querySelector('circle');
      const style = circle.getAttribute('style');
      expect(style).toContain('stroke:');
    });
  });
});
