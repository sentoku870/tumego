// ============ 描画エンジン ============
import { GameState, Position, DEFAULT_CONFIG, UIElements } from './types.js';

export class Renderer {
  constructor(
    private state: GameState,
    private elements: UIElements
  ) {}

  // ============ メイン描画 ============
  render(): void {
    const N = this.state.boardSize;
    const size = DEFAULT_CONFIG.CELL_SIZE * (N - 1) + DEFAULT_CONFIG.MARGIN * 2;
    
    this.elements.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    this.elements.svg.innerHTML = '';

    this.drawBoardLines(N, size);
    this.drawStars(N);
    this.drawCoordinates(N, size);
    this.drawStones();
    
    if (this.state.numberMode) {
      this.drawMoveNumbers();
    }
  }

  // ============ 碁盤線描画 ============
  private drawBoardLines(N: number, size: number): void {
    for (let i = 0; i < N; i++) {
      const pos = DEFAULT_CONFIG.MARGIN + i * DEFAULT_CONFIG.CELL_SIZE;
      
      // 縦線
      this.elements.svg.appendChild(this.createSVGElement('line', {
        x1: pos.toString(),
        y1: DEFAULT_CONFIG.MARGIN.toString(),
        x2: pos.toString(),
        y2: (size - DEFAULT_CONFIG.MARGIN).toString(),
        stroke: 'var(--line)',
        'stroke-width': '2'
      }));
      
      // 横線
      this.elements.svg.appendChild(this.createSVGElement('line', {
        x1: DEFAULT_CONFIG.MARGIN.toString(),
        y1: pos.toString(),
        x2: (size - DEFAULT_CONFIG.MARGIN).toString(),
        y2: pos.toString(),
        stroke: 'var(--line)',
        'stroke-width': '2'
      }));
    }
  }

  // ============ 星描画 ============
  private drawStars(N: number): void {
    const starPositions = this.getStarPositions(N);
    
    starPositions.forEach(([ix, iy]) => {
      const cx = DEFAULT_CONFIG.MARGIN + ix * DEFAULT_CONFIG.CELL_SIZE;
      const cy = DEFAULT_CONFIG.MARGIN + iy * DEFAULT_CONFIG.CELL_SIZE;
      
      this.elements.svg.appendChild(this.createSVGElement('circle', {
        cx: cx.toString(),
        cy: cy.toString(),
        r: DEFAULT_CONFIG.STAR_RADIUS.toString(),
        class: 'star'
      }));
    });
  }

  private getStarPositions(N: number): number[][] {
    const starMap: { [key: number]: number[] } = {
      9: [2, 4, 6],
      13: [3, 6, 9],
      19: [3, 9, 15]
    };
    
    const positions = starMap[N] || [];
    const result: number[][] = [];
    
    positions.forEach(x => {
      positions.forEach(y => {
        result.push([x, y]);
      });
    });
    
    return result;
  }

  // ============ 座標描画 ============
  private drawCoordinates(N: number, size: number): void {
    const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, N).split('');
    const fontSize = DEFAULT_CONFIG.CELL_SIZE * DEFAULT_CONFIG.COORD_FONT_RATIO;

    for (let i = 0; i < N; i++) {
      const pos = DEFAULT_CONFIG.MARGIN + i * DEFAULT_CONFIG.CELL_SIZE;
      const col = letters[i];
      const row = N - i;

      // 上の座標
      const topText = this.createSVGElement('text', {
        x: pos.toString(),
        y: (DEFAULT_CONFIG.MARGIN - 15).toString(),
        class: 'coord',
        'font-size': fontSize.toString()
      });
      topText.textContent = col;
      this.elements.svg.appendChild(topText);

      // 下の座標
      const bottomText = this.createSVGElement('text', {
        x: pos.toString(),
        y: (size - DEFAULT_CONFIG.MARGIN + 15).toString(),
        class: 'coord',
        'font-size': fontSize.toString()
      });
      bottomText.textContent = col;
      this.elements.svg.appendChild(bottomText);

      // 左の座標
      const leftText = this.createSVGElement('text', {
        x: (DEFAULT_CONFIG.MARGIN - 20).toString(),
        y: pos.toString(),
        class: 'coord',
        'font-size': fontSize.toString()
      });
      leftText.textContent = row.toString();
      this.elements.svg.appendChild(leftText);

      // 右の座標
      const rightText = this.createSVGElement('text', {
        x: (size - DEFAULT_CONFIG.MARGIN + 20).toString(),
        y: pos.toString(),
        class: 'coord',
        'font-size': fontSize.toString()
      });
      rightText.textContent = row.toString();
      this.elements.svg.appendChild(rightText);
    }
  }

  // ============ 石描画 ============
  private drawStones(): void {
    // 既存の石を削除
    this.elements.svg.querySelectorAll('.stone').forEach(el => el.remove());

    for (let y = 0; y < this.state.boardSize; y++) {
      for (let x = 0; x < this.state.boardSize; x++) {
        const cellValue = this.state.board[y][x];
        if (cellValue === 0) continue;

        const cx = DEFAULT_CONFIG.MARGIN + x * DEFAULT_CONFIG.CELL_SIZE;
        const cy = DEFAULT_CONFIG.MARGIN + y * DEFAULT_CONFIG.CELL_SIZE;

        this.elements.svg.appendChild(this.createSVGElement('circle', {
          cx: cx.toString(),
          cy: cy.toString(),
          r: DEFAULT_CONFIG.STONE_RADIUS.toString(),
          class: 'stone',
          fill: cellValue === 1 ? 'var(--black)' : 'var(--white)',
          stroke: '#000',
          'stroke-width': cellValue === 1 ? '0' : '2'
        }));
      }
    }
  }

  // ============ 手順番号描画 ============
  private drawMoveNumbers(): void {
    const start = this.state.numberStartIndex || 0;
    const fontSize = DEFAULT_CONFIG.CELL_SIZE * DEFAULT_CONFIG.MOVE_NUM_FONT_RATIO;

    for (let i = start; i < this.state.sgfIndex; i++) {
      const move = this.state.sgfMoves[i];
      const cx = DEFAULT_CONFIG.MARGIN + move.col * DEFAULT_CONFIG.CELL_SIZE;
      const cy = DEFAULT_CONFIG.MARGIN + move.row * DEFAULT_CONFIG.CELL_SIZE;
      
      const fill = this.state.board[move.row][move.col] === 1 ? '#fff' : '#000';

      const numberText = this.createSVGElement('text', {
        x: cx.toString(),
        y: cy.toString(),
        'font-size': fontSize.toString(),
        fill: fill,
        class: 'move-num'
      });
      numberText.textContent = (i - start + 1).toString();
      this.elements.svg.appendChild(numberText);
    }
  }

  // ============ 情報更新 ============
  updateInfo(): void {
    if (!this.elements.infoEl) return;

    const colorText = { 1: '黒', 2: '白' };
    let turnColor = this.getCurrentColor();
    let modeText = '';

    if (this.state.numberMode) {
      modeText = '解答モード';
    } else {
      const modeMap = { black: '黒配置', white: '白配置', alt: '交互配置' };
      modeText = modeMap[this.state.mode];
    }

    // 手数情報
    const moveInfo = this.state.sgfMoves.length > 0 
      ? `　手数: ${this.state.sgfIndex}/${this.state.sgfMoves.length}`
      : `　手数: 0`;

    // コミ情報
    const komiText = `　コミ: ${this.state.komi}目`;

    // 置石情報
    let handicapText = '';
    if (this.state.handicapStones > 0) {
      handicapText = `　${this.state.handicapStones}子局`;
    } else if (this.state.komi === 0) {
      handicapText = `　先番`;
    } else {
      handicapText = `　互先`;
    }

    this.elements.infoEl.textContent = 
      `盤サイズ: ${this.state.boardSize}路　モード: ${modeText}${moveInfo}${komiText}${handicapText}　次の手番: ${colorText[turnColor]}`;

    this.updateMoves();
  }

  private updateMoves(): void {
    if (!this.elements.movesEl) return;

    if (this.state.numberMode && this.state.sgfMoves.length) {
      const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, this.state.boardSize).split('');
      const start = this.state.numberStartIndex || 0;
      const sequence = [];

      for (let i = start; i < this.state.sgfIndex; i++) {
        const move = this.state.sgfMoves[i];
        const col = letters[move.col];
        const row = this.state.boardSize - move.row;
        const mark = move.color === 1 ? '■' : '□';
        const num = this.getCircleNumber(i - start + 1);
        sequence.push(`${mark}${num} ${col}${row}`);
      }

      this.elements.movesEl.textContent = sequence.join(' ');
    } else {
      this.elements.movesEl.textContent = '';
    }
  }

  private getCircleNumber(n: number): string {
    if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
    if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
    if (n >= 36 && n <= 50) return String.fromCharCode(0x32b1 + n - 36);
    return n.toString();
  }

  private getCurrentColor(): 1 | 2 {
    if (this.state.numberMode) {
      return this.state.turn % 2 === 0 ? this.state.startColor : (3 - this.state.startColor) as 1 | 2;
    }
    
    if (this.state.mode === 'alt') {
      return this.state.turn % 2 === 0 ? this.state.startColor : (3 - this.state.startColor) as 1 | 2;
    }
    
    return this.state.mode === 'black' ? 1 : 2;
  }

  // ============ スライダー更新 ============
  updateSlider(): void {
    if (!this.elements.sliderEl) return;
    
    this.elements.sliderEl.max = this.state.sgfMoves.length.toString();
    this.elements.sliderEl.value = this.state.sgfIndex.toString();
  }

  // ============ ユーティリティ ============
  private createSVGElement(tag: string, attributes: { [key: string]: string }): SVGElement {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    
    return element;
  }

  // ============ メッセージ表示 ============
  showMessage(text: string): void {
    if (this.elements.msgEl) {
      this.elements.msgEl.textContent = text;
    }
  }

  // ============ 盤サイズ更新 ============
  updateBoardSize(): void {
    if (!this.elements.boardWrapper) return;

    // モバイル優先の設定
    const isHorizontal = document.body.classList.contains('horizontal');
    const isMobile = window.innerWidth <= 768; // モバイル判定
    
    if (isMobile) {
      // モバイル: 画面いっぱいに表示
      const maxSize = isHorizontal ? '95vh' : '95vmin';
      this.elements.boardWrapper.style.width = '100%';
      this.elements.boardWrapper.style.maxWidth = maxSize;
    } else {
      // PC: 路数に応じてサイズを調整
      const baseSize = DEFAULT_CONFIG.CELL_SIZE;
      const sizePx = baseSize * this.state.boardSize;
      this.elements.boardWrapper.style.width = sizePx + 'px';
      this.elements.boardWrapper.style.maxWidth = isHorizontal ? '70vh' : '70vmin';
    }
    
    // 強制的にレイアウトを再計算
    this.elements.boardWrapper.offsetHeight;
    
    const actualWidth = this.elements.boardWrapper.getBoundingClientRect().width;
    document.documentElement.style.setProperty('--board-width', actualWidth + 'px');
    
    console.log(`盤サイズ更新: ${this.state.boardSize}路, 実際の幅: ${actualWidth}px, モバイル: ${isMobile}`);
  }
}