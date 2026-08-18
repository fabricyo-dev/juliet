'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, loadState } = require('../src/main/store');
const { defaultState, DEFAULT_ACTIVITIES } = require('../src/main/defaults');

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'juliet-'));
  return path.join(dir, 'state.json');
}

test('loadState returns defaults when file is missing', () => {
  const { state, recovered } = loadState(tmpFile(), defaultState);
  assert.equal(recovered, false);
  assert.equal(state.settings.nudgesPerDay, 3);
  assert.equal(state.activities.length, DEFAULT_ACTIVITIES.length);
});

test('save then load round-trips and fills missing keys from defaults', () => {
  const f = tmpFile();
  const s = createStore(f, defaultState);
  s.state.settings.nudgesPerDay = 5;
  s.state.movies.unseen = ['Her'];
  s.save();
  const back = loadState(f, defaultState).state;
  assert.equal(back.settings.nudgesPerDay, 5);
  assert.deepEqual(back.movies, { unseen: ['Her'], seen: [] });

  fs.writeFileSync(f, JSON.stringify({ version: 1, settings: { nudgesPerDay: 5 }, movies: { unseen: ['Her'] } }));
  const { state } = loadState(f, defaultState);
  assert.equal(state.settings.nudgesPerDay, 5);
  assert.equal(state.settings.activeStart, '09:00'); // filled
  assert.deepEqual(state.movies, { unseen: ['Her'], seen: [] });
  assert.equal(state.activities.length, DEFAULT_ACTIVITIES.length); // filled
  assert.deepEqual(state.schedule.slots, []);
});

test('corrupt file is backed up and defaults are used', () => {
  const f = tmpFile();
  fs.writeFileSync(f, '{not json');
  const { state, recovered } = loadState(f, defaultState);
  assert.equal(recovered, true);
  assert.equal(state.settings.nudgesPerDay, 3);
  const bad = fs.readdirSync(path.dirname(f)).filter((n) => n.startsWith('state.json.bad-'));
  assert.equal(bad.length, 1);
});

test('save is atomic: no tmp file left behind', () => {
  const f = tmpFile();
  const s = createStore(f, defaultState);
  s.save();
  assert.deepEqual(fs.readdirSync(path.dirname(f)), ['state.json']);
});
