# CrewAssist browser smoke rig — `tests/smoke/` (permanent home since 2026-10-07)

This folder lives **inside the repo** so a workspace restore can never wipe it again
(the original rig lived at `/home/user/smoke` and was lost to a restore on
2026-10-07 — rebuilt compact the same day, then moved here on the owner's order).
Only `node_modules` is excluded from snapshots; `npm install` brings it back in
about a minute.

## What it is

The jsdom suite (`tests/`, 12 suites) is the behavioural contract; this rig is
the **real-browser layer**: it boots the actual app in actual Chromium and holds
it to things jsdom cannot see — rendering, computed styles, console/page errors,
the service-worker stamp. It checks:

- Boot: chat view, shell guard passes (compiled `tw.css` applies), zero page
  errors, zero console errors (sandbox-blocked CDN hosts and rig 404s excluded).
- Stamps: `APP_VERSION` (currently 1.45.11), the changelog's current entry,
  the service-worker cache name (v242).
- What's New: the sheet opens on a fresh profile, carries the current version's
  header exactly ONCE (the duplicate white version line was removed), shows the
  pointers, and closes into the welcome chat.
- v1.40.0 semantics: a KUL transit of exactly 180 minutes earns the $55.00
  Southeast Asia lunch (inclusive boundary); 179 minutes earns nothing with the
  honest note; a 20:31 departure (report 19:31) still earns dinner, a 20:29
  departure (report 19:29) has missed the window.
- v1.44.0 hotfix: "help" typed through the real composer answers with the
  structured card (four rows in order, Lucide glyph names only — the rig blocks
  the CDN, so icons stay `<i>` stubs by design); a real tap on a row inserts
  "menu " into the composer, focuses it, flashes the row gold and fades; and
  the composer's computed background resolves to the panel white by day and the
  warm charcoal rgba(4, 7, 15, 0.92) by night (the navy override is gone).
- v1.44.1 typography discipline: the calendar's day numbers compute at 14px and
  its tags/badges at the 11px MICRO floor, against the live stylesheet.
- v1.45.11 Monthly Salary: the earnings sheet opens in COP mode, the lens flip
  to Monthly Salary asks (never guesses) while the profile carries no basic —
  em dash total, visible prompt — and once a basic is set through the app's
  own reload path the net computes (gross 6330 − CPF 1080 = 5250 on the seeded
  pair) with the chart's average-line label painting. A DOM-level click drives
  the lens button: renderArch re-renders the summary, and a geometry-based
  click can race the node swap mid-render.

## Running it

```bash
cd tests/smoke
npm install        # once after a restore (~1 min; reinstalls chromium + tailwindcss)
node build-app.js  # regenerates app.html from ../../index.html (run after every app change)
node run.js        # extracts the chromium libs to /tmp, serves on 8799, runs the smoke
```

`run.js` self-heals the environment: the brotli-packed `al2023.tar.br` libs
(libnspr4/libnss3) are re-extracted to `/tmp/chr-libs/lib` and put on
`LD_LIBRARY_PATH` whenever missing, then the server starts and the smoke runs.

## The tailwindcss CLI rides here

`tw.css` (the compiled stylesheet the app ships instead of the Tailwind Play
CDN, hotfix 18) is rebuilt with this folder's CLI whenever class names change in
`index.html`, from the repo root:

```bash
tests/smoke/node_modules/.bin/tailwindcss -c tw.config.cjs -o tw.css --minify
```

`build-app.js` then picks the fresh `tw.css` up on its next run (it copies the
repo's `tw.css` next to the generated `app.html`).
