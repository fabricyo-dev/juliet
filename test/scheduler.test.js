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
  st.settings.morningEnabled = false; // the good-morning cameo has its own test
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
  assert.deepEqual(S.tick(st, now + 61 * MIN, true, seq(0.5)), { kind: 'nudge', activityId: 'leetcode', from: 'snooze', via: 'mac' });
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
  assert.deepEqual(f, { kind: 'movie', via: 'mac' });
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
  assert.deepEqual(f, { kind: 'movie', via: 'mac' });
});

test('markDone appends to history', () => {
  const st = fresh(at(2026, 8, 18, 9));
  S.markDone(st, 'cs50', at(2026, 8, 18, 10));
  assert.deepEqual(st.history, [{ activityId: 'cs50', at: at(2026, 8, 18, 10), outcome: 'done' }]);
});

test('replanToday: fresh plan for today, past slots pre-consumed, no immediate fire', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.nudgesPerDay = 6;
  const now = at(2026, 8, 18, 15, 30);
  S.replanToday(st, now, Math.random);
  assert.equal(st.schedule.planDate, '2026-08-18');
  assert.equal(st.schedule.slots.length, 6);
  for (const t of st.schedule.slots) if (t <= now) assert.ok(st.schedule.fired.includes(t));
  assert.equal(S.tick(st, now, true, seq(0.5)), null); // nothing pending right after a save
  const future = st.schedule.slots.filter((t) => t > now);
  if (future.length) assert.equal(S.tick(st, future[0] + 1000, true, seq(0.5)).kind, 'nudge');
});

// ---- quiet mode ----
test('setQuiet: 2h / rest of today / off; isQuiet reflects it', () => {
  const st = fresh(at(2026, 8, 18, 9));
  const now = at(2026, 8, 18, 14, 10);
  S.setQuiet(st, now, 'hours2');
  assert.equal(st.schedule.quietUntil, now + 2 * H);
  assert.equal(S.isQuiet(st, now), true);
  assert.equal(S.isQuiet(st, now + 2 * H), false);
  S.setQuiet(st, now, 'today');
  assert.equal(st.schedule.quietUntil, at(2026, 8, 19, 0, 0));
  assert.equal(S.isQuiet(st, at(2026, 8, 18, 23, 59)), true);
  assert.equal(S.isQuiet(st, at(2026, 8, 19, 0, 0)), false);
  S.setQuiet(st, now, 'off');
  assert.equal(st.schedule.quietUntil, null);
  assert.equal(S.isQuiet(st, now), false);
});

test('tick never fires while quiet, holds the slot, fires after quiet ends (inside hours)', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  S.setQuiet(st, at(2026, 8, 18, 11), 'hours2'); // until 13:00
  assert.equal(S.tick(st, at(2026, 8, 18, 12, 1), true, seq(0.5)), null);
  assert.deepEqual(st.schedule.fired, []);
  assert.equal(S.tick(st, at(2026, 8, 18, 13, 1), true, seq(0.5)).kind, 'nudge');
});

test('tick: remindersOff silences everything — due slot, movie, pep — on mac and phone', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.remindersOff = true;
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  st.schedule.movieNextAt = at(2026, 8, 18, 12, 30);
  st.schedule.pepAt = at(2026, 8, 18, 13); st.schedule.pepFired = false;
  for (let h = 9; h <= 21; h++) {
    assert.equal(S.tick(st, at(2026, 8, 18, h, 45), true, seq(0.5)), null);
    assert.equal(S.tick(st, at(2026, 8, 18, h, 50), false, seq(0.5), { phone: true }), null);
  }
  // switch back on next morning: yesterday's stale slot/pep were expired, movie clock moved on — no burst
  st.settings.remindersOff = false;
  assert.equal(S.tick(st, at(2026, 8, 19, 9, 5), true, seq(0.5)), null);
  assert.ok(st.schedule.movieNextAt > at(2026, 8, 19, 9, 5));
});

test('tick: rest-of-today quiet drops today\'s slots at active end and clears itself tomorrow', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 15)]; st.schedule.fired = [];
  S.setQuiet(st, at(2026, 8, 18, 14), 'today');
  assert.equal(S.tick(st, at(2026, 8, 18, 22, 30), true, seq(0.5)), null);
  assert.deepEqual(st.schedule.fired, [at(2026, 8, 18, 15)]);
  S.tick(st, at(2026, 8, 19, 9, 5), true, seq(0.5));
  assert.equal(st.schedule.quietUntil, null); // expired quiet is cleaned up
});

// ---- weekly recap ----
test('recap: due Sunday 18:00, held while absent, fires when present, movie wins over recap', () => {
  const st = fresh(at(2026, 8, 18, 9)); // Tue
  assert.equal(st.schedule.recapNextAt, at(2026, 8, 23, 18)); // Sun
  st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.movieNextAt = at(2026, 9, 25, 19); // keep Friday's (held) movie out of the way
  assert.equal(S.tick(st, at(2026, 8, 23, 18, 1), false, seq(0.5)), null);
  assert.deepEqual(S.tick(st, at(2026, 8, 23, 19), true, seq(0.5)), { kind: 'recap', via: 'mac' });
  assert.equal(st.schedule.recapNextAt, at(2026, 8, 30, 18));
  // movie + recap due at once → movie first, recap on the next tick
  st.settings.movieDay = 0; st.settings.movieTime = '18:00';
  st.schedule.movieNextAt = at(2026, 8, 30, 18);
  assert.deepEqual(S.tick(st, at(2026, 8, 30, 18, 1), true, seq(0.5)), { kind: 'movie', via: 'mac' });
  assert.deepEqual(S.tick(st, at(2026, 8, 30, 18, 2), true, seq(0.5)), { kind: 'recap', via: 'mac' });
});

test('recap: disabled → never fires; dropped after 48 h', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.movieNextAt = at(2026, 9, 25, 19);
  st.settings.activeStart = '20:00'; st.settings.activeEnd = '22:00'; // no nudge slot can be due at 19:00
  st.settings.recapEnabled = false;
  assert.equal(S.tick(st, at(2026, 8, 23, 19), true, seq(0.5)), null);
  st.settings.recapEnabled = true;
  st.schedule.recapNextAt = at(2026, 8, 23, 18);
  S.tick(st, at(2026, 8, 25, 20), false, seq(0.5)); // Tue 20:00 > 48h
  assert.equal(st.schedule.recapNextAt, at(2026, 8, 30, 18));
});

test('markOpened records an "opened" outcome; recapSummary counts the last 7 days and finds the best day', () => {
  const st = fresh(at(2026, 8, 18, 9));
  S.markDone(st, 'cs50', at(2026, 8, 18, 10));      // Tue
  S.markDone(st, 'leetcode', at(2026, 8, 18, 15));  // Tue
  S.markDone(st, 'usaco', at(2026, 8, 20, 11));     // Thu
  S.markOpened(st, 'arxiv', at(2026, 8, 21, 12));   // Fri
  S.markDone(st, 'old', at(2026, 8, 10, 12));       // > 7 days ago
  assert.equal(st.history.find((h) => h.activityId === 'arxiv').outcome, 'opened');
  const r = S.recapSummary(st.history, at(2026, 8, 23, 18));
  assert.equal(r.done, 3); assert.equal(r.opened, 1); assert.equal(r.bestDay, 'Tuesday');
  assert.equal(r.line, 'This week: 3 done · 1 opened · best day Tuesday.');
  const empty = S.recapSummary([{ activityId: 'x', at: at(2026, 8, 1, 1) }], at(2026, 8, 23, 18));
  assert.deepEqual([empty.done, empty.opened, empty.bestDay], [0, 0, null]);
  assert.match(empty.line, /quiet week/i);
});

test('history entries without an outcome count as done (older versions)', () => {
  const r = S.recapSummary([{ activityId: 'a', at: at(2026, 8, 22, 9) }], at(2026, 8, 23, 18));
  assert.equal(r.done, 1);
});

// ---- pep talks ----
test('planPep: pepPerWeek/7 chance per day; time inside active hours and ≥ 30 min from every nudge slot', () => {
  const settings = { nudgesPerDay: 3, activeStart: '09:00', activeEnd: '22:00', pepPerWeek: 3 };
  const day = at(2026, 8, 18);
  const slots = S.planDay(settings, day, Math.random);
  // first rng draw is the daily coin: 0.9 > 3/7 → no pep today
  assert.equal(S.planPep(settings, day, slots, seq(0.9)), null);
  let planned = 0;
  for (let k = 0; k < 40; k++) {
    const t = S.planPep(settings, day, slots, seq(0.1, Math.random(), Math.random(), Math.random(), Math.random(), Math.random()));
    assert.ok(t !== null);
    planned++;
    assert.ok(t >= at(2026, 8, 18, 9) && t < at(2026, 8, 18, 22));
    for (const s of slots) assert.ok(Math.abs(t - s) >= 30 * MIN, 'pep keeps its distance from nudges');
  }
  assert.equal(planned, 40);
  assert.equal(S.planPep({ ...settings, pepPerWeek: 0 }, day, slots, seq(0.0)), null);
  assert.notEqual(S.planPep({ ...settings, pepPerWeek: 7 }, day, slots, seq(0.999, 0.5)), null);
});

test('tick fires a pep once when due and present, holds while absent, drops after active end', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.pepPerWeek = 7;
  st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.pepAt = at(2026, 8, 18, 15); st.schedule.pepFired = false;
  assert.equal(S.tick(st, at(2026, 8, 18, 15, 1), false, seq(0.5)), null);
  assert.deepEqual(S.tick(st, at(2026, 8, 18, 15, 3), true, seq(0.5)), { kind: 'pep', via: 'mac' });
  assert.equal(st.schedule.pepFired, true);
  assert.equal(S.tick(st, at(2026, 8, 18, 15, 4), true, seq(0.5)), null);
  // held past active end → dropped, not fired tomorrow morning
  st.schedule.pepAt = at(2026, 8, 18, 21, 50); st.schedule.pepFired = false;
  assert.equal(S.tick(st, at(2026, 8, 18, 22, 5), true, seq(0.5)), null);
  assert.equal(st.schedule.pepFired, true);
});

test('tick: a nudge slot pending at the same time wins and the pep is folded (no back-to-back visits)', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  st.schedule.pepAt = at(2026, 8, 18, 12, 0); st.schedule.pepFired = false;
  assert.equal(S.tick(st, at(2026, 8, 18, 12, 1), true, seq(0.5)).kind, 'nudge');
  assert.equal(st.schedule.pepFired, true);
  assert.equal(S.tick(st, at(2026, 8, 18, 12, 2), true, seq(0.5)), null);
});

test('new day plans a pep; replanToday keeps a pep that already passed as consumed', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.pepPerWeek = 7;
  S.tick(st, at(2026, 8, 19, 8), false, seq(0.5));
  assert.ok(st.schedule.pepAt >= at(2026, 8, 19, 9) && st.schedule.pepAt < at(2026, 8, 19, 22));
  assert.equal(st.schedule.pepFired, false);
  S.replanToday(st, at(2026, 8, 19, 21, 59), seq(0.5));
  assert.equal(st.schedule.pepFired, st.schedule.pepAt <= at(2026, 8, 19, 21, 59));
});

// ---- gentle return ----
test('needsGentleReturn: true after 5+ days without done/opened, false when recent or brand new', () => {
  const now = at(2026, 8, 25, 12);
  const st = fresh(at(2026, 8, 18, 9));
  st.firstRunAt = at(2026, 8, 1, 9);
  assert.equal(S.needsGentleReturn(st, now), true);            // long-time user, no history at all
  S.markOpened(st, 'arxiv', at(2026, 8, 22, 12));               // 3 days ago
  assert.equal(S.needsGentleReturn(st, now), false);
  st.history = [{ activityId: 'cs50', at: at(2026, 8, 19, 12), outcome: 'done' }]; // 6 days ago
  assert.equal(S.needsGentleReturn(st, now), true);
  const brandNew = fresh(at(2026, 8, 24, 9)); brandNew.firstRunAt = at(2026, 8, 24, 9);
  assert.equal(S.needsGentleReturn(brandNew, now), false);      // day-old install, nothing yet — not "away"
});

test('chooseEasyActivity prefers enabled easy ones, falls back to any enabled', () => {
  const acts = [{ id: 'a', enabled: true }, { id: 'b', enabled: true, easy: true }, { id: 'c', enabled: false, easy: true }];
  for (let i = 0; i < 10; i++) assert.equal(S.chooseEasyActivity(acts, [], Math.random).id, 'b');
  assert.equal(S.chooseEasyActivity([{ id: 'a', enabled: true }], [], Math.random).id, 'a');
  assert.equal(S.chooseEasyActivity([{ id: 'c', enabled: false, easy: true }], [], Math.random), null);
});

// ---- goodnight ----
test('goodnight: off by default; when enabled fires once ~90 min after active end, also after midnight, never twice', () => {
  const st = fresh(at(2026, 8, 18, 9));            // active 09:00–22:00
  st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.movieNextAt = at(2026, 9, 25, 19); st.schedule.recapNextAt = at(2026, 9, 27, 18);
  assert.equal(S.tick(st, at(2026, 8, 18, 23, 35), true, seq(0.5)), null); // disabled
  st.settings.goodnightEnabled = true;
  assert.equal(S.tick(st, at(2026, 8, 18, 23, 20), true, seq(0.5)), null); // too early (< end + 90 min)
  assert.equal(S.tick(st, at(2026, 8, 18, 23, 35), false, seq(0.5)), null); // absent
  assert.deepEqual(S.tick(st, at(2026, 8, 18, 23, 35), true, seq(0.5)), { kind: 'goodnight', via: 'mac' });
  assert.equal(S.tick(st, at(2026, 8, 18, 23, 50), true, seq(0.5)), null); // once per night
  assert.equal(S.tick(st, at(2026, 8, 19, 1, 10), true, seq(0.5)), null);  // still the same night
  // next evening, after midnight this time
  assert.deepEqual(S.tick(st, at(2026, 8, 20, 0, 40), true, seq(0.5)), { kind: 'goodnight', via: 'mac' });
  // too late into the night (past end + 6 h) → skipped
  assert.equal(S.tick(st, at(2026, 8, 21, 4, 30), true, seq(0.5)), null);
});

// ---- review fixes ----
test('tick tags where a nudge came from (slot vs snooze)', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  assert.equal(S.tick(st, at(2026, 8, 18, 12, 1), true, seq(0.5)).from, 'slot');
});

test('replanToday keeps a pep already delivered today, but re-rolls on a new day', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.pepPerWeek = 7;
  st.schedule.pepAt = at(2026, 8, 18, 10); st.schedule.pepFired = true; // delivered this morning
  S.replanToday(st, at(2026, 8, 18, 14), seq(0.5));
  assert.equal(st.schedule.pepFired, true);
  st.schedule.slots = []; st.schedule.fired = [];
  for (let h = 14; h < 22; h++) assert.notEqual((S.tick(st, at(2026, 8, 18, h, 30), true, seq(0.5)) || {}).kind, 'pep');
  // stale planDate from yesterday + Settings save before the first tick → today still gets its pep
  st.schedule.planDate = '2026-08-18'; st.schedule.pepFired = true;
  S.replanToday(st, at(2026, 8, 19, 9, 5), seq(0.5));
  assert.equal(st.schedule.pepFired, false);
  assert.ok(st.schedule.pepAt >= at(2026, 8, 19, 9));
});

test('recap switched off never accumulates a stale due time; switching on does not fire immediately', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.recapEnabled = false;
  st.schedule.movieNextAt = at(2026, 9, 25, 19);
  st.schedule.slots = []; st.schedule.fired = [];
  S.tick(st, at(2026, 8, 24, 9, 5), true, seq(0.5)); // Monday, the Sunday recap passed while off
  assert.equal(st.schedule.recapNextAt, at(2026, 8, 30, 18)); // rolled forward, not stale
  st.settings.recapEnabled = true;
  assert.equal(S.tick(st, at(2026, 8, 24, 9, 6), true, seq(0.5)), null);
});

// ---- phone channel (away from the Mac) ----
test('tick with opts.phone delivers a due nudge via phone when absent, via mac when present', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  const f = S.tick(st, at(2026, 8, 18, 12, 1), false, seq(0.5), { phone: true });
  assert.equal(f.kind, 'nudge'); assert.equal(f.via, 'phone');
  st.schedule.slots = [at(2026, 8, 18, 15)]; st.schedule.fired = [];
  const g = S.tick(st, at(2026, 8, 18, 15, 1), true, seq(0.5), { phone: true });
  assert.equal(g.kind, 'nudge'); assert.equal(g.via, 'mac');
});

test('phone channel: still silent during quiet and outside active hours; goodnight never goes to the phone', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = [at(2026, 8, 18, 12)]; st.schedule.fired = [];
  S.setQuiet(st, at(2026, 8, 18, 11, 50), 'hours2');
  assert.equal(S.tick(st, at(2026, 8, 18, 12, 1), false, seq(0.5), { phone: true }), null);
  st.settings.goodnightEnabled = true;
  st.schedule.quietUntil = null; st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.movieNextAt = at(2026, 9, 25, 19); st.schedule.recapNextAt = at(2026, 9, 27, 18);
  assert.equal(S.tick(st, at(2026, 8, 18, 23, 40), false, seq(0.5), { phone: true }), null);
  assert.equal(st.schedule.goodnightDate, null); // not consumed either
});

test('phone channel: movie and pep due while away go to the phone', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.schedule.slots = []; st.schedule.fired = [];
  const m = S.tick(st, at(2026, 8, 21, 19, 5), false, seq(0.5), { phone: true }); // Fri movie
  assert.deepEqual(m, { kind: 'movie', via: 'phone' });
  st.settings.pepPerWeek = 7; st.schedule.pepAt = at(2026, 8, 21, 20); st.schedule.pepFired = false;
  st.schedule.recapNextAt = at(2026, 9, 27, 18);
  st.schedule.slots = []; st.schedule.fired = []; // Friday's freshly planned slots would pre-empt the pep
  assert.deepEqual(S.tick(st, at(2026, 8, 21, 20, 1), false, seq(0.5), { phone: true }), { kind: 'pep', via: 'phone' });
});

// ---- cameos: check-in, stroll, good morning ----
test('planCameo keeps its distance from every avoid time and honours the weekly coin', () => {
  const settings = { activeStart: '09:00', activeEnd: '22:00' };
  const day = at(2026, 8, 18);
  const avoid = [at(2026, 8, 18, 12), at(2026, 8, 18, 16)];
  assert.equal(S.planCameo(settings, day, avoid, 0, seq(0.0)), null);
  assert.equal(S.planCameo(settings, day, avoid, 2, seq(0.9)), null); // coin fails (0.9 > 2/7)
  for (let k = 0; k < 30; k++) {
    const t = S.planCameo(settings, day, avoid, 7, seq(0.1, Math.random(), Math.random(), Math.random(), Math.random()));
    assert.ok(t >= at(2026, 8, 18, 9) && t < at(2026, 8, 18, 22));
    for (const a of avoid) assert.ok(Math.abs(t - a) >= 30 * MIN);
  }
});

test('new day plans pep, checkin and stroll (each ≥30 min from the others when planned)', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.pepPerWeek = 7; st.settings.checkinPerWeek = 7; st.settings.strollPerWeek = 7;
  S.tick(st, at(2026, 8, 19, 8), false, seq(0.1, 0.3, 0.1, 0.6, 0.1, 0.9, 0.1, 0.4, 0.1, 0.5));
  const { pepAt, checkinAt, strollAt } = st.schedule;
  assert.ok(pepAt && checkinAt && strollAt);
  const times = [pepAt, checkinAt, strollAt].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 30 * MIN, 'cameos spaced');
});

test('checkin and stroll fire once when due and present (mac only), fold under a pending nudge', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.checkinPerWeek = 7; st.settings.strollPerWeek = 7;
  st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.checkinAt = at(2026, 8, 18, 14); st.schedule.checkinFired = false;
  st.schedule.strollAt = at(2026, 8, 18, 16); st.schedule.strollFired = false;
  assert.equal(S.tick(st, at(2026, 8, 18, 14, 1), false, seq(0.5), { phone: true }), null); // never to the phone
  assert.deepEqual(S.tick(st, at(2026, 8, 18, 14, 2), true, seq(0.5)), { kind: 'checkin', via: 'mac' });
  assert.equal(S.tick(st, at(2026, 8, 18, 14, 3), true, seq(0.5)), null);
  assert.deepEqual(S.tick(st, at(2026, 8, 18, 16, 1), true, seq(0.5)), { kind: 'stroll', via: 'mac' });
  // fold: a nudge slot and a stroll both pending → nudge only, stroll consumed
  st.schedule.slots = [at(2026, 8, 18, 18)]; st.schedule.fired = [];
  st.schedule.strollAt = at(2026, 8, 18, 18); st.schedule.strollFired = false;
  assert.equal(S.tick(st, at(2026, 8, 18, 18, 1), true, seq(0.5)).kind, 'nudge');
  assert.equal(st.schedule.strollFired, true);
});

test('good morning: once per day, first presence within 4 h of active start, skipped when a nudge is already due', () => {
  const st = fresh(at(2026, 8, 18, 9));
  st.settings.morningEnabled = true;
  st.schedule.slots = [at(2026, 8, 18, 15)]; st.schedule.fired = [];
  assert.equal(S.tick(st, at(2026, 8, 18, 8, 30), true, seq(0.5)), null);              // before active start
  assert.deepEqual(S.tick(st, at(2026, 8, 18, 9, 10), true, seq(0.5)), { kind: 'morning', via: 'mac' });
  assert.equal(S.tick(st, at(2026, 8, 18, 9, 11), true, seq(0.5)), null);              // once
  // next day: she only shows up at 15:00 → too late for a morning
  S.tick(st, at(2026, 8, 19, 15, 0), false, seq(0.5));
  st.schedule.slots = []; st.schedule.fired = [];
  assert.equal(S.tick(st, at(2026, 8, 19, 15, 1), true, seq(0.5)), null);
  // day after: a nudge is due at the same moment → the nudge is the hello, morning consumed
  S.tick(st, at(2026, 8, 20, 8, 0), false, seq(0.5));
  st.schedule.slots = [at(2026, 8, 20, 9, 5)]; st.schedule.fired = [];
  assert.equal(S.tick(st, at(2026, 8, 20, 9, 6), true, seq(0.5)).kind, 'nudge');
  assert.equal(st.schedule.morningDate, '2026-08-20');
  // disabled → never
  st.settings.morningEnabled = false;
  S.tick(st, at(2026, 8, 21, 8, 0), false, seq(0.5));
  st.schedule.slots = []; st.schedule.fired = [];
  assert.equal(S.tick(st, at(2026, 8, 21, 9, 6), true, seq(0.5)), null);
});

// ---- movie follow-up ----
test('noteMovieOpened schedules a follow-up next day at noon; fires once when present; dropped after 48 h', () => {
  const st = fresh(at(2026, 8, 21, 9));
  st.schedule.slots = []; st.schedule.fired = [];
  st.schedule.movieNextAt = at(2026, 9, 25, 19); st.schedule.recapNextAt = at(2026, 9, 27, 18);
  S.noteMovieOpened(st, 'Her', at(2026, 8, 21, 20));
  assert.deepEqual(st.schedule.followup, { title: 'Her', at: at(2026, 8, 22, 12) });
  S.tick(st, at(2026, 8, 22, 10), false, seq(0.5)); st.schedule.slots = []; st.schedule.fired = []; // plan the day, keep nudges out of the way
  assert.equal(S.tick(st, at(2026, 8, 22, 11), true, seq(0.5)), null);
  assert.equal(S.tick(st, at(2026, 8, 22, 12, 1), false, seq(0.5), { phone: true }), null); // mac only
  assert.deepEqual(S.tick(st, at(2026, 8, 22, 12, 2), true, seq(0.5)), { kind: 'followup', title: 'Her', via: 'mac' });
  assert.equal(st.schedule.followup, null);
  S.noteMovieOpened(st, 'Arrival', at(2026, 8, 22, 21));
  S.tick(st, at(2026, 8, 25, 13), false, seq(0.5)); // > 48 h past due while away → dropped
  assert.equal(st.schedule.followup, null);
  S.noteMovieOpened(st, 'Her', at(2026, 8, 25, 20)); S.clearMovieFollowup(st);
  assert.equal(st.schedule.followup, null);
});

// ---- milestones ----
test('milestoneFor returns a line only at 10/25/50/100/250 done', () => {
  assert.equal(S.milestoneFor(9), null);
  assert.match(S.milestoneFor(10), /ten/i);
  assert.match(S.milestoneFor(25), /twenty-five/i);
  assert.match(S.milestoneFor(50), /fifty/i);
  assert.match(S.milestoneFor(100), /hundred/i);
  assert.match(S.milestoneFor(250), /two hundred and fifty/i);
  assert.equal(S.milestoneFor(11), null);
  for (const n of [10, 25, 50, 100, 250]) assert.doesNotMatch(S.milestoneFor(n), /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});
test('countDone counts done outcomes (and legacy entries), not opened', () => {
  assert.equal(S.countDone([{ outcome: 'done' }, { outcome: 'opened' }, {}]), 2);
});
