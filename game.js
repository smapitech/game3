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
  boostText: document.getElementById("boostText"),
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

const laneX = [340, 480, 620];

const controls = {
  left: false,
  right: false,
  jump: false,
  slide: false,
  boost: false
};

const missions = [
  { text: "Collect 12 coins", type: "coins", target: 12 },
  { text: "Travel 500 metres", type: "distance", target: 500 },
  { text: "Use 2 power-ups", type: "powers", target: 2 },
  { text: "Reach level 4", type: "level", target: 4 }
];

const themes = [
  { skyTop: "#94c9d7", skyBottom: "#e9f1f4", city: "#53616d", road: "#303844", glow: "#dc5e87" },
  { skyTop: "#eab47c", skyBottom: "#f7e4cf", city: "#76636b", road: "#3c343a", glow: "#ef8b68" },
  { skyTop: "#6f7dc8", skyBottom: "#c2c8ec", city: "#3a4165", road: "#272c46", glow: "#72dfce" },
  { skyTop: "#202642", skyBottom: "#49406b", city: "#171d31", road: "#1c2233", glow: "#e46f9d" }
];

let player;
let obstacles = [];
let coins = [];
let powerUps = [];
let particles = [];
let buildings = [];

let score = 0;
let best = Number(localStorage.getItem("neonDashBestV2")) || 0;
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
let worldSpeed = 4.2;
let animationId = null;
let lastTime = 0;
let shieldUntil = 0;
let magnetUntil = 0;
let doubleScoreUntil = 0;
let audioContext = null;

ui.best.textContent = best;

function createPlayer() {
  return {
    lane: 1,
    x: laneX[1],
    targetX: laneX[1],
    y: H - 125,
    baseY: H - 125,
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
  worldSpeed = 4.2;

  shieldUntil = 0;
  magnetUntil = 0;
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

  const dt = Math.min((time - lastTime) / 16.67, 1.5);
  lastTime = time;

  if (!paused) {
    update(dt, time);
    draw(time);
  }

  animationId = requestAnimationFrame(loop);
}

function update(dt, time) {
  frame += dt;

  const gentleProgression = Math.min(4.2, distance / 900);
  worldSpeed = 4.2 + gentleProgression;

  const boosting = controls.boost && energy > 0;
  if (boosting) {
    worldSpeed += 2.6;
    energy = Math.max(0, energy - .5 * dt);
  } else {
    energy = Math.min(100, energy + .18 * dt);
  }

  updatePlayer(dt);
  updateObstacles(dt, time);
  updateCoins(dt, time);
  updatePowerUps(dt, time);
  updateParticles(dt);
  updateBuildings(dt);

  const obstacleGap = Math.max(82, 150 - level * 8);
  if (frame % obstacleGap < 1.2) spawnObstacle();

  if (frame % 88 < 1.2) spawnCoinLine();
  if (frame % 520 < 1.2) spawnPowerUp();

  const multiplier = time < doubleScoreUntil ? 2 : 1;
  distance += worldSpeed * .35 * dt;
  score += worldSpeed * .12 * dt * multiplier;

  level = Math.min(8, 1 + Math.floor(distance / 650));

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
    player.vy = -13.2;
    controls.jump = false;
    playSound("jump");
  }

  if (controls.slide && !player.jumping && !player.sliding) {
    player.sliding = true;
    player.slideTimer = 52;
    controls.slide = false;
    playSound("slide");
  }

  player.x += (player.targetX - player.x) * .16 * dt;

  if (player.jumping) {
    player.y += player.vy * dt;
    player.vy += .58 * dt;

    if (player.y >= player.baseY) {
      player.y = player.baseY;
      player.vy = 0;
      player.jumping = false;
    }
  }

  if (player.sliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.sliding = false;
  }

  player.boardTilt += ((player.targetX - player.x) * .0035 - player.boardTilt) * .18;
}

function moveLane(direction) {
  player.lane = Math.max(0, Math.min(2, player.lane + direction));
  player.targetX = laneX[player.lane];
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const roll = Math.random();

  let choice;
  if (roll < .46) choice = { type: "barrier", width: 64, height: 48 };
  else if (roll < .78) choice = { type: "gate", width: 82, height: 100 };
  else choice = { type: "drone", width: 58, height: 42 };

  const sameLaneTooClose = obstacles.some(item => item.lane === lane && item.y < 120);
  if (sameLaneTooClose) return;

  obstacles.push({
    lane,
    x: laneX[lane],
    y: -120,
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

    if (rectHit(playerBox, obstacleBox)) {
      const safeJump = item.type === "barrier" && player.jumping && player.y < player.baseY - 34;
      const safeSlide = (item.type === "gate" || item.type === "drone") && player.sliding;

      if (!safeJump && !safeSlide) {
        if (time < shieldUntil) {
          shieldUntil = 0;
          createParticles(player.x, player.y, "#67e0ca", 24);
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

    if (!item.passed && item.y > player.baseY + 85) {
      item.passed = true;
      score += 20;
    }

    if (item.y > H + 130) obstacles.splice(i, 1);
  }
}

function spawnCoinLine() {
  const lane = Math.floor(Math.random() * 3);
  const count = 4 + Math.floor(Math.random() * 2);

  for (let i = 0; i < count; i++) {
    coins.push({
      lane,
      x: laneX[lane],
      y: -50 - i * 62,
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
    coin.pulse += .1 * dt;

    if (time < magnetUntil) {
      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      const d = Math.hypot(dx, dy);

      if (d < 210) {
        coin.x += dx * .06 * dt;
        coin.y += dy * .06 * dt;
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
      score += time < doubleScoreUntil ? 160 : 80;
      energy = Math.min(100, energy + 4);
      createParticles(coin.x, coin.y, "#ffe16a", 14);
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

  powerUps.push({
    lane,
    type: types[Math.floor(Math.random() * types.length)],
    x: laneX[lane],
    y: -70,
    width: 38,
    height: 38,
    pulse: 0
  });
}

function updatePowerUps(dt, time) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const power = powerUps[i];
    power.y += worldSpeed * dt;
    power.pulse += .08 * dt;

    const box = {
      x: power.x - 19,
      y: power.y - 19,
      width: 38,
      height: 38
    };

    if (rectHit(getPlayerBox(), box)) {
      activatePower(power.type, time);
      createParticles(power.x, power.y, "#88ead8", 20);
      playSound("power");
      powerUps.splice(i, 1);
      continue;
    }

    if (power.y > H + 50) powerUps.splice(i, 1);
  }
}

function activatePower(type, time) {
  powerUses++;

  if (type === "shield") shieldUntil = time + 8500;
  if (type === "magnet") magnetUntil = time + 8500;
  if (type === "double") doubleScoreUntil = time + 8500;
}

function getPlayerBox() {
  const width = player.sliding ? 58 : 40;
  const height = player.sliding ? 30 : 66;
  const y = player.sliding ? player.y + 38 : player.y;

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
    score += 400;
    playSound("mission");
  }
}

function createBuildings() {
  const items = [];

  for (let i = 0; i < 14; i++) {
    items.push({
      x: i * 82 - 40,
      width: 48 + Math.random() * 52,
      height: 110 + Math.random() * 210,
      windows: 3 + Math.floor(Math.random() * 4)
    });
  }

  return items;
}

function updateBuildings(dt) {
  const drift = worldSpeed * .045 * dt;

  buildings.forEach(building => {
    building.x -= drift;

    if (building.x + building.width < 0) {
      building.x = W + Math.random() * 90;
      building.height = 110 + Math.random() * 210;
    }
  });
}

function createParticles(x, y, colour, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - .5) * 6,
      vy: (Math.random() - .5) * 6,
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
    p.life -= .03 * dt;

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
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 2))];
  const gradient = ctx.createLinearGradient(0, 0, 0, H);

  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(1, theme.skyBottom);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,.32)";

  for (let i = 0; i < 14; i++) {
    const x = (i * 94 + frame * .02) % W;
    const y = 35 + (i * 43) % 160;

    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCity() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 2))];

  buildings.forEach(building => {
    const baseY = H - 250;

    ctx.fillStyle = theme.city;
    ctx.fillRect(building.x, baseY - building.height * .18, building.width, building.height);

    ctx.fillStyle = "rgba(255,231,158,.52)";

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < building.windows; c++) {
        const wx = building.x + 8 + c * 12;
        const wy = baseY - building.height * .18 + 16 + r * 18;
        ctx.fillRect(wx, wy, 5, 8);
      }
    }
  });
}

function drawSkyway() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 2))];

  ctx.fillStyle = theme.road;
  ctx.beginPath();
  ctx.moveTo(230, H);
  ctx.lineTo(365, 0);
  ctx.lineTo(595, 0);
  ctx.lineTo(730, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#171c26";

  ctx.beginPath();
  ctx.moveTo(210, H);
  ctx.lineTo(350, 0);
  ctx.lineTo(365, 0);
  ctx.lineTo(230, H);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(730, H);
  ctx.lineTo(595, 0);
  ctx.lineTo(610, 0);
  ctx.lineTo(750, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.24)";
  ctx.lineWidth = 4;

  for (let lane = 1; lane <= 2; lane++) {
    const bottomX = 230 + lane * 167;
    const topX = 365 + lane * 77;

    for (let y = -50 + (frame * worldSpeed * .72) % 95; y < H + 90; y += 95) {
      const t = y / H;
      const x = topX + (bottomX - topX) * t;
      const h = 18 + t * 28;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
  }
}

function drawLaneLights() {
  const theme = themes[Math.min(themes.length - 1, Math.floor((level - 1) / 2))];

  for (let y = -20 + (frame * worldSpeed * .7) % 72; y < H + 60; y += 72) {
    const t = y / H;
    const left = 355 - 115 * t;
    const right = 605 + 115 * t;

    ctx.fillStyle = theme.glow;
    ctx.beginPath();
    ctx.arc(left, y, 2.6 + t * 2.5, 0, Math.PI * 2);
    ctx.arc(right, y, 2.6 + t * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(time) {
  ctx.save();
  ctx.translate(player.x, player.y + 36);
  ctx.rotate(player.boardTilt);

  if (time < shieldUntil) {
    ctx.strokeStyle = "#6ee4cf";
    ctx.lineWidth = 4;
    ctx.fillStyle = "rgba(110,228,207,.12)";
    ctx.beginPath();
    ctx.arc(0, 0, 47, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (controls.boost && energy > 0) {
    ctx.fillStyle = "#6bd6f8";

    ctx.beginPath();
    ctx.moveTo(-11, 34);
    ctx.lineTo(-2, 57 + Math.random() * 7);
    ctx.lineTo(5, 34);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 34);
    ctx.lineTo(16, 57 + Math.random() * 7);
    ctx.lineTo(22, 34);
    ctx.fill();
  }

  ctx.fillStyle = "#1d2432";
  ctx.beginPath();
  ctx.roundRect(-32, 30, 64, 12, 6);
  ctx.fill();

  ctx.fillStyle = "#db577c";
  ctx.beginPath();
  ctx.roundRect(-26, 32, 52, 7, 4);
  ctx.fill();

  if (player.sliding) {
    ctx.fillStyle = "#f0b59f";
    ctx.beginPath();
    ctx.arc(-8, 6, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#26303f";
    ctx.beginPath();
    ctx.roundRect(-5, -2, 44, 18, 8);
    ctx.fill();

    ctx.fillStyle = "#4fbcae";
    ctx.beginPath();
    ctx.roundRect(20, 0, 25, 10, 5);
    ctx.fill();
  } else {
    ctx.fillStyle = "#26303f";
    ctx.beginPath();
    ctx.roundRect(-17, -14, 34, 43, 10);
    ctx.fill();

    ctx.fillStyle = "#4fbcae";
    ctx.beginPath();
    ctx.roundRect(-15, -11, 30, 20, 8);
    ctx.fill();

    ctx.fillStyle = "#f0b59f";
    ctx.beginPath();
    ctx.arc(0, -28, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#222834";
    ctx.beginPath();
    ctx.arc(0, -32, 13, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#26303f";
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
      ctx.fillStyle = "#efb14a";
      ctx.beginPath();
      ctx.roundRect(-32, -24, 64, 48, 8);
      ctx.fill();

      ctx.fillStyle = "#2d3542";

      for (let i = -24; i < 25; i += 18) {
        ctx.save();
        ctx.translate(i, 0);
        ctx.rotate(-.55);
        ctx.fillRect(-5, -25, 10, 50);
        ctx.restore();
      }
    }

    if (item.type === "gate") {
      ctx.strokeStyle = "#5dd6c2";
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(-35, 46);
      ctx.lineTo(-35, -42);
      ctx.lineTo(35, -42);
      ctx.lineTo(35, 46);
      ctx.stroke();

      ctx.fillStyle = "#1c2431";
      ctx.fillRect(-33, -40, 66, 25);
    }

    if (item.type === "drone") {
      ctx.fillStyle = "#6270c7";
      ctx.beginPath();
      ctx.roundRect(-29, -15, 58, 30, 12);
      ctx.fill();

      ctx.fillStyle = "#e49ab4";
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
    const scale = 1 + Math.sin(coin.pulse) * .09;

    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#f6d95f";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#9e7410";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, 1);

    ctx.restore();
  });
}

function drawPowerUps() {
  const icons = {
    shield: "S",
    magnet: "M",
    double: "2×"
  };

  powerUps.forEach(power => {
    const scale = 1 + Math.sin(power.pulse) * .08;

    ctx.save();
    ctx.translate(power.x, power.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icons[power.type], 0, 1);

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
  ui.boostText.textContent = `${Math.floor(energy)}%`;

  const mission = missions[Math.min(missionIndex, missions.length - 1)];
  ui.mission.textContent = mission.text;

  const active = [];

  if (time < shieldUntil) active.push(`Shield ${Math.ceil((shieldUntil - time) / 1000)}s`);
  if (time < magnetUntil) active.push(`Magnet ${Math.ceil((magnetUntil - time) / 1000)}s`);
  if (time < doubleScoreUntil) active.push(`Double Score ${Math.ceil((doubleScoreUntil - time) / 1000)}s`);

  ui.powerStatus.innerHTML = active
    .map(item => `<div class="power-pill">${item}</div>`)
    .join("");
}

function updateBest() {
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem("neonDashBestV2", best);
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

  ui.gameOverTitle.textContent = level >= 5 ? "Excellent Run" : "Good Effort";
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
    jump: [500, .09, "triangle"],
    slide: [190, .08, "sine"],
    coin: [780, .08, "sine"],
    power: [650, .15, "triangle"],
    shield: [440, .12, "sine"],
    hit: [115, .24, "sawtooth"],
    mission: [700, .2, "triangle"],
    gameover: [90, .38, "sawtooth"]
  };

  const [frequency, duration, wave] = sounds[type] || [440, .1, "sine"];
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = wave;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(.1, audioContext.currentTime);
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

  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", event => {
  if (event.key === " ") controls.boost = false;
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
