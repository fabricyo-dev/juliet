'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/main/scheduler');
const { defaultState } = require('../src/main/defaults');

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const MIN = 60_000, H = 3_600_000;

test('parseHM', () => { assert.equal(S.parseHM('09:30'), 570); assert.equal(S.parseHM('22:00'), 1320); });

test('activeWindow uses local day of the given time', () => {
  const w = S.activeWindow({ activeStart: '09:00', activeEnd: '22:00' }, at(2026, 8, 18, 3));
  assert.equal(w.start, at(2026, 8, 18, 9)); assert.equal(w.end, at(2026, 8, 18, 22));
});

test('planDay: N sorted times inside window, spaced', () => {
  const settings = { nudgesPerDay: 3, activeStart: '09:00', activeEnd: '22:00' };
  for (let k = 0; k < 50; k++) {
    const slots = S.planDay(settings, at(2026, 8, 18), Math.random);
    assert.equal(slots.length, 3);
    for (const t of slots) assert.ok(t >= at(2026, 8, 18, 9) && t < at(2026, 8, 18, 22));
    for (let i = 1; i < slots.length; i++) assert.ok(slots[i] - slots[i - 1] >= 45 * MIN, 'spacing');
  }
});

test('movieDueAt: next Friday 19:00 strictly after from', () => {
  const s = { movieDay: 5, movieTime: '19:00' };
  assert.equal(S.movieDueAt(s, at(2026, 8, 18, 12)), at(2026, 8, 21, 19)); // Tue -> Fri
  assert.equal(S.movieDueAt(s, at(2026, 8, 21, 19)), at(2026, 8, 28, 19)); // exactly due -> next week
  assert.equal(S.movieDueAt(s, at(2026, 8, 21, 18)), at(2026, 8, 21, 19)); // same day earlier
});

test('chooseActivity avoids the two most recent, only enabled', () => {
  const acts = [{ id: 'a', enabled: true }, { id: 'b', enabled: true }, { id: 'c', enabled: true }, { id: 'd', enabled: false }];
  for (let i = 0; i < 20; i++) {
    const a = S.chooseActivity(acts, ['a', 'b'], Math.random);
    assert.equal(a.id, 'c');
  }
  assert.equal(S.chooseActivity([{ id: 'x', enabled: false }], [], Math.random), null);
});

function fresh(now) {
  const st = defaultState();
  st.movies.unseen = ['Her'];
  S.tick(st, now, false, seq(0.5)); // plans the day, does not fire (absent)
  return st;
}

test('tick plans today on first call and does not fire before a slot', () => {
  const now = at(2026, 8, 18, 9, 0);
  const st = fresh(now);
  assert.equal(st.schedule.planDate, '2026-08-18');
  assert.equal(st.schedule.slots.length, 3);
  assert.equal(S.tick(st, now, true, seq(0.5)), null);
});

test('tick fires a nudge when a slot is due and she is present', () => {
  const now = at(2026, 8, 18, 9);
  const st = fresh(now);
  const t = st.schedule.slots[0];
  const fire = S.tick(st, t + 1000, true, seq(0.5));
  assert.equal(fire.kind, 'nudge');
  assert.ok(st.activities.some((a) => a.id === fire.activityId));
  assert.deepEqual(st.schedule.fired, [t]);
  assert.deepEqual(st.schedule.recent.slice(-1), [fire.activityId]);
});

test('tick holds a due slot while absent, then fires on return inside hours', () => {
  const now = at(2026, 8, 18, 9);
  const st = fresh(now);
  const t = st.schedule.slots[0];
  assert.equal(S.tick(st, t + 1000, false, seq(0.5)), null);
  assert.deepEqual(st.schedule.fired, []);
  const fire = S.tick(st, t + 20 * MIN, true, seq(0.5));
  assert.equal(fire.kind, 'nudge');
});

test('tick collapses multiple pending slots into one fire', () => {
  const now = at(2026, 8, 18, 9);
  const st = fresh(now);
  const last = st.schedule.slots[2];
  const fire = S.tick(st, last + 1000, true, seq(0.5));
  assert.equal(fire.kind, 'nudge');
  assert.deepEqual(st.schedule.fired, st.schedule.slots);
  assert.equal(S.tick(st, last + 2000, true, seq(0.5)), null);
});

test('tick drops slots once the active window has passed', () => {
  const now = at(2026, 8, 18, 9);
  const st = fresh(now);
  assert.equal(S.tick(st, at(2026, 8, 18, 22, 30), true, seq(0.5)), null);
  assert.deepEqual(st.schedule.fired, st.schedule.slots);
});

test('tick re-plans on a new day', () => {
  const st = fresh(at(2026, 8, 18, 9));
  const old = st.schedule.slots;
  S.tick(st, at(2026, 8, 19, 8), false, seq(0.5));
  assert.equal(st.schedule.planDate, '2026-08-19');
  assert.notDeepEqual(st.schedule.slots, old);
  assert.deepEqual(st.schedule.fired, []);
});

test('snooze fires the same activity after 60 min when present, and goes stale after 3 h', () => {
  const now = at(2026, 8, 18, 12);
  const st = fresh(now);
  st.schedule.slots = []; // isolate from random slots
  S.snooze(st, 'leetcode', now);
  assert.equal(S.tick(st, now + 30 * MIN, true, seq(0.5)), null);
  assert.deepEqual(S.tick(st, now + 61 * MIN, true, seq(0.5)), { kind: 'nudge', activityId: 'leetcode' });
  assert.deepEqual(st.schedule.snoozed, []);
  S.snooze(st, 'leetcode', now);
  assert.equal(S.tick(st, now + 5 * H, true, seq(0.5)), null); // stale, dropped
  assert.deepEqual(st.schedule.snoozed, []);
});

test('movie: due Friday 19:00, held while absent, fires on return, then next week', () => {
  const st = fresh(at(2026, 8, 18, 9)); // Tue
  assert.equal(st.schedule.movieNextAt, at(2026, 8, 21, 19));
  assert.equal(S.tick(st, at(2026, 8, 21, 19, 1), false, seq(0.5)), null);
  assert.equal(st.schedule.movieNextAt, at(2026, 8, 21, 19)); // still held
  const f = S.tick(st, at(2026, 8, 21, 21), true, seq(0.5));
  assert.deepEqual(f, { kind: 'movie' });
  assert.equal(st.schedule.movieNextAt, at(2026, 8, 28, 19));
});

test('movie: dropped after 48 h of absence', () => {
  const st = fresh(at(2026, 8, 18, 9));
  assert.equal(S.tick(st, at(2026, 8, 23, 20), false, seq(0.5)), null); // Sun 20:00 > 48h
  assert.equal(st.schedule.movieNextAt, at(2026, 8, 28, 19));
});

test('movie takes priority over a due nudge slot', () => {
  const st = fresh(at(2026, 8, 21, 9)); // Fri
  st.schedule.slots = [at(2026, 8, 21, 19)]; st.schedule.fired = [];
  const f = S.tick(st, at(2026, 8, 21, 19, 1), true, seq(0.5));
  assert.deepEqual(f, { kind: 'movie' });
});

test('markDone appends to history', () => {
  const st = fresh(at(2026, 8, 18, 9));
  S.markDone(st, 'cs50', at(2026, 8, 18, 10));
  assert.deepEqual(st.history, [{ activityId: 'cs50', at: at(2026, 8, 18, 10) }]);
});
