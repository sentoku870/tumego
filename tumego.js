// === 定数 ===
const CELL   = 60; // 論理セル幅
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

const svg = document.getElementById('goban');
const boardWrapper = document.getElementById('board-wrapper');
const infoEl = document.getElementById('info');
const sliderEl = document.getElementById('move-slider');
const movesEl = document.getElementById('moves');
const msgEl  = document.getElementById('msg');
let tempSave = null;
let boardHasFocus = false;

// ボードをフォーカス可能にしてフォーカス状態を管理
boardWrapper.tabIndex = 0;
boardWrapper.addEventListener('pointerenter',()=>{boardHasFocus=true;});
boardWrapper.addEventListener('pointerleave',()=>{boardHasFocus=false;});
boardWrapper.addEventListener('pointerdown',()=>{
  boardHasFocus = true;
  boardWrapper.focus();
});
boardWrapper.addEventListener('blur',()=>{boardHasFocus=false;});

// ============ 初期化 ============
initBoard(9); // 初期は 9 路・石なし

// === 盤を初期化 ===
function initBoard(size){
  state.boardSize = size;
  state.board = Array.from({length:size},()=>Array(size).fill(0));
  state.history = [];
  state.turn = 0;
  state.sgfMoves = [];
  state.sgfIndex = 0;
  state.numberStartIndex = 0;
  state.eraseMode = false;
  msg('');
  movesEl.textContent='';
  render();
  updateInfo();
  updateSlider();
  document.getElementById('sgf-text').value='';
  // ボタン状態
  setActive(document.querySelector(`.size-btn[data-size="${size}"]`),'size-btn');
  setActive(document.getElementById('btn-alt'),'play-btn');
  document.getElementById('btn-erase').classList.remove('active');
}

// ============ ユーティリティ ============
function msg(text){msgEl.textContent=text;}
function cloneBoard(b){return b.map(r=>r.slice());}
function inRange(v){return v>=0 && v<state.boardSize;}
function neighbours([x,y]){
  return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([i,j])=>inRange(i)&&inRange(j));
}
function setActive(el,groupClass){
  document.querySelectorAll(`.${groupClass}`).forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
}

// 他のボタンを押したときに消去モードを解除
function disableEraseMode(){
  if(state.eraseMode){
    state.eraseMode = false;
    const el = document.getElementById('btn-erase');
    el.classList.remove('active');
    msg('');
  }
}

// === 一時保存・読込 ===
function saveTemp(){
  tempSave={
    boardSize:state.boardSize,
    board:cloneBoard(state.board),
    mode:state.mode,
    eraseMode:state.eraseMode,
    history:state.history.map(cloneBoard),
    turn:state.turn,
    sgfMoves:state.sgfMoves.slice(),
    numberMode:state.numberMode,
    startColor:state.startColor,
    sgfIndex:state.sgfIndex,
    numberStartIndex:state.numberStartIndex
  };
  msg('一時保存しました');
}

function loadTemp(){
  if(!tempSave){msg('一時保存がありません');return;}
  state.boardSize=tempSave.boardSize;
  state.board=cloneBoard(tempSave.board);
  state.mode=tempSave.mode;
  state.eraseMode=tempSave.eraseMode;
  state.history=tempSave.history.map(cloneBoard);
  state.turn=tempSave.turn;
  state.sgfMoves=tempSave.sgfMoves.slice();
  state.numberMode=tempSave.numberMode;
  state.startColor=tempSave.startColor;
  state.sgfIndex=tempSave.sgfIndex;
  state.numberStartIndex=tempSave.numberStartIndex||0;
  render();
  updateInfo();
  updateSlider();
  msg('一時読込しました');
}

function getTurnColor(){
  if(state.numberMode){
    return state.turn%2===0?state.startColor:3-state.startColor;
  }
  if(state.mode==='alt') return state.turn%2===0?state.startColor:3-state.startColor;
  if(state.mode==='black') return 1;
  return 2;
}

// === グループ探索と呼吸点 ===
function groupLib(x,y,board){
  const color=board[y][x];
  const visited=new Set();
  const stones=[];
  let libs=0;
  const stack=[[x,y]];
  while(stack.length){
    const [cx,cy]=stack.pop();
    const key=`${cx},${cy}`;
    if(visited.has(key))continue;
    visited.add(key);
    stones.push([cx,cy]);
    for(const [nx,ny] of neighbours([cx,cy])){
      if(board[ny][nx]===0) libs++;
      else if(board[ny][nx]===color) stack.push([nx,ny]);
    }
  }
  return {stones,libs};
}
function removeStones(stones,board){stones.forEach(([x,y])=>{board[y][x]=0;});}

// === 着手試行 ===
function tryMove(col,row,color,record=true){
  if(!inRange(col)||!inRange(row)) return false;
  if(state.board[row][col]!==0) return false;

  const newBoard=cloneBoard(state.board);
  newBoard[row][col]=color;
  const opp=3-color;
  // 隣接相手石捕獲
  for(const [nx,ny] of neighbours([col,row])){
    if(newBoard[ny][nx]===opp){
      const info=groupLib(nx,ny,newBoard);
      if(info.libs===0) removeStones(info.stones,newBoard);
    }
  }
  // 自分の呼吸点
  const self=groupLib(col,row,newBoard);
  if(self.libs===0) return false; // 自殺手

  state.history.push(cloneBoard(state.board));
  state.board=newBoard;
  state.turn++;
  if(record){
    state.sgfMoves=state.sgfMoves.slice(0,state.sgfIndex);
    state.sgfMoves.push({col,row,color});
    state.sgfIndex=state.sgfMoves.length;
    updateSlider();
  }
  return true;
}

// === SGF 読み込み ===
function parseSGF(text){
  const moves=[];
  const sizeMatch=text.match(/SZ\[(\d+)\]/i);
  if(sizeMatch) initBoard(parseInt(sizeMatch[1],10));
  const tokens=text.match(/;[BW]\[[a-z]{2}\]/ig)||[];
  tokens.forEach(tok=>{
    const color=tok[1]==='B'?1:2;
    const x=tok.charCodeAt(3)-97;
    const y=tok.charCodeAt(4)-97;
    moves.push({col:x,row:y,color});
  });
  return moves;
}

function exportSGF(){
  let sgf=`(;GM[1]FF[4]SZ[${state.boardSize}]`;
  for(const m of state.sgfMoves){
    const c=m.color===1?'B':'W';
    const x=String.fromCharCode(97+m.col);
    const y=String.fromCharCode(97+m.row);
    sgf+=`;${c}[${x}${y}]`;
  }
  sgf+=')';
  return sgf;
}

async function copyBoardImage(){
  const vars=['--line','--star','--board','--coord','--black','--white'];
  const style=getComputedStyle(document.documentElement);
  let data=new XMLSerializer().serializeToString(svg);
  for(const v of vars){
    const val=style.getPropertyValue(v).trim();
    const reg=new RegExp(`var\\(${v.replace(/[-]/g,'\\$&')}\\)`,'g');
    data=data.replace(reg,val);
  }
  const bg=style.getPropertyValue('--board').trim();
  const width=svg.clientWidth;
  const height=svg.clientHeight;
  const attr=`style="background:${bg}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"`;
  data=data.replace('<svg',`<svg ${attr}`);

  const blob=new Blob([data],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=async()=>{
      const canvas=document.createElement('canvas');
      let seq='';
      if(state.numberMode && state.sgfMoves.length){
        const letters='ABCDEFGHJKLMNOPQRSTUV'.slice(0,state.boardSize).split('');
        const circle=n=>{
          if(n>=1&&n<=20) return String.fromCharCode(0x2460+n-1);
          if(n>=21&&n<=35) return String.fromCharCode(0x3251+n-21);
          if(n>=36&&n<=50) return String.fromCharCode(0x32b1+n-36);
          return n;
        };
        seq=state.sgfMoves.map((m,i)=>{
          const c=letters[m.col];
          const r=state.boardSize-m.row;
          const mark=m.color===1?'■':'□';
          return `${mark}${circle(i+1)} ${c}${r}`;
        }).join(' ');
      }
      canvas.width=img.width;
      const ctx=canvas.getContext('2d');
      ctx.font='24px sans-serif';
      ctx.textAlign='center';
      let lines=[];
      if(seq){
        const maxW=canvas.width-20;
        const words=seq.split(' ');
        let line='';
        for(const w of words){
          const test=line?line+' '+w:w;
          if(ctx.measureText(test).width>maxW && line){
            lines.push(line);
            line=w;
          }else{
            line=test;
          }
        }
        if(line) lines.push(line);
      }
      canvas.height=img.height + lines.length*30;
      ctx.drawImage(img,0,0);
      if(lines.length){
        ctx.fillStyle='#000';
        for(let i=0;i<lines.length;i++){
          ctx.fillText(lines[i],canvas.width/2,img.height+30*(i+0.8));
        }
      }
    URL.revokeObjectURL(url);
    canvas.toBlob(async b=>{
      try{
        if(window.showSaveFilePicker){
          const handle=await window.showSaveFilePicker({
            suggestedName:'board.png',
            types:[{description:'PNG image',accept:{'image/png':['.png']}}]
          });
          const w=await handle.createWritable();
          await w.write(b);await w.close();
        }else{
          const a=document.createElement('a');
          a.href=URL.createObjectURL(b);a.download='board.png';a.click();
          URL.revokeObjectURL(a.href);
        }
        if(navigator.clipboard&&navigator.clipboard.write){
          const item=new ClipboardItem({[b.type]:b});
          navigator.clipboard.write([item]);
          msg('画像をコピーしました');
        }
      }catch(e){console.error(e);}
    });
  };
  img.src=url;
}

function setMoveIndex(idx){
  idx=Math.max(0,Math.min(idx,state.sgfMoves.length));
  state.board=Array.from({length:state.boardSize},()=>Array(state.boardSize).fill(0));
  state.history=[];
  state.turn=0;
  for(let i=0;i<idx;i++){
    const m=state.sgfMoves[i];
    tryMove(m.col,m.row,m.color,false);
  }
  state.history=[];
  state.sgfIndex=idx;
  if(state.numberMode){
    state.turn=Math.max(0,idx-state.numberStartIndex);
  }else{
    state.turn=idx;
  }
  render();updateInfo();updateSlider();
}

function loadSGF(file){
  const reader=new FileReader();
  reader.onload=()=>{
    state.sgfMoves=parseSGF(reader.result);
    state.sgfIndex=0;
    state.numberStartIndex=0;
    setMoveIndex(0);
    msg(`SGF 読み込み完了 (${state.sgfMoves.length}手)`);
    document.getElementById('sgf-text').value=reader.result;
  };
  reader.readAsText(file);
}

function startNumberMode(color){
  state.numberMode=true;
  state.startColor=color;
  state.numberStartIndex=state.sgfMoves.length;
  state.sgfIndex=state.sgfMoves.length;
  state.turn=0;
  state.history=[];
  render();
  updateInfo();
  updateSlider();
}

// === SVG ヘルパ ===
function svgtag(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}

// === 盤線 & 石描画 ===
function render(){
  const N=state.boardSize;
  const size=CELL*(N-1)+MARGIN*2;
  svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
  svg.innerHTML='';

  // 碁盤線
  for(let i=0;i<N;i++){
    const pos=MARGIN+i*CELL;
    svg.appendChild(svgtag('line',{x1:pos,y1:MARGIN,x2:pos,y2:size-MARGIN,stroke:'var(--line)','stroke-width':2}));
    svg.appendChild(svgtag('line',{x1:MARGIN,y1:pos,x2:size-MARGIN,y2:pos,stroke:'var(--line)','stroke-width':2}));
  }

  // 星
  const starIdx={9:[2,4,6],13:[3,6,9],19:[3,9,15]};
  (starIdx[N]||[]).forEach(ix=>{(starIdx[N]||[]).forEach(iy=>{const cx=MARGIN+ix*CELL;const cy=MARGIN+iy*CELL;svg.appendChild(svgtag('circle',{cx,cy,r:4,class:'star'}));});});

  // 座標
  const letters='ABCDEFGHJKLMNOPQRSTUV'.slice(0,N).split('');
  const fsize=CELL*0.28;
  for(let i=0;i<N;i++){
    const pos=MARGIN+i*CELL;
    const col=letters[i];
    const row=N-i;
    svg.appendChild(svgtag('text',{x:pos,y:MARGIN-15,class:'coord','font-size':fsize})).textContent=col;
    svg.appendChild(svgtag('text',{x:pos,y:size-MARGIN+15,class:'coord','font-size':fsize})).textContent=col;
    svg.appendChild(svgtag('text',{x:MARGIN-20,y:pos,class:'coord','font-size':fsize})).textContent=row;
    svg.appendChild(svgtag('text',{x:size-MARGIN+20,y:pos,class:'coord','font-size':fsize})).textContent=row;
  }

  drawStones();
  if(state.numberMode) drawMoveNumbers();
}

function drawStones(){
  const N=state.boardSize;
  const size=CELL*(N-1)+MARGIN*2;
  // Remove existing stones (if any remain)
  [...svg.querySelectorAll('.stone')].forEach(e=>e.remove());
  for(let y=0;y<N;y++){
    for(let x=0;x<N;x++){
      const val=state.board[y][x];
      if(val===0) continue;
      const cx=MARGIN+x*CELL;
      const cy=MARGIN+y*CELL;
      svg.appendChild(svgtag('circle',{
        cx,cy,r:26,class:'stone',fill:val===1?'var(--black)':'var(--white)',stroke:'#000','stroke-width':val===1?0:2
      }));
    }
  }
}

function drawMoveNumbers(){
  const placed=new Set();
  const start=state.numberStartIndex||0;
  for(let i=start;i<state.sgfIndex;i++){
    const m=state.sgfMoves[i];
    const key=`${m.col},${m.row}`;
    if(placed.has(key)) continue;
    placed.add(key);
    const cx=MARGIN+m.col*CELL;
    const cy=MARGIN+m.row*CELL;
    let fill='#000';
    if(state.board[m.row][m.col]===1) fill='#fff';
    svg.appendChild(svgtag('text',{
      x:cx,y:cy,'font-size':CELL*0.4,fill,class:'move-num'
    })).textContent=i-start+1;
  }
}

// === 情報更新 ===
function updateInfo(){
  const colorText={1:'黒',2:'白'};
  let turnColor=getTurnColor();
  let modeText='';
  if(state.numberMode){
    modeText='解答モード';
  }else{
    const modeMap={black:'黒配置',white:'白配置',alt:'交互配置'};
    modeText=modeMap[state.mode];
  }
  infoEl.textContent=`盤サイズ: ${state.boardSize}路　モード: ${modeText}　次の手番: ${colorText[turnColor]}`;
  if(state.numberMode && state.sgfMoves.length){
    const letters='ABCDEFGHJKLMNOPQRSTUV'.slice(0,state.boardSize).split('');
    const circle=n=>{
      if(n>=1&&n<=20) return String.fromCharCode(0x2460+n-1);
      if(n>=21&&n<=35) return String.fromCharCode(0x3251+n-21);
      if(n>=36&&n<=50) return String.fromCharCode(0x32b1+n-36);
      return n;
    };
    const start=state.numberStartIndex||0;
    const seq=state.sgfMoves.slice(start,state.sgfIndex).map((m,i)=>{
      const c=letters[m.col];
      const r=state.boardSize-m.row;
      const mark=m.color===1?'■':'□';
      return `${mark}${circle(i+1)} ${c}${r}`;
    }).join(' ');
    movesEl.textContent=seq;
  }else{
    movesEl.textContent='';
  }
}

function updateSlider(){
  sliderEl.max = state.sgfMoves.length;
  sliderEl.value = state.sgfIndex;
}

// === 盤クリック・ドラッグ ===
let dragging = false;
let dragColor = null;
let lastPos = null;
let eraseDragging = false;
let eraseMoved = false;
let eraseStartX = 0;
let eraseStartY = 0;
let ignoreEraseClick = false;

function placeAtEvent(evt){
  const {col,row}=pointToCoord(evt);
  if(!inRange(col)||!inRange(row)) return;
  if(state.eraseMode){ // 消去モード
    if(state.board[row][col]!==0){
      state.history.push(cloneBoard(state.board));
      state.board[row][col]=0;
      render();updateInfo();
    }
    return;
  }
  const color = dragColor || getTurnColor();
  const ok = tryMove(col,row,color);
  if(ok){render();updateInfo();updateSlider();}
}

svg.addEventListener('pointerdown',e=>{
  boardHasFocus = true;
  boardWrapper.focus();
  if(e.button===2) e.preventDefault();
  if(state.mode==='alt' && e.button===0){
    dragColor = null; // follow alternating turn
  }else{
    const leftColor  = state.mode==='white' ? 2 : 1;
    const rightColor = state.mode==='white' ? 1 : 2;
    dragColor = e.button===0 ? leftColor : e.button===2 ? rightColor : null;
  }
  dragging = true;
  lastPos = null;
  svg.setPointerCapture(e.pointerId);
  placeAtEvent(e);
});

svg.addEventListener('pointermove',e=>{
  if(!dragging) return;
  const {col,row}=pointToCoord(e);
  if(lastPos && lastPos.col===col && lastPos.row===row) return;
  lastPos = {col,row};
  placeAtEvent(e);
});

function endDrag(e){
  if(!dragging) return;
  dragging=false;dragColor=null;lastPos=null;
  svg.releasePointerCapture(e.pointerId);
}
svg.addEventListener('pointerup',endDrag);
svg.addEventListener('pointercancel',endDrag);
svg.addEventListener('contextmenu',e=>e.preventDefault());

function pointToCoord(evt){
  const pt=svg.createSVGPoint();
  pt.x=evt.clientX; pt.y=evt.clientY;
  const svgP=pt.matrixTransform(svg.getScreenCTM().inverse());
  const col=Math.round((svgP.x-MARGIN)/CELL);
  const row=Math.round((svgP.y-MARGIN)/CELL);
  return {col,row};
}

function eraseAtEvent(evt){
  const {col,row}=pointToCoord(evt);
  if(!inRange(col)||!inRange(row)) return;
  if(state.board[row][col]!==0){
    state.history.push(cloneBoard(state.board));
    state.board[row][col]=0;
    render();updateInfo();
  }
}

function eraseDragMove(e){
  if(!eraseDragging) return;
  if(Math.abs(e.clientX-eraseStartX)>3 || Math.abs(e.clientY-eraseStartY)>3){
    eraseMoved = true;
  }
  eraseAtEvent(e);
}

function eraseDragEnd(){
  document.removeEventListener('pointermove',eraseDragMove);
  eraseDragging=false;
  if(eraseMoved) ignoreEraseClick=true;
}

// === ボタンイベント ===
// 盤サイズ
 document.querySelectorAll('.size-btn').forEach(btn=>btn.addEventListener('click',()=>{
   disableEraseMode();
   const size=parseInt(btn.dataset.size,10);
   initBoard(size);
 }));
// 全消去
 document.getElementById('btn-clear').addEventListener('click',()=>{
   disableEraseMode();
   initBoard(state.boardSize);
 });
// 戻る
 document.getElementById('btn-undo').addEventListener('click',()=>{
   disableEraseMode();
   if(state.history.length){
     state.board=state.history.pop();
     state.turn=Math.max(0,state.turn-1);
     if(state.sgfIndex>0){
       state.sgfIndex--; 
       state.sgfMoves=state.sgfMoves.slice(0,state.sgfIndex);
     }
    render();updateInfo();updateSlider();
  }
});
// 消去モード
const btnErase=document.getElementById('btn-erase');
btnErase.addEventListener('pointerdown',e=>{
  eraseStartX=e.clientX;eraseStartY=e.clientY;eraseMoved=false;eraseDragging=true;
  eraseAtEvent(e);
  document.addEventListener('pointermove',eraseDragMove);
  document.addEventListener('pointerup',eraseDragEnd,{once:true});
  document.addEventListener('pointercancel',eraseDragEnd,{once:true});
});
btnErase.addEventListener('click',()=>{
  if(ignoreEraseClick){ignoreEraseClick=false;return;}
  state.eraseMode=!state.eraseMode;
  if(state.eraseMode){btnErase.classList.add('active');msg('消去モード');}
  else {btnErase.classList.remove('active');msg('');}
});
function toggleNumberMode(color){
  if(state.numberMode && state.startColor===color){
    state.numberMode=false;
    state.turn=state.sgfIndex;
    render();
    updateInfo();
  }else{
    startNumberMode(color);
  }
}
document.getElementById('btn-play-black').addEventListener('click',()=>toggleNumberMode(1));
document.getElementById('btn-play-white').addEventListener('click',()=>toggleNumberMode(2));
document.getElementById('btn-temp-save').addEventListener('click',saveTemp);
document.getElementById('btn-temp-load').addEventListener('click',loadTemp);
// 配置モード
function setMode(mode,btn){
  disableEraseMode();
  state.mode=mode;
  if(state.numberMode){
    state.numberMode=false;
    state.turn=state.sgfIndex;
  }
  setActive(btn,'play-btn');
  render();
  updateInfo();
}
 document.getElementById('btn-black' ).addEventListener('click',e=>setMode('black',e.currentTarget));
 document.getElementById('btn-white' ).addEventListener('click',e=>setMode('white',e.currentTarget));
 document.getElementById('btn-alt'   ).addEventListener('click',e=>{
   state.startColor = state.startColor===1 ? 2 : 1;
   setMode('alt',  e.currentTarget);
 });

// SGF 読み込み
  document.getElementById('sgf-input').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(file) loadSGF(file);
  });
  sliderEl.addEventListener('input',e=>{setMoveIndex(parseInt(e.target.value,10));});
  document.getElementById('btn-load-sgf').addEventListener('click',()=>{
    const text=document.getElementById('sgf-text').value;
    if(text.trim()){state.sgfMoves=parseSGF(text);state.sgfIndex=0;setMoveIndex(0);msg('SGF 読み込み完了');}
  });
  document.getElementById('btn-copy-sgf').addEventListener('click',()=>{
    const text=exportSGF();
    document.getElementById('sgf-text').value=text;
    navigator.clipboard.writeText(text).then(()=>msg('SGF をコピーしました'));
  });

// ============ リサイズ対応 ============
window.addEventListener('orientationchange',()=>setTimeout(render,200));
window.addEventListener('resize',()=>setTimeout(render,200));

// ===== キーボードショートカット =====
const keyBindings = {
  q: () => document.querySelector('.size-btn[data-size="9"]').click(),
  w: () => document.querySelector('.size-btn[data-size="13"]').click(),
  e: () => document.querySelector('.size-btn[data-size="19"]').click(),
  a: () => document.getElementById('btn-clear').click(),
  s: () => document.getElementById('btn-undo').click(),
  d: () => document.getElementById('btn-erase').click(),
  z: () => document.getElementById('btn-black').click(),
  x: () => document.getElementById('btn-alt').click(),
  c: () => document.getElementById('btn-white').click()
};

document.addEventListener('keydown',e=>{
  if(!boardHasFocus) return;
  const key = e.key.toLowerCase();
  if(keyBindings[key]){
    e.preventDefault();
    keyBindings[key]();
  }
});
