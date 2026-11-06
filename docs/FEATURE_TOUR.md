# Feature Tour — the spotlight contract

> Owns the spotlight tour (born v1.49.0; firing order, completion rule,
> veil opacity, viewport-fit and bold copy revised **v1.49.1**; ring glide
> restored, once-key migrated, chat revert and copy pack part 2
> **v1.49.2**): the
> engine's rules, the firing doors, and the eight walks **step by step** —
> what is highlighted, what screen is open, and the exact text displayed.
> Future reorders, additions or copy changes go through this file first,
> then mirror in `index.html`'s `CA_SPOT_TOURS` and `tests/tour.test.js`'s
> pins.
>
> This file replaced `docs/TOUR-BREAKDOWN.md` (the v1.23.0 five-step
> demonstrative tour's log), deleted in the v1.49.0 round.

---

## How to read the walk tables

Each step row carries three things, so a change request can name exactly
what to touch:

- **Highlighted** — the element the gold ring frames (with its selector).
- **Screen open** — the page / sheet / overlay on stage at that moment.
- **Text displayed** — the tooltip's title and line, **word for word**.
  `**bold**` marks render as bold text in the tooltip — in the line since
  v1.49.1 and in the title since v1.49.2; everything else renders plain.
  The copy is the owner's, verbatim.

## The mechanic

One **lit target**, one **tooltip**, one **Next** button at a time.

- A full-screen **veil** (`#ca-spot-veil`, z-95) blocks every tap while a
  tour runs. Highlighted buttons are **shown, never pressed** — the tooltip
  (Next / Back / Skip) is the only interactive surface.
- The **gold ring** (`#ca-spot-ring`) frames the target with breathing room
  (6px); its huge box-shadow paints the dark scrim around the cut-out —
  **rgba(4, 7, 15, .8)** since v1.49.1 (owner order: the lit target and the
  tooltip must stand out hard). The ring **glides** to its target
  (`.24s ease` on top/left/width/height — restored v1.49.2 by owner order;
  the owner missed the v1.49.0 flourish, and it now runs **even under
  reduced motion**, the one `ca-reduced` exception). The tooltip places
  instantly; the ring's inline style IS its destination, so anything
  measuring it (the smoke) waits for the rendered rect to arrive there.
- **The lit target always fits the viewport** (v1.49.1, owner order): every
  step scrolls its target fully into view first (centering, plus a nudge
  when a clamped scroll container still leaves it at an edge), so the ring
  never sits behind a screen edge — and the **tooltip never covers the
  target** it explains (it flips above/below with a 10px gap). The tooltip
  itself never clips the viewport either — the iPhone 11 lesson: flips
  above/below, clamps to 12px margins, width capped at
  `min(300px, 100vw - 24px)` by CSS.
- The **tooltip** (`#ca-spot-tip`) carries the counter (`2 of 7`), the step
  title, the step line, and the buttons. **Back is hidden on step 1.** The
  last step's Next reads **Done**.
- **Escape ends the walk** (a skip). **Tab is trapped** inside the tooltip.
  The ring and tooltip re-place on resize, orientation change and captured
  scrolls (sheets scroll inside their own containers).
- Tapping a Settings row starts that tour **immediately**; the relevant
  overlay opens on its own (the `before`/`world` functions).
- All three geometry promises — ring fully in view, tooltip fully in view,
  tooltip never over the ring — are pinned **for every step of every walk**
  in real Chromium (`tests/smoke/smoke.js`).

## The engine rules

- **The tour is data.** `CA_SPOT_TOURS` (the LAST `<script>` block of
  `index.html`) maps an id → `{ label, world, steps }`. Each step is
  `{ sel, title, line, before? }`. `sel` is a selector string or a function
  returning the element. `before` overrides the tour's `world` for that step.
- **`before`/`world` are idempotent** and set the whole stage — every step
  runs one before the ring is placed, so Back re-runs the prior step's world
  and the stage is always right without diffing. The engine waits ~380ms
  (sheet glide) before measuring.
- **A vanished target never breaks the walk** — a step whose `sel` resolves
  to nothing skips itself and the counter carries on. If nothing remains,
  the tour ends cleanly. Visibility is honest for the app's two hidden
  states: `.hidden` **and** `translate-y-full` (the sheets close by
  sliding off-screen without carrying `.hidden` — a closed sheet's innards
  are not spotlightable), both checked up the ancestor chain.
- **Nothing saved is touched.** Tours that need a prop build it through the
  app's own real paths: the manual-cards tour renders one real calculator
  card (a working prop while the veil is up — Calculate and Confirm go
  live mid-walk). Sheets a walk opened **stay open** when it ends — the
  crew explores from the last step's stage.
- **The chat reverts when the walk ends** (v1.49.2, owner order). The walk
  snapshots the thread's children and scroll at start; on every end — Done,
  Skip, Escape, supersede — children it added (the manual tour's calculator
  card) are removed and the scroll restores. **The chat is never left
  holding tutorial cards.** Sheets are untouched by this rule.
- **Copy ships verbatim.** The tooltip builds the title and line through
  DOM APIs — word for word, never as markup. Since v1.49.1 the line may
  carry `**bold**` markers, which render as bold spans (still built by DOM
  APIs, never raw HTML); since v1.49.2 the title walks the same road (the
  owner's part-2 pack bolds its titles). The aria-label carries the plain
  text, markers stripped.
- **The tour owns the stage** (v1.49.1): while `ca-spot-on` lights the
  chrome, every chat scroll automation stands down — the autoscroll, the
  typing-dots jump, and the card top-align ticker (its 2s of direct
  scrollTop retries used to yank the lit target out from under the ring).
  The engine's own scrolls are `behavior: 'instant'` (never a smooth
  glide), and 350ms after a step shows, one deferred re-assert re-places
  ring and tooltip from the target's FINAL rect — healing any placement
  race in one stroke.

## The firing doors (v1.49.1, owner order)

The flow, exactly as the owner drew it:

> app opens → onboarding (if new user) → else chat screen → **tour fires**
> → tour ends → What's-New bubble → chat message starts firing (the greeting
> and the how-can-I-help)

- **Every crew** — new and returning alike — whose `crewAssist.spotMainDone`
  is unstamped gets the main tour at the chat screen, **before** the
  What's-New sheet and before the greeting. The walk's end hands the stage
  to the sheet (if one is due); the greeting types only once it closes.
- **Only Done completes the walk** (owner order). Done — the last step's
  Next — stamps `crewAssist.spotMainDone`. **Skip and Escape end the walk
  without completing it: the once-flag stays unstamped and the main tour
  fires again on the next app open.** The tour retires only when the crew
  carries it to the end (or restores a backup through the welcome door,
  which stamps the flag — a restoring user is not a new user).
- **Every tour replays forever from Settings** → Feature tour, regardless
  of the flag. The chat command `tour` and the help card's CTA also start
  the main tour.
- **The once-key is `crewAssist.spotMainDone` (v1.49.2).** The
  v1.49.0/1.49.1 key `crewAssist.spotMainSeen` is RETIRED and wiped at
  script-eval time on every load: v1.49.0 stamped it on ANY end (Skip and
  Escape included), so every device that lived through those builds
  carried a stale flag and never walked again — the owner's
  What's-New-before-tour report was exactly that. The wipe means every
  existing crew meets the walk once more; only Done (or a welcome-restore)
  writes the new key. The test harness pre-stamps `spotMainDone` on every
  jsdom boot (test boots are "done" devices); suites that pin the firing
  or the restore doors clear it deliberately in their seeds.

## The eight walks (Settings order; 47 steps)

Settings → **Feature tour**, eight rows in one glass box, in this order:

| Row | id | Steps |
|---|---|---|
| Main screen | `main` | 7 |
| Roster import | `roster` | 6 |
| Manual flight cards | `manual` | 6 |
| Menus & search | `menus` | 6 |
| Earnings | `earnings` | 6 |
| Calendar | `calendar` | 6 |
| Flight Stats | `stats` | 5 |
| Backup & restore | `backup` | 5 |

### Main screen (`main`, 7 steps)

Screen open: the **main chat screen** throughout (Settings closed; the chat
thread sits empty when the walk fires on its own — the greeting waits
behind it).

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The chat bar — the typing field at the bottom (`#chat-input`) | Chat screen | **At your service** — Ask about your flight or type "help" / "?" for quick commands. |
| 2 | The paperclip — the roster-attach button beside the typing field (`#btn-roster`) | Chat screen | **Activate Your Dashboard** — Attach your roster report to unlock your flight calendar, calculated allowances, and flight insights. |
| 3 | The one-tap shortcut chips row, under the typing field (`#action-chips`) | Chat screen | **Quick-Access Commands** — Instant answers for allowances, earnings, inflight menus, and menu prints. |
| 4 | The calendar button in the top bar (`#btn-roster-cal`) | Chat screen | **Track Your Flights** — Access your full schedule, flight records, and personal crew stats in one place. |
| 5 | The theme button in the top bar (`#btn-theme`) | Chat screen | **Theme Toggle** — Tap anytime to switch seamlessly between light and dark theme. |
| 6 | The settings button in the top bar (`#btn-settings`) | Chat screen | **Account & Preferences** — Update your profile details, manage your saved data, or replay feature tours whenever you need. |
| 7 | The reset button in the top bar's right corner (`#btn-reset`) | Chat screen | **Clear Screen** — Double-tap to clear your screen. Your saved data remains untouched. |

### Roster import (`roster`, 6 steps)

Screen open: the **main chat screen** throughout. Per the owner's v1.49.1
order, **steps 2 and 6 keep spotlighting the paperclip** (`#btn-roster`);
per the v1.49.2 order, **step 4 spotlights the earnings chip**.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The paperclip (`#btn-roster`) | Chat screen | **First, your Roster Report** — Upload your Roster Report PDF directly from CrewApp using the paperclip icon. |
| 2 | The paperclip again (`#btn-roster`) | Chat screen | **Hands-Free Import** — Every line is analyzed automatically. All flights, dates, sectors, and reporting times are extracted instantly without you typing a thing. |
| 3 | The calendar button in the top bar (`#btn-roster-cal`) | Chat screen | **Seamless Integration** — Your calendar fills up instantly with your imported data. |
| 4 | The "How much have I earned?" chip in the shortcuts row (`#action-chips .action-chip[data-intent="earn"]`) | Chat screen | **Seamless Integration** — As well as the allowances from your flights. |
| 5 | The paperclip (`#btn-roster`) | Chat screen | **Stay updated** — Re-upload your pdf whenever you get a new monthly roster or schedule changes. Your calendar and allowances update seamlessly. |
| 6 | The paperclip (`#btn-roster`) | Chat screen | **No Guesswork** — If your uploaded file isn't recognized as a valid roster, I will let you know immediately rather than guessing your data. |

### Manual flight cards (`manual`, 6 steps)

Step 1 lives inside **Settings**; every step after returns to the **chat
screen** with one real calculator card the walk built in the thread. The
card works while the veil is up; when the walk ends the chat reverts and
the card leaves with it (v1.49.2, owner order — no tutorial cards).

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The Manual pill in Settings' calculator section (`#calcui-pill-manual`) | Settings sheet | **No roster? No problem** — Add a card by hand when the trip isn’t on a PDF. |
| 2 | The route field on the card the walk built (the From input) | Chat screen, card in thread | **Fill the flight** — Route, date and times — the card matches the roster’s own fields. |
| 3 | The card's Calculate button | Chat screen, card in thread | **One tap, priced** — Calculate works the card out against your rank and rate. |
| 4 | The Calculate-all batch button (the step skips itself on a device that never imported a roster) | Chat screen, card in thread | **The whole batch** — Calculate-all totals everything together, grouped by month. |
| 5 | The trip bar strip on the card (route + allowances) | Chat screen, card in thread | **Allowances included** — IFA and LMA price out beside the sectors in the trip bar. |
| 6 | The card's masthead (its title row) | Chat screen, card in thread | **Save it or undo** — Confirm files the trip into your earnings — undo takes it right back out. |

### Menus & search (`menus`, 6 steps)

Steps 2–5 run with the **menu viewer sheet open** — it opens the first
**saved** menu when one exists (the cached offline path, no network ever);
without one, those steps fall back to highlighting the menus chip on the
chat screen. Steps 1 and 6 highlight the composer.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The typing field (`#chat-input`) | Chat screen | **Just ask** — Type a flight and a date — sq802 menu 17 oct — and I fetch the menus. |
| 2 | The menu hero — the flight banner at the top of the viewer (or the menus chip, no saved menu) | Menu viewer sheet | **The viewer** — Courses in service order, exactly as the galley works them. |
| 3 | The cabin switcher inside the viewer (or the menus chip, no saved menu) | Menu viewer sheet | **Pick your cabin** — The switcher jumps between the cabins on your flight. |
| 4 | The print button inside the viewer (or the menus chip, no saved menu) | Menu viewer sheet | **Print-ready** — Full sheet or compact — both lay out for the galley printer. |
| 5 | The cycle button — it walks your saved menus (or the menus chip, no saved menu) | Menu viewer sheet | **Saved on your phone** — Menus you’ve opened stay readable offline, no signal needed. |
| 6 | The typing field (`#chat-input`) | Chat screen | **Speak naturally** — jcl ycl menu sq802 — name the cabins you want, in your order. |

### Earnings (`earnings`, 6 steps)

Screen open: the **earnings archive sheet** (the money page) for all six
steps — it opens itself when the walk starts.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The Earnings title at the top of the money page | Earnings archive sheet | **This is your money page** — Every trip you save adds up here, month by month. |
| 2 | A month card (falls back to the list on an empty archive) | Earnings archive sheet | **One month, one card** — Each card is a month’s earnings — tap it to open the trips. |
| 3 | The lens switcher (salary take-home ↔ COP sectors) | Earnings archive sheet | **Two ways to read it** — The lens switches between your salary take-home and your COP sectors. |
| 4 | The summary card (`#ca-arch-summary`) | Earnings archive sheet | **The honest breakdown** — Gross, CPF, your overseas expenses, and what actually lands. |
| 5 | The search field (`#ca-arch-search`) | Earnings archive sheet | **Find anything** — Search by route, flight or month to surface old trips fast. |
| 6 | The export button (`#ca-arch-export`) | Earnings archive sheet | **Take it with you** — Export the JSON or the CSV — your expenses ride along in both. |

### Calendar (`calendar`, 6 steps)

Screen open: the **roster calendar** for all six steps — it opens itself
(fresh) when the walk starts. The tag button turns the tags **on** for the
camera step (the camera appears only with tags on — the owner's v1.45.x
correction) and back **off** for the steps around it.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The month grid (`#ca-rc-grid`) | Roster calendar | **Here’s your roster** — Every imported flight paints onto its day — duties, standby and all. |
| 2 | The tag button at the top of the calendar (`#ca-rc-tag`, tags off at this step) | Roster calendar | **The tag button** — Tap it and every flight day shows its station and arrival time. |
| 3 | The camera button (`#ca-rc-shot` — visible only with the tags on, which this step turns on) | Roster calendar, tags on | **The camera comes out** — With the tags on, the camera appears — it turns the month into a picture, ready to share. |
| 4 | The month arrows (`#ca-rc-prev`) | Roster calendar | **Walk the months** — Swipe or tap the arrows to move between months. |
| 5 | A day cell (today, else the first flight day; falls back to any day) | Roster calendar | **Tap a day** — The day opens its flights — times, sectors, and what it earns. |
| 6 | The records door (the passport gate; falls back to the grid when no leg was ever imported) | Roster calendar | **The records door** — Your passport and all-time stats live behind this gate. |

### Flight Stats (`stats`, 5 steps)

Screen open: the **Flight Stats passport page** for all five steps — it
opens itself when the walk starts.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The Passport title at the top of the records page | Flight Stats passport | **Your passport** — The records page tallies everything — flights, hours, stations. |
| 2 | The hero card at the top (`#ca-rc-pod-herowrap`) | Flight Stats passport | **The hero card** — Flight time, layover days, top station — your logbook in five rows. |
| 3 | The stats podium (falls back to the page body on an empty logbook) | Flight Stats passport | **The stats podium** — Your most-visited stations and longest flights, ranked. |
| 4 | The year pills and duty tabs | Flight Stats passport | **Slice it your way** — The year pills and duty tabs filter the podium to any slice. |
| 5 | A station row (falls back to the page body) | Flight Stats passport | **Every visit on record** — Tap a station to open its full visit log. |

### Backup & restore (`backup`, 5 steps)

Screen open: **Settings stays open** — the spotlight moves within the
sheet (owner order). Targets are the Data Management box and its doors.

| # | Highlighted | Screen open | Text displayed |
|---|---|---|---|
| 1 | The Data Management box (`#ca-dm-box`) | Settings sheet | **Your data, your file** — One backup file carries everything — profile, rates, earnings, history. |
| 2 | The Export backup button (`#btn-backup-export`) | Settings sheet | **Export before you switch** — Data Management → Export backup — the file lands in your downloads. |
| 3 | The Restore backup button (`#btn-backup-restore`) | Settings sheet | **The new phone** — Install the app, skip onboarding, and Restore backup from the same door. |
| 4 | The Export backup button again (`#btn-backup-export`) | Settings sheet | **Expenses ride along** — Overseas expenses are inside every backup — they show on any device. |
| 5 | The Data Management box (`#ca-dm-box`) | Settings sheet | **Keep it private** — The file holds your pay data — keep it somewhere only you control. |

## The v1.49.2 round (owner orders, 2026-11-06)

- **The stale once-flag wiped** — What's-New still fired before the tour
  for existing crew because v1.49.0 had stamped `spotMainSeen` on ANY end
  (Skip and Escape included); every device off those builds read as
  "already walked". The key is retired and wiped on load
  (`spotMainDone` replaces it), so every existing crew meets the walk
  once more.
- **The ring glides again** — the `.24s` transition is back on the ring
  (the owner missed it), and it runs **even under reduced motion** (the
  one `ca-reduced` exception; only the tooltip keeps the kill rule, as
  belt-and-braces). The v1.49.1 "jump" was a rig workaround; the smoke
  now waits for the ring to arrive at its inline-style rect before
  measuring, so the glide and the never-cover guarantee both hold.
- **Copy pack part 2** — Main screen (all 7) and Roster import (all 6,
  with a NEW step 4 spotlighting the "How much have I earned?" chip)
  rewritten verbatim from the owner's pack, bold titles included. Part 3
  (the other six walks) pending the owner's testing.
- **The chat reverts** — when a walk ends, children it added to the thread
  (the manual tour's calculator card) are removed and the scroll
  restores. The chat is never left holding tutorial cards.

## The v1.49.1 round (owner orders, 2026-11-06)

- **Firing order** — the walk fires at the chat screen, before the
  What's-New sheet and the greeting, for every crew (the old
  What's-New-close arm and the `caSpotFresh` flag are gone).
- **Done is the only finish** — Skip and Escape leave the once-flag
  unstamped; the walk returns on the next app open.
- **The veil darkened** to rgba(4, 7, 15, .8) (owner: the spotlight and
  tooltip must be more obvious).
- **Viewport fit** — every lit target is scrolled fully into view
  (instantly, centered) and the tooltip never covers it (owner order,
  pinned per-step in the smoke). The geometry hardening that followed:
  whole-sheet and whole-card rings retired (a ring frames a lit TARGET,
  never the page — the Earnings/Passport steps light their titles, the
  menus steps light the hero/cycle/cabin/print controls, the manual-card
  steps light the route field, the Calculate button and the masthead);
  closed-by-translation sheets read as closed; the chat's scroll
  automation freezes under the veil; and a 350ms deferred re-assert
  re-places ring and tooltip from the final rect after every step.
- **Bold copy** — `**bold**` markers render as bold text in the tooltip.
- **Copy pack part 1** — Main screen (all 7) and Roster import (all 5,
  steps 2 and 5 re-targeted to the paperclip) rewritten verbatim from the
  owner's pack. Part 2 (the other six walks) pending the owner's testing.

## The old tour's removal record (v1.49.0)

The v1.23.0 five-step demonstrative tour (greeting → roster showpiece →
Default → Manual → menu/print) was removed whole: the final script block's
engine (`startCaTour`, `CA_TOUR_STEPS`, the offer logic), the `ca-tour-glow`
CSS and `ca-tour-on` chrome lockdown, the Settings Replay row, the
`maybeOfferTour` first-run offer, `caTourPace` (the chat's fast pace is now
unconditional), the `caTourInterrupt` typing hook, the `window.caTourArchiveStore`
session-store redirect in `loadArchive`/`persistArchive`, the `tourDone`
stamp (replaced by `spotMainSeen`), and `docs/TOUR-BREAKDOWN.md`. The help
card's CTA and the `tour` command now start the main spotlight tour.

## Tests

- `tests/tour.test.js` — the walk end-to-end in jsdom: registry, verbatim
  copy (all of Main + Roster — part 1 in v1.49.1, part 2 in v1.49.2), the
  bold-marker rendering (line and title), counter/Back/Done/Skip/Escape,
  the Done-only stamping (skip returns), the skip-a-vanished-step
  contract, every walk's world, the chat revert, the firing doors
  (every-crew at the chat screen, before the sheet; onboarding; the
  pre-stamp harness rule), the once-key migration pins, and the old-tour
  absence pins.
- `tests/smoke/smoke.js` — real Chromium: the eight Settings rows, the
  full main walk with the bold pins, the geometry pins (ring fully in
  view, tooltip never clips, tooltip never covers the ring — every step
  of **every** walk), the Done/skip stamping, and the firing doors across
  reloads (fires before the sheet, skip returns next open, Done retires).
- `tests/dev-ui.test.js` — the Settings rows, the E6 changelog ladder, the
  help-CTA start.
