// ============ CoordinatesDrawer 単体テスト ============
import { CoordinatesDrawer } from '../../../dist/renderer/drawers/coordinates-drawer.js';
import { SvgElementFactory } from '../../../dist/renderer/drawers/svg-helpers.js';

function createSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('CoordinatesDrawer', () => {
  let svg;
  let factory;
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = createSvg();
    factory = new SvgElementFactory(svg);
    drawer = new CoordinatesDrawer(factory);
  });

  test('draws one text element per label', () => {
    drawer.draw([
      { x: 10, y: 20, text: 'A', className: 'coord col', fontSize: 12 },
      { x: 30, y: 40, text: '1', className: 'coord row', fontSize: 12 }
    ]);

    const texts = svg.querySelectorAll('text');
    expect(texts).toHaveLength(2);
  });

  test('sets x, y, class, font-size attributes', () => {
    drawer.draw([
      { x: 10, y: 20, text: 'A', className: 'coord col', fontSize: 12 }
    ]);

    const text = svg.querySelector('text');
    expect(text.getAttribute('x')).toBe('10');
    expect(text.getAttribute('y')).toBe('20');
    expect(text.getAttribute('class')).toBe('coord col');
    expect(text.getAttribute('font-size')).toBe('12');
  });

  test('sets text content', () => {
    drawer.draw([
      { x: 10, y: 20, text: 'A', className: 'coord col', fontSize: 12 },
      { x: 30, y: 40, text: 'B', className: 'coord col', fontSize: 12 }
    ]);

    const texts = svg.querySelectorAll('text');
    expect(texts[0].textContent).toBe('A');
    expect(texts[1].textContent).toBe('B');
  });

  test('draws nothing when label list is empty', () => {
    drawer.draw([]);
    expect(svg.querySelectorAll('text')).toHaveLength(0);
  });

  test('appends each label as a separate SVG element', () => {
    drawer.draw([
      { x: 1, y: 2, text: 'A', className: 'c', fontSize: 10 },
      { x: 3, y: 4, text: 'B', className: 'c', fontSize: 10 },
      { x: 5, y: 6, text: 'C', className: 'c', fontSize: 10 },
      { x: 7, y: 8, text: 'D', className: 'c', fontSize: 10 }
    ]);

    const texts = svg.querySelectorAll('text');
    expect(texts).toHaveLength(4);
    expect(texts[0].getAttribute('x')).toBe('1');
    expect(texts[3].getAttribute('x')).toBe('7');
  });
});
