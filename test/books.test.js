'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBooks } = require('../src/main/books');
const { cmpVer } = require('../src/main/version');
const { defaultState } = require('../src/main/defaults');

test('default books: The Odyssey and Lolita, page 0', () => {
  const st = defaultState();
  assert.deepEqual(st.books.map((b) => [b.title, b.page]), [['The Odyssey', 0], ['Lolita', 0]]);
  assert.deepEqual(st.customPep, []);
});

test('normalizeBooks keeps ids, clamps pages, drops empty titles, mints ids for new rows', () => {
  const out = normalizeBooks([
    { id: 'odyssey', title: ' The Odyssey ', page: '214' },
    { id: 'lolita', title: 'Lolita', page: -3 },
    { title: 'Frankenstein', page: 'abc' },
    { title: '   ' },
    null,
  ], 42);
  assert.deepEqual(out, [
    { id: 'odyssey', title: 'The Odyssey', page: 214 },
    { id: 'lolita', title: 'Lolita', page: 0 },
    { id: 'book-42-2', title: 'Frankenstein', page: 0 },
  ]);
});

test('cmpVer orders semver-ish strings numerically', () => {
  assert.ok(cmpVer('1.3.0', '1.2.9') > 0);
  assert.ok(cmpVer('1.10.0', '1.9.9') > 0);
  assert.equal(cmpVer('1.2.3', '1.2.3'), 0);
  assert.ok(cmpVer('1.2', '1.2.1') < 0);
});
