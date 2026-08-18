(function () {
  'use strict';
  const A = window.JULIET_ANIM;
  const CELL = A.CELL; // 128 px cell drawn 1:1 in CSS px (nearest-neighbour upscales on Retina)
  const ASSET_BASE = '../../assets/juliet/';
  const SPEED = 120;                                    // px/s while walking
  const CYCLE_MS = A.timeline('walkRight').total;       // 800 ms per 8-frame step
  const CYCLE_PX = (SPEED * CYCLE_MS) / 1000;           // 96 px per step
  const TIMEOUT_MS = 90_000;                            // ignored bubble → she leaves
  const EDGE = 200;                                     // px from a screen edge where the bubble edge-anchors
  const CHEER_MS = 1100;                                // "Did it": a short cheer in the bubble before she turns back
  const CHEERS = ["Nice one, Areej!", "That's the way.", "Look at you go."];
  const ACTED_WATCHDOG_MS = 8000;                       // max wait for main's overlay:leave after an action

  const hit = document.getElementById('hit');
  const canvas = document.getElementById('cat');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');
  const titleEl = document.getElementById('title');
  const lineEl = document.getElementById('line');
  const buttonsEl = document.getElementById('buttons');

  // ---- demo bridge (plain browser only; Electron injects window.juliet via preload) ----
  if (!window.juliet) {
    const q = new URLSearchParams(location.search);
    const kind = q.get('demo') || 'hi';
    const auto = q.get('auto') === '1';
    const listeners = {};
    const payloads = {
      hi: () => ({}), // no text → the manifest's default speech "Hi!"
      nudge: () => ({ kind: 'nudge', title: 'Areej — LeetCode daily problem', line: 'Fifteen minutes counts. Want me to open it?',
        buttons: [{ id: 'open', label: 'Open' }, { id: 'later', label: 'Later' }, { id: 'done', label: 'Did it' }] }),
      movie: () => ({ kind: 'movie', title: 'Movie night, Areej: The Social Network', line: 'I can open Google + Netflix search for it.',
        buttons: [{ id: 'open', label: 'Open' }, { id: 'different', label: 'Different one' }, { id: 'skip', label: 'Skip this week' }] }),
    };
    const payload = payloads[kind] || payloads.hi;
    window.juliet = {
      onShow: (cb) => (listeners.show = cb),
      onLeave: (cb) => (listeners.leave = cb),
      setHit: (v) => console.log('hit', v),
      action: (id) => { console.log('action', id); listeners.leave({ hop: id === 'done' }); },
      gone: () => { console.log('gone'); setTimeout(() => listeners.show(payload()), 800); },
    };
    setTimeout(() => listeners.show(payload()), 300);
    if (auto || kind === 'hi') {
      // simulate the user acting a few seconds after speech starts
      window.__demoAutoAct = () => setTimeout(() => act(kind === 'hi' ? 'timeout' : 'open'), 4000);
    }
  }

  // ---- sprite sheets ----
  const sheets = {};
  let sheetError = false;
  for (const [key, def] of Object.entries(A.SHEETS)) {
    const img = new Image();
    img.onerror = () => { sheetError = true; console.error('failed to load sheet', def.image); };
    img.src = ASSET_BASE + def.image;
    sheets[key] = img;
  }
  const sheetsReady = () => Object.values(sheets).every((i) => i.complete && i.naturalWidth > 0);
  const SHOW_MAX_TRIES = 50; // × 100 ms: give up on a broken/missing sheet instead of holding the overlay forever

  function draw(sheetKey, frame) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CELL, CELL);
    const r = A.frameRect(frame);
    ctx.drawImage(sheets[sheetKey], r.x, r.y, r.w, r.h, 0, 0, CELL, CELL);
  }

  // ---- clip player ----
  // phases: idle → walkIn → turnIn → talk → acted → (cheer) → turnBack → walkOut → gone
  let phase = 'idle';
  let clip = null, clipStart = 0, firedEvents = null;
  let x = 0, walkFrom = 0, stopX = 0, walkCycles = 0;
  let timeoutId = null, pendingLeave = null;
  const W = () => window.innerWidth;

  function nextFrame(cb) {
    // rAF is paused while a document is hidden/occluded; fall back to a timer so Juliet never freezes mid-walk
    if (document.hidden) setTimeout(() => cb(performance.now()), 1000 / 30);
    else requestAnimationFrame(cb);
  }
  function setX(v) { x = v; hit.style.left = `${Math.round(x)}px`; }
  function startClip(name, now) {
    clip = A.timeline(name);
    clipStart = now;
    firedEvents = new Set();
  }
  // Fire manifest events: {frame:n} when frame n first shows, {after:n} when frame n has finished (clip end).
  function fireEvent(type) {
    if (type === 'speechStart') talk();
    else if (type === 'resumeWalkRight') { walkFrom = x; startClip('walkRight', performance.now()); phase = 'walkOut'; }
    else console.warn('unknown animation event', type);
  }
  function frameEvents(step) {
    for (const ev of clip.events) {
      if (ev.frame === step.frame && !firedEvents.has(ev)) { firedEvents.add(ev); fireEvent(ev.type); }
    }
  }
  function afterEvents() {
    const last = clip.steps[clip.steps.length - 1].frame;
    for (const ev of clip.events) {
      if (ev.after === last && !firedEvents.has(ev)) { firedEvents.add(ev); fireEvent(ev.type); }
    }
  }

  // ---- speech bubble (code-rendered; text is whatever the runtime sends, "Hi!" by default) ----
  function fill(p) {
    titleEl.textContent = (p && p.title) || A.DEFAULT_SPEECH;
    lineEl.textContent = (p && p.line) || '';
    buttonsEl.replaceChildren(...((p && p.buttons) || []).map((b) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      el.onclick = () => act(b.id);
      return el;
    }));
  }
  function armTimeout() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => act('timeout'), TIMEOUT_MS);
  }
  function talk() {
    bubble.classList.toggle('edge-left', x < EDGE);
    bubble.classList.toggle('edge-right', x > W() - EDGE - CELL);
    bubble.hidden = false;
    armTimeout();
    if (window.__demoAutoAct) window.__demoAutoAct();
  }

  // ---- entry points from main ----
  function show(p, tries = 0) {
    if (phase !== 'idle' && phase !== 'gone') {
      // already on screen (e.g. movie re-roll, "couldn't open" notice): update the bubble in place and keep talking
      fill(p);
      if (phase === 'talk' || phase === 'acted') { phase = 'talk'; bubble.hidden = false; armTimeout(); }
      return;
    }
    if (W() < 200 || !sheetsReady()) { // viewport / sheets not ready yet
      if (sheetError || tries >= SHOW_MAX_TRIES) {
        console.error('juliet: sprite sheets unavailable — standing down so the app stays schedulable');
        phase = 'gone';
        window.juliet.gone();
        return;
      }
      setTimeout(() => show(p, tries + 1), 100);
      return;
    }
    fill(p);
    bubble.hidden = true;
    pendingLeave = null;
    // walk in from the left edge and stop 20–40 % across, on a whole number of steps so the stride completes
    const target = W() * (0.2 + Math.random() * 0.2);
    walkFrom = -CELL;
    walkCycles = Math.max(1, Math.ceil((target - walkFrom) / CYCLE_PX));
    stopX = walkFrom + walkCycles * CYCLE_PX;
    setX(walkFrom);
    const now = performance.now();
    startClip('walkRight', now);
    phase = 'walkIn';
    nextFrame(loop);
  }
  function act(id) {
    if (phase !== 'talk') return;
    clearTimeout(timeoutId);
    // The bubble stays up (talkToUser keeps looping "while a message is visible"); grey the buttons for feedback.
    buttonsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    phase = 'acted';
    // Watchdog: if main never answers (crash mid-handler), don't sit here forever — leave on our own.
    timeoutId = setTimeout(() => leave({ hop: false }), ACTED_WATCHDOG_MS);
    window.juliet.action(id);
  }
  function leave(p) {
    const hop = !!(p && p.hop);
    if (phase === 'walkIn' || phase === 'turnIn') { pendingLeave = { hop }; return; } // finish arriving first
    if (phase !== 'talk' && phase !== 'acted') return;
    clearTimeout(timeoutId);
    if (hop) {
      // Celebrate in the bubble (no jump pose exists in the sprite pack, and bouncing the sprite reads as flying).
      phase = 'cheer';
      titleEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      lineEl.textContent = '';
      buttonsEl.replaceChildren();
      bubble.hidden = false;
      setTimeout(turnBack, CHEER_MS);
    } else turnBack();
  }
  function turnBack() {
    bubble.hidden = true;            // speech ends exactly when she stops talking to the user
    window.juliet.setHit(false);     // release mouse capture; the rest of the walk is click-through
    phase = 'turnBack';
    startClip('turnBackRight', performance.now());
  }

  function loop(now) {
    const t = now - clipStart;
    if (phase === 'walkIn') {
      if (t >= walkCycles * CYCLE_MS) {
        setX(stopX);
        startClip('turnToUser', now);
        phase = 'turnIn';
      } else {
        setX(walkFrom + (SPEED * t) / 1000);
        draw(clip.sheet, A.stepAt(clip, t).frame);
      }
    } else if (phase === 'turnIn') {
      const step = A.stepAt(clip, t);
      if (step) draw(clip.sheet, step.frame);
      else {
        startClip('talkToUser', now);
        phase = 'talk';
        if (pendingLeave) { const pl = pendingLeave; pendingLeave = null; leave(pl); }
      }
    } else if (phase === 'talk' || phase === 'acted' || phase === 'cheer') {
      const step = A.stepAt(clip, t);
      draw(clip.sheet, step.frame);
      frameEvents(step);
    } else if (phase === 'turnBack') {
      const step = A.stepAt(clip, t);
      if (step) draw(clip.sheet, step.frame);
      else afterEvents(); // → resumeWalkRight → walkOut
    } else if (phase === 'walkOut') {
      setX(walkFrom + (SPEED * t) / 1000);
      draw(clip.sheet, A.stepAt(clip, t).frame);
      if (x > W()) { phase = 'gone'; window.juliet.gone(); return; }
    } else return;
    nextFrame(loop);
  }

  // Only capture the mouse while she is talking (bubble + buttons live); walking is always click-through.
  hit.addEventListener('pointerenter', () => { if (phase === 'talk' || phase === 'acted' || phase === 'cheer') window.juliet.setHit(true); });
  hit.addEventListener('pointerleave', () => window.juliet.setHit(false));
  canvas.addEventListener('click', () => act('cat'));

  window.juliet.onShow(show);
  window.juliet.onLeave(leave);
})();
