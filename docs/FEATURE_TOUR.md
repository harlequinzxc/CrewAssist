# Feature Tour — the spotlight contract

> Owns the v1.49.0 spotlight tour: the engine's rules, the firing doors, and
> the eight walks' copy **verbatim**. Future reorders, additions or removals
> go through this file — change the walk here first, then mirror it in
> `index.html`'s `CA_SPOT_TOURS` and `tests/tour.test.js`'s pins.
>
> This file replaced `docs/TOUR-BREAKDOWN.md` (the v1.23.0 five-step
> demonstrative tour's log), which was deleted in the same round.

---

## The mechanic (owner-settled, 2026-11-04)

One **lit target**, one **tooltip**, one **Next** button at a time.

- A full-screen **veil** (`#ca-spot-veil`, z-95) blocks every tap while a
  tour runs. Highlighted buttons are **shown, never pressed** — the tooltip
  (Next / Back / Skip) is the only interactive surface.
- The **gold ring** (`#ca-spot-ring`) frames the target with breathing room
  (6px); its huge box-shadow paints the dark scrim around the cut-out. The
  ring glides between steps (`.24s ease`, killed under `ca-reduced`).
- The **tooltip** (`#ca-spot-tip`) carries the counter (`2 of 7`), the step
  title, the step line, and the buttons. **Back is hidden on step 1.** The
  last step's Next reads **Done**.
- **The tooltip never clips the viewport** — the iPhone 11 lesson. It flips
  above/below the target, clamps to 12px margins, and its width is capped at
  `min(300px, 100vw - 24px)` by CSS. Pinned with real-Chromium geometry in
  the smoke suite (every step of the main walk).
- **Escape ends the walk** (a skip). **Tab is trapped** inside the tooltip.
  The ring and tooltip re-place on resize, orientation change and captured
  scrolls (sheets scroll inside their own containers).
- Tapping a Settings row starts that tour **immediately**; the relevant
  overlay opens on its own (the `before`/`world` functions).

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
  to nothing (or to a `.hidden` element, checked up the ancestor chain)
  skips itself and the counter carries on. If nothing remains, the tour ends
  cleanly.
- **Nothing saved is touched.** Tours that need a prop build it through the
  app's own real paths: the manual-cards tour renders one real calculator
  card (a working prop the crew keeps — Calculate and Confirm go live the
  moment the veil lifts). Sheets a walk opened **stay open** when it ends —
  the crew explores from the last step's stage.
- **Copy ships verbatim.** The tooltip renders title and line through
  `textContent` — word for word, never as markup.
- Visibility is the `.hidden` class walk (honest in jsdom, where nothing has
  layout, and in the browser alike).

## The firing doors (test-safe by design)

The main tour shows **once**; every tour replays forever from Settings.

1. **New crew** — onboarding completion arms a session flag; after the
   greeting settles (~1.2s), if `crewAssist.spotMainSeen` is unstamped, the
   main tour starts.
2. **Returning crew** — a device that already carried a `crewAssist.wnSeen`
   stamp meets a new release through the What's-New sheet; when the sheet
   closes (with the welcome chat held behind it), the main tour follows the
   greeting. Devices with What's-New suppressed (`hideWhatsNew` stamped) meet
   the tours **in Settings only**.
3. **Restoring from the welcome screen is not a new user** — the restore
   door stamps `crewAssist.spotMainSeen` before the reload.

Done, Skip or Escape on the **main** tour stamps `crewAssist.spotMainSeen`
(the old `crewAssist.tourDone` key is gone). Fresh test boots carry no
`wnSeen` stamp, so they never fire door 2 — deterministic suites by
construction. The command `tour` and the help card's CTA both start the main
tour.

## The eight walks (Settings order; 46 steps)

Settings → **Feature tour**, eight rows in one glass box, in this order:

| Row | id | Steps |
|---|---|---|
| Main screen | `main` | 7 |
| Roster import | `roster` | 5 |
| Manual flight cards | `manual` | 6 |
| Menus & search | `menus` | 6 |
| Earnings | `earnings` | 6 |
| Calendar | `calendar` | 6 |
| Flight Stats | `stats` | 5 |
| Backup & restore | `backup` | 5 |

Walk-specific contracts:

- **Main screen** closes Settings first (the other walks from Settings do
  the same unless their stage is a sheet); the chat bar leads (step 1).
- **Manual flight cards** opens Settings for the Manual pill (`calcui-pill-manual`),
  then builds one real card; the Calculate-all step targets the roster
  batch button and **skips itself** on a device that never imported a roster.
- **Menus & search** opens the first **saved** menu when one exists (the
  cached offline path — no network ever); otherwise its viewer steps fall
  back to the menus chip. The offline step is kept by owner order.
- **Earnings** opens the archive sheet; the month-card step falls back to
  the list (an empty archive teaches honestly).
- **Calendar** opens the roster calendar (every open starts clean); the
  camera step turns the tags **ON** first — the camera appears only with
  tags on (the owner's correction); the records-door step falls back to the
  grid when no leg was ever imported (the door stays hidden without data).
- **Flight Stats** opens the passport page; podium/pill/station steps fall
  back to the page body on an empty logbook.
- **Backup & restore** keeps Settings **open** — the spotlight moves within
  the sheet; targets are the Data Management box and its two doors.

## The copy (verbatim — the pack the owner approved, 2026-11-04)

### Main screen (7)
1. **Talk to me** — Ask me anything about your flights — this is where we talk.
2. **Your roster goes here** — Attach the Crew Roster PDF and I read every flight off it for you.
3. **Shortcuts, one tap** — The chips ask the common questions for you — allowance, earnings, menus, print.
4. **Your flying calendar** — Every flight lands on the calendar, with your records and stats behind it.
5. **Day or night** — Tap any time to switch between light and dark.
6. **Everything lives here** — Your profile, your data, and the deeper feature tours — all in Settings.
7. **Clean slate** — Two taps clear the conversation — your saved data is never touched.

### Roster import (5)
1. **Start with the PDF** — The paperclip takes your Crew Roster Report exactly as the crew portal prints it.
2. **I read every line** — Flights, dates, sectors and report times — nothing typed by hand.
3. **The app fills itself** — The calendar, the trip bar, and the calculator all light up.
4. **Once a month** — Re-attach each new roster drop and the newest flights take over.
5. **Honest when unsure** — If a page doesn’t look like a roster, I say so — never a guess.

### Manual flight cards (6)
1. **No roster? No problem** — Add a card by hand when the trip isn’t on a PDF.
2. **Fill the flight** — Route, date and times — the card matches the roster’s own fields.
3. **One tap, priced** — Calculate works the card out against your rank and rate.
4. **The whole batch** — Calculate-all totals everything together, grouped by month.
5. **Allowances included** — IFA and LMA price out beside the sectors in the trip bar.
6. **Save it or undo** — Confirm files the trip into your earnings — undo takes it right back out.

### Menus & search (6)
1. **Just ask** — Type a flight and a date — sq802 menu 17 oct — and I fetch the menus.
2. **The viewer** — Courses in service order, exactly as the galley works them.
3. **Pick your cabin** — The switcher jumps between the cabins on your flight.
4. **Print-ready** — Full sheet or compact — both lay out for the galley printer.
5. **Saved on your phone** — Menus you’ve opened stay readable offline, no signal needed.
6. **Speak naturally** — jcl ycl menu sq802 — name the cabins you want, in your order.

### Earnings (6)
1. **This is your money page** — Every trip you save adds up here, month by month.
2. **One month, one card** — Each card is a month’s earnings — tap it to open the trips.
3. **Two ways to read it** — The lens switches between your salary take-home and your COP sectors.
4. **The honest breakdown** — Gross, CPF, your overseas expenses, and what actually lands.
5. **Find anything** — Search by route, flight or month to surface old trips fast.
6. **Take it with you** — Export the JSON or the CSV — your expenses ride along in both.

### Calendar (6)
1. **Here’s your roster** — Every imported flight paints onto its day — duties, standby and all.
2. **The tag button** — Tap it and every flight day shows its station and arrival time.
3. **The camera comes out** — With the tags on, the camera appears — it turns the month into a picture, ready to share.
4. **Walk the months** — Swipe or tap the arrows to move between months.
5. **Tap a day** — The day opens its flights — times, sectors, and what it earns.
6. **The records door** — Your passport and all-time stats live behind this gate.

### Flight Stats (5)
1. **Your passport** — The records page tallies everything — flights, hours, stations.
2. **The hero card** — Flight time, layover days, top station — your logbook in five rows.
3. **The stats podium** — Your most-visited stations and longest flights, ranked.
4. **Slice it your way** — The year pills and duty tabs filter the podium to any slice.
5. **Every visit on record** — Tap a station to open its full visit log.

### Backup & restore (5)
1. **Your data, your file** — One backup file carries everything — profile, rates, earnings, history.
2. **Export before you switch** — Data Management → Export backup — the file lands in your downloads.
3. **The new phone** — Install the app, skip onboarding, and Restore backup from the same door.
4. **Expenses ride along** — Overseas expenses are inside every backup — they show on any device.
5. **Keep it private** — The file holds your pay data — keep it somewhere only you control.

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
  copy, counter/Back/Done/Skip/Escape, the skip-a-vanished-step contract,
  every walk's world, the three firing doors, and the old-tour absence pins.
- `tests/smoke/smoke.js` — real Chromium: the eight Settings rows, the full
  main walk with the never-clip geometry pin (every step, 12px margins,
  300px cap), Done/Escape stamping, and the What's-New firing door.
- `tests/dev-ui.test.js` — the Settings rows, the E6 changelog ladder, the
  help-CTA start.
