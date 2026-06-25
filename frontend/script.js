const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const nameInput = document.getElementById('nameInput');
const playBtn = document.getElementById('playBtn');
const soloBtn = document.getElementById('soloBtn');
const leaveBtn = document.getElementById('leaveBtn');
const statusMsg = document.getElementById('statusMsg');
const p1score = document.getElementById('p1score');
const p2score = document.getElementById('p2score');
const p1info = document.getElementById('p1info');
const p2info = document.getElementById('p2info');
const modeLabel = document.getElementById('modeLabel');
const notification = document.getElementById('notification');

let selectedMode = 'medium';
let playerId = null;
let myColorIdx = 0;
let world = { w: 60, h: 40 };
let gameState = null;
let animFrame = null;
let myName = '';
let opponentName = '';

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

playBtn.addEventListener('click', connect);
soloBtn.addEventListener('click', connectSolo);
leaveBtn.addEventListener('click', () => { socket.emit('leaveGame'); leaveGame(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });

function connect() {
  myName = nameInput.value.trim() || 'Player';
  if (!myName) { nameInput.focus(); return; }
  playBtn.disabled = true;
  soloBtn.disabled = true;
  playBtn.textContent = 'Searching...';
  statusMsg.innerHTML = '<span class="pulse">Searching for opponent...</span>';
  socket.emit('joinQueue', { name: myName, mode: selectedMode });
}

function connectSolo() {
  myName = nameInput.value.trim() || 'Player';
  if (!myName) { nameInput.focus(); return; }
  playBtn.disabled = true;
  soloBtn.disabled = true;
  statusMsg.textContent = 'Starting solo game...';
  socket.emit('joinSolo', { name: myName, mode: selectedMode });
}

function leave() {
  socket.emit('leaveGame');
  leaveGame();
}

function leaveGame() {
  lobby.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  notification.classList.add('hidden');
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  playBtn.disabled = false;
  playBtn.textContent = 'Find Match';
  soloBtn.disabled = false;
  statusMsg.textContent = '';
  if (!socket.connected) socket.connect();
}

function resetUI() {
  playBtn.disabled = false;
  soloBtn.disabled = false;
  playBtn.textContent = 'Find Match';
  statusMsg.textContent = '';
}



socket.on('joined', (data) => {
  playerId = data.playerId;
  myColorIdx = data.colorIdx;
  world = data.world;
  lobby.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  statusMsg.textContent = '';
});

socket.on('waiting', (data) => {
  statusMsg.innerHTML = `<span class="pulse">${data.message}</span>`;
});

socket.on('gameStarting', ({ countdown }) => {
  notification.classList.remove('hidden');
  notification.innerHTML = `
    <div class="countdown-overlay">
      <div class="countdown-num">${countdown}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:1rem">Get Ready!</div>
    </div>
  `;
});

socket.on('gameState', (state) => {
  notification.classList.add('hidden');
  gameState = state;
  modeLabel.textContent = state.mode;
  if (state.players[0]) {
    const bot = state.players.find(p => p.isBot);
    const human = state.players.find(p => !p.isBot);
    if (human && human.colorIdx === myColorIdx) {
      p1info.innerHTML = `<span class="you-badge">YOU</span> ${human.name}: <span id="p1score">${human.score}</span>`;
      p2info.innerHTML = bot ? `<span class="bot-badge">BOT</span> ${bot.name}: <span id="p2score">${bot.score}</span>` : '';
    } else {
      const me = state.players.find(p => p.colorIdx === myColorIdx);
      const other = state.players.find(p => p.colorIdx !== myColorIdx);
      p1info.innerHTML = me ? `<span class="you-badge">YOU</span> ${me.name}: <span id="p1score">${me.score}</span>` : '';
      p2info.innerHTML = other ? (other.isBot ? `<span class="bot-badge">BOT</span> ${other.name}: <span id="p2score">${other.score}</span>` : `${other.name}: <span id="p2score">${other.score}</span>`) : '';
    }
  }
  if (!animFrame) animFrame = requestAnimationFrame(render);
});

socket.on('gameOver', (data) => {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  const me = data.players.find(p => !p.isBot && p.colorIdx === myColorIdx) || data.players.find(p => p.colorIdx === myColorIdx);
  const other = data.players.find(p => p !== me);
  const hasBot = data.players.some(p => p.isBot);

  let msg = '', sub = '';
  if (!me) {
    msg = 'Game Over';
    sub = 'Thanks for playing!';
  } else if (hasBot) {
    if (data.humanWon) { msg = 'You Won!'; sub = 'All bots eliminated!'; }
    else if (!me.alive) { msg = 'Game Over'; sub = me.killedBy ? `${me.killedBy} got you!` : 'You were eliminated!'; }
    else { msg = 'Game Over'; sub = `Score: ${me.score}`; }
  } else if (other) {
    if (me.score > other.score) { msg = 'You Win!'; sub = 'Best score wins!'; }
    else if (me.score < other.score) { msg = 'You Lost'; sub = `${other.name} wins!`; }
    else { msg = 'Draw!'; sub = 'Even match!'; }
  }

  notification.classList.remove('hidden');
  const meWon = msg === 'You Won!' || msg === 'You Win!';
  const showScore = me ? me.score : 0;
  const showName = me ? me.name : 'You';
  const showOther = hasBot ? (other || { name: 'Bots', score: 0 }) : other;
  notification.innerHTML = !me ? `
    <div class="gameover-box">
      <h2 style="color:#ff4757">${msg}</h2>
      <p style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin-bottom:1rem">${sub}</p>
      <button class="btn primary" onclick="leaveGame()">Play Again</button>
    </div>
  ` : hasBot ? `
    <div class="gameover-box">
      <h2 style="color:${meWon ? '#00e676' : '#ff4757'}">${msg}</h2>
      <div class="go-scores">
        <div class="go-player ${meWon ? 'win' : ''}">
          <div class="go-name">${showName}</div>
          <div class="go-pts">${showScore}</div>
        </div>
        <div class="go-vs">VS</div>
        <div class="go-player ${!meWon && showOther ? 'win' : ''}">
          <div class="go-name">${showOther ? showOther.name : 'Bots'}</div>
          <div class="go-pts">${showOther ? showOther.score : 0}</div>
        </div>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin-bottom:1rem">${sub}</p>
      <button class="btn primary" onclick="leaveGame()">Play Again</button>
    </div>
  ` : `
    <div class="gameover-box">
      <h2 style="color:${meWon ? '#00e676' : '#ff4757'}">${msg}</h2>
      <div class="go-scores">
        <div class="go-player ${!other || (me && me.score > other.score) ? 'win' : ''}">
          <div class="go-name">${showName}</div>
          <div class="go-pts">${showScore}</div>
        </div>
        <div class="go-vs">VS</div>
        <div class="go-player ${other && other.score > (me ? me.score : 0) ? 'win' : ''}">
          <div class="go-name">${other ? other.name : 'Opponent'}</div>
          <div class="go-pts">${other ? other.score : 0}</div>
        </div>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin-bottom:1rem">${sub}</p>
      <button class="btn primary" onclick="leaveGame()">Play Again</button>
    </div>
  `;
});

socket.on('playerDisconnected', ({ name }) => {
  notification.classList.remove('hidden');
  notification.innerHTML = `
    <div class="gameover-box">
      <h2 style="color:#ffa502">${name} Disconnected</h2>
      <p style="color:rgba(255,255,255,0.5);margin:0.5rem 0 1rem">You win by default!</p>
      <button class="btn primary" onclick="leaveGame()">Play Again</button>
    </div>
  `;
});

document.addEventListener('keydown', (e) => {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
  };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); socket.emit('setDirection', { dir }); }
});

// Mobile joystick
(() => {
  const jZone = document.getElementById('joystickZone');
  const jStick = document.getElementById('jStick');
  let active = false, touchId = null;
  const maxDist = 35;
  let centerX = 0, centerY = 0;

  jZone.addEventListener('touchstart', (e) => {
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    active = true;
    const rect = jZone.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    moveStick(t.clientX, t.clientY);
  }, { passive: true });

  jZone.addEventListener('touchmove', (e) => {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) { moveStick(t.clientX, t.clientY); break; }
    }
  }, { passive: true });

  jZone.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) { touchId = null; active = false; jStick.style.transform = 'translate(-50%,-50%)'; break; }
    }
  }, { passive: true });

  jZone.addEventListener('touchcancel', () => {
    active = false; touchId = null; jStick.style.transform = 'translate(-50%,-50%)';
  }, { passive: true });

  function moveStick(cx, cy) {
    let dx = cx - centerX;
    let dy = cy - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const clamped = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    jStick.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`;
    if (dist > 15) {
      if (Math.abs(dx) > Math.abs(dy)) {
        socket.emit('setDirection', { dir: dx > 0 ? 'right' : 'left' });
      } else {
        socket.emit('setDirection', { dir: dy > 0 ? 'down' : 'up' });
      }
    }
  }
})();

// Render
let eatAnim = [];

function render() {
  if (!gameState) { animFrame = requestAnimationFrame(render); return; }

  const cw = canvas.width = window.innerWidth;
  const ch = canvas.height = Math.max(200, window.innerHeight - 100);
  ctx.clearRect(0, 0, cw, ch);
  const cell = Math.floor(Math.min(cw / world.w, ch / world.h));
  const ox = Math.floor((cw - world.w * cell) / 2);
  const oy = Math.floor((ch - world.h * cell) / 2);

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, cw, ch);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.w; x++) {
    ctx.beginPath(); ctx.moveTo(ox + x*cell, oy); ctx.lineTo(ox + x*cell, oy + world.h*cell); ctx.stroke();
  }
  for (let y = 0; y <= world.h; y++) {
    ctx.beginPath(); ctx.moveTo(ox, oy + y*cell); ctx.lineTo(ox + world.w*cell, oy + y*cell); ctx.stroke();
  }

  // Food with pulse
  const pulse = Math.sin(Date.now() / 200) * 0.15 + 1;
  for (const f of gameState.foods) {
    const fx = ox + f.x * cell + cell/2;
    const fy = oy + f.y * cell + cell/2;
    const r = (cell/2 - 2) * pulse;
    const grad = ctx.createRadialGradient(fx-r*0.3, fy-r*0.3, 0, fx, fy, r);
    grad.addColorStop(0, '#ff6b6b');
    grad.addColorStop(0.7, '#ee5a24');
    grad.addColorStop(1, '#c0392b');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Snakes
  for (const p of gameState.players) {
    if (!p.alive && p.body.length === 0) continue;
    const isMe = p.colorIdx === myColorIdx;
    const colors = [
      { head: '#00e676', body: '#00c853', dark: '#009624', glow: 'rgba(0,230,118,' },
      { head: '#448aff', body: '#2979ff', dark: '#0055cc', glow: 'rgba(68,138,255,' },
      { head: '#ff6b6b', body: '#ee5a24', dark: '#c0392b', glow: 'rgba(255,107,107,' },
      { head: '#feca57', body: '#f9ca24', dark: '#f0932b', glow: 'rgba(254,202,87,' },
      { head: '#a29bfe', body: '#6c5ce7', dark: '#5f27cd', glow: 'rgba(162,155,254,' },
      { head: '#fd79a8', body: '#e84393', dark: '#c44569', glow: 'rgba(253,121,168,' },
      { head: '#00cec9', body: '#00b894', dark: '#00a381', glow: 'rgba(0,206,201,' },
      { head: '#ff9ff3', body: '#f368e0', dark: '#be2edd', glow: 'rgba(255,159,243,' },
    ];
    const c = colors[p.colorIdx % colors.length] || colors[0];

    // Glow around alive snakes
    if (p.alive && isMe) {
      ctx.shadowColor = c.head;
      ctx.shadowBlur = 8;
    }

    for (let i = p.body.length - 1; i >= 0; i--) {
      const seg = p.body[i];
      const sx = ox + seg.x * cell;
      const sy = oy + seg.y * cell;
      const t = i / Math.max(p.body.length - 1, 1);
      const pad = Math.max(1, t * cell * 0.25);

      if (i === 0) {
        ctx.shadowColor = isMe && p.alive ? c.head : 'transparent';
        ctx.shadowBlur = isMe && p.alive ? 10 : 0;
        ctx.fillStyle = c.head;
        roundRect(ctx, sx + pad/2, sy + pad/2, cell - pad, cell - pad, cell*0.3);

        // Eyes
        ctx.shadowBlur = 0;
        const ed = cell * 0.18;
        ctx.fillStyle = '#fff';
        const dirMap = {
          right: [{ x: 0.6, y: 0.25 }, { x: 0.6, y: 0.65 }],
          left:  [{ x: 0.4, y: 0.25 }, { x: 0.4, y: 0.65 }],
          up:    [{ x: 0.25, y: 0.4 }, { x: 0.65, y: 0.4 }],
          down:  [{ x: 0.25, y: 0.6 }, { x: 0.65, y: 0.6 }],
        };
        const eyePositions = dirMap[p.dir] || dirMap.right;
        for (const ep of eyePositions) {
          ctx.beginPath();
          ctx.arc(sx + ep.x * cell, sy + ep.y * cell, ed, 0, Math.PI*2);
          ctx.fill();
        }
        // Pupils
        ctx.fillStyle = '#111';
        const pd = ed * 0.5;
        const pupDirs = { right: [0.3, 0], left: [-0.3, 0], up: [0, -0.3], down: [0, 0.3] };
        const pOff = pupDirs[p.dir] || pupDirs.right;
        for (const ep of eyePositions) {
          ctx.beginPath();
          ctx.arc(sx + ep.x * cell + pOff[0] * ed * 0.5, sy + ep.y * cell + pOff[1] * ed * 0.5, pd, 0, Math.PI*2);
          ctx.fill();
        }
      } else {
        const alpha = 1 - t * 0.4;
        ctx.globalAlpha = Math.max(0.3, alpha);
        ctx.fillStyle = c.body;
        ctx.shadowBlur = 0;
        const bp = Math.max(2, t * cell * 0.3);
        roundRect(ctx, sx + bp/2, sy + bp/2, cell - bp, cell - bp, cell*0.15);
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.shadowBlur = 0;

  animFrame = requestAnimationFrame(render);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

window.addEventListener('resize', () => { if (gameState) render(); });
