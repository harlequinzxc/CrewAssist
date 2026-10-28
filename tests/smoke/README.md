# CrewAssist browser smoke rig — `tests/smoke/` (permanent home since 2026-10-07)

This folder lives **inside the repo** so a workspace restore can never wipe it again
(the original rig lived at `/home/user/smoke` and was lost to a restore on
2026-10-07 — rebuilt compact the same day, then moved here on the owner's order).
Only `node_modules` is excluded from snapshots; `npm install` brings it back in
about a minute.

## What it is

The jsdom suite (`tests/`, 14 suites) is the behavioural contract; this rig is
the **real-browser layer**: it boots the actual app in actual Chromium and holds
it to things jsdom cannot see — rendering, computed styles, console/page errors,
the service-worker stamp. It checks:

- Boot: chat view, shell guard passes (compiled `tw.css` applies), zero page
  errors, zero console errors (sandbox-blocked CDN hosts and rig 404s excluded).
- Stamps: `APP_VERSION` (currently 1.45.24), the changelog's current entry,
  the service-worker cache name (v255).
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
- v1.45.12 earnings polish, computed where the pixels live: the core figure's
  8px paddings, the stat rows as equal 3/4-track grids with no clipping cell,
  WCAG AA maths composited IN-PAGE (text over pill wash over the gold
  gradient's worst-case stop, both themes — the .75 tab ink reads 5.2:1),
  the status badges as solid pills with AA text (7.5:1 / 8.7:1 at night),
  the month cards a shade lighter than the sheet canvas, and the salary
  money column's net/gross edges straight to 1.5px across months. The
  style-snapshot rig now seeds an archive so the earnings LIST is
  style-covered (it never was before).
- v1.45.13 earnings fresh-open + chart scope: a fresh open lands on Month +
  COP with the IFA/LMA counting row absent, the core figure carries 16px of
  air, the stat rows ride ONE strict 4-track grid (the COP context cell
  spans two tracks, values never clip), the Year-by-Year legend shows in
  salary view with swatches matching the stacked segments exactly and steps
  aside in COP, a non-selected bar sits at 0.65 alpha (35% under the
  selected bar's solid gold), and an empty future month renders the 16px
  striped placeholder. Two rig lessons live in the probes: the AA maths
  snaps running transitions to their settled state
  (`document.getAnimations().forEach(a => a.finish())`) and parks the
  virtual cursor at (2,2) before opening the sheet (a leftover real-mouse
  position holds a `:hover` on a seg and skews the ink reading), and the
  future placeholder reads its inline `height` style because the .4s bar
  grow animation races `getBoundingClientRect()`.
- v1.45.14 earnings depth: the fresh open lands on the CURRENT month even
  when a pre-saved future month is the newest save (the never-fallback
  fix); COP + Month pairs the counts in two equal columns with the
  on-track milestone spanning the full card width (and the bullseye icon
  at gap-x-2); the ledger values align down one strict column, ending
  clear of the fixed 40px ✕ slot; All-time returns to the flat 4-track
  meta; and daylight computes warm — canvas #F4F4F0, solid white cards
  with the 0 4px 12px rgba(0,0,0,0.03) shadow, walnut #3D2D1B inactive
  pills at AA over the gold (the badge-pill probes themselves became the
  v1.45.16 state-icon + active-pill probes below).
- v1.45.15 roster-aware notice + centring: the CURRENT month carries the
  still-to-fly notice while its roster has legs ahead (the gold card reads
  "On track · N roster flights still to fly", never "Month complete"; the
  panel says "not saved yet" with no guessed dollar and no fake $0.00);
  the ledger ✕ centres on its text block (measured sag ≤2px, actual 0.0px)
  with route and value sharing one baseline (≤1.5px, actual 0.0px) over
  the flex items-center justify-center wrapper; and the inactive pills
  compute espresso rgb(26, 19, 0) by night and walnut rgb(45, 30, 15) by
  day, at font-weight 800 in both themes, the walnut reading AA (7.51:1)
  over the composited gold.
- v1.45.16 state icons + daylight active pill: the live month wears a
  refresh-cw whose computed animation is the caArchLive 6s infinite loop
  (and stops dead behind the ca-reduced gate, resuming when it lifts); the
  future month wears clock-arrow-up; the night active pill computes
  espresso/gold while the DAY active pill computes white/walnut at AA
  (16.10:1 — the invisibility fix, read with transitions snapped); the
  count line carries the owner's exact formats ('2 flights • In progress',
  '1 flight • Upcoming', '• Completed' for an all-flown current month);
  and a past month renders no state asset and no suffix. The rig blocks
  the CDN, so the icons stay `<i>` stubs — name + class + computed
  animation are the proof, and the name's production resolution was
  verified against the unpacked lucide package.
- v1.45.17 milestone + placeholder: the gold card's milestone label
  computes 'Remaining to earn' with its uppercase transform, tracking and
  the 11px MICRO rung intact, the bullseye riding the flex items-center
  gap-2 baseline, the line reading '$696.91 before end of month' verbatim;
  and the daylight 'Search flights…' placeholder computes dark slate
  rgb(107, 114, 128) at opacity 1 while the night ink stays its own
  (default) value — read through getComputedStyle(el, '::placeholder').
- v1.45.18 remaining-flights + annual avg: the panel header reads
  'Remaining flights' in its uppercase micro style with the line counting
  'N flights completed · M left', the $696.91 gold figure preserved on its
  justify-between row; and COP + ALL-TIME carries 'Annual avg' at the 11px
  label rung with the $750.00 value as BARE text (zero spans — the ctx
  ellipsis rule can never clip it), matching the FLIGHTS / AVG-per-flight
  typography, while YEAR keeps its YTD context.
- v1.45.20 after-hours quadrants: the salary stat row rides the strict
  2×2 at every viewport (nothing clips), the labels read Basic / Fixed /
  After-hours / COP leading with their Lucide icons at a uniform 14px on
  the low-opacity espresso token (the Fixed pair shirt+car-front tight
  at a 2px gap), and the gross/CPF subtext computes as the single
  no-wrap figures row with the muted pipe at opacity .45 and a COMPLETELY
  EMPTY right side in every scope; at an 800px viewport the quadrants
  measure equal halves with uniform 12px padding, both hairline axes on
  the right classes, and the theme tokens verified by flipping dark/light
  (night rgba(255,255,255,0.08), day rgba(0,0,0,0.06)) — the axis rules
  must stay longhand or currentcolor beats the tokens; and at 340px the
  values compute at the owner-ordered 12.5px scale-down inside the
  intact 2×2.
- v1.45.21 quadrant unification: the COP stat row rides the same 2×2
  hairline architecture (grid3 + the month layer: equal halves, the
  Flights quadrant carrying both axis hairlines while Avg carries only
  the bottom, uniform 12px padding, the milestone/context cell spanning
  the full bottom row, the same theme tokens verified for both grids);
  the YEAR-view net comparison rides BESIDE the headline figure as the
  badge (the 14px rung bold nowrap, 12px off the number on the shared
  text baseline, deep green rgb(18,63,34) / deep brick rgb(110,31,31),
  an AA probe compositing the badge ink over the gold card's MID
  gradient stop at ≥ 4.5); the earliest year hides the badge entirely
  and the earliest COP year reads the clean quiet em dash (never a 'not
  on record' string); and the gross row stays the single string in
  every scope. The layers swap viewports
  (390 → 800 → 340 → 390) and restore before health.
- v1.45.22 overseas expenses: the badge probe re-points to the
  trending-icon contract — the `i[data-lucide]` stub name by sign
  (trending-up/down — the CDN stays blocked in the rig, so the name and
  the class are the proof), the SIGNED one-decimal span, the 14px
  w-3.5/h-3.5 box measured on the stub, the flex pair (align-items
  center, gap 4px; NOTE: `display: inline-flex` BLOCKIFIES to `flex`
  in getComputedStyle because the badge is a flex item of the baseline
  row — pin either), zero triangles left in the text; the money-column
  probe re-points to the value-span hooks (.ca-arch-amt-net/-gross)
  plus the pair-row contract (justify-center on the column, nowrap
  flex rows, the 6px label gap, lowercase labels); and a new layer
  drives the whole expense flow in the real browser — seeded layover
  expense → the card's Exp segment + the quiet After-expenses line
  (expected through the app's own formatMoney), the three-row month
  head with ALL THREE value right edges on one vertical line and the
  third row on the same muted ink as gross, the no-expense month
  exactly two rows (read from the GROUP — the money column rides
  beside the head button, not inside it), the summary sheet's receipt
  row, a typed edit (focus + select, then keyboard.type + Enter)
  committing to detail.expense with the card updating live behind the
  sheet, the toast, Undo restoring, a zero commit removing the field,
  and the COP lens showing no expense context anywhere.
- v1.45.23 the rigid money grid: the money probe re-points to
  `.ca-arch-amt.ca-arch-moneygrid` (display grid, exactly 2 tracks, the
  8px column gap, baselines paired, rows centred, the block pushed right,
  per-cell nowrap, the 'NET' label, the label rail one vertical line, the
  value right edges straight across months); the 1.45.22 layer's head pins
  re-point to the grid DOM (six cells / four without expenses, the
  UPPERCASE 'AFTER EXPENSES' label at the value cell's
  previousElementSibling, the muted ink compared on the value CELLS — the
  old pair rows are gone); and a NEW 375px layer holds the order's
  headline contract in the real browser — a three-row month at 375px
  drops the grid to its own right-aligned line under the month text
  (month label and count line each ONE line, no cell clip, no sideways
  scroll, the label rail + decimal edge + 12px row inset), the NET gold
  and the secondary muted ink verified by night AND day (theme flip via
  the `.dark` class + offsetWidth reflow), the four-cell no-expense month
  sharing the row again at 375px, and the three-row grid back beside the
  text at 430px. Rig lesson: the month-label selector `span.text-\[17px\]`
  needs the two-backslash CSS escape IN SOURCE — a single backslash is an
  unknown JS escape that arrives bracket-naked and throws.
- v1.45.24 tokens, decode, and the hero's centre axis: the money probe
  and the 375px layer re-point to the token rail — the three labels are
  single characters (N / G / N-minus) as `role="button"` spans
  (`.ca-arch-mgtok`), the third-row pin reads the N-minus token, and the
  noClip probes must TOLERATE the token cells: their `::after` hit
  extenders reach 4px past the quiet cell, inflating scrollWidth to
  clientWidth + 4 — a false clip (tolerance +5 for mgtok, +1 elsewhere).
  A new token-tap layer drives the real decode in Chromium: tap N shows
  the 'Net Earnings' micro-card, tap G swaps one-at-a-time, re-tap
  toggles off, 1.8s auto-dismiss, an outside tap closes, and a token tap
  inside the projection button leaves the still-to-fly panel closed (the
  stopPropagation proof). The 375px layer now asserts the month label one
  line with a LONG count line wrapping cleanly at its word boundary inside
  its own box — the token block is narrow enough to share the row at
  375px, and one line + the block is ~3px more than 375px can hold. A NEW
  menu-hero layer opens the viewer through the app's own front door —
  `openNextFlightViewer('836', d)` after seeding the CABINS + JCL saves
  (a direct `openMenuViewerForCabins` call leaves the hero EMPTY: it
  expects the CALLER to set `currentMenuSearch` first — the front door
  does) — and pins the centre axis at 375px: the island measured
  0.00px off the row's true centre on BOTH axes, the strictly identical
  halves, the nowrap duration pill (~26.5px one line), the 8px clearances
  off the island, ellipsis on the owner's own worst-case city name, and
  the plane on the dotted apex. Rig lesson: the 1.45.15 notice layer's
  seed had a `Math.min(date+3, 27)` cap — on the 27th of any month the
  'ahead' legs landed TODAY 18:00 and every evening run failed; the cap
  is gone (plain +3 days, JS spills at month-end and the store keys by
  the run's month).
- v1.45.31 the expense surface becomes Developer Mode's (Option A): the
  expense section now runs the whole gate story in real Chromium — with
  dev mode off (the fresh boot) the card shows no Exp segment, the grid
  keeps four cells, and the layover summary carries no receipt row
  (`openArchEntry('x1')` — the internal door, no navigation needed);
  then TEN TAPS on `#header-brand` (the only door — the brand sits under
  the full-screen archive, so the section closes the overlay first) and
  the unlock toast + the settings pane + the localStorage flag prove the
  door. The section's x1 is seeded WITH sectors now, so the summary opens
  the DETAILED branch and the position pin reads the receipt row at
  `children[1]` — between the grand total card and the Flight Overview,
  the owner's iOS workaround (the position is the fix). A persistence
  block rides after the 375 layers — dev off drops the third grid row
  and the Exp segment while the stored figure sits untouched, dev on
  brings the row back pre-filled ($120.00), and the section closes with
  dev mode restored OFF (the rest of the run expects the default state).
  Rig lessons: the 375 money-grid section re-seeds the archive with its
  own g1/g2/g3 ids — cross-section pins must target the CURRENT ids, not
  the expense section's x1; and the 1.45.25 midnight bombs re-landed on
  this rig (five ahead/next-month seeds with `Math.min(date+5, 27)` — on
  the 27th they read as flown, the live month flipped to Completed and
  the refresh-cw probe crashed on a null): the walls are future `endAt`
  stamps on every ahead/next-month seed (`archEntryLanded` honours endAt
  over dates — run-hour-immune), ported test-side only from the 1.45.25
  rig work; the app's keyboard rounds stay rolled back. One motion-pill
  tap flake (run 1 of 3) did not reproduce — recorded, not hardened.
- v1.45.32 the plural expense labels: the expense section's two label pins
  re-point — the row-presence pin reads 'Overseas Expenses' and the
  zero-commit pin reads 'Add Expenses' (the storage-panel layout work rides
  the dev-ui suite; the smoke's settings layers never pinned the storage
  values). Version pins: APP_VERSION 1.45.32, the changelog's two-pointer
  entry, sw v263, the v1.45.32 What's New header.
- v1.45.33 the lightbox pinch, proven with REAL multi-touch: a CDP session
  (`Input.dispatchTouchEvent`) drives two touch-point ids — the pair lands,
  spreads and slides in one motion, and the inline transform is read back:
  zoom and pan in the same paint, the release springs home through the
  elastic class, the trailing release never closes the view, the hint fades
  at exactly three seconds, and a plain tap on the image exits. LESSON:
  jsdom keeps the raw inline style string, but Chromium re-serializes
  through the CSSOM without trailing zeros ('10px', 'scale(1)') — browser
  pins PARSE the numbers out of the transform, never pin the spelling. One
  tap-race flake (the roster tag toggle, the round-27 hardened pin) fired
  once in three runs and passed the other two — the recorded environmental
  class. Version pins: 1.45.33 / v264.
- v1.45.34 the changelog chips in the real browser: a 7c layer right after
  the settings widths pin opens the changelog through the real UI
  (`openChangelog()`), pins the normalized chip join All|New|Fixes|Polish,
  and reads the REAL computed mask — `getComputedStyle(#ca-cl-chips)
  .maskImage` regex-matched, because Chromium re-serializes the gradient's
  colors through the CSSOM (transparent → rgba(0, 0, 0, 0), black →
  rgb(0, 0, 0)); jsdom's computed mask is NOT reliable, so the jsdom layer
  pins the rule in SOURCE, and only this browser layer owns the style.
  SEAM LESSON (the big one this round): a layer that adds wall-time between
  two existing sections inherits every boot-time visitor that fires in the
  gap it widens — the reduced-motion tap downstream moved past TWO latent
  ones. (1) The welcome cadence's late typing windows: a leftover
  #typing-indicator tripped the reduced-motion pin — fixed with a chat-idle
  drain wait inside the layer's tail (chat-busy is CONTINUOUS across the
  whole bot queue; it only clears when the queue drains, so one idle wait
  IS the drain signal — the rig's own restored-phone precedent). (2) The
  one-shot install-hint dialog (`maybeInstallHint`, armed by the
  restored-phone archive + a quiet boot, firing ~2.5s after init): it sits
  above the settings sheet and the coordinate TAP landed on app-dialog-msg
  while every evaluate pin around it stayed green (evaluate clicks sail
  past overlays; only coordinate taps meet them — a green section followed
  by a tap timeout means SOMETHING IS ON TOP: dump elementFromPoint and the
  app-dialog state before suspecting the element). Fixed with a user-style
  app-dialog-ok dismissal at the layer's tail — the same guard the later
  clear-data seam always ran, just earlier. diag34.js reproduces the seam
  (timeline + catch modes). Version pins: 1.45.34 / v265.
- v1.45.35 the stuck exit guard, proven live: after the v1.45.33 two-finger
  CDP pinch, both fingers lift (the snap-back springs home, the 460ms
  trailing-click guard window arms), then a fresh ONE-finger CDP tap lands
  on the veil 120ms later — inside the live window — and the view CLOSES.
  That is the owner bug in miniature: under the old engine this exact tap's
  pointerdown cancelled the only timer that ever cleared the guard, and no
  tap could ever close the view again. A CDP touchStart/touchEnd pair with
  one touch-point synthesizes the full pointerdown/up + click sequence, so
  single taps can be driven the same way as the multi-touch pinch (id 3
  here; the pair's ids 1/2 are what the fresh-tap logic must NOT match).
  Version pins: 1.45.35 / v266.

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
