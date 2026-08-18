'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/main/links');

test('googleUrl encodes title + " movie"', () => {
  assert.equal(L.googleUrl('Everything Everywhere All at Once'),
    'https://www.google.com/search?q=Everything%20Everywhere%20All%20at%20Once%20movie');
});

test('netflixUrl encodes apostrophes and ampersands', () => {
  assert.equal(L.netflixUrl("Ocean's 8 & Co"),
    "https://www.netflix.com/search?q=Ocean's%208%20%26%20Co");
});

test('movieLinks returns [google, netflix]', () => {
  const [g, n] = L.movieLinks('Her');
  assert.match(g, /^https:\/\/www\.google\.com\/search\?q=Her%20movie$/);
  assert.match(n, /^https:\/\/www\.netflix\.com\/search\?q=Her$/);
});

test('cleanMovieList trims, drops empties/dupes/placeholders', () => {
  const out = L.cleanMovieList('  Her \n\nher\nArrival\nPaste your watch-list here\n', ['Paste your watch-list here']);
  assert.deepEqual(out, ['Her', 'Arrival']);
});

test('pickMovie picks from unseen and moves it to seen (pure)', () => {
  const movies = { unseen: ['A', 'B', 'C'], seen: [] };
  const r = L.pickMovie(movies, () => 0.5); // index 1
  assert.equal(r.title, 'B');
  assert.deepEqual(r.movies, { unseen: ['A', 'C'], seen: ['B'] });
  assert.deepEqual(movies, { unseen: ['A', 'B', 'C'], seen: [] });
});

test('pickMovie resets when unseen is exhausted', () => {
  const r = L.pickMovie({ unseen: [], seen: ['A', 'B'] }, () => 0);
  assert.equal(r.title, 'A');
  assert.deepEqual(r.movies, { unseen: ['B'], seen: ['A'] });
});

test('pickMovie returns null when there are no movies at all', () => {
  assert.equal(L.pickMovie({ unseen: [], seen: [] }), null);
});

test('rerollMovie puts current back and picks a different one', () => {
  const r = L.rerollMovie({ unseen: ['B'], seen: ['A'] }, 'A', () => 0);
  assert.equal(r.title, 'B');
  assert.deepEqual(r.movies, { unseen: ['A'], seen: ['B'] });
});

test('rerollMovie with only one movie returns it again', () => {
  const r = L.rerollMovie({ unseen: [], seen: ['A'] }, 'A', () => 0);
  assert.equal(r.title, 'A');
  assert.deepEqual(r.movies, { unseen: [], seen: ['A'] });
});

test('unpickMovie moves a seen title back to unseen', () => {
  assert.deepEqual(L.unpickMovie({ unseen: ['B'], seen: ['A'] }, 'A'), { unseen: ['B', 'A'], seen: [] });
  assert.deepEqual(L.unpickMovie({ unseen: ['B'], seen: [] }, 'Z'), { unseen: ['B'], seen: [] });
});
