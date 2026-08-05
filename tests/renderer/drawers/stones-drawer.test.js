// ============ StonesDrawer 単体テスト ============
import { StonesDrawer } from '../../../dist/renderer/drawers/stones-drawer.js';
import { SvgElementFactory } from '../../../dist/renderer/drawers/svg-helpers.js';
import { DEFAULT_CONFIG } from '../../../dist/types.js';

function createSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('StonesDrawer', () => {
  let svg;
  let factory;
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = createSvg();
    factory = new SvgElementFactory(svg);
    drawer = new StonesDrawer(factory);
  });

  describe('drawStones()', () => {
    test('draws one circle per stone', () => {
      drawer.drawStones([
        { cx: 10, cy: 10, radius: 5, fill: '#000', strokeWidth: 1, grabbed: false },
        { cx: 20, cy: 20, radius: 5, fill: '#fff', strokeWidth: 1, grabbed: false },
        { cx: 30, cy: 30, radius: 5, fill: '#000', strokeWidth: 1, grabbed: false }
      ]);

      expect(svg.querySelectorAll('circle')).toHaveLength(3);
    });

    test('sets fill and stroke attributes', () => {
      drawer.drawStones([
        { cx: 10, cy: 10, radius: 5, fill: '#000', strokeWidth: 2, grabbed: false }
      ]);

      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('cx')).toBe('10');
      expect(circle.getAttribute('cy')).toBe('10');
      expect(circle.getAttribute('r')).toBe('5');
      expect(circle.getAttribute('fill')).toBe('#000');
      expect(circle.getAttribute('stroke')).toBe('#000');
      expect(circle.getAttribute('stroke-width')).toBe('2');
    });

    test('uses grabbed-stone class when grabbed=true', () => {
      drawer.drawStones([
        { cx: 10, cy: 10, radius: 5, fill: '#000', strokeWidth: 1, grabbed: true }
      ]);

      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('class')).toBe('stone grabbed-stone');
    });

    test('uses plain stone class when grabbed=false', () => {
      drawer.drawStones([
        { cx: 10, cy: 10, radius: 5, fill: '#000', strokeWidth: 1, grabbed: false }
      ]);

      const circle = svg.querySelector('circle');
      expect(circle.getAttribute('class')).toBe('stone');
    });

    test('draws nothing when stone list is empty', () => {
      drawer.drawStones([]);
      expect(svg.querySelectorAll('circle')).toHaveLength(0);
    });
  });

  describe('drawMoveNumbers()', () => {
    test('draws background circle + text per number', () => {
      drawer.drawMoveNumbers([
        { cx: 10, cy: 10, fontSize: 14, fill: '#fff', text: '1' }
      ]);

      expect(svg.querySelectorAll('circle')).toHaveLength(1);
      expect(svg.querySelectorAll('text')).toHaveLength(1);
    });

    test('uses white background for black stones (fill=#000)', () => {
      drawer.drawMoveNumbers([
        { cx: 10, cy: 10, fontSize: 14, fill: '#000', text: '1' }
      ]);

      const bg = svg.querySelector('circle');
      expect(bg.getAttribute('fill')).toBe('#ffffff');
    });

    test('uses black background for white stones (fill=#fff)', () => {
      drawer.drawMoveNumbers([
        { cx: 10, cy: 10, fontSize: 14, fill: '#fff', text: '1' }
      ]);

      const bg = svg.querySelector('circle');
      expect(bg.getAttribute('fill')).toBe('#000000');
    });

  test('clamps bg radius to stoneRadius - borderMargin', () => {
    const hugeFont = DEFAULT_CONFIG.STONE_RADIUS * 10;
    drawer.drawMoveNumbers([
      { cx: 10, cy: 10, fontSize: hugeFont, fill: '#000', text: '1' }
    ]);

    const bg = svg.querySelector('circle');
    const expectedMax = DEFAULT_CONFIG.STONE_RADIUS - DEFAULT_CONFIG.MOVE_NUM_BORDER_MARGIN;
    const actualR = parseFloat(bg.getAttribute('r'));
    expect(actualR).toBe(expectedMax);
  });

    test('sets text content', () => {
      drawer.drawMoveNumbers([
        { cx: 10, cy: 10, fontSize: 14, fill: '#000', text: '42' }
      ]);

      const text = svg.querySelector('text');
      expect(text.textContent).toBe('42');
    });

    test('applies paint-order stroke for visibility', () => {
      drawer.drawMoveNumbers([
        { cx: 10, cy: 10, fontSize: 14, fill: '#fff', text: '1' }
      ]);

      const text = svg.querySelector('text');
      expect(text.getAttribute('paint-order')).toBe('stroke');
    });

    test('draws nothing when number list is empty', () => {
      drawer.drawMoveNumbers([]);
      expect(svg.querySelectorAll('text')).toHaveLength(0);
    });
  });
});
