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
function refreshTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Send Juliet now', click: () => fireNudge() },
    { label: 'Pick a movie now', click: () => fireMovie() },
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
function tick() {
  try {
    const fire = S.tick(store.state, Date.now(), presence.isPresent() && !overlay);
    store.save();
    if (!fire) return;
    if (fire.kind === 'movie') fireMovie();
    else fireNudge(fire.activityId);
  } catch (e) {
    console.error('tick failed', e);
  }
}

// ---------- overlay ----------
function ensureOverlay() {
  if (overlay) return overlay;
  const { workArea } = screen.getPrimaryDisplay();
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
  overlay.on('closed', () => { overlay = null; current = null; });
  overlay.webContents.on('render-process-gone', () => {
    console.error('overlay renderer gone');
    try { overlay.destroy(); } catch { /* already gone */ }
    overlay = null; current = null;
  });
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
ipcMain.on('overlay:action', async (_e, id) => {
  if (!current) { leave(false); return; }
  const now = Date.now();
  if (current.kind === 'nudge') {
    const a = current.activity;
    if (id === 'open' || id === 'cat') { await openAll([a.url]); leave(false); }
    else if (id === 'later') { S.snooze(store.state, a.id, now); store.save(); leave(false); }
    else if (id === 'done') { S.markDone(store.state, a.id, now); store.save(); leave(true); }
    else leave(false); // timeout
  } else if (current.kind === 'movie') {
    const title = current.movie;
    if (id === 'open' || id === 'cat') { await openAll(L.movieLinks(title)); leave(true); }
    else if (id === 'different') {
      const r = L.rerollMovie(store.state.movies, title);
      if (r) { store.state.movies = r.movies; store.save(); current.movie = r.title; sendShow(moviePayload(r.title)); }
      else leave(false);
    } else { // skip / timeout: she didn't watch it — put it back
      store.state.movies = L.unpickMovie(store.state.movies, title); store.save(); leave(false);
    }
  } else { // nomovie
    if (id === 'settings') openSettings();
    leave(false);
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
    const planChanged = s.nudgesPerDay !== st.settings.nudgesPerDay || s.activeStart !== st.settings.activeStart || s.activeEnd !== st.settings.activeEnd;
    const movieChanged = s.movieDay !== st.settings.movieDay || s.movieTime !== st.settings.movieTime;
    st.settings = s;
    if (planChanged) st.schedule.planDate = null; // re-plan today on next tick
    if (movieChanged) st.schedule.movieNextAt = null; // recompute
    applyLoginItem();
    refreshTrayMenu();
  }
  if (Array.isArray(patch.activities)) {
    st.activities = patch.activities
      .filter((a) => a && String(a.name || '').trim() && String(a.url || '').trim())
      .map((a, i) => ({
        id: a.id || `custom-${Date.now()}-${i}`,
        name: String(a.name).trim(),
        url: String(a.url).trim(),
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
