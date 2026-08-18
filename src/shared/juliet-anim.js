// Juliet animation definitions — mirrors assets/juliet/juliet-animations.json and the two
// spritesheet JSONs (test/anim.test.js asserts they never drift). UMD: Node + browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JULIET_ANIM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CELL = 128;                 // frame cell size in sheet px
  const ANCHOR = { x: 64, y: 120 }; // ground contact point inside a cell
  const COLUMNS = 4;                // 4 × 2 cells per 512 × 256 sheet
  const DEFAULT_SPEECH = 'Hi!';     // preview default only; real text arrives at runtime

  // paths relative to assets/juliet/
  const SHEETS = {
    walk: { image: 'walk/juliet-walk-spritesheet.png', durations: [100, 100, 100, 100, 100, 100, 100, 100] },
    turnTalk: { image: 'turn-talk/juliet-turn-talk-spritesheet.png', durations: [250, 140, 140, 160, 300, 120, 120, 320] },
  };

  // frames are 1-based sheet indices, read left→right, top→bottom
  const CLIPS = {
    walkRight: { sheet: 'walk', frames: [1, 2, 3, 4, 5, 6, 7, 8], loop: true, events: [] },
    turnToUser: { sheet: 'turnTalk', frames: [1, 2, 3, 4], loop: false, events: [] },
    talkToUser: { sheet: 'turnTalk', frames: [5, 6, 7, 8], loop: true, events: [{ frame: 5, type: 'speechStart' }] },
    turnBackRight: { sheet: 'turnTalk', frames: [4, 3, 2, 1], loop: false, events: [{ after: 1, type: 'resumeWalkRight' }] },
  };

  // 1-based frame index → {x, y} of its cell on the sheet
  function frameRect(index) {
    const i = index - 1;
    return { x: (i % COLUMNS) * CELL, y: Math.floor(i / COLUMNS) * CELL, w: CELL, h: CELL };
  }

  // Expand a clip into [{frame, ms, start, end}] plus total duration.
  function timeline(name) {
    const clip = CLIPS[name];
    const durations = SHEETS[clip.sheet].durations;
    let t = 0;
    const steps = clip.frames.map((frame) => {
      const ms = durations[frame - 1];
      const step = { frame, ms, start: t, end: t + ms };
      t += ms;
      return step;
    });
    return { steps, total: t, loop: clip.loop, sheet: clip.sheet, events: clip.events };
  }

  // Which step is showing at elapsed ms (loops if the clip loops); null once a non-loop clip is done.
  function stepAt(tl, elapsed) {
    if (elapsed < 0) elapsed = 0;
    if (tl.loop) elapsed %= tl.total;
    else if (elapsed >= tl.total) return null;
    for (let i = 0; i < tl.steps.length; i++) if (elapsed < tl.steps[i].end) return { index: i, ...tl.steps[i] };
    return null;
  }

  return { CELL, ANCHOR, COLUMNS, DEFAULT_SPEECH, SHEETS, CLIPS, frameRect, timeline, stepAt };
});
