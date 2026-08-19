# Juliet

A gray-and-white pixel cat who lives in Areej's menu bar. A few times a day — only while she's actually at the Mac — Juliet walks across the bottom of the screen and suggests one extracurricular; click **Open** and you're there. Once a week she picks a movie from the watch-list and opens Google + Netflix search for it.

## Run from source

```bash
npm install
npm start
npm test
```

Dev shortcuts: `JULIET_DEMO=nudge|gentle|movie|recap|pep|checkin|morning|stroll|followup|welcome|goodnight|phone|settings npm start` triggers that thing ~1.5 s after launch.

## Build the Mac app

```bash
npm run dist
```

Produces `dist/Juliet-1.2.2-arm64.dmg` and `dist/mac-arm64/Juliet.app` (Apple Silicon). The app is **unsigned** (no Apple developer account).

**First open on Areej's Mac:** open the `.dmg`, drag Juliet to Applications, then **right-click → Open → Open**. If macOS still refuses: System Settings → Privacy & Security → scroll down → **Open Anyway**. After that she launches at login on her own — look for the little cat in the menu bar.

## Where things live

- State: `~/Library/Application Support/Juliet/state.json` (activities, watch-list, schedule, history). Delete it to reset.
- **Opening the app** (double-click Juliet in Applications, or the menu-bar cat → Settings…) shows the Settings window: Activities / Movies / Schedule / Rate, with a big **Call Juliet** button at the top that summons her right now. The automatic launch at login stays silent in the menu bar. She also shows up on her own (see below).

## Rules of the cat

- **Default activities** are built around what a CS application actually rewards: one flagship *build* (project, dev log, ship something), *compete/research* depth (USACO, Codeforces, LeetCode, AoC, Kaggle, arXiv, emailing a professor, OCW, 3B1B, CS50), a *math* leg (AMC 10/12 papers, AoPS Alcumus, proof write-ups, Euclid/CEMC, HMMT/PUMaC archives, Project Euler, running a math club, PROMYS/Ross/SUMaC applications), *leading and teaching with numbers* (SLO session, peer tutoring, coding club, Technovation Girls, Girls Who Code, hackathons), and an *activity log* so it can all be written down for the Common App later. Edit freely in Settings → Activities; "Restore defaults" brings this set back.

- *N* nudges/day (default 3) at random times inside active hours (default 09:00–22:00). A nudge fires only when the Mac is awake, unlocked, and used in the last 5 minutes. A slot that comes due while she's away is held and fires when she's back (if still inside hours); otherwise it's dropped. Slots never stack.
- **Open** = launches the link. **Later** = comes back in 1 h. **Did it** = logged (count in Settings → Schedule). Clicking Juliet herself = petting: she purrs and keeps her message. Ignored for 90 s → she walks off.
- Movie night: default Friday 19:00. **Open** = Google + Netflix search tabs. **Different one** = re-roll. **Skip this week** = puts the title back, week consumed. When every movie is seen the list resets.
- **Quiet…** (menu-bar cat): *For 2 hours* or *Rest of today*. Nothing fires while quiet; a slot that came due is held and fires once quiet ends (if still inside active hours) — never stacked. *Resume now* ends it early. "Send Juliet now" / "Pick a movie now" still work while quiet (you asked).
- **Weekly recap** (default Sunday 18:00, editable / switchable in Settings → Schedule): "This week: 4 done · 2 opened · best day Tuesday." Counts **Did it** and **Open** clicks from the last 7 days. An empty week gets a gentle "Quiet week — no worries" and an *Open one now* button.
- **Pep talks** (default 3/week, 0–7 in Settings → Schedule, or menu-bar "Pep talk now"): she shows up with no task, just "Stop overthinking — you've got this. You are the smartest, most talented, well-spoken person I know." Lines live in `src/main/defaults.js` (`PEP_LINES`; the first `PEP_MIRZA_COUNT` are Mirza's own and she leans on those). **Ego raiser** (Settings header / menu-bar) makes her say one of his lines only. Never lands within 30 min of a nudge; same presence/quiet rules.
- **First launch**: the first time she's at the Mac, Juliet introduces herself ("Hi Areej. I'm Juliet. Mirza built me for you…") with a button straight into Settings. Once only.
- **Gentle return**: if nothing has been done or opened for 5+ days, the next nudge softens ("no pressure — want to start small?") and picks a quick activity (the ones flagged `easy` in defaults).
- **Check-ins** (default 2/week): "How's today going, Areej?" — *Rough* → she says she'll leave you be and switches Quiet on for two hours; *Okay* / *Great* get a line back.
- **Good morning** (on by default): the first time she's at the Mac each day (within 4 h of active start) — "Morning, Areej." Skipped if a nudge is already due, so it's never two visits in a row.
- **Movie follow-up**: the day after a movie was opened, from noon: "How was *Her*?" — *Loved it* (kept in Settings → Movies → Loved), *Meh*, *Didn't watch* (back on the list).
- **Milestones**: at 10 / 25 / 50 / 100 / 250 Did-its the cheer becomes a milestone line ("That's ten. You're doing the thing.").
- **Cameo walks** (default 2/week): she just strolls across the screen, no bubble.
- **Goodnight** (off by default, Settings → Schedule): once per night, ~90 min after active hours end, if she's still at the Mac: "It's late. Sleep is a study strategy too."
- **iPhone pings** (off by default, Settings → iPhone): install the free ntfy app, subscribe to the private topic Juliet shows you, send a test. From then on anything due while she's *away* from the Mac (locked, idle, elsewhere) goes to her iPhone instead — nudges (tap opens the link), pep talks, movie night (tap opens Netflix search), the recap. At the Mac the cat still handles it; never both. Goodnight stays Mac-only. This is the app's only network use.
- **Dark mode** is the default (Settings window and speech bubble); Settings → Schedule → untick *Dark mode* for the light look.
- Juliet appears on the display your mouse is on.

## Art & animation

`assets/juliet/` is the designer's **`juliet-sprite-v6-clean-eyes-handoff` (v6: clean gold-and-dark eyes)** pack, vendored verbatim (its own README describes the files). Two 512×256 RGBA sheets, 4×2 cells of **128×128**, anchor **(64, 120)**, rendered 1:1 with nearest-neighbour scaling (`image-rendering: pixelated`).

Every appearance follows `juliet-animations.json`:

1. `walkRight` loops (8 frames × 100 ms, 120 px/s) from off the left edge to 20–40 % across the screen — she always finishes the current step before stopping.
2. `turnToUser` (turn-talk frames 1–4).
3. `talkToUser` loops (frames 5–8); the `speechStart` event on frame 5 reveals the code-rendered speech bubble. The text is whatever the app sends (nudge or movie); `"Hi!"` is only the manifest's preview default.
4. On a button click / 90 s timeout: `turnBackRight` (frames 4→1), then `resumeWalkRight` walks her off the right edge.

"Did it" shows a one-line cheer in the bubble before she turns back (the sprite itself is never transformed). `src/shared/juliet-anim.js` mirrors the manifest; `test/anim.test.js` fails if the two ever drift, and decodes the sheets to check dimensions and that every frame's feet land on the anchor row.

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

---

Made by Mirza ([@fabricyo-dev](https://github.com/fabricyo-dev)) for Areej. Pixel art: the Juliet sprite pack (v6).
