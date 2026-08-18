'use strict';
// Pure scheduling logic. All times are epoch ms; "day" boundaries use local time via Date.

const MIN = 60_000;
const SNOOZE_MS = 60 * MIN;
const SNOOZE_STALE_MS = 3 * 60 * MIN;
const MOVIE_HOLD_MS = 48 * 60 * MIN;
const TICK_MS = 30_000;

function parseHM(s) {
  const [h, m] = String(s).split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

function pad(n) { return String(n).padStart(2, '0'); }
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function atMinutes(ms, minutes) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
}

function activeWindow(settings, ms) {
  const start = atMinutes(ms, parseHM(settings.activeStart));
  let end = atMinutes(ms, parseHM(settings.activeEnd));
  if (end <= start) end = start + 60 * MIN; // degenerate config: give a 1h window
  return { start, end };
}

// N times inside [start, end): split into equal segments, draw from the middle 80% of each,
// which guarantees ≥ 20% of a segment between consecutive nudges.
function planDay(settings, ms, rng = Math.random) {
  const n = Math.max(1, Math.min(12, settings.nudgesPerDay | 0));
  const { start, end } = activeWindow(settings, ms);
  const seg = (end - start) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * seg + seg * (0.1 + 0.8 * rng());
    out.push(Math.floor(t / MIN) * MIN);
  }
  return out.sort((a, b) => a - b);
}

// Next occurrence of weekday `day` (0 = Sunday) at "HH:MM" strictly after fromMs.
function nextWeeklyAt(day, time, fromMs) {
  const target = parseHM(time);
  const d = new Date(fromMs);
  for (let i = 0; i < 8; i++) {
    const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, 0, target).getTime();
    if (new Date(cand).getDay() === (day | 0) && cand > fromMs) return cand;
  }
  throw new Error('nextWeeklyAt: no candidate');
}
function movieDueAt(settings, fromMs) { return nextWeeklyAt(settings.movieDay, settings.movieTime, fromMs); }
function recapDueAt(settings, fromMs) { return nextWeeklyAt(settings.recapDay, settings.recapTime, fromMs); }

// ---- quiet mode ("not now") ----
function isQuiet(state, now) {
  const q = state.schedule.quietUntil;
  return !!q && now < q;
}
// mode: 'hours2' | 'today' (until local midnight) | 'off'
function setQuiet(state, now, mode) {
  const sch = state.schedule;
  if (mode === 'hours2') sch.quietUntil = now + 2 * 60 * MIN;
  else if (mode === 'today') { const d = new Date(now); sch.quietUntil = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); }
  else sch.quietUntil = null;
}

function chooseActivity(activities, recent, rng = Math.random) {
  const enabled = activities.filter((a) => a.enabled);
  if (enabled.length === 0) return null;
  const avoid = new Set((recent || []).slice(-2));
  const pool = enabled.length >= 3 ? enabled.filter((a) => !avoid.has(a.id)) : enabled;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

function noteShown(sch, activityId) {
  sch.recent = [...(sch.recent || []), activityId].slice(-5);
}

// Returns {kind:'nudge', activityId} | {kind:'movie'} | null. Mutates state.schedule.
function tick(state, now, present, rng = Math.random) {
  const sch = state.schedule;
  const settings = state.settings;

  // 1. (re)plan the day
  const today = dayKey(now);
  if (sch.planDate !== today) {
    sch.planDate = today;
    sch.slots = planDay(settings, now, rng);
    sch.fired = [];
  }
  // 2. weekly bookkeeping (48 h hold, then drop to next occurrence)
  if (!sch.movieNextAt) sch.movieNextAt = movieDueAt(settings, now);
  if (now - sch.movieNextAt > MOVIE_HOLD_MS) sch.movieNextAt = movieDueAt(settings, now);
  if (!sch.recapNextAt) sch.recapNextAt = recapDueAt(settings, now);
  if (now - sch.recapNextAt > MOVIE_HOLD_MS) sch.recapNextAt = recapDueAt(settings, now);
  if (sch.quietUntil && now >= sch.quietUntil) sch.quietUntil = null; // quiet period over

  // 3. drop expired slots once the active window has passed
  const { start, end } = activeWindow(settings, now);
  const firedSet = new Set(sch.fired);
  if (now >= end) {
    for (const t of sch.slots) if (t <= now && !firedSet.has(t)) { sch.fired.push(t); firedSet.add(t); }
  }
  // 4. drop stale snoozes
  sch.snoozed = (sch.snoozed || []).filter((s) => now - s.at <= SNOOZE_STALE_MS);

  if (!present || isQuiet(state, now)) return null;

  // 5. movie, then weekly recap
  if (now >= sch.movieNextAt) {
    sch.movieNextAt = movieDueAt(settings, now);
    return { kind: 'movie' };
  }
  if (settings.recapEnabled && now >= sch.recapNextAt) {
    sch.recapNextAt = recapDueAt(settings, now);
    return { kind: 'recap' };
  }
  // 6. snoozed
  const dueSnooze = sch.snoozed.find((s) => s.at <= now);
  if (dueSnooze) {
    sch.snoozed = sch.snoozed.filter((s) => s !== dueSnooze);
    noteShown(sch, dueSnooze.activityId);
    return { kind: 'nudge', activityId: dueSnooze.activityId };
  }
  // 7. slots (collapse all pending into one fire)
  if (now >= start && now < end) {
    const pending = sch.slots.filter((t) => t <= now && !firedSet.has(t));
    if (pending.length) {
      sch.fired.push(...pending);
      const a = chooseActivity(state.activities, sch.recent, rng);
      if (!a) return null;
      noteShown(sch, a.id);
      return { kind: 'nudge', activityId: a.id };
    }
  }
  return null;
}

// Settings changed mid-day: draw a fresh plan for today but treat everything already in the past as
// consumed, so the new plan only governs the rest of the day (no burst of catch-up nudges).
function replanToday(state, now, rng = Math.random) {
  const sch = state.schedule;
  sch.planDate = dayKey(now);
  sch.slots = planDay(state.settings, now, rng);
  sch.fired = sch.slots.filter((t) => t <= now);
}

function snooze(state, activityId, now) {
  state.schedule.snoozed = [...(state.schedule.snoozed || []), { activityId, at: now + SNOOZE_MS }];
}
const HISTORY_MAX = 2000;
function record(state, activityId, now, outcome) {
  state.history = [...(state.history || []), { activityId, at: now, outcome }].slice(-HISTORY_MAX);
}
function markDone(state, activityId, now) { record(state, activityId, now, 'done'); }
function markOpened(state, activityId, now) { record(state, activityId, now, 'opened'); }

// ---- weekly recap ----
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_MS = 7 * 24 * 60 * MIN;
// Entries without an outcome predate the field and were all "done".
function recapSummary(history, now) {
  const recent = (history || []).filter((h) => h.at > now - WEEK_MS && h.at <= now);
  const doneEntries = recent.filter((h) => !h.outcome || h.outcome === 'done');
  const opened = recent.filter((h) => h.outcome === 'opened').length;
  const perDay = new Array(7).fill(0);
  for (const h of doneEntries) perDay[new Date(h.at).getDay()]++;
  let bestDay = null, best = 0;
  perDay.forEach((n, i) => { if (n > best) { best = n; bestDay = DAY_NAMES[i]; } });
  const done = doneEntries.length;
  const line = done + opened === 0
    ? 'Quiet week — no worries. Fresh start tomorrow?'
    : `This week: ${done} done · ${opened} opened${bestDay ? ` · best day ${bestDay}` : ''}.`;
  return { done, opened, bestDay, line };
}

module.exports = {
  MIN, SNOOZE_MS, SNOOZE_STALE_MS, MOVIE_HOLD_MS, TICK_MS,
  parseHM, dayKey, activeWindow, planDay, nextWeeklyAt, movieDueAt, recapDueAt, chooseActivity, tick, replanToday,
  isQuiet, setQuiet, snooze, markDone, markOpened, recapSummary,
};
