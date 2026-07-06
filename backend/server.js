const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, 'snake.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  mode TEXT DEFAULT 'medium',
  killed_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)`);

app.get('/api/scores', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const mode = req.query.mode;
  let rows;
  if (mode) {
    rows = db.prepare('SELECT * FROM scores WHERE mode = ? ORDER BY score DESC LIMIT ?').all(mode, limit);
  } else {
    rows = db.prepare('SELECT * FROM scores ORDER BY score DESC LIMIT ?').all(limit);
  }
  res.json(rows);
});

app.post('/api/scores', (req, res) => {
  const { player_name, score, mode, killed_by } = req.body;
  if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid player_name' });
  }
  if (!Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  const stmt = db.prepare('INSERT INTO scores (player_name, score, mode, killed_by) VALUES (?, ?, ?, ?)');
  const result = stmt.run(player_name.trim(), score, mode || 'medium', killed_by || null);
  const inserted = db.prepare('SELECT * FROM scores WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(inserted);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Game Engine ────────────────────────────────────────────────────────────

const MODES = {
  easy:   { tickMs: 160, foodCount: 12, initialSpeed: 3, botSpeed: 220 },
  medium: { tickMs: 110, foodCount: 10, initialSpeed: 4, botSpeed: 180 },
  hard:   { tickMs: 65,  foodCount: 8,  initialSpeed: 5, botSpeed: 130 },
};

const WORLD_W = 60;
const WORLD_H = 40;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const DIR_KEYS = ['up', 'down', 'left', 'right'];

const BOT_NAMES = ['Cobra', 'Viper', 'Python', 'Mamba', 'Boa', 'Rattler', 'Anaconda', 'Krait', 'Fang', 'Scale', 'Fury'];
const MIN_BOTS = 3;

let rooms = {};
let roomIdCounter = 0;
let botIdCounter = 0;

function randPos() {
  return { x: Math.floor(Math.random() * WORLD_W), y: Math.floor(Math.random() * WORLD_H) };
}

function getSpawnPos(snakes) {
  const occupied = new Set();
  for (const s of snakes) {
    for (const seg of s.body) occupied.add(`${seg.x},${seg.y}`);
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = randPos();
    if (!occupied.has(`${p.x},${p.y}`)) return p;
  }
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++)
      if (!occupied.has(`${x},${y}`)) return { x, y };
  return { x: 5, y: 5 };
}

function createPlayer(id, name, colorIdx, snakes, isBot) {
  const pos = getSpawnPos(snakes);
  return {
    id, name, colorIdx, isBot: !!isBot,
    body: [pos, { ...pos }, { ...pos }],
    dir: 'right',
    nextDir: 'right',
    score: 0,
    alive: true,
    botTimer: 0,
  };
}

function spawnBot(room) {
  const usedNames = new Set(room.players.map(p => p.name));
  let botName = BOT_NAMES[room.players.length % BOT_NAMES.length];
  for (const n of BOT_NAMES) {
    if (!usedNames.has(n)) { botName = n; break; }
  }
  const usedColors = new Set(room.players.filter(p => p.alive).map(p => p.colorIdx));
  let colorIdx = 1;
  while (usedColors.has(colorIdx)) colorIdx++;
  botIdCounter++;
  const snakes = room.players.filter(p => p.alive).map(p => ({ body: p.body }));
  const bot = createPlayer('bot-' + botIdCounter, botName, colorIdx, snakes, true);
  bot.botTimer = 0;
  room.players.push(bot);
}

function tick(room) {
  const cfg = MODES[room.mode];

  for (const p of room.players) {
    if (!p.alive) continue;

    if (p.isBot) {
      p.botTimer--;
      if (p.botTimer <= 0) {
        p.botTimer = 3 + Math.floor(Math.random() * 5);
        const head = p.body[0];
        let bestDir = p.dir;
        let bestDist = Infinity;
        for (const dk of DIR_KEYS) {
          const d = DIRS[dk];
          const nx = ((head.x + d.x) % WORLD_W + WORLD_W) % WORLD_W;
          const ny = ((head.y + d.y) % WORLD_H + WORLD_H) % WORLD_H;
          let blocked = false;
          for (const other of room.players) {
            if (!other.alive) continue;
            for (const seg of other.body) {
              if (seg.x === nx && seg.y === ny) { blocked = true; break; }
            }
            if (blocked) break;
          }
          if (blocked) continue;
          let minDist = Infinity;
          for (const f of room.foods) {
            const dist = Math.abs(f.x - nx) + Math.abs(f.y - ny);
            if (dist < minDist) minDist = dist;
          }
          const cur = DIRS[p.dir];
          if (d.x === -cur.x && d.y === -cur.y) continue;
          if (minDist < bestDist) {
            bestDist = minDist;
            bestDir = dk;
          }
        }
        p.dir = bestDir;
        p.nextDir = bestDir;
      }
    }

    p.dir = p.nextDir;
    const d = DIRS[p.dir];
    const head = p.body[0];
    const newHead = {
      x: ((head.x + d.x) % WORLD_W + WORLD_W) % WORLD_W,
      y: ((head.y + d.y) % WORLD_H + WORLD_H) % WORLD_H,
    };

    p.body.unshift(newHead);

    let ate = false;
    for (let i = room.foods.length - 1; i >= 0; i--) {
      if (room.foods[i].x === newHead.x && room.foods[i].y === newHead.y) {
        room.foods.splice(i, 1);
        ate = true;
        p.score += cfg.initialSpeed;
        break;
      }
    }

    if (!ate) p.body.pop();

    const headKey = `${newHead.x},${newHead.y}`;
    for (const other of room.players) {
      if (other.id === p.id || !other.alive) continue;
      for (let i = 0; i < other.body.length; i++) {
        if (`${other.body[i].x},${other.body[i].y}` === headKey) {
          p.alive = false;
          p.killedBy = other.name;
          // Drop all body segments as food
          for (const seg of p.body) {
            if (!room.foods.find(f => f.x === seg.x && f.y === seg.y)) {
              room.foods.push({ x: seg.x, y: seg.y });
            }
          }
          if (!p.isBot) saveScore(p);
          break;
        }
      }
      if (!p.alive) break;
    }
  }

  while (room.foods.length < cfg.foodCount) {
    const pos = randPos();
    if (!room.foods.find(f => f.x === pos.x && f.y === pos.y)) {
      room.foods.push(pos);
    }
  }

  if (room.solo) {
    room.players = room.players.filter(p => p.alive || !p.isBot);
    while (room.players.filter(p => p.isBot).length < MIN_BOTS) {
      spawnBot(room);
    }
    const human = room.players.find(p => !p.isBot);
    if (!human || !human.alive) {
      if (human) saveScore(human);
      clearInterval(room.timer);
      endGame(room);
    } else {
      emitState(room);
    }
  } else {
    const alive = room.players.filter(p => p.alive);
    if (alive.length <= 1 && room.players.length > 0) {
      const survivor = alive[0];
      if (survivor && !survivor.isBot) saveScore(survivor);
      clearInterval(room.timer);
      endGame(room);
    } else {
      emitState(room);
    }
  }
}

function saveScore(p) {
  try {
    db.prepare('INSERT INTO scores (player_name, score, mode, killed_by) VALUES (?, ?, ?, ?)')
      .run(p.name, p.score, 'solo', p.killedBy || null);
  } catch (e) { console.error('Failed to save score:', e.message); }
}

function emitState(room) {
  const state = {
    players: room.players.map(p => ({
      id: p.id, name: p.name, colorIdx: p.colorIdx, isBot: p.isBot,
      body: p.body, dir: p.dir, score: p.score, alive: p.alive,
    })),
    foods: room.foods,
    mode: room.mode,
    world: { w: WORLD_W, h: WORLD_H },
  };
  io.to(room.id).emit('gameState', state);
}

function endGame(room) {
  clearInterval(room.timer);
  const human = room.players.find(p => !p.isBot);
  const bot = room.players.find(p => p.isBot);
  io.to(room.id).emit('gameOver', {
    players: room.players.map(p => ({
      name: p.isBot ? 'Bot' : p.name,
      score: p.score,
      colorIdx: p.colorIdx,
      isBot: p.isBot,
      killedBy: p.killedBy || (p.alive ? 'winner' : 'unknown'),
    })),
    humanWon: human && human.alive,
  });
  setTimeout(() => delete rooms[room.id], 60000);
}

function startGame(room) {
  room.foods = [];
  room.players.forEach(p => { p.alive = true; p.score = 0; p.killedBy = null; p.body = []; });
  for (const p of room.players) {
    const pos = getSpawnPos(room.players.filter(x => x !== p || x.body.length > 0));
    p.body = [pos, { ...pos }, { ...pos }];
  }
  for (let i = 0; i < MODES[room.mode].foodCount; i++) {
    const pos = getSpawnPos(room.players);
    room.foods.push(pos);
  }
  if (room.solo) {
    for (let i = 0; i < MIN_BOTS; i++) {
      spawnBot(room);
    }
  }
  room.timer = setInterval(() => tick(room), MODES[room.mode].tickMs);
  emitState(room);
}

// ─── Socket.io ──────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerName = '';
  let playerId = socket.id;

  socket.on('joinQueue', ({ name, mode }) => {
    if (typeof name !== 'string') name = '';
    playerName = name.trim().slice(0, 30) || 'Player';
    let room = Object.values(rooms).find(r => r.players.length === 1 && !r.solo && r.mode === mode && !r.started);
    if (!room) {
      roomIdCounter++;
      room = {
        id: `room-${roomIdCounter}`,
        mode: mode || 'medium',
        players: [],
        foods: [],
        started: false,
        timer: null,
        solo: false,
      };
      rooms[room.id] = room;
    }
    const colorIdx = room.players.length;
    const snakes = room.players.map(p => ({ body: p.body }));
    const player = createPlayer(playerId, playerName, colorIdx, snakes, false);
    room.players.push(player);
    currentRoom = room;
    socket.join(room.id);
    socket.emit('joined', { roomId: room.id, playerId, colorIdx, world: { w: WORLD_W, h: WORLD_H } });
    if (room.players.length === 2) {
      room.started = true;
      io.to(room.id).emit('gameStarting', { countdown: 3 });
      setTimeout(() => startGame(room), 3000);
    } else {
      socket.emit('waiting', { message: 'Waiting for opponent...' });
    }
  });

  socket.on('joinSolo', ({ name, mode }) => {
    if (typeof name !== 'string') name = '';
    playerName = name.trim().slice(0, 30) || 'Player';
    roomIdCounter++;
    const room = {
      id: `solo-${roomIdCounter}`,
      mode: mode || 'medium',
      players: [],
      foods: [],
      started: true,
      timer: null,
      solo: true,
    };
    rooms[room.id] = room;
    const snakeList = [];
    const player = createPlayer(playerId, playerName, 0, snakeList, false);
    room.players.push(player);
    currentRoom = room;
    socket.join(room.id);
    socket.emit('joined', { roomId: room.id, playerId, colorIdx: 0, world: { w: WORLD_W, h: WORLD_H } });
    socket.emit('gameStarting', { countdown: 2 });
    setTimeout(() => startGame(room), 2000);
  });

  socket.on('setDirection', ({ dir }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.find(p => p.id === playerId);
    if (!player || !player.alive || player.isBot) return;
    const d = DIRS[dir];
    const cur = DIRS[player.dir];
    if (d && !(d.x === -cur.x && d.y === -cur.y)) {
      player.nextDir = dir;
    }
  });

  socket.on('leaveGame', () => {
    if (!currentRoom) return;
    const idx = currentRoom.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const p = currentRoom.players[idx];
      if (p && p.score > 0 && !p.isBot) saveScore(p);
      if (currentRoom.solo) {
        clearInterval(currentRoom.timer);
        io.to(currentRoom.id).emit('gameOver', {
          players: currentRoom.players.map(p => ({
            name: p.isBot ? 'Bot' : p.name,
            score: p.score,
            colorIdx: p.colorIdx,
            isBot: p.isBot,
            killedBy: p.killedBy || (p.alive ? 'winner' : 'unknown'),
          })),
          humanWon: false,
        });
        delete rooms[currentRoom.id];
        return;
      }
      currentRoom.players.splice(idx, 1);
      if (currentRoom.started) {
        io.to(currentRoom.id).emit('playerDisconnected', { playerId, name: playerName });
        if (currentRoom.players.filter(p => p.alive).length <= 1 && currentRoom.timer) {
          clearInterval(currentRoom.timer);
          endGame(currentRoom);
        }
      }
      if (currentRoom.players.length === 0) {
        clearInterval(currentRoom.timer);
        delete rooms[currentRoom.id];
      }
    }
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const idx = currentRoom.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const p = currentRoom.players[idx];
      if (p && p.score > 0 && !p.isBot) saveScore(p);
      currentRoom.players.splice(idx, 1);
      if (currentRoom.solo) {
        clearInterval(currentRoom.timer);
        io.to(currentRoom.id).emit('gameOver', {
          players: currentRoom.players.map(p => ({
            name: p.isBot ? 'Bot' : p.name,
            score: p.score,
            colorIdx: p.colorIdx,
            isBot: p.isBot,
            killedBy: p.killedBy || (p.alive ? 'winner' : 'unknown'),
          })),
          humanWon: false,
        });
        delete rooms[currentRoom.id];
        return;
      }
      if (currentRoom.started) {
        io.to(currentRoom.id).emit('playerDisconnected', { playerId, name: playerName });
        if (currentRoom.players.filter(p => p.alive).length <= 1 && currentRoom.timer) {
          clearInterval(currentRoom.timer);
          endGame(currentRoom);
        }
      }
      if (currentRoom.players.length === 0) {
        clearInterval(currentRoom.timer);
        delete rooms[currentRoom.id];
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake multiplayer server on port ${PORT}`);
});
