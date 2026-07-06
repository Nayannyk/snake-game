const socket = io();
const container = document.getElementById('gameContainer');

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

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

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
  onResize();
});

socket.on('waiting', (data) => {
  statusMsg.innerHTML = `<span class="pulse">${escapeHtml(data.message)}</span>`;
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
      p1info.innerHTML = `<span class="you-badge">YOU</span> ${escapeHtml(human.name)}: <span id="p1score">${human.score}</span>`;
      p2info.innerHTML = bot ? `<span class="bot-badge">BOT</span> ${escapeHtml(bot.name)}: <span id="p2score">${bot.score}</span>` : '';
    } else {
      const me = state.players.find(p => p.colorIdx === myColorIdx);
      const other = state.players.find(p => p.colorIdx !== myColorIdx);
      p1info.innerHTML = me ? `<span class="you-badge">YOU</span> ${escapeHtml(me.name)}: <span id="p1score">${me.score}</span>` : '';
      p2info.innerHTML = other ? (other.isBot ? `<span class="bot-badge">BOT</span> ${escapeHtml(other.name)}: <span id="p2score">${other.score}</span>` : `${escapeHtml(other.name)}: <span id="p2score">${other.score}</span>`) : '';
    }
  }
  updateScene(state);
});

socket.on('gameOver', (data) => {
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
  const showName = me ? escapeHtml(me.name) : 'You';
  const showOther = hasBot ? (other || { name: 'Bots', score: 0 }) : other;
  const showOtherName = showOther ? escapeHtml(showOther.name) : 'Bots';
  const showOtherScore = showOther ? showOther.score : 0;
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
          <div class="go-name">${showOtherName}</div>
          <div class="go-pts">${showOtherScore}</div>
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
          <div class="go-name">${other ? escapeHtml(other.name) : 'Opponent'}</div>
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
      <h2 style="color:#ffa502">${escapeHtml(name)} Disconnected</h2>
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

// ─── Three.js 3D Scene ─────────────────────────────────────────────────────

let scene, camera, renderer;
let foodGroup, snakeGroup, groundMesh;
let threeReady = false;
let threeError = null;
let camAngle = 0;

function initThree() {
  if (typeof THREE === 'undefined') {
    threeError = 'Three.js library failed to load';
    console.error(threeError);
    statusMsg.textContent = '3D engine not available - check browser WebGL support';
    return;
  }

  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || Math.max(200, window.innerHeight - 100);
    camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
    camera.position.set(0, 35, 30);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.9);
    dirLight.position.set(30, 50, 20);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    initGround();
    foodGroup = new THREE.Group();
    scene.add(foodGroup);
    snakeGroup = new THREE.Group();
    scene.add(snakeGroup);

    threeReady = true;
    console.log('Three.js 3D scene initialized');
    animate();
  } catch (err) {
    threeError = err.message || 'Unknown 3D error';
    console.error('Three.js init failed:', err);
    statusMsg.textContent = '3D error: ' + threeError;
  }
}

function initGround() {
  if (groundMesh) scene.remove(groundMesh);
  const gSize = 62;
  const geo = new THREE.PlaneGeometry(gSize, gSize * (world.h / world.w));
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d0d1a,
    roughness: 0.9,
    metalness: 0.1,
  });
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.05, 0);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const grid = new THREE.GridHelper(Math.max(world.w, world.h), Math.max(world.w, world.h), 0x1a1a3a, 0x111128);
  grid.position.set(0, 0.01, 0);
  scene.add(grid);

  const borderMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, emissive: 0x0a0a2a });
  [-1, 1].forEach(side => {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(gSize, 0.3, 0.3), borderMat);
    b1.position.set(0, 0.15, side * (world.h / 2 + 0.5));
    scene.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, gSize * (world.h / world.w)), borderMat);
    b2.position.set(side * (world.w / 2 + 0.5), 0.15, 0);
    scene.add(b2);
  });
}

const COLORS = [
  { head: 0x00e676, body: 0x00c853, emissive: 0x00e676 },
  { head: 0x448aff, body: 0x2979ff, emissive: 0x448aff },
  { head: 0xff6b6b, body: 0xee5a24, emissive: 0xff6b6b },
  { head: 0xfeca57, body: 0xf9ca24, emissive: 0xfeca57 },
  { head: 0xa29bfe, body: 0x6c5ce7, emissive: 0xa29bfe },
  { head: 0xfd79a8, body: 0xe84393, emissive: 0xfd79a8 },
  { head: 0x00cec9, body: 0x00b894, emissive: 0x00cec9 },
  { head: 0xff9ff3, body: 0xf368e0, emissive: 0xff9ff3 },
];

function updateScene(state) {
  if (!threeReady) return;
  gameState = state;

  while (foodGroup.children.length) {
    const c = foodGroup.children[0];
    c.geometry.dispose();
    c.material.dispose();
    foodGroup.remove(c);
  }
  while (snakeGroup.children.length) {
    const c = snakeGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    snakeGroup.remove(c);
  }

  if (!state) return;

  const offX = (world.w - 1) / 2;
  const offZ = (world.h - 1) / 2;

  const foodGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const foodMat = new THREE.MeshStandardMaterial({
    color: 0xff4757,
    emissive: 0xff6b6b,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.1,
  });
  for (const f of state.foods) {
    const mesh = new THREE.Mesh(foodGeo, foodMat);
    mesh.position.set(f.x - offX, 0.3, f.y - offZ);
    mesh.castShadow = true;
    foodGroup.add(mesh);
  }

  const cache = { geo: {}, mat: {} };

  for (const p of state.players) {
    if (!p.alive && p.body.length === 0) continue;
    const isMe = p.colorIdx === myColorIdx;
    const c = COLORS[p.colorIdx % COLORS.length] || COLORS[0];

    for (let i = p.body.length - 1; i >= 0; i--) {
      const seg = p.body[i];
      const isHead = i === 0;
      const t = i / Math.max(p.body.length - 1, 1);

      const sz = Math.max(0.4, isHead ? 0.8 : 0.7 * (1 - t * 0.25));
      const ht = isHead ? 0.5 : 0.3 * (1 - t * 0.3);
      const yPos = isHead ? 0.25 : 0.15 * (1 - t * 0.3);

      const gk = `box_${Math.round(sz*10)}_${Math.round(ht*10)}`;
      if (!cache.geo[gk]) {
        cache.geo[gk] = new THREE.BoxGeometry(sz, ht, sz);
      }
      const geo = cache.geo[gk];

      const mk = isHead ? `head_${c.head}` : `body_${c.body}`;
      if (!cache.mat[mk]) {
        cache.mat[mk] = new THREE.MeshStandardMaterial({
          color: isHead ? c.head : c.body,
          emissive: c.emissive,
          emissiveIntensity: isHead ? 0.15 : 0.05,
          roughness: isHead ? 0.3 : 0.5,
          metalness: isHead ? 0.3 : 0.1,
        });
      }
      const mat = cache.mat[mk];

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(seg.x - offX, yPos, seg.y - offZ);
      mesh.castShadow = true;
      snakeGroup.add(mesh);

      if (isHead) {
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);

        const dirMap = {
          right: [[1, 1, 0], [1, -1, 0], [1, 0, 0]],
          left:  [[-1, 1, 0], [-1, -1, 0], [-1, 0, 0]],
          up:    [[0, 1, 1], [0, -1, 1], [0, 0, 1]],
          down:  [[0, 1, -1], [0, -1, -1], [0, 0, -1]],
        };
        const d = dirMap[p.dir] || dirMap.right;
        const eOff = 0.32;

        for (let e = 0; e < 2; e++) {
          const eye = new THREE.Mesh(eyeGeo, eyeMat);
          eye.position.set(
            seg.x - offX + d[e][0] * eOff,
            yPos + d[e][1] * 0.18,
            seg.y - offZ + d[e][2] * eOff
          );
          snakeGroup.add(eye);

          const pupil = new THREE.Mesh(pupilGeo, pupilMat);
          pupil.position.set(
            seg.x - offX + d[e][0] * eOff + d[2][0] * 0.2,
            yPos + d[e][1] * 0.18 + d[2][1] * 0.1,
            seg.y - offZ + d[e][2] * eOff + d[2][2] * 0.2
          );
          snakeGroup.add(pupil);
        }
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (!threeReady) return;

  camAngle += 0.001;
  const cx = Math.sin(camAngle) * 5;
  const cz = Math.cos(camAngle) * 5;
  camera.position.x = cx;
  camera.position.z = 30 + cz;
  camera.lookAt(0, 0, 0);

  const pulse = Math.sin(Date.now() / 200) * 0.2 + 1;
  foodGroup.children.forEach(m => m.scale.setScalar(pulse));

  renderer.render(scene, camera);
}

function onResize() {
  if (!threeReady) return;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || Math.max(200, window.innerHeight - 100);
  if (w > 0 && h > 0) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
}

window.addEventListener('resize', onResize);

initThree();
