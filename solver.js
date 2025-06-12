import { Solver } from 'tsumego.js';

const boardEl = document.getElementById('board');
const sgfInput = document.getElementById('sgfText');
const resultEl = document.getElementById('result');
let boardSize = 9;
let board = [];
let targetGroup = [];
let selecting = false;

initFromSGF('');

function initFromSGF(text){
  const info = parseSGF(text);
  boardSize = info.size;
  board = info.board;
  renderBoard();
}

function renderBoard(){
  boardEl.innerHTML='';
  boardEl.style.setProperty('grid-template-columns',`repeat(${boardSize},32px)`);
  boardEl.style.setProperty('grid-template-rows',`repeat(${boardSize},32px)`);
  for(let y=0;y<boardSize;y++){
    for(let x=0;x<boardSize;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      if(board[y][x]===1) cell.classList.add('black');
      else if(board[y][x]===2) cell.classList.add('white');
      cell.dataset.x=x;
      cell.dataset.y=y;
      cell.addEventListener('click',()=>onCellClick(x,y));
      boardEl.appendChild(cell);
    }
  }
}

function onCellClick(x,y){
  if(!selecting) return;
  const group=getChainGroup(x,y,board);
  clearTargetMarks();
  targetGroup=group;
  markTarget(group);
  insertMarksIntoSGF(group);
  const outer=getOuterWallCoords(group,board);
  if(outer.length && confirm('外壁が不足しています。自動で追加しますか？')){
    insertOuterWalls(outer);
    outer.forEach(([ox,oy])=>{board[oy][ox]=1;});
    renderBoard();
  }
}

function clearTargetMarks(){
  targetGroup.forEach(([x,y])=>{
    const cell=cellAt(x,y);
    if(cell) cell.classList.remove('target');
  });
  targetGroup=[];
}

function markTarget(group){
  group.forEach(([x,y])=>{
    const cell=cellAt(x,y);
    if(cell) cell.classList.add('target');
  });
}

function cellAt(x,y){
  return boardEl.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function getChainGroup(x,y,b){
  const color=b[y][x];
  if(!color) return [];
  const visited=new Set();
  const stack=[[x,y]];
  const group=[];
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(stack.length){
    const [cx,cy]=stack.pop();
    const key=`${cx},${cy}`;
    if(visited.has(key)) continue;
    visited.add(key);
    group.push([cx,cy]);
    for(const [dx,dy] of dirs){
      const nx=cx+dx, ny=cy+dy;
      if(nx>=0 && nx<boardSize && ny>=0 && ny<boardSize && b[ny][nx]===color){
        stack.push([nx,ny]);
      }
    }
  }
  return group;
}

function getOuterWallCoords(group,b){
  const n=b.length;
  const coords=[];
  for(let i=0;i<n;i++){
    if(b[0][i]!==1) coords.push([i,0]);
    if(b[n-1][i]!==1) coords.push([i,n-1]);
    if(b[i][0]!==1) coords.push([0,i]);
    if(b[i][n-1]!==1) coords.push([n-1,i]);
  }
  return coords;
}

function coordToSgf([x,y]){
  const letters='abcdefghijklmnopqrstuvwxyz';
  return `[${letters[x]}${letters[y]}]`;
}

function parseSGF(text){
  let size=9;
  const letters='abcdefghijklmnopqrstuvwxyz';
  const sz=text.match(/SZ\[(\d+)\]/);
  if(sz) size=parseInt(sz[1],10);
  const b=Array.from({length:size},()=>Array(size).fill(0));
  const ab=text.match(/AB((?:\[[a-z]{2}\])+)/i);
  if(ab){
    const coords=ab[1].match(/\[[a-z]{2}\]/g)||[];
    coords.forEach(c=>{const x=letters.indexOf(c[1]);const y=letters.indexOf(c[2]);if(x>=0&&y>=0)b[y][x]=1;});
  }
  const aw=text.match(/AW((?:\[[a-z]{2}\])+)/i);
  if(aw){
    const coords=aw[1].match(/\[[a-z]{2}\]/g)||[];
    coords.forEach(c=>{const x=letters.indexOf(c[1]);const y=letters.indexOf(c[2]);if(x>=0&&y>=0)b[y][x]=2;});
  }
  const moves=text.match(/;([BW])\[([a-z]{2})\]/g)||[];
  moves.forEach(tok=>{
    const color=tok[1]==='B'?1:2;
    const x=letters.indexOf(tok[3]);
    const y=letters.indexOf(tok[4]);
    if(x>=0&&y>=0)b[y][x]=color;
  });
  return {board:b,size};
}

function insertMarksIntoSGF(group){
  const sgf=sgfInput.value||'';
  const root=/^\((;[^;]*)(;.*)$/s.exec(sgf);
  if(!root) return;
  let props=root[1].replace(/MA(?:\[[^\]]*\])*/g,'');
  props+= 'MA'+group.map(coordToSgf).join('');
  sgfInput.value='('+props+root[2];
}

function insertOuterWalls(walls){
  const sgf=sgfInput.value||'';
  const root=/^\((;[^;]*)(;.*)$/s.exec(sgf);
  if(!root) return;
  let props=root[1];
  let coords=[];
  const m=props.match(/AB((?:\[[a-z]{2}\])+)/);
  if(m){
    coords=m[1].match(/\[[a-z]{2}\]/g)||[];
    props=props.replace(/AB((?:\[[a-z]{2}\])+)/,'');
  }
  const set=new Set(coords);
  walls.forEach(c=>set.add(coordToSgf(c)));
  props+= 'AB'+Array.from(set).join('');
  sgfInput.value='('+props+root[2];
}

sgfInput.addEventListener('input',()=>{
  initFromSGF(sgfInput.value);
});

document.getElementById('btn-target').addEventListener('click',()=>{
  selecting=!selecting;
  if(selecting){
    resultEl.textContent='グループをクリックしてください';
  }else{
    resultEl.textContent='';
    clearTargetMarks();
  }
});

document.getElementById('btn-solve').addEventListener('click',async ()=>{
  const solver=new Solver();
  try{
    const res=await solver.solve(sgfInput.value);
    if(!res.moves){resultEl.textContent='解析失敗';return;}
    const letters='ABCDEFGHJKLMNOPQRST';
    resultEl.textContent=res.moves.map((m,i)=>{
      const c=m.c>0?'黒':'白';
      const col=letters[m.x];
      const row=boardSize-m.y;
      return `${i+1}. ${c} ${col}${row}`;
    }).join('\n');
  }catch(e){
    resultEl.textContent=e.message;
  }
});
