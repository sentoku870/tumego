// ============ メインエントリーポイント ============
import { DEFAULT_CONFIG } from './types.js';
import { UIController } from './ui-controller.js';
// ============ グローバル状態初期化 ============
function createInitialState() {
    return {
        boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
        board: Array.from({ length: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE }, () => Array(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE).fill(0)),
        mode: 'alt',
        eraseMode: false,
        history: [],
        turn: 0,
        sgfMoves: [],
        numberMode: false,
        startColor: 1,
        sgfIndex: 0,
        numberStartIndex: 0,
        komi: DEFAULT_CONFIG.DEFAULT_KOMI,
        handicapStones: 0,
        handicapPositions: [],
        answerMode: 'black',
        problemDiagramSet: false,
        problemDiagramBlack: [],
        problemDiagramWhite: []
    };
}
// ============ DOM要素の取得 ============
function getUIElements() {
    const svg = document.getElementById('goban');
    const boardWrapper = document.getElementById('board-wrapper');
    const boardCanvas = document.getElementById('boardCanvas');
    const infoEl = document.getElementById('info');
    const sliderEl = document.getElementById('move-slider');
    const movesEl = document.getElementById('moves');
    const msgEl = document.getElementById('msg');
    // 必須要素の存在確認
    if (!svg || !boardWrapper || !boardCanvas) {
        throw new Error('必要なDOM要素が見つかりません (svg, boardWrapper, boardCanvas)');
    }
    return {
        svg,
        boardWrapper,
        boardCanvas,
        infoEl,
        sliderEl,
        movesEl,
        msgEl
    };
}
// ============ アプリケーション初期化 ============
function initializeApp() {
    try {
        console.log('Tumego TypeScript版 初期化開始...');
        // 状態とUI要素を初期化
        const gameState = createInitialState();
        const uiElements = getUIElements();
        // UIコントローラーを作成
        const uiController = new UIController(gameState, uiElements);
        // グローバルスコープに登録（置石ダイアログなどで使用）
        window.tumegoUIController = uiController;
        // 初期化完了
        uiController.initialize();
        console.log('Tumego TypeScript版 初期化完了！');
    }
    catch (error) {
        console.error('初期化エラー:', error);
        alert('アプリケーションの初期化に失敗しました: ' + error.message);
    }
}
// ============ DOMContentLoaded イベント ============
document.addEventListener('DOMContentLoaded', initializeApp);
// ============ エクスポート（デバッグ用） ============
export { initializeApp };
//# sourceMappingURL=main.js.map