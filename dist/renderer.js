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
    constructor(store, getPreferences) {
        this.store = store;
        this.getPreferences = getPreferences;
    }
    // suppressLastMoveHighlight: true のときは「直前の手ハイライト」を出さない
    buildBoardModel(options) {
        const state = this.store.snapshot;
        const geometry = new RendererGeometry(state.boardSize);
        const prefs = this.getPreferences();
        const showMoveNumbers = state.numberMode && prefs.solve.showSolutionMoveNumbers;
        // ここで boolean に変換する（'on' / 'off' などは実際の定義に合わせてください）
        const showCapturedStones = prefs.solve.showCapturedStones === 'on'; // ★ここがポイント
        // ハイライト有効かどうかをここで一元管理
        const enableLastMoveHighlight = prefs.solve.highlightLastMove && !(options === null || options === void 0 ? void 0 : options.suppressLastMoveHighlight);
        return {
            geometry,
            stars: this.getStarPositions(state.boardSize),
            coordinates: this.buildCoordinateLabels(geometry),
            stones: this.buildStoneModels(state.board, geometry),
            moveNumbers: showMoveNumbers
                ? this.buildMoveNumberModels(state, geometry, showCapturedStones) // ← boolean
                : [],
            showMoveNumbers,
            lastMoveHighlight: enableLastMoveHighlight
                ? this.buildLastMoveHighlight(state, geometry)
                : undefined,
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
    // showCapturedStones:
    //   true  -> 抜き石の位置にも番号を描画
    //   false -> 盤上に残っている石の上にだけ番号を描画
    buildMoveNumberModels(state, geometry, showCapturedStones) {
        const start = state.numberStartIndex || 0;
        const numbers = [];
        for (let i = start; i < state.sgfIndex; i++) {
            const move = state.sgfMoves[i];
            if (!move)
                continue;
            // 「抜いた石を表示する」が OFF のときは、
            // すでに盤上に存在しない手（抜き石位置）はスキップする
            if (!showCapturedStones && state.board[move.row][move.col] === 0) {
                continue;
            }
            // 正しい描画色は sgfMoves の color
            const fill = move.color === 1 ? '#fff' : '#000';
            const { cx, cy } = geometry.toPixel({ col: move.col, row: move.row });
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
    buildLastMoveHighlight(state, geometry) {
        if (state.sgfIndex <= 0 || state.sgfIndex > state.sgfMoves.length) {
            return undefined;
        }
        const lastMove = state.sgfMoves[state.sgfIndex - 1];
        if (!lastMove) {
            return undefined;
        }
        const { cx, cy } = geometry.toPixel({ col: lastMove.col, row: lastMove.row });
        return {
            cx,
            cy,
            radius: DEFAULT_CONFIG.STONE_RADIUS + 5,
        };
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
        const stoneRadius = DEFAULT_CONFIG.STONE_RADIUS;
        const borderMargin = 2; // 黒枠を残すための余白(調整用)
        numbers.forEach(number => {
            // 元の計算値
            const idealRadius = number.fontSize * 1.15;
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
            const size = number.fontSize * 1.20;
            text.setAttribute('font-weight', '900');
            text.setAttribute('font-size', size.toString());
            const strokeColor = number.fill === '#000' ? '#fff' : '#000';
            text.setAttribute('stroke', strokeColor);
            text.setAttribute('stroke-width', (size * 0.22).toString());
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