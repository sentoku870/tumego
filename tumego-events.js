// === イベント処理とユーザー操作 ===

// ボードをフォーカス可能にしてフォーカス状態を管理
function initBoardEvents() {
  boardWrapper.tabIndex = 0;
  boardWrapper.addEventListener('pointerenter', () => { boardHasFocus = true; });
  boardWrapper.addEventListener('pointerleave', () => { boardHasFocus = false; });
  boardWrapper.addEventListener('pointerdown', () => {
    boardHasFocus = true;
    boardWrapper.focus();
  });
  boardWrapper.addEventListener('blur', () => { boardHasFocus = false; });
  
  // iOSでボードの上におけるタッチムーブで画面スクロールを無効に
  boardWrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 1) e.preventDefault();
  }, { passive: false });
}

// === 盤クリック・ドラッグ ===
let dragging = false;
let dragColor = null;
let lastPos = null;

function placeAtEvent(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row)) return;
  
  if (state.eraseMode) { // 消去モード
    if (state.board[row][col] !== 0) {
      state.history.push(cloneBoard(state.board));
      state.board[row][col] = 0;
      render(); 
      updateInfo();
    }
    return;
  }
  
  const color = dragColor || getTurnColor();
  const ok = tryMove(col, row, color);
  if (ok) { 
    render(); 
    updateInfo(); 
    updateSlider(); 
  }
}

function initSVGEvents() {
  svg.addEventListener('pointerdown', e => {
    boardHasFocus = true;
    boardWrapper.focus();
    if (e.button === 2) e.preventDefault();
    
    if (state.eraseMode) {
      dragColor = null;
    } else if (state.mode === 'alt') {
      // 交互配置の場合は左クリックのみ、右クリック無効
      if (e.button === 0) {
        dragColor = null; // 交互配置に従う
      } else {
        return; // 右クリックは無効
      }
    } else {
      // 黒配置・白配置の場合は左右クリック対応
      const leftColor = state.mode === 'white' ? 2 : 1;
      const rightColor = state.mode === 'white' ? 1 : 2;
      dragColor = e.button === 0 ? leftColor : e.button === 2 ? rightColor : null;
    }
    
    dragging = true;
    lastPos = null;
    svg.setPointerCapture(e.pointerId);
    placeAtEvent(e);
  });

  svg.addEventListener('pointermove', e => {
    if (!dragging) {
      if (state.eraseMode && e.buttons) {
        dragging = true;
        lastPos = null;
      } else {
        return;
      }
    }
    
    // 交互配置モードではドラッグ無効
    if (state.mode === 'alt' && !state.eraseMode) {
      return;
    }
    
    const { col, row } = pointToCoord(e);
    if (lastPos && lastPos.col === col && lastPos.row === row) return;
    lastPos = { col, row };
    placeAtEvent(e);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    dragColor = null; 
    lastPos = null;
    svg.releasePointerCapture(e.pointerId);
  }
  
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('contextmenu', e => e.preventDefault());
}

function pointToCoord(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; 
  pt.y = evt.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const col = Math.round((svgP.x - MARGIN) / CELL);
  const row = Math.round((svgP.y - MARGIN) / CELL);
  return { col, row };
}

// === ボタンイベント ===
function initButtonEvents() {
  // 盤サイズ
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      disableEraseMode();
      const size = parseInt(btn.dataset.size, 10);
      initBoard(size);
    });
  });

  // 全消去
  document.getElementById('btn-clear').addEventListener('click', () => {
    disableEraseMode();
    initBoard(state.boardSize);
  });

  // 戻る
  document.getElementById('btn-undo').addEventListener('click', () => {
    disableEraseMode();
    if (state.history.length) {
      state.board = state.history.pop();
      state.turn = Math.max(0, state.turn - 1);
      if (state.sgfIndex > 0) {
        state.sgfIndex--;
        state.sgfMoves = state.sgfMoves.slice(0, state.sgfIndex);
      }
      render(); 
      updateInfo(); 
      updateSlider();
    }
  });

  // 消去モード
  document.getElementById('btn-erase').addEventListener('click', () => {
    state.eraseMode = !state.eraseMode;
    const el = document.getElementById('btn-erase');
    if (state.eraseMode) { 
      el.classList.add('active'); 
      msg('消去モード'); 
    } else { 
      el.classList.remove('active'); 
      msg(''); 
    }
  });

  // 1手戻る・進むボタン
  document.getElementById('btn-prev-move').addEventListener('click', () => {
    if (state.sgfIndex > 0) {
      setMoveIndex(state.sgfIndex - 1);
    }
  });

  document.getElementById('btn-next-move').addEventListener('click', () => {
    if (state.sgfIndex < state.sgfMoves.length) {
      setMoveIndex(state.sgfIndex + 1);
    }
  });

  // 解答モード
  function enableAnswerMode(color) {
    // Always switch to answer mode regardless of current state
    if (!state.numberMode || state.startColor !== color) {
      startNumberMode(color);
    }
  }

  ['btn-play-black', 'btn-play-white'].forEach((id, idx) => {
    const handler = () => enableAnswerMode(idx + 1);
    const btn = document.getElementById(id);
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: true });
  });

  // 一時保存・読込
  document.getElementById('btn-temp-save').addEventListener('click', saveTemp);
  document.getElementById('btn-temp-load').addEventListener('click', loadTemp);

  // 配置モード
  function setMode(mode, btn) {
    disableEraseMode();
    state.mode = mode;
    if (state.numberMode) {
      state.numberMode = false;
      state.turn = state.sgfIndex;
    }
    setActive(btn, 'play-btn');
    render();
    updateInfo();
  }

  document.getElementById('btn-black').addEventListener('click', e => setMode('black', e.currentTarget));
  document.getElementById('btn-white').addEventListener('click', e => setMode('white', e.currentTarget));
  document.getElementById('btn-alt').addEventListener('click', e => {
    state.startColor = state.startColor === 1 ? 2 : 1;
    setMode('alt', e.currentTarget);
  });

  // SGF 関連
  document.getElementById('sgf-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadSGF(file);
  });

  document.getElementById('btn-load-sgf').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        state.sgfMoves = parseSGF(text);
        state.sgfIndex = 0;
        setMoveIndex(0);
        document.getElementById('sgf-text').value = text;
        msg('クリップボードからSGFを読み込みました');
      } else {
        msg('クリップボードにSGFがありません');
      }
    } catch (err) {
      console.error('クリップボードの読み込みに失敗しました: ', err);
      const sgfTextarea = document.getElementById('sgf-text');
      if (sgfTextarea && sgfTextarea.value.trim()) {
        const textFromTextarea = sgfTextarea.value.trim();
        state.sgfMoves = parseSGF(textFromTextarea);
        state.sgfIndex = 0;
        setMoveIndex(0);
        msg('テキストエリアからSGFを読み込みました');
      } else {
        msg('クリップボードの読み込みに失敗しました。テキストエリアにSGFがありません。');
      }
    }
  });

  document.getElementById('btn-copy-sgf').addEventListener('click', () => {
    const text = exportSGF();
    document.getElementById('sgf-text').value = text;
    navigator.clipboard.writeText(text).then(() => msg('SGF をコピーしました'));
  });

  // QRコード共有
  document.getElementById('btn-qr-share').addEventListener('click', createSGFQRCode);

  // レイアウト切り替え
  const layoutBtn = document.getElementById('btn-layout');
  let isHorizontal = false;
  layoutBtn.addEventListener('click', () => {
    isHorizontal = !isHorizontal;
    document.body.classList.toggle('horizontal', isHorizontal);
    layoutBtn.textContent = isHorizontal ? '縦レイアウト' : '横レイアウト';
    updateBoardSize();
  });

  // スライダー
  sliderEl.addEventListener('input', e => { 
    setMoveIndex(parseInt(e.target.value, 10)); 
  });
}

// === キーボードショートカット ===
const keyBindings = {
  q: () => document.querySelector('.size-btn[data-size="9"]').click(),
  w: () => document.querySelector('.size-btn[data-size="13"]').click(),
  e: () => document.querySelector('.size-btn[data-size="19"]').click(),
  a: () => document.getElementById('btn-clear').click(),
  s: () => document.getElementById('btn-undo').click(),
  d: () => document.getElementById('btn-erase').click(),
  z: () => document.getElementById('btn-black').click(),
  x: () => document.getElementById('btn-alt').click(),
  c: () => document.getElementById('btn-white').click(),
  ArrowLeft: () => document.getElementById('btn-prev-move').click(),
  ArrowRight: () => document.getElementById('btn-next-move').click()
};

function initKeyboardEvents() {
  document.addEventListener('keydown', e => {
    if (!boardHasFocus) return;
    const key = e.key;
    if (keyBindings[key]) {
      e.preventDefault();
      keyBindings[key]();
    }
  });
}

// === リサイズ対応 ===
function initResizeEvents() {
  window.addEventListener('orientationchange', () => {
    updateBoardSize();
    setTimeout(render, 200);
  });
  
  window.addEventListener('resize', () => {
    updateBoardSize();
    setTimeout(render, 200);
  });
}