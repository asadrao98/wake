'use client';

import { useEffect, useRef } from 'react';

export default function Wake() {
  const canvasRef = useRef(null);
  const startBtnRef = useRef(null);
  const restartBtnRef = useRef(null);
  const stickRef = useRef(null);
  const thumbRef = useRef(null);
  const pulseBtnRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    const dark = document.createElement('canvas');
    const dctx = dark.getContext('2d');

    let W = 0, H = 0, DPR = 1;
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      dark.width = W * DPR; dark.height = H * DPR;
      dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    let AC = null;
    function actx() {
      if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
      return AC;
    }
    function blip(freq, dur, type, vol) {
      const a = actx(); if (!a) return;
      try {
        const o = a.createOscillator(), g = a.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.value = vol || 0.06;
        o.connect(g); g.connect(a.destination);
        const t = a.currentTime; o.start(t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        o.stop(t + (dur || 0.2));
      } catch (e) {}
    }

    const CELL = 52;
    let COLS = 21, ROWS = 21, grid = [], worldW = 0, worldH = 0;
    function genMaze(cols, rows) {
      COLS = cols; ROWS = rows;
      worldW = COLS * CELL; worldH = ROWS * CELL;
      grid = [];
      for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(1));
      const stack = [[1, 1]]; grid[1][1] = 0;
      const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const opts = [];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1 && grid[ny][nx] === 1) opts.push([nx, ny, dx, dy]);
        }
        if (opts.length) {
          const [nx, ny, dx, dy] = opts[(Math.random() * opts.length) | 0];
          grid[cy + dy / 2][cx + dx / 2] = 0; grid[ny][nx] = 0;
          stack.push([nx, ny]);
        } else stack.pop();
      }
      for (let i = 0; i < COLS * ROWS * 0.06; i++) {
        const rx = 1 + ((Math.random() * (COLS - 2)) | 0), ry = 1 + ((Math.random() * (ROWS - 2)) | 0);
        if (rx > 0 && ry > 0 && rx < COLS - 1 && ry < ROWS - 1) grid[ry][rx] = 0;
      }
    }
    function isWallWorld(x, y) {
      const c = (x / CELL) | 0, r = (y / CELL) | 0;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
      return grid[r][c] === 1;
    }
    function randFloor() {
      while (true) {
        const c = 1 + ((Math.random() * (COLS - 2)) | 0), r = 1 + ((Math.random() * (ROWS - 2)) | 0);
        if (grid[r][c] === 0) return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
      }
    }

    const player = { x: 0, y: 0, vx: 0, vy: 0, r: 11, speed: 200, sprint: 330 };
    let hunters = [], shards = [], exit = null;
    let trails = [];

    let running = false, depth = 0, shardsNeeded = 3, pings = 3, exitOpen = false;
    const keys = {};
    const elDepth = document.querySelector('#depth .v');
    const elShards = document.querySelector('#shards .v');
    const elPings = document.querySelector('#pings .v');
    const elSight = document.getElementById('sightfill');

    let pulse = null;

    function onKeyDown(e) {
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); doPulse(); }
    }
    function onKeyUp(e) { keys[e.code] = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const startBtn = startBtnRef.current;
    const restartBtn = restartBtnRef.current;
    const onStart = () => { actx(); start(true); };
    startBtn.addEventListener('click', onStart);
    restartBtn.addEventListener('click', onStart);

    const touch = { active: false, pid: null, ix: 0, iy: 0, mag: 0, cx: 0, cy: 0 };
    const stickEl = stickRef.current;
    const thumbEl = thumbRef.current;
    const pulseBtnEl = pulseBtnRef.current;
    const STICK_R = 56;
    function stickStart(e) {
      if (touch.active) return;
      const rect = stickEl.getBoundingClientRect();
      touch.cx = rect.left + rect.width / 2;
      touch.cy = rect.top + rect.height / 2;
      touch.active = true; touch.pid = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      stickMove(e);
    }
    function stickMove(e) {
      if (!touch.active || e.pointerId !== touch.pid) return;
      let dx = e.clientX - touch.cx, dy = e.clientY - touch.cy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { dx = dx / d * STICK_R; dy = dy / d * STICK_R; }
      thumbEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      touch.ix = dx / STICK_R; touch.iy = dy / STICK_R;
      touch.mag = Math.min(1, d / STICK_R);
    }
    function stickEnd(e) {
      if (e.pointerId !== touch.pid) return;
      touch.active = false; touch.pid = null; touch.ix = 0; touch.iy = 0; touch.mag = 0;
      thumbEl.style.transform = '';
    }
    stickEl.addEventListener('pointerdown', stickStart);
    stickEl.addEventListener('pointermove', stickMove);
    stickEl.addEventListener('pointerup', stickEnd);
    stickEl.addEventListener('pointercancel', stickEnd);
    const onPulseBtn = (e) => { e.preventDefault(); actx(); doPulse(); };
    pulseBtnEl.addEventListener('pointerdown', onPulseBtn);

    function start(fresh) {
      if (fresh) { depth = 1; pings = 3; }
      buildLevel();
      document.getElementById('start').classList.add('hidden');
      document.getElementById('end').classList.add('hidden');
      running = true; last = performance.now();
    }

    function buildLevel() {
      const size = Math.min(31, 17 + depth * 2);
      const odd = size % 2 === 0 ? size + 1 : size;
      genMaze(odd, odd);
      const s = randFloor(); player.x = s.x; player.y = s.y; player.vx = player.vy = 0;
      shards = [];
      for (let i = 0; i < shardsNeeded; i++) {
        let p, tries = 0;
        do { p = randFloor(); tries++; } while (tries < 40 && Math.hypot(p.x - player.x, p.y - player.y) < CELL * 5);
        shards.push({ x: p.x, y: p.y, got: false, t: Math.random() * 6 });
      }
      let ex, best = 0;
      for (let i = 0; i < 30; i++) { const p = randFloor(); const d = Math.hypot(p.x - player.x, p.y - player.y); if (d > best) { best = d; ex = p; } }
      exit = { x: ex.x, y: ex.y }; exitOpen = false;
      hunters = [];
      const n = 2 + depth;
      for (let i = 0; i < n; i++) {
        let p, tries = 0;
        do { p = randFloor(); tries++; } while (tries < 40 && Math.hypot(p.x - player.x, p.y - player.y) < CELL * 6);
        hunters.push({
          x: p.x, y: p.y, vx: 0, vy: 0, r: 13,
          state: 'wander', target: null, memory: 0, freeze: 0,
          wanderDir: Math.random() * Math.PI * 2, repick: 0, speed: 0,
        });
      }
      trails = [];
      elDepth.textContent = depth;
      elPings.textContent = pings;
      updateShardHUD();
    }
    function updateShardHUD() {
      const g = shards.filter(s => s.got).length;
      elShards.textContent = g + ' / ' + shardsNeeded;
    }

    function doPulse() {
      if (!running || pings <= 0) return;
      pings--; elPings.textContent = pings;
      pulse = { x: player.x, y: player.y, r: 0, life: 1 };
      blip(660, 0.35, 'sine', 0.08); blip(990, 0.3, 'sine', 0.04);
      for (const h of hunters) {
        if (Math.hypot(h.x - player.x, h.y - player.y) < 520) {
          h.state = 'hunt'; h.memory = 3.5;
        }
      }
    }

    function moveCollide(e, nx, ny) {
      e.x += nx;
      if (isWallWorld(e.x + e.r, e.y) || isWallWorld(e.x + e.r, e.y - e.r * 0.6) || isWallWorld(e.x + e.r, e.y + e.r * 0.6))
        e.x = ((((e.x + e.r) / CELL) | 0)) * CELL - e.r - 0.01;
      if (isWallWorld(e.x - e.r, e.y) || isWallWorld(e.x - e.r, e.y - e.r * 0.6) || isWallWorld(e.x - e.r, e.y + e.r * 0.6))
        e.x = ((((e.x - e.r) / CELL) | 0) + 1) * CELL + e.r + 0.01;
      e.y += ny;
      if (isWallWorld(e.x, e.y + e.r) || isWallWorld(e.x - e.r * 0.6, e.y + e.r) || isWallWorld(e.x + e.r * 0.6, e.y + e.r))
        e.y = ((((e.y + e.r) / CELL) | 0)) * CELL - e.r - 0.01;
      if (isWallWorld(e.x, e.y - e.r) || isWallWorld(e.x - e.r * 0.6, e.y - e.r) || isWallWorld(e.x + e.r * 0.6, e.y - e.r))
        e.y = ((((e.y - e.r) / CELL) | 0) + 1) * CELL + e.r + 0.01;
    }

    let last = performance.now();
    function update(dt, now) {
      let ix = 0, iy = 0, ps;
      if (touch.active && touch.mag > 0.15) {
        const m = Math.max(touch.mag, 0.0001);
        ix = touch.ix / m; iy = touch.iy / m;
        const t = Math.min(1, (touch.mag - 0.15) / 0.85);
        ps = player.speed + t * (player.sprint - player.speed);
      } else {
        if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
        const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
        if (ix || iy) { const l = Math.hypot(ix, iy); ix /= l; iy /= l; }
        ps = sprint ? player.sprint : player.speed;
      }
      const tvx = ix * ps, tvy = iy * ps;
      player.vx += (tvx - player.vx) * Math.min(1, 14 * dt);
      player.vy += (tvy - player.vy) * Math.min(1, 14 * dt);
      moveCollide(player, player.vx * dt, player.vy * dt);

      const pspd = Math.hypot(player.vx, player.vy);
      addTrail(player.x, player.y, pspd, 'bio');

      for (const s of shards) {
        if (!s.got && Math.hypot(s.x - player.x, s.y - player.y) < player.r + 12) {
          s.got = true; updateShardHUD(); blip(880, 0.18, 'triangle', 0.07); blip(1320, 0.22, 'sine', 0.04);
          if (shards.every(x => x.got)) { exitOpen = true; blip(440, 0.6, 'sine', 0.05); }
        }
        s.t += dt;
      }
      if (exitOpen && Math.hypot(exit.x - player.x, exit.y - player.y) < player.r + 16) {
        depth++; pings++; running = false;
        blip(330, 0.5, 'sine', 0.06);
        setTimeout(() => { buildLevel(); running = true; last = performance.now(); }, 350);
        return;
      }

      if (pulse) {
        pulse.r += 900 * dt; pulse.life -= dt * 0.9;
        if (pulse.life <= 0) pulse = null;
      }

      for (const h of hunters) {
        const dToP = Math.hypot(player.x - h.x, player.y - h.y);
        const sense = 360, prox = 110;
        const perceived = (pspd > 50 && dToP < sense) || dToP < prox || (pulse && pulse.life > 0.4 && dToP < 540);
        if (perceived) { h.state = 'hunt'; h.memory = 2.6; }
        else if (h.memory > 0) { h.memory -= dt; if (h.memory <= 0) h.state = 'wander'; }

        let hs = 0;
        if (h.state === 'hunt') {
          const dx = player.x - h.x, dy = player.y - h.y;
          const ang = Math.atan2(dy, dx);
          hs = 215;
          h.vx = Math.cos(ang) * hs; h.vy = Math.sin(ang) * hs;
          h.freeze = 0;
        } else {
          h.repick -= dt;
          if (h.freeze > 0) { h.freeze -= dt; h.vx = 0; h.vy = 0; }
          else {
            if (h.repick <= 0) {
              h.repick = 0.8 + Math.random() * 1.6;
              if (Math.random() < 0.28) { h.freeze = 1.2 + Math.random() * 1.8; }
              else h.wanderDir = Math.random() * Math.PI * 2;
            }
            hs = 70;
            h.vx = Math.cos(h.wanderDir) * hs; h.vy = Math.sin(h.wanderDir) * hs;
          }
        }
        const before = { x: h.x, y: h.y };
        moveCollide(h, h.vx * dt, h.vy * dt);
        if (h.state === 'wander' && Math.hypot(h.x - before.x, h.y - before.y) < hs * dt * 0.4) h.repick = 0;
        h.speed = Math.hypot(h.x - before.x, h.y - before.y) / Math.max(dt, 0.0001);
        if (h.speed > 20) addTrail(h.x, h.y, h.speed, 'hunter');

        if (dToP < player.r + h.r + 2) { die(); return; }
      }

      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i]; t.age += dt;
        if (t.age > t.max) trails.splice(i, 1);
      }

      const vr = visionRadius(pspd);
      elSight.style.width = Math.round((vr - MINV) / (MAXV - MINV) * 100) + '%';
    }

    function addTrail(x, y, spd, color) {
      if (spd < 25) return;
      trails.push({ x, y, age: 0, max: 0.9, color, sz: 3 + spd * 0.02 });
      if (trails.length > 260) trails.shift();
    }

    const MINV = 46, MAXV = 300;
    function visionRadius(spd) {
      return MINV + Math.min(1, spd / player.sprint) * (MAXV - MINV);
    }

    function die() {
      running = false;
      blip(140, 0.6, 'sawtooth', 0.08); blip(90, 0.7, 'sawtooth', 0.05);
      const et = document.getElementById('endTitle');
      et.textContent = 'TAKEN'; et.className = '';
      document.getElementById('endStats').innerHTML =
        'The dark closed at <b>Depth ' + depth + '</b>';
      document.getElementById('end').classList.remove('hidden');
    }

    function render(now) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
      if (!grid.length) return;

      let camX = player.x - W / 2, camY = player.y - H / 2;
      camX = Math.max(0, Math.min(worldW - W, camX));
      camY = Math.max(0, Math.min(worldH - H, camY));
      if (worldW < W) camX = (worldW - W) / 2;
      if (worldH < H) camY = (worldH - H) / 2;

      ctx.save();
      ctx.translate(-camX, -camY);

      const c0 = Math.max(0, (camX / CELL) | 0), c1 = Math.min(COLS, ((camX + W) / CELL | 0) + 1);
      const r0 = Math.max(0, (camY / CELL) | 0), r1 = Math.min(ROWS, ((camY + H) / CELL | 0) + 1);
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          if (grid[r][c] === 1) {
            ctx.fillStyle = '#0b1828';
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
            ctx.strokeStyle = 'rgba(52,239,208,0.10)';
            ctx.lineWidth = 1; ctx.strokeRect(c * CELL + .5, r * CELL + .5, CELL - 1, CELL - 1);
          } else {
            ctx.fillStyle = '#040a14';
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          }
        }
      }

      for (const t of trails) {
        const a = (1 - t.age / t.max);
        ctx.beginPath();
        ctx.fillStyle = (t.color === 'bio')
          ? 'rgba(52,239,208,' + (a * 0.5) + ')'
          : 'rgba(255,45,107,' + (a * 0.5) + ')';
        ctx.arc(t.x, t.y, t.sz * (0.5 + a * 0.8), 0, 7);
        ctx.fill();
      }

      for (const s of shards) {
        if (s.got) continue;
        const pls = 0.6 + 0.4 * Math.sin(s.t * 3);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.t * 0.8);
        ctx.fillStyle = 'rgba(255,213,107,' + (0.85) + ')';
        ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 18 * pls;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0); ctx.closePath();
        ctx.fill(); ctx.restore();
      }

      if (exit) {
        const op = exitOpen ? 1 : 0.28;
        const pls = 0.6 + 0.4 * Math.sin(now * 0.004);
        ctx.save(); ctx.translate(exit.x, exit.y);
        ctx.strokeStyle = 'rgba(255,213,107,' + op + ')';
        ctx.lineWidth = 3; ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = exitOpen ? 26 * pls : 6;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
        ctx.restore();
      }

      for (const h of hunters) {
        const lit = Math.min(1, h.speed / 215);
        ctx.save(); ctx.translate(h.x, h.y);
        ctx.fillStyle = 'rgba(255,45,107,' + (0.35 + lit * 0.65) + ')';
        ctx.shadowColor = '#ff2d6b'; ctx.shadowBlur = 4 + lit * 22;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2; const rr = h.r * (i % 2 ? 0.7 : 1.1);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      const pspd = Math.hypot(player.vx, player.vy);
      ctx.save(); ctx.translate(player.x, player.y);
      ctx.fillStyle = '#9bffee'; ctx.shadowColor = '#34efd0'; ctx.shadowBlur = 14 + pspd * 0.03;
      ctx.beginPath(); ctx.arc(0, 0, player.r, 0, 7); ctx.fill();
      ctx.restore();

      if (pulse) {
        ctx.save();
        ctx.strokeStyle = 'rgba(155,255,238,' + (pulse.life * 0.6) + ')';
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, pulse.r, 0, 7); ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      dctx.clearRect(0, 0, W, H);
      dctx.globalCompositeOperation = 'source-over';
      dctx.fillStyle = 'rgba(2,4,10,0.985)';
      dctx.fillRect(0, 0, W, H);
      dctx.globalCompositeOperation = 'destination-out';

      function hole(wx, wy, radius, soft) {
        const sx = wx - camX, sy = wy - camY;
        if (sx < -radius || sy < -radius || sx > W + radius || sy > H + radius) return;
        const g = dctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(soft != null ? soft : 0.55, 'rgba(0,0,0,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.beginPath(); dctx.arc(sx, sy, radius, 0, 7); dctx.fill();
      }

      hole(player.x, player.y, visionRadius(pspd), 0.5);
      for (const h of hunters) { const r = (h.speed / 215) * 200; if (r > 8) hole(h.x, h.y, r, 0.4); }
      for (const s of shards) { if (!s.got) hole(s.x, s.y, 60 + 18 * Math.sin(s.t * 3), 0.2); }
      if (exit) hole(exit.x, exit.y, exitOpen ? 170 : 55, 0.3);
      if (pulse) hole(pulse.x, pulse.y, pulse.r, 0.7);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.drawImage(dark, 0, 0, W, H);
    }

    let rafId;
    function frame(now) {
      rafId = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.05) dt = 0.05;
      if (running) update(dt, now);
      render(now);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      startBtn.removeEventListener('click', onStart);
      restartBtn.removeEventListener('click', onStart);
      stickEl.removeEventListener('pointerdown', stickStart);
      stickEl.removeEventListener('pointermove', stickMove);
      stickEl.removeEventListener('pointerup', stickEnd);
      stickEl.removeEventListener('pointercancel', stickEnd);
      pulseBtnEl.removeEventListener('pointerdown', onPulseBtn);
    };
  }, []);

  return (
    <>
      <canvas id="c" ref={canvasRef} />

      <div id="hud">
        <div id="depth" className="stat"><span className="lab">Depth</span><span className="v">1</span></div>
        <div id="shards" className="stat"><span className="lab">Lights</span><span className="v">0 / 3</span></div>
        <div id="pings" className="stat"><span className="lab">Pulse</span><span className="v">3</span></div>
        <div id="breath"><span className="lab">Sight</span><div id="sightbar"><div id="sightfill" /></div></div>
      </div>

      <div className="overlay" id="start">
        <div className="title">W<span className="a">A</span>KE</div>
        <div className="thesis">To see, you must move. To move is to be seen.</div>
        <div className="panel">
          The dark only opens as far as you travel. Stand still and you go blind — but so does what hunts you.<br />
          Find the <b>three lights</b>, then reach the way down.
          <div className="ctrls ctrls-kb">
            <span className="key">W</span><span className="key">A</span><span className="key">S</span><span className="key">D</span> move &nbsp;·&nbsp;
            <span className="key">SHIFT</span> sprint &nbsp;·&nbsp;
            <span className="key">SPACE</span> pulse
          </div>
          <div className="ctrls ctrls-touch">
            <b>Joystick</b> to move — push further to run &nbsp;·&nbsp; tap <b>PULSE</b>
          </div>
        </div>
        <button className="btn" id="startBtn" ref={startBtnRef}>Descend</button>
        <div className="hint">A pulse reveals everything for a moment — but everything hears it</div>
      </div>

      <div id="touch">
        <div id="stick" ref={stickRef}>
          <div id="thumb" ref={thumbRef} />
        </div>
        <button id="pulseBtn" ref={pulseBtnRef} aria-label="Pulse">
          <span>PULSE</span>
        </button>
      </div>

      <div className="overlay hidden" id="end">
        <div id="endTitle">TAKEN</div>
        <div id="endStats" />
        <button className="btn" id="restartBtn" ref={restartBtnRef}>Again</button>
      </div>
    </>
  );
}
