# Juliet 🐾

A gray-and-white pixel cat who lives in Areej's menu bar. A few times a day — only while she's actually at the Mac — Juliet walks across the bottom of the screen and suggests one extracurricular; click **Open** and you're there. Once a week she picks a movie from the watch-list and opens Google + Netflix search for it.

## Run from source

```bash
npm install
npm start
npm test
```

Dev shortcuts: `JULIET_DEMO=nudge npm start`, `JULIET_DEMO=movie npm start`, `JULIET_DEMO=settings npm start` trigger that thing ~1.5 s after launch.

## Build the Mac app

```bash
npm run dist
```

Produces `dist/Juliet-1.0.0-arm64.dmg` and `dist/mac-arm64/Juliet.app` (Apple Silicon). The app is **unsigned** (no Apple developer account).

**First open on Areej's Mac:** open the `.dmg`, drag Juliet to Applications, then **right-click → Open → Open**. If macOS still refuses: System Settings → Privacy & Security → scroll down → **Open Anyway**. After that she launches at login on her own — look for the little cat in the menu bar.

## Where things live

- State: `~/Library/Application Support/Juliet/state.json` (activities, watch-list, schedule, history). Delete it to reset.
- Settings: click the menu-bar cat → **Settings…** (Activities / Movies / Schedule, plus "Send Juliet now" and "Pick a movie now").

## Rules of the cat

- *N* nudges/day (default 3) at random times inside active hours (default 09:00–22:00). A nudge fires only when the Mac is awake, unlocked, and used in the last 5 minutes. A slot that comes due while she's away is held and fires when she's back (if still inside hours); otherwise it's dropped. Slots never stack.
- **Open** = launches the link. **Later** = comes back in 1 h. **Did it** = logged (count in Settings → Schedule). Clicking Juliet herself = Open. Ignored for 90 s → she walks off.
- Movie night: default Friday 19:00. **Open** = Google + Netflix search tabs. **Different one** = re-roll. **Skip this week** = puts the title back, week consumed. When every movie is seen the list resets.

## Art & animation

`assets/juliet/` is the designer's **`juliet-sprite-v5-interaction-handoff`** pack, vendored verbatim (its own README describes the files). Two 512×256 RGBA sheets, 4×2 cells of **128×128**, anchor **(64, 120)**, rendered 1:1 with nearest-neighbour scaling (`image-rendering: pixelated`).

Every appearance follows `juliet-animations.json`:

1. `walkRight` loops (8 frames × 100 ms, 120 px/s) from off the left edge to 20–40 % across the screen — she always finishes the current step before stopping.
2. `turnToUser` (turn-talk frames 1–4).
3. `talkToUser` loops (frames 5–8); the `speechStart` event on frame 5 reveals the code-rendered speech bubble. The text is whatever the app sends (nudge or movie); `"Hi!"` is only the manifest's preview default.
4. On a button click / cat click / 90 s timeout: `turnBackRight` (frames 4→1), then `resumeWalkRight` walks her off the right edge.

"Did it" adds a small CSS bounce before she turns back. `src/shared/juliet-anim.js` mirrors the manifest; `test/anim.test.js` fails if the two ever drift, and decodes the sheets to check dimensions and that every frame's feet land on the anchor row.

`npm run icons` regenerates `assets/icon.png` (talk frame 5 on a plate) and the menu-bar template glyph (`trayTemplate.png` / `@2x`, her head silhouette) from those sheets. Preview any state in a plain browser: `src/overlay/overlay.html?demo=hi|nudge|movie`.

## Layout

```
src/main/     main.js (tray, windows, IPC), scheduler.js + links.js + store.js (pure, tested), presence.js, defaults.js
src/overlay/  transparent click-through renderer: clip player + speech bubble
src/settings/ settings window
src/shared/   juliet-anim.js (manifest mirror + timeline helpers), png.js (encoder/decoder)
scripts/      make-icons.js
assets/juliet designer sprite pack (sheets, frames, manifest, previews)
test/         node:test suites
```
