// ============ 描画エンジン ============
import { DEFAULT_CONFIG } from './types.js';
export function getCircleNumber(n) {
    if (n >= 1 && n <= 20)
        return String.fromCharCode(0x2460 + n - 1);
    if (n >= 21 && n <= 35)
        return String.fromCharCode(0x3251 + n - 21);
    if (n >= 36 && n <= 50)
        return String.fromCharCode(0x32b1 + n - 36);
    return n.toString();
}
class RendererGeometry {
    constructor(boardSize) {
        this.boardSize = boardSize;
        this.cellSize = DEFAULT_CONFIG.CELL_SIZE;
        this.margin = DEFAULT_CONFIG.MARGIN;
        this.viewBoxSize = this.cellSize * (boardSize - 1) + this.margin * 2;
        this.coordFontSize = this.cellSize * DEFAULT_CONFIG.COORD_FONT_RATIO;
        this.moveNumberFontSize = this.cellSize * DEFAULT_CONFIG.MOVE_NUM_FONT_RATIO;
        this.letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, boardSize).split('');
    }
    coordinateAt(index) {
        return this.margin + index * this.cellSize;
    }
    toPixel(pos) {
        return {
            cx: this.margin + pos.col * this.cellSize,
            cy: this.margin + pos.row * this.cellSize
        };
    }
}
class RendererViewModelBuilder {
    constructor(store) {
        this.store = store;
    }
    buildBoardModel() {
        const state = this.store.snapshot;
        const geometry = new RendererGeometry(state.boardSize);
        return {
            geometry,
            stars: this.getStarPositions(state.boardSize),
            coordinates: this.buildCoordinateLabels(geometry),
            stones: this.buildStoneModels(state.board, geometry),
            moveNumbers: state.numberMode ? this.buildMoveNumberModels(state, geometry) : [],
            showMoveNumbers: state.numberMode
        };
    }
    buildInfoModel() {
        const state = this.store.snapshot;
        const colorText = { 1: '黒', 2: '白' };
        const modeText = state.numberMode
            ? '解答モード'
            : { black: '黒配置', white: '白配置', alt: '交互配置' }[state.mode];
        const moveInfo = state.sgfMoves.length > 0
            ? `　手数: ${state.sgfIndex}/${state.sgfMoves.length}`
            : '　手数: 0';
        const komiText = `　コミ: ${state.komi}目`;
        let handicapText = '';
        if (state.handicapStones > 0) {
            handicapText = `　${state.handicapStones}子局`;
        }
        else if (state.komi === 0) {
            handicapText = '　先番';
        }
        else {
            handicapText = '　互先';
        }
        const infoText = `${state.boardSize}路 ${moveInfo.trim()} モード:${modeText} 手番:${colorText[this.store.currentColor]}`;
        return {
            infoText,
            movesText: this.buildMoveSequenceText(state)
        };
    }
    buildSliderModel() {
        const state = this.store.snapshot;
        return {
            max: state.sgfMoves.length,
            value: state.sgfIndex
        };
    }
    buildStoneModels(board, geometry) {
        const stones = [];
        for (let row = 0; row < geometry.boardSize; row++) {
            for (let col = 0; col < geometry.boardSize; col++) {
                const cellValue = board[row][col];
                if (cellValue === 0)
                    continue;
                const { cx, cy } = geometry.toPixel({ col, row });
                stones.push({
                    position: { col, row },
                    cx,
                    cy,
                    radius: DEFAULT_CONFIG.STONE_RADIUS,
                    fill: cellValue === 1 ? 'var(--black)' : 'var(--white)',
                    strokeWidth: cellValue === 1 ? 0 : 2
                });
            }
        }
        return stones;
    }
    buildMoveNumberModels(state, geometry) {
        const start = state.numberStartIndex || 0;
        const numbers = [];
        for (let i = start; i < state.sgfIndex; i++) {
            const move = state.sgfMoves[i];
            const { cx, cy } = geometry.toPixel({ col: move.col, row: move.row });
            const fill = state.board[move.row][move.col] === 1 ? '#fff' : '#000';
            numbers.push({
                cx,
                cy,
                fontSize: geometry.moveNumberFontSize,
                fill,
                text: (i - start + 1).toString()
            });
        }
        return numbers;
    }
    buildCoordinateLabels(geometry) {
        const labels = [];
        const margin = geometry.margin;
        const bottom = geometry.viewBoxSize - margin;
        for (let i = 0; i < geometry.boardSize; i++) {
            const pos = geometry.coordinateAt(i);
            const col = geometry.letters[i];
            const row = geometry.boardSize - i;
            labels.push({
                text: col,
                x: pos,
                y: margin - 15,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: col,
                x: pos,
                y: bottom + 15,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: row.toString(),
                x: margin - 20,
                y: pos,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: row.toString(),
                x: bottom + 20,
                y: pos,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
        }
        return labels;
    }
    buildMoveSequenceText(state) {
        if (!state.numberMode || state.sgfMoves.length === 0) {
            return '';
        }
        const geometry = new RendererGeometry(state.boardSize);
        const start = state.numberStartIndex || 0;
        const sequence = [];
        for (let i = start; i < state.sgfIndex; i++) {
            const move = state.sgfMoves[i];
            const col = geometry.letters[move.col];
            const row = state.boardSize - move.row;
            const mark = move.color === 1 ? '■' : '□';
            const num = getCircleNumber(i - start + 1);
            sequence.push(`${mark}${num} ${col}${row}`);
        }
        return sequence.join(' ');
    }
    getStarPositions(boardSize) {
        const starMap = {
            9: [2, 4, 6],
            13: [3, 6, 9],
            19: [3, 9, 15]
        };
        const positions = starMap[boardSize] || [];
        const result = [];
        positions.forEach(x => {
            positions.forEach(y => {
                result.push({ col: x, row: y });
            });
        });
        return result;
    }
}
export class Renderer {
    constructor(store, elements) {
        this.store = store;
        this.elements = elements;
        this.viewModelBuilder = new RendererViewModelBuilder(store);
    }
    render() {
        const model = this.viewModelBuilder.buildBoardModel();
        const size = model.geometry.viewBoxSize;
        this.elements.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        this.elements.svg.innerHTML = '';
        this.drawBoardLines(model.geometry);
        this.drawStars(model.geometry, model.stars);
        this.drawCoordinates(model.coordinates);
        this.drawStones(model.stones);
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
        console.log(`盤サイズ更新: ${state.boardSize}路, 実際の幅: ${actualWidth}px, モバイル: ${isMobile}, 横レイアウト: ${isHorizontal}`);
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
        numbers.forEach(number => {
            const text = this.createSVGElement('text', {
                x: number.cx.toString(),
                y: number.cy.toString(),
                'font-size': number.fontSize.toString(),
                fill: number.fill,
                class: 'move-num'
            });
            text.textContent = number.text;
            this.elements.svg.appendChild(text);
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