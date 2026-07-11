const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  coins: document.getElementById("coins"),
  distance: document.getElementById("distance"),
  level: document.getElementById("level"),
  mission: document.getElementById("mission"),
  boostBar: document.getElementById("boostBar"),
  powerStatus: document.getElementById("powerStatus"),
  startScreen: document.getElementById("startScreen"),
  pauseScreen: document.getElementById("pauseScreen"),
  gameOverScreen: document.getElementById("gameOverScreen"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverText: document.getElementById("gameOverText"),
  startBtn: document.getElementById("startBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  soundBtn: document.getElementById("soundBtn")
};

const W = canvas.width;
const H = canvas.height;

const laneX = [315, 450, 585];
const controls = {
  left: false,
  right: false,
  jump: false,
  slide: false,
  boost: false
};

const missions = [
  { text: "Collect 15 coins", type: "coins", target: 15 },
  { text: "Travel 700 metres", type: "distance", target: 700 },
  { text: "Use 3 power-ups", type: "powers", target: 3 },
  { text: "Reach level 4", type: "level", target: 4 }
];

const themes = [
  { skyTop: "#7ed6df", skyBottom: "#dff9fb", city: "#52606d", road: "#2d3542", glow: "#ef5da8" },
  { skyTop: "#f6b26b", skyBottom: "#ffe8c6", city: "#6f5e68", road: "#3a3137", glow: "#ff8b5e" },
  { skyTop: "#6c7bd9", skyBottom: "#b8c1ff", city: "#343a5c", road: "#252a42", glow: "#8ff4e8" },
  { skyTop: "#171d3a", skyBottom: "#3c315f", city: "#101628", road: "#181d2d", glow: "#ed64a6" }
];

let player;
let obstacles = [];
let coins = [];
let powerUps = [];
let particles = [];
let buildings = [];

let score = 0;
let best = Number(localStorage.getItem("neonDashBest")) || 0;
let collectedCoins = 0;
let distance = 0;
let level = 1;
let energy = 100;
let missionIndex = 0;
let powerUses = 0;

let running = false;
let paused = false;
let soundOn = true;
let frame = 0;
let worldSpeed = 7;
let animationId = null;
let lastTime = 0;
let invincibleUntil = 0;
let magnetUntil = 0;
let shieldUntil = 0;
let doubleScoreUntil = 0;
let audioContext = null;

ui.best.textContent = best;

function createPlayer() {
  return {
    lane: 1,
    x: laneX[1],
    targetX: laneX[1],
    y: H - 115,
    baseY: H - 115,
    width: 46,
    height: 76,
    vy: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    boardTilt: 0
  };
}

function startGame() {
  cancelAnimationFrame(animationId);

  player = createPlayer();
  obstacles = [];
  coins = [];
  powerUps = [];
  particles = [];
  buildings = createBuildings();

  score = 0;
  collectedCoins = 0;
  distance = 0;
  level = 1;
  energy = 100;
  missionIndex = 0;
  powerUses = 0;
  frame = 0;
  worldSpeed = 7;

  invincibleUntil = 0;
  magnetUntil = 0;
  shieldUntil = 0;
  doubleScoreUntil = 0;

  running = true;
  paused = false;
  lastTime = performance.now();

  ui.startScreen.classList.remove("active");
  ui.pauseScreen.classList.remove("active");
  ui.gameOverScreen.classList.remove("active");
  ui.pauseBtn.textContent = "⏸ Pause";

  updateUI();
  playSound("start");
  animationId = requestAnimationFrame(loop);
}

function loop(time) {
  if (!running) return;

  const dt = Math.min((time - lastTime) / 16.67, 2);
  lastTime = time;

  if (!paused) {
    update(dt, time);
    draw(time);
  }

  animationId = requestAnimationFrame(loop);
}

function update(dt, time) {
  frame += dt;

  worldSpeed = 7 + Math.min(10, distance / 450);
  const boosting = controls.boost && energy > 0;

  if (boosting) {
    worldSpeed += 5;
    energy = Math.max(0, energy - .8 * dt);
  } else {
    energy = Math.min(100, energy + .16 * dt);
  }

  updatePlayer(dt);
  updateObstacles(dt, time);
  updateCoins(dt, time);
  updatePowerUps(dt, time);
  updateParticles(dt);
  updateBuildings(dt);

  if (frame % Math.max(42, 88 - level * 6) < 1.5) spawnObstacle();
  if (frame % 58 < 1.5) spawnCoinLine();
  if (frame % 420 < 1.5) spawnPowerUp();

  const scoreMultiplier = time < doubleScoreUntil ? 2 : 1;
  distance += worldSpeed * .55 * dt;
  score += worldSpeed * .18 * dt * scoreMultiplier;

  level = Math.min(10, 1 + Math.floor(distance / 450));

  checkMission();
  updateBest();
  updateUI(time);
}

function updatePlayer(dt) {
  if (controls.left) {
    moveLane(-1);
    controls.left = false;
  }

  if (controls.right) {
    moveLane(1);
    controls.right = false;
  }

  if (controls.jump && !player.jumping && !player.sliding) {
    player.jumping = true;
    player.vy = -15.5;
    controls.jump = false;
    playSound("jump");
  }

  if (controls.slide && !player.jumping && !player.sliding) {
    player.sliding = true;
    player.slideTimer = 42;
    controls.slide = false;
    playSound("slide");
  }

  player.x += (player.targetX - player.x) * .24 * dt;

  if (player.jumping) {
    player.y += player.vy * dt;
    player.vy += .78 * dt;

    if (player.y >= player.baseY) {
      player.y = player.baseY;
      player.vy = 0;
      player.jumping = false;
    }
  }

  if (player.sliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) {
      player.sliding = false;
    }
  }

  player.boardTilt = (player.targetX - player.x) * .006;
}

function moveLane(direction) {
  player.lane = Math.max(0, Math.min(2, player.lane + direction));
  player.targetX = laneX[player.lane];
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const types = [
    { type: "barrier", width: 62, height: 52 },
    { type: "gate", width: 78, height: 96 },
    { type: "drone", width: 58, height: 48 }
  ];

  const choice = types[Math.floor(Math.random() * types.length)];

  obstacles.push({
    lane,
    x: laneX[lane],
    y: -100,
    width: choice.width,
    height: choice.height,
    type: choice.type,
    passed: false
  });
}

function updateObstacles(dt, time) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const item = obstacles[i];
    item.y += worldSpeed * dt;

    const playerBox = getPlayerBox();
    const obstacleBox = {
      x: item.x - item.width / 2,
      y: item.y,
      width: item.width,
      height: item.height
    };

    if (rectHit(playerBox, obstacleBox) && time > invincibleUntil) {
      const avoidedByJump = item.type === "barrier" && player.jumping && player.y < player.baseY - 45;
      const avoidedBySlide = item.type === "gate" && player.sliding;
      const avoidedDrone = item.type === "drone" && player.sliding;

      if (!avoidedByJump && !avoidedBySlide && !avoidedDrone) {
        if (time < shieldUntil) {
          shieldUntil = 0;
          createParticles(player.x, player.y, "#62f5d2", 24);
          playSound("shield");
          obstacles.splice(i, 1);
          continue;
        }

        createParticles(player.x, player.y, "#ff6b6b", 30);
        playSound("hit");
        endGame();
        return;
      }
    }

    if (!item.passed && item.y > player.baseY + 80) {
      item.passed = true;
      score += 25;
    }

    if (item.y > H + 120) obstacles.splice(i, 1);
  }
}

function spawnCoinLine() {
  const lane = Math.floor(Math.random() * 3);
  const count = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i++) {
    coins.push({
      lane,
      x: laneX[lane],
      y: -40 - i * 55,
      width: 26,
      height: 26,
      pulse: Math.random() * Math.PI * 2
    });
  }
}

function updateCoins(dt, time) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    coin.y += worldSpeed * dt;
    coin.pulse += .12 * dt;

    if (time < magnetUntil) {
      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      const distanceToPlayer = Math.hypot(dx, dy);

      if (distanceToPlayer < 220) {
        coin.x += dx * .08 * dt;
        coin.y += dy * .08 * dt;
      }
    }

    const coinBox = {
      x: coin.x - 13,
      y: coin.y - 13,
      width: 26,
      height: 26
    };

    if (rectHit(getPlayerBox(), coinBox)) {
      collectedCoins++;
      score += time < doubleScoreUntil ? 200 : 100;
      energy = Math.min(100, energy + 5);
      createParticles(coin.x, coin.y, "#ffe15d", 14);
      playSound("coin");
      coins.splice(i, 1);
      continue;
    }

    if (coin.y > H + 40) coins.splice(i, 1);
  }
}

function spawnPowerUp() {
  const types = ["shield", "magnet", "double"];
  const lane = Math.floor(Math.random() * 3);
  const type = types[Math.floor(Math.random() * types.length)];

  powerUps.push({
    lane,
    type,
    x: laneX[lane],
    y: -60,
    width: 38,
    height: 38,
    pulse: 0
  });
}

function updatePowerUps(dt, time) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const power = powerUps[i];
    power.y += worldSpeed * dt;
    power.pulse += .1 * dt;

    const box = {
      x: power.x - 19,
      y: power.y - 19,
      width: 38,
      height: 38
    };

    if (rectHit(getPlayerBox(), box)) {
      activatePower(power.type, time);
      createParticles(power.x, power.y, "#8ff4e8", 20);
      playSound("power");
      powerUps.splice(i, 1);
      continue;
    }

    if (power.y > H + 50) powerUps.splice(i, 1);
  }
}

function activatePower(type, time) {
  powerUses++;

  if (type === "shield") shieldUntil = time + 7000;
  if (type === "magnet") magnetUntil = time + 7000;
  if (type === "double") doubleScoreUntil = time + 7000;
}

function getPlayerBox() {
  const width = player.sliding ? 62 : 42;
  const height = player.sliding ? 34 : 70;
  const y = player.sliding ? player.y + 34 : player.y;

  return {
    x: player.x - width / 2,
    y,
    width,
    height
  };
}

function rectHit(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function checkMission() {
  const mission = missions[Math.min(missionIndex, missions.length - 1)];
  let complete = false;

  if (mission.type === "coins") complete = collectedCoins >= mission.target;
  if (mission.type === "distance") complete = distance >= mission.target;
  if (mission.type === "powers") complete = powerUses >= mission.target;
  if (mission.type === "level") complete = level >= mission.target;

  if (complete && missionIndex < missions.length - 1) {
    missionIndex++;
    score += 500;
    playSound("mission");
  }
}

function createBuildings() {
  const items = [];
  for (let i = 0; i < 14; i++) {
    items.push({
      x: i * 78 - 40,
      width: 46 + Math.random() * 55,
      height: 100 + Math.random() * 220,
      windows: 3 + Math.floor(Math.random() * 4)
    });
  }
  return items;
}

function updateBuildings(dt) {
  const drift = worldSpeed * .08 * dt;
  buildings.forEach(building => {
    building.x -= drift;
    if (building.x + building.width < 0) {
      building.x = W + Math.random() * 80;
      building.height = 100 + Math.random() * 220;
    }
  });
}

function createParticles(x, y, colour, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - .5) * 7,
      vy: (Math.random() - .5) * 7,
      life: 1,
      size: Math.random() * 4 + 2,
      colour
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= .035 * dt;

    if (p.life <= 0) particles.splice(i, 1);
  }
}

function draw(time) {
  drawSky();
  drawCity();
  drawSkyway();
  drawLaneLights();
  drawCoins();
  drawPowerUps();
  drawObstacles();
  drawPlayer(time);
  drawParticles();
}

function drawSky() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 3))];
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 18; i++) {
    const x = (i * 83 + frame * .08) % W;
    const y = 30 + (i * 47) % 170;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCity() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 3))];

  buildings.forEach(building => {
    ctx.fillStyle = theme.city;
    ctx.fillRect(building.x, H - 250 - building.height * .2, building.width, building.height);

    ctx.fillStyle = "rgba(255,230,140,.62)";
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < building.windows; c++) {
        const wx = building.x + 8 + c * 12;
        const wy = H - 230 - building.height * .2 + r * 18;
        ctx.fillRect(wx, wy, 5, 8);
      }
    }
  });
}

function drawSkyway() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 3))];

  ctx.fillStyle = theme.road;
  ctx.beginPath();
  ctx.moveTo(210, H);
  ctx.lineTo(340, 0);
  ctx.lineTo(560, 0);
  ctx.lineTo(690, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#171c26";
  ctx.beginPath();
  ctx.moveTo(190, H);
  ctx.lineTo(325, 0);
  ctx.lineTo(340, 0);
  ctx.lineTo(210, H);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(690, H);
  ctx.lineTo(560, 0);
  ctx.lineTo(575, 0);
  ctx.lineTo(710, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 4;

  for (let lane = 1; lane <= 2; lane++) {
    const bottomX = 210 + lane * 160;
    const topX = 340 + lane * 73;

    for (let y = -40 + (frame * worldSpeed) % 80; y < H + 80; y += 80) {
      const t = y / H;
      const x = topX + (bottomX - topX) * t;
      const h = 24 + t * 32;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
  }
}

function drawLaneLights() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 3))];

  for (let y = -20 + (frame * worldSpeed * 1.2) % 55; y < H + 50; y += 55) {
    const t = y / H;
    const left = 330 - 115 * t;
    const right = 570 + 115 * t;

    ctx.fillStyle = theme.glow;
    ctx.beginPath();
    ctx.arc(left, y, 3 + t * 3, 0, Math.PI * 2);
    ctx.arc(right, y, 3 + t * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(time) {
  if (time < invincibleUntil && Math.floor(time / 100) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y + 36);
  ctx.rotate(player.boardTilt);

  if (time < shieldUntil) {
    ctx.strokeStyle = "#6af1d4";
    ctx.lineWidth = 4;
    ctx.fillStyle = "rgba(106,241,212,.14)";
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (controls.boost && energy > 0) {
    ctx.fillStyle = "#54e4ff";
    ctx.beginPath();
    ctx.moveTo(-12, 35);
    ctx.lineTo(-3, 67 + Math.random() * 10);
    ctx.lineTo(5, 35);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 35);
    ctx.lineTo(16, 67 + Math.random() * 10);
    ctx.lineTo(24, 35);
    ctx.fill();
  }

  ctx.fillStyle = "#1d2432";
  ctx.beginPath();
  ctx.roundRect(-32, 30, 64, 12, 6);
  ctx.fill();

  ctx.fillStyle = "#ef5d8d";
  ctx.beginPath();
  ctx.roundRect(-26, 32, 52, 7, 4);
  ctx.fill();

  if (player.sliding) {
    ctx.fillStyle = "#f5b49d";
    ctx.beginPath();
    ctx.arc(-8, 6, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#242c3b";
    ctx.beginPath();
    ctx.roundRect(-5, -2, 44, 18, 8);
    ctx.fill();

    ctx.fillStyle = "#55c7b5";
    ctx.beginPath();
    ctx.roundRect(20, 0, 25, 10, 5);
    ctx.fill();
  } else {
    ctx.fillStyle = "#242c3b";
    ctx.beginPath();
    ctx.roundRect(-17, -14, 34, 43, 10);
    ctx.fill();

    ctx.fillStyle = "#55c7b5";
    ctx.beginPath();
    ctx.roundRect(-15, -11, 30, 20, 8);
    ctx.fill();

    ctx.fillStyle = "#f5b49d";
    ctx.beginPath();
    ctx.arc(0, -28, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(0, -32, 13, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#242c3b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-9, 24);
    ctx.lineTo(-15, 38);
    ctx.moveTo(9, 24);
    ctx.lineTo(15, 38);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacles() {
  obstacles.forEach(item => {
    ctx.save();
    ctx.translate(item.x, item.y + item.height / 2);

    if (item.type === "barrier") {
      ctx.fillStyle = "#f6b73c";
      ctx.beginPath();
      ctx.roundRect(-31, -26, 62, 52, 8);
      ctx.fill();

      ctx.fillStyle = "#2d3542";
      for (let i = -25; i < 25; i += 18) {
        ctx.save();
        ctx.translate(i, 0);
        ctx.rotate(-.55);
        ctx.fillRect(-5, -28, 10, 56);
        ctx.restore();
      }
    }

    if (item.type === "gate") {
      ctx.strokeStyle = "#63e5cc";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-34, 44);
      ctx.lineTo(-34, -40);
      ctx.lineTo(34, -40);
      ctx.lineTo(34, 44);
      ctx.stroke();

      ctx.fillStyle = "#1b2230";
      ctx.fillRect(-32, -38, 64, 26);
    }

    if (item.type === "drone") {
      ctx.fillStyle = "#5a67d8";
      ctx.beginPath();
      ctx.roundRect(-29, -16, 58, 32, 12);
      ctx.fill();

      ctx.fillStyle = "#f4a8c1";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#2c3250";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-28, -8);
      ctx.lineTo(-42, -20);
      ctx.moveTo(28, -8);
      ctx.lineTo(42, -20);
      ctx.stroke();
    }

    ctx.restore();
  });
}

function drawCoins() {
  coins.forEach(coin => {
    const scale = 1 + Math.sin(coin.pulse) * .12;

    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffe25e";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff6bd";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#ae7b00";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, 1);

    ctx.restore();
  });
}

function drawPowerUps() {
  const icons = {
    shield: "🛡️",
    magnet: "🧲",
    double: "✦"
  };

  powerUps.forEach(power => {
    const scale = 1 + Math.sin(power.pulse) * .1;

    ctx.save();
    ctx.translate(power.x, power.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(255,255,255,.24)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icons[power.type], 0, 0);

    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function updateUI(time = performance.now()) {
  ui.score.textContent = Math.floor(score);
  ui.best.textContent = best;
  ui.coins.textContent = collectedCoins;
  ui.distance.textContent = Math.floor(distance);
  ui.level.textContent = level;
  ui.boostBar.style.width = `${energy}%`;

  const mission = missions[Math.min(missionIndex, missions.length - 1)];
  ui.mission.textContent = mission.text;

  const active = [];

  if (time < shieldUntil) active.push(`🛡️ Shield ${Math.ceil((shieldUntil - time) / 1000)}s`);
  if (time < magnetUntil) active.push(`🧲 Magnet ${Math.ceil((magnetUntil - time) / 1000)}s`);
  if (time < doubleScoreUntil) active.push(`✦ Double Score ${Math.ceil((doubleScoreUntil - time) / 1000)}s`);

  ui.powerStatus.innerHTML = active
    .map(item => `<div class="power-pill">${item}</div>`)
    .join("");
}

function updateBest() {
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem("neonDashBest", best);
  }
}

function togglePause() {
  if (!running) return;

  paused = !paused;
  ui.pauseScreen.classList.toggle("active", paused);
  ui.pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
}

function endGame() {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);
  updateBest();

  ui.gameOverTitle.textContent = level >= 6 ? "Skyway Champion!" : "Strong Run!";
  ui.gameOverText.textContent =
    `Score: ${Math.floor(score)} • Coins: ${collectedCoins} • Distance: ${Math.floor(distance)} m`;

  ui.gameOverScreen.classList.add("active");
  playSound("gameover");
}

function playSound(type) {
  if (!soundOn) return;

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const sounds = {
    start: [330, .14, "sine"],
    jump: [520, .09, "triangle"],
    slide: [190, .08, "sine"],
    coin: [820, .08, "sine"],
    power: [680, .15, "triangle"],
    shield: [450, .12, "sine"],
    hit: [120, .25, "sawtooth"],
    mission: [720, .22, "triangle"],
    gameover: [90, .4, "sawtooth"]
  };

  const [frequency, duration, wave] = sounds[type] || [440, .1, "sine"];
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = wave;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "a"].includes(key)) controls.left = true;
  if (["arrowright", "d"].includes(key)) controls.right = true;
  if (["arrowup", "w"].includes(key)) controls.jump = true;
  if (["arrowdown", "s"].includes(key)) controls.slide = true;
  if (key === " ") controls.boost = true;
  if (key === "p" || key === "escape") togglePause();

  if (["arrowleft","arrowright","arrowup","arrowdown"," "].includes(key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();
  if (key === " ") controls.boost = false;
});

document.querySelectorAll(".mobile-controls button").forEach(button => {
  const action = button.dataset.action;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    controls[action] = true;
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(type => {
    button.addEventListener(type, () => {
      if (action === "boost") controls[action] = false;
    });
  });
});

ui.startBtn.addEventListener("click", startGame);
ui.restartBtn.addEventListener("click", startGame);
ui.resetBtn.addEventListener("click", startGame);
ui.pauseBtn.addEventListener("click", togglePause);
ui.resumeBtn.addEventListener("click", togglePause);

ui.soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  ui.soundBtn.textContent = soundOn ? "🔊 Sound" : "🔇 Muted";
  if (soundOn) playSound("coin");
});

function drawPreview() {
  player = createPlayer();
  buildings = createBuildings();
  drawSky();
  drawCity();
  drawSkyway();
  drawLaneLights();
  drawPlayer(performance.now());
}

drawPreview();
updateUI();
