// === 定数 ===
const CELL = 60; // 論理セル幅
const MARGIN = 30; // 盤外余白

// === 盤面状態 ===
const state = {
  boardSize: 9,
  board: [],        // 0:空 1:黒 2:白
  mode: 'alt',      // 'black' | 'white' | 'alt'
  eraseMode: false,
  history: [],
  turn: 0,          // 着手番号
  sgfMoves: [],     // SGF から読み込んだ着手
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0
};

// DOM要素の参照（初期化時に設定）
let svg, boardWrapper, infoEl, sliderEl, movesEl, msgEl;
let tempSave = null;
let boardHasFocus = false;

// DOM要素を初期化する関数
function initDOMElements() {
  svg = document.getElementById('goban');
  boardWrapper = document.getElementById('board-wrapper');
  infoEl = document.getElementById('info');
  sliderEl = document.getElementById('move-slider');
  movesEl = document.getElementById('moves');
  msgEl = document.getElementById('msg');
  
  // 要素が存在しない場合はエラーを投げる
  if (!svg || !boardWrapper || !infoEl || !sliderEl || !movesEl || !msgEl) {
    throw new Error('必要なDOM要素が見つかりません');
  }
}

// ============ ユーティリティ ============
function msg(text) { 
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
    const el = document.getElementById('btn-erase');
    el.classList.remove('active');
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
  state.boardSize = size;
  state.board = Array.from({ length: size }, () => Array(size).fill(0));
  state.history = [];
  state.turn = 0;
  state.sgfMoves = [];
  state.sgfIndex = 0;
  state.numberStartIndex = 0;
  state.eraseMode = false;
  msg('');
  if (movesEl) movesEl.textContent = '';
  render();
  updateBoardSize();
  updateInfo();
  updateSlider();
  
  const sgfTextEl = document.getElementById('sgf-text');
  if (sgfTextEl) sgfTextEl.value = '';
  
  // ボタン状態
  const sizeBtn = document.querySelector(`.size-btn[data-size="${size}"]`);
  const altBtn = document.getElementById('btn-alt');
  const eraseBtn = document.getElementById('btn-erase');
  
  setActive(sizeBtn, 'size-btn');
  setActive(altBtn, 'play-btn');
  if (eraseBtn) eraseBtn.classList.remove('active');
}

// === 一時保存・読込 ===
function saveTemp() {
  tempSave = {
    boardSize: state.boardSize,
    board: cloneBoard(state.board),
    mode: state.mode,
    eraseMode: state.eraseMode,
    history: state.history.map(cloneBoard),
    turn: state.turn,
    sgfMoves: state.sgfMoves.slice(),
    numberMode: state.numberMode,
    startColor: state.startColor,
    sgfIndex: state.sgfIndex,
    numberStartIndex: state.numberStartIndex
  };
  msg('一時保存しました');
}

function loadTemp() {
  if (!tempSave) { msg('一時保存がありません'); return; }
  state.boardSize = tempSave.boardSize;
  state.board = cloneBoard(tempSave.board);
  state.mode = tempSave.mode;
  state.eraseMode = tempSave.eraseMode;
  state.history = tempSave.history.map(cloneBoard);
  state.turn = tempSave.turn;
  state.sgfMoves = tempSave.sgfMoves.slice();
  state.numberMode = tempSave.numberMode;
  state.startColor = tempSave.startColor;
  state.sgfIndex = tempSave.sgfIndex;
  state.numberStartIndex = tempSave.numberStartIndex || 0;
  render();
  updateInfo();
  updateSlider();
  msg('一時読込しました');
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