// ============ 描画エンジン (DOM) ============
// ViewModelBuilder が生成した中間オブジェクトを SVG DOM に変換する。
// DOM 操作用の薄いラッパー。
import { DEFAULT_CONFIG } from '../types.js';
import { RendererViewModelBuilder } from './view-model.js';
export class Renderer {
    constructor(store, elements, getPreferences) {
        this.store = store;
        this.elements = elements;
        this.getPreferences = getPreferences;
        this.viewModelBuilder = new RendererViewModelBuilder(store, getPreferences);
    }
    // 通常は renderer.render() のままでOK
    // 盤面保存時だけ renderer.render({ suppressLastMoveHighlight: true }) を使う
    render(options) {
        const model = this.viewModelBuilder.buildBoardModel(options);
        const size = model.geometry.viewBoxSize;
        this.elements.svg.innerHTML = '';
        this.elements.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        // === 数字用影フィルタ ===
        const defs = this.createSVGElement('defs', {});
        const shadow = this.createSVGElement('filter', { id: 'num-shadow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
        const fe = this.createSVGElement('feDropShadow', {
            dx: '1.0',
            dy: '1.0',
            stdDeviation: '1.0',
            'flood-color': '#000',
            'flood-opacity': '0.55'
        });
        shadow.appendChild(fe);
        defs.appendChild(shadow);
        this.elements.svg.appendChild(defs);
        // =========================
        this.drawBoardLines(model.geometry);
        this.drawStars(model.geometry, model.stars);
        this.drawCoordinates(model.coordinates);
        this.drawStones(model.stones);
        if (model.lastMoveHighlight) {
            this.drawLastMoveHighlight(model.lastMoveHighlight);
        }
        if (model.showMarkers) {
            this.drawMarkers(model.markers);
        }
        if (model.showMoveNumbers) {
            this.drawMoveNumbers(model.moveNumbers);
        }
    }
    updateInfo() {
        if (!this.elements.infoEl)
            return;
        const infoModel = this.viewModelBuilder.buildInfoModel();
        this.elements.infoEl.textContent = infoModel.infoText;
        if (this.elements.movesEl) {
            this.elements.movesEl.textContent = infoModel.movesText;
        }
    }
    updateSlider() {
        if (!this.elements.sliderEl)
            return;
        const sliderModel = this.viewModelBuilder.buildSliderModel();
        this.elements.sliderEl.max = sliderModel.max.toString();
        this.elements.sliderEl.value = sliderModel.value.toString();
    }
    updateCapturedStones(show) {
        const container = this.elements.capturedEl;
        if (!container)
            return;
        container.hidden = !show;
        if (!show) {
            return;
        }
        const counts = this.store.snapshot.capturedCounts;
        container.textContent = `抜いた石: 黒 ${counts.black} / 白 ${counts.white}`;
    }
    showMessage(text) {
        if (this.elements.msgEl) {
            this.elements.msgEl.textContent = text;
        }
    }
    updateBoardSize() {
        if (!this.elements.boardWrapper)
            return;
        const state = this.store.snapshot;
        const isHorizontal = document.body.classList.contains('horizontal');
        const isMobile = window.innerWidth <= 768;
        if (isHorizontal) {
            const availableWidth = window.innerWidth - (isMobile ? 250 : 350);
            const availableHeight = window.innerHeight * 0.95;
            const maxSize = Math.min(availableWidth, availableHeight);
            this.elements.boardWrapper.style.width = maxSize + 'px';
            this.elements.boardWrapper.style.height = maxSize + 'px';
            this.elements.boardWrapper.style.maxWidth = maxSize + 'px';
            this.elements.boardWrapper.style.maxHeight = maxSize + 'px';
        }
        else {
            if (isMobile) {
                this.elements.boardWrapper.style.width = '100%';
                this.elements.boardWrapper.style.height = 'auto';
                this.elements.boardWrapper.style.maxWidth = '95vmin';
                this.elements.boardWrapper.style.maxHeight = 'none';
            }
            else {
                const baseSize = DEFAULT_CONFIG.CELL_SIZE;
                const sizePx = baseSize * state.boardSize;
                this.elements.boardWrapper.style.width = sizePx + 'px';
                this.elements.boardWrapper.style.height = 'auto';
                this.elements.boardWrapper.style.maxWidth = '70vmin';
                this.elements.boardWrapper.style.maxHeight = 'none';
            }
        }
        this.elements.boardWrapper.offsetHeight;
        const actualWidth = this.elements.boardWrapper.getBoundingClientRect().width;
        document.documentElement.style.setProperty('--board-width', actualWidth + 'px');
    }
    drawBoardLines(geometry) {
        const margin = geometry.margin;
        const far = geometry.viewBoxSize - margin;
        for (let i = 0; i < geometry.boardSize; i++) {
            const pos = geometry.coordinateAt(i);
            this.elements.svg.appendChild(this.createSVGElement('line', {
                x1: pos.toString(),
                y1: margin.toString(),
                x2: pos.toString(),
                y2: far.toString(),
                stroke: 'var(--line)',
                'stroke-width': '2'
            }));
            this.elements.svg.appendChild(this.createSVGElement('line', {
                x1: margin.toString(),
                y1: pos.toString(),
                x2: far.toString(),
                y2: pos.toString(),
                stroke: 'var(--line)',
                'stroke-width': '2'
            }));
        }
    }
    drawStars(geometry, stars) {
        stars.forEach(({ col, row }) => {
            const { cx, cy } = geometry.toPixel({ col, row });
            this.elements.svg.appendChild(this.createSVGElement('circle', {
                cx: cx.toString(),
                cy: cy.toString(),
                r: DEFAULT_CONFIG.STAR_RADIUS.toString(),
                class: 'star'
            }));
        });
    }
    drawCoordinates(labels) {
        labels.forEach(label => {
            const text = this.createSVGElement('text', {
                x: label.x.toString(),
                y: label.y.toString(),
                class: label.className,
                'font-size': label.fontSize.toString()
            });
            text.textContent = label.text;
            this.elements.svg.appendChild(text);
        });
    }
    drawStones(stones) {
        stones.forEach(stone => {
            this.elements.svg.appendChild(this.createSVGElement('circle', {
                cx: stone.cx.toString(),
                cy: stone.cy.toString(),
                r: stone.radius.toString(),
                class: 'stone',
                fill: stone.fill,
                stroke: '#000',
                'stroke-width': stone.strokeWidth.toString()
            }));
        });
    }
    drawMoveNumbers(numbers) {
        const stoneRadius = DEFAULT_CONFIG.STONE_RADIUS;
        const borderMargin = DEFAULT_CONFIG.MOVE_NUM_BORDER_MARGIN;
        numbers.forEach(number => {
            // 元の計算値
            const idealRadius = number.fontSize * DEFAULT_CONFIG.MOVE_NUM_BG_RADIUS_RATIO;
            // 背景円が石の内側に収まるようにクリップ
            const maxRadius = stoneRadius - borderMargin;
            const bgRadius = Math.min(idealRadius, maxRadius);
            const bgColor = number.fill === '#000'
                ? '#ffffff' // 白石の上の黒数字 → 白背景
                : '#000000'; // 黒石の上の白数字 → 黒背景
            // === 背景円 ===
            const bg = this.createSVGElement('circle', {
                cx: number.cx.toString(),
                cy: number.cy.toString(),
                r: bgRadius.toString(),
                fill: bgColor,
                filter: 'url(#num-shadow)'
            });
            this.elements.svg.appendChild(bg);
            // === 数字本体 ===
            const text = this.createSVGElement('text', {
                x: number.cx.toString(),
                y: number.cy.toString(),
                fill: number.fill,
                class: 'move-num',
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
            });
            const size = number.fontSize * DEFAULT_CONFIG.MOVE_NUM_FONT_SCALE;
            text.setAttribute('font-weight', '900');
            text.setAttribute('font-size', size.toString());
            const strokeColor = number.fill === '#000' ? '#fff' : '#000';
            text.setAttribute('stroke', strokeColor);
            text.setAttribute('stroke-width', (size * DEFAULT_CONFIG.MOVE_NUM_STROKE_RATIO).toString());
            text.setAttribute('paint-order', 'stroke');
            text.setAttribute('filter', 'url(#num-shadow)');
            text.textContent = number.text;
            this.elements.svg.appendChild(text);
        });
    }
    drawLastMoveHighlight(highlight) {
        // --accent を解決してインライン stroke として設定する（盤面保存の
        // cloneNode(true) → SVG→PNG 変換で CSS クラスが効かないため）
        const rootStyle = getComputedStyle(document.documentElement);
        const accent = (rootStyle.getPropertyValue('--accent') || '#d9534f').trim();
        this.elements.svg.appendChild(this.createSVGElement('circle', {
            cx: highlight.cx.toString(),
            cy: highlight.cy.toString(),
            r: highlight.radius.toString(),
            class: 'last-move-highlight',
            style: `fill: none; stroke: ${accent};`,
        }));
    }
    drawMarkers(markers) {
        if (!markers || markers.length === 0)
            return;
        const stroke = DEFAULT_CONFIG.MARKER_STROKE_WIDTH.toString();
        // --accent を解決してインライン stroke として設定する。
        // こうすると盤面保存時の cloneNode(true) → SVG→PNG 変換でも
        // 外部 CSS に頼らずマーカー色が残る。
        const rootStyle = getComputedStyle(document.documentElement);
        const accent = (rootStyle.getPropertyValue('--accent') || '#d9534f').trim();
        const markerStyle = `stroke: ${accent}; fill: none;`;
        const maStyle = `stroke: ${accent};`;
        markers.forEach((m) => {
            var _a;
            const cx = m.cx.toString();
            const cy = m.cy.toString();
            const r = m.radius.toString();
            switch (m.kind) {
                case 'CR': {
                    this.elements.svg.appendChild(this.createSVGElement('circle', {
                        cx, cy, r,
                        class: 'marker marker-cr',
                        style: markerStyle,
                        'stroke-width': stroke,
                    }));
                    break;
                }
                case 'TR': {
                    // 上向き正三角形: 中心 (cx,cy) 半径 r
                    const top = { x: m.cx, y: m.cy - m.radius };
                    const left = { x: m.cx - m.radius * Math.sin(Math.PI / 3), y: m.cy + m.radius * 0.5 };
                    const right = { x: m.cx + m.radius * Math.sin(Math.PI / 3), y: m.cy + m.radius * 0.5 };
                    const points = `${top.x},${top.y} ${left.x},${left.y} ${right.x},${right.y}`;
                    this.elements.svg.appendChild(this.createSVGElement('polygon', {
                        points,
                        class: 'marker marker-tr',
                        style: markerStyle,
                        'stroke-width': stroke,
                    }));
                    break;
                }
                case 'SQ': {
                    const half = m.radius * 0.85;
                    const x = (m.cx - half).toString();
                    const y = (m.cy - half).toString();
                    const size = (half * 2).toString();
                    this.elements.svg.appendChild(this.createSVGElement('rect', {
                        x, y, width: size, height: size,
                        rx: '2', ry: '2',
                        class: 'marker marker-sq',
                        style: markerStyle,
                        'stroke-width': stroke,
                    }));
                    break;
                }
                case 'MA': {
                    // × 印: 2本の対角線
                    const d = m.radius * 0.7;
                    this.elements.svg.appendChild(this.createSVGElement('line', {
                        x1: (m.cx - d).toString(),
                        y1: (m.cy - d).toString(),
                        x2: (m.cx + d).toString(),
                        y2: (m.cy + d).toString(),
                        class: 'marker marker-ma',
                        style: maStyle,
                        'stroke-width': stroke,
                    }));
                    this.elements.svg.appendChild(this.createSVGElement('line', {
                        x1: (m.cx - d).toString(),
                        y1: (m.cy + d).toString(),
                        x2: (m.cx + d).toString(),
                        y2: (m.cy - d).toString(),
                        class: 'marker marker-ma',
                        style: maStyle,
                        'stroke-width': stroke,
                    }));
                    break;
                }
                case 'LB': {
                    // ラベル文字: 背景円 + 文字で石/空点いずれでも読みやすく
                    const labelText = ((_a = m.label) !== null && _a !== void 0 ? _a : '').slice(0, 3);
                    if (!labelText)
                        break;
                    const bgRadius = m.radius * 0.6;
                    this.elements.svg.appendChild(this.createSVGElement('circle', {
                        cx,
                        cy,
                        r: bgRadius.toString(),
                        class: 'marker marker-lb',
                        style: `fill: ${accent}; fill-opacity: 0.85; stroke: none;`,
                    }));
                    const textSize = (m.radius * 0.9).toString();
                    const text = this.createSVGElement('text', {
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
                    this.elements.svg.appendChild(text);
                    break;
                }
                default: {
                    const _exhaustive = m.kind;
                    void _exhaustive;
                }
            }
        });
    }
    createSVGElement(tag, attributes) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        return element;
    }
}
//# sourceMappingURL=renderer.js.map