// Battle Arena - Top-Down Shooter Prototype
// Single-file vanilla JS game using HTML5 Canvas

(() => {
  'use strict';

  // DOM references
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const healthBar = document.getElementById('healthBar');

  // Resize canvas to device pixels for crisp rendering
  const size = { w: 0, h: 0, dpr: Math.min(2, window.devicePixelRatio || 1) };
  function resize() {
    size.w = Math.floor(window.innerWidth);
    size.h = Math.floor(window.innerHeight);
    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    canvas.width = Math.floor(size.w * size.dpr);
    canvas.height = Math.floor(size.h * size.dpr);
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Utility functions
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy;
  };

  // Input state
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.add('up');
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.add('down');
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.add('left');
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.add('right');

    if (e.code === 'Escape') togglePause();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.delete('up');
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.delete('down');
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.delete('left');
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.delete('right');
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; });
  canvas.addEventListener('mouseup', () => { mouse.down = false; });

  // Game state
  const game = {
    running: false,
    paused: false,
    time: 0,
    score: 0,
    wave: 1,
    nextWaveScore: 20,
  };

  // Entities
  const player = {
    x: size.w / 2,
    y: size.h / 2,
    r: 16,
    speed: 260,
    hp: 100,
    hpMax: 100,
    reload: 0,
    reloadTime: 100, // ms between shots
  };

  let bullets = []; // {x,y,vx,vy,r,life}
  let enemies = []; // {x,y,vx,vy,r,speed,hp,damage}
  let particles = []; // {x,y,vx,vy,life,clr}

  function resetGame() {
    game.running = true;
    game.paused = false;
    game.time = 0;
    game.score = 0;
    game.wave = 1;
    game.nextWaveScore = 20;

    player.x = size.w / 2;
    player.y = size.h / 2;
    player.hp = player.hpMax;
    player.reload = 0;

    bullets = [];
    enemies = [];
    particles = [];

    spawnWave(game.wave);
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = game.score | 0;
    waveEl.textContent = game.wave;
    const pct = clamp(player.hp / player.hpMax, 0, 1) * 100;
    healthBar.style.width = pct + '%';
    const g = Math.floor(clamp(pct / 100, 0, 1) * 160 + 60);
    const r = Math.floor(255 - clamp(pct / 100, 0, 1) * 160);
    healthBar.style.background = `linear-gradient(90deg, rgb(${r},${g},80), rgb(${r-20},${g-30},70))`;
  }

  function spawnWave(n) {
    const count = 6 + n * 2;
    for (let i = 0; i < count; i++) {
      spawnEnemy();
    }
  }

  function spawnEnemy() {
    const edge = Math.floor(rand(0, 4));
    let x, y;
    const pad = 30;
    if (edge === 0) { x = rand(-pad, -10); y = rand(0, size.h); }
    if (edge === 1) { x = rand(size.w + 10, size.w + pad); y = rand(0, size.h); }
    if (edge === 2) { x = rand(0, size.w); y = rand(-pad, -10); }
    if (edge === 3) { x = rand(0, size.w); y = rand(size.h + 10, size.h + pad); }

    const speed = rand(40, 85) + game.wave * 3;
    const r = rand(12, 20);
    const hp = Math.ceil(r / 4) + Math.floor(game.wave * 0.6);
    const damage = Math.ceil(r / 8) + 4;

    enemies.push({ x, y, vx: 0, vy: 0, r, speed, hp, damage });
  }

  function shoot() {
    if (player.reload > 0) return;
    const ang = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const speed = 520;
    const spread = rand(-0.03, 0.03);
    const vx = Math.cos(ang + spread) * speed;
    const vy = Math.sin(ang + spread) * speed;
    bullets.push({ x: player.x + Math.cos(ang) * (player.r + 6), y: player.y + Math.sin(ang) * (player.r + 6), vx, vy, r: 4, life: 900 });
    player.reload = player.reloadTime;
    // muzzle flash particles
    for (let i = 0; i < 6; i++) {
      const a = ang + rand(-0.4, 0.4);
      const sp = rand(120, 220);
      particles.push({ x: player.x, y: player.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(80, 160), clr: 'rgba(255,220,120,0.9)' });
    }
  }

  function addHitParticles(x, y, baseClr = 'rgba(180,220,255,0.9)') {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 160);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(120, 260), clr: baseClr });
    }
  }

  function damagePlayer(dmg) {
    player.hp -= dmg;
    addHitParticles(player.x, player.y, 'rgba(255,120,120,0.9)');
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  function gameOver() {
    game.running = false;
    showOverlay(`<h1>Game Over</h1><p class="subtitle">Score: ${game.score | 0}</p><div class="panel-actions"><button class="btn primary" id="retryBtn">Retry</button></div>`);
    const retry = document.getElementById('retryBtn');
    if (retry) retry.addEventListener('click', () => { hideOverlay(); resetGame(); });
  }

  function showOverlay(htmlInsidePanel) {
    const panel = overlay.querySelector('.panel');
    if (htmlInsidePanel) panel.innerHTML = htmlInsidePanel;
    overlay.classList.add('show');
  }

  function hideOverlay() {
    // restore initial panel if starting from landing
    const panel = overlay.querySelector('.panel');
    panel.innerHTML = `
      <h1>Battle Arena</h1>
      <p class="subtitle">Simple top-down shooter prototype</p>
      <div class="instructions">
        <h2>Controls</h2>
        <ul>
          <li>Move: W A S D</li>
          <li>Aim: Mouse</li>
          <li>Shoot: Left Click</li>
          <li>Pause: Esc</li>
        </ul>
      </div>
      <div class="panel-actions">
        <button id="startBtn" class="btn primary">Start</button>
      </div>
      <div class="panel-footer">
        <small>Prototype built with HTML5 Canvas, CSS and JavaScript.</small>
      </div>`;
    overlay.classList.remove('show');
    const btn = document.getElementById('startBtn');
    if (btn) btn.addEventListener('click', () => { hideOverlay(); resetGame(); });
  }

  function togglePause() {
    if (!game.running) return; // no pause if over or not started
    game.paused = !game.paused;
    if (game.paused) {
      showOverlay(`<h1>Paused</h1><p class="subtitle">Press Esc to resume</p><div class="panel-actions"><button class="btn" id="resumeBtn">Resume</button><button class="btn primary" id="retryBtn">Restart</button></div>`);
      const resume = document.getElementById('resumeBtn');
      const retry = document.getElementById('retryBtn');
      if (resume) resume.addEventListener('click', () => { overlay.classList.remove('show'); game.paused = false; });
      if (retry) retry.addEventListener('click', () => { hideOverlay(); resetGame(); });
    } else {
      overlay.classList.remove('show');
    }
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      hideOverlay();
      resetGame();
    });
  }

  // Update & render loop
  let last = performance.now();
  function loop(now) {
    const dt = (now - last);
    last = now;

    if (game.running && !game.paused) update(dt / 1000);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(dt) {
    game.time += dt;

    // Player move
    let dx = 0, dy = 0;
    if (keys.has('up')) dy -= 1;
    if (keys.has('down')) dy += 1;
    if (keys.has('left')) dx -= 1;
    if (keys.has('right')) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      player.x += dx * player.speed * dt;
      player.y += dy * player.speed * dt;
    }
    // constrain to screen
    player.x = clamp(player.x, player.r, size.w - player.r);
    player.y = clamp(player.y, player.r, size.h - player.r);

    // Shooting
    player.reload = Math.max(0, player.reload - dt * 1000);
    if (mouse.down) shoot();

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt * 1000;
      if (b.x < -20 || b.y < -20 || b.x > size.w + 20 || b.y > size.h + 20 || b.life <= 0) {
        bullets.splice(i, 1);
      }
    }

    // Enemies move towards player
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      const sp = e.speed;
      e.vx = Math.cos(ang) * sp;
      e.vy = Math.sin(ang) * sp;
      e.x += e.vx * dt; e.y += e.vy * dt;

      // collision with player
      const rsum = e.r + player.r;
      if (dist2(e.x, e.y, player.x, player.y) <= rsum * rsum) {
        damagePlayer(e.damage);
        addHitParticles(e.x, e.y);
        enemies.splice(i, 1);
        continue;
      }
    }

    // Bullet-Enemy collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        const rsum = e.r + b.r;
        if (dist2(e.x, e.y, b.x, b.y) <= rsum * rsum) {
          bullets.splice(j, 1);
          e.hp -= 2 + Math.random() * 2; // bullet damage
          addHitParticles(b.x, b.y);
          if (e.hp <= 0) {
            enemies.splice(i, 1);
            game.score += 2 + Math.floor(e.r / 3);
            // death burst
            addHitParticles(e.x, e.y, 'rgba(220,240,255,0.95)');
            break;
          }
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1000;
      p.vx *= 0.98; p.vy *= 0.98;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Progress waves
    if (game.score >= game.nextWaveScore) {
      game.wave += 1;
      game.nextWaveScore += 18 + Math.floor(game.wave * 8);
      // spawn a new wave burst
      spawnWave(game.wave);
    }

    // Keep enemy population balanced
    const targetEnemies = 6 + game.wave * 2;
    if (enemies.length < targetEnemies) {
      if (Math.random() < 0.02 + game.wave * 0.002) spawnEnemy();
    }

    updateHUD();
  }

  // Render
  function render() {
    // background is CSS, but we can add vignette/grid for feel
    ctx.clearRect(0, 0, size.w, size.h);

    // subtle grid
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#9ab6ff';
    const grid = 40;
    ctx.beginPath();
    for (let x = (-(game.time * 30) % grid); x < size.w; x += grid) {
      ctx.moveTo(x, 0); ctx.lineTo(x, size.h);
    }
    for (let y = (-(game.time * 30) % grid); y < size.h; y += grid) {
      ctx.moveTo(0, y); ctx.lineTo(size.w, y);
    }
    ctx.stroke();
    ctx.restore();

    // draw particles behind entities
    for (const p of particles) {
      const a = clamp(p.life / 260, 0, 1);
      ctx.fillStyle = p.clr.replace('0.9', (0.2 + 0.6 * a).toFixed(2));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2 + (1 - a) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    const aimAng = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    drawPlayer(player.x, player.y, aimAng);

    // Enemies
    for (const e of enemies) {
      drawEnemy(e);
    }

    // Bullets
    ctx.fillStyle = '#ffd48a';
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aim reticle
    drawCrosshair(mouse.x, mouse.y);
  }

  function drawPlayer(x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // body
    const grd = ctx.createLinearGradient(-18, 0, 18, 0);
    grd.addColorStop(0, '#3a84e6');
    grd.addColorStop(1, '#1b5fb6');
    ctx.fillStyle = grd;
    ctx.strokeStyle = 'rgba(200,220,255,0.6)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // gun barrel
    ctx.fillStyle = '#cbd9f2';
    ctx.fillRect(10, -3, 16, 6);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const grd = ctx.createRadialGradient(0, 0, 3, 0, 0, e.r + 2);
    grd.addColorStop(0, '#ff7a7a');
    grd.addColorStop(1, '#b83434');
    ctx.fillStyle = grd;
    ctx.strokeStyle = 'rgba(255,180,180,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCrosshair(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(220,235,255,0.8)';
    ctx.lineWidth = 1.5;
    const r = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r - 4, 0); ctx.lineTo(-2, 0);
    ctx.moveTo(r + 4, 0); ctx.lineTo(2, 0);
    ctx.moveTo(0, -r - 4); ctx.lineTo(0, -2);
    ctx.moveTo(0, r + 4); ctx.lineTo(0, 2);
    ctx.stroke();
    ctx.restore();
  }
})();
