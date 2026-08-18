'use strict';
// Guards that the code's animation table mirrors the designer's JSON, and that the sheets are what the JSON says.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../src/shared/juliet-anim');
const { decodePNG } = require('../src/shared/png');

const ROOT = path.join(__dirname, '..', 'assets', 'juliet');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'juliet-animations.json'), 'utf8'));
const walkMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'walk', 'juliet-walk-spritesheet.json'), 'utf8'));
const turnMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'turn-talk', 'juliet-turn-talk-spritesheet.json'), 'utf8'));

test('clips mirror juliet-animations.json (frames, loop, events, sheets)', () => {
  const sheetFor = { 'walk/juliet-walk-spritesheet.png': 'walk', 'turn-talk/juliet-turn-talk-spritesheet.png': 'turnTalk' };
  assert.deepEqual(Object.keys(A.CLIPS), Object.keys(manifest.animations));
  for (const [name, def] of Object.entries(manifest.animations)) {
    const clip = A.CLIPS[name];
    assert.deepEqual(clip.frames, def.frames, name);
    assert.equal(clip.loop, def.loop, name);
    assert.deepEqual(clip.events, def.events || [], name);
    assert.equal(A.SHEETS[clip.sheet].image, def.sheet, name);
    assert.equal(clip.sheet, sheetFor[def.sheet], name);
  }
  assert.equal(A.DEFAULT_SPEECH, manifest.defaultSpeech);
  assert.equal(manifest.speechTextIsRuntimeEditable, true);
});

test('frame durations mirror the spritesheet JSONs', () => {
  const durs = (meta) => Object.values(meta.frames).map((f) => f.duration);
  assert.deepEqual(A.SHEETS.walk.durations, durs(walkMeta));
  assert.deepEqual(A.SHEETS.turnTalk.durations, durs(turnMeta));
  assert.equal(walkMeta.frameDurationMs, 100);
});

test('cell size, anchor and grid match the metadata', () => {
  for (const meta of [walkMeta, turnMeta]) {
    assert.equal(meta.frameWidth, A.CELL); assert.equal(meta.frameHeight, A.CELL);
    assert.equal(meta.columns, A.COLUMNS); assert.equal(meta.rows, 2); assert.equal(meta.frameCount, 8);
    for (const f of Object.values(meta.frames)) assert.deepEqual(f.anchor, A.ANCHOR);
  }
  // frameRect follows the metadata's cell positions in reading order
  Object.values(walkMeta.frames).forEach((f, i) => assert.deepEqual(A.frameRect(i + 1), f.frame));
});

test('sheets decode to 512×256 RGBA and every cell has opaque pixels standing on the anchor row', () => {
  for (const key of ['walk', 'turnTalk']) {
    const { width, height, rgba } = decodePNG(fs.readFileSync(path.join(ROOT, A.SHEETS[key].image)));
    assert.equal(width, 512); assert.equal(height, 256);
    for (let i = 1; i <= 8; i++) {
      const r = A.frameRect(i);
      let opaque = 0, lowest = -1;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        if (rgba[((r.y + y) * width + (r.x + x)) * 4 + 3] > 0) { opaque++; lowest = Math.max(lowest, y); }
      }
      assert.ok(opaque > 500, `${key} frame ${i} has art`);
      assert.ok(lowest >= A.ANCHOR.y - 6 && lowest <= A.ANCHOR.y + 6, `${key} frame ${i} feet near anchor row (lowest=${lowest})`);
    }
  }
});

test('timeline + stepAt: turnToUser is 690 ms, talk loops, turnBack ends then resumes', () => {
  const turn = A.timeline('turnToUser');
  assert.equal(turn.total, 250 + 140 + 140 + 160);
  assert.equal(A.stepAt(turn, 0).frame, 1);
  assert.equal(A.stepAt(turn, 249).frame, 1);
  assert.equal(A.stepAt(turn, 250).frame, 2);
  assert.equal(A.stepAt(turn, 689).frame, 4);
  assert.equal(A.stepAt(turn, 690), null);

  const talk = A.timeline('talkToUser');
  assert.equal(talk.total, 300 + 120 + 120 + 320);
  assert.equal(A.stepAt(talk, 0).frame, 5);
  assert.equal(A.stepAt(talk, talk.total + 10).frame, 5); // loops
  assert.deepEqual(talk.events, [{ frame: 5, type: 'speechStart' }]);

  const back = A.timeline('turnBackRight');
  assert.deepEqual(back.steps.map((s) => s.frame), [4, 3, 2, 1]);
  assert.equal(back.total, 160 + 140 + 140 + 250);
  assert.deepEqual(back.events, [{ after: 1, type: 'resumeWalkRight' }]);

  const walk = A.timeline('walkRight');
  assert.equal(walk.total, 800);
  assert.equal(A.stepAt(walk, 1600 + 350).frame, 4);
});

test('encode → decode round-trips RGBA', () => {
  const { encodePNG } = require('../src/shared/png');
  const rgba = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 9, 8, 7, 6]);
  const back = decodePNG(encodePNG(2, 2, rgba));
  assert.equal(back.width, 2); assert.equal(back.height, 2);
  assert.deepEqual([...back.rgba], [...rgba]);
});
