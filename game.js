// =============================================
// SUPER MARIO - HTML5 Canvas Game
// =============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ─── Constants ───────────────────────────────
const W = canvas.width;
const H = canvas.height;
const TILE = 32;
const GRAVITY = 0.55;
const MAX_FALL = 14;
const JUMP_FORCE = -13;
const WALK_SPEED = 3.5;
const RUN_SPEED = 6;
const FRICTION = 0.82;
const SKY = '#5c94fc';

// ─── Game State ──────────────────────────────
let state = 'title'; // title | playing | paused | dead | win | gameover
let score = 0;
let coins = 0;
let lives = 3;
let timer = 400;
let timerTick = 0;
let cameraX = 0;

// ─── Input ───────────────────────────────────
const keys = {};
const justPressed = {};
document.addEventListener('keydown', e => {
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
  e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Mobile buttons
const mobileState = { left: false, right: false, jump: false };
function setupMobileBtn(id, prop) {
  const btn = document.getElementById(id);
  btn.addEventListener('touchstart', e => { mobileState[prop] = true; e.preventDefault(); }, { passive: false });
  btn.addEventListener('touchend',   e => { mobileState[prop] = false; e.preventDefault(); }, { passive: false });
}
setupMobileBtn('btn-left',  'left');
setupMobileBtn('btn-right', 'right');
setupMobileBtn('btn-jump',  'jump');

function keyDown(code) { return keys[code] || false; }
function isLeft()   { return keyDown('ArrowLeft')  || keyDown('KeyA') || mobileState.left; }
function isRight()  { return keyDown('ArrowRight') || keyDown('KeyD') || mobileState.right; }
function isJump()   { return keyDown('ArrowUp') || keyDown('KeyZ') || keyDown('Space') || mobileState.jump; }
function isRun()    { return keyDown('ShiftLeft') || keyDown('ShiftRight'); }

// ─── Palette helpers ─────────────────────────
const C = {
  marioRed:   '#e52521',
  marioBrown: '#7b3f00',
  marioSkin:  '#ffdab9',
  marioBlue:  '#0070e0',
  ground:     '#c84b0f',
  groundTop:  '#5c9421',
  pipe:       '#00a800',
  pipeDark:   '#006800',
  coin:       '#ffd700',
  brick:      '#c84b0f',
  qBlock:     '#e0a000',
  qBlockHit:  '#8b6914',
  goomba:     '#a05000',
  goombaDark: '#6b3300',
  flagGreen:    '#00a800',
  mushRed:      '#e52521',
  cloud:        '#ffffff',
  mountain:     '#00a800',
  bush:         '#00a800',
  titanBody:    '#4a3060',
  titanArmor:   '#7b5ea7',
  titanHigh:    '#c0a0ff',
  titanEye:     '#ff2020',
  titanBoulder: '#888',
  titanBoulderD:'#555',
  titanHpBar:   '#e52521',
  titanHpBg:    '#400',
};

// ─── Particle System ─────────────────────────
const particles = [];
function spawnParticles(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -6 - 2,
      life: 40, maxLife: 40,
      color,
      r: Math.random() * 5 + 3,
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles(cx) {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cx, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── Floating Text ────────────────────────────
const floats = [];
function spawnFloat(x, y, text, color = '#fff') {
  floats.push({ x, y, vy: -1.5, life: 55, maxLife: 55, text, color });
}
function updateFloats() {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.y += f.vy;
    f.life--;
    if (f.life <= 0) floats.splice(i, 1);
  }
}
function drawFloats(cx) {
  floats.forEach(f => {
    ctx.globalAlpha = f.life / f.maxLife;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x - cx, f.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── Sound (Web Audio API) ────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playTone(freq, type, duration, vol = 0.15) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
function sfxJump()   { playTone(523, 'square', 0.12, 0.12); setTimeout(() => playTone(659, 'square', 0.1, 0.1), 50); }
function sfxCoin()   { playTone(988, 'square', 0.08); setTimeout(() => playTone(1319,'square',0.12), 60); }
function sfxStomp()  { playTone(200, 'square', 0.1, 0.2); }
function sfxBreak()  { [200,150,100].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.08,0.15), i*40)); }
function sfxPower()  { [330,392,523,659].forEach((f,i) => setTimeout(() => playTone(f,'square',0.1,0.12), i*80)); }
function sfxDie()        { [440,330,220,110].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.15,0.2), i*100)); }
function sfxWin()        { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,'square',0.2,0.15), i*150)); }
function sfxTitanRoar()  { [80,60,100,70].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.25,0.3), i*80)); }
function sfxTitanHit()   { [300,200,150].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.2,0.25), i*60)); }
function sfxTitanDie()   { [200,150,100,80,60].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.3,0.3), i*120)); }
function sfxBoulder()    { playTone(120, 'sawtooth', 0.18, 0.2); }

// ─── Level Builder ───────────────────────────
// Tile types: G=ground, B=brick, Q=question, P=pipe_bot, p=pipe_top, F=flagpole base
// Level is built as an array of objects

function buildLevel() {
  const level = {
    width: 6400,
    platforms: [],
    bricks: [],
    qblocks: [],
    pipes: [],
    enemies: [],
    coins: [],
    powerups: [],
    flag: null,
    decorations: [],
    titan: null,
    boulders: [],
  };

  // Ground row (y = H - TILE, full width with gaps)
  const groundY = H - TILE;
  // Main ground segments
  const groundSegs = [
    [0, 168],          // start to gap1
    [200, 80],         // after gap1
    [310, 100],        // ...
    [440, 200],
    [670, 150],
    [850, 100],
    [980, 300],
    [1310, 200],
    [1540, 100],
    [1670, 200],
    [1900, 150],
    [2080, 200],
    [2310, 100],
    [2440, 400],
    [2870, 150],
    [3050, 300],
    [3380, 200],
    [3610, 100],
    [3740, 800],        // long section
    [4570, 200],
    [4800, 100],
    [4930, 1470],      // to end
  ];

  groundSegs.forEach(([startX, len]) => {
    for (let x = startX; x < startX + len; x += TILE) {
      level.platforms.push({ x, y: groundY, w: TILE, h: TILE, type: 'ground' });
      // underground fill
      for (let yy = groundY + TILE; yy < H + TILE * 2; yy += TILE) {
        level.platforms.push({ x, y: yy, w: TILE, h: TILE, type: 'ground' });
      }
    }
  });

  // ── Platforms (floating) ──
  const floatPlats = [
    // [x, y, countTiles, type]
    [128,  H-TILE*4,  3, 'brick'],
    [256,  H-TILE*5,  3, 'brick'],
    [384,  H-TILE*6,  3, 'brick'],
    [512,  H-TILE*4,  3, 'brick'],
    [640,  H-TILE*5,  3, 'brick'],
    [832,  H-TILE*5,  4, 'brick'],
    [1024, H-TILE*4,  3, 'brick'],
    [1152, H-TILE*6,  3, 'brick'],
    [1280, H-TILE*4,  4, 'brick'],
    [1440, H-TILE*5,  3, 'brick'],
    [1600, H-TILE*4,  3, 'brick'],
    [1760, H-TILE*6,  3, 'brick'],
    [1920, H-TILE*4,  4, 'brick'],
    [2080, H-TILE*5,  3, 'brick'],
    [2240, H-TILE*4,  3, 'brick'],
    [2400, H-TILE*6,  4, 'brick'],
    [2560, H-TILE*4,  3, 'brick'],
    [2720, H-TILE*5,  3, 'brick'],
    [2880, H-TILE*4,  3, 'brick'],
    [3040, H-TILE*6,  4, 'brick'],
    [3200, H-TILE*4,  3, 'brick'],
    [3360, H-TILE*5,  3, 'brick'],
    [3520, H-TILE*4,  3, 'brick'],
    [3680, H-TILE*6,  4, 'brick'],
    [3840, H-TILE*4,  3, 'brick'],
    [4000, H-TILE*5,  3, 'brick'],
    [4160, H-TILE*4,  3, 'brick'],
    [4320, H-TILE*6,  4, 'brick'],
    [4480, H-TILE*4,  3, 'brick'],
    [4640, H-TILE*5,  3, 'brick'],
    [4800, H-TILE*4,  3, 'brick'],
    [4960, H-TILE*6,  4, 'brick'],
    [5120, H-TILE*4,  3, 'brick'],
    [5280, H-TILE*5,  3, 'brick'],
    [5440, H-TILE*4,  3, 'brick'],
  ];

  floatPlats.forEach(([fx, fy, count, type]) => {
    for (let i = 0; i < count; i++) {
      if (type === 'brick') {
        level.bricks.push({ x: fx + i * TILE, y: fy, w: TILE, h: TILE, broken: false });
      }
    }
  });

  // ── Question Blocks ──
  const qDefs = [
    // [x, y, contains]  contains: 'coin' | 'mushroom' | 'star'
    [160,  H-TILE*5,  'coin'],
    [192,  H-TILE*5,  'mushroom'],
    [224,  H-TILE*5,  'coin'],
    [352,  H-TILE*5,  'coin'],
    [576,  H-TILE*6,  'mushroom'],
    [608,  H-TILE*5,  'coin'],
    [864,  H-TILE*6,  'coin'],
    [896,  H-TILE*6,  'mushroom'],
    [928,  H-TILE*6,  'coin'],
    [1056, H-TILE*5,  'coin'],
    [1184, H-TILE*7,  'mushroom'],
    [1312, H-TILE*5,  'coin'],
    [1472, H-TILE*6,  'coin'],
    [1632, H-TILE*5,  'mushroom'],
    [1792, H-TILE*7,  'coin'],
    [1952, H-TILE*5,  'coin'],
    [2112, H-TILE*6,  'mushroom'],
    [2272, H-TILE*5,  'coin'],
    [2432, H-TILE*7,  'star'],
    [2592, H-TILE*5,  'coin'],
    [2752, H-TILE*6,  'mushroom'],
    [2912, H-TILE*5,  'coin'],
    [3072, H-TILE*7,  'coin'],
    [3232, H-TILE*5,  'mushroom'],
    [3392, H-TILE*6,  'coin'],
    [3552, H-TILE*5,  'coin'],
    [3712, H-TILE*7,  'star'],
    [3872, H-TILE*5,  'coin'],
    [4032, H-TILE*6,  'mushroom'],
    [4192, H-TILE*5,  'coin'],
    [4352, H-TILE*7,  'coin'],
    [4512, H-TILE*5,  'mushroom'],
    [4672, H-TILE*6,  'coin'],
    [4832, H-TILE*5,  'coin'],
    [4992, H-TILE*7,  'star'],
    [5152, H-TILE*5,  'coin'],
    [5312, H-TILE*6,  'mushroom'],
    [5472, H-TILE*5,  'coin'],
  ];
  qDefs.forEach(([x, y, contains]) => {
    level.qblocks.push({ x, y, w: TILE, h: TILE, contains, hit: false, animY: 0, animDir: 0 });
  });

  // ── Pipes ──
  const pipeDefs = [
    // [x, height_in_tiles]
    [224,  2], [448,  3], [672,  2], [896,  4],
    [1120, 2], [1344, 3], [1568, 2], [1792, 4],
    [2016, 2], [2240, 3], [2464, 2], [2688, 4],
    [2912, 2], [3136, 3], [3360, 2], [3584, 4],
    [3808, 2], [4032, 3], [4256, 2], [4480, 4],
    [4704, 2], [4928, 3], [5152, 2], [5376, 4],
  ];
  pipeDefs.forEach(([px, ph]) => {
    level.pipes.push({ x: px, y: groundY - ph * TILE, w: TILE * 2, h: ph * TILE });
  });

  // ── Coins (floating) ──
  const coinRows = [
    [320, H-TILE*3, 5], [640, H-TILE*3, 4], [960, H-TILE*3, 5],
    [1280, H-TILE*3, 4], [1600, H-TILE*3, 5], [1920, H-TILE*3, 4],
    [2240, H-TILE*3, 5], [2560, H-TILE*3, 4], [2880, H-TILE*3, 5],
    [3200, H-TILE*3, 4], [3520, H-TILE*3, 5], [3840, H-TILE*3, 4],
    [4160, H-TILE*3, 5], [4480, H-TILE*3, 4], [4800, H-TILE*3, 5],
    [5120, H-TILE*3, 4], [5440, H-TILE*3, 5],
  ];
  coinRows.forEach(([cx, cy, count]) => {
    for (let i = 0; i < count; i++) {
      level.coins.push({ x: cx + i * TILE, y: cy, w: 16, h: 20, collected: false, anim: Math.random() * Math.PI * 2 });
    }
  });

  // ── Enemies (Goombas) ──
  const enemyDefs = [
    400, 450, 700, 750, 900, 1050, 1100, 1300, 1350,
    1500, 1700, 1750, 1900, 2100, 2150, 2300, 2500, 2550,
    2700, 2900, 2950, 3100, 3300, 3350, 3500, 3700, 3750,
    3900, 4100, 4150, 4300, 4500, 4550, 4700, 4900, 4950,
    5100, 5300, 5350, 5500,
  ];
  enemyDefs.forEach(ex => {
    level.enemies.push({
      x: ex, y: groundY - TILE,
      w: TILE, h: TILE,
      vx: -1.2, vy: 0,
      alive: true, stomped: false, stompTimer: 0,
      onGround: false,
    });
  });

  // ── Flag ──
  level.flag = {
    x: 5760,
    y: groundY - TILE * 10,
    poleH: TILE * 10,
    flagY: 0,        // offset from top of pole
    sliding: false,
    slideSpeed: 3,
  };

  // ── TITAN BOSS ──
  // Placed at x=5400, before the flag at x=5760
  // 3x3 tile size: 96x96
  level.titan = {
    x: 5400,
    y: groundY - TILE * 3,      // 96px tall
    w: TILE * 3,                 // 96px wide
    h: TILE * 3,
    vx: -0.9,
    vy: 0,
    onGround: false,
    hp: 3,
    maxHp: 3,
    alive: true,
    phase: 1,                    // 1=patrol 2=faster 3=rage
    invincible: 0,               // stomp cooldown frames
    attackTick: 180,             // countdown to next boulder throw (start with delay)
    attackInterval: 180,         // frames between attacks
    chargeTick: 300,             // countdown to charge (start with delay)
    chargeInterval: 300,
    charging: false,
    chargeDuration: 0,
    roarTick: 0,                 // visual roar effect timer
    deathTimer: 0,               // death animation
    animTick: 0,
    facing: -1,                  // -1=left, 1=right
  };

  // ── Decorations (clouds, mountains, bushes) ──
  for (let x = 100; x < level.width; x += 350 + Math.random() * 200) {
    level.decorations.push({ type: 'cloud', x, y: 60 + Math.random() * 80, w: 80 + Math.random() * 60 });
  }
  for (let x = 200; x < level.width; x += 300 + Math.random() * 200) {
    level.decorations.push({ type: 'mountain', x, y: groundY - 80, w: 100 + Math.random() * 60 });
  }
  for (let x = 150; x < level.width; x += 250 + Math.random() * 150) {
    level.decorations.push({ type: 'bush', x, y: groundY - 20, w: 60 + Math.random() * 40 });
  }

  return level;
}

// ─── Mario ───────────────────────────────────
function createMario() {
  return {
    x: 64, y: H - TILE * 3,
    w: 28, h: 32,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,          // 1=right, -1=left
    state: 'small',     // small | big | star
    starTimer: 0,
    animFrame: 0,
    animTick: 0,
    jumping: false,
    dead: false,
    deadTimer: 0,
    invincible: 0,
    wasJumping: false,
  };
}

let mario = createMario();
let level = buildLevel();

// ─── Camera ──────────────────────────────────
function updateCamera() {
  const target = mario.x - W * 0.35;
  cameraX += (target - cameraX) * 0.12;
  cameraX = Math.max(0, Math.min(cameraX, level.width - W));
}

// ─── Collision helpers ───────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function getAllSolids() {
  const solids = [...level.platforms];
  level.bricks.forEach(b => { if (!b.broken) solids.push(b); });
  level.qblocks.forEach(q => { if (!q.hit || q.animY !== 0) solids.push({ ...q, y: q.y + q.animY }); });
  level.pipes.forEach(p => solids.push(p));
  return solids;
}

function resolveCollisions(entity, solids) {
  entity.onGround = false;

  // Horizontal
  entity.x += entity.vx;
  for (const s of solids) {
    if (rectOverlap(entity, s)) {
      if (entity.vx > 0) entity.x = s.x - entity.w;
      else if (entity.vx < 0) entity.x = s.x + s.w;
      entity.vx = 0;
    }
  }

  // Vertical
  entity.y += entity.vy;
  for (const s of solids) {
    if (rectOverlap(entity, s)) {
      if (entity.vy > 0) {
        entity.y = s.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = s.y + s.h;
        entity.vy = 0;
        // Bump block from below
        onBlockBump(entity, s);
      }
    }
  }
}

function onBlockBump(entity, block) {
  // Only Mario bumps blocks
  if (entity !== mario) return;

  const qb = level.qblocks.find(q => q === block);
  if (qb && !qb.hit) {
    qb.hit = true;
    qb.animDir = -1;
    triggerQBlock(qb);
    return;
  }
  const br = level.bricks.find(b => b === block);
  if (br && mario.state !== 'small') {
    br.broken = true;
    sfxBreak();
    spawnParticles(br.x + TILE/2, br.y, C.brick, 8);
    addScore(50);
    return;
  }
  if (br) {
    // Small mario bumps brick: shake
    br.animY = -4;
    sfxBreak();
  }
}

function triggerQBlock(qb) {
  if (qb.contains === 'coin') {
    sfxCoin();
    coins++;
    score += 200;
    updateHUD();
    spawnFloat(qb.x + TILE/2, qb.y - 10, '+200', C.coin);
    // spawn a coin pop
    const cp = { x: qb.x + TILE/2 - 8, y: qb.y - TILE, vy: -8, collected: false, anim: 0, w: 16, h: 20, popping: true };
    level.coins.push(cp);
  } else if (qb.contains === 'mushroom') {
    sfxPower();
    level.powerups.push({
      x: qb.x, y: qb.y - TILE,
      w: TILE, h: TILE,
      type: 'mushroom',
      vx: 1.5, vy: 0, onGround: false,
      collected: false,
    });
  } else if (qb.contains === 'star') {
    sfxPower();
    level.powerups.push({
      x: qb.x, y: qb.y - TILE,
      w: TILE, h: TILE,
      type: 'star',
      vx: 2, vy: -5, onGround: false,
      collected: false,
    });
  }
}

// ─── Score / HUD ─────────────────────────────
function addScore(pts) {
  score += pts;
  updateHUD();
}

function updateHUD() {
  document.getElementById('score').textContent = String(score).padStart(6, '0');
  document.getElementById('coins').textContent = String(coins % 100).padStart(2, '0');
  document.getElementById('lives').textContent = lives;
  document.getElementById('time').textContent = Math.ceil(timer);
}

// ─── Mario Update ─────────────────────────────
function updateMario(dt) {
  if (mario.dead) {
    mario.vy += GRAVITY;
    mario.y  += mario.vy;
    mario.deadTimer--;
    if (mario.deadTimer <= 0) {
      lives--;
      if (lives <= 0) {
        setOverlay('GAME OVER', 'Press ENTER to try again');
        state = 'gameover';
      } else {
        respawn();
      }
    }
    return;
  }

  if (mario.invincible > 0) mario.invincible--;
  if (mario.starTimer > 0) mario.starTimer--;
  if (mario.starTimer === 0 && mario.state === 'star') mario.state = 'big';

  // Input
  const spd = isRun() ? RUN_SPEED : WALK_SPEED;
  if (isLeft())  { mario.vx -= 0.8; mario.facing = -1; }
  if (isRight()) { mario.vx += 0.8; mario.facing = 1; }

  mario.vx *= FRICTION;
  if (Math.abs(mario.vx) > spd) mario.vx = Math.sign(mario.vx) * spd;

  // Jump
  const jumpPressed = isJump();
  if (jumpPressed && mario.onGround && !mario.wasJumping) {
    mario.vy = JUMP_FORCE + (mario.state !== 'small' ? -0.5 : 0);
    mario.onGround = false;
    mario.jumping = true;
    sfxJump();
  }
  // Variable jump height
  if (!jumpPressed && mario.vy < -4) mario.vy = -4;
  mario.wasJumping = jumpPressed;

  mario.vy += GRAVITY;
  if (mario.vy > MAX_FALL) mario.vy = MAX_FALL;

  // Boundary
  if (mario.x < 0) mario.x = 0;

  resolveCollisions(mario, getAllSolids());

  // Fall death
  if (mario.y > H + 100) killMario();

  // Win: reach flag
  if (level.flag && mario.x + mario.w > level.flag.x && mario.x < level.flag.x + 16) {
    triggerWin();
  }

  // Animation
  mario.animTick++;
  if (Math.abs(mario.vx) > 0.5 && mario.onGround) {
    if (mario.animTick % 8 === 0) mario.animFrame = (mario.animFrame + 1) % 3;
  } else {
    mario.animFrame = 0;
  }
}

function killMario() {
  if (mario.dead || mario.invincible > 0) return;
  if (mario.state !== 'small') {
    mario.state = 'small';
    mario.h = 32;
    mario.invincible = 100;
    sfxDie();
    return;
  }
  mario.dead = true;
  mario.vy = -11;
  mario.deadTimer = 120;
  sfxDie();
}

function respawn() {
  mario = createMario();
  level = buildLevel();
  cameraX = 0;
  timer = 400;
  particles.length = 0;
  floats.length = 0;
  updateHUD();
  state = 'playing';
}

// ─── Enemy Update ─────────────────────────────
function updateEnemies() {
  const solids = getAllSolids();
  level.enemies.forEach(e => {
    if (!e.alive) {
      if (e.stomped) { e.stompTimer--; }
      return;
    }
    e.vy += GRAVITY;
    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
    resolveCollisions(e, solids);

    // Reverse at edges / walls
    if (e.vx > 0 && !checkGroundAhead(e,  1, solids)) e.vx = -Math.abs(e.vx);
    if (e.vx < 0 && !checkGroundAhead(e, -1, solids)) e.vx =  Math.abs(e.vx);

    // Collide with Mario
    if (!mario.dead && mario.invincible === 0 && rectOverlap(mario, e)) {
      const mBottom = mario.y + mario.h;
      const eTop    = e.y;
      if (mario.vy > 0 && mBottom < eTop + 16) {
        // Stomp
        e.alive = false;
        e.stomped = true;
        e.stompTimer = 30;
        mario.vy = -7;
        sfxStomp();
        addScore(100);
        spawnFloat(e.x + TILE/2, e.y, '+100', C.coin);
      } else if (mario.state === 'star') {
        e.alive = false;
        sfxStomp();
        addScore(200);
        spawnFloat(e.x + TILE/2, e.y, '+200', C.coin);
        spawnParticles(e.x + TILE/2, e.y, C.goomba, 6);
      } else {
        killMario();
      }
    }
  });
}

function checkGroundAhead(e, dir, solids) {
  const probeX = dir > 0 ? e.x + e.w + 2 : e.x - 4;
  const probeY = e.y + e.h + 4;
  return solids.some(s =>
    probeX >= s.x && probeX <= s.x + s.w &&
    probeY >= s.y && probeY <= s.y + s.h
  );
}

// ─── Titan Boss Update ────────────────────────
function updateTitan() {
  const t = level.titan;
  if (!t || !t.alive) {
    if (t && t.deathTimer > 0) {
      t.deathTimer--;
      if (t.deathTimer % 8 === 0) {
        spawnParticles(t.x + t.w/2 + (Math.random()-0.5)*t.w, t.y + t.h/2, C.titanArmor, 10);
        spawnParticles(t.x + t.w/2, t.y + (Math.random())*t.h, C.titanHigh, 8);
      }
      if (t.deathTimer === 0) triggerWin();
    }
    return;
  }

  const solids = getAllSolids();
  t.animTick++;

  // Invincibility cooldown
  if (t.invincible > 0) t.invincible--;

  // Phase progression
  if (t.hp === 2 && t.phase < 2) {
    t.phase = 2;
    t.attackInterval = 120;
    t.chargeInterval = 200;
    t.roarTick = 60;
    sfxTitanRoar();
    spawnFloat(t.x + t.w/2, t.y - 20, 'TITAN PHASE 2!', '#f80');
  }
  if (t.hp === 1 && t.phase < 3) {
    t.phase = 3;
    t.attackInterval = 80;
    t.chargeInterval = 140;
    t.roarTick = 80;
    sfxTitanRoar();
    spawnFloat(t.x + t.w/2, t.y - 20, 'TITAN RAGE!', '#f00');
  }
  if (t.roarTick > 0) t.roarTick--;

  // Gravity
  t.vy += GRAVITY * 0.7;
  if (t.vy > MAX_FALL) t.vy = MAX_FALL;

  // Charge attack
  t.chargeTick--;
  if (t.chargeTick <= 0 && !t.charging) {
    t.charging = true;
    t.chargeDuration = 45 + t.phase * 15;
    t.chargeTick = t.chargeInterval;
    t.vx = (mario.x > t.x ? 1 : -1) * (4 + t.phase);
    t.facing = t.vx > 0 ? 1 : -1;
    sfxTitanRoar();
    spawnFloat(t.x + t.w/2, t.y - 10, 'CHARGE!', '#f80');
  }
  if (t.charging) {
    t.chargeDuration--;
    if (t.chargeDuration <= 0) {
      t.charging = false;
      t.vx = (t.facing) * (0.9 + t.phase * 0.3);
    }
  } else if (!t.charging) {
    // Normal patrol walk
    const baseSpd = 0.9 + (t.phase - 1) * 0.5;
    if (t.onGround) {
      const dirToMario = mario.x > t.x ? 1 : -1;
      t.vx += dirToMario * 0.15;
      if (Math.abs(t.vx) > baseSpd) t.vx = Math.sign(t.vx) * baseSpd;
    }
    t.facing = t.vx >= 0 ? 1 : -1;
  }

  // Boulder throw
  t.attackTick--;
  if (t.attackTick <= 0 && t.onGround) {
    t.attackTick = t.attackInterval;
    throwBoulder(t);
  }

  // Wall reversal
  if (t.x <= 0) { t.vx = Math.abs(t.vx); t.facing = 1; }
  if (t.x + t.w >= level.width) { t.vx = -Math.abs(t.vx); t.facing = -1; }

  resolveCollisions(t, solids);

  // Mario collision
  if (!mario.dead && mario.invincible === 0 && rectOverlap(mario, t)) {
    const mBottom = mario.y + mario.h;
    const tTop    = t.y + 8; // small tolerance
    if (mario.vy > 0 && mBottom < tTop + 20 && t.invincible === 0) {
      // Stomp on head!
      t.hp--;
      t.invincible = 60;
      mario.vy = -10;
      sfxTitanHit();
      spawnParticles(t.x + t.w/2, t.y + 10, C.titanHigh, 14);
      if (t.hp <= 0) {
        t.alive = false;
        t.deathTimer = 90;
        sfxTitanDie();
        addScore(5000);
        spawnFloat(t.x + t.w/2, t.y - 30, '+5000', '#ff0');
        spawnParticles(t.x + t.w/2, t.y + t.h/2, C.titanArmor, 30);
      } else {
        addScore(500);
        spawnFloat(t.x + t.w/2, t.y - 20, `HIT! HP:${t.hp}`, '#f0f');
      }
    } else if (t.invincible === 0) {
      if (mario.state === 'star') {
        // Star stuns titan briefly
        t.invincible = 90;
        t.vx *= -1;
        t.facing *= -1;
        sfxTitanHit();
        spawnFloat(t.x + t.w/2, t.y - 20, 'STUNNED!', '#ff0');
        spawnParticles(t.x + t.w/2, t.y + t.h/2, '#ff0', 10);
      } else {
        killMario();
      }
    }
  }
}

function throwBoulder(t) {
  sfxBoulder();
  const dir = mario.x > t.x ? 1 : -1;
  level.boulders.push({
    x: t.x + (dir > 0 ? t.w : 0),
    y: t.y + t.h - TILE,
    w: TILE, h: TILE,
    vx: dir * (3 + t.phase * 1.2),
    vy: -5,
    onGround: false,
    rolling: false,
    alive: true,
    spin: 0,
  });
  spawnFloat(t.x + t.w/2, t.y - 10, 'BOULDER!', '#aaa');
}

function updateBoulders() {
  const solids = getAllSolids();
  for (let i = level.boulders.length - 1; i >= 0; i--) {
    const b = level.boulders[i];
    if (!b.alive) { level.boulders.splice(i, 1); continue; }

    b.vy += GRAVITY;
    if (b.vy > MAX_FALL) b.vy = MAX_FALL;
    resolveCollisions(b, solids);
    if (b.onGround) b.rolling = true;
    b.spin += b.vx * 0.05;

    // Off screen
    if (b.x < cameraX - 200 || b.x > cameraX + W + 200 || b.y > H + 100) {
      b.alive = false;
      continue;
    }

    // Mario collision
    if (!mario.dead && mario.invincible === 0 && rectOverlap(mario, b)) {
      if (mario.state === 'star') {
        b.alive = false;
        spawnParticles(b.x + b.w/2, b.y + b.h/2, C.titanBoulder, 6);
      } else {
        killMario();
      }
    }
  }
}

// ─── Draw Titan ───────────────────────────────
function drawTitan() {
  const t = level.titan;
  if (!t) return;
  if (!t.alive && t.deathTimer <= 0) return;

  const dx = t.x - cameraX;
  if (dx < -t.w * 2 || dx > W + t.w) return;

  const dy = t.y;
  const tw = t.w;   // 96
  const th = t.h;   // 96
  const cx = dx + tw / 2;

  ctx.save();

  // Blink white when taking damage
  if (t.invincible > 0 && t.invincible % 6 < 3 && t.alive) {
    ctx.filter = 'brightness(3)';
  }

  // Rage glow
  if (t.phase === 3 && t.alive) {
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 18 + Math.sin(Date.now() / 100) * 8;
  }

  // Roar shockwave ring
  if (t.roarTick > 0) {
    const progress = 1 - t.roarTick / 80;
    ctx.strokeStyle = `rgba(255,180,0,${1 - progress})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, dy + th/2, progress * 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Flip facing
  if (t.facing === 1) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  // ── Legs ──
  const legSwing = t.onGround && Math.abs(t.vx) > 0.3 ? Math.sin(t.animTick * 0.25) * 10 : 0;
  ctx.fillStyle = C.titanBody;
  // Left leg
  ctx.fillRect(dx + 10, dy + th - 28, 22, 28);
  ctx.fillRect(dx + 6,  dy + th - 12 + legSwing, 26, 12);
  // Right leg
  ctx.fillRect(dx + tw - 32, dy + th - 28, 22, 28);
  ctx.fillRect(dx + tw - 32, dy + th - 12 - legSwing, 26, 12);

  // ── Body armor ──
  ctx.fillStyle = C.titanBody;
  ctx.fillRect(dx + 6, dy + 30, tw - 12, th - 56);
  // Chest plate
  ctx.fillStyle = C.titanArmor;
  ctx.fillRect(dx + 14, dy + 36, tw - 28, th - 68);
  // Armor ridges
  ctx.fillStyle = C.titanHigh;
  ctx.fillRect(dx + 16, dy + 38, 8, th - 72);
  ctx.fillRect(dx + tw - 24, dy + 38, 8, th - 72);
  ctx.fillRect(dx + 14, dy + 38, tw - 28, 5);
  ctx.fillRect(dx + 14, dy + 38 + (th - 72)/2, tw - 28, 4);

  // ── Shoulders / pauldrons ──
  ctx.fillStyle = C.titanArmor;
  ctx.beginPath();
  ctx.ellipse(dx + 8,       dy + 34, 14, 12, -0.3, 0, Math.PI*2);
  ctx.ellipse(dx + tw - 8,  dy + 34, 14, 12,  0.3, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = C.titanHigh;
  ctx.beginPath();
  ctx.ellipse(dx + 8,       dy + 30, 8, 6, -0.3, 0, Math.PI*2);
  ctx.ellipse(dx + tw - 8,  dy + 30, 8, 6,  0.3, 0, Math.PI*2);
  ctx.fill();

  // ── Arms ──
  const armSwing = Math.sin(t.animTick * 0.2) * 8;
  ctx.fillStyle = C.titanBody;
  ctx.fillRect(dx - 4,       dy + 34 + armSwing, 14, 36);  // left arm
  ctx.fillRect(dx + tw - 10, dy + 34 - armSwing, 14, 36);  // right arm
  // Gauntlets (fists)
  ctx.fillStyle = C.titanArmor;
  ctx.fillRect(dx - 8,       dy + 66 + armSwing, 20, 18);
  ctx.fillRect(dx + tw - 12, dy + 66 - armSwing, 20, 18);
  // Spikes on gauntlets
  ctx.fillStyle = C.titanHigh;
  for (let s = 0; s < 3; s++) {
    ctx.fillRect(dx - 6 + s * 6,       dy + 62 + armSwing, 4, 6);
    ctx.fillRect(dx + tw - 10 + s * 6, dy + 62 - armSwing, 4, 6);
  }

  // ── Head ──
  ctx.fillStyle = C.titanBody;
  ctx.fillRect(dx + 16, dy, tw - 32, 34);
  // Helmet
  ctx.fillStyle = C.titanArmor;
  ctx.fillRect(dx + 12, dy + 2, tw - 24, 22);
  ctx.fillRect(dx + 8,  dy + 8, tw - 16, 16);
  // Helmet crest / mohawk
  ctx.fillStyle = C.titanHigh;
  ctx.fillRect(dx + tw/2 - 5, dy - 10, 10, 14);
  ctx.fillRect(dx + tw/2 - 3, dy - 16, 6, 8);
  // Horn spikes
  ctx.fillStyle = '#d4a800';
  ctx.beginPath();
  ctx.moveTo(dx + 14, dy + 6);
  ctx.lineTo(dx + 4,  dy - 10);
  ctx.lineTo(dx + 22, dy + 6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dx + tw - 14, dy + 6);
  ctx.lineTo(dx + tw - 4,  dy - 10);
  ctx.lineTo(dx + tw - 22, dy + 6);
  ctx.fill();
  // Visor / eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(dx + 14, dy + 14, tw - 28, 10);
  // Glowing eyes
  const eyeGlow = t.phase === 3 ? `hsl(${(Date.now()/30)%360},100%,60%)` : C.titanEye;
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.ellipse(dx + 26, dy + 19, 6, 4, 0, 0, Math.PI*2);
  ctx.ellipse(dx + tw - 26, dy + 19, 6, 4, 0, 0, Math.PI*2);
  ctx.fill();
  // Eye glow effect
  ctx.shadowColor = eyeGlow;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Name plate (only visible on screen first time)
  if (!t._nameShown) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(dx + 4, dy - 28, tw - 8, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TITAN', cx, dy - 14);
    ctx.textAlign = 'left';
  }

  ctx.restore();

  // HP Bar above Titan
  if (t.alive) drawTitanHPBar(t, dx, dy, tw);
}

function drawTitanHPBar(t, dx, dy, tw) {
  const barW = tw + 20;
  const barH = 8;
  const bx = dx - 10;
  const by = dy - 46;
  // Background
  ctx.fillStyle = C.titanHpBg;
  ctx.fillRect(bx, by, barW, barH);
  // HP fill
  const fillW = (t.hp / t.maxHp) * barW;
  const hpColor = t.phase === 3 ? '#f00' : t.phase === 2 ? '#f80' : C.titanHpBar;
  ctx.fillStyle = hpColor;
  ctx.fillRect(bx, by, fillW, barH);
  // Border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, barW, barH);
  ctx.lineWidth = 1;
  // Label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TITAN', bx + barW/2, by - 4);
  ctx.textAlign = 'left';
}

function drawBoulders() {
  level.boulders.forEach(b => {
    if (!b.alive) return;
    const dx = b.x - cameraX;
    if (dx < -TILE || dx > W + TILE) return;

    ctx.save();
    ctx.translate(dx + b.w/2, b.y + b.h/2);
    ctx.rotate(b.spin);
    // Boulder body
    ctx.fillStyle = C.titanBoulder;
    ctx.beginPath();
    ctx.arc(0, 0, b.w/2, 0, Math.PI*2);
    ctx.fill();
    // Rock texture
    ctx.fillStyle = C.titanBoulderD;
    ctx.beginPath();
    ctx.arc(-4, -4, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, 3, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, b.w/2, 0, Math.PI*2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
  });
}

// ─── Powerup Update ───────────────────────────
function updatePowerups() {
  const solids = getAllSolids();
  level.powerups.forEach(pu => {
    if (pu.collected) return;
    pu.vy += GRAVITY * 0.6;
    resolveCollisions(pu, solids);

    if (pu.type === 'mushroom') {
      if (!pu.vx) pu.vx = 1.5;
    } else if (pu.type === 'star') {
      if (pu.onGround) pu.vy = -10;
    }

    if (rectOverlap(mario, pu)) {
      pu.collected = true;
      sfxPower();
      if (pu.type === 'mushroom') {
        if (mario.state === 'small') {
          mario.state = 'big';
          mario.h = 48;
          mario.y -= 16;
        }
        addScore(1000);
        spawnFloat(mario.x + mario.w/2, mario.y, '+1000', '#f0f');
      } else if (pu.type === 'star') {
        mario.state = 'star';
        mario.starTimer = 600;
        addScore(1000);
        spawnFloat(mario.x + mario.w/2, mario.y, 'STAR!', '#ff0');
      }
    }
  });
}

// ─── Coin Update ──────────────────────────────
function updateCoins() {
  level.coins.forEach(c => {
    if (c.collected) return;
    c.anim += 0.1;
    if (c.popping) {
      c.y += c.vy;
      c.vy += 0.5;
      if (c.vy > 0 && c.y > H) c.collected = true;
    }
    if (!c.popping && rectOverlap(mario, c)) {
      c.collected = true;
      sfxCoin();
      coins++;
      addScore(200);
      spawnFloat(c.x + c.w/2, c.y, '+200', C.coin);
    }
  });
}

// ─── Q-Block animation ────────────────────────
function updateQBlocks() {
  level.qblocks.forEach(q => {
    if (q.animDir !== 0) {
      q.animY += q.animDir * 3;
      if (q.animY <= -8) q.animDir = 1;
      if (q.animY >= 0) { q.animY = 0; q.animDir = 0; }
    }
  });
  level.bricks.forEach(b => {
    if (b.animY !== undefined && b.animY < 0) {
      b.animY += 2;
    }
  });
}

// ─── Win ──────────────────────────────────────
let winTimer = 0;
function triggerWin() {
  if (state === 'win') return;
  state = 'win';
  winTimer = 200;
  sfxWin();
  addScore(timer * 50);
  // Check if titan was defeated for bonus
  const t = level.titan;
  if (t && !t.alive) {
    addScore(10000);
    spawnFloat(mario.x + mario.w/2, mario.y - 40, 'TITAN BONUS +10000!', '#ff0');
  }
  spawnFloat(mario.x + mario.w/2, mario.y - 20, 'GOAL!', '#ff0');
  spawnParticles(mario.x + mario.w/2, mario.y, C.coin, 20);
}

function updateWin() {
  winTimer--;
  mario.x += 2;
  if (winTimer <= 0) {
    setOverlay('YOU WIN!', 'Press ENTER to play again');
    state = 'gameover'; // reuse for restart prompt
  }
}

// ─── Timer ────────────────────────────────────
function updateTimer() {
  timerTick++;
  if (timerTick >= 40) {
    timerTick = 0;
    timer = Math.max(0, timer - 1);
    document.getElementById('time').textContent = Math.ceil(timer);
    if (timer <= 0) killMario();
  }
}

// ─── Overlay ──────────────────────────────────
function setOverlay(title, msg) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').classList.remove('hidden');
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// ─── Drawing ─────────────────────────────────

function drawBackground() {
  // Sky
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // Clouds
  level.decorations.filter(d => d.type === 'cloud').forEach(d => {
    const dx = d.x - cameraX;
    if (dx < -200 || dx > W + 200) return;
    ctx.fillStyle = C.cloud;
    ctx.beginPath();
    ctx.ellipse(dx,        d.y,      d.w*0.4, 18, 0, 0, Math.PI*2);
    ctx.ellipse(dx+d.w*0.3, d.y-10,  d.w*0.3, 14, 0, 0, Math.PI*2);
    ctx.ellipse(dx+d.w*0.6, d.y,      d.w*0.35,16, 0, 0, Math.PI*2);
    ctx.fill();
  });

  // Mountains
  level.decorations.filter(d => d.type === 'mountain').forEach(d => {
    const dx = d.x - cameraX;
    if (dx < -200 || dx > W + 200) return;
    ctx.fillStyle = '#00a800';
    ctx.beginPath();
    ctx.moveTo(dx, d.y + 80);
    ctx.lineTo(dx + d.w/2, d.y);
    ctx.lineTo(dx + d.w, d.y + 80);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(dx + d.w/2, d.y);
    ctx.lineTo(dx + d.w*0.4, d.y + 20);
    ctx.lineTo(dx + d.w*0.6, d.y + 20);
    ctx.fill();
  });

  // Bushes
  level.decorations.filter(d => d.type === 'bush').forEach(d => {
    const dx = d.x - cameraX;
    if (dx < -100 || dx > W + 100) return;
    ctx.fillStyle = '#00a800';
    ctx.beginPath();
    ctx.ellipse(dx,        d.y, d.w*0.3, 15, 0, 0, Math.PI*2);
    ctx.ellipse(dx+d.w*0.35,d.y-6,d.w*0.25,12, 0, 0, Math.PI*2);
    ctx.ellipse(dx+d.w*0.65,d.y, d.w*0.28,14, 0, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawTile(x, y, type) {
  const dx = x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;

  if (type === 'ground') {
    // Top grass
    ctx.fillStyle = C.groundTop;
    ctx.fillRect(dx, y, TILE, 6);
    // Dirt body
    ctx.fillStyle = C.ground;
    ctx.fillRect(dx, y + 6, TILE, TILE - 6);
    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(dx, y, TILE, TILE);
  }
}

function drawBrick(b) {
  const dx = b.x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;
  const dy = b.y + (b.animY || 0);
  ctx.fillStyle = C.brick;
  ctx.fillRect(dx, dy, TILE, TILE);
  // Mortar lines
  ctx.fillStyle = '#a03800';
  ctx.fillRect(dx, dy + TILE/2 - 2, TILE, 3);
  ctx.fillRect(dx + TILE/2 - 2, dy, 3, TILE/2 - 2);
  ctx.fillRect(dx - 2, dy + TILE/2 + 1, TILE/2, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(dx, dy, TILE, TILE);
}

function drawQBlock(q) {
  const dx = q.x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;
  const dy = q.y + q.animY;
  ctx.fillStyle = q.hit ? C.qBlockHit : C.qBlock;
  ctx.fillRect(dx, dy, TILE, TILE);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(dx, dy, TILE, TILE);
  if (!q.hit) {
    // "?" mark
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', dx + TILE/2, dy + TILE - 8);
    ctx.textAlign = 'left';
  }
}

function drawPipe(p) {
  const dx = p.x - cameraX;
  if (dx < -TILE*2 || dx > W + TILE*2) return;
  // Body
  ctx.fillStyle = C.pipe;
  ctx.fillRect(dx + 4, p.y + TILE, p.w - 8, p.h - TILE);
  // Top cap
  ctx.fillStyle = C.pipe;
  ctx.fillRect(dx, p.y, p.w, TILE);
  // Highlights
  ctx.fillStyle = C.pipeDark;
  ctx.fillRect(dx + p.w/2, p.y + TILE, 8, p.h - TILE);
  ctx.fillRect(dx + p.w/2, p.y, 8, TILE);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(dx, p.y, p.w, TILE);
  ctx.strokeRect(dx + 4, p.y + TILE, p.w - 8, p.h - TILE);
}

function drawCoin(c) {
  if (c.collected) return;
  const dx = c.x + Math.sin(c.anim) * 2 - cameraX;
  const dy = c.y;
  // Coin body
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.ellipse(dx + 8, dy + 10, 7 * Math.abs(Math.cos(c.anim * 2)) + 1, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath();
  ctx.ellipse(dx + 8, dy + 10, 4 * Math.abs(Math.cos(c.anim * 2)) + 0.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(e) {
  if (!e.alive && !e.stomped) return;
  const dx = e.x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;

  if (e.stomped) {
    // Flat goomba
    ctx.fillStyle = C.goomba;
    ctx.fillRect(dx, e.y + e.h - 12, e.w, 12);
    ctx.fillStyle = C.goombaDark;
    ctx.fillRect(dx, e.y + e.h - 12, e.w, 4);
    return;
  }

  const t = Date.now() / 300;
  const legOff = Math.sin(t * Math.PI) * 4;

  // Body
  ctx.fillStyle = C.goomba;
  ctx.beginPath();
  ctx.ellipse(dx + e.w/2, e.y + e.h - 12, e.w/2, e.h/2 - 2, 0, 0, Math.PI*2);
  ctx.fill();
  // Head
  ctx.fillStyle = C.goomba;
  ctx.beginPath();
  ctx.ellipse(dx + e.w/2, e.y + 10, 13, 12, 0, 0, Math.PI*2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(dx + e.w/2 - 5, e.y + 8, 4, 4, 0, 0, Math.PI*2);
  ctx.ellipse(dx + e.w/2 + 5, e.y + 8, 4, 4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(dx + e.w/2 - 5, e.y + 9, 2, 2, 0, 0, Math.PI*2);
  ctx.ellipse(dx + e.w/2 + 5, e.y + 9, 2, 2, 0, 0, Math.PI*2);
  ctx.fill();
  // Eyebrows
  ctx.strokeStyle = C.goombaDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dx + e.w/2 - 8, e.y + 5); ctx.lineTo(dx + e.w/2 - 2, e.y + 7);
  ctx.moveTo(dx + e.w/2 + 8, e.y + 5); ctx.lineTo(dx + e.w/2 + 2, e.y + 7);
  ctx.stroke();
  ctx.lineWidth = 1;
  // Feet
  ctx.fillStyle = C.goombaDark;
  ctx.beginPath();
  ctx.ellipse(dx + 6,        e.y + e.h - 4, 8, 5, 0, 0, Math.PI*2);
  ctx.ellipse(dx + e.w - 6,  e.y + e.h - 4, 8, 5, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawPowerup(pu) {
  if (pu.collected) return;
  const dx = pu.x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;
  if (pu.type === 'mushroom') {
    // Stem
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx + 6, pu.y + 14, 20, 18);
    // Cap
    ctx.fillStyle = C.mushRed;
    ctx.beginPath();
    ctx.ellipse(dx + 16, pu.y + 14, 16, 12, 0, 0, Math.PI*2);
    ctx.fill();
    // Dots
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(dx + 10, pu.y + 11, 4, 4, 0, 0, Math.PI*2);
    ctx.ellipse(dx + 22, pu.y + 11, 4, 4, 0, 0, Math.PI*2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(dx + 10, pu.y + 22, 4, 5);
    ctx.fillRect(dx + 18, pu.y + 22, 4, 5);
  } else if (pu.type === 'star') {
    const t = Date.now() / 200;
    ctx.save();
    ctx.translate(dx + TILE/2, pu.y + TILE/2);
    ctx.rotate(t);
    ctx.fillStyle = `hsl(${(t*180)%360},100%,60%)`;
    drawStar(ctx, 0, 0, 5, 16, 7);
    ctx.fill();
    ctx.restore();
  }
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
  }
  ctx.lineTo(cx, cy - outer);
  ctx.closePath();
}

function drawFlag() {
  const f = level.flag;
  if (!f) return;
  const dx = f.x - cameraX;
  if (dx < -TILE || dx > W + TILE) return;

  // Pole
  ctx.fillStyle = '#888';
  ctx.fillRect(dx + 6, f.y, 6, f.poleH);
  // Base
  ctx.fillStyle = '#aaa';
  ctx.fillRect(dx - 4, f.y + f.poleH - 4, 22, 8);

  // Flag
  const flagY = f.y + f.flagY;
  ctx.fillStyle = '#00a800';
  ctx.beginPath();
  ctx.moveTo(dx + 12, flagY);
  ctx.lineTo(dx + 12 + 36, flagY + 14);
  ctx.lineTo(dx + 12, flagY + 28);
  ctx.fill();
}

function drawMario() {
  if (mario.dead && mario.vy < 0) {
    // Briefly show before falling
  }

  const dx = mario.x - cameraX;
  const dy = mario.y;
  const big = mario.state !== 'small';

  // Blink when invincible
  if (mario.invincible > 0 && Math.floor(mario.invincible / 4) % 2 === 0) return;

  ctx.save();
  if (mario.facing === -1) {
    ctx.translate(dx + mario.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + mario.w / 2), 0);
  }

  // Star rainbow
  if (mario.state === 'star') {
    ctx.shadowColor = `hsl(${(Date.now()/20)%360},100%,60%)`;
    ctx.shadowBlur = 12;
  }

  const bx = dx;
  const by = dy;
  const bw = mario.w;
  const bh = mario.h;

  if (!big) {
    // Small Mario
    // Hat
    ctx.fillStyle = C.marioRed;
    ctx.fillRect(bx + 4, by, bw - 8, 10);
    ctx.fillRect(bx, by + 5, bw - 4, 6);
    // Face
    ctx.fillStyle = C.marioSkin;
    ctx.fillRect(bx + 4, by + 10, bw - 8, 10);
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(bx + bw - 10, by + 12, 4, 4);
    // Mustache
    ctx.fillStyle = C.marioBrown;
    ctx.fillRect(bx + 6, by + 17, bw - 8, 3);
    // Body
    ctx.fillStyle = C.marioBlue;
    ctx.fillRect(bx + 2, by + 20, bw - 4, 12);
    ctx.fillStyle = C.marioRed;
    ctx.fillRect(bx + 6, by + 20, bw - 12, 12);
    // Feet
    ctx.fillStyle = C.marioBrown;
    const walkOff = mario.onGround ? Math.sin(mario.animFrame * 2) * 3 : 0;
    ctx.fillRect(bx,        by + 28, 12, 4 - walkOff);
    ctx.fillRect(bx + bw - 12, by + 28, 12, 4 + walkOff);
  } else {
    // Big Mario
    // Hat
    ctx.fillStyle = C.marioRed;
    ctx.fillRect(bx + 4, by, bw - 8, 14);
    ctx.fillRect(bx, by + 8, bw - 4, 8);
    // Face
    ctx.fillStyle = C.marioSkin;
    ctx.fillRect(bx + 4, by + 14, bw - 8, 14);
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(bx + bw - 10, by + 18, 5, 5);
    // Mustache
    ctx.fillStyle = C.marioBrown;
    ctx.fillRect(bx + 4, by + 25, bw - 6, 3);
    // Overalls
    ctx.fillStyle = C.marioBlue;
    ctx.fillRect(bx + 2, by + 28, bw - 4, 20);
    ctx.fillStyle = C.marioRed;
    ctx.fillRect(bx + 6, by + 28, bw - 12, 20);
    // Buttons
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx + 5, by + 30, 3, 3);
    ctx.fillRect(bx + bw - 8, by + 30, 3, 3);
    // Feet
    ctx.fillStyle = C.marioBrown;
    const walkOff2 = mario.onGround ? Math.sin(mario.animFrame * 2) * 4 : 0;
    ctx.fillRect(bx,          by + bh - 8, 14, 8 - walkOff2);
    ctx.fillRect(bx + bw - 14, by + bh - 8, 14, 8 + walkOff2);
  }

  ctx.restore();
}

// ─── Main Draw ───────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  // Ground & platforms
  level.platforms.forEach(p => drawTile(p.x, p.y, p.type));

  // Bricks
  level.bricks.forEach(b => { if (!b.broken) drawBrick(b); });

  // Pipes
  level.pipes.forEach(p => drawPipe(p));

  // Q-Blocks
  level.qblocks.forEach(q => drawQBlock(q));

  // Coins
  level.coins.forEach(c => drawCoin(c));

  // Powerups
  level.powerups.forEach(p => drawPowerup(p));

  // Enemies
  level.enemies.forEach(e => drawEnemy(e));

  // Titan Boss
  drawTitan();
  drawBoulders();

  // Flag
  drawFlag();

  // Mario
  drawMario();

  // FX
  drawParticles(cameraX);
  drawFloats(cameraX);
}

// ─── Main Loop ───────────────────────────────
let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;

  if (state === 'playing') {
    updateTimer();
    updateMario(dt);
    updateEnemies();
    updateTitan();
    updateBoulders();
    updatePowerups();
    updateCoins();
    updateQBlocks();
    updateParticles();
    updateFloats();
    updateCamera();
    draw();
  } else if (state === 'win') {
    updateTitan();
    updateBoulders();
    updateWin();
    updateParticles();
    updateFloats();
    updateCamera();
    draw();
  } else if (state === 'dead') {
    updateMario(dt);
    draw();
  } else {
    draw();
  }

  // Clear justPressed
  for (const k in justPressed) delete justPressed[k];

  requestAnimationFrame(loop);
}

// ─── Start / Pause / Restart ──────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (state === 'title' || state === 'gameover') startGame();
  }
  if (e.code === 'KeyP' && state === 'playing') {
    state = 'paused';
    setOverlay('PAUSED', 'Press P to resume');
  } else if (e.code === 'KeyP' && state === 'paused') {
    state = 'playing';
    hideOverlay();
  }
});

canvas.addEventListener('click', () => {
  initAudio();
  if (state === 'title' || state === 'gameover') startGame();
  else if (state === 'paused') {
    state = 'playing';
    hideOverlay();
  }
});

function startGame() {
  initAudio();
  score = 0;
  coins = 0;
  lives = 3;
  timer = 400;
  timerTick = 0;
  particles.length = 0;
  floats.length = 0;
  mario = createMario();
  level = buildLevel();
  cameraX = 0;
  updateHUD();
  hideOverlay();
  state = 'playing';
}

// ─── Init ─────────────────────────────────────
updateHUD();
setOverlay('SUPER MARIO', 'Press ENTER or Click to Start');
requestAnimationFrame(loop);
