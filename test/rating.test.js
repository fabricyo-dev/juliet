'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/main/rating');

test('ten labels, 1..10, in Mirza\'s order and wording', () => {
  assert.equal(R.RATING_LABELS.length, 10);
  assert.equal(R.ratingLabel(1), 'i hate you you republican');
  assert.equal(R.ratingLabel(2), 'vibe coded slop');
  assert.equal(R.ratingLabel(5), 'first lyric of signs (I love that song)');
  assert.equal(R.ratingLabel(7), 'Mamdani would be proud');
  assert.equal(R.ratingLabel(9), 'ILY QUEEN');
  assert.equal(R.ratingLabel(10), 'ILYSM TAKE ME OUT ON A DATE (are you sure?)');
});

test('clampRating: strings, out-of-range, garbage', () => {
  assert.equal(R.clampRating('7'), 7);
  assert.equal(R.clampRating(0), 1);
  assert.equal(R.clampRating(42), 10);
  assert.equal(R.clampRating('abc'), null);
  assert.equal(R.ratingLabel('abc'), '');
});

test('reactions cover every band and never contain emojis', () => {
  const seen = new Set();
  for (let v = 1; v <= 10; v++) {
    const r = R.ratingReaction(v);
    assert.ok(r.length > 10, `reaction for ${v}`);
    assert.doesNotMatch(r, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    seen.add(r);
  }
  assert.equal(seen.size, 5);
  for (const l of R.RATING_LABELS) assert.doesNotMatch(l, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});

test('ratingSummary is a paste-able one-liner', () => {
  assert.equal(R.ratingSummary(8, new Date(2026, 7, 18, 7, 30)),
    'Areej rated Juliet 8/10 on 2026-08-18: "i should do cs as my major instead of finance (sometimes I wish)"');
});
