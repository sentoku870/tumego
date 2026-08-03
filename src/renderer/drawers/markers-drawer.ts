// ============ MarkersDrawer ============
// 盤面マーカー (○△□×/ラベル) を描画する。
// 各マーカー種別ごとに SVG 要素を生成:
//   CR: 円, TR: 上向き三角形, SQ: 正方形, MA: ×印, LB: 円+ラベル文字
import {
  DEFAULT_CONFIG,
  MarkerRenderInfo
} from '../../types/index.js';
import { resolveCssVar, SvgElementFactory } from './svg-helpers.js';

export class MarkersDrawer {
  constructor(private readonly factory: SvgElementFactory) {}

  draw(markers: MarkerRenderInfo[]): void {
    if (!markers || markers.length === 0) return;

    const stroke = DEFAULT_CONFIG.MARKER_STROKE_WIDTH.toString();
    // --accent を解決してインライン stroke として設定する。
    // こうすると盤面保存時の cloneNode(true) → SVG→PNG 変換でも
    // 外部 CSS に頼らずマーカー色が残る。
    const accent = resolveCssVar('--accent', '#d9534f');
    const markerStyle = `stroke: ${accent}; fill: none;`;
    const maStyle = `stroke: ${accent};`;

    markers.forEach((m) => {
      const cx = m.cx.toString();
      const cy = m.cy.toString();
      const r = m.radius.toString();

      switch (m.kind) {
        case 'CR':
          this.factory.append('circle', {
            cx, cy, r,
            class: 'marker marker-cr',
            style: markerStyle,
            'stroke-width': stroke,
          });
          break;
        case 'TR':
          this.drawTriangle(m, markerStyle, stroke);
          break;
        case 'SQ':
          this.drawSquare(m, markerStyle, stroke);
          break;
        case 'MA':
          this.drawCross(m, maStyle, stroke);
          break;
        case 'LB':
          this.drawLabel(m, accent);
          break;
        default: {
          const _exhaustive: never = m.kind as never;
          void _exhaustive;
        }
      }
    });
  }

  private drawTriangle(
    m: MarkerRenderInfo,
    markerStyle: string,
    stroke: string
  ): void {
    // 上向き正三角形: 中心 (cx,cy) 半径 r
    const top = { x: m.cx, y: m.cy - m.radius };
    const left = { x: m.cx - m.radius * Math.sin(Math.PI / 3), y: m.cy + m.radius * 0.5 };
    const right = { x: m.cx + m.radius * Math.sin(Math.PI / 3), y: m.cy + m.radius * 0.5 };
    const points = `${top.x},${top.y} ${left.x},${left.y} ${right.x},${right.y}`;
    this.factory.append('polygon', {
      points,
      class: 'marker marker-tr',
      style: markerStyle,
      'stroke-width': stroke,
    });
  }

  private drawSquare(
    m: MarkerRenderInfo,
    markerStyle: string,
    stroke: string
  ): void {
    const half = m.radius * 0.85;
    const x = (m.cx - half).toString();
    const y = (m.cy - half).toString();
    const size = (half * 2).toString();
    this.factory.append('rect', {
      x, y, width: size, height: size,
      rx: '2', ry: '2',
      class: 'marker marker-sq',
      style: markerStyle,
      'stroke-width': stroke,
    });
  }

  private drawCross(
    m: MarkerRenderInfo,
    maStyle: string,
    stroke: string
  ): void {
    // × 印: 2本の対角線
    const d = m.radius * 0.7;
    this.factory.append('line', {
      x1: (m.cx - d).toString(),
      y1: (m.cy - d).toString(),
      x2: (m.cx + d).toString(),
      y2: (m.cy + d).toString(),
      class: 'marker marker-ma',
      style: maStyle,
      'stroke-width': stroke,
    });
    this.factory.append('line', {
      x1: (m.cx + d).toString(),
      y1: (m.cy - d).toString(),
      x2: (m.cx - d).toString(),
      y2: (m.cy + d).toString(),
      class: 'marker marker-ma',
      style: maStyle,
      'stroke-width': stroke,
    });
  }

  private drawLabel(m: MarkerRenderInfo, accent: string): void {
    // ラベル文字: 背景円 + 文字で石/空点いずれでも読みやすく
    const labelText = (m.label ?? '').slice(0, 3);
    if (!labelText) return;
    const cx = m.cx.toString();
    const cy = m.cy.toString();
    const bgRadius = m.radius * 0.6;
    this.factory.append('circle', {
      cx,
      cy,
      r: bgRadius.toString(),
      class: 'marker marker-lb',
      style: `fill: ${accent}; fill-opacity: 0.85; stroke: none;`,
    });
    const textSize = (m.radius * 0.9).toString();
    const text = this.factory.append('text', {
      x: cx,
      y: cy,
      class: 'marker-label',
      'font-size': textSize,
      'font-weight': '700',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      style: `fill: #fff; stroke: #fff; stroke-width: 1; paint-order: stroke;`,
    });
    text.textContent = labelText;
  }
}
