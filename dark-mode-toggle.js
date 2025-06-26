// ============ ダークモード管理 ============

class DarkModeManager {
  constructor() {
    this.currentMode = this.getStoredMode() || this.getSystemMode();
    this.init();
  }

  init() {
    this.applyMode(this.currentMode);
    this.setupSystemModeListener();
  }

  getSystemMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  getStoredMode() {
    return localStorage.getItem('tumego-color-mode');
  }

  storeMode(mode) {
    localStorage.setItem('tumego-color-mode', mode);
  }

  applyMode(mode) {
    const html = document.documentElement;
    const body = document.body;
    
    // 既存のモードクラスを削除
    html.classList.remove('light-mode', 'dark-mode', 'auto-mode');
    body.classList.remove('light-mode', 'dark-mode', 'auto-mode');
    
    // 新しいモードクラスを追加
    html.classList.add(`${mode}-mode`);
    body.classList.add(`${mode}-mode`);
    
    // meta theme-colorを更新
    this.updateThemeColor(mode);
    
    // CSSカスタムプロパティを更新
    this.updateCSSVariables(mode);
    
    this.currentMode = mode;
    this.storeMode(mode);
    
    console.log(`🎨 カラーモード変更: ${mode}`);
  }

  updateThemeColor(mode) {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      const color = this.getEffectiveMode(mode) === 'dark' ? '#0A84FF' : '#007AFF';
      themeColorMeta.setAttribute('content', color);
    }
  }

  updateCSSVariables(mode) {
    const root = document.documentElement;
    const effectiveMode = this.getEffectiveMode(mode);
    
    if (effectiveMode === 'dark') {
      root.style.setProperty('--bg', '#000000');
      root.style.setProperty('--board', '#1C1C1E');
      root.style.setProperty('--line', '#FFFFFF');
      root.style.setProperty('--star', '#FFFFFF');
      root.style.setProperty('--coord', '#F2F2F7');
      root.style.setProperty('--accent', '#0A84FF');
      root.style.setProperty('--ios-gray', '#636366');
      root.style.setProperty('--ios-separator', '#38383A');
    } else {
      root.style.setProperty('--bg', '#f7f7f7');
      root.style.setProperty('--board', '#f1d49c');
      root.style.setProperty('--line', '#000000');
      root.style.setProperty('--star', '#000000');
      root.style.setProperty('--coord', '#333333');
      root.style.setProperty('--accent', '#007AFF');
      root.style.setProperty('--ios-gray', '#8E8E93');
      root.style.setProperty('--ios-separator', '#C6C6C8');
    }
  }

  getEffectiveMode(mode) {
    if (mode === 'auto') {
      return this.getSystemMode();
    }
    return mode;
  }

  setupSystemModeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener(() => {
      if (this.currentMode === 'auto') {
        this.applyMode('auto');
        if (typeof render === 'function') {
          render(); // 盤面を再描画
        }
      }
    });
  }

  toggle() {
    let nextMode;
    switch (this.currentMode) {
      case 'light':
        nextMode = 'dark';
        break;
      case 'dark':
        nextMode = 'auto';
        break;
      case 'auto':
      default:
        nextMode = 'light';
        break;
    }
    
    this.applyMode(nextMode);
    
    // ハプティックフィードバック
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    // 一時的にメッセージ表示
    if (typeof msg === 'function') {
      const modeNames = {
        light: '☀️ ライトモード',
        dark: '🌙 ダークモード', 
        auto: '🔄 自動切り替え'
      };
      msg(modeNames[nextMode]);
      setTimeout(() => msg(''), 2000);
    }
    
    return nextMode;
  }

  getCurrentMode() {
    return this.currentMode;
  }

  getEffectiveCurrentMode() {
    return this.getEffectiveMode(this.currentMode);
  }
}

// グローバルインスタンス
let darkModeManager;