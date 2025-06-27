// === SVG ヘルパ ===
function svgtag(tag, attrs) { 
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag); 
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); 
  return el; 
}

// === 盤面描画 ===
function render() {
  const N = state.boardSize;
  const size = CONFIG.CELL_SIZE * (N - 1) + CONFIG.MARGIN * 2;
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.innerHTML = '';

  // 碁盤線
  for (let i = 0; i < N; i++) {
    const pos = CONFIG.MARGIN + i * CONFIG.CELL_SIZE;
    svg.appendChild(svgtag('line', { 
      x1: pos, y1: CONFIG.MARGIN, x2: pos, y2: size - CONFIG.MARGIN, 
      stroke: 'var(--line)', 'stroke-width': 2 
    }));
    svg.appendChild(svgtag('line', { 
      x1: CONFIG.MARGIN, y1: pos, x2: size - CONFIG.MARGIN, y2: pos, 
      stroke: 'var(--line)', 'stroke-width': 2 
    }));
  }

  // 星
  const starIdx = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };
  (starIdx[N] || []).forEach(ix => { 
    (starIdx[N] || []).forEach(iy => { 
      const cx = CONFIG.MARGIN + ix * CONFIG.CELL_SIZE; 
      const cy = CONFIG.MARGIN + iy * CONFIG.CELL_SIZE; 
      svg.appendChild(svgtag('circle', { cx, cy, r: CONFIG.STAR_RADIUS, class: 'star' })); 
    }); 
  });

  // 座標
  const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, N).split('');
  const fsize = CONFIG.CELL_SIZE * CONFIG.COORD_FONT_RATIO;
  for (let i = 0; i < N; i++) {
    const pos = CONFIG.MARGIN + i * CONFIG.CELL_SIZE;
    const col = letters[i];
    const row = N - i;
    svg.appendChild(svgtag('text', { 
      x: pos, y: CONFIG.MARGIN - 15, class: 'coord', 'font-size': fsize 
    })).textContent = col;
    svg.appendChild(svgtag('text', { 
      x: pos, y: size - CONFIG.MARGIN + 15, class: 'coord', 'font-size': fsize 
    })).textContent = col;
    svg.appendChild(svgtag('text', { 
      x: CONFIG.MARGIN - 20, y: pos, class: 'coord', 'font-size': fsize 
    })).textContent = row;
    svg.appendChild(svgtag('text', { 
      x: size - CONFIG.MARGIN + 20, y: pos, class: 'coord', 'font-size': fsize 
    })).textContent = row;
  }

  drawStones();
  if (state.numberMode) drawMoveNumbers();
}

function drawStones() {
  const N = state.boardSize;
  // Remove existing stones (if any remain)
  [...svg.querySelectorAll('.stone')].forEach(e => e.remove());
  
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const val = state.board[y][x];
      if (val === 0) continue;
      
      const cx = CONFIG.MARGIN + x * CONFIG.CELL_SIZE;
      const cy = CONFIG.MARGIN + y * CONFIG.CELL_SIZE;
      svg.appendChild(svgtag('circle', {
        cx, cy, r: CONFIG.STONE_RADIUS, class: 'stone', 
        fill: val === 1 ? 'var(--black)' : 'var(--white)', 
        stroke: '#000', 'stroke-width': val === 1 ? 0 : 2
      }));
    }
  }
}

function drawMoveNumbers() {
  const start = state.numberStartIndex || 0;
  for (let i = start; i < state.sgfIndex; i++) {
    const m = state.sgfMoves[i];
    const cx = CONFIG.MARGIN + m.col * CONFIG.CELL_SIZE;
    const cy = CONFIG.MARGIN + m.row * CONFIG.CELL_SIZE;
    let fill = '#000';
    if (state.board[m.row][m.col] === 1) fill = '#fff';
    
    svg.appendChild(svgtag('text', {
      x: cx, y: cy, 'font-size': CONFIG.CELL_SIZE * CONFIG.MOVE_NUM_FONT_RATIO, fill, class: 'move-num'
    })).textContent = i - start + 1;
  }
}

// === 情報更新 ===
function updateInfo() {
  if (!infoEl) {
    infoEl = getDOMElement('info');
  }
  if (!infoEl) return;
  
  const colorText = { 1: '黒', 2: '白' };
  let turnColor = getTurnColor();
  let modeText = '';
  
  if (state.numberMode) {
    modeText = '解答モード';
  } else {
    const modeMap = { black: '黒配置', white: '白配置', alt: '交互配置' };
    modeText = modeMap[state.mode];
  }
  
  // 手数情報を追加
  let moveInfo = '';
  if (state.sgfMoves.length > 0) {
    moveInfo = `　手数: ${state.sgfIndex}/${state.sgfMoves.length}`;
  } else {
    moveInfo = `　手数: 0`;
  }
  
  // コミ情報を追加
  const komiText = `　コミ: ${state.komi}目`;
  
  // 置石情報を追加
  let handicapText = '';
  if (state.handicapStones > 0) {
    handicapText = `　${state.handicapStones}子局`;
  }
  
  infoEl.textContent = `盤サイズ: ${state.boardSize}路　モード: ${modeText}${moveInfo}${komiText}${handicapText}　次の手番: ${colorText[turnColor]}`;
  
  if (!movesEl) {
    movesEl = getDOMElement('moves');
  }
  
  if (state.numberMode && state.sgfMoves.length && movesEl) {
    const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
    const circle = n => {
      if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
      if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
      if (n >= 36 && n <= 50) return String.fromCharCode(0x32b1 + n - 36);
      return n;
    };
    
    const start = state.numberStartIndex || 0;
    const seq = [];
    for (let i = start; i < state.sgfIndex; i++) {
      const m = state.sgfMoves[i];
      const c = letters[m.col];
      const r = state.boardSize - m.row;
      const mark = m.color === 1 ? '■' : '□';
      seq.push(`${mark}${circle(i - start + 1)} ${c}${r}`);
    }
    movesEl.textContent = seq.join(' ');
  } else if (movesEl) {
    movesEl.textContent = '';
  }
}

function updateSlider() {
  if (!sliderEl) {
    sliderEl = getDOMElement('move-slider');
  }
  if (sliderEl) {
    sliderEl.max = state.sgfMoves.length;
    sliderEl.value = state.sgfIndex;
  }
}

function updateBoardSize() {
  if (!boardWrapper) return;
  
  const sizePx = CONFIG.CELL_SIZE * state.boardSize;
  boardWrapper.style.width = sizePx + 'px';
  const max = document.body.classList.contains('horizontal') ? '95vh' : '95vmin';
  boardWrapper.style.maxWidth = max;
  const actual = boardWrapper.getBoundingClientRect().width;
  document.documentElement.style.setProperty('--board-width', actual + 'px');
}

// === 改善された画像エクスポート ===
async function copyBoardImage() {
  const vars = ['--line', '--star', '--board', '--coord', '--black', '--white'];
  const style = getComputedStyle(document.documentElement);
  let data = new XMLSerializer().serializeToString(svg);
  
  for (const v of vars) {
    const val = style.getPropertyValue(v).trim();
    const reg = new RegExp(`var\\(${v.replace(/[-]/g, '\\$&')}\\)`, 'g');
    data = data.replace(reg, val);
  }
  
  const bg = style.getPropertyValue('--board').trim();
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const attr = `style="background:${bg}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"`;
  data = data.replace('<svg', `<svg ${attr}`);

  const blob = new Blob([data], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let seq = '';
      
      if (state.numberMode && state.sgfMoves.length) {
        const letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, state.boardSize).split('');
        const circle = n => {
          if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
          if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
          if (n >= 36 && n <= 50) return String.fromCharCode(0x32b1 + n - 36);
          return n;
        };
        
        seq = state.sgfMoves.map((m, i) => {
          const c = letters[m.col];
          const r = state.boardSize - m.row;
          const mark = m.color === 1 ? '■' : '□';
          return `${mark}${circle(i + 1)} ${c}${r}`;
        }).join(' ');
      }
      
      canvas.width = img.width;
      const ctx = canvas.getContext('2d');
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      let lines = [];
      
      if (seq) {
        const maxW = canvas.width - 20;
        const words = seq.split(' ');
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) {
            lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
      }
      
      canvas.height = img.height + lines.length * 30;
      ctx.drawImage(img, 0, 0);
      
      if (lines.length) {
        ctx.fillStyle = '#000';
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], canvas.width / 2, img.height + 30 * (i + 0.8));
        }
      }
      
      URL.revokeObjectURL(url);
      
      canvas.toBlob(async b => {
        try {
          if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
              suggestedName: 'board.png',
              types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }]
            });
            const w = await handle.createWritable();
            await w.write(b); 
            await w.close();
          } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b); 
            a.download = 'board.png'; 
            a.click();
            URL.revokeObjectURL(a.href);
          }
          
          if (navigator.clipboard && navigator.clipboard.write) {
            const item = new ClipboardItem({ [b.type]: b });
            await navigator.clipboard.write([item]);
            msg('画像をコピーしました');
          }
          
          resolve();
        } catch (e) { 
          console.error('画像エクスポートエラー:', e);
          reject(e);
        }
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    
    img.src = url;
  });
}