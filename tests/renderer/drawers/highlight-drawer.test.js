// ============ HighlightDrawer 単体テスト ============
import { HighlightDrawer } from '../../../dist/renderer/drawers/highlight-drawer.js';
import { SvgElementFactory } from '../../../dist/renderer/drawers/svg-helpers.js';

function createSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('HighlightDrawer', () => {
  let svg;
  let factory;
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = createSvg();
    factory = new SvgElementFactory(svg);
    drawer = new HighlightDrawer(factory);
  });

  test('draws exactly one circle', () => {
    drawer.drawLastMove({ cx: 100, cy: 200, radius: 25 });
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
  });

  test('sets cx, cy, r attributes', () => {
    drawer.drawLastMove({ cx: 100, cy: 200, radius: 25 });
    const circle = svg.querySelector('circle');
    expect(circle.getAttribute('cx')).toBe('100');
    expect(circle.getAttribute('cy')).toBe('200');
    expect(circle.getAttribute('r')).toBe('25');
  });

  test('applies last-move-highlight class', () => {
    drawer.drawLastMove({ cx: 100, cy: 200, radius: 25 });
    const circle = svg.querySelector('circle');
    expect(circle.getAttribute('class')).toBe('last-move-highlight');
  });

  test('uses fill: none in style', () => {
    drawer.drawLastMove({ cx: 100, cy: 200, radius: 25 });
    const circle = svg.querySelector('circle');
    expect(circle.getAttribute('style')).toContain('fill: none');
  });

  test('includes stroke color in style (resolved from --accent)', () => {
    drawer.drawLastMove({ cx: 100, cy: 200, radius: 25 });
    const circle = svg.querySelector('circle');
    const style = circle.getAttribute('style');
    // resolveCssVar はテスト環境で値が解決できない場合は
    // フォールバック '#d9534f' を使う
    expect(style).toContain('stroke:');
  });

  test('handles different highlight positions', () => {
    drawer.drawLastMove({ cx: 0, cy: 0, radius: 1 });
    let circle = svg.querySelector('circle');
    expect(circle.getAttribute('cx')).toBe('0');
    expect(circle.getAttribute('r')).toBe('1');

    document.body.innerHTML = '';
    svg = createSvg();
    factory = new SvgElementFactory(svg);
    drawer = new HighlightDrawer(factory);
    drawer.drawLastMove({ cx: 500, cy: 500, radius: 50 });
    circle = svg.querySelector('circle');
    expect(circle.getAttribute('cx')).toBe('500');
    expect(circle.getAttribute('r')).toBe('50');
  });
});
