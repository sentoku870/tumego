// === イベント処理とユーザー操作 ===

// タッチイベント用の変数
let touchStartY = 0;

// ボードをフォーカス可能にしてフォーカス状態を管理
function initBoardEvents() {
  boardWrapper.tabIndex = 0;
  boardWrapper.addEventListener('pointerenter', () => { boardHasFocus = true; });
  boardWrapper.addEventListener('pointerleave', () => { boardHasFocus = false; });
  boardWrapper.addEventListener('pointerdown', () => {
    boardHasFocus = true;
    boardWrapper.focus();
  });
  boardWrapper.addEventListener('blur', () => { boardHasFocus = false; });
  
  // 改善されたタッチイベント処理
  boardWrapper.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  
  boardWrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      const touchY = e.touches[0].clientY;
      const deltaY = Math.abs(touchY - touchStartY);
      // 縦スクロールの動きが小さい場合のみ preventDefault
      if (deltaY < 10) {
        e.preventDefault();
      }
    }
  }, { passive: false });
}

// === 盤クリック・ドラッグ ===
let dragging = false;
let dragColor = null;
let lastPos = null;

function placeAtEvent(evt) {
  const { col, row } = pointToCoord(evt);
  if (!inRange(col) || !inRange(row)) return;
  
  if (state.eraseMode) { // 消去モード
    if (state.board[row][col] !== 0) {
      state.history.push(cloneBoard(state.board));
      state.board[row][col] = 0;
      render(); 
      updateInfo();
    }
    return;
  }
  
  const color = dragColor || getTurnColor();
  const ok = tryMove(col, row, color);
  if (ok) { 
    render(); 
    updateInfo(); 
    updateSlider(); 
  }
}

function initSVGEvents() {
  svg.addEventListener('pointerdown', e => {
    boardHasFocus = true;
    boardWrapper.focus();
    if (e.button === 2) e.preventDefault();
    
    if (state.eraseMode) {
      dragColor = null;
    } else if (state.mode === 'alt') {
      // 交互配置の場合は左クリックのみ、右クリック無効
      if (e.button === 0) {
        dragColor = null; // 交互配置に従う
      } else {
        return; // 右クリックは無効
      }
    } else {
      // 黒配置・白配置の場合は左右クリック対応
      const leftColor = state.mode === 'white' ? 2 : 1;
      const rightColor = state.mode === 'white' ? 1 : 2;
      dragColor = e.button === 0 ? leftColor : e.button === 2 ? rightColor : null;
    }
    
    dragging = true;
    lastPos = null;
    svg.setPointerCapture(e.pointerId);
    placeAtEvent(e);
  });

  svg.addEventListener('pointermove', e => {
    if (!dragging) {
      if (state.eraseMode && e.buttons) {
        dragging = true;
        lastPos = null;
      } else {
        return;
      }
    }
    
    // 交互配置モードではドラッグ無効
    if (state.mode === 'alt' && !state.eraseMode) {
      return;
    }
    
    const { col, row } = pointToCoord(e);
    if (lastPos && lastPos.col === col && lastPos.row === row) return;
    lastPos = { col, row };
    placeAtEvent(e);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    dragColor = null; 
    lastPos = null;
    svg.releasePointerCapture(e.pointerId);
  }
  
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('contextmenu', e => e.preventDefault());
}

// 改善されたエラーハンドリング付き座標変換
function pointToCoord(evt) {
  try {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; 
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { col: -1, row: -1 };
    const svgP = pt.matrixTransform(ctm.inverse());
    const col = Math.round((svgP.x - MARGIN) / CELL);
    const row = Math.round((svgP.y - MARGIN) / CELL);
    return { col, row };
  } catch (e) {
    console.error('座標変換エラー:', e);
    return { col: -1, row: -1 };
  }
}

// === ボタンイベント ===
function initButtonEvents() {
  // 盤サイズ
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      disableEraseMode();
      const size = parseInt(btn.dataset.size, 10);
      // 現在と違うサイズの場合のみ履歴保存
      if (size !== state.boardSize) {
        initBoard(size);
      }
    });
  });

  // 全消去
  const clearBtn = getDOMElement('btn-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // 履歴保存（現在の状態が意味がある場合のみ）
      if (state.sgfMoves.length > 0 || state.handicapStones > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
        operationHistory.save(`全消去前（${state.sgfMoves.length}手）`);
      }
      disableEraseMode();
      initBoard(state.boardSize);
    });
  }

  // 戻る
  const undoBtn = getDOMElement('btn-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (state.numberMode) {
        // ナンバーモードの場合は、SGFシーケンス内での移動
        state.sgfIndex = Math.max(state.numberStartIndex, state.sgfIndex - 1);
        setMoveIndex(state.sgfIndex); // SGFの履歴から盤面を再構築
      } else if (state.turn > 0) {
        // 標準プレイモードの場合は、手動で置いた石を元に戻す
        state.turn = Math.max(0, state.turn - 1);
        state.board = cloneBoard(state.history[state.turn]);
        // ★問題の行を削除しました。これにより、手動UndoがSGFデータに影響を与えなくなります。
      }
      updateInfo();
      render();
    });
  }

  // 履歴ボタン
  const historyBtn = getDOMElement('btn-history');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      showHistoryDialog();
    });
  }

  // 消去モード
  const eraseBtn = getDOMElement('btn-erase');
  if (eraseBtn) {
    eraseBtn.addEventListener('click', () => {
      state.eraseMode = !state.eraseMode;
      if (state.eraseMode) { 
        eraseBtn.classList.add('active'); 
        msg('消去モード'); 
      } else { 
        eraseBtn.classList.remove('active'); 
        msg(''); 
      }
    });
  }

  // 1手戻る・進むボタン
  const prevBtn = getDOMElement('btn-prev-move');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.sgfIndex > 0) {
        setMoveIndex(state.sgfIndex - 1);
      }
    });
  }

  const nextBtn = getDOMElement('btn-next-move');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.sgfIndex < state.sgfMoves.length) {
        setMoveIndex(state.sgfIndex + 1);
      }
    });
  }

  // 解答ボタン（トグル機能付き）
  const answerBtn = getDOMElement('btn-answer');
  if (answerBtn) {
    answerBtn.addEventListener('click', () => {
      // 解答モード開始前に履歴保存
      if (state.sgfMoves.length > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
        const modeText = state.answerMode === 'black' ? '白先' : '黒先';
        operationHistory.save(`${modeText}解答開始前（${state.sgfMoves.length}手）`);
      }
      
      // 現在の解答モードを切り替え
      if (state.answerMode === 'black') {
        state.answerMode = 'white';
        answerBtn.textContent = '⚪ 白先';
        answerBtn.classList.add('white-mode');
        startNumberMode(2); // 白先
      } else {
        state.answerMode = 'black';
        answerBtn.textContent = '🔥 黒先';
        answerBtn.classList.remove('white-mode');
        startNumberMode(1); // 黒先
      }
    });
  }

  // 配置モード
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

  const blackBtn = getDOMElement('btn-black');
  if (blackBtn) blackBtn.addEventListener('click', e => setMode('black', e.currentTarget));
  
  const whiteBtn = getDOMElement('btn-white');
  if (whiteBtn) whiteBtn.addEventListener('click', e => setMode('white', e.currentTarget));
  
  const altBtn = getDOMElement('btn-alt');
  if (altBtn) {
    altBtn.addEventListener('click', e => {
      state.startColor = state.startColor === 1 ? 2 : 1;
      setMode('alt', e.currentTarget);
    });
  }

  // ファイルメニュー処理
  const fileBtn = getDOMElement('btn-file');
  const fileDropdown = getDOMElement('file-dropdown');
  
  if (fileBtn && fileDropdown) {
    fileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileDropdown.classList.toggle('show');
    });

    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', () => {
      fileDropdown.classList.remove('show');
    });

    fileDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // ファイル操作ボタン
  initFileOperations();

  // 置石機能
  const handicapBtn = getDOMElement('btn-handicap');
  if (handicapBtn) {
    handicapBtn.addEventListener('click', () => {
      showHandicapSelection();
    });
  }

  // レイアウト切り替え
  const layoutBtn = getDOMElement('btn-layout');
  if (layoutBtn) {
    let isHorizontal = false;
    layoutBtn.addEventListener('click', () => {
      isHorizontal = !isHorizontal;
      document.body.classList.toggle('horizontal', isHorizontal);
      layoutBtn.textContent = isHorizontal ? '縦レイアウト' : '横レイアウト';
      updateBoardSize();
    });
  }

  // スライダー
  if (sliderEl) {
    sliderEl.addEventListener('input', e => { 
      setMoveIndex(parseInt(e.target.value, 10)); 
    });
  }
}

// ファイル操作の初期化
function initFileOperations() {
  const sgfInput = getDOMElement('sgf-input');
  const fileDropdown = getDOMElement('file-dropdown');
  
  const fileSelectBtn = getDOMElement('btn-file-select');
  if (fileSelectBtn && sgfInput) {
    fileSelectBtn.addEventListener('click', () => {
      sgfInput.click();
      fileDropdown.classList.remove('show');
    });
  }

  if (sgfInput) {
    sgfInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) loadSGF(file);
    });
  }

  const fileLoadBtn = getDOMElement('btn-file-load');
  if (fileLoadBtn) {
    fileLoadBtn.addEventListener('click', async () => {
      fileDropdown.classList.remove('show');
      try {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          state.sgfMoves = parseSGF(text);
          state.sgfIndex = 0;
          setMoveIndex(0);
          if (state.handicapPositions.length > 0) {
            render();
            updateInfo();
          }
          const sgfTextarea = getDOMElement('sgf-text');
          if (sgfTextarea) sgfTextarea.value = text;
          msg('クリップボードからSGFを読み込みました');
        } else {
          msg('クリップボードにSGFがありません');
        }
      } catch (err) {
        console.error('クリップボードの読み込みに失敗しました: ', err);
        const sgfTextarea = getDOMElement('sgf-text');
        if (sgfTextarea && sgfTextarea.value.trim()) {
          const textFromTextarea = sgfTextarea.value.trim();
          state.sgfMoves = parseSGF(textFromTextarea);
          state.sgfIndex = 0;
          setMoveIndex(0);
          if (state.handicapPositions.length > 0) {
            render();
            updateInfo();
          }
          msg('テキストエリアからSGFを読み込みました');
        } else {
          msg('クリップボードの読み込みに失敗しました。テキストエリアにSGFがありません。');
        }
      }
    });
  }

  const fileCopyBtn = getDOMElement('btn-file-copy');
  if (fileCopyBtn) {
    fileCopyBtn.addEventListener('click', () => {
      fileDropdown.classList.remove('show');
      const text = exportSGF();
      const sgfTextarea = getDOMElement('sgf-text');
      if (sgfTextarea) sgfTextarea.value = text;
      navigator.clipboard.writeText(text).then(() => {
        msg('SGF をコピーしました');
      }).catch(err => {
        console.error('クリップボードコピー失敗:', err);
        msg('SGF をテキストエリアに表示しました');
      });
    });
  }

  const fileSaveBtn = getDOMElement('btn-file-save');
  if (fileSaveBtn) {
    fileSaveBtn.addEventListener('click', async () => {
      fileDropdown.classList.remove('show');
      const sgfData = exportSGF();
      const now = new Date();
      const timestamp = now.getFullYear() + 
                       String(now.getMonth() + 1).padStart(2, '0') + 
                       String(now.getDate()).padStart(2, '0') + '_' +
                       String(now.getHours()).padStart(2, '0') + 
                       String(now.getMinutes()).padStart(2, '0');
      const filename = `${timestamp}.sgf`;

      try {
        if (window.showSaveFilePicker) {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'SGF files',
              accept: { 'application/x-go-sgf': ['.sgf'] }
            }]
          });
          const writable = await fileHandle.createWritable();
          await writable.write(sgfData);
          await writable.close();
          msg('SGFファイルを保存しました');
        } else {
          const blob = new Blob([sgfData], { type: 'application/x-go-sgf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          msg('SGFファイルをダウンロードしました');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('SGF保存エラー:', error);
          msg('SGFファイルの保存に失敗しました');
        }
      }
    });
  }

  const fileQRBtn = getDOMElement('btn-file-qr');
  if (fileQRBtn) {
    fileQRBtn.addEventListener('click', () => {
      fileDropdown.classList.remove('show');
      createSGFQRCode();
    });
  }
}

// === キーボードショートカット ===
const keyBindings = {
  q: () => { const btn = document.querySelector('.size-btn[data-size="9"]'); if (btn) btn.click(); },
  w: () => { const btn = document.querySelector('.size-btn[data-size="13"]'); if (btn) btn.click(); },
  e: () => { const btn = document.querySelector('.size-btn[data-size="19"]'); if (btn) btn.click(); },
  a: () => { const btn = getDOMElement('btn-clear'); if (btn) btn.click(); },
  s: () => { const btn = getDOMElement('btn-undo'); if (btn) btn.click(); },
  d: () => { const btn = getDOMElement('btn-erase'); if (btn) btn.click(); },
  h: () => { const btn = getDOMElement('btn-history'); if (btn) btn.click(); }, // 履歴ショートカット
  z: () => { const btn = getDOMElement('btn-black'); if (btn) btn.click(); },
  x: () => { const btn = getDOMElement('btn-alt'); if (btn) btn.click(); },
  c: () => { const btn = getDOMElement('btn-white'); if (btn) btn.click(); },
  ArrowLeft: () => { const btn = getDOMElement('btn-prev-move'); if (btn) btn.click(); },
  ArrowRight: () => { const btn = getDOMElement('btn-next-move'); if (btn) btn.click(); }
};

function initKeyboardEvents() {
  document.addEventListener('keydown', e => {
    if (!boardHasFocus) return;
    const key = e.key;
    if (keyBindings[key]) {
      e.preventDefault();
      keyBindings[key]();
    }
  });
}

// === 置石設定機能 ===
function showHandicapSelection() {
  // 既存のポップアップがあれば削除
  const existing = document.getElementById('handicap-popup');
  if (existing) {
    existing.remove();
  }

  const popup = document.createElement('div');
  popup.id = 'handicap-popup';
  popup.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;" onclick="closeHandicapSelection()">
      <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:500px;" onclick="event.stopPropagation()">
        <h2 style="margin-bottom:20px; color:#333;">🔥 置石設定</h2>
        <p style="margin-bottom:25px; color:#666;">置石の数を選択してください</p>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px 0;">
          <button onclick="setHandicap(0)" style="padding:15px; background:#4CAF50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">先（置石なし）</button>
          <button onclick="setHandicap(2)" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">2子</button>
          <button onclick="setHandicap(3)" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">3子</button>
          <button onclick="setHandicap(4)" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">4子</button>
          <button onclick="setHandicap(5)" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">5子</button>
          <button onclick="setHandicap(6)" style="padding:15px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">6子</button>
          <button onclick="setHandicap(7)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">7子</button>
          <button onclick="setHandicap(8)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">8子</button>
          <button onclick="setHandicap(9)" style="padding:15px; background:#FF9800; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;">9子</button>
        </div>
        <button onclick="closeHandicapSelection()" style="margin-top:15px; padding:10px 20px; background:#666; color:white; border:none; border-radius:5px;">❌ キャンセル</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
}

function setHandicap(stones) {
  closeHandicapSelection();
  
  // 現在の状態に意味があるデータがある場合は履歴保存
  if (state.sgfMoves.length > 0 || state.handicapStones > 0 || state.board.some(row => row.some(cell => cell !== 0))) {
    operationHistory.save(`置石変更前（${state.handicapStones}子→${stones}子）`);
  }
  
  if (stones === 0) {
    initBoard(state.boardSize);
    state.handicapStones = 0;
    state.komi = CONFIG.DEFAULT_KOMI;
    msg('先（置石なし）に設定しました');
    return;
  }

  // 盤をクリア
  initBoard(state.boardSize);
  
  // 置石位置を設定
  const handicapPositions = getHandicapPositions(state.boardSize, stones);
  
  // 置石を配置
  handicapPositions.forEach(([col, row]) => {
    if (inRange(col) && inRange(row)) {
      state.board[row][col] = 1; // 黒石
    }
  });
  
  // 置石情報をSGF用に記録
  state.handicapStones = stones;
  state.handicapPositions = handicapPositions;
  state.komi = 0; // 置石の場合はコミ0
  
  // 白番から開始
  state.startColor = 2;
  state.turn = 0;
  
  render();
  updateInfo();
  msg(`${stones}子局に設定しました（白番から開始、コミ0目）`);
}

function getHandicapPositions(boardSize, stones) {
  const positions = [];
  
  if (boardSize === 19) {
    const starPoints = [
      [3, 3], [15, 3], [3, 15], [15, 15], // 四隅
      [9, 9], // 天元
      [3, 9], [15, 9], // 左右辺
      [9, 3], [9, 15]  // 上下辺
    ];
    
    if (stones === 2) positions.push(starPoints[0], starPoints[2]);
    else if (stones === 3) positions.push(starPoints[0], starPoints[2], starPoints[1]);
    else if (stones === 4) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3]);
    else if (stones === 5) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[4]);
    else if (stones === 6) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6]);
    else if (stones === 7) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[4]);
    else if (stones === 8) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8]);
    else if (stones === 9) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8], starPoints[4]);
  } else if (boardSize === 13) {
    const starPoints = [
      [3, 3], [9, 3], [3, 9], [9, 9], // 四隅
      [6, 6], // 天元
      [3, 6], [9, 6], // 左右辺
      [6, 3], [6, 9]  // 上下辺
    ];
    
    if (stones === 2) positions.push(starPoints[0], starPoints[2]);
    else if (stones === 3) positions.push(starPoints[0], starPoints[2], starPoints[1]);
    else if (stones === 4) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3]);
    else if (stones === 5) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[4]);
    else if (stones === 6) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6]);
    else if (stones === 7) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[4]);
    else if (stones === 8) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8]);
    else if (stones === 9) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8], starPoints[4]);
  } else if (boardSize === 9) {
    const starPoints = [
      [2, 2], [6, 2], [2, 6], [6, 6], // 四隅
      [4, 4], // 天元
      [2, 4], [6, 4], // 左右辺
      [4, 2], [4, 6]  // 上下辺
    ];
    
    if (stones === 2) positions.push(starPoints[0], starPoints[2]);
    else if (stones === 3) positions.push(starPoints[0], starPoints[2], starPoints[1]);
    else if (stones === 4) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3]);
    else if (stones === 5) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[4]);
    else if (stones === 6) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6]);
    else if (stones === 7) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[4]);
    else if (stones === 8) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8]);
    else if (stones === 9) positions.push(starPoints[0], starPoints[1], starPoints[2], starPoints[3], starPoints[5], starPoints[6], starPoints[7], starPoints[8], starPoints[4]);
  }
  
  return positions;
}

// メモリリーク対策を含む改善された閉じる関数
function closeHandicapSelection() {
  const popup = document.getElementById('handicap-popup');
  if (popup) {
    // すべてのイベントリスナーを削除（クローンで置き換え）
    const newPopup = popup.cloneNode(true);
    popup.parentNode.replaceChild(newPopup, popup);
    newPopup.remove();
  }
}

// === 履歴ダイアログ ===
function showHistoryDialog() {
  const historyList = operationHistory.getList();
  
  if (historyList.length === 0) {
    alert('📜 操作履歴がありません。\n\n重要な操作（盤サイズ変更、置石設定、全消去、SGF読み込みなど）を行うと、履歴が保存されます。');
    return;
  }

  // 既存のポップアップがあれば削除
  const existing = document.getElementById('history-popup');
  if (existing) {
    existing.remove();
  }

  const popup = document.createElement('div');
  popup.id = 'history-popup';
  
  const historyItems = historyList.map((item, index) => `
    <button onclick="restoreHistory(${item.index})" 
            style="display:block; width:100%; margin:5px 0; padding:12px; 
                   background:#fff; border:1px solid #ddd; border-radius:6px; 
                   cursor:pointer; text-align:left; font-size:14px; 
                   transition:background 0.2s;" 
            onmouseover="this.style.background='#f0f0f0'" 
            onmouseout="this.style.background='#fff'">
      <div style="font-weight:600; color:#333;">${item.description}</div>
      <div style="font-size:12px; color:#666; margin-top:4px;">${item.timeString}</div>
    </button>
  `).join('');

  popup.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; 
                background:rgba(0,0,0,0.8); z-index:9999; 
                display:flex; justify-content:center; align-items:center;" 
         onclick="closeHistoryDialog()">
      <div style="background:white; padding:25px; border-radius:15px; 
                  text-align:center; max-width:500px; max-height:80vh; 
                  overflow-y:auto;" 
           onclick="event.stopPropagation()">
        <h2 style="margin-bottom:20px; color:#333;">📜 操作履歴</h2>
        <p style="margin-bottom:20px; color:#666; font-size:14px;">
          復元したい操作を選択してください（最新${historyList.length}件）
        </p>
        <div style="margin:20px 0;">
          ${historyItems}
        </div>
        <div style="margin-top:20px; padding-top:15px; border-top:1px solid #eee;">
          <button onclick="clearHistory()" 
                  style="margin:5px; padding:8px 16px; background:#ff6b35; color:white; 
                         border:none; border-radius:6px; cursor:pointer; font-size:13px;">
            🗑️ 履歴クリア
          </button>
          <button onclick="closeHistoryDialog()" 
                  style="margin:5px; padding:8px 16px; background:#666; color:white; 
                         border:none; border-radius:6px; cursor:pointer; font-size:13px;">
            ❌ 閉じる
          </button>
        </div>
        <div style="font-size:11px; color:#999; margin-top:10px;">
          ⚠️ 履歴復元後は、復元時点以降の操作が失われます
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
}

function restoreHistory(index) {
  if (confirm('この操作履歴に復元しますか？\n\n⚠️ 復元すると、現在の状態が失われます。')) {
    const success = operationHistory.restore(index);
    if (success) {
      closeHistoryDialog();
    } else {
      alert('履歴の復元に失敗しました。');
    }
  }
}

function clearHistory() {
  if (confirm('操作履歴をすべて削除しますか？\n\n⚠️ この操作は取り消せません。')) {
    operationHistory.clear();
    closeHistoryDialog();
    msg('操作履歴をクリアしました');
  }
}

function closeHistoryDialog() {
  const popup = document.getElementById('history-popup');
  if (popup) {
    popup.remove();
  }
}

// グローバルスコープに関数を登録（ポップアップ内で使用するため）
window.restoreHistory = restoreHistory;
window.clearHistory = clearHistory;
window.closeHistoryDialog = closeHistoryDialog;

// === リサイズ対応 ===
function initResizeEvents() {
  window.addEventListener('orientationchange', () => {
    updateBoardSize();
    setTimeout(render, 200);
  });
  
  window.addEventListener('resize', () => {
    updateBoardSize();
    setTimeout(render, 200);
  });
}