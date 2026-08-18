# Juliet — design spec

*2026-08-18. A menu-bar Mac app for Areej: a gray-and-white pixel cat named Juliet who walks across the screen a few times a day to remind her to keep up an extracurricular, and once a week picks a movie from her watch-list and opens it on Google + Netflix.*

## 1. Goal

Areej is aiming for a CS major at an Ivy and forgets to keep her extracurriculars going. She also has a long movie watch-list she never picks from. Juliet fixes both with the smallest possible surface: no dashboard, no accounts, no phone. Just a cat that shows up.

Success = she keeps it running, it never nags at the wrong moment, and clicking the cat gets her *into* the activity in one click.

## 2. Behaviour

### 2.1 Nudges (extracurriculars)
- **N nudges/day** (default 3) at random times inside **active hours** (default 09:00–22:00), all editable.
- A nudge only fires when Areej is *actually there*: Mac awake, screen unlocked, no screensaver, and keyboard/mouse activity in the last 5 minutes (`powerMonitor.getSystemIdleTime()`).
- If a slot comes due while she is away, it is **held** and fires within ~1 minute of her coming back — but only if still inside active hours. Slots that expire outside active hours are **dropped**, never stacked. Max one nudge on screen at a time; a held slot waits for the current one to finish.
- Nudge = Juliet walks in from a random side along the bottom of the primary display, stops around 20–40% in, and a speech bubble appears: **"Areej — \<activity name\>"** with a short line and three buttons:
  - **Open** → opens the activity's URL in the default browser, Juliet walks off.
  - **Later** → Juliet walks off, same activity returns in 60 min (still subject to the "she's there" rule).
  - **Did it** → records `{activity, date}` in history, Juliet does a little happy hop, walks off.
  - Clicking the cat body = Open. Ignored for 90 s → walks off, no record.
- Activity choice: random among enabled activities, avoiding the last two shown.

### 2.2 Weekly movie
- Default **Friday 19:00**, editable (day + time). Same "she's there" rule; if she's away, it fires when she returns that day; if the whole day passes, it fires at the next presence within 48 h, then drops.
- Picks a random movie from the **unseen** list, marks it seen, and:
  1. Juliet walks in with **"Movie night, Areej: \<title\>"** and buttons **Open** / **Different one** / **Skip this week**.
  2. **Open** opens *both* `https://www.google.com/search?q=<title> movie` and `https://www.netflix.com/search?q=<title>` (she is already logged in to Netflix in her browser; we do not automate Netflix itself). "Different one" re-rolls (old title goes back to unseen). "Skip" walks off; that week is consumed.
- When every movie is seen, the list resets and Settings shows a note.

### 2.3 Menu bar
Tray icon (small pixel cat, template image so it adapts to light/dark menu bar). Menu: **Send Juliet now**, **Pick a movie now**, **Settings…**, **Launch at login** (checkbox, default on), **Quit**. No dock icon.

### 2.4 Settings window
One small window (~520×640), plain HTML, three tabs:
- **Activities**: list of `{name, url, enabled}` with add / remove / toggle; "Restore defaults".
- **Movies**: textarea, one title per line (the unseen list); read-only "Seen" list below with a "put back" button per item; "Clear seen".
- **Schedule**: nudges per day (1–8), active hours (start/end), movie day + time, launch at login. Also a small "Done this month: N" counter from history — nothing more.

## 3. Pre-filled activities (default set)
| Name | URL |
|---|---|
| CS50x — next lecture / problem set | https://cs50.harvard.edu/x/ |
| LeetCode daily problem | https://leetcode.com/problemset/ |
| Push a commit to your GitHub project | https://github.com/ |
| freeCodeCamp — one lesson | https://www.freecodecamp.org/learn/ |
| USACO Guide — one module | https://usaco.guide/ |
| Advent of Code — one puzzle | https://adventofcode.com/ |
| Codeforces — one problem | https://codeforces.com/problemset |
| Kaggle Learn — one lesson | https://www.kaggle.com/learn |
| Devpost — check upcoming hackathons | https://devpost.com/hackathons |
| MIT OCW 18.06 Linear Algebra — one lecture | https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/ |
| arXiv cs.LG — read one abstract | https://arxiv.org/list/cs.LG/new |
| 3Blue1Brown — one video | https://www.3blue1brown.com/ |
| Project Euler — one problem | https://projecteuler.net/archives |
| Girls Who Code — check clubs / events | https://girlswhocode.com/ |
| Coding club: message the group / plan a session | https://mail.google.com/ |
| Tutor someone for 30 min (Khan Academy) | https://www.khanacademy.org/computing |

Movie list ships with two placeholder lines ("Paste your watch-list here, one per line") that are ignored by the picker until replaced.

## 4. Architecture

Electron (current stable), plain JS/HTML/CSS, no UI framework, no bundler. Node 26 on the build machine.

```
juliet/
  package.json            electron, electron-builder; scripts: start, test, dist
  src/main/
    main.js               app lifecycle, tray, windows, IPC wiring, powerMonitor
    scheduler.js          PURE: today's slots, hold/drop rules, snooze, movie due — unit-tested
    presence.js           "is she there?" = awake && unlocked && idle < 300 s (thin wrapper, injectable)
    store.js              load/save JSON state (userData/state.json), defaults, migrations
    links.js              PURE: google/netflix URL builders, movie pick/reset — unit-tested
    defaults.js           default activities + settings
  src/overlay/
    overlay.html/.js/.css transparent full-screen renderer: cat sprite, walk, bubble, hit-testing
    sprite.js             draws Juliet from a pixel matrix on canvas (placeholder art) OR loads
                          assets/juliet-sheet.png if present (designer art drop-in)
  src/settings/
    settings.html/.js/.css
  src/preload.js          contextBridge: overlay <-> main, settings <-> main
  assets/                 tray icon (template png @1x/@2x), app icon, optional juliet-sheet.png
  test/                   node:test files for scheduler, links, store
  docs/superpowers/specs/ this file
  README.md               what it is, how to run/build, "first open on her Mac" note, sprite spec
```

### 4.1 Overlay window
- `BrowserWindow` sized to the primary display's work area, `transparent`, `frame:false`, `alwaysOnTop` at level `screen-saver`, `visibleOnAllWorkspaces` (incl. fullscreen), `skipTaskbar`, `focusable:false`, `hasShadow:false`.
- Created on demand for a nudge and destroyed when Juliet leaves (keeps idle footprint tiny and avoids stuck overlays).
- Click-through: `setIgnoreMouseEvents(true, {forward:true})` by default; renderer sends `overlay:hit(true|false)` on pointer enter/leave of the cat + bubble, main toggles ignore accordingly.
- Display changes (external monitor plugged/unplugged) mid-nudge → overlay is re-sized on `screen.on('display-metrics-changed')`.

### 4.2 Sprite
- Placeholder: 32×32-cell pixel matrix per frame drawn on `<canvas>` at 3× scale with `image-rendering: pixelated`. Frames: walk ×4, idle/sit ×2, happy hop ×2. Gray body, white chest/paws/muzzle, pink nose. Faces left/right by canvas flip.
- Drop-in: if `assets/juliet-sheet.png` exists, use it (spec in §7). Same frame order and count, 32×32 px per frame, one row.

### 4.3 Scheduler (pure, deterministic under injected `now`/`rng`)
```
planDay(settings, date, rng)         -> [Date...] N times in active hours, ≥ 45 min apart when possible
nextDue(state, now)                  -> {kind:'nudge'|'movie', at} | null
onTick(state, now, present)          -> {fire?: 'nudge'|'movie', state'}  // hold/drop logic lives here
snooze(state, activityId, now)       -> state'
movieDueAt(settings, fromDate)       -> Date  (next weekday+time)
```
Main runs a 30 s tick (`setInterval`) plus re-plans at midnight and on `powerMonitor` `resume`/`unlock-screen`. State (today's plan, held slots, snooze, last shown ids, movie `nextAt`) is persisted so restarts don't double-fire.

### 4.4 Store
Single JSON file, atomic write (tmp + rename), schema version field. Shape:
`{version, settings, activities[], movies:{unseen[], seen[]}, history[], schedule:{planDate, slots[], held[], snoozed[], recent[], movieNextAt}}`.

### 4.5 Error handling
- Overlay renderer crash → main logs and destroys the window; next tick proceeds normally.
- Corrupt state file → backed up as `state.json.bad-<ts>`, defaults loaded, Settings shows a one-line notice.
- `shell.openExternal` failure → bubble shows "couldn't open — copied link" and copies URL to clipboard.
- No network is ever required; nothing is fetched.

## 5. Testing
- `node --test` for `scheduler.js`, `links.js`, `store.js`: slot generation bounds/spacing, hold-vs-drop across active-hours edge, snooze, movie pick/reset/re-roll, URL encoding (spaces, apostrophes, `&`), corrupt-file recovery.
- Manual: run `npm start` here, use tray "Send Juliet now" / "Pick a movie now", screenshot the cat over the desktop and confirm click-through outside the cat, and confirm both browser tabs open.

## 6. Packaging & delivery
- `electron-builder`, `mac` target `dmg` + `zip`, `arch: arm64`, unsigned (no Apple developer ID), `LSUIElement: true` (no dock icon), app name **Juliet**, bundle id `com.mirza.juliet`.
- README "First open on Areej's Mac": drag to Applications → right-click → Open → Open; if macOS still blocks it, System Settings → Privacy & Security → "Open Anyway". Launch-at-login is on by default so she only does this once.

## 7. Designer hand-off (sprite spec, also in README)
One PNG, transparent background, **8 frames in one horizontal row, each 32×32 px (256×32 total)**, no anti-aliasing / no gradients, drawn at 1×:
frames 1–4 walk cycle (facing **right**), 5–6 idle sitting (blink on 6), 7–8 happy hop. Palette ≤ 8 colours: gray body, lighter gray belly/chest, white paws + muzzle + tail tip, pink nose/inner ear, dark outline. Save as `assets/juliet-sheet.png`.

## 8. Out of scope (v1)
Phone/notifications, multi-monitor cat (primary display only), Netflix automation/auto-play, streak analytics beyond the monthly count, cloud sync, code signing/notarisation, Windows.
