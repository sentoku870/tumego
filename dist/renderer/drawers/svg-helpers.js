// ============ SVG 描画ヘルパ ============
// 各 drawer が共通で使う SVG 要素生成と CSS 変数解決を集約する。
import { DEFAULT_CONFIG } from '../../types.js';
export class SvgElementFactory {
    constructor(svg) {
        this.svg = svg;
    }
    /** SVG 要素を生成して svg に追加する */
    append(tag, attributes) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        this.svg.appendChild(element);
        return element;
    }
    /** SVG 要素を生成するだけで svg には追加しない */
    create(tag, attributes) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        return element;
    }
}
/**
 * CSS カスタムプロパティの解決ヘルパ。
 * SVG→PNG 変換時に外部 CSS が効かないため、インラインスタイルで使う。
 */
export function resolveCssVar(name, fallback) {
    const rootStyle = getComputedStyle(document.documentElement);
    return (rootStyle.getPropertyValue(name) || fallback).trim();
}
export const STROKE_DEFAULT = 'var(--line)';
export const STAR_RADIUS = DEFAULT_CONFIG.STAR_RADIUS;
export const STONE_RADIUS = DEFAULT_CONFIG.STONE_RADIUS;
//# sourceMappingURL=svg-helpers.js.map