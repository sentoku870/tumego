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
        this.elements.svg.appendChild(this.createSVGElement('circle', {
            cx: highlight.cx.toString(),
            cy: highlight.cy.toString(),
            r: highlight.radius.toString(),
            class: 'last-move-highlight'
        }));
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