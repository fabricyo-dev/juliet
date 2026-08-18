'use strict';
const path = require('node:path');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, screen, shell, ipcMain, powerMonitor, clipboard,
} = require('electron');
const S = require('./scheduler');
const L = require('./links');
const { createStore } = require('./store');
const { defaultState, PLACEHOLDER_MOVIES, pickPepLine, MORNING_LINES, DEFAULT_ACTIVITIES } = require('./defaults');
const { createPresence } = require('./presence');
const R = require('./rating');
const PH = require('./phone');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const NUDGE_LINES = [
  'Fifteen minutes counts. Want me to open it?',
  'Future-you at the Ivy says thanks.',
  'Small step today, big app essay later.',
  'Just one. Then back to your day.',
];

let store, presence, tray;
let overlay = null; // BrowserWindow while Juliet is on screen
let overlayWatchdog = null;
const OVERLAY_MAX_MS = 4 * 60 * 1000;
let settingsWin = null;
let current = null; // {kind:'nudge', activity} | {kind:'movie', movie} | {kind:'nomovie'} | {kind:'recap'} | {kind:'pep'}

app.setName('Juliet');
if (!app.requestSingleInstanceLock()) app.quit();
// She's already running and Areej double-clicked the app again: that's "show me the app" → Settings.
let readyAt = 0;
app.on('second-instance', () => { if (app.isReady()) openSettings(); });
app.on('activate', () => { if (app.isReady() && Date.now() - readyAt > 3000) openSettings(); }); // ignore the launch-time activation

app.whenReady().then(() => {
  readyAt = Date.now();
  if (app.dock) app.dock.hide();
  store = createStore(path.join(app.getPath('userData'), 'state.json'), defaultState);
  store.state.activities = migrateActivities(store.state.activities, DEFAULT_ACTIVITIES);
  presence = createPresence(powerMonitor, store.state.settings.presenceIdleSeconds);
  applyLoginItem();
  makeTray();
  setInterval(tick, S.TICK_MS);
  powerMonitor.on('resume', () => setTimeout(tick, 5000));
  powerMonitor.on('unlock-screen', () => setTimeout(tick, 5000));
  tick();
  // A deliberate launch (double-click) opens Settings; the automatic launch at login stays out of the way.
  let openedAtLogin = false;
  try { openedAtLogin = !!app.getLoginItemSettings().wasOpenedAtLogin; } catch { /* not available */ }
  const demo = process.env.JULIET_DEMO;
  if (!openedAtLogin && !demo) setTimeout(() => openSettings(), 400);
  if (demo === 'nudge') setTimeout(() => fireNudge(), 1500);
  if (demo === 'movie') setTimeout(() => fireMovie(), 1500);
  if (demo === 'recap') setTimeout(() => fireRecap(), 1500);
  if (demo === 'pep') setTimeout(() => firePep(), 1500);
  if (demo === 'mirza') setTimeout(() => firePep(true), 1500);
  if (demo === 'welcome') setTimeout(() => fireWelcome(), 1500);
  if (demo === 'goodnight') setTimeout(() => fireGoodnight(), 1500);
  if (demo === 'gentle') setTimeout(() => fireNudge(undefined, true), 1500);
  if (demo === 'phone') setTimeout(() => pushToPhone({ kind: 'nudge', via: 'phone' }), 1500);
  if (demo === 'checkin') setTimeout(() => fireCheckin(), 1500);
  if (demo === 'morning') setTimeout(() => fireMorning(), 1500);
  if (demo === 'stroll') setTimeout(() => fireStroll(), 1500);
  if (demo === 'followup') setTimeout(() => fireFollowup('Her'), 1500);
  if (demo === 'settings') setTimeout(openSettings, 500);
});
app.on('window-all-closed', () => { /* keep running in the menu bar */ });

// ---------- tray ----------
function makeTray() {
  const icon = nativeImage.createFromPath(path.join(ASSETS, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Juliet');
  refreshTrayMenu();
}
function hhmm(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function setQuiet(mode) {
  S.setQuiet(store.state, Date.now(), mode);
  store.save();
  refreshTrayMenu();
}
function refreshTrayMenu() {
  const now = Date.now();
  const quiet = S.isQuiet(store.state, now);
  const quietLabel = quiet ? `Quiet until ${hhmm(store.state.schedule.quietUntil)}` : 'Quiet…';
  tray.setToolTip(quiet ? `Juliet — ${quietLabel.toLowerCase()}` : 'Juliet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Send Juliet now', click: () => fireNudge() },
    { label: 'Pick a movie now', click: () => fireMovie() },
    { label: 'Pep talk now', click: () => firePep() },
    { label: 'Ego raiser', click: () => firePep(true) },
    { label: 'Rate Juliet…', click: () => openSettings('rate') },
    {
      label: quietLabel,
      submenu: [
        { label: 'For 2 hours', click: () => setQuiet('hours2') },
        { label: 'Rest of today', click: () => setQuiet('today') },
        { type: 'separator' },
        { label: 'Resume now', enabled: quiet, click: () => setQuiet('off') },
      ],
    },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    {
      label: 'Launch at login', type: 'checkbox', checked: !!store.state.settings.launchAtLogin,
      click: (item) => { store.state.settings.launchAtLogin = item.checked; store.save(); applyLoginItem(); },
    },
    { type: 'separator' },
    { label: 'Quit Juliet', click: () => app.quit() },
  ]));
}
function applyLoginItem() {
  if (!app.isPackaged) return; // in dev this would register the bare Electron binary
  app.setLoginItemSettings({ openAtLogin: !!store.state.settings.launchAtLogin });
}

// ---------- scheduling ----------
let trayShowedQuiet = false;
function tick() {
  try {
    const now = Date.now();
    if (!store.state.firstRunAt) { store.state.firstRunAt = now; store.save(); }
    if (!store.state.welcomed) {
      // Nothing else until she has been introduced; the scheduler simply starts on the next tick.
      if (presence.isPresent() && !overlay && !S.isQuiet(store.state, now)) fireWelcome();
      return;
    }
    const here = presence.isPresent();
    const phoneOk = !!store.state.settings.phoneEnabled && !!store.state.settings.phoneTopic;
    // At the Mac → the cat (held while she's already on screen). Away → her iPhone, if she set that up.
    const fire = S.tick(store.state, now, here && !overlay, undefined, { phone: phoneOk && !here });
    store.save();
    const quietNow = S.isQuiet(store.state, now);
    if (quietNow !== trayShowedQuiet) { trayShowedQuiet = quietNow; refreshTrayMenu(); }
    if (!fire) return;
    if (fire.via === 'phone') { pushToPhone(fire); return; }
    if (fire.kind === 'movie') fireMovie();
    else if (fire.kind === 'recap') fireRecap();
    else if (fire.kind === 'pep') firePep();
    else if (fire.kind === 'goodnight') fireGoodnight();
    else if (fire.kind === 'checkin') fireCheckin();
    else if (fire.kind === 'morning') fireMorning();
    else if (fire.kind === 'stroll') fireStroll();
    else if (fire.kind === 'followup') fireFollowup(fire.title);
    else fireNudge(fire.activityId, false, fire.from);
  } catch (e) {
    console.error('tick failed', e);
  }
}

// ---------- overlay ----------
function ensureOverlay() {
  if (overlay) return overlay;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); // wherever she is working
  overlay = new BrowserWindow({
    x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height,
    transparent: true, frame: false, hasShadow: false, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
    webPreferences: {
      preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, '..', 'overlay', 'overlay.html'));
  overlay.once('ready-to-show', () => { if (overlay) overlay.showInactive(); });
  overlay.on('closed', () => { clearTimeout(overlayWatchdog); overlay = null; current = null; });
  overlay.webContents.on('render-process-gone', () => { console.error('overlay renderer gone'); dismissOverlay(); });
  overlay.webContents.on('did-fail-load', (_e, code, desc) => { console.error('overlay failed to load', code, desc); dismissOverlay(); });
  // Safety net: no appearance legitimately outlives walk-in + 90 s bubble + walk-out. If the renderer ever
  // stalls, tear the window down so nudges keep flowing instead of being suppressed by `if (overlay)`.
  clearTimeout(overlayWatchdog);
  overlayWatchdog = setTimeout(() => { console.error('overlay watchdog fired'); dismissOverlay(); }, OVERLAY_MAX_MS);
  return overlay;
}
function sendShow(payload) {
  const w = ensureOverlay();
  const send = () => {
    if (!overlay) return;
    w.webContents.send('overlay:show', payload);
  };
  if (w.webContents.isLoadingMainFrame()) w.webContents.once('did-finish-load', send);
  else send();
}
function leave(hop, cheer) {
  if (overlay) overlay.webContents.send('overlay:leave', { hop: !!hop, cheer: cheer || undefined });
}
function dismissOverlay() {
  clearTimeout(overlayWatchdog);
  if (overlay) { try { overlay.destroy(); } catch { /* ignore */ } }
  overlay = null; current = null;
  if (pendingRating !== null) { const n = pendingRating; pendingRating = null; setTimeout(() => fireRating(n), 1200); }
}

function fireNudge(activityId, forceGentle = false, from = 'manual') {
  if (overlay) return false;
  const gentle = forceGentle || S.needsGentleReturn(store.state, Date.now());
  // A snoozed activity is one she explicitly deferred — keep it. A slot-picked one can be swapped for an easy one.
  const useId = activityId && !(gentle && from === 'slot');
  const a = useId
    ? store.state.activities.find((x) => x.id === activityId)
    : gentle
      ? S.chooseEasyActivity(store.state.activities, store.state.schedule.recent)
      : S.chooseActivity(store.state.activities, store.state.schedule.recent);
  if (!a) return false;
  current = { kind: 'nudge', activity: a };
  sendShow({
    kind: 'nudge',
    title: gentle ? `Areej — no pressure.` : `Areej — ${a.name}`,
    line: gentle
      ? `You've been away a bit — that's fine. Want to start small? ${a.name} is a quick one.`
      : NUDGE_LINES[Math.floor(Math.random() * NUDGE_LINES.length)],
    buttons: [{ id: 'open', label: gentle ? 'Open it' : 'Open' }, { id: 'later', label: 'Later' }, { id: 'done', label: 'Did it' }],
  });
  return true;
}
function moviePayload(title) {
  return {
    kind: 'movie',
    title: `Movie night, Areej: ${title}`,
    line: 'I can open Google + Netflix search for it.',
    buttons: [{ id: 'open', label: 'Open' }, { id: 'different', label: 'Different one' }, { id: 'skip', label: 'Skip this week' }],
  };
}
function fireMovie() {
  if (overlay) return;
  const cleaned = {
    unseen: L.cleanMovieList(store.state.movies.unseen.join('\n'), PLACEHOLDER_MOVIES),
    seen: store.state.movies.seen,
  };
  const r = L.pickMovie(cleaned);
  if (!r) {
    current = { kind: 'nomovie' };
    sendShow({
      kind: 'movie', title: 'Movie night, Areej!', line: 'Your watch-list is empty — add some in Settings.',
      buttons: [{ id: 'settings', label: 'Open Settings' }, { id: 'skip', label: 'OK' }],
    });
    return;
  }
  store.state.movies = r.movies; store.save();
  current = { kind: 'movie', movie: r.title };
  sendShow(moviePayload(r.title));
}

function fireRecap() {
  if (overlay) return;
  const r = S.recapSummary(store.state.history, Date.now());
  current = { kind: 'recap' };
  sendShow({
    kind: 'recap',
    title: 'Weekly recap, Areej',
    line: r.line,
    buttons: r.done + r.opened === 0
      ? [{ id: 'open', label: 'Open one now' }, { id: 'ack', label: 'OK' }]
      : [{ id: 'ack', label: 'Nice' }],
  });
}

function fireWelcome() {
  if (overlay) return;
  store.state.welcomed = true; store.save();
  current = { kind: 'welcome' };
  sendShow({
    kind: 'welcome',
    title: "Hi Areej. I'm Juliet.",
    line: "Mirza built me for you. I'll nudge you about your extracurriculars, pick movie nights, and remind you you're brilliant. Click me anytime.",
    buttons: [{ id: 'settings', label: 'Show me the settings' }, { id: 'ack', label: 'Hi, Juliet' }],
  });
}
function fireGoodnight() {
  if (overlay) return;
  current = { kind: 'goodnight' };
  sendShow({
    kind: 'goodnight',
    title: 'Goodnight, Areej.',
    line: "It's late. Sleep is a study strategy too.",
    buttons: [{ id: 'ack', label: 'Goodnight, Juliet' }],
  });
}
function fireCheckin() {
  if (overlay) return;
  current = { kind: 'checkin' };
  sendShow({
    kind: 'checkin',
    title: "How's today going, Areej?",
    line: '',
    buttons: [{ id: 'rough', label: 'Rough' }, { id: 'okay', label: 'Okay' }, { id: 'great', label: 'Great' }],
  });
}
function fireMorning() {
  if (overlay) return;
  current = { kind: 'morning' };
  sendShow({
    kind: 'morning',
    title: 'Morning, Areej.',
    line: MORNING_LINES[Math.floor(Math.random() * MORNING_LINES.length)],
    buttons: [{ id: 'ack', label: 'Morning, Juliet' }],
  });
}
function fireStroll() {
  if (overlay) return;
  current = { kind: 'stroll' };
  sendShow({ kind: 'stroll', silent: true });
}
function fireFollowup(title) {
  if (overlay) return;
  current = { kind: 'followup', movie: title };
  sendShow({
    kind: 'followup',
    title: `How was ${title}?`,
    line: '',
    buttons: [{ id: 'loved', label: 'Loved it' }, { id: 'meh', label: 'Meh' }, { id: 'didnt', label: "Didn't watch" }],
  });
}
function firePep(onlyMirza = false) {
  if (overlay) return;
  current = { kind: 'pep' };
  sendShow({
    kind: 'pep',
    title: 'Hey Areej.',
    line: pickPepLine(onlyMirza),
    buttons: [{ id: 'ack', label: 'Thanks, Juliet' }],
  });
}

// ---------- iPhone (ntfy) ----------
async function pushToPhone(fire) {
  const st = store.state;
  let msg;
  if (fire.kind === 'nudge') {
    const a = st.activities.find((x) => x.id === fire.activityId) || S.chooseActivity(st.activities, st.schedule.recent);
    if (!a) return;
    msg = PH.buildPhoneMessage({ kind: 'nudge', activity: a });
  } else if (fire.kind === 'movie') {
    const cleaned = { unseen: L.cleanMovieList(st.movies.unseen.join('\n'), PLACEHOLDER_MOVIES), seen: st.movies.seen };
    const r = L.pickMovie(cleaned);
    if (!r) return;
    st.movies = r.movies; S.noteMovieOpened(st, r.title, Date.now()); store.save();
    msg = PH.buildPhoneMessage({ kind: 'movie', title: r.title });
  } else if (fire.kind === 'pep') {
    msg = PH.buildPhoneMessage({ kind: 'pep', line: pickPepLine() });
  } else if (fire.kind === 'recap') {
    msg = PH.buildPhoneMessage({ kind: 'recap', line: S.recapSummary(st.history, Date.now()).line });
  } else return;
  const ok = await PH.sendPhone(st.settings, msg);
  if (!ok) console.error('phone push failed for', fire.kind);
}
ipcMain.handle('phone:enable', (_e, on) => {
  const s = store.state.settings;
  s.phoneEnabled = !!on;
  if (s.phoneEnabled && !s.phoneTopic) s.phoneTopic = PH.makeTopic();
  store.save();
  return publicState();
});
ipcMain.handle('phone:newTopic', () => {
  store.state.settings.phoneTopic = PH.makeTopic();
  store.save();
  return publicState();
});
ipcMain.handle('phone:test', async () => {
  const s = store.state.settings;
  if (!s.phoneTopic) return { ok: false, reason: 'no topic' };
  const ok = await PH.sendPhone(s, PH.buildPhoneMessage({ kind: 'test' }));
  return { ok };
});
ipcMain.handle('phone:openStore', () => shell.openExternal('https://apps.apple.com/app/ntfy/id1625396347'));

async function openAll(urls) {
  try {
    for (const u of urls) await shell.openExternal(u);
    return true;
  } catch (e) {
    clipboard.writeText(urls.join('\n'));
    console.error('openExternal failed; copied to clipboard', e);
    return false;
  }
}

ipcMain.on('overlay:hit', (_e, v) => { if (overlay) overlay.setIgnoreMouseEvents(!v, { forward: true }); });
ipcMain.on('overlay:gone', () => dismissOverlay());
// Bubble shown when the browser could not be opened (the URLs are already on the clipboard).
function couldNotOpenPayload(kind, title) {
  return {
    kind, title,
    line: "I couldn't open that — I copied the link to your clipboard instead.",
    buttons: [{ id: 'ack', label: 'OK' }],
  };
}

ipcMain.on('overlay:action', async (_e, id) => {
  try {
    if (!current) { leave(false); return; }
    const now = Date.now();
    if (current.kind === 'nudge') {
      const a = current.activity;
      if (id === 'open') {
        if (await openAll([a.url])) { S.markOpened(store.state, a.id, now); store.save(); leave(false); }
        else sendShow(couldNotOpenPayload('nudge', `Areej — ${a.name}`));
      } else if (id === 'later') { S.snooze(store.state, a.id, now); store.save(); leave(false); }
      else if (id === 'done') {
        S.markDone(store.state, a.id, now); store.save();
        leave(true, S.milestoneFor(S.countDone(store.state.history)));
      }
      else leave(false); // ack / timeout
    } else if (current.kind === 'movie') {
      const title = current.movie;
      if (id === 'open') {
        if (await openAll(L.movieLinks(title))) { S.noteMovieOpened(store.state, title, now); store.save(); leave(true); }
        else sendShow(couldNotOpenPayload('movie', `Movie night, Areej: ${title}`));
      } else if (id === 'different') {
        const r = L.rerollMovie(store.state.movies, title);
        if (r) { store.state.movies = r.movies; store.save(); current.movie = r.title; sendShow(moviePayload(r.title)); }
        else leave(false);
      } else { // skip / ack / timeout: she didn't watch it — put it back
        store.state.movies = L.unpickMovie(store.state.movies, title); S.clearMovieFollowup(store.state); store.save(); leave(false);
      }
    } else if (current.kind === 'checkin') {
      if (id === 'rough' || id === 'okay' || id === 'great') {
        store.state.moods = [...(store.state.moods || []), { value: id, at: now }].slice(-500);
        if (id === 'rough') {
          S.setQuiet(store.state, now, 'hours2'); store.save(); refreshTrayMenu();
          sendShow({ kind: 'checkin', title: "Then I'll leave you be for a bit.", line: `Back in a couple of hours (quiet until ${hhmm(store.state.schedule.quietUntil)}). Be kind to yourself.`, buttons: [{ id: 'ack', label: 'Thanks' }] });
        } else if (id === 'okay') {
          store.save();
          sendShow({ kind: 'checkin', title: 'Okay is fine.', line: 'Steady wins. See you later.', buttons: [{ id: 'ack', label: 'See you' }] });
        } else { store.save(); leave(true, 'Look at you. Keep it rolling.'); }
      } else leave(false); // ack / timeout
    } else if (current.kind === 'followup') {
      const title = current.movie;
      if (id === 'loved') { store.state.favourites = [...(store.state.favourites || []), { title, at: now }].slice(-500); store.save(); leave(true, 'Noted. Good taste.'); }
      else if (id === 'didnt') { store.state.movies = L.unpickMovie(store.state.movies, title); store.save(); leave(false); }
      else leave(false); // meh / timeout
    } else if (current.kind === 'stroll' || current.kind === 'morning') {
      leave(false);
    } else if (current.kind === 'pep' || current.kind === 'goodnight' || current.kind === 'rating') {
      leave(false); // any click (or the timeout) — she said her piece
    } else if (current.kind === 'welcome') {
      if (id === 'settings') openSettings();
      leave(false);
    } else if (current.kind === 'recap') {
      if (id === 'open') {
        const a = S.chooseActivity(store.state.activities, store.state.schedule.recent);
        if (a && await openAll([a.url])) { S.markOpened(store.state, a.id, now); store.save(); }
      }
      leave(false);
    } else { // nomovie
      if (id === 'settings') openSettings();
      leave(false);
    }
  } catch (e) {
    // Never leave the overlay stranded: a stranded window suppresses every future nudge.
    console.error('overlay:action failed', e);
    dismissOverlay();
  }
});

// ---------- settings ----------
function openSettings(tab) {
  if (typeof tab !== 'string') tab = undefined;
  if (settingsWin) {
    settingsWin.show(); settingsWin.focus();
    if (tab) settingsWin.webContents.send('settings:tab', tab);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560, height: 680, minWidth: 480, minHeight: 520, title: 'Juliet — Settings', show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'settings', 'settings.html'), tab ? { hash: tab } : undefined);
  settingsWin.once('ready-to-show', () => { settingsWin.show(); if (app.dock) app.dock.show(); });
  settingsWin.on('closed', () => { settingsWin = null; if (app.dock) app.dock.hide(); });
}

const { normalizeUrl, mergeActivities, migrateActivities } = require('./activities');

function publicState() {
  return { ...store.state, recovered: store.recovered, placeholders: PLACEHOLDER_MOVIES, ratingLabels: R.RATING_LABELS };
}
ipcMain.handle('settings:get', () => publicState());
let pendingRating = null; // a rating sent while Juliet was already on screen — she reacts once she's free
function fireRating(n) {
  if (overlay) { pendingRating = n; return false; }
  current = { kind: 'rating' };
  sendShow({
    kind: 'rating',
    title: `${n}/10 — ${R.ratingLabel(n)}`,
    line: R.ratingReaction(n),
    buttons: [{ id: 'ack', label: n >= 9 ? 'You earned it' : 'OK' }],
  });
  return true;
}
ipcMain.handle('settings:rate', (_e, value) => {
  const n = R.clampRating(value);
  if (n === null) return publicState();
  const now = Date.now();
  store.state.ratings = [...(store.state.ratings || []), { value: n, at: now }].slice(-200);
  store.save();
  const reacted = fireRating(n);
  return { ...publicState(), summary: R.ratingSummary(n, now), reacted };
});
ipcMain.handle('settings:save', (_e, patch) => {
  const st = store.state;
  patch = patch || {};
  if (patch.settings) {
    const s = { ...st.settings, ...patch.settings };
    s.nudgesPerDay = Math.max(1, Math.min(8, parseInt(s.nudgesPerDay, 10) || 3));
    s.movieDay = Math.max(0, Math.min(6, parseInt(s.movieDay, 10) || 0));
    s.launchAtLogin = !!s.launchAtLogin;
    if (!/^\d{2}:\d{2}$/.test(s.activeStart)) s.activeStart = st.settings.activeStart;
    if (!/^\d{2}:\d{2}$/.test(s.activeEnd)) s.activeEnd = st.settings.activeEnd;
    if (!/^\d{2}:\d{2}$/.test(s.movieTime)) s.movieTime = st.settings.movieTime;
    s.pepPerWeek = Math.max(0, Math.min(7, parseInt(s.pepPerWeek, 10) || 0));
    s.checkinPerWeek = Math.max(0, Math.min(7, parseInt(s.checkinPerWeek, 10) || 0));
    s.strollPerWeek = Math.max(0, Math.min(7, parseInt(s.strollPerWeek, 10) || 0));
    s.morningEnabled = !!s.morningEnabled;
    s.recapEnabled = !!s.recapEnabled;
    s.goodnightEnabled = !!s.goodnightEnabled;
    s.recapDay = Math.max(0, Math.min(6, parseInt(s.recapDay, 10) || 0));
    if (!/^\d{2}:\d{2}$/.test(s.recapTime)) s.recapTime = st.settings.recapTime;
    const recapChanged = s.recapDay !== st.settings.recapDay || s.recapTime !== st.settings.recapTime
      || (s.recapEnabled && !st.settings.recapEnabled);
    const planChanged = s.nudgesPerDay !== st.settings.nudgesPerDay || s.activeStart !== st.settings.activeStart
      || s.activeEnd !== st.settings.activeEnd || s.pepPerWeek !== st.settings.pepPerWeek
      || s.checkinPerWeek !== st.settings.checkinPerWeek || s.strollPerWeek !== st.settings.strollPerWeek;
    const movieChanged = s.movieDay !== st.settings.movieDay || s.movieTime !== st.settings.movieTime;
    st.settings = s;
    if (planChanged) S.replanToday(st, Date.now()); // new plan governs only the rest of today
    if (movieChanged) st.schedule.movieNextAt = null; // recompute
    if (recapChanged) st.schedule.recapNextAt = null;
    applyLoginItem();
    refreshTrayMenu();
  }
  if (Array.isArray(patch.activities)) st.activities = mergeActivities(st.activities, patch.activities, Date.now());
  if (typeof patch.moviesText === 'string') {
    const unseen = L.cleanMovieList(patch.moviesText, PLACEHOLDER_MOVIES);
    const lower = new Set(unseen.map((t) => t.toLowerCase()));
    st.movies = { unseen, seen: st.movies.seen.filter((t) => !lower.has(t.toLowerCase())) };
  }
  if (patch.clearSeen) st.movies = { unseen: [...st.movies.unseen, ...st.movies.seen], seen: [] };
  store.save();
  tick();
  return publicState();
});
ipcMain.handle('settings:testNudge', () => fireNudge()); // false = she's already on screen
ipcMain.handle('settings:pepMirza', () => { if (overlay) return false; firePep(true); return true; });
ipcMain.handle('settings:testMovie', () => { fireMovie(); return true; });
ipcMain.handle('settings:restoreDefaults', () => {
  store.state.activities = DEFAULT_ACTIVITIES.map((a) => ({ ...a }));
  store.save();
  return publicState();
});
ipcMain.handle('settings:unfavourite', (_e, title) => {
  store.state.favourites = (store.state.favourites || []).filter((f) => f.title !== title);
  store.save();
  return publicState();
});
ipcMain.handle('settings:unpickMovie', (_e, title) => {
  store.state.movies = L.unpickMovie(store.state.movies, title);
  store.save();
  return publicState();
});
