// === 設定定数 ===
const CONFIG = {
  CELL_SIZE: 60,
  MARGIN: 30,
  STONE_RADIUS: 26,
  STAR_RADIUS: 4,
  MAX_BOARD_SIZE: 19,
  MIN_BOARD_SIZE: 9,
  DEFAULT_BOARD_SIZE: 9,
  DEFAULT_KOMI: 6.5,
  COORD_FONT_RATIO: 0.28,
  MOVE_NUM_FONT_RATIO: 0.4
};

// 互換性のため従来の定数も残す
const CELL = CONFIG.CELL_SIZE;
const MARGIN = CONFIG.MARGIN;

// === 盤面状態 ===
const state = {
  boardSize: CONFIG.DEFAULT_BOARD_SIZE,
  board: [],        // 0:空 1:黒 2:白
  mode: 'alt',      // 'black' | 'white' | 'alt'
  eraseMode: false,
  history: [],
  turn: 0,          // 着手番号
  sgfMoves: [],     // SGF から読み込んだ着手
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  komi: CONFIG.DEFAULT_KOMI,
  handicapStones: 0, // 置石数
  handicapPositions: [], // 置石位置
  answerMode: 'black' // 'black' または 'white' - 解答モードの状態
};

// === 操作履歴管理 ===
const operationHistory = {
  snapshots: [], // 最大5つの操作履歴
  maxSnapshots: 5,
  
  // 現在の状態をスナップショットとして保存
  save(description) {
    const snapshot = {
      timestamp: new Date(),
      description: description,
      state: {
        boardSize: state.boardSize,
        board: cloneBoard(state.board),
        mode: state.mode,
        sgfMoves: [...state.sgfMoves],
        sgfIndex: state.sgfIndex,
        numberStartIndex: state.numberStartIndex,
        handicapStones: state.handicapStones,
        handicapPositions: [...state.handicapPositions],
        komi: state.komi,
        startColor: state.startColor,
        numberMode: state.numberMode,
        answerMode: state.answerMode,
        turn: state.turn
      }
    };
    
    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.pop();
    }
    
    console.log(`操作履歴保存: ${description}`, this.snapshots.length);
  },
  
  // 指定のスナップショットに復元
  restore(index) {
    if (index < 0 || index >= this.snapshots.length) return false;
    
    const snapshot = this.snapshots[index];
    const savedState = snapshot.state;
    
    // 状態を復元
    state.boardSize = savedState.boardSize;
    state.board = cloneBoard(savedState.board);
    state.mode = savedState.mode;
    state.sgfMoves = [...savedState.sgfMoves];
    state.sgfIndex = savedState.sgfIndex;
    state.numberStartIndex = savedState.numberStartIndex;
    state.handicapStones = savedState.handicapStones;
    state.handicapPositions = [...savedState.handicapPositions];
    state.komi = savedState.komi;
    state.startColor = savedState.startColor;
    state.numberMode = savedState.numberMode;
    state.answerMode = savedState.answerMode;
    state.turn = savedState.turn;
    
    // 復元後の処理
    render();
    updateInfo();
    updateSlider();
    updateBoardSize();
    
    // SGFテキストエリアの更新
    const sgfTextEl = getDOMElement('sgf-text');
    if (sgfTextEl) {
      sgfTextEl.value = exportSGF();
    }
    
    // ボタン状態の更新
    const sizeBtn = document.querySelector(`.size-btn[data-size="${state.boardSize}"]`);
    if (sizeBtn) setActive(sizeBtn, 'size-btn');
    
    // 解答ボタンの状態更新
    const answerBtn = getDOMElement('btn-answer');
    if (answerBtn) {
      if (state.answerMode === 'white') {
        answerBtn.textContent = '⚪ 白先';
        answerBtn.classList.add('white-mode');
      } else {
        answerBtn.textContent = '🔥 黒先';
        answerBtn.classList.remove('white-mode');
      }
    }
    
    console.log(`履歴復元: ${snapshot.description}`);
    msg(`履歴復元: ${snapshot.description}`);
    return true;
  },
  
  // 履歴一覧を取得
  getList() {
    return this.snapshots.map((snapshot, index) => ({
      index: index,
      description: snapshot.description,
      timestamp: snapshot.timestamp,
      timeString: snapshot.timestamp.toLocaleTimeString()
    }));
  },
  
  // 履歴をクリア
  clear() {
    this.snapshots = [];
  }
};

// DOM要素の参照（初期化時に設定）
let svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl;
let boardHasFocus = false;

// DOM要素を安全に取得する関数
function getDOMElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`DOM要素が見つかりません: ${id}`);
  }
  return el;
}

// DOM要素を初期化する関数
function initDOMElements() {
  svg = getDOMElement('goban');
  boardWrapper = getDOMElement('board-wrapper');
  infoEl = getDOMElement('info');
  sliderEl = getDOMElement('move-slider');
  movesEl = getDOMElement('moves');
  msgEl = getDOMElement('msg');
  
  // 必須要素が存在しない場合はエラーを投げる
  if (!svg || !boardWrapper) {
    throw new Error('必要なDOM要素が見つかりません');
  }
}

// ============ ユーティリティ ============
function msg(text) { 
  if (!msgEl) {
    msgEl = getDOMElement('msg');
  }
  if (msgEl) msgEl.textContent = text; 
}

function cloneBoard(b) { return b.map(r => r.slice()); }
function inRange(v) { return v >= 0 && v < state.boardSize; }
function neighbours([x, y]) {
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([i, j]) => inRange(i) && inRange(j));
}

function setActive(el, groupClass) {
  if (!el) return;
  document.querySelectorAll(`.${groupClass}`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// 他のボタンを押したときに消去モードを解除
function disableEraseMode() {
  if (state.eraseMode) {
    state.eraseMode = false;
    const el = getDOMElement('btn-erase');
    if (el) el.classList.remove('active');
    msg('');
  }
}

function getTurnColor() {
  if (state.numberMode) {
    return state.turn % 2 === 0 ? state.startColor : 3 - state.startColor;
  }
  if (state.mode === 'alt') return state.turn % 2 === 0 ? state.startColor : 3 - state.startColor;
  if (state.mode === 'black') return 1;
  return 2;
}

// === グループ探索と呼吸点 ===
function groupLib(x, y, board) {
  const color = board[y][x];
  const visited = new Set();
  const stones = [];
  let libs = 0;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push([cx, cy]);
    for (const [nx, ny] of neighbours([cx, cy])) {
      if (board[ny][nx] === 0) libs++;
      else if (board[ny][nx] === color) stack.push([nx, ny]);
    }
  }
  return { stones, libs };
}

function removeStones(stones, board) { 
  stones.forEach(([x, y]) => { board[y][x] = 0; }); 
}

// === 着手試行 ===
function tryMove(col, row, color, record = true) {
  if (!inRange(col) || !inRange(row)) return false;
  if (state.board[row][col] !== 0) return false;

  const newBoard = cloneBoard(state.board);
  newBoard[row][col] = color;
  const opp = 3 - color;
  
  // 隣接相手石捕獲
  for (const [nx, ny] of neighbours([col, row])) {
    if (newBoard[ny][nx] === opp) {
      const info = groupLib(nx, ny, newBoard);
      if (info.libs === 0) removeStones(info.stones, newBoard);
    }
  }
  
  // 自分の呼吸点
  const self = groupLib(col, row, newBoard);
  if (self.libs === 0) return false; // 自殺手

  state.history.push(cloneBoard(state.board));
  state.board = newBoard;
  state.turn++;
  
  if (record) {
    state.sgfMoves = state.sgfMoves.slice(0, state.sgfIndex);
    state.sgfMoves.push({ col, row, color });
    state.sgfIndex = state.sgfMoves.length;
    updateSlider();
  }
  return true;
}

// === 盤を初期化 ===
function initBoard(size) {
  // 既存の状態に意味のあるデータがある場合は履歴保存
  if (state.sgfMoves.length > 0 || state.handicapStones > 0) {
    operationHistory.save(`${state.boardSize}路盤（${state.sgfMoves.length}手）`);
  }
  
  state.boardSize = size;
  state.board = Array.from({ length: size }, () => Array(size).fill(0));
  state.history = [];
  state.turn = 0;
  state.sgfMoves = [];
  state.sgfIndex = 0;
  state.numberStartIndex = 0;
  state.eraseMode = false;
  state.komi = CONFIG.DEFAULT_KOMI;
  state.handicapStones = 0;
  state.handicapPositions = []; // 重要：置石情報をクリア
  msg('');
  if (movesEl) movesEl.textContent = '';
  render();
  updateBoardSize();
  updateInfo();
  updateSlider();
  
  const sgfTextEl = getDOMElement('sgf-text');
  if (sgfTextEl) sgfTextEl.value = '';
  
  // ボタン状態
  const sizeBtn = document.querySelector(`.size-btn[data-size="${size}"]`);
  const altBtn = getDOMElement('btn-alt');
  const eraseBtn = getDOMElement('btn-erase');
  
  setActive(sizeBtn, 'size-btn');
  setActive(altBtn, 'play-btn');
  if (eraseBtn) eraseBtn.classList.remove('active');
}

function startNumberMode(color) {
  state.numberMode = true;
  state.startColor = color;
  state.numberStartIndex = state.sgfMoves.length;
  state.sgfIndex = state.sgfMoves.length;
  state.turn = 0;
  state.history = [];
  render();
  updateInfo();
  updateSlider();
}

function setMoveIndex(idx) {
  idx = Math.max(0, Math.min(idx, state.sgfMoves.length));
  state.board = Array.from({ length: state.boardSize }, () => Array(state.boardSize).fill(0));
  state.history = [];
  state.turn = 0;
  
  // 置石がある場合は最初に配置（配列が存在し、かつ要素がある場合のみ）
  if (state.handicapPositions && state.handicapPositions.length > 0) {
    state.handicapPositions.forEach(([col, row]) => {
      if (inRange(col) && inRange(row)) {
        state.board[row][col] = 1; // 黒石
      }
    });
  }
  
  for (let i = 0; i < idx; i++) {
    const m = state.sgfMoves[i];
    tryMove(m.col, m.row, m.color, false);
  }
  
  state.history = [];
  state.sgfIndex = idx;
  
  if (state.numberMode) {
    state.turn = Math.max(0, idx - state.numberStartIndex);
  } else {
    state.turn = idx;
  }
  
  render(); 
  updateInfo(); 
  updateSlider();
}