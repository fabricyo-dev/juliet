'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const S = require('../src/shared/sprite-data');
const { encodePNG } = require('../src/shared/png');

test('every frame is 16 rows of 16 legal chars', () => {
  assert.equal(S.FRAMES.length, 8);
  for (const f of S.FRAMES) {
    assert.equal(f.length, 16);
    for (const row of f) { assert.equal(row.length, 16, row); assert.match(row, /^[.kglwpe]{16}$/); }
  }
  assert.equal(S.TRAY_FACE.length, 16);
  for (const row of S.TRAY_FACE) assert.equal(row.length, 16);
});

test('walk frames keep feet on the baseline (row 15 non-empty)', () => {
  for (const i of S.FRAME_INDEX.WALK) assert.notEqual(S.FRAMES[i][15], '................');
});

test('encodePNG produces a valid PNG with correct IHDR', () => {
  const w = 2, h = 2;
  const rgba = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]);
  const png = encodePNG(w, h, rgba);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2); assert.equal(png.readUInt32BE(20), 2);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  const raw = zlib.inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, (w * 4 + 1) * h);
});
