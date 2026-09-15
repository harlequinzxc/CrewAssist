# AI Agent Handoff File (CrewAssist)

**Read this file first.** Then `LOGIC.md` (formulas), `API_REFERENCE.md` (SQ menu API), `README.md` (human overview). The product is a single-page PWA; almost all behaviour is in `index.html`.

Latest app cache: `crewassist-v75` (`sw.js`). App SemVer: **1.7.0** (`APP_VERSION` in `index.html`, shown on onboarding as `#app-semver`). `APP_WHAT_NEW` is the bullet list for the What’s new **overlay**. Working branch: **this session's** `arena/<session-id>-crewassist` — resolve it, do not copy it (see **How to work in this repo → Branch**). Repo `harlequinzxc/CrewAssist`.

**Product status (owner, 2026-09-15):** v1.5.9 is **signed off** — its issues are fixed (LMA out-date = typed sector date; calendar weekday/Today/fixed height). **In for review: v1.5.10** (calendar hairline), **v1.6.0** (Settings → Allowance calculator interface) and **v1.7.0** (the three modes now hide calculator elements; mode icons, titles and the ★ Recommended badge). **Next (do not start until signed off):** archive, month total. Offline last menu is **on hold**. Do not hardcode SQ478/479 (or any flight) for shuttle; Fetch may *pre-tick* shuttle when ground time is same calendar day or under 6 hours (SQ11/12 NRT–LAX is a long ground, not a shuttle).

---

## How to work in this repo

- **Branch:** every Arena chat session gets its **own** branch, `arena/<session-id>-crewassist` (ids look like `01a0a47b-…`). It is **different for every chat** and changes when the owner jumps between chats, so a branch name you read in this file, in an old commit message, or from a previous session is **already stale**. First action in any session: `BR=$(git branch --show-current)`, and use `$BR` everywhere below. Push only that branch. Merging `arena` → `main` in **GitHub Desktop** is the correct publish path. Do not rebase `arena` onto a stale `main`.
- **Sandbox drift:** this environment can silently **re-clone the repo onto an outdated/stale commit** — your commits vanish from local history while your file edits survive as uncommitted changes, and `/tmp` plus any background process are wiped. `git reflog` shows the signature: a fresh `clone: from …` followed by `checkout: moving from main to arena/…`. The remote is **not** damaged. Recover with (`$BR` = this session's branch):
  ```
  BR=$(git branch --show-current)
  git fetch origin "refs/heads/$BR:refs/remotes/origin/$BR"   # a plain `git fetch origin` does NOT restore the ref
  git reset --hard "origin/$BR"
  ```
  Then re-apply the change you were making and commit it again. Confirm with `git ls-remote origin "refs/heads/$BR"` that local HEAD equals the remote SHA.
  **A rejected non-fast-forward push is this drift, not a sync problem** — it means the remote is *ahead* and your local branch was reset to a stale base. **Never `git push --force`;** that erases the good upstream commits. Seen first-hand 2026-09-15: three already-pushed commits disappeared locally, the remote was untouched, and the rejected push was the only warning.
- **Patching `index.html`:** it is ~423 kB / 413 KiB (7.7k lines) with three inline scripts. Prefer **Python unique-string replace** (`count == 1`) over editor search/replace. Never `innerHTML +=` on complex trees. After a write, assert `function openMenuPrinter` and size. Syntax-check inline scripts with `node --check` using **real newlines** between script bodies (`'\n;\n'.join` — a checker `\\n;\\n` string is a SyntaxError).
- **Do not edit `HANDOVER.md` in parallel.** Two concurrent search/replaces race; the later write wins and drops the other. README then HANDOVER, **one file at a time**, after every commit.
- **SemVer + cache on every app change:** bump `APP_VERSION` in `index.html` (patch x.y.Z for polish, minor x.Y.0 for features) **and** `CACHE_NAME` in `sw.js` (`crewassist-vN`). The onboarding stamp is how the owner confirms the phone has the build. Docs-only README/HANDOVER tweaks have sometimes shipped without a bump; app/JS/CSS changes must bump both.
- **Ask for review** before starting the next slice.
- **No secrets.** No GitHub tokens, no API keys in the tree or the PWA. SQ menu JSON is unauthenticated; images are public CDN.
- **Do not call SQ / cifp from the browser.** JSON goes through `POST /api/sq` only.

---

## Current State (Completed & Working)

- **Step 1:** PWA scaffold, animated starry sky canvas, theme toggles, gold paper-plane (origami dart) logo.
- **Step 2:** Onboarding UI, settings bottom sheet, developer mode. Subtle SemVer `v1.6.0` at the bottom of onboarding (`#app-semver`). Under the CrewAssist title: a hairline **the width of `CrewAssist™`**, then `AN UNOFFICIAL CREW TOOL` on **one row** (`whitespace-nowrap`), SemVer colour. **10 taps** on `#header-brand` (400ms) toggles developer mode. Settings reopen: scroll top, collapse rate accordions. Settings sections in order: Profile, Feedback and Support, **Allowance calculator interface**, Developer Mode (hidden unless dev), Data Management. What’s new is a **glass overlay** (`#whatsnew-backdrop`) after `showMain` (after onboarding for new crew; on the chat page for returning crew). X closes. “Do not show again” sits **outside** the glass card, **bottom-left** of the window (`pl-5` just before the card’s corner arc), checkbox + label on one row. Checking it then closing writes `crewAssist.hideWhatsNew = APP_VERSION`; without the check it returns on every launch. A new stamp shows again even if they hid the previous one. `APP_WHAT_NEW` is an array of short bullets. There is **no** chat What’s new bubble.
- **Step 3:** Chatbot, greeting, quick-action chips, regex intent parser (`menu`, `print`, `IFA`, `LMA`, `COP` / `total`).
- **Step 4:** COP / IFA / LMA calculators with nested sectors, cascading dates, glassmorphic summary overlay. Coefficients live in `rates.json` (network-first fetch, last-good `localStorage`, `DEFAULT_RATES` fallback baked from `IFA_CONFIG` / `REGION_RATES`). Device overrides in `crewAssist.rates`. Developer editor (animated `.dev-rate-fold` accordions, collapsed by default):
  - **Base hourly IFA rate ($/h)** — paired ranks share one field: Jr. FS / Jr. FSS, FS / FSS, LS / LSS, CS / CSS, IFM. Save writes both keys.
  - **SDP buffers (hours)** — Out of Singapore (`sgBuffer`), Out of Station (`stationBuffer`).
  - **Overrides & bonus** — Paxing Multiplier, Direct US Multiplier, Turnaround Bonus.
  - **Layover modifiers** — bands `SDP ≤ t0 → m0`, `SDP > t0 AND ≤ t1 → m1`, `SDP > t1 → m2`. Editing `t0` live-echoes into the next row’s “> …”. Stored as `ifa.layoverBrackets` (`maxHours` + `multiplier`; last row `maxHours: null`).
  - **Turnaround modifiers** — same pattern with **TSDP** and four bands (12 / 14 / 18 / rest).
  - **LMA meal windows** — B/L/D start–end (`lma.windows` in `rates.json`; `LMA_WINDOWS` in JS). Defaults 07:30–08:30 / 12:30–13:30 / 19:30–20:30.
  - **LMA region rates** — B / L / D per region.
  - **Save** = this device. **Reset** = shipped `rates.json`. **Export / Import** JSON. **Do not write to GitHub from the app.** Publish to everyone = GitHub Desktop replace `rates.json`.
  - **Turnaround dates:** 2-sector = date above sector 1 and 2; 4-sector = date above sector 1 only. Layover still uses LMA dates. Defaults/cascade use `todayLocalYMD` / `addLocalDays`.
  - **COP scroll:** opening COP (`mode === 'both'`) calls `scrollChatToEl` on the calculator card so the **top** of the form is in view. Do not `scrollToBottom` for COP (the card is long). IFA/LMA-only still scroll to bottom. Adding LMA stations on COP / first Fetch must not steal that scroll (`mode !== 'both'` and `__caLmaQuietAdd`).
  - **Calculator interface mode (setting v1.6.0, behaviour v1.7.0):** Settings → *Allowance calculator interface* is one segmented pill (`#calcui-segmented`): **Default** (`sparkles`) / **Manual** (`pen-line`) / **Advanced** (`sliders-horizontal`), gold fill on the selected pill. Under it a header row — `#calcui-desc-icon` + `#calcui-desc-title` + `#calcui-desc-badge` — then `#calcui-desc`, then fixed helper text (`#calcui-helper`) “For the best experience, leave it in default”. All copy lives in `CALC_UI_META` (`icon` / `title` / `badge` / `desc`): Default = “Smart automation” + gold-outline badge **★ Recommended**; Manual = “Full manual control”, no badge; Advanced = “Advanced breakdowns”, no badge. **Advanced exists only in developer mode** — hidden pill, `setCalcUiMode` clamps a stray `advanced` back to `default`, and turning developer mode **off** while on Advanced drops to Default and rewrites storage (`syncCalcUiDevMode`). State is `calcUiMode` (`'default'` | `'manual'` | `'advanced'`), persisted as `crewAssist.calcUi`, loaded by `loadCalcUiMode` (unknown value → `default`), painted by `syncCalcUiPills` from `initUI`.
    **What each mode shows** — `syncCalcUiCard` / `syncCalcUiAll`, applied to every `[data-calc-card]`, re-run after each sector re-render, each added LMA station, and on every mode change (so cards already in the thread repaint live): **advanced** = everything, unchanged. **default** = hide `.ifa-time-input` and `.ifa-us-field` (Direct US only — Paxing stays), and hide the LMA `.calc-lma-section`, but **only on cards that also carry `[data-calc-ifa-sectors]`**, so the LMA-only calculator keeps its section (it would otherwise be an empty card); Turnaround keeps hiding LMA independently. **manual** = hide every `.ifa-fetch-btn` / `.lma-fetch-btn`; flight and date are both `flex-1 min-w-0`, so they share the freed width evenly with no extra CSS. Hide with the **`hidden` class, never raw `display:none`** — `validateInputs` skips inputs inside a `.hidden` ancestor, and that is what stops hidden fields from holding Calculate hostage.
  - **CrewAssist calendar:** `#cadate-panel` is **opaque** cream `#F6F1E8` / navy `#0B1A3A`. Days outside **today−2 … today+42** get `.is-out` strikethrough (number still visible). COP/IFA/LMA can still select them; Fetch then `appAlert`s past vs too-far-future and does not call `/api/sq`. Inflight menu Pick Date opens the same picker with `caDateStrict` — crossed days are not tappable. Do not restore `input type=date` on COP/IFA/LMA. `showDatePickerUI` must not call `showPicker()`. Header is `Sat, 26 Sept 2026` plus gold hairline. Fixed 6-row grid (`#cadate-grid-wrap` 13.5rem). `#cadate-today` jumps to today. Month slide ±18%. Cancel muted gray; OK gold. Legend: Today ring / Selected fill. **Two** gold hairlines (1px `rgba(201,162,39,0.35)`, full width): `#cadate-hairline` under the header date, `#cadate-hairline-foot` between the legend and the Today / Cancel / OK row (0.75rem both sides of the foot line; the action row is `mt-3`).
  - **LMA out date:** next sector’s **typed** `#ifa-d` (not `data-arr-ymd` / destination arrival). Overnight NRT→SIN must not +1 the layover out date. In-date stays previous sector arrival local.
  - **Fetch date:** do **not** write `leg.depLocal` back onto the sector date field (that +1’d last-sector SQ11). Keep the typed date. Button faces: Fetch → spinner → tick → Fetch (`setFetchFace` / `finishFetchBtn`). Spinner rotation is on `.fetch-spin-ring` **inside** `.fetch-face` — do not animate `transform` on the face (that made the ring walk diagonally).
  - **LMA dates:** `parseSqLocal` (wall time) vs `parseSqUtc`. Do not `new Date('YYYY-MM-DD HH:MM')` for local fields — Chrome treats that as UTC and LMA +1s in Singapore.
  - **Inflight Pick Date:** after OK, the Pick Date pill shows `DD/MM/YYYY` and stays selected until Today or Tomorrow.
  - **Flight/date row:** both `flex-1 min-w-0`. Labels and SQ prefix `text-[10px]`; values `text-sm`.
  - **Summary:** `showResultsOverlay` sets `#results-content.scrollTop = 0`.
  - **Fetch (optional):** each IFA sector **always** has flight + date on **one row** (flight and date equal `flex-1`, calculator card `w-[85%]` like inflight menu) + Fetch. Fetch button is fixed width (`w-[3.15rem]`); busy state is a CSS spinner (`.fetch-btn-spin`), never `"…"`, never `textContent` swap. Writes the same hours / LMA IATA / in-out fields the crew can type. Uses `/api/getcabin` then `/api/menu` (first published cabin, JCL preferred). Block time = UTC arr − dep. Multi-leg menus pick the **unused** dep→arr pair (`pickScheduleLeg` + usedPairs), preferring previous sector arr as this dep; last layover sector prefers SIN. LMA dep only if next sector dep airport matches the station. Unpublished (101) may retry a sibling sector’s date. Cabin class is not required. Empty flight number does **not** disable Calculate (`ifa-fn-input` / `lma-fn-input` skipped in `validateInputs`). Do not auto-Calculate. A failed fetch must not wipe typed 101/net hours.
  - **Direct US auto:** on 2-sector layover Fetch, tick Direct US if **either** airport is US (`isUsAirport`). Crew can untick. Direct US UI is still layover + 2-sector only.
  - **LMA Fetch:** on the LMA calculator **and** COP, inbound and outbound each have flight + date + Fetch; times/IATA stay editable. COP also still fills LMA from IFA Fetch.
  - **Shuttle:** per-LMA-station checkbox, default off, hidden with the LMA wrap on Turnaround. On → that station’s LMA is **$0** (no B/L/D); IFA unchanged. Not IFA flight type Turnaround. Fetch may pre-tick when same local YMD or ground &lt; 6h; crew can untick. Shuttle stations are skipped in Calculate validation. Do **not** hardcode flight numbers.
  - IFA/COP flight-type and sector-count dropdowns use the same glass overlay as the menu sheet.
  - Summary overlay: `formatMoney` (`$1,457.38`). IFA sectors First/Second/Third/Fourth Sector, with ` (Paxing)` when that sector is paxing. LMA day rows: `formatLmaDay` (`DD MMM YY`), three fixed-width B/L/D badges (`✕` when missing), `$` per day, **no station total**; then Breakfast/Lunch/Dinner totals with counts (`BREAKFAST (3x)`).
  - IFA hours display is `XH YM`, never a decimal like `10.17`.
- **Step 5:** Inflight menu viewer. Chat flight verification → `api/sq.js` → overlay.
  - Dropdowns: one row; menus overlay content (do **not** restore `overflow-x: auto` on `#menu-dropdown-row` — it clips overlay dropdowns).
  - Category control: single segmented bar (Meals / Drinks / Snacks / Amenities), no wrapping pills.
  - `menuViewState` remembers category and meal tab across cabin / sector / cuisine changes; those changes and meal-service tabs scroll the overlay to top.
  - Centered meal-service title under the route hero. Meal-service tabs centered.
  - Meal photos: `imagePathIfeHigh` if SQ linked it, else construct IFE URLs from dish `id` (and from a same-name dish’s id if this row has none). Linked/working URLs and ids merge into session `imageByName` / `imageIdByName` across legs, cabins, and later fetches — **not** reset per payload. Name keys also match singular/plural and `and`-splits (**no dish-name hardcoding**). Missing CDN = HTTP 200 HTML → `onerror` then **gold bullet**. No placeholders, no `/assets` prefix, no iOS `data-src` / `revealMenuImages`. Light Bites under Delectables **keep photos**. Other snacks / snack drinks stay bullets. Amenities bullets (never photos).
  - Each course is its own card. Course labels between thin gold hairlines; 2+ dishes → italic `Choose one of N` (never `(CHOOSE N)`).
  - Tap a thumbnail for `#menu-lightbox`. More/Less if copy > 2 lines (animate); imaged items stay horizontal.
- **Chat jump-to-latest:** `#btn-scroll-bottom`, same size as send, just above chips; only when not at bottom. **Hide while typing.** Do not use `opacity: 1 !important` under `html.chat-busy` (it fights the hide).
- **Flight lookup:** Card title Inflight Menu (plane icon). Last 5 successful fetches as chips under the flight field (`crewAssist.recentFlights`; horizontal scroll + `.mask-edge` like chat chips). Overlay `currentMenuSearch.selectedSector` is kept when switching cabin (`renderMenu` re-picks that leg). Fetch menu CTA: **book-open** for viewer, **printer** for print. After Fetch: typing → “Fetching menu from seat pocket.” → typing → overlay → “Here is the menu.” After a date: sector pills (if multi) + cabin pills; CTA grey until ≥1 sector (if shown) and ≥1 cabin. Date tap fetches immediately (500ms debounce is only for typing the flight number). `executeFetchCabins` shows `#fv-loading` then `Promise.all`s `getcabin` **and** a speculative JCL `menu` before painting pills. FCL label is Suites vs First from aircraft type (`380`/`388`).
- **Chat motion:** `.chat-anim-in` (320ms) / `animateChatRemove`. After a bubble finishes, wait **500ms** (`CHAT_GAP_MS`) before the next bubble or typing (`noteBubbleShown` + `enqueueBot` waits on `lastBubbleReady`). Typing before every bot line, calculator, and lookup. Welcome is two bubbles (`{greeting}, {rank} {name}!` then `How can I help you today?`). Send, chips, and in-chat buttons locked (`html.chat-busy`) until the current bubble + gap finish.
- **Onboarding gender:** Fixed. `#toggle-autoscroll` was removed; do not re-read it in `initUI()`.
- **CTAs:** Gold-bordered pills. Calculate stays disabled until required fields are filled. Native `appAlert` / `appConfirm` — **never** `alert()` / `confirm()`. Send icon centered.
- **Step 6 inflight menu printer:** Same glass overlay. View ↔ print (`#btn-menu-to-print` / `#print-btn-view`) reuses `currentMenuSearch`; close the other overlay with `immediate === true`. Overlay print control must have a **visible circle** like `#print-btn-view`. Printer loading: “Preparing the menu” (menu/chat still “seat pocket”).
  - Sector tabs: circled number + `LAX → NRT`; selected = gold **outline**.
  - Overlay `overflow-hidden`; scroll `#print-paper-scroll`. Sheet + Edit scroll independently; both replay `.menu-anim-in`. Changing sector / layout / paper jumps preview to top.
  - Preview = real A4/A6 **mm** page scaled to overlay width, centered. **No A3** unless explicitly asked. A−/A+ change `--print-type` only (not the page box); **disable** at 70% and 140%.
  - Elegant auto-selects A4, Compact auto-selects A6; size chips stay toggleable. Zoom and hide flags are **independent per layout** (`hiddenElegant` / `hiddenCompact`).
  - Elegant pills, left to right: **Bounds**, **Descriptions** (on by default), **Greyscale** rightmost. Compact **hides** Greyscale + Descriptions. Bounds = live A4/A6 page-height guide; **never** in PNG/JPEG/Word even if selected.
  - Hidden-by-default: snacks except Light Bites under Delectables; drinks except Champagne / red / white — **not fortified**. Compact also hides From The Bakery and Hot Beverage. Compact SCL hides Chocolate and Cheese and Crackers; compact YCL hides Cheese and Crackers. Still available in Edit → Show. Hidden rows grey; the Show control stays fully usable. Edit: cabin classes are **accordions, collapsed by default, animated** (`.print-edit-fold`).
  - Compact sheet: per-cabin/service header same size as body, all type black: `SQ478 (→JNB) JCL (SUPPER) 160926` — date **after** the service. **No line under the header. No rule above the first meal.** Full-width `.pc-svc-rule` **after each service including the last**. Gap from last text row to that rule = gap between text rows. 100% type = former 80% (A4 `6.8px`, A6 `6px`). First item after `APP:` colon, later items hang under that circled number; Light Bites comma-separated run-on wrap; wine groups not all labelled CHAMPAGNE; meat/seafood proteins black fill + white text on the **same baseline** as the row; invert box must **not overrun below** the letters.
  - Compact PNG/JPEG: **custom 300 dpi canvas** (`exportCompactImage`). Do **not** send compact through html2canvas (failed through 1.4.19–1.4.21: grid circles, `text-transform`, inline `.pc-hl`, nested invert, sibling header rules, baked `<img>`s). Elegant html2canvas scale 3 / JPEG 0.95 is OK.
  - Print footer: `Menu content © Singapore Airlines · Compiled with CrewAssist — an unofficial crew tool`. Caps only: masthead, cabin band, route block, beverage group heads. Elegant type = weight / italic / navy — not extra sheet typefaces. No photos/icons/veg leaf/timeline through rings.

---

## In-Progress / Known Gaps

Owner considers the app **essentially complete**. Do not start a new slice without a request.

Honest leftovers (do not “fix” unless asked):

- **Allowances Archive** is specified in `LOGIC.md` §§4.9–4.12 and 5.4 / 6.8. **It is not implemented** in `index.html`. Turnaround date fields (`#…-ifa-d1` / `d2`) and layover LMA dates are ready for it. Fetch writes into those same fields.
- **Month total** is not implemented.
- **Default mode lets Calculate run on an empty card** (v1.7.0): with the IFA flight-time and LMA fields hidden, `validateInputs` has no visible required field left, so Calculate enables immediately and the summary reads `$0.00` (“Missing or incomplete fields for station 1. Skipping.”). Awaiting the owner's call — most likely fix is to require the flight number when `calcUiMode === 'default'`.
- **`crewAssist.modifiers` / `appModifiers`** were removed in 1.5.1.
- **Publish rates to all installs** is still: export or edit `rates.json`, commit, merge via GitHub Desktop. No one-tap GitHub write from the PWA (rejected).
- **Airplane-mode CSS:** Tailwind/Lucide are CDNs and are **not** in `sw.js`. The PWA shell caches, but the UI looks unstyled offline. Offline last menu is on hold partly for this.
- Printer / viewer / summary overlay signed off (v1.4.24 / 1.4.26). Residual polish only if the owner reports it.

---

## Key Architecture Decisions & Constraints

These have already caused regressions. Treat them as locks.

### Git, patching, docs

- Unique-string Python replace on `index.html`; assert `function openMenuPrinter` and size > ~280k after every write.
- After every commit update `README.md`, `HANDOVER.md`, and **`LOGIC.md` if the change touches formulas or calculator rules**, to match the build. Edit those files **sequentially** (never two HANDOVER writes at once).
- Periodically scan for unused files in the repo and unused variables/functions in `index.html`; remove them when found (`crewAssist.modifiers` / `appModifiers` were removed in 1.5.1).
- Bump `APP_VERSION` + `sw.js` `CACHE_NAME` on every app change.
- Only push the session branch (`$BR`). Recover sandbox drift with explicit fetch + `reset --hard` of that branch — do not rebase onto old `main`.
- No tokens in files. Screenshots in chat are OK.

### DOM / CSS traps

- **Do not** use `container.innerHTML += ...` for complex dynamic trees (menu loops). It re-parses the subtree, drops listeners, and yields `null` on mobile. Use `insertAdjacentHTML('beforeend', ...)` or `document.createElement`. Single `innerHTML = html` assignment for a freshly built string (rates editor) is OK.
- **Do not** restore `#menu-dropdown-row { overflow-x: auto }` — it clips overlay dropdowns.
- **Do not** re-apply global `tabular-nums` on `body` — it fought overlay type. `formatMoney` / compact amounts may use `tabular-nums` locally.
- Accordion clip (rates + print Edit): `grid-template-rows: 0fr` **plus** `overflow: hidden` on the fold **and** padding on a **grandchild**, not on `.dev-rate-fold-inner`. Padding on the `0fr` child leaks table headers on iOS (seen in 1.4.28).
- Chat lock: `html.chat-busy` disables send/chips/lookup until bubbles finish. Do **not** show `#btn-scroll-bottom` while typing. Do **not** add `opacity: 1 !important` under `html.chat-busy`.
- Overlay dropdowns (IFA/COP/menu) must be `position: absolute` glass over content, not a layout push. Date + time same height, no overlap; “Pick Date” one line.

### SQ inflight menu (vital)

- Reverse-engineered map: `https://inflightmenu.singaporeair.com` → unauthenticated `POST https://cifp.auto.prod.c0.singaporeair.com/api/{getcabin|menu}`. No key; `sessionId` is local. CORS: preflight `*`, POST allowlist is the **official origin only**.
- **JSON must stay on `/api/sq`.** Do **not** call cifp from the browser. Direct `cifp…/api/getcabin` from this sandbox: TLS EOF — do not retry expecting JSON. Keep `/api/sq`. `api/getcabin.ts`, `api/menu.ts`, `api/cabins.ts` were removed; do not re-add as a replacement for `/api/sq`. Proxy timeout is **12s**.
- **Images are `<img src>`** to `https://inflightmenu.singaporeair.com/…` (not CORS-gated). Join origin + relative path with `encodeURI` (spaces in amenity paths). **Never** prefix SQ relative images with `/assets/` (404s).
- Dish photos: `imagePathIfeHigh` on ~9% of items (relative `fabs/IFE/INFM/<cabin>/HIGH|LOW/<id>_<cabin>.png`); otherwise construct from item `id` (`DH021259-v3-FCL` → strip `-vN` → `DH021259_FCL.png`; `DH026749-001-SCL` **keeps** `-001`). Missing CDN objects return **HTTP 200 + `index.html`** (~4664 B, `text/html`) — **never trust status**; `onerror` / decode fail is the miss. Then gold bullet. **No placeholder images.** Skip `API_REFERENCE.md` cascade **step 4** (app placeholder). Amenities stay bullets even if `imagePath` exists.
- Session `imageByName` / `imageIdByName` + same-name id reuse across sectors/cabins/fetches. **Do not hardcode dish names.** Do not use iOS `data-src` / `revealMenuImages` / forced delay / parent key-scan for junk `url`/`path`/`src`.
- Light Bites under Delectables **keep images**. Meal **courses** keep photos. Other Delectables muffins/snacks = gold bullets.

### Calculator / rates

- `LOGIC.md` wins on **behaviour**. Live `rates.json` / `crewAssist.rates` wins on **coefficients**. Formulas stay in LOGIC + `executeCalculation`; numbers are not the source of truth in JS once `rates.json` has loaded.
- Critical asymmetry: **layover** multiplier from **per-sector SDP**; **turnaround** multiplier from **summed** SDP, applied to every non-paxing sector. Paxing (0.75×, SDP ignored) beats Direct US (3.5×) if both were true. Direct US UI is layover + 2-sector only. LMA is **hidden / zero** on turnaround. **Shuttle** is a per-station LMA skip ($0 that station only), not Turnaround; do not hardcode flight numbers (`LOGIC.md` §4.3a).
- Rank pairs are the same rate (Jr. FS = Jr. FSS, etc.).
- Bracket editor: one editable cutoff per boundary; the next band’s “> X” is a live echo, not a second field. Last band has no cutoff (`maxHours: null`).
- Save = device only. Reset = shipped file. Export/Import JSON. **No GitHub write from the PWA. No one-tap publish. No non-dev crew editing.**
- Service worker: network-first for app shell **and** `rates.json`. If rates miss and there is no cache, return **503 JSON** (`{}`), **not** `index.html` (that would parse as HTML and poison the engine).
- **Never use `toISOString()` for calendar dates** without compensating timezone (`LOGIC.md` §6.7). Prefer `new Date(y, m-1, d)` + local getters, or `YYYY-MM-DDT00:00:00`.
- Display money with `formatMoney` (thousands separators). Internal math unrounded; round at display only.
- IFA duration display: `XH YM`, never decimal hours.

### Printer (locks through 1.4.24)

- Compact export = `exportCompactImage` 300 dpi canvas. **Never html2canvas for compact** (invert/header failed 1.4.19–1.4.21). Do not restore CSS `text-transform`, inline/table invert backgrounds, sibling header rules, or baked invert `<img>`s for compact export.
- Insert needle for export work was `async function exportPrintImage(type)` — do not miss it.
- Bounds never in export. No A3. Print zoom must not change the A4/A6 page box.
- View↔print: `currentMenuCabins()` / `currentMenuSearch`; `closeMenuPrinter(true)` / `closeMenuViewer(true)`.
- Compact wine hide keys order: fortif / white / red before champagne. SCL compact hide + YCL cheese/crackers: `printHideCompactScl`.

### Design / copy

- Palette: SIA Navy `#0B1A3A`, Charcoal, SIA Gold `#C9A227`. Glass: `glass-bubble`, `glass-sheet`. Mobile-first iOS.
- Logo: transparent gold origami dart; inner fold opaque bronze; navy-key fuzz ≤8–10%. PWA `app-icon-*`: navy `#0B1A3A` + gold rim. Onboarding dart `w-48`, title `-mb-12`; header dart `w-10` `py-1.5`.
- Elegant type: weight / italic / navy — not extra sheet typefaces. No photos/icons/veg leaf/timeline through rings.
- Native dialogs only. Footer as specified. Caps only where listed.

### Chat cadence (project rule)

After every chat bubble (user or bot, including calculator and lookup cards) fully animates in, wait 500ms before showing another bubble or the typing indicator. Do not start typing until that gap has elapsed. Typing may be followed immediately by the next bot bubble once typing hides. Do not let the user send or press chat/chip/lookup buttons until on-screen bubbles have fully displayed.

---

## File map

| Path | Role |
|---|---|
| `index.html` | Entire UI + engine (~423 kB / 413 KiB, 7.7k lines). Three inline `<script>` blocks. |
| `sw.js` | `crewassist-v75`. Precaches shell + `rates.json`. Network-first for navigate/document/`index.html`/`sw.js`/`rates.json`. |
| `rates.json` | Default IFA + LMA numbers (`version`, `ifa.*`, `lma.regions`). |
| `api/sq.js` | Vercel POST proxy; only `getcabin` \| `menu`; 12s abort; Origin/Referer spoof official site. |
| `manifest.json` | PWA; `start_url` `./index.html`; theme `#0B1A3A`. |
| `LOGIC.md` | Formulas/rules. Behaviour wins here; live rates win on numbers. Archive sections are **spec-only**. |
| `API_REFERENCE.md` | SQ API, image fields, CORS. User-uploaded (`81c1e1e`). Do not skip its “missing image = 200 HTML” gotcha. |
| `icons/` | `logo-192/512` in-app dart; `app-icon-180/192/512` PWA; `favicon.png`. |
| `README.md` | Human overview. |
| `HANDOVER.md` | This file. |

There is no bundler, no tests suite, no `package.json` required for the frontend.

---

## localStorage keys

| Key | Purpose |
|---|---|
| `crewAssist.profile` | Onboarding profile (name, rank, gender, …). |
| `crewAssist.theme` | `'light'` or dark. |
| `crewAssist.prefs` | `{ autoScroll }` (autoscroll toggle UI was removed). |
| `crewAssist.devMode` | `'true'` / `'false'`. |
| `crewAssist.rates` | Device override of `rates.json` (including meal windows). Absent → use shipped file. |
| `crewAssist.hideWhatsNew` | `APP_VERSION` if the user ticked “Do not show again” for that stamp. |
| `crewAssist.calcUi` | Calculator interface mode: `default` (absent/unknown) \| `manual` \| `advanced` (developer mode only). |
| `crewAssist.recentFlights` | Last 5 successful menu lookups `{ flight, date }`. |

---

## How to ship a change

Resolve the session branch first and reuse it — never type a branch name from memory:

```
BR=$(git branch --show-current)   # this session's arena/<session-id>-crewassist
```

1. Implement on `$BR`. Do not start a new slice until the owner signs off the last one.
2. Bump **both** stamps together: `APP_VERSION` (`index.html` — patch x.y.Z for polish, minor x.Y.0 for a feature) and `CACHE_NAME` (`sw.js`, `crewassist-vN`). Without the cache bump the owner's phone keeps serving the old build and the change never ships.
3. Verify before committing. This sandbox has **no browser**, so drive the real code:
   - `node --check` the three concatenated inline scripts (join with **real** newlines). Catches a write that broke a script mid-block; it **cannot** see a whole missing block.
   - `node --check sw.js`. `python3 -m json.tool rates.json manifest.json` if either changed — a malformed `rates.json` parses to garbage and silently mis-computes allowances.
   - For DOM / CSS / JS behaviour, load `index.html` in jsdom and call the **shipping** function (`openCaDatePicker`, `maybeWhatsNewOverlay`, `executeCalculation`), then assert DOM order and `getComputedStyle`.
   - If `rates.json` or a formula changed, re-run the `LOGIC.md` §7 test cases through `executeCalculation`.
   - Truncation / drift net: the `function openMenuPrinter` + size assertion (see **How to work in this repo → Patching `index.html`**) is the only check that catches a whole-block loss.
4. Commit, then update docs **one file at a time**: README → HANDOVER → LOGIC (only if formulas or calculator rules changed). Never two HANDOVER writes at once.
5. `git push origin "$BR"`.
6. Ask the owner to review on the **phone** — the onboarding stamp must read the new `APP_VERSION`. A mismatch means cache, not code.
7. Owner merges arena → main in GitHub Desktop when they want production. No agent pushes `main`.

To publish new **rates** to everyone: change `rates.json` (or paste an Export), commit, merge. Devices without a `crewAssist.rates` override pick it up on next network-first fetch. Devices with an override keep the override until Reset.

---

## Recovery / dead ends (do not retry)

- Prefixing SQ relative images with `/assets/` 404ed thumbs.
- Nested parent `url` / `path` / `src` scans assigned junk. `data-src` / `revealMenuImages` left thumbs without `src`.
- Trusting HTTP status for IFE photos fails (200 HTML).
- html2canvas for compact invert/header (1.4.19–1.4.21).
- `innerHTML +=` on menu trees.
- Body-wide `tabular-nums`; `#menu-dropdown-row { overflow-x: auto }`.
- Rebasing `arena` onto a stale `main`.
- Parallel `HANDOVER.md` search/replaces.
- `must(old, new, 2)` treating `2` as a label.
- `node --check` with `'\\n;\\n'.join` (checker SyntaxError).
- Calling cifp from the browser / this sandbox (CORS / TLS EOF).
- Padding on a `0fr` accordion inner (iOS header leak).
