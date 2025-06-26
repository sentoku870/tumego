// === iOS最適化イベント処理とユーザー操作 ===

// iOS向けタッチイベント最適化
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let isLongPress = false;
let longPressTimer = null;
let gestureStartDistance = 0;
let gestureStartScale = 1;

// ボードをフォーカス可能にしてフォーカス状態を管理
function initBoardEvents() {
  boardWrapper.tabIndex = 0;
  boardWrapper.setAttribute('role', 'application');
  boardWrapper.setAttribute('aria-label', '囲碁盤面');
  
  // iOS向けタッチイベント
  boardWrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
  boardWrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
  boardWrapper.addEventListener('touchend', handleTouchEnd, { passive: false });
  boardWrapper.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  
  // ポインターイベント（Apple Pencil対応）
  boardWrapper.addEventListener('pointerenter', () => { boardHasFocus = true; });
  boardWrapper.addEventListener('pointerleave', () => { boardHasFocus = false; });
  boardWrapper.addEventListener('pointerdown', handlePointerDown);
  boardWrapper.addEventListener('blur', () => { boardHasFocus = false; });
  
  // ジェスチャー認識（ピンチズーム無効化）
  boardWrapper.addEventListener('gesturestart', e => e.preventDefault());
  boardWrapper.addEventListener('gesturechange', e => e.preventDefault());
  boardWrapper.addEventListener('gestureend', e => e.preventDefault());
  
  // iOS Safari向けの特別なイベント処理
  if (navigator.userAgent.includes('Safari') && navigator.userAgent.includes('Mobile')) {
    // ダブルタップズーム無効化
    boardWrapper.addEventListener('touchend', preventDoubleTapZoom);
    
    // 長押しでの選択無効化
    boardWrapper.style.webkitUserSelect = 'none';
    boardWrapper.style.webkitTouchCallout = 'none';
  }
}

// タッチスタート処理
function handleTouchStart(e) {
  boardHasFocus = true;
  boardWrapper.focus();
  
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    touchStartTime = Date.now();
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    isLongPress = false;
    
    // 長押し検出
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      handleLongPress(touch);
      // iOS向けハプティックフィードバック
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
    
    // 消去モードまたは通常配置
    if (state.eraseMode || state.mode !== 'alt') {
      // 即座に反応（ドラッグ対応）
      dragging = true;
      dragColor = state.eraseMode ? null : getDragColor(0); // 左タッチ扱い
      lastPos = null;
      placeAtEvent(touch);
    }
  } else if (e.touches.length === 2) {
    // マルチタッチ - ピンチズーム対応準備（将来拡張用）
    clearTimeout(longPressTimer);
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    gestureStartDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }
  
  // スクロール防止
  if (e.touches.length === 1) {
    e.preventDefault();
  }
}

// タッチムーブ処理
function handleTouchMove(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPos.x, 2) +
      Math.pow(touch.clientY - touchStartPos.y, 2)
    );
    
    // 少し動いたら長押しをキャンセル
    if (moveDistance > 10) {
      clearTimeout(longPressTimer);
      isLongPress = false;
    }
    
    // ドラッグ中の処理
    if (dragging && (state.eraseMode || state.mode !== 'alt')) {
      const { col, row } = pointToCoord(touch);
      if (lastPos && lastPos.col === col && lastPos.row === row) return;
      lastPos = { col, row };
      placeAtEvent(touch);
    }
    
    // 単一タッチの場合はスクロール防止
    e.preventDefault();
  }
}

// タッチエンド処理
function handleTouchEnd(e) {
  clearTimeout(longPressTimer);
  
  if (e.changedTouches.length === 1 && !isLongPress) {
    const touch = e.changedTouches[0];
    const touchDuration = Date.now() - touchStartTime;
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPos.x, 2) +
      Math.pow(touch.clientY - touchStartPos.y, 2)
    );
    
    // タップ判定（短時間かつ小さな移動）
    if (touchDuration < 300 && moveDistance < 10) {
      if (state.mode === 'alt' && !state.eraseMode) {
        // 交互配置モードでのタップ
        placeAtEvent(touch);
      }
    }
  }
  
  endDrag();
}

// タッチキャンセル処理
function handleTouchCancel(e) {
  clearTimeout(longPressTimer);
  endDrag();
}

// ポインターダウン処理（Apple Pencil対応）
function handlePointerDown(e) {
  boardHasFocus = true;
  boardWrapper.focus();
  
  // Apple Pencilの場合は特別な処理
  if (e.pointerType === 'pen') {
    handlePencilInput(e);
    return;
  }
  
  // 通常のポインター処理
  if (e.button === 2) e.preventDefault(); // 右クリック防止
  
  const color = getDragColor(e.button);
  if (color) {
    dragging = true;
    dragColor = color;
    lastPos = null;
    placeAtEvent(e);
  }
}

// Apple Pencil入力処理
function handlePencilInput(e) {
  // Apple Pencilの場合は圧力感知を活用
  const pressure = e.pressure || 0.5;
  
  if (pressure > 0.3) {
    // 強い圧力 → 石を配置
    dragging = true;
    dragColor = getTurnColor();
    placeAtEvent(e);
  } else {
    // 軽い圧力 → プレビュー表示（将来拡張用）
    showPlacementPreview(e);
  }
}

// 長押し処理
function handleLongPress(touch) {
  const { col, row } = pointToCoord(touch);
  if (!inRange(col) || !inRange(row)) return;
  
  // 長押しメニュー表示（将来拡張用）
  showContextMenu(col, row, touch.clientX, touch.clientY);
}

// ダブルタップズーム防止
function preventDoubleTapZoom(e) {
  const now = Date.now();
  if (now - (preventDoubleTapZoom.lastTap || 0) < 300) {
    e.preventDefault();
  }
  preventDoubleTapZoom.lastTap = now;
}

// ドラッグ色の決定
function getDragColor(button) {
  if (state.eraseMode) return null;
  
  if (state.mode === 'alt') {
    return button === 0 ? getTurnColor() : null;
  } else {
    const leftColor = state.mode === 'white' ? 2 : 1;
    const rightColor = state.mode === 'white' ? 1 : 2;
    return button === 0 ? leftColor : button === 2 ? rightColor : null;
  }
}

// === SVG イベント処理 ===
let dragging = false;
let dragColor = null;
let lastPos = null;

function placeAtEvent(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row)) return;
  
  if (state.eraseMode) {
    if (state.board[row][col] !== 0) {
      state.history.push(cloneBoard(state.board));
      state.board[row][col] = 0;
      render(); 
      updateInfo();
      // iOS向けハプティックフィードバック
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    return;
  }
  
  const color = dragColor || getTurnColor();
  const ok = tryMove(col, row, color);
  if (ok) { 
    render(); 
    updateInfo(); 
    updateSlider();
    // iOS向けハプティックフィードバック
    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
  }
}

function initSVGEvents() {
  // マウスイベント（デスクトップ向け）
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // タッチは別処理
    
    boardHasFocus = true;
    boardWrapper.focus();
    if (e.button === 2) e.preventDefault();
    
    const color = getDragColor(e.button);
    if (color !== null || state.eraseMode) {
      dragging = true;
      dragColor = color;
      lastPos = null;
      svg.setPointerCapture(e.pointerId);
      placeAtEvent(e);
    }
  });

  svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return; // タッチは別処理
    
    if (!dragging) {
      if (state.eraseMode && e.buttons) {
        dragging = true;
        lastPos = null;
      } else {
        return;
      }
    }
    
    if (state.mode === 'alt' && !state.eraseMode) return;
    
    const { col, row } = pointToCoord(e);
    if (lastPos && lastPos.col === col && lastPos.row === row) return;
    lastPos = { col, row };
    placeAtEvent(e);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    dragColor = null; 
    lastPos = null;
  }
  
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('contextmenu', e => e.preventDefault());
}

// 座標変換（高精度）
function pointToCoord(evt) {
  const rect = svg.getBoundingClientRect();
  const scaleX = svg.viewBox.baseVal.width / rect.width;
  const scaleY = svg.viewBox.baseVal.height / rect.height;
  
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  
  const col = Math.round((x - MARGIN) / CELL);
  const row = Math.round((y - MARGIN) / CELL);
  return { col, row };
}

// === ボタンイベント（iOS最適化） ===
function initButtonEvents() {
  // 盤サイズボタン
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', handleSizeChange);
    btn.addEventListener('touchstart', addTouchFeedback, { passive: true });
  });

  // 基本操作ボタン
  document.getElementById('btn-clear').addEventListener('click', handleClear);
  document.getElementById('btn-undo').addEventListener('click', handleUndo);
  document.getElementById('btn-erase').addEventListener('click', handleEraseToggle);

  // 手数操作ボタン
  document.getElementById('btn-prev-move').addEventListener('click', handlePrevMove);
  document.getElementById('btn-next-move').addEventListener('click', handleNextMove);

  // 解答モードボタン
  ['btn-play-black', 'btn-play-white'].forEach((id, idx) => {
    const btn = document.getElementById(id);
    const handler = () => enableAnswerMode(idx + 1);
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: true });
    btn.addEventListener('touchstart', addTouchFeedback, { passive: true });
  });

  // 一時保存・読込
  document.getElementById('btn-temp-save').addEventListener('click', saveTemp);
  document.getElementById('btn-temp-load').addEventListener('click', loadTemp);

  // 配置モードボタン
  document.getElementById('btn-black').addEventListener('click', e => setMode('black', e.currentTarget));
  document.getElementById('btn-white').addEventListener('click', e => setMode('white', e.currentTarget));
  document.getElementById('btn-alt').addEventListener('click', e => {
    state.startColor = state.startColor === 1 ? 2 : 1;
    setMode('alt', e.currentTarget);
  });

  // SGF関連
  document.getElementById('sgf-input').addEventListener('change', handleFileLoad);
  document.getElementById('btn-load-sgf').addEventListener('click', handleSGFLoad);
  document.getElementById('btn-copy-sgf').addEventListener('click', handleSGFCopy);
  document.getElementById('btn-qr-share').addEventListener('click', createSGFQRCode);

  // レイアウト切り替え
  const layoutBtn = document.getElementById('btn-layout');
  let isHorizontal = false;
  layoutBtn.addEventListener('click', () => {
    isHorizontal = !isHorizontal;
    document.body.classList.toggle('horizontal', isHorizontal);
    layoutBtn.textContent = isHorizontal ? '縦表示' : '横表示';
    updateBoardSize();
    
    // iOS向けハプティックフィードバック
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  });

  // スライダー
  sliderEl.addEventListener('input', e => { 
    setMoveIndex(parseInt(e.target.value, 10)); 
  });
  
  // iOS向けスライダー最適化
  sliderEl.addEventListener('touchstart', e => {
    e.target.style.webkitAppearance = 'none';
  });
}

// イベントハンドラー関数群
function handleSizeChange(e) {
  disableEraseMode();
  const size = parseInt(e.currentTarget.dataset.size, 10);
  initBoard(size);
  addTouchFeedback(e);
}

function handleClear() {
  disableEraseMode();
  initBoard(state.boardSize);
  if (navigator.vibrate) navigator.vibrate(30);
}

function handleUndo() {
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
    if (navigator.vibrate) navigator.vibrate(20);
  }
}

function handleEraseToggle() {
  state.eraseMode = !state.eraseMode;
  const el = document.getElementById('btn-erase');
  if (state.eraseMode) { 
    el.classList.add('active'); 
    msg('消去モード: 石をタップして削除'); 
  } else { 
    el.classList.remove('active'); 
    msg(''); 
  }
  if (navigator.vibrate) navigator.vibrate(25);
}

function handlePrevMove() {
  if (state.sgfIndex > 0) {
    setMoveIndex(state.sgfIndex - 1);
    if (navigator.vibrate) navigator.vibrate(15);
  }
}

function handleNextMove() {
  if (state.sgfIndex < state.sgfMoves.length) {
    setMoveIndex(state.sgfIndex + 1);
    if (navigator.vibrate) navigator.vibrate(15);
  }
}

function handleFileLoad(e) {
  const file = e.target.files[0];
  if (file) loadSGF(file);
}

async function handleSGFLoad() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) {
      state.sgfMoves = parseSGF(text);
      state.sgfIndex = 0;
      setMoveIndex(0);
      document.getElementById('sgf-text').value = text;
      msg('クリップボードからSGF読み込み完了');
      if (navigator.vibrate) navigator.vibrate(40);
    } else {
      msg('クリップボードにSGFがありません');
    }
  } catch (err) {
    console.error('クリップボード読み込みエラー:', err);
    const sgfTextarea = document.getElementById('sgf-text');
    if (sgfTextarea && sgfTextarea.value.trim()) {
      const textFromTextarea = sgfTextarea.value.trim();
      state.sgfMoves = parseSGF(textFromTextarea);
      state.sgfIndex = 0;
      setMoveIndex(0);
      msg('テキストエリアからSGF読み込み完了');
      if (navigator.vibrate) navigator.vibrate(40);
    } else {
      msg('クリップボード読み込み失敗・テキストエリアも空です');
    }
  }
}

function handleSGFCopy() {
  const text = exportSGF();
  document.getElementById('sgf-text').value = text;
  navigator.clipboard.writeText(text).then(() => {
    msg('SGFをコピーしました');
    if (navigator.vibrate) navigator.vibrate(30);
  });
}

// タッチフィードバック追加
function addTouchFeedback(e) {
  const btn = e.currentTarget;
  btn.style.transform = 'scale(0.95)';
  btn.style.opacity = '0.8';
  
  setTimeout(() => {
    btn.style.transform = '';
    btn.style.opacity = '';
  }, 100);
}

// 他のボタンを押したときに消去モードを解除
function disableEraseMode() {
  if (state.eraseMode) {
    state.eraseMode = false;
    const el = document.getElementById('btn-erase');
    el.classList.remove('active');
    msg('');
  }
}

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

function enableAnswerMode(color) {
  if (!state.numberMode || state.startColor !== color) {
    startNumberMode(color);
  }
}

// === iOS向けキーボードショートカット ===
const keyBindings = {
  'q': () => document.querySelector('.size-btn[data-size="9"]').click(),
  'w': () => document.querySelector('.size-btn[data-size="13"]').click(),
  'e': () => document.querySelector('.size-btn[data-size="19"]').click(),
  'a': () => document.getElementById('btn-clear').click(),
  's': () => document.getElementById('btn-undo').click(),
  'd': () => document.getElementById('btn-erase').click(),
  'z': () => document.getElementById('btn-black').click(),
  'x': () => document.getElementById('btn-alt').click(),
  'c': () => document.getElementById('btn-white').click(),
  'ArrowLeft': () => document.getElementById('btn-prev-move').click(),
  'ArrowRight': () => document.getElementById('btn-next-move').click(),
  ' ': (e) => {
    e.preventDefault();
    document.getElementById('btn-next-move').click();
  }
};

function initKeyboardEvents() {
  document.addEventListener('keydown', e => {
    // iOS外付けキーボード対応
    if (!boardHasFocus && !e.target.matches('input, textarea')) return;
    
    const key = e.key;
    if (keyBindings[key]) {
      e.preventDefault();
      keyBindings[key](e);
    }
  });
}

// === iOS向けリサイズ対応 ===
function initResizeEvents() {
  // オリエンテーション変更
  window.addEventListener('orientationchange', () => {
    // iOS向け遅延処理
    setTimeout(() => {
      updateBoardSize();
      render();
    }, 100);
  });
  
  // リサイズ
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateBoardSize();
      render();
    }, 100);
  });
  
  // iOS Safari向けのビューポート変更対応
  window.addEventListener('scroll', () => {
    // アドレスバーの表示/非表示によるビューポート変更
    if (window.scrollY === 0) {
      setTimeout(updateBoardSize, 100);
    }
  });
}

// コンテキストメニュー表示（将来拡張用）
function showContextMenu(col, row, x, y) {
  // 既存のメニューを削除
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  
  // メニュー要素を作成
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${y}px;
    left: ${x}px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    font-size: 14px;
    min-width: 120px;
  `;
  
  // メニュー項目
  const actions = [
    { text: '⚫ 黒石配置', action: () => tryMove(col, row, 1) },
    { text: '⚪ 白石配置', action: () => tryMove(col, row, 2) },
    { text: '🗑️ 石を削除', action: () => removeStone(col, row) },
    { text: '❌ キャンセル', action: () => {} }
  ];
  
  actions.forEach(({ text, action }) => {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.cssText = `
      padding: 12px;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.2s ease;
      text-align: center;
    `;
    
    item.addEventListener('click', () => {
      action();
      menu.remove();
      render();
      updateInfo();
    });
    
    item.addEventListener('touchstart', () => {
      item.style.background = 'rgba(0, 122, 255, 0.1)';
    });
    
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  
  // メニュー外タッチで閉じる
  setTimeout(() => {
    document.addEventListener('touchstart', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('touchstart', closeMenu);
      }
    });
  }, 100);
}

// 石削除
function removeStone(col, row) {
  if (inRange(col) && inRange(row) && state.board[row][col] !== 0) {
    state.history.push(cloneBoard(state.board));
    state.board[row][col] = 0;
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

// プレビュー表示（Apple Pencil軽タッチ用）
function showPlacementPreview(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row) || state.board[row][col] !== 0) return;
  
  // 既存のプレビューを削除
  const existing = svg.querySelector('.placement-preview');
  if (existing) existing.remove();
  
  // プレビュー石を表示
  const cx = MARGIN + col * CELL;
  const cy = MARGIN + row * CELL;
  const color = getTurnColor();
  
  const preview = svgtag('circle', {
    cx, cy, r: 22,
    class: 'placement-preview',
    fill: color === 1 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)',
    stroke: color === 1 ? '#000' : '#666',
    'stroke-width': 1,
    'stroke-dasharray': '3,3'
  });
  
  svg.appendChild(preview);
  
  // 一定時間後に削除
  setTimeout(() => {
    if (svg.contains(preview)) {
      svg.removeChild(preview);
    }
  }, 1000);
}

// iOS向けスワイプジェスチャー
let swipeStartX = 0;
let swipeStartY = 0;
let swipeEndX = 0;
let swipeEndY = 0;

function initSwipeGestures() {
  document.addEventListener('touchstart', e => {
    if (e.touches.length === 1 && !boardWrapper.contains(e.target)) {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1 && !boardWrapper.contains(e.target)) {
      swipeEndX = e.changedTouches[0].clientX;
      swipeEndY = e.changedTouches[0].clientY;
      handleSwipe();
    }
  }, { passive: true });
}

function handleSwipe() {
  const deltaX = swipeEndX - swipeStartX;
  const deltaY = swipeEndY - swipeStartY;
  const minSwipeDistance = 50;
  
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
    if (deltaX > 0) {
      // 右スワイプ → 次の手
      document.getElementById('btn-next-move').click();
    } else {
      // 左スワイプ → 前の手
      document.getElementById('btn-prev-move').click();
    }
  }
}

// iOS向けアクセシビリティ最適化
function initAccessibility() {
  // VoiceOver対応
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-label', `${state.boardSize}路盤の囲碁盤面`);
  
  // Dynamic Type対応
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addListener(handleReducedMotion);
    handleReducedMotion(mediaQuery);
  }
  
  // ハイコントラスト対応
  if (window.matchMedia) {
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    contrastQuery.addListener(handleHighContrast);
    handleHighContrast(contrastQuery);
  }
}

function handleReducedMotion(mediaQuery) {
  if (mediaQuery.matches) {
    document.body.classList.add('reduced-motion');
  } else {
    document.body.classList.remove('reduced-motion');
  }
}

function handleHighContrast(mediaQuery) {
  if (mediaQuery.matches) {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }
}

// iOS Safari向けPWA最適化
function initPWAFeatures() {
  // ホーム画面追加促進
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });
  
  // インストール完了
  window.addEventListener('appinstalled', (evt) => {
    console.log('PWA installed successfully');
    msg('アプリがホーム画面に追加されました！');
    hideInstallPromotion();
  });
  
  // スタンドアローンモード検出
  if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('standalone');
    console.log('Running in standalone mode');
  }
}

function showInstallPromotion() {
  const existing = document.getElementById('install-banner');
  if (existing) return;
  
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(0, 122, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: white;
    padding: 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 1000;
    font-size: 15px;
    box-shadow: 0 8px 32px rgba(0, 122, 255, 0.3);
  `;
  
  banner.innerHTML = `
    <div>
      <div style="font-weight: 600; margin-bottom: 4px;">📱 アプリをインストール</div>
      <div style="font-size: 13px; opacity: 0.9;">ホーム画面に追加してより便利に</div>
    </div>
    <div>
      <button id="install-btn" style="
        background: white;
        color: #007AFF;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        margin-right: 8px;
      ">追加</button>
      <button id="install-dismiss" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 8px 12px;
        border-radius: 8px;
      ">×</button>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // イベントリスナー
  document.getElementById('install-btn').addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        hideInstallPromotion();
      });
    }
  });
  
  document.getElementById('install-dismiss').addEventListener('click', hideInstallPromotion);
  
  // 10秒後に自動で隠す
  setTimeout(hideInstallPromotion, 10000);
}

function hideInstallPromotion() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.transform = 'translateY(100%)';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  }
}

// バッテリー最適化（iOS向け）
function initBatteryOptimization() {
  // Page Visibility API
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // バックグラウンド時はアニメーションを停止
      document.body.classList.add('app-hidden');
    } else {
      // フォアグラウンド復帰時はアニメーション再開
      document.body.classList.remove('app-hidden');
      // 盤面を再描画
      setTimeout(render, 100);
    }
  });
  
  // バッテリー情報取得（対応ブラウザのみ）
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      if (battery.level < 0.2) {
        // バッテリー残量が少ない場合は省電力モード
        document.body.classList.add('low-battery');
        msg('省電力モードが有効になりました');
      }
      
      battery.addEventListener('levelchange', () => {
        if (battery.level < 0.2) {
          document.body.classList.add('low-battery');
        } else {
          document.body.classList.remove('low-battery');
        }
      });
    });
  }
}

// パフォーマンス監視
function initPerformanceMonitoring() {
  if ('performance' in window) {
    // フレームレート監視
    let frameCount = 0;
    let lastTime = performance.now();
    
    function countFrames() {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        if (fps < 30) {
          console.warn('Low FPS detected:', fps);
          // 低フレームレート時の最適化
          document.body.classList.add('low-performance');
        } else {
          document.body.classList.remove('low-performance');
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      if (!document.hidden) {
        requestAnimationFrame(countFrames);
      }
    }
    
    requestAnimationFrame(countFrames);
  }
}

// エラーハンドリング強化
function initErrorHandling() {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    msg('エラーが発生しました。アプリを再読み込みしてください。');
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault(); // デフォルトのエラー表示を防ぐ
    msg('処理中にエラーが発生しました。');
  });
}

// 初期化関数を拡張
function initIOSOptimizedEvents() {
  initBoardEvents();
  initSVGEvents();
  initButtonEvents();
  initKeyboardEvents();
  initResizeEvents();
  initSwipeGestures();
  initAccessibility();
  initPWAFeatures();
  initBatteryOptimization();
  initPerformanceMonitoring();
  initErrorHandling();
}

// デバッグ用：タッチ情報表示
function showTouchInfo(enabled = false) {
  if (!enabled) return;
  
  const info = document.createElement('div');
  info.id = 'touch-debug';
  info.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    font-family: monospace;
  `;
  document.body.appendChild(info);
  
  document.addEventListener('touchstart', (e) => {
    info.innerHTML = `Touches: ${e.touches.length}<br>Position: ${Math.round(e.touches[0]?.clientX || 0)}, ${Math.round(e.touches[0]?.clientY || 0)}`;
  });
  
  document.addEventListener('touchmove', (e) => {
    info.innerHTML = `Moving: ${e.touches.length}<br>Position: ${Math.round(e.touches[0]?.clientX || 0)}, ${Math.round(e.touches[0]?.clientY || 0)}`;
  });
}