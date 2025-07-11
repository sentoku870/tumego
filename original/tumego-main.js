// ============ メイン初期化処理 ============

// 初期化
function init() {
  try {
    // DOM要素の初期化
    initDOMElements();
    
    // 基本の盤面初期化
    initBoard(9); // 初期は 9 路・石なし
    
    // イベントリスナーの設定
    initBoardEvents();
    initSVGEvents();
    initButtonEvents();
    initKeyboardEvents();
    initResizeEvents();
    
    // 履歴機能の初期化
    operationHistory.clear();
    operationHistory.save('アプリケーション開始');
    
    // URL からの SGF 読み込み（エラーハンドリング付き）
    try {
      if (typeof loadSGFFromURL === 'function') {
        loadSGFFromURL();
      }
    } catch (error) {
      console.warn('URL からの SGF 読み込みに失敗:', error);
    }
    
    console.log('Tumego初期化完了 - 履歴機能有効');
  } catch (error) {
    console.error('初期化エラー:', error);
    alert('アプリケーションの初期化に失敗しました: ' + error.message);
  }
}

// DOMContentLoaded で初期化実行
document.addEventListener('DOMContentLoaded', init);