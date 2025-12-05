// ============ Main entry point ============
import { GameState, UIElements, DEFAULT_CONFIG } from './types.js';
import { UIController } from './ui-controller.js';

// ============ Initialize global game state ============
function createInitialState(): GameState {
  return {
    boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
    board: Array.from({ length: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE }, () =>
      Array(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE).fill(0)
    ),
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
    problemDiagramWhite: [],
    gameTree: null,
    sgfLoadedFromExternal: false,
    gameInfo: {
      title: '',
      komi: DEFAULT_CONFIG.DEFAULT_KOMI,
      handicap: null,
      playerBlack: null,
      playerWhite: null,
      result: null
    },
    capturedCounts: { black: 0, white: 0 }
  };
}

// ============ Acquire required DOM elements ============
function getUIElements(): UIElements {
  const svg = document.getElementById('goban') as unknown as SVGSVGElement;
  const boardWrapper = document.getElementById('board-wrapper') as HTMLElement;
  const infoEl = document.getElementById('info') as HTMLElement;
  const sliderEl = document.getElementById('move-slider') as HTMLInputElement;
  const movesEl = document.getElementById('moves') as HTMLElement;
  const msgEl = document.getElementById('msg') as HTMLElement;
  const capturedEl = document.getElementById('captured-stones') as HTMLElement | null;

  // Ensure essential elements exist before continuing
  if (!svg || !boardWrapper) {
    throw new Error('必要なDOM要素が見つかりません (svg, boardWrapper)');
  }

  return {
    svg,
    boardWrapper,
    infoEl,
    sliderEl,
    movesEl,
    msgEl,
    capturedEl: capturedEl ?? undefined
  };
}

// ============ Initialize SGF info tabs ============
function setupSgfInfoTabs(): void {
  const panel = document.getElementById('sgf-info-panel');
  if (!panel) return;

  const tabButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-sgf-tab]'));
  const basicContent = document.getElementById('sgf-tab-basic');
  const advancedContent = document.getElementById('sgf-tab-advanced');

  const activateTab = (tab: 'basic' | 'advanced') => {
    tabButtons.forEach(button => {
      const isActive = button.dataset.sgfTab === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    if (basicContent) {
      basicContent.hidden = tab !== 'basic';
    }

    if (advancedContent) {
      advancedContent.hidden = tab !== 'advanced';
    }
  };

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.sgfTab === 'advanced' ? 'advanced' : 'basic';
      activateTab(targetTab);
    });
  });

  activateTab('basic');
}

// ============ Application bootstrap ============
function initializeApp(): void {
  try {
    console.log('Tumego TypeScript版 初期化開始...');

    // Prepare initial state and DOM references
    const gameState = createInitialState();
    const uiElements = getUIElements();

    // Set up UI controller
    const uiController = new UIController(gameState, uiElements);

    // Wire up SGF info tab behavior
    setupSgfInfoTabs();

    // Expose controller for dialogs that rely on the global scope
    (window as any).tumegoUIController = uiController;

    // Finalize initialization
    uiController.initialize();

    console.log('Tumego TypeScript版 初期化完了！');

  } catch (error) {
    console.error('初期化エラー:', error);
    alert('アプリケーションの初期化に失敗しました: ' + (error as Error).message);
  }
}

// ============ DOMContentLoaded イベント ============
document.addEventListener('DOMContentLoaded', initializeApp);

// ============ エクスポート（デバッグ用） ============
export { initializeApp };
