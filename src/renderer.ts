// ============ 描画エンジン ============
import {
  BoardRenderModel,
  CoordinateLabel,
  InfoRenderModel,
  MoveNumberRenderInfo,
  Position,
  Board,
  GameState,
  SliderRenderModel,
  StoneRenderInfo,
  UIElements,
  DEFAULT_CONFIG
} from './types.js';
import { GameStore } from './state/game-store.js';

export function getCircleNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCharCode(0x32b1 + n - 36);
  return n.toString();
}

class RendererGeometry {
  readonly cellSize: number;
  readonly margin: number;
  readonly viewBoxSize: number;
  readonly coordFontSize: number;
  readonly moveNumberFontSize: number;
  readonly letters: string[];

  constructor(readonly boardSize: number) {
    this.cellSize = DEFAULT_CONFIG.CELL_SIZE;
    this.margin = DEFAULT_CONFIG.MARGIN;
    this.viewBoxSize = this.cellSize * (boardSize - 1) + this.margin * 2;
    this.coordFontSize = this.cellSize * DEFAULT_CONFIG.COORD_FONT_RATIO;
    this.moveNumberFontSize = this.cellSize * DEFAULT_CONFIG.MOVE_NUM_FONT_RATIO;
    this.letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, boardSize).split('');
  }

  coordinateAt(index: number): number {
    return this.margin + index * this.cellSize;
  }

  toPixel(pos: Position): { cx: number; cy: number } {
    return {
      cx: this.margin + pos.col * this.cellSize,
      cy: this.margin + pos.row * this.cellSize
    };
  }
}

class RendererViewModelBuilder {
  constructor(private readonly store: GameStore) {}

  buildBoardModel(): BoardRenderModel {
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

  buildInfoModel(): InfoRenderModel {
    const state = this.store.snapshot;
    const colorText = { 1: '黒', 2: '白' } as const;

    const modeText = state.numberMode
      ? '解答モード'
      : ({ black: '黒配置', white: '白配置', alt: '交互配置' } as const)[state.mode];

    const moveInfo = state.sgfMoves.length > 0
      ? `　手数: ${state.sgfIndex}/${state.sgfMoves.length}`
      : '　手数: 0';

    const komiText = `　コミ: ${state.komi}目`;

    let handicapText = '';
    if (state.handicapStones > 0) {
      handicapText = `　${state.handicapStones}子局`;
    } else if (state.komi === 0) {
      handicapText = '　先番';
    } else {
      handicapText = '　互先';
    }

    const infoText = `${state.boardSize}路 ${moveInfo.trim()} モード:${modeText} 手番:${colorText[this.store.currentColor]}`;

    return {
      infoText,
      movesText: this.buildMoveSequenceText(state)
    };
  }

  buildSliderModel(): SliderRenderModel {
    const state = this.store.snapshot;
    return {
      max: state.sgfMoves.length,
      value: state.sgfIndex
    };
  }

  private buildStoneModels(board: Board, geometry: RendererGeometry): StoneRenderInfo[] {
    const stones: StoneRenderInfo[] = [];

    for (let row = 0; row < geometry.boardSize; row++) {
      for (let col = 0; col < geometry.boardSize; col++) {
        const cellValue = board[row][col];
        if (cellValue === 0) continue;

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

  private buildMoveNumberModels(state: GameState, geometry: RendererGeometry): MoveNumberRenderInfo[] {
    const start = state.numberStartIndex || 0;
    const numbers: MoveNumberRenderInfo[] = [];

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

  private buildCoordinateLabels(geometry: RendererGeometry): CoordinateLabel[] {
    const labels: CoordinateLabel[] = [];
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

  private buildMoveSequenceText(state: GameState): string {
    if (!state.numberMode || state.sgfMoves.length === 0) {
      return '';
    }

    const geometry = new RendererGeometry(state.boardSize);
    const start = state.numberStartIndex || 0;
    const sequence: string[] = [];

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

  private getStarPositions(boardSize: number): Position[] {
    const starMap: Record<number, number[]> = {
      9: [2, 4, 6],
      13: [3, 6, 9],
      19: [3, 9, 15]
    };

    const positions = starMap[boardSize] || [];
    const result: Position[] = [];

    positions.forEach(x => {
      positions.forEach(y => {
        result.push({ col: x, row: y });
      });
    });

    return result;
  }
}

export class Renderer {
  private readonly viewModelBuilder: RendererViewModelBuilder;

  constructor(
    private readonly store: GameStore,
    private readonly elements: UIElements
  ) {
    this.viewModelBuilder = new RendererViewModelBuilder(store);
  }

  render(): void {
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

  updateInfo(): void {
    if (!this.elements.infoEl) return;

    const infoModel = this.viewModelBuilder.buildInfoModel();
    this.elements.infoEl.textContent = infoModel.infoText;

    if (this.elements.movesEl) {
      this.elements.movesEl.textContent = infoModel.movesText;
    }
  }

  updateSlider(): void {
    if (!this.elements.sliderEl) return;

    const sliderModel = this.viewModelBuilder.buildSliderModel();
    this.elements.sliderEl.max = sliderModel.max.toString();
    this.elements.sliderEl.value = sliderModel.value.toString();
  }

  updateCapturedStones(show: boolean): void {
    const container = this.elements.capturedEl;
    if (!container) return;

    container.hidden = !show;
    if (!show) {
      return;
    }

    const counts = this.store.snapshot.capturedCounts;
    container.textContent = `抜いた石: 黒 ${counts.black} / 白 ${counts.white}`;
  }

  showMessage(text: string): void {
    if (this.elements.msgEl) {
      this.elements.msgEl.textContent = text;
    }
  }

  updateBoardSize(): void {
    if (!this.elements.boardWrapper) return;

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
    } else {
      if (isMobile) {
        this.elements.boardWrapper.style.width = '100%';
        this.elements.boardWrapper.style.height = 'auto';
        this.elements.boardWrapper.style.maxWidth = '95vmin';
        this.elements.boardWrapper.style.maxHeight = 'none';
      } else {
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

  private drawBoardLines(geometry: RendererGeometry): void {
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

  private drawStars(geometry: RendererGeometry, stars: Position[]): void {
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

  private drawCoordinates(labels: CoordinateLabel[]): void {
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

  private drawStones(stones: StoneRenderInfo[]): void {
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

  private drawMoveNumbers(numbers: MoveNumberRenderInfo[]): void {
    numbers.forEach(number => {

      // === 背景円（透け防止＋視認性最大化） ===
      // 石の半径 ≒ number.fontSize * 約1.3〜1.35 に近い
      // → これに合わせて背景円を95%ほどに設定
      const bgRadius = number.fontSize * 1.15;

      // 白石の上の黒数字 → 背景は濃い黒
      // 黒石の上の白数字 → 背景は純白
      // （別ソフトもこの方式）
      const bgColor = number.fill === '#000'
        ? '#ffffff'
        : '#000000';

      const bg = this.createSVGElement('circle', {
        cx: number.cx.toString(),
        cy: number.cy.toString(),
        r: bgRadius.toString(),
        fill: bgColor,
        filter: 'url(#num-shadow)'  // 背景ごと影を付けて浮かせる
      });

      this.elements.svg.appendChild(bg);


      // === 数字本体 ===
      const text = this.createSVGElement('text', {
        x: number.cx.toString(),
        y: number.cy.toString(),
        fill: number.fill,  // 白 or 黒
        class: 'move-num'
      });

      // 超太字（900相当）
      text.setAttribute('font-weight', '900');

      // 数字の大きさ
      const size = number.fontSize * 1.20;
      text.setAttribute('font-size', size.toString());

      // 視認性の肝：太い縁取り（石画像みたいに見える）
      text.setAttribute('stroke', '#000');
      text.setAttribute('stroke-width', (size * 0.22).toString());
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('dominant-baseline', 'central');

      // 数字にも影を微弱に乗せる
      text.setAttribute('filter', 'url(#num-shadow)');

      text.textContent = number.text;
      this.elements.svg.appendChild(text);
    });
  }

  private createSVGElement(tag: string, attributes: { [key: string]: string }): SVGElement {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);

    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }

    return element;
  }
}
