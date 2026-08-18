'use strict';
const path = require('node:path');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, screen, shell, ipcMain, powerMonitor, clipboard,
} = require('electron');
const S = require('./scheduler');
const L = require('./links');
const { createStore } = require('./store');
const { defaultState, PLACEHOLDER_MOVIES, DEFAULT_ACTIVITIES } = require('./defaults');
const { createPresence } = require('./presence');

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
let current = null; // {kind:'nudge', activity} | {kind:'movie', movie} | {kind:'nomovie'}

app.setName('Juliet');
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  store = createStore(path.join(app.getPath('userData'), 'state.json'), defaultState);
  presence = createPresence(powerMonitor, store.state.settings.presenceIdleSeconds);
  applyLoginItem();
  makeTray();
  setInterval(tick, S.TICK_MS);
  powerMonitor.on('resume', () => setTimeout(tick, 5000));
  powerMonitor.on('unlock-screen', () => setTimeout(tick, 5000));
  tick();
  const demo = process.env.JULIET_DEMO;
  if (demo === 'nudge') setTimeout(() => fireNudge(), 1500);
  if (demo === 'movie') setTimeout(() => fireMovie(), 1500);
  if (demo === 'recap') setTimeout(() => fireRecap(), 1500);
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
    { label: 'Settings…', click: openSettings },
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
    const fire = S.tick(store.state, now, presence.isPresent() && !overlay);
    store.save();
    const quietNow = S.isQuiet(store.state, now);
    if (quietNow !== trayShowedQuiet) { trayShowedQuiet = quietNow; refreshTrayMenu(); }
    if (!fire) return;
    if (fire.kind === 'movie') fireMovie();
    else if (fire.kind === 'recap') fireRecap();
    else fireNudge(fire.activityId);
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
function leave(hop) {
  if (overlay) overlay.webContents.send('overlay:leave', { hop: !!hop });
}
function dismissOverlay() {
  clearTimeout(overlayWatchdog);
  if (overlay) { try { overlay.destroy(); } catch { /* ignore */ } }
  overlay = null; current = null;
}

function fireNudge(activityId) {
  if (overlay) return;
  const a = activityId
    ? store.state.activities.find((x) => x.id === activityId)
    : S.chooseActivity(store.state.activities, store.state.schedule.recent);
  if (!a) return;
  current = { kind: 'nudge', activity: a };
  sendShow({
    kind: 'nudge',
    title: `Areej — ${a.name}`,
    line: NUDGE_LINES[Math.floor(Math.random() * NUDGE_LINES.length)],
    buttons: [{ id: 'open', label: 'Open' }, { id: 'later', label: 'Later' }, { id: 'done', label: 'Did it' }],
  });
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
      if (id === 'open' || id === 'cat') {
        if (await openAll([a.url])) { S.markOpened(store.state, a.id, now); store.save(); leave(false); }
        else sendShow(couldNotOpenPayload('nudge', `Areej — ${a.name}`));
      } else if (id === 'later') { S.snooze(store.state, a.id, now); store.save(); leave(false); }
      else if (id === 'done') { S.markDone(store.state, a.id, now); store.save(); leave(true); }
      else leave(false); // ack / timeout
    } else if (current.kind === 'movie') {
      const title = current.movie;
      if (id === 'open' || id === 'cat') {
        if (await openAll(L.movieLinks(title))) leave(true);
        else sendShow(couldNotOpenPayload('movie', `Movie night, Areej: ${title}`));
      } else if (id === 'different') {
        const r = L.rerollMovie(store.state.movies, title);
        if (r) { store.state.movies = r.movies; store.save(); current.movie = r.title; sendShow(moviePayload(r.title)); }
        else leave(false);
      } else { // skip / ack / timeout: she didn't watch it — put it back
        store.state.movies = L.unpickMovie(store.state.movies, title); store.save(); leave(false);
      }
    } else if (current.kind === 'recap') {
      if (id === 'open' || id === 'cat') {
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
function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 560, height: 680, minWidth: 480, minHeight: 520, title: 'Juliet — Settings', show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'settings', 'settings.html'));
  settingsWin.once('ready-to-show', () => { settingsWin.show(); if (app.dock) app.dock.show(); });
  settingsWin.on('closed', () => { settingsWin = null; if (app.dock) app.dock.hide(); });
}

// "leetcode.com" → "https://leetcode.com"; anything with a scheme is left alone.
function normalizeUrl(u) {
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

ipcMain.handle('settings:get', () => ({ ...store.state, recovered: store.recovered, placeholders: PLACEHOLDER_MOVIES }));
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
    s.recapEnabled = !!s.recapEnabled;
    s.recapDay = Math.max(0, Math.min(6, parseInt(s.recapDay, 10) || 0));
    if (!/^\d{2}:\d{2}$/.test(s.recapTime)) s.recapTime = st.settings.recapTime;
    const recapChanged = s.recapDay !== st.settings.recapDay || s.recapTime !== st.settings.recapTime;
    const planChanged = s.nudgesPerDay !== st.settings.nudgesPerDay || s.activeStart !== st.settings.activeStart || s.activeEnd !== st.settings.activeEnd;
    const movieChanged = s.movieDay !== st.settings.movieDay || s.movieTime !== st.settings.movieTime;
    st.settings = s;
    if (planChanged) S.replanToday(st, Date.now()); // new plan governs only the rest of today
    if (movieChanged) st.schedule.movieNextAt = null; // recompute
    if (recapChanged) st.schedule.recapNextAt = null;
    applyLoginItem();
    refreshTrayMenu();
  }
  if (Array.isArray(patch.activities)) {
    st.activities = patch.activities
      .filter((a) => a && String(a.name || '').trim() && String(a.url || '').trim())
      .map((a, i) => ({
        id: a.id || `custom-${Date.now()}-${i}`,
        name: String(a.name).trim(),
        url: normalizeUrl(String(a.url).trim()),
        enabled: a.enabled !== false,
      }));
  }
  if (typeof patch.moviesText === 'string') {
    const unseen = L.cleanMovieList(patch.moviesText, PLACEHOLDER_MOVIES);
    const lower = new Set(unseen.map((t) => t.toLowerCase()));
    st.movies = { unseen, seen: st.movies.seen.filter((t) => !lower.has(t.toLowerCase())) };
  }
  if (patch.clearSeen) st.movies = { unseen: [...st.movies.unseen, ...st.movies.seen], seen: [] };
  store.save();
  tick();
  return { ...store.state, recovered: store.recovered, placeholders: PLACEHOLDER_MOVIES };
});
ipcMain.handle('settings:testNudge', () => { fireNudge(); return true; });
ipcMain.handle('settings:testMovie', () => { fireMovie(); return true; });
ipcMain.handle('settings:restoreDefaults', () => {
  store.state.activities = DEFAULT_ACTIVITIES.map((a) => ({ ...a }));
  store.save();
  return { ...store.state, recovered: store.recovered, placeholders: PLACEHOLDER_MOVIES };
});
ipcMain.handle('settings:unpickMovie', (_e, title) => {
  store.state.movies = L.unpickMovie(store.state.movies, title);
  store.save();
  return { ...store.state, recovered: store.recovered, placeholders: PLACEHOLDER_MOVIES };
});
