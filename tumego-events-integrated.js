// === 統合されたイベント処理（iOS最適化＋ドロップダウン対応） ===

// iOS向けタッチイベント最適化の変数（既存コードから継承）
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let isLongPress = false;
let longPressTimer = null;
let gestureStartDistance = 0;
let gestureStartScale = 1;

// 盤面ドラッグ用変数（既存コードから継承）
let dragging = false;
let dragColor = null;
let lastPos = null;

// グローバルマネージャー
let dropdownManagerInstance = null;

// ============ 統合初期化関数 ============
function initIOSOptimizedEvents() {
  console.log('🔧 統合イベント処理を初期化中...');
  
  // ダークモードマネージャー初期化
  if (typeof DarkModeManager !== 'undefined') {
    darkModeManager = new DarkModeManager();
  }
  
  // 基本イベント初期化
  initBoardEvents();
  initSVGEvents();  
  initKeyboardEvents();
  initResizeEvents();
  
  // ボタンイベント初期化（ドロップダウン対応）
  initEnhancedButtonEvents();
  
  // iOS固有機能
  initSwipeGestures();
  initAccessibility();
  initPWAFeatures();
  initBatteryOptimization();
  initPerformanceMonitoring();
  initErrorHandling();
  
  console.log('✅ 統合イベント処理初期化完了');
}

// ============ 強化されたボタンイベント処理 ============
function initEnhancedButtonEvents() {
  // ドロップダウンマネージャー初期化
  if (typeof DropdownManager !== 'undefined') {
    dropdownManagerInstance = new DropdownManager();
  }

  // 基本操作ボタン
  document.getElementById('btn-clear')?.addEventListener('click', handleClear);
  document.getElementById('btn-undo')?.addEventListener('click', handleUndo);
  document.getElementById('btn-erase')?.addEventListener('click', handleEraseToggle);

  // 手数操作ボタン
  document.getElementById('btn-prev-move')?.addEventListener('click', handlePrevMove);
  document.getElementById('btn-next-move')?.addEventListener('click', handleNextMove);

  // 解答モードボタン
  ['btn-play-black', 'btn-play-white'].forEach((id, idx) => {
    const btn = document.getElementById(id);
    if (btn) {
      const handler = () => enableAnswerMode(idx + 1);
      btn.addEventListener('click', handler);
      btn.addEventListener('touchstart', handler, { passive: true });
      btn.addEventListener('touchstart', addTouchFeedback, { passive: true });
    }
  });

  // 一時保存・読込
  document.getElementById('btn-temp-save')?.addEventListener('click', saveTemp);
  document.getElementById('btn-temp-load')?.addEventListener('click', loadTemp);

  // 配置モードボタン
  document.getElementById('btn-black')?.addEventListener('click', e => setMode('black', e.currentTarget));
  document.getElementById('btn-white')?.addEventListener('click', e => setMode('white', e.currentTarget));
  document.getElementById('btn-alt')?.addEventListener('click', e => {
    state.startColor = state.startColor === 1 ? 2 : 1;
    setMode('alt', e.currentTarget);
  });

  // ファイル入力
  document.getElementById('sgf-input')?.addEventListener('change', handleFileLoad);

  // スライダー
  if (sliderEl) {
    sliderEl.addEventListener('input', e => { 
      setMoveIndex(parseInt(e.target.value, 10)); 
    });
    
    // iOS向けスライダー最適化
    sliderEl.addEventListener('touchstart', e => {
      e.target.style.webkitAppearance = 'none';
    });
  }

  // UI初期化（遅延実行）
  setTimeout(() => {
    dropdownManagerInstance?.initializeUI();
  }, 200);
}

// ============ 既存のイベントハンドラー（iOS最適化版から継承） ============

// ボードEvents（iOS最適化版）
function initBoardEvents() {
  if (!boardWrapper) return;
  
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
    boardWrapper.addEventListener('touchend', preventDoubleTapZoom);
    boardWrapper.style.webkitUserSelect = 'none';
    boardWrapper.style.webkitTouchCallout = 'none';
  }
}

// タッチ処理関数群（iOS最適化版から継承）
function handleTouchStart(e) {
  boardHasFocus = true;
  boardWrapper.focus();
  
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    touchStartTime = Date.now();
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    isLongPress = false;
    
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      handleLongPress(touch);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
    
    if (state.eraseMode || state.mode !== 'alt') {
      dragging = true;
      dragColor = state.eraseMode ? null : getDragColor(0);
      lastPos = null;
      placeAtEvent(touch);
    }
  } else if (e.touches.length === 2) {
    clearTimeout(longPressTimer);
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    gestureStartDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }
  
  if (e.touches.length === 1) {
    e.preventDefault();
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPos.x, 2) +
      Math.pow(touch.clientY - touchStartPos.y, 2)
    );
    
    if (moveDistance > 10) {
      clearTimeout(longPressTimer);
      isLongPress = false;
    }
    
    if (dragging && (state.eraseMode || state.mode !== 'alt')) {
      const { col, row } = pointToCoord(touch);
      if (lastPos && lastPos.col === col && lastPos.row === row) return;
      lastPos = { col, row };
      placeAtEvent(touch);
    }
    
    e.preventDefault();
  }
}

function handleTouchEnd(e) {
  clearTimeout(longPressTimer);
  
  if (e.changedTouches.length === 1 && !isLongPress) {
    const touch = e.changedTouches[0];
    const touchDuration = Date.now() - touchStartTime;
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPos.x, 2) +
      Math.pow(touch.clientY - touchStartPos.y, 2)
    );
    
    if (touchDuration < 300 && moveDistance < 10) {
      if (state.mode === 'alt' && !state.eraseMode) {
        placeAtEvent(touch);
      }
    }
  }
  
  endDrag();
}

function handleTouchCancel(e) {
  clearTimeout(longPressTimer);
  endDrag();
}

function handlePointerDown(e) {
  boardHasFocus = true;
  boardWrapper.focus();
  
  if (e.pointerType === 'pen') {
    handlePencilInput(e);
    return;
  }
  
  if (e.button === 2) e.preventDefault();
  
  const color = getDragColor(e.button);
  if (color !== null || state.eraseMode) {
    dragging = true;
    dragColor = color;
    lastPos = null;
    placeAtEvent(e);
  }
}

// ユーティリティ関数群（iOS最適化版から継承）
function handlePencilInput(e) {
  const pressure = e.pressure || 0.5;
  
  if (pressure > 0.3) {
    dragging = true;
    dragColor = getTurnColor();
    placeAtEvent(e);
  } else {
    showPlacementPreview(e);
  }
}

function handleLongPress(touch) {
  const { col, row } = pointToCoord(touch);
  if (!inRange(col) || !inRange(row)) return;
  
  showContextMenu(col, row, touch.clientX, touch.clientY);
}

function preventDoubleTapZoom(e) {
  const now = Date.now();
  if (now - (preventDoubleTapZoom.lastTap || 0) < 300) {
    e.preventDefault();
  }
  preventDoubleTapZoom.lastTap = now;
}

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

function endDrag() {
  if (!dragging) return;
  dragging = false;
  dragColor = null; 
  lastPos = null;
}

// SVGイベント処理（デスクトップ用）
function initSVGEvents() {
  if (!svg) return;
  
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    
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
    if (e.pointerType === 'touch') return;
    
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

// 石配置処理
function placeAtEvent(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row)) return;
  
  if (state.eraseMode) {
    if (state.board[row][col] !== 0) {
      state.history.push(cloneBoard(state.board));
      state.board[row][col] = 0;
      render(); 
      updateInfo();
      if (navigator.vibrate) navigator.vibrate(30);
    }
    return;
  }
  
  const color = dragColor || getTurnColor();
  const ok = tryMove(col, row, color);
  if (ok) { 
    render(); 
    updateInfo(); 
    updateSlider();
    if (navigator.vibrate) navigator.vibrate(40);
  }
}

// ============ イベントハンドラー関数群 ============

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
    msg('🖌️ 消去モード: 石をタップして削除'); 
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

function enableAnswerMode(color) {
  if (!state.numberMode || state.startColor !== color) {
    startNumberMode(color);
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

function addTouchFeedback(e) {
  const btn = e.currentTarget;
  btn.style.transform = 'scale(0.95)';
  btn.style.opacity = '0.8';
  
  setTimeout(() => {
    btn.style.transform = '';
    btn.style.opacity = '';
  }, 100);
}

// ============ iOS向け追加機能 ============

// スワイプジェスチャー
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
      handleNextMove();
    } else {
      handlePrevMove();
    }
  }
}

// コンテキストメニュー
function showContextMenu(col, row, x, y) {
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  
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
    
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  
  setTimeout(() => {
    document.addEventListener('touchstart', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('touchstart', closeMenu);
      }
    });
  }, 100);
}

function removeStone(col, row) {
  if (inRange(col) && inRange(row) && state.board[row][col] !== 0) {
    state.history.push(cloneBoard(state.board));
    state.board[row][col] = 0;
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

function showPlacementPreview(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row) || state.board[row][col] !== 0) return;
  
  const existing = svg.querySelector('.placement-preview');
  if (existing) existing.remove();
  
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
  
  setTimeout(() => {
    if (svg.contains(preview)) {
      svg.removeChild(preview);
    }
  }, 1000);
}

// ============ キーボードショートカット ============

const keyBindings = {
  'q': () => dropdownManagerInstance?.selectBoardSize(9),
  'w': () => dropdownManagerInstance?.selectBoardSize(13),
  'e': () => dropdownManagerInstance?.selectBoardSize(19),
  'a': () => handleClear(),
  's': () => handleUndo(),
  'd': () => handleEraseToggle(),
  'z': () => document.getElementById('btn-black')?.click(),
  'x': () => document.getElementById('btn-alt')?.click(),
  'c': () => document.getElementById('btn-white')?.click(),
  'ArrowLeft': () => handlePrevMove(),
  'ArrowRight': () => handleNextMove(),
  'l': () => dropdownManagerInstance?.toggleLayout(),
  'n': () => dropdownManagerInstance?.toggleDarkMode(),
  ' ': (e) => {
    e.preventDefault();
    handleNextMove();
  }
};

function initKeyboardEvents() {
  document.addEventListener('keydown', e => {
    if (!boardHasFocus && !e.target.matches('input, textarea')) return;
    
    const key = e.key;
    if (keyBindings[key]) {
      e.preventDefault();
      keyBindings[key](e);
    }
  });
}

// ============ リサイズ対応 ============

function initResizeEvents() {
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateBoardSize();
      render();
    }, 100);
  });
  
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateBoardSize();
      render();
    }, 100);
  });
  
  window.addEventListener('scroll', () => {
    if (window.scrollY === 0) {
      setTimeout(updateBoardSize, 100);
    }
  });
}

// ============ アクセシビリティ ============

function initAccessibility() {
  if (svg) {
    svg.setAttribute('role', 'application');
    svg.setAttribute('aria-label', `${state.boardSize}路盤の囲碁盤面`);
  }
  
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addListener(handleReducedMotion);
    handleReducedMotion(mediaQuery);
  }
  
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

// ============ PWA機能 ============

function initPWAFeatures() {
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });
  
  window.addEventListener('appinstalled', (evt) => {
    console.log('PWA installed successfully');
    msg('📱 アプリがホーム画面に追加されました！');
    hideInstallPromotion();
  });
  
  if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('standalone');
  }
}

function showInstallPromotion() {
  // 既存の実装を簡略化
  console.log('📱 PWAインストール促進表示');
}

function hideInstallPromotion() {
  console.log('📱 PWAインストール促進非表示');
}

// ============ バッテリー・パフォーマンス最適化 ============

function initBatteryOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('app-hidden');
    } else {
      document.body.classList.remove('app-hidden');
      setTimeout(render, 100);
    }
  });
}

function initPerformanceMonitoring() {
  if ('performance' in window) {
    let frameCount = 0;
    let lastTime = performance.now();
    
    function countFrames() {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        if (fps < 30) {
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

// ============ エラーハンドリング ============

function initErrorHandling() {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    msg('⚠️ エラーが発生しました。アプリを再読み込みしてください。');
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
    msg('⚠️ 処理中にエラーが発生しました。');
  });
}

// ============ ユーティリティ関数 ============

function disableEraseMode() {
  if (state.eraseMode) {
    state.eraseMode = false;
    const el = document.getElementById('btn-erase');
    if (el) el.classList.remove('active');
    msg('');
  }
}

// SVGヘルパー関数
function svgtag(tag, attrs) { 
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag); 
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); 
  return el; 
}

console.log('📱 統合イベント処理ファイル読み込み完了');