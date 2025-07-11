// ============ UI制御エンジン ============
import { GameState, Position, StoneColor, DragState, UIElements, KeyBindings, DEFAULT_CONFIG } from './types.js';
import { GoEngine } from './go-engine.js';
import { Renderer } from './renderer.js';
import { SGFParser } from './sgf-parser.js';
import { QRManager } from './qr-manager.js';
import { HistoryManager } from './history-manager.js';

export class UIController {
  private engine: GoEngine;
  private renderer: Renderer;
  private sgfParser: SGFParser;
  private qrManager: QRManager;
  private historyManager: HistoryManager;
  private dragState: DragState = {
    dragging: false,
    dragColor: null,
    lastPos: null
  };
  private boardHasFocus = false;
  private touchStartY = 0;

  constructor(
    private state: GameState,
    private elements: UIElements
  ) {
    this.engine = new GoEngine(state);
    this.renderer = new Renderer(state, elements);
    this.sgfParser = new SGFParser();
    this.qrManager = new QRManager();
    this.historyManager = new HistoryManager();
    
    // エンジンに履歴管理を設定
    this.engine.setHistoryManager(this.historyManager);
    
    this.initEventListeners();
  }

  // ============ イベントリスナー初期化 ============
  private initEventListeners(): void {
    this.initBoardEvents();
    this.initSVGEvents();
    this.initButtonEvents();
    this.initKeyboardEvents();
    this.initResizeEvents();
  }

  // ============ 盤面イベント ============
  private initBoardEvents(): void {
    this.elements.boardWrapper.tabIndex = 0;
    
    this.elements.boardWrapper.addEventListener('pointerenter', () => {
      this.boardHasFocus = true;
    });
    
    this.elements.boardWrapper.addEventListener('pointerleave', () => {
      this.boardHasFocus = false;
    });
    
    this.elements.boardWrapper.addEventListener('pointerdown', () => {
      this.boardHasFocus = true;
      this.elements.boardWrapper.focus();
    });
    
    this.elements.boardWrapper.addEventListener('blur', () => {
      this.boardHasFocus = false;
    });

    // タッチイベント処理
    this.elements.boardWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.elements.boardWrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const touchY = e.touches[0].clientY;
        const deltaY = Math.abs(touchY - this.touchStartY);
        if (deltaY < 10) {
          e.preventDefault();
        }
      }
    }, { passive: false });
  }

  // ============ SVGイベント ============
  private initSVGEvents(): void {
    this.elements.svg.addEventListener('pointerdown', (e) => {
      this.handlePointerDown(e);
    });

    this.elements.svg.addEventListener('pointermove', (e) => {
      this.handlePointerMove(e);
    });

    this.elements.svg.addEventListener('pointerup', (e) => {
      this.handlePointerEnd(e);
    });

    this.elements.svg.addEventListener('pointercancel', (e) => {
      this.handlePointerEnd(e);
    });

    this.elements.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // ============ ポインターイベント処理 ============
  private handlePointerDown(e: PointerEvent): void {
    this.boardHasFocus = true;
    this.elements.boardWrapper.focus();
    
    if (e.button === 2) e.preventDefault();

    if (this.state.eraseMode) {
      this.dragState.dragColor = null;
    } else if (this.state.mode === 'alt') {
      if (e.button === 0) {
        this.dragState.dragColor = null; // 交互配置に従う
      } else {
        return; // 右クリックは無効
      }
    } else {
      const leftColor = this.state.mode === 'white' ? 2 : 1;
      const rightColor = this.state.mode === 'white' ? 1 : 2;
      this.dragState.dragColor = e.button === 0 ? leftColor as StoneColor : 
                                 e.button === 2 ? rightColor as StoneColor : null;
    }

    this.dragState.dragging = true;
    this.dragState.lastPos = null;
    this.elements.svg.setPointerCapture(e.pointerId);
    this.placeAtEvent(e);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragState.dragging) {
      if (this.state.eraseMode && e.buttons) {
        this.dragState.dragging = true;
        this.dragState.lastPos = null;
      } else {
        return;
      }
    }

    // 交互配置モードではドラッグ無効
    if (this.state.mode === 'alt' && !this.state.eraseMode) {
      return;
    }

    const pos = this.getPositionFromEvent(e);
    if (this.dragState.lastPos && 
        this.dragState.lastPos.col === pos.col && 
        this.dragState.lastPos.row === pos.row) {
      return;
    }
    
    this.dragState.lastPos = pos;
    this.placeAtEvent(e);
  }

  private handlePointerEnd(e: PointerEvent): void {
    if (!this.dragState.dragging) return;
    
    this.dragState.dragging = false;
    this.dragState.dragColor = null;
    this.dragState.lastPos = null;
    this.elements.svg.releasePointerCapture(e.pointerId);
  }

  // ============ 着手処理 ============
  private placeAtEvent(event: PointerEvent): void {
    const pos = this.getPositionFromEvent(event);
    if (!this.isValidPosition(pos)) return;

    if (this.state.eraseMode) {
      this.handleErase(pos);
    } else {
      this.handlePlaceStone(pos);
    }
  }

  private handlePlaceStone(pos: Position): void {
    const color = this.dragState.dragColor || this.engine.getCurrentColor();
    
    if (this.engine.tryMove(pos, color)) {
      this.updateUI();
    }
  }

  private handleErase(pos: Position): void {
    if (this.state.board[pos.row][pos.col] !== 0) {
      this.state.history.push(this.state.board.map(row => row.slice()));
      this.state.board[pos.row][pos.col] = 0;
      this.updateUI();
    }
  }

  // ============ 座標変換 ============
  private getPositionFromEvent(event: PointerEvent): Position {
    try {
      const pt = this.elements.svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      
      const ctm = this.elements.svg.getScreenCTM();
      if (!ctm) return { col: -1, row: -1 };
      
      const svgPoint = pt.matrixTransform(ctm.inverse());
      const col = Math.round((svgPoint.x - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
      const row = Math.round((svgPoint.y - DEFAULT_CONFIG.MARGIN) / DEFAULT_CONFIG.CELL_SIZE);
      
      return { col, row };
    } catch (error) {
      console.error('座標変換エラー:', error);
      return { col: -1, row: -1 };
    }
  }

  private isValidPosition(pos: Position): boolean {
    return pos.col >= 0 && pos.col < this.state.boardSize &&
           pos.row >= 0 && pos.row < this.state.boardSize;
  }

  // ============ ボタンイベント ============
  private initButtonEvents(): void {
    // 盤サイズボタン
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const element = btn as HTMLElement;
        const size = parseInt(element.dataset.size!, 10);
        if (size !== this.state.boardSize) {
          // 現在と違うサイズの場合のみ履歴保存
          if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0) {
            this.historyManager.save(`${this.state.boardSize}路→${size}路変更前`, this.state);
          }
          this.engine.initBoard(size);
          this.updateUI();
          this.setActiveButton(element, 'size-btn');
        }
      });
    });

    // 基本操作ボタン
    this.initBasicButtons();
    this.initGameButtons();
    this.initFileButtons();
  }

  private initBasicButtons(): void {
    // 全消去
    const clearBtn = document.getElementById('btn-clear');
    clearBtn?.addEventListener('click', () => {
      // 履歴保存（現在の状態が意味がある場合のみ）
      if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0 || 
          this.state.board.some(row => row.some(cell => cell !== 0))) {
        this.historyManager.save(`全消去前（${this.state.sgfMoves.length}手）`, this.state);
      }
      
      this.disableEraseMode();
      this.engine.initBoard(this.state.boardSize);
      this.updateUI();
    });

    // 戻る
    const undoBtn = document.getElementById('btn-undo');
    undoBtn?.addEventListener('click', () => {
      this.engine.undo();
      this.updateUI();
    });

    // 消去モード
    const eraseBtn = document.getElementById('btn-erase');
    eraseBtn?.addEventListener('click', () => {
      this.state.eraseMode = !this.state.eraseMode;
      if (this.state.eraseMode) {
        eraseBtn.classList.add('active');
        this.renderer.showMessage('消去モード');
      } else {
        eraseBtn.classList.remove('active');
        this.renderer.showMessage('');
      }
    });

    // 配置モードボタン
    const blackBtn = document.getElementById('btn-black');
    blackBtn?.addEventListener('click', () => this.setMode('black', blackBtn));

    const whiteBtn = document.getElementById('btn-white');
    whiteBtn?.addEventListener('click', () => this.setMode('white', whiteBtn));

    const altBtn = document.getElementById('btn-alt');
    altBtn?.addEventListener('click', () => {
      this.state.startColor = this.state.startColor === 1 ? 2 : 1;
      this.setMode('alt', altBtn);
    });
  }

  private initGameButtons(): void {
    // 手順移動
    const prevBtn = document.getElementById('btn-prev-move');
    prevBtn?.addEventListener('click', () => {
      if (this.state.sgfIndex > 0) {
        this.engine.setMoveIndex(this.state.sgfIndex - 1);
        this.updateUI();
      }
    });

    const nextBtn = document.getElementById('btn-next-move');
    nextBtn?.addEventListener('click', () => {
      if (this.state.sgfIndex < this.state.sgfMoves.length) {
        this.engine.setMoveIndex(this.state.sgfIndex + 1);
        this.updateUI();
      }
    });

    // 解答ボタン
    const answerBtn = document.getElementById('btn-answer');
    answerBtn?.addEventListener('click', () => {
      // 解答モード開始前に履歴保存
      if (this.state.sgfMoves.length > 0 || this.state.board.some(row => row.some(cell => cell !== 0))) {
        const modeText = this.state.answerMode === 'black' ? '白先' : '黒先';
        this.historyManager.save(`${modeText}解答開始前（${this.state.sgfMoves.length}手）`, this.state);
      }
      
      if (this.state.answerMode === 'black') {
        this.state.answerMode = 'white';
        answerBtn.textContent = '⚪ 白先';
        answerBtn.classList.add('white-mode');
        this.engine.startNumberMode(2);
      } else {
        this.state.answerMode = 'black';
        answerBtn.textContent = '🔥 黒先';
        answerBtn.classList.remove('white-mode');
        this.engine.startNumberMode(1);
      }
      this.updateUI();
    });

    // 置石ボタン
    const handicapBtn = document.getElementById('btn-handicap');
    handicapBtn?.addEventListener('click', () => {
      this.showHandicapDialog();
    });

    // レイアウト切り替え
    const layoutBtn = document.getElementById('btn-layout');
    if (layoutBtn) {
      let isHorizontal = false;
      layoutBtn.addEventListener('click', () => {
        isHorizontal = !isHorizontal;
        document.body.classList.toggle('horizontal', isHorizontal);
        layoutBtn.textContent = isHorizontal ? '縦レイアウト' : '横レイアウト';
        this.renderer.updateBoardSize();
      });
    }

    // 盤面回転ボタン
    const rotateBtn = document.getElementById('btn-rotate');
    rotateBtn?.addEventListener('click', () => {
      this.rotateBoardView();
    });

    // 履歴ボタン
    const historyBtn = document.getElementById('btn-history');
    historyBtn?.addEventListener('click', () => {
      this.historyManager.showHistoryDialog((index) => {
        if (this.historyManager.restore(index, this.state)) {
          this.updateUI();
          this.renderer.showMessage(`履歴を復元しました`);
        }
      });
    });

    // スライダー
    this.elements.sliderEl?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.engine.setMoveIndex(parseInt(target.value, 10));
      this.updateUI();
    });
  }

  private initFileButtons(): void {
    // ファイルメニュー
    const fileBtn = document.getElementById('btn-file');
    const fileDropdown = document.getElementById('file-dropdown');
    
    fileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileDropdown?.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      fileDropdown?.classList.remove('show');
    });

    fileDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // SGF操作
    this.initSGFButtons();
  }

  private initSGFButtons(): void {
    // SGFファイル選択
    const sgfInput = document.getElementById('sgf-input') as HTMLInputElement;
    const fileSelectBtn = document.getElementById('btn-file-select');
    
    fileSelectBtn?.addEventListener('click', () => {
      sgfInput?.click();
      document.getElementById('file-dropdown')?.classList.remove('show');
    });

    sgfInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        try {
          const result = await this.sgfParser.loadFromFile(file);
          this.applySGFResult(result);
          this.renderer.showMessage(`SGF読み込み完了 (${result.moves.length}手)`);
        } catch (error) {
          this.renderer.showMessage('SGF読み込みに失敗しました');
        }
      }
    });

    // SGF読み込み（クリップボード）
    const fileLoadBtn = document.getElementById('btn-file-load');
    fileLoadBtn?.addEventListener('click', async () => {
      document.getElementById('file-dropdown')?.classList.remove('show');
      try {
        const result = await this.sgfParser.loadFromClipboard();
        this.applySGFResult(result);
        this.renderer.showMessage(`クリップボードからSGF読み込み完了 (${result.moves.length}手)`);
      } catch (error) {
        // テキストエリアから読み込みを試行
        const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
        if (sgfTextarea?.value.trim()) {
          try {
            const result = this.sgfParser.parse(sgfTextarea.value.trim());
            this.applySGFResult({ moves: result.moves, gameInfo: result.gameInfo });
            this.renderer.showMessage('テキストエリアからSGF読み込み完了');
          } catch (parseError) {
            this.renderer.showMessage('SGF読み込みに失敗しました');
          }
        } else {
          this.renderer.showMessage('クリップボードまたはテキストエリアにSGFがありません');
        }
      }
    });

    // SGFコピー
    const fileCopyBtn = document.getElementById('btn-file-copy');
    fileCopyBtn?.addEventListener('click', async () => {
      document.getElementById('file-dropdown')?.classList.remove('show');
      const sgfData = this.sgfParser.export(this.state);
      const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
      if (sgfTextarea) sgfTextarea.value = sgfData;
      
      try {
        await this.sgfParser.copyToClipboard(sgfData);
        this.renderer.showMessage('SGF をコピーしました');
      } catch (error) {
        this.renderer.showMessage('SGF をテキストエリアに表示しました');
      }
    });

    // SGF保存
    const fileSaveBtn = document.getElementById('btn-file-save');
    fileSaveBtn?.addEventListener('click', async () => {
      document.getElementById('file-dropdown')?.classList.remove('show');
      const sgfData = this.sgfParser.export(this.state);
      
      try {
        await this.sgfParser.saveToFile(sgfData);
        this.renderer.showMessage('SGFファイルを保存しました');
      } catch (error) {
        this.renderer.showMessage('SGFファイルの保存に失敗しました');
      }
    });

    // QR共有ボタン
    const fileQRBtn = document.getElementById('btn-file-qr');
    fileQRBtn?.addEventListener('click', () => {
      document.getElementById('file-dropdown')?.classList.remove('show');
      this.qrManager.createSGFQRCode(this.state);
    });
  }

  // ============ ヘルパーメソッド ============
  private setMode(mode: 'black' | 'white' | 'alt', buttonElement: Element): void {
    this.disableEraseMode();
    this.state.mode = mode;
    
    if (this.state.numberMode) {
      this.state.numberMode = false;
      this.state.turn = this.state.sgfIndex;
    }
    
    this.setActiveButton(buttonElement, 'play-btn');
    this.updateUI();
  }

  private disableEraseMode(): void {
    if (this.state.eraseMode) {
      this.state.eraseMode = false;
      const eraseBtn = document.getElementById('btn-erase');
      eraseBtn?.classList.remove('active');
      this.renderer.showMessage('');
    }
  }

  private setActiveButton(element: Element, groupClass: string): void {
    document.querySelectorAll(`.${groupClass}`).forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
  }

  private applySGFResult(result: { moves: any[], gameInfo: Partial<any> }): void {
    // SGF読み込み前に履歴保存
    if (this.state.sgfMoves.length > 0 || this.state.handicapStones > 0 || 
        this.state.board.some(row => row.some(cell => cell !== 0))) {
      this.historyManager.save(`SGF読み込み前（${this.state.sgfMoves.length}手）`, this.state);
    }
    
    // ゲーム情報を適用
    if (result.gameInfo.boardSize) {
      this.engine.initBoard(result.gameInfo.boardSize);
    }
    
    Object.assign(this.state, result.gameInfo);
    
    // 着手を設定
    this.state.sgfMoves = result.moves;
    this.state.sgfIndex = 0;
    this.engine.setMoveIndex(0);
    
    // 置石がある場合は盤面を再描画
    if (this.state.handicapPositions.length > 0) {
      this.updateUI();
    }
    
    // SGFテキストエリアの更新
    const sgfTextarea = document.getElementById('sgf-text') as HTMLTextAreaElement;
    if (sgfTextarea) {
      sgfTextarea.value = this.sgfParser.export(this.state);
    }
  }

  private showHandicapDialog(): void {
    // 既存のポップアップがあれば削除
    const existing = document.getElementById('handicap-popup');
    existing?.remove();

    const popup = document.createElement('div');
    popup.id = 'handicap-popup';
    popup.innerHTML = `
      <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="this.parentElement.remove()">
        <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;" onclick="event.stopPropagation()">
          <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
          <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;">
            <button onclick="window.tumegoUIController.setHandicap('even')" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">互先（コミあり）</button>
            <button onclick="window.tumegoUIController.setHandicap(0)" style="padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">先（コミなし）</button>
            <button onclick="window.tumegoUIController.setHandicap(2)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">2子</button>
            <button onclick="window.tumegoUIController.setHandicap(3)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">3子</button>
            <button onclick="window.tumegoUIController.setHandicap(4)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">4子</button>
            <button onclick="window.tumegoUIController.setHandicap(5)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">5子</button>
            <button onclick="window.tumegoUIController.setHandicap(6)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">6子</button>
            <button onclick="window.tumegoUIController.setHandicap(7)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">7子</button>
            <button onclick="window.tumegoUIController.setHandicap(8)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">8子</button>
            <button onclick="window.tumegoUIController.setHandicap(9)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">9子</button>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
  }

  // ============ キーボードショートカット ============
  private initKeyboardEvents(): void {
    const keyBindings: KeyBindings = {
      'q': () => this.clickButton('.size-btn[data-size="9"]'),
      'w': () => this.clickButton('.size-btn[data-size="13"]'),
      'e': () => this.clickButton('.size-btn[data-size="19"]'),
      'a': () => this.clickButton('#btn-clear'),
      's': () => this.clickButton('#btn-undo'),
      'd': () => this.clickButton('#btn-erase'),
      'z': () => this.clickButton('#btn-black'),
      'x': () => this.clickButton('#btn-alt'),
      'c': () => this.clickButton('#btn-white'),
      'ArrowLeft': () => this.clickButton('#btn-prev-move'),
      'ArrowRight': () => this.clickButton('#btn-next-move')
    };

    document.addEventListener('keydown', (e) => {
      if (!this.boardHasFocus) return;
      
      const handler = keyBindings[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  private clickButton(selector: string): void {
    const button = document.querySelector(selector) as HTMLElement;
    button?.click();
  }

  // ============ リサイズ対応 ============
  private initResizeEvents(): void {
    window.addEventListener('orientationchange', () => {
      this.renderer.updateBoardSize();
      setTimeout(() => this.renderer.render(), 200);
    });

    window.addEventListener('resize', () => {
      this.renderer.updateBoardSize();
      setTimeout(() => this.renderer.render(), 200);
    });
  }

  // ============ 盤面回転機能 ============
  private rotateBoardView(): void {
    // SVG要素に回転クラスを追加/削除
    const isRotated = this.elements.svg.classList.contains('rotated');
    
    if (isRotated) {
      this.elements.svg.classList.remove('rotated');
      this.renderer.showMessage('盤面を元に戻しました');
    } else {
      this.elements.svg.classList.add('rotated');
      this.renderer.showMessage('盤面を180度回転しました');
    }
  }

  // ============ UI更新 ============
  private updateUI(): void {
    this.renderer.render();
    this.renderer.updateInfo();
    this.renderer.updateSlider();
  }

  // ============ 公開メソッド ============
  public setHandicap(stones: number | string): void {
    const popup = document.getElementById('handicap-popup');
    popup?.remove();

    this.engine.setHandicap(stones);
    this.updateUI();
    
    if (stones === 'even') {
      this.renderer.showMessage('互先（黒番開始、コミ6.5目）に設定しました');
    } else if (stones === 0) {
      this.renderer.showMessage('先番（黒番開始、コミ0目）に設定しました');
    } else {
      this.renderer.showMessage(`${stones}子局（白番開始、コミ0目）に設定しました`);
    }
  }

  public initialize(): void {
    // 初期化処理
    this.engine.initBoard(9);
    
    // 盤面サイズを強制的に更新（モバイル最適化の影響を回避）
    setTimeout(() => {
      this.renderer.updateBoardSize();
      this.updateUI();
    }, 100);
    
    this.updateUI();
    
    // 履歴機能の初期化
    this.historyManager.clear();
    this.historyManager.save('アプリケーション開始', this.state);
    
    // URL からの SGF 読み込み
    const urlResult = this.sgfParser.loadFromURL();
    if (urlResult) {
      this.applySGFResult(urlResult);
      this.renderer.showMessage(`URL からSGF読み込み完了 (${urlResult.moves.length}手)`);
    }
    
    // 初期ボタン状態
    const sizeBtn = document.querySelector('.size-btn[data-size="9"]');
    const altBtn = document.getElementById('btn-alt');
    
    this.setActiveButton(sizeBtn!, 'size-btn');
    this.setActiveButton(altBtn!, 'play-btn');
    
    console.log('Tumego UI Controller 初期化完了');
  }
}