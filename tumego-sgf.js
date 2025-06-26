// === SGF 読み込み・エクスポート ===
function parseSGF(text) {
  console.log('SGF解析開始:', text);
  const moves = [];
  
  // 盤サイズ
  const sizeMatch = text.match(/SZ\[(\d+)\]/i);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1], 10);
    console.log('盤サイズ:', size);
    initBoard(size);
  }
  
  // 初期化後に置石情報をリセット
  state.komi = 6.5; // デフォルト
  state.handicapStones = 0;
  state.handicapPositions = [];
  state.startColor = 1; // デフォルトは黒先
  
  // コミ
  const komiMatch = text.match(/KM\[([0-9.]+)\]/i);
  if (komiMatch) {
    state.komi = parseFloat(komiMatch[1]);
    console.log('コミ:', state.komi);
  }
  
  // ハンディキャップ（置石数）
  const handicapMatch = text.match(/HA\[(\d+)\]/i);
  if (handicapMatch) {
    state.handicapStones = parseInt(handicapMatch[1], 10);
    console.log('置石数:', state.handicapStones);
  }
  
  // 置石位置（AB: Add Black） - 複数の形式に対応
  const addBlackMatches = text.match(/AB(?:\[[a-z]{2}\])+/gi);
  if (addBlackMatches) {
    console.log('置石情報:', addBlackMatches);
    state.handicapPositions = [];
    addBlackMatches.forEach(match => {
      // [cc][gg][ee] のような形式から座標を抽出
      const coordinates = match.match(/\[([a-z]{2})\]/g);
      if (coordinates) {
        coordinates.forEach(coord => {
          const clean = coord.slice(1, -1); // [cc] → cc
          const col = clean.charCodeAt(0) - 97;
          const row = clean.charCodeAt(1) - 97;
          state.handicapPositions.push([col, row]);
          console.log('置石位置:', col, row);
        });
      }
    });
    // 置石がある場合は白番から開始
    if (state.handicapPositions.length > 0) {
      state.startColor = 2;
      console.log('白番開始に設定');
    }
  }
  
  // 着手
  const tokens = text.match(/;[BW]\[[a-z]{2}\]/ig) || [];
  console.log('着手トークン:', tokens);
  tokens.forEach(tok => {
    const color = tok[1] === 'B' ? 1 : 2;
    const x = tok.charCodeAt(3) - 97;
    const y = tok.charCodeAt(4) - 97;
    moves.push({ col: x, row: y, color });
  });
  
  console.log('解析完了 - 着手数:', moves.length, '置石数:', state.handicapPositions.length);
  return moves;
}

function exportSGF() {
  let sgf = `(;GM[1]FF[4]SZ[${state.boardSize}]`;
  
  // コミを追加
  sgf += `KM[${state.komi}]`;
  
  // 置石がある場合はハンディキャップとして記録
  if (state.handicapStones > 0) {
    sgf += `HA[${state.handicapStones}]`;
    
    // 置石位置を記録（AB: Add Black） - 各座標を個別に記録
    if (state.handicapPositions && state.handicapPositions.length > 0) {
      const handicapStones = state.handicapPositions.map(([col, row]) => {
        const x = String.fromCharCode(97 + col);
        const y = String.fromCharCode(97 + row);
        return `[${x}${y}]`;
      }).join('');
      sgf += `AB${handicapStones}`;
    }
  }
  
  // 着手を記録
  for (const m of state.sgfMoves) {
    const c = m.color === 1 ? 'B' : 'W';
    const x = String.fromCharCode(97 + m.col);
    const y = String.fromCharCode(97 + m.row);
    sgf += `;${c}[${x}${y}]`;
  }
  sgf += ')';
  console.log('SGF出力:', sgf);
  return sgf;
}

function loadSGF(file) {
  const reader = new FileReader();
  reader.onload = () => {
    console.log('ファイル読み込み完了');
    try {
      state.sgfMoves = parseSGF(reader.result);
      state.sgfIndex = 0;
      state.numberStartIndex = 0;
      setMoveIndex(0);
      // 置石がある場合は盤面を再描画
      if (state.handicapPositions && state.handicapPositions.length > 0) {
        render();
        updateInfo();
      }
      msg(`SGF 読み込み完了 (${state.sgfMoves.length}手)`);
      document.getElementById('sgf-text').value = reader.result;
    } catch (error) {
      console.error('SGF読み込みエラー:', error);
      msg('SGF読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
}

// SGFデータ圧縮機能
function compressSGFData(sgfData) {
  try {
    // 基本的な圧縮（重複や不要な空白を削除）
    let compressed = sgfData
      .replace(/\s+/g, ' ')           // 複数の空白を1つに
      .replace(/\s*;\s*/g, ';')       // セミコロン周りの空白削除
      .replace(/\s*\[\s*/g, '[')      // 括弧周りの空白削除
      .replace(/\s*\]\s*/g, ']')
      .replace(/\s*\(\s*/g, '(')      // 丸括弧周りの空白削除
      .replace(/\s*\)\s*/g, ')')
      .trim();

    console.log(`圧縮前: ${sgfData.length}文字 → 圧縮後: ${compressed.length}文字`);
    return compressed;

  } catch (error) {
    console.error('圧縮エラー:', error);
    return sgfData; // 圧縮に失敗したら元データを返す
  }
}

// URL自動読み込み機能
function loadSGFFromURL() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sgfParam = urlParams.get('sgf');
    
    if (sgfParam) {
      console.log('URL SGFパラメータ発見');
      try {
        const sgfData = atob(sgfParam);
        console.log('SGFデコード完了:', sgfData);
        state.sgfMoves = parseSGF(sgfData);
        state.sgfIndex = 0;
        state.numberStartIndex = 0;
        setMoveIndex(0);
        
        // 置石がある場合は盤面を再描画
        if (state.handicapPositions && state.handicapPositions.length > 0) {
          render();
          updateInfo();
        }
        
        const sgfTextEl = document.getElementById('sgf-text');
        if (sgfTextEl) sgfTextEl.value = sgfData;
        
        msg(`URL からSGF読み込み完了 (${state.sgfMoves.length}手)`);
        
        // URL パラメータをクリア（履歴を汚さない）
        if (window.history && window.history.replaceState) {
          const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({}, document.title, newURL);
        }
      } catch (error) {
        console.error('URL からのSGF読み込みエラー:', error);
        msg('URL からのSGF読み込みに失敗しました');
      }
    }
  } catch (error) {
    console.error('loadSGFFromURL エラー:', error);
  }
}

// グローバルスコープに関数を明示的に登録
window.parseSGF = parseSGF;
window.exportSGF = exportSGF;
window.loadSGF = loadSGF;
window.loadSGFFromURL = loadSGFFromURL;
window.compressSGFData = compressSGFData;