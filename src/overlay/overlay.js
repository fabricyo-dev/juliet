(function () {
  'use strict';
  const SP = window.JULIET_SPRITE;
  const SCALE = 6, PX = SP.SIZE * SCALE; // 96 px on screen
  const SPEED = 120; // px/s
  const WALK_FPS = 8;
  const TIMEOUT_MS = 90_000;
  const EDGE = 200; // px from a screen edge where the bubble switches to edge-anchoring

  const hit = document.getElementById('hit');
  const canvas = document.getElementById('cat');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');
  const titleEl = document.getElementById('title');
  const lineEl = document.getElementById('line');
  const buttonsEl = document.getElementById('buttons');

  // ---- demo bridge (plain browser only; Electron injects window.juliet via preload) ----
  if (!window.juliet) {
    const q = new URLSearchParams(location.search).get('demo') || 'nudge';
    const listeners = {};
    const demoPayload = () => q === 'movie'
      ? { kind: 'movie', title: 'Movie night, Areej: The Social Network', line: 'I can open Google + Netflix search for it.', fromLeft: Math.random() < 0.5,
          buttons: [{ id: 'open', label: 'Open' }, { id: 'different', label: 'Different one' }, { id: 'skip', label: 'Skip this week' }], spriteSheetUrl: null }
      : { kind: 'nudge', title: 'Areej — LeetCode daily problem', line: 'Fifteen minutes counts. Want me to open it?', fromLeft: Math.random() < 0.5,
          buttons: [{ id: 'open', label: 'Open' }, { id: 'later', label: 'Later' }, { id: 'done', label: 'Did it' }], spriteSheetUrl: null };
    window.juliet = {
      onShow: (cb) => (listeners.show = cb),
      onLeave: (cb) => (listeners.leave = cb),
      setHit: (v) => console.log('hit', v),
      action: (id) => { console.log('action', id); listeners.leave({ hop: id === 'done' }); },
      gone: () => { console.log('gone'); setTimeout(() => listeners.show(demoPayload()), 800); },
    };
    setTimeout(() => listeners.show(demoPayload()), 300);
  }

  // ---- sprite source: designer sheet (32 px frames) or built-in matrix (16 px) ----
  let sheet = null; // {img, frame}
  const frameCanvases = SP.FRAMES.map((rows) => {
    const c = document.createElement('canvas'); c.width = SP.SIZE; c.height = SP.SIZE;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') { g.fillStyle = SP.PALETTE[ch]; g.fillRect(x, y, 1, 1); }
    }));
    return c;
  });
  function loadSheet(url) {
    if (!url || sheet) return;
    const img = new Image();
    img.onload = () => { if (img.width === 256 && img.height === 32) sheet = { img, frame: 32 }; };
    img.src = url;
  }
  function drawFrame(i) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, PX, PX);
    if (sheet) ctx.drawImage(sheet.img, i * sheet.frame, 0, sheet.frame, sheet.frame, 0, 0, PX, PX);
    else ctx.drawImage(frameCanvases[i], 0, 0, PX, PX);
  }

  // ---- state machine: idle -> walkIn -> talk -> (hop) -> walkOut -> gone ----
  let x = 0, dir = 1, stopX = 0, phase = 'idle', tStart = 0, lastFrame = 0, timeoutId = null;
  const W = () => window.innerWidth;
  // rAF is paused while a document is hidden/occluded; fall back to a timer so Juliet never freezes mid-walk.
  function nextFrame(cb) {
    if (document.hidden) setTimeout(() => cb(performance.now()), 1000 / 30);
    else requestAnimationFrame(cb);
  }

  function setX(v) { x = v; hit.style.left = `${Math.round(x)}px`; }
  function face(d) { dir = d; canvas.classList.toggle('flip', d < 0); }

  function fill(p) {
    titleEl.textContent = p.title;
    lineEl.textContent = p.line || '';
    buttonsEl.replaceChildren(...p.buttons.map((b) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      el.onclick = () => act(b.id);
      return el;
    }));
  }
  function show(p) {
    if (phase !== 'idle' && phase !== 'gone') { fill(p); if (phase === 'talk') armTimeout(); return; }
    if (W() < 200) { setTimeout(() => show(p), 100); return; } // viewport not laid out yet
    loadSheet(p.spriteSheetUrl);
    fill(p);
    bubble.hidden = true;
    const fromLeft = !!p.fromLeft;
    const frac = 0.2 + Math.random() * 0.2;
    stopX = fromLeft ? W() * frac : W() * (1 - frac) - PX;
    setX(fromLeft ? -PX : W());
    face(fromLeft ? 1 : -1);
    phase = 'walkIn'; tStart = performance.now(); lastFrame = tStart;
    nextFrame(loop);
  }
  function armTimeout() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => act('timeout'), TIMEOUT_MS);
  }
  function talk() {
    phase = 'talk';
    bubble.classList.toggle('edge-left', x < EDGE);
    bubble.classList.toggle('edge-right', x > W() - EDGE - PX);
    bubble.hidden = false;
    armTimeout();
  }
  function act(id) {
    if (phase !== 'talk') return;
    clearTimeout(timeoutId);
    bubble.hidden = true;
    phase = 'acted';
    window.juliet.action(id);
  }
  function leave(p) {
    clearTimeout(timeoutId);
    bubble.hidden = true;
    const hop = !!(p && p.hop);
    phase = hop ? 'hop' : 'walkOut';
    tStart = performance.now(); lastFrame = tStart;
    if (!hop) face(x < W() / 2 ? -1 : 1);
    nextFrame(loop);
  }

  function loop(now) {
    // cap dt so a paused tab doesn't teleport her; allow bigger steps when timers are throttled (hidden)
    const dt = Math.min(document.hidden ? 0.5 : 0.05, (now - lastFrame) / 1000); lastFrame = now;
    const el = now - tStart;
    if (phase === 'walkIn') {
      setX(x + dir * SPEED * dt);
      drawFrame(SP.FRAME_INDEX.WALK[Math.floor(el / (1000 / WALK_FPS)) % 4]);
      if ((dir > 0 && x >= stopX) || (dir < 0 && x <= stopX)) { setX(stopX); talk(); }
    } else if (phase === 'talk' || phase === 'acted') {
      drawFrame(Math.floor(el / 250) % 16 === 15 ? SP.FRAME_INDEX.BLINK : SP.FRAME_INDEX.SIT);
    } else if (phase === 'hop') {
      const k = Math.floor(el / 140);
      const seq = [SP.FRAME_INDEX.CROUCH, SP.FRAME_INDEX.AIR, SP.FRAME_INDEX.AIR, SP.FRAME_INDEX.CROUCH, SP.FRAME_INDEX.SIT];
      drawFrame(seq[Math.min(k, seq.length - 1)]);
      if (el > 900) { phase = 'walkOut'; tStart = now; face(x < W() / 2 ? -1 : 1); }
    } else if (phase === 'walkOut') {
      setX(x + dir * SPEED * dt);
      drawFrame(SP.FRAME_INDEX.WALK[Math.floor(el / (1000 / WALK_FPS)) % 4]);
      if (x < -PX || x > W()) { phase = 'gone'; window.juliet.gone(); return; }
    } else return;
    nextFrame(loop);
  }

  hit.addEventListener('pointerenter', () => window.juliet.setHit(true));
  hit.addEventListener('pointerleave', () => window.juliet.setHit(false));
  canvas.addEventListener('click', () => act('cat'));

  window.juliet.onShow(show);
  window.juliet.onLeave(leave);
  drawFrame(SP.FRAME_INDEX.SIT);
})();
