import { RendererViewModelBuilder } from './view-model.js';
import { SvgElementFactory } from './drawers/svg-helpers.js';
import { BoardDrawer } from './drawers/board-drawer.js';
import { CoordinatesDrawer } from './drawers/coordinates-drawer.js';
import { StonesDrawer } from './drawers/stones-drawer.js';
import { HighlightDrawer } from './drawers/highlight-drawer.js';
import { MarkersDrawer } from './drawers/markers-drawer.js';
export class Renderer {
    constructor(store, elements, getPreferences, uiState) {
        this.store = store;
        this.elements = elements;
        this.getPreferences = getPreferences;
        this.uiState = uiState;
        this.viewModelBuilder = new RendererViewModelBuilder(store, getPreferences);
        this.factory = new SvgElementFactory(elements.svg);
        this.boardDrawer = new BoardDrawer(this.factory);
        this.coordinatesDrawer = new CoordinatesDrawer(this.factory);
        this.stonesDrawer = new StonesDrawer(this.factory);
        this.highlightDrawer = new HighlightDrawer(this.factory);
        this.markersDrawer = new MarkersDrawer(this.factory);
    }
    // 通常は renderer.render() のままでOK
    // 盤面保存時だけ renderer.render({ suppressLastMoveHighlight: true }) を使う
    render(options) {
        var _a, _b, _c;
        const grabbedStone = (_c = (_b = (_a = this.uiState) === null || _a === void 0 ? void 0 : _a.drag.grabbedStone) === null || _b === void 0 ? void 0 : _b.pos) !== null && _c !== void 0 ? _c : null;
        const model = this.viewModelBuilder.buildBoardModel({
            ...options,
            grabbedStone,
        });
        const size = model.geometry.viewBoxSize;
        this.elements.svg.innerHTML = '';
        this.elements.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        this.installNumberShadowDef();
        this.boardDrawer.drawLines(model.geometry);
        this.boardDrawer.drawStars(model.geometry, model.stars);
        this.coordinatesDrawer.draw(model.coordinates);
        this.stonesDrawer.drawStones(model.stones);
        if (model.lastMoveHighlight) {
            this.highlightDrawer.drawLastMove(model.lastMoveHighlight);
        }
        if (model.showMarkers) {
            this.markersDrawer.draw(model.markers);
        }
        if (model.showMoveNumbers) {
            this.stonesDrawer.drawMoveNumbers(model.moveNumbers);
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
                const baseSize = DEFAULT_CONFIG_CELL_SIZE;
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
    /** 数字用影フィルタ (<filter id="num-shadow">) を svg に追加する */
    installNumberShadowDef() {
        const defs = this.factory.append('defs', {});
        const shadow = this.factory.create('filter', {
            id: 'num-shadow',
            x: '-50%',
            y: '-50%',
            width: '200%',
            height: '200%'
        });
        const fe = this.factory.create('feDropShadow', {
            dx: '1.0',
            dy: '1.0',
            stdDeviation: '1.0',
            'flood-color': '#000',
            'flood-opacity': '0.55'
        });
        shadow.appendChild(fe);
        defs.appendChild(shadow);
    }
}
// 循環依存を避けるため CELL_SIZE はローカル定数で参照
const DEFAULT_CONFIG_CELL_SIZE = 60;
//# sourceMappingURL=renderer.js.map