// === SGF 読み込み・エクスポート ===
function parseSGF(text) {
  const moves = [];
  const sizeMatch = text.match(/SZ\[(\d+)\]/i);
  if (sizeMatch) initBoard(parseInt(sizeMatch[1], 10));
  
  const tokens = text.match(/;[BW]\[[a-z]{2}\]/ig) || [];
  tokens.forEach(tok => {
    const color = tok[1] === 'B' ? 1 : 2;
    const x = tok.charCodeAt(3) - 97;
    const y = tok.charCodeAt(4) - 97;
    moves.push({ col: x, row: y, color });
  });
  return moves;
}

function exportSGF() {
  let sgf = `(;GM[1]FF[4]SZ[${state.boardSize}]`;
  for (const m of state.sgfMoves) {
    const c = m.color === 1 ? 'B' : 'W';
    const x = String.fromCharCode(97 + m.col);
    const y = String.fromCharCode(97 + m.row);
    sgf += `;${c}[${x}${y}]`;
  }
  sgf += ')';
  return sgf;
}

function loadSGF(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.sgfMoves = parseSGF(reader.result);
    state.sgfIndex = 0;
    state.numberStartIndex = 0;
    setMoveIndex(0);
    msg(`SGF 読み込み完了 (${state.sgfMoves.length}手)`);
    document.getElementById('sgf-text').value = reader.result;
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
  const urlParams = new URLSearchParams(window.location.search);
  const sgfParam = urlParams.get('sgf');
  
  if (sgfParam) {
    try {
      const sgfData = atob(sgfParam);
      state.sgfMoves = parseSGF(sgfData);
      state.sgfIndex = 0;
      state.numberStartIndex = 0;
      setMoveIndex(0);
      
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
}