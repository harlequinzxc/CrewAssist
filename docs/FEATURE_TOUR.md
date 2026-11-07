# Feature Tour — the spotlight contract

The spotlight feature tour is CrewAssist's built-in walkthrough system: eight
short, tappable walks that teach the app's features by lighting one target at
a time with a gold ring and a tooltip card. This document is the contract for
that system — the copy, the targets, the mechanics and the rules. Any change
to a walk (copy, target, step order, step count) goes through this file first,
then `index.html`'s `CA_SPOT_TOURS` registry, then the test suites.

Everything here is present tense and reflects the tour as it ships today.

## How to read the walk tables

Each walk lists its steps in order. For every step:

- **Target** — the element the gold ring lights. Usually a CSS selector; some
  targets are computed (a function returning the element), and a few steps
  light a **union** (several elements wrapped by one ring).
- **Title / Line** — the tooltip's heading and body, verbatim. `**bold**`
  markers render as bold text. A `(new line)` marker in the source renders as
  a real line break.
- **World** — the screen state the step runs in (see *Worlds* below). When a
  step names a different world than the one before it, the engine switches
  there first; otherwise the walk's own world holds.

A step whose target cannot be found (a feature renamed or removed) skips
itself — the walk carries on, and the counter never shows the gap.

## The mechanic

One lit target, one tooltip, one button at a time. A full-screen veil blocks
every tap while a walk runs: targets are shown, never pressed. The tooltip is
the only interactive surface — **Next** advances, **Back** returns, **Skip**
ends without completing. On the last step, Next reads **Done**, and Done is
the only way a walk completes.

- **The ring** glides between steps (a 0.24s ease on its box), even under
  reduced motion — the tour's animations are the one deliberate exception to
  the app's reduced-motion discipline.
- **The tooltip** places instantly (never a smooth glide), flips above or
  below the target as space allows, never clips the viewport (12px margins,
  capped at 300px wide) and never parks on top of the lit target.
- **The lit target fits the viewport**: it is scrolled fully into view and
  never sits behind an edge.
- **The counter** reads "N of M", so a skipped step carries its number
  forward without a visible hole.
- **Escape** ends the walk (a skip). **Tab** is trapped inside the tooltip.

## Worlds

Every step runs inside a *world* — the screen state it needs. Worlds are
idempotent and re-run on every step (and on Back), so the stage is always
right without diffing:

| World | What it ensures |
|---|---|
| `caSpotMainWorld` | The main chat screen (sheets closed). |
| `caSpotSettingsWorld` | The Settings sheet open, the four fold sections
  (Feature tour, Developer Mode, Storage, Data Management) handed back open —
  a fold can never hide a lit target. |
| `caSpotEarningsWorld` | The earnings archive overlay open. |
| `caSpotCalWorld(tags)` | The roster calendar open; the tag chip forced on or off per the step. |
| `caSpotPodWorld` | The Flight Passport sheet open. |
| `caSpotStatWorld` | The passport open, then the All Flight Stats page risen over it (the gate's own door). |
| `caSpotCardWorld` | One real calculator card in the chat (the manual walk's prop). |
| `caSpotFvWorld` | One real Inflight Menu card in the chat, its form pristine (the menus walk's prop). |
| `caSpotFvBtnWorld` | The same card with flight `802` filled and the TODAY pill tapped, waiting for the app's own fetch to bring the cabins and the gold Fetch menu button up. |

Props are built through the app's own real paths — never mocked. A prop that
needs the network waits for it honestly; if it never lands, the step skips.

## The invitation

The auto-fired main walk is preceded by an invitation card: a compass icon,
"Let's take a quick tour", "Eight quick steps in under a minute", a full-width
gold **Next** and a plain-text **Skip**.

- It renders for every crew who has not completed (or declined) the main walk
  at its current content — before the What's-New sheet and before the
  greeting, both of which wait behind it.
- **Next** starts the main walk. **Skip** declines the invitation permanently
  (`crewAssist.spotMainDeclined`); the walk itself stays one tap away in
  Settings. Escape is Skip; Tab is trapped between the two buttons.
- The card fades and springs in on an overshoot curve — exempt from reduced
  motion, like every tour animation.

## Firing

- **Every crew, once per content version:** the invitation fires at the chat
  screen on app open (and right after onboarding completes) unless the main
  walk reads done at its current content or the invitation was declined.
- **Done-only completion:** only carrying a walk to its Done stamps it. Skip
  and Escape end it unstamped, so the auto-fired main walk returns next open.
- **Settings replays forever:** the eight rows under Settings → Feature tour
  start their walks any number of times.

## Per-walk completion

Each walk carries a **content version** (`cv`). A walk carried to Done stamps
`crewAssist.spotDone = { <id>: <cv> }`. A Settings row reads done when its
stored cv **matches** the walk's current cv — so changing a walk's content
(bumping its cv) retires the check honestly, and for the main walk,
re-invites everyone who finished the old content.

- The rows wear a gold circle-check when done at the current cv, a quiet
  hollow circle when not. The icons sync at boot and at every walk's end.
- The legacy `crewAssist.spotMainDone` flag (main-only) reads as done at
  main's current cv and materializes into the store on first read; the
  welcome-restore door stamps both.

## The stage revert

Every walk ends with the app reading exactly as it did before it began — on
Done, Skip, Escape and supersede alike:

- **The chat** reverts: children the walk added (the calculator card, the
  Inflight Menu card) leave with the veil, and the thread scrolls back to
  where it stood. No tutorial cards are ever left behind.
- **Sheets** revert: any sheet the walk opened closes; the passport's records
  page closes with its passport; Settings — the one sheet that can be open at
  a walk's start (a row-tap) — hands back open. A row-tapped walk restores the
  **pre-tap** stage, so the sheet the crew tapped inside reopens.
- **Toggles** revert: the calendar's tag chip sits as it sat.
- **Scrolls** revert: the chat's chip rail and the Settings sheet's own
  scroll ride home — a walk never leaves either scrolled away.
- **Folds** revert (v1.53.0): the Settings fold sections sit as the crew
  left them — a walk that opens a fold to light it re-folds it at its end,
  and an untouched section never moves.
- **Storage** reverts: a prop's fetch writes what a real search writes (the
  recent-flights list, the cabin and menu caches) — the stage carries those
  keys and puts them back. A tour saves nothing.

## The eight walks (Settings order; 41 steps)

| Walk | Id | Steps |
|---|---|---|
| Main screen | `main` | 8 |
| Roster import | `roster` | 6 |
| Manual flight cards | `manual` | 4 |
| Menus & search | `menus` | 4 |
| Earnings | `earnings` | 5 |
| Calendar | `calendar` | 6 |
| Flight Stats | `stats` | 4 |
| Backup & restore | `backup` | 4 |

### Main screen (`main`, 8 steps)

Runs on the main chat screen; step 8 opens Settings and lights the Feature tour
section itself.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | `#chat-input` | **At Your Service** | Ask about your flight or type "help" / "?" for quick commands. |
| 2 | `#btn-roster` | **Activate Your Dashboard** | Attach your roster report to unlock your flight calendar, calculated allowances, and flight insights. |
| 3 | `#action-chips` | **Quick-Access Commands** | Instant answers for allowances, earnings, inflight menus, and menu prints. |
| 4 | `#btn-roster-cal` | **Track Your Flights** | Access your full schedule, flight records, and personal crew stats in one place. |
| 5 | `#btn-theme` | **Theme Toggle** | Tap anytime to switch seamlessly between light and dark theme. |
| 6 | `#btn-settings` | **Account & Preferences** | Update your profile details, manage your saved data, or replay feature tours whenever you need. |
| 7 | `#btn-reset` | **Clear Screen** | Double-tap to clear your screen. Your saved data remains untouched. |
| 8 | `#ca-ft-section` | **You’re All Set** | Feel free to replay this guide anytime right here in Settings, or jump into walkthroughs for other in-app features. |

Step 8 rides the Settings world — its target is the Feature tour section
(the tours’ own front door, sitting directly below Motion since the Settings
reorder), and the world unfolds it first. The section holds ONLY the eight
tour rows: the changelog panel lives in Support & Updates (above, with the
Telegram row), so the closer’s ring points at the tours alone. The four
quiet sections (Feature tour, Developer Mode, Storage, Data Management) sit
FOLDED until their header is tapped — one tap opens, and the fold state
lives in memory only: a reload folds them again, and nothing is ever saved.
A fold can never hide a lit target: every walk that lights inside Settings
opens the folds it needs and hands the crew’s own fold state back at its
end.

### Roster import (`roster`, 6 steps)

Runs on the main chat screen.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | `#btn-roster` | **First, your Roster Report** | Upload your Roster Report PDF directly from CrewApp using the paperclip icon. |
| 2 | `#btn-roster` | **Hands-Free Import** | Every line is analyzed automatically. All flights, dates, sectors, and reporting times are extracted instantly without you typing a thing. |
| 3 | `#btn-roster-cal` | **Seamless Integration** | Your calendar fills up instantly with your imported data. |
| 4 | `#action-chips .action-chip[data-intent="earn"]` | **Seamless Integration** | As well as the allowances from your flights. |
| 5 | `#btn-roster` | **Stay updated** | Re-upload your pdf whenever you get a new monthly roster or schedule changes. Your calendar and allowances update seamlessly. |
| 6 | `#btn-roster` | **No Guesswork** | If your uploaded file isn't recognized as a valid roster, I will let you know immediately rather than guessing your data. |

### Manual flight cards (`manual`, 4 steps)

Teaches the three doors to a hand-built flight card — the chat command, the
chip, the Settings interface — then the card's own Calculate button. Steps 1,
2 and 4 run on the main screen; step 3 opens Settings; step 4 leaves one real
calculator card in the thread as the walk's prop.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | `#chat-input` | **Just Ask** | Type your flights and dates like "cop sq802 17 oct sq807 18 oct" to calculate your allowance instantly. |
| 2 | `#action-chips .action-chip[data-intent="total"]` | **Manual Flight Entry** | Add a flight by hand if it is missing from your PDF or if you just need to calculate its allowance. |
| 3 | The Allowance calculator interface section (in Settings) | **Smart vs Manual Search** | **Default**: Enter the flight number and date to populate the details automatically.(new line)**Manual**: Key in every detail by hand for full control with zero automation. |
| 4 | The calculator card's Calculate button | **One-Tap Calculation** | "Calculate" checks your flight details directly against your rank and rate. |

### Menus & search (`menus`, 4 steps)

Teaches the chat command, the chip, then the Inflight Menu card itself — its
empty form, then the filled card whose app-own fetch brings the gold Fetch
menu button up. The card is the walk's prop (built by the app's own card
engine) and leaves with the veil.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | `#chat-input` | **Just Ask** | Type a flight and date like "sq802 menu 17 oct" to fetch your menus instantly. |
| 2 | `#action-chips .action-chip[data-intent="menu"]` | **Manual Flight Entry** | Or add a flight by hand to view its menu. |
| 3 | The Inflight Menu card's form (flight number, departure date, cabin class) | **Manual Flight Entry** | Enter your flight number and select your departure date and cabin class. |
| 4 | The card's gold Fetch menu button | **Manual Flight Entry** | Tap "Fetch Menu" to bring up the inflight menu. |

Step 4's world fills the card the way the crew would: `802` in the flight
field, the TODAY pill tapped. The fetch is real and async — the world waits
for the button (up to eight seconds); if it never lands (no connection, menus
not published for that flight or date), the step skips itself. Going Back to
step 3 hands the card back its pristine empty form.

### Earnings (`earnings`, 5 steps)

Runs in the earnings archive overlay.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | The archive sheet's heading | **Track Your Earnings** | This dashboard displays your total earnings from every flight month by month. |
| 2 | A month group header | **Monthly View** | Each card summarizes your earnings for a single month. Tap it to expand and view the full flight list. |
| 3 | The summary's pill track | **Allowance vs Salary** | Switch between the two pills to alternate between your COP allowance and your calculated take-home salary. |
| 4 | `#ca-arch-summary` | **Earnings Breakdown** | Track every dollar from your gross pay and CPF down to your overseas expenses (if any) and final net earnings. |
| 5 | `#ca-arch-search` | **Search History** | Easily look up your past trips by filtering for specific routes or flight numbers. |

### Calendar (`calendar`, 6 steps)

Runs in the roster calendar. Step 1 lights the month header and the calendar
grid together as one union target; step 3 turns the destination tags on to
reveal the camera.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | The month header and the calendar grid (union) | **Roster Visualization** | Your imported flights automatically transforms into an interactive calendar. |
| 2 | `#ca-rc-tag` | **Calendar Flight Details** | Tap the "Tag" button to display station codes and arrival times on the calendar. |
| 3 | `#ca-rc-shot` | **Share Your Roster** | Turn the tags on to reveal the camera icon and instantly convert this month's roster into a shareable image. |
| 4 | `#ca-rc-prev` | **Month Selection** | Swipe the calendar or tap the arrow buttons to transition between different months. |
| 5 | A day with flights (today by preference) | **Instant Earnings Breakdown** | Tap any day with flights to check your calculated earnings. |
| 6 | `#ca-rc-pod` | **Personal Records** | This section stores your all-time flight history metrics. |

### Flight Stats (`stats`, 4 steps)

Runs in the Flight Passport sheet; step 4 rides the My Flight Stats gate into
the All Flight Stats page over it.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | The passport sheet's heading | **Flight Passport** | View a complete tally of your lifetime flights, total hours, and unique stations. |
| 2 | `#ca-rc-pod-herowrap` | **Highlights** | This section displays your total flight time, layover days, and top visited station across five organized rows. |
| 3 | `#ca-rc-pod-gate` | **Station Leaderboard** | View your most frequent layover and turnaround stations ranked by frequency. |
| 4 | The records list's year pills (`#ca-rc-pod-listyears`) | **Filter Your Rankings** | Tap the year pills to filter your top layovers and turnarounds by specific years or view your all-time stats. |

### Backup & restore (`backup`, 4 steps)

Runs in Settings (the Data Management section), which stays open throughout —
the crew tapped inside it. The section folds like its neighbours; the walk's
world opens it first.

| # | Target | Title | Line |
|---|---|---|---|
| 1 | The whole Data Management section (label and box) | **Your Data, Your File** | Securely manage your profile, rates, earnings, expenses, and flight history in one place with quick options to export a backup, restore, or clear all data. |
| 2 | `#btn-backup-export` | **Secure Your Data** | Your profile, rates, earnings, expenses, and flight history will be saved straight to your downloads folder as a .json file. |
| 3 | `#btn-backup-restore` | **Restore Your Data** | Select your saved backup .json file to instantly load your profile, rates, earnings, expenses, and flight history back into the app. |
| 4 | `#btn-clear-data` | **Reset Your Data** | Permanently wipes all data from this device. |

## Tests

- `tests/tour.test.js` — the tour's own suite: the registry as data, the copy
  verbatim, the invitation, firing, per-walk completion, the stage revert,
  the props, and the engine's src-level contract. It walks every tour
  end-to-end in jsdom (offline, which is exactly what the menus walk's saved
  schedule fallback is built for).
- `tests/smoke/smoke.js` — the real-browser rig: every step of every walk in
  Chromium, with the ring-in-view, tooltip-covers-nothing and union-target
  geometry pins, the prompt-first firing doors, and the stage-revert
  (sheets, scrolls and storage) after each walk.
- `tests/dev-ui.test.js` — the E6 changelog ladder that carries each round's
  What's-New pointers, plus the Settings fold anatomy (the four sections, the
  reorder, the grid-rows body).
