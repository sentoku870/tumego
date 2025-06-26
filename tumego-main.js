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
    
    // URL からの SGF 読み込み
    loadSGFFromURL();
    
    console.log('Tumego初期化完了');
  } catch (error) {
    console.error('初期化エラー:', error);
    alert('アプリケーションの初期化に失敗しました: ' + error.message);
  }
}

// DOMContentLoaded で初期化実行
document.addEventListener('DOMContentLoaded', init);