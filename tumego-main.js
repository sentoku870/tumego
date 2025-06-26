// ============ iOS最適化メイン初期化処理 ============

// iOS検出
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

// 初期化
function init() {
  try {
    console.log('🍎 Tumego iOS最適化版 初期化開始');
    console.log(`デバイス: ${isIOS ? 'iOS' : 'その他'}, ブラウザ: ${isSafari ? 'Safari' : 'その他'}, PWA: ${isStandalone ? 'Yes' : 'No'}`);
    
    // iOS向け前処理
    if (isIOS) {
      initIOSSpecificFeatures();
    }
    
    // DOM要素の初期化
    initDOMElements();
    
    // ダークモードとドロップダウンの初期化
    initDropdowns();
    
    // 基本の盤面初期化
    initBoard(9); // 初期は 9 路・石なし
    
    // iOS最適化イベントリスナーの設定
    if (typeof initIOSOptimizedEvents === 'function') {
      initIOSOptimizedEvents();
    } else {
      // フォールバック: 基本のイベント処理
      initBoardEvents();
      initSVGEvents();
      initButtonEvents();
      initKeyboardEvents();
      initResizeEvents();
    }
    
    // URL からの SGF 読み込み
    loadSGFFromURL();
    
    // iOS向け後処理
    if (isIOS) {
      setTimeout(finalizeIOSSetup, 500);
    }
    
    console.log('✅ Tumego初期化完了');
    
    // 初期化完了を通知
    if (navigator.vibrate && isIOS) {
      navigator.vibrate([50, 30, 50]);
    }
    
  } catch (error) {
    console.error('❌ 初期化エラー:', error);
    showErrorMessage('アプリケーションの初期化に失敗しました: ' + error.message);
  }
}

// iOS固有機能の初期化
function initIOSSpecificFeatures() {
  console.log('🔧 iOS固有機能を初期化中...');
  
  // ビューポート設定の強制
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
  }
  
  // iOS向けCSSクラス追加
  document.body.classList.add('ios-device');
  if (isSafari) {
    document.body.classList.add('safari-browser');
  }
  if (isStandalone) {
    document.body.classList.add('pwa-mode');
  }
  
  // iOS Safari特有の問題対応
  if (isSafari && !isStandalone) {
    document.body.classList.add('safari-web');
    // 100vh問題の対応
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => {
      setTimeout(setVH, 100);
    });
  }
  
  // タッチ遅延の削除
  if ('FastClick' in window) {
    FastClick.attach(document.body);
  }
  
  // スクロールバウンス無効化
  document.body.style.overscrollBehavior = 'none';
  document.body.style.webkitOverflowScrolling = 'touch';
  
  // ピンチズーム無効化
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());
  
  console.log('✅ iOS固有機能の初期化完了');
}

// iOS向け最終セットアップ
function finalizeIOSSetup() {
  console.log('🏁 iOS向け最終セットアップ実行中...');
  
  // 画面サイズに基づく最適化
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  if (screenWidth <= 375) {
    // iPhone SE, Mini向け
    document.body.classList.add('small-screen');
  } else if (screenWidth <= 414) {
    // iPhone 標準サイズ向け
    document.body.classList.add('medium-screen');
  } else if (screenWidth <= 768) {
    // iPhone Plus/Pro Max向け
    document.body.classList.add('large-screen');
  } else {
    // iPad向け
    document.body.classList.add('tablet-screen');
  }
  
  // 初期レンダリング最適化
  render();
  updateBoardSize();
  updateInfo();
  
  // アニメーション有効化（初期化完了後）
  document.body.classList.add('animations-ready');
  
  // パフォーマンス情報をログ出力
  if ('performance' in window && performance.timing) {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    console.log(`⚡ ページ読み込み時間: ${loadTime}ms`);
  }
  
  // 最適化完了メッセージ
  if (msgEl) {
    msg('🍎 iOS最適化完了 - タッチで操作開始');
    setTimeout(() => msg(''), 3000);
  }
  
  console.log('✅ iOS向け最終セットアップ完了');
}

// エラーメッセージ表示
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 59, 48, 0.95);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    z-index: 9999;
    font-size: 16px;
    max-width: 90%;
    box-shadow: 0 8px 32px rgba(255, 59, 48, 0.3);
  `;
  
  errorDiv.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 12px;">⚠️ エラーが発生しました</div>
    <div style="margin-bottom: 16px;">${message}</div>
    <button onclick="location.reload()" style="
      background: white;
      color: #FF3B30;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    ">🔄 再読み込み</button>
  `;
  
  document.body.appendChild(errorDiv);
}

// デバッグ情報表示（開発用）
function showDebugInfo() {
  if (!window.location.search.includes('debug=true')) return;
  
  const debugInfo = document.createElement('div');
  debugInfo.id = 'debug-info';
  debugInfo.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 8px;
    font-size: 12px;
    font-family: monospace;
    z-index: 9998;
    max-width: 300px;
  `;
  
  const updateDebugInfo = () => {
    debugInfo.innerHTML = `
      <div><strong>📱 デバイス情報</strong></div>
      <div>iOS: ${isIOS}</div>
      <div>Safari: ${isSafari}</div>
      <div>PWA: ${isStandalone}</div>
      <div>画面: ${window.innerWidth}x${window.innerHeight}</div>
      <div>デバイス比: ${window.devicePixelRatio}</div>
      <div><strong>🎮 ゲーム状態</strong></div>
      <div>盤サイズ: ${state.boardSize}路</div>
      <div>手数: ${state.sgfIndex}/${state.sgfMoves.length}</div>
      <div>モード: ${state.mode}</div>
      <div>解答モード: ${state.numberMode}</div>
    `;
  };
  
  updateDebugInfo();
  document.body.appendChild(debugInfo);
  
  // 定期更新
  setInterval(updateDebugInfo, 1000);
}

// Service Worker登録（PWA対応）
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('📱 Service Worker登録成功:', registration.scope);
          
          // アップデート確認
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // アップデート通知
                  showUpdateNotification();
                }
              }
            });
          });
        })
        .catch(error => {
          console.log('❌ Service Worker登録失敗:', error);
        });
    });
  }
}

// アップデート通知
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    right: 20px;
    background: rgba(52, 199, 89, 0.95);
    color: white;
    padding: 16px;
    border-radius: 12px;
    text-align: center;
    z-index: 9999;
    font-size: 15px;
    box-shadow: 0 8px 32px rgba(52, 199, 89, 0.3);
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">🔄 アップデート利用可能</div>
    <div style="margin-bottom: 12px;">新しいバージョンがあります</div>
    <button onclick="location.reload()" style="
      background: white;
      color: #34C759;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      margin-right: 8px;
    ">更新</button>
    <button onclick="this.parentElement.remove()" style="
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 8px 16px;
      border-radius: 8px;
    ">後で</button>
  `;
  
  document.body.appendChild(notification);
  
  // 10秒後に自動で消す
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

// オンライン・オフライン状態の監視
function initNetworkMonitoring() {
  const updateNetworkStatus = () => {
    if (navigator.onLine) {
      document.body.classList.remove('offline');
      if (msgEl && document.body.classList.contains('was-offline')) {
        msg('🌐 オンラインに復帰しました');
        setTimeout(() => msg(''), 2000);
        document.body.classList.remove('was-offline');
      }
    } else {
      document.body.classList.add('offline', 'was-offline');
      if (msgEl) {
        msg('📱 オフラインモードで動作中');
      }
    }
  };
  
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus(); // 初期状態をチェック
}

// DOMContentLoaded で初期化実行
document.addEventListener('DOMContentLoaded', () => {
  console.log('📱 DOM読み込み完了 - 初期化開始');
  
  // Service Worker登録
  registerServiceWorker();
  
  // ネットワーク監視開始
  initNetworkMonitoring();
  
  // メイン初期化
  init();
  
  // デバッグ情報表示（開発用）
  showDebugInfo();
  
  console.log('🎉 すべての初期化処理完了');
});

// ページ離脱時の処理
window.addEventListener('beforeunload', (e) => {
  // 未保存の変更がある場合の警告（必要に応じて）
  if (state.sgfMoves.length > 0 && !localStorage.getItem('auto-saved-sgf')) {
    localStorage.setItem('auto-saved-sgf', exportSGF());
  }
});

// ページ表示時の自動復元
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // ページがキャッシュから復元された場合
    console.log('📄 ページがキャッシュから復元されました');
    render();
    updateBoardSize();
  }
});