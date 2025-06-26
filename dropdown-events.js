// ============ ドロップダウンメニューとモード切り替え ============

class DropdownManager {
  constructor() {
    this.openDropdown = null;
    this.init();
  }

  init() {
    // ドロップダウンボタンにイベントを追加
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    this.setupDropdowns();
  }

  setupDropdowns() {
    // 盤サイズドロップダウン
    this.setupBoardSizeDropdown();
    
    // ファイル操作ドロップダウン
    this.setupFileOperationsDropdown();
    
    // 設定ドロップダウン
    this.setupSettingsDropdown();
  }

  setupBoardSizeDropdown() {
    const trigger = document.getElementById('board-size-dropdown');
    const menu = document.getElementById('board-size-menu');
    
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown('board-size-menu');
    });

    // サイズ選択
    menu.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const size = parseInt(btn.dataset.size, 10);
        this.selectBoardSize(size);
        this.closeAllDropdowns();
      });
    });
  }

  setupFileOperationsDropdown() {
    const trigger = document.getElementById('file-operations-dropdown');
    const menu = document.getElementById('file-operations-menu');
    
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown('file-operations-menu');
    });

    // ファイル操作項目
    const loadSGFBtn = menu.querySelector('#btn-load-sgf');
    const copySGFBtn = menu.querySelector('#btn-copy-sgf');
    const qrShareBtn = menu.querySelector('#btn-qr-share');

    if (loadSGFBtn) {
      loadSGFBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSGFLoad();
        this.closeAllDropdowns();
      });
    }

    if (copySGFBtn) {
      copySGFBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSGFCopy();
        this.closeAllDropdowns();
      });
    }

    if (qrShareBtn) {
      qrShareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createSGFQRCode();
        this.closeAllDropdowns();
      });
    }

    // ファイル選択ラベル
    const fileLabel = menu.querySelector('label[for="sgf-input"]');
    if (fileLabel) {
      fileLabel.addEventListener('click', () => {
        this.closeAllDropdowns();
      });
    }
  }

  setupSettingsDropdown() {
    const trigger = document.getElementById('settings-dropdown');
    const menu = document.getElementById('settings-menu');
    
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown('settings-menu');
    });

    // レイアウト切り替え
    const layoutBtn = menu.querySelector('#btn-layout');
    if (layoutBtn) {
      layoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayout();
        this.closeAllDropdowns();
      });
    }

    // ダークモード切り替え
    const darkModeBtn = menu.querySelector('#btn-dark-mode');
    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDarkMode();
        this.closeAllDropdowns();
      });
    }
  }

  toggleDropdown(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    // 他のドロップダウンを閉じる
    if (this.openDropdown && this.openDropdown !== menuId) {
      this.closeDropdown(this.openDropdown);
    }

    // 現在のドロップダウンを切り替え
    if (menu.classList.contains('show')) {
      this.closeDropdown(menuId);
    } else {
      this.openDropdownMenu(menuId);
    }
  }

  openDropdownMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    menu.classList.add('show');
    this.openDropdown = menuId;

  openDropdownMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    menu.classList.add('show');
    this.openDropdown = menuId;

    // iOS向けハプティックフィードバック
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  closeDropdown(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    menu.classList.remove('show');
    if (this.openDropdown === menuId) {
      this.openDropdown = null;
    }
  }

  closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(menu => {
      menu.classList.remove('show');
    });
    this.openDropdown = null;
  }

  handleDocumentClick(e) {
    // ドロップダウン外をクリックした場合は閉じる
    if (!e.target.closest('.dropdown-container')) {
      this.closeAllDropdowns();
    }
  }

  selectBoardSize(size) {
    if (typeof initBoard === 'function') {
      disableEraseMode();
      initBoard(size);
    }
    
    // 表示テキストを更新
    const currentSizeEl = document.getElementById('current-board-size');
    if (currentSizeEl) {
      currentSizeEl.textContent = `${size}路`;
    }

    // アクティブ状態を更新
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.size) === size) {
        btn.classList.add('active');
      }
    });
  }

  async handleSGFLoad() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        if (typeof parseSGF === 'function') {
          state.sgfMoves = parseSGF(text);
          state.sgfIndex = 0;
          setMoveIndex(0);
          document.getElementById('sgf-text').value = text;
          msg('📋 クリップボードからSGF読み込み完了');
          if (navigator.vibrate) navigator.vibrate(40);
        }
      } else {
        msg('📋 クリップボードにSGFがありません');
      }
    } catch (err) {
      console.error('クリップボード読み込みエラー:', err);
      const sgfTextarea = document.getElementById('sgf-text');
      if (sgfTextarea && sgfTextarea.value.trim()) {
        const textFromTextarea = sgfTextarea.value.trim();
        if (typeof parseSGF === 'function') {
          state.sgfMoves = parseSGF(textFromTextarea);
          state.sgfIndex = 0;
          setMoveIndex(0);
          msg('📝 テキストエリアからSGF読み込み完了');
          if (navigator.vibrate) navigator.vibrate(40);
        }
      } else {
        msg('❌ クリップボード読み込み失敗・テキストエリアも空です');
      }
    }
  }

  handleSGFCopy() {
    if (typeof exportSGF === 'function') {
      const text = exportSGF();
      document.getElementById('sgf-text').value = text;
      navigator.clipboard.writeText(text).then(() => {
        msg('📤 SGFをコピーしました');
        if (navigator.vibrate) navigator.vibrate(30);
      });
    }
  }

  toggleLayout() {
    const isHorizontal = document.body.classList.toggle('horizontal');
    const layoutTextEl = document.getElementById('layout-text');
    
    if (layoutTextEl) {
      layoutTextEl.textContent = isHorizontal ? '縦表示' : '横表示';
    }

    if (typeof updateBoardSize === 'function') {
      updateBoardSize();
    }

    // ハプティックフィードバック
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }

    msg(isHorizontal ? '📱 横レイアウトに切り替え' : '📱 縦レイアウトに切り替え');
    setTimeout(() => msg(''), 2000);
  }

  toggleDarkMode() {
    if (darkModeManager) {
      const newMode = darkModeManager.toggle();
      this.updateDarkModeText(newMode);
    }
  }

  updateDarkModeText(mode) {
    const darkModeTextEl = document.getElementById('dark-mode-text');
    if (!darkModeTextEl) return;

    const modeTexts = {
      light: 'ダークモード',
      dark: '自動切り替え',
      auto: 'ライトモード'
    };

    const modeIcons = {
      light: '🌙',
      dark: '🔄',
      auto: '☀️'
    };

    darkModeTextEl.textContent = modeTexts[mode];
    
    // ボタンのアイコンも更新
    const darkModeBtn = document.getElementById('btn-dark-mode');
    if (darkModeBtn) {
      const iconSpan = darkModeBtn.querySelector('span');
      if (iconSpan) {
        darkModeBtn.innerHTML = `${modeIcons[mode]} <span id="dark-mode-text">${modeTexts[mode]}</span>`;
      }
    }
  }

  // 初期状態の設定
  initializeUI() {
    // 現在の盤サイズを表示
    const currentSizeEl = document.getElementById('current-board-size');
    if (currentSizeEl && typeof state !== 'undefined') {
      currentSizeEl.textContent = `${state.boardSize}路`;
    }

    // ダークモードテキストを初期化
    if (darkModeManager) {
      this.updateDarkModeText(darkModeManager.getCurrentMode());
    }

    // レイアウトテキストを初期化
    const layoutTextEl = document.getElementById('layout-text');
    if (layoutTextEl) {
      const isHorizontal = document.body.classList.contains('horizontal');
      layoutTextEl.textContent = isHorizontal ? '縦表示' : '横表示';
    }
  }
}

// ============ 統合されたイベント処理 ============

// 既存のボタンイベント処理を更新
function initButtonEvents() {
  // ドロップダウンマネージャーを初期化
  const dropdownManager = new DropdownManager();

  // 基本操作ボタン（変更なし）
  document.getElementById('btn-clear').addEventListener('click', handleClear);
  document.getElementById('btn-undo').addEventListener('click', handleUndo);
  document.getElementById('btn-erase').addEventListener('click', handleEraseToggle);

  // 手数操作ボタン（変更なし）
  document.getElementById('btn-prev-move').addEventListener('click', handlePrevMove);
  document.getElementById('btn-next-move').addEventListener('click', handleNextMove);

  // 解答モードボタン（変更なし）
  ['btn-play-black', 'btn-play-white'].forEach((id, idx) => {
    const btn = document.getElementById(id);
    const handler = () => enableAnswerMode(idx + 1);
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: true });
    btn.addEventListener('touchstart', addTouchFeedback, { passive: true });
  });

  // 一時保存・読込（変更なし）
  document.getElementById('btn-temp-save').addEventListener('click', saveTemp);
  document.getElementById('btn-temp-load').addEventListener('click', loadTemp);

  // 配置モードボタン（変更なし）
  document.getElementById('btn-black').addEventListener('click', e => setMode('black', e.currentTarget));
  document.getElementById('btn-white').addEventListener('click', e => setMode('white', e.currentTarget));
  document.getElementById('btn-alt').addEventListener('click', e => {
    state.startColor = state.startColor === 1 ? 2 : 1;
    setMode('alt', e.currentTarget);
  });

  // ファイル入力（変更なし）
  document.getElementById('sgf-input').addEventListener('change', handleFileLoad);

  // スライダー（変更なし）
  sliderEl.addEventListener('input', e => { 
    setMoveIndex(parseInt(e.target.value, 10)); 
  });
  
  // iOS向けスライダー最適化（変更なし）
  sliderEl.addEventListener('touchstart', e => {
    e.target.style.webkitAppearance = 'none';
  });

  // UI初期化
  setTimeout(() => {
    dropdownManager.initializeUI();
  }, 100);

  return dropdownManager;
}

// グローバル変数
let dropdownManagerInstance = null;

// 初期化時にドロップダウンマネージャーを設定
function initDropdowns() {
  // ダークモードマネージャーを初期化
  darkModeManager = new DarkModeManager();
  
  // ドロップダウンマネージャーを初期化
  dropdownManagerInstance = new DropdownManager();
  
  // UI初期化
  setTimeout(() => {
    dropdownManagerInstance.initializeUI();
  }, 100);
}

// キーボードショートカットを更新
const keyBindings = {
  'q': () => dropdownManagerInstance?.selectBoardSize(9),
  'w': () => dropdownManagerInstance?.selectBoardSize(13),
  'e': () => dropdownManagerInstance?.selectBoardSize(19),
  'a': () => document.getElementById('btn-clear').click(),
  's': () => document.getElementById('btn-undo').click(),
  'd': () => document.getElementById('btn-erase').click(),
  'z': () => document.getElementById('btn-black').click(),
  'x': () => document.getElementById('btn-alt').click(),
  'c': () => document.getElementById('btn-white').click(),
  'ArrowLeft': () => document.getElementById('btn-prev-move').click(),
  'ArrowRight': () => document.getElementById('btn-next-move').click(),
  'l': () => dropdownManagerInstance?.toggleLayout(),
  'n': () => dropdownManagerInstance?.toggleDarkMode(),
  ' ': (e) => {
    e.preventDefault();
    document.getElementById('btn-next-move').click();
  }
};

// エクスポート用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DropdownManager, DarkModeManager };
}