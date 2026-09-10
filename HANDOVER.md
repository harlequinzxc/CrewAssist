# AI Agent Handoff File (CrewAssist)

Latest app cache: `crewassist-v38` (`sw.js`). App SemVer: **1.4.5** (`APP_VERSION` in `index.html`, shown on onboarding). Branch work for this line of UI lives on `arena/01a0819d-crewassist`.

---

## Current State (Completed & Working)

- **Step 1:** PWA scaffold, animated starry sky canvas, theme toggles, gold paper-plane logo.
- **Step 2:** Onboarding UI, settings bottom sheet, developer mode (10 taps on the logo). Subtle SemVer `v1.4.5` at the bottom of onboarding (`#app-semver`).
- **Step 3:** Chatbot, greeting, quick-action chips, regex intent parser.
- **Step 4:** COP / IFA / LMA calculators with nested sectors, cascading dates, glassmorphic summary overlay. IFA/COP flight-type and sector-count dropdowns use the same glass overlay as the menu sheet (absolute over content, not a layout push).
- **Step 5:** Inflight menu viewer. Chat flight verification → `api/sq.js` → overlay.
  - Dropdowns: one row, horizontal scroll if narrow; menus overlay content.
  - Category control: single segmented bar (Meals / Drinks / Snacks / Amenities), no wrapping pills.
  - `menuViewState` remembers category and meal tab across cabin / sector / cuisine changes; those changes and meal-service tabs scroll the overlay to top.
  - Centered meal-service title under the route hero. Meal-service tabs are centered horizontally.
  - Meal photos use the pre-Delectables extractor (`imagePathIfeHigh`… as strings, origin + path) and set `src` on the thumb immediately. No placeholders. No SQ image field → gold bullet; 404 thumb → bullet. Snacks tab and snack drinks stay bullets. Light Bites keep photos.
  - Each course is its own card. Course labels sit between thin gold hairlines; if there are 2+ dishes, italic `Choose one of N` (sentence case, no parentheses, never `CHOOSE`).
  - Items without a photo are gold bullets. Sections with 2+ items get a hairline between rows. Tap a thumbnail for a blurred full-screen lightbox (`#menu-lightbox`).
  - If a dish/bread has no image on this sector, reuse a same-name photo from another sector of the same menu (`imageByName`).
  - Meals: course images inherit from item/course/selection; `footnote` appended to copy; `breadDetails` rendered as Bakery & Warm Breads when present.
  - Snacks category: hairline sections; single-line items as bullets.
  - Amenities: no images; bullet list.
  - Descriptions longer than 2 lines: More/Less with rotating chevron and height animation. Imaged meal items stay horizontal (`items-start`).
  - Category / tab / cuisine / sector changes fade content in.
- **Chat jump-to-latest:** `#btn-scroll-bottom`, same size as send, just above chips; shown only when not at bottom; hide at bottom; both controls animate.
- **Flight lookup:** Chat card title is Inflight Menu (menu and print), both with the plane icon. Fetch menu CTA: book icon for viewer, printer icon for print. After Fetch menu, typing then “Fetching menu from seat pocket.” then typing, overlay, and “Here is the menu.” After a date, sector pills (if multi-sector) and cabin pills show together with Fetch menu (greyed until ≥1 sector when shown and ≥1 cabin). Date tap fetches immediately (the 500ms debounce is only for typing the flight number). `getcabin` and a speculative JCL `menu` run in parallel. If `getcabin` returns `legs`, sectors render from those and menu caches in the background. Otherwise we still wait on menu for sector codes. FCL label is Suites vs First from aircraft type (`380`/`388`).
- **Chat motion:** `.chat-anim-in` (320ms) / `animateChatRemove` on messages, typing, calculator and lookup cards. After a bubble finishes entering, wait **500ms** (`CHAT_GAP_MS`) before the next bubble or typing (`noteBubbleShown` + `enqueueBot` waits on `lastBubbleReady`). Typing still plays before every bot line, calculator, and inflight lookup. Welcome is two bubbles (`{greeting}, {rank} {name}!` then `How can I help you today?`). Fetch menu: “Fetching menu from seat pocket.” then overlay + “Here is the menu.”
- **Onboarding gender:** Fixed. `#toggle-autoscroll` was removed from settings; `initUI()` no longer reads it, so gender buttons work.
- **CTAs:** Gold-bordered pills (navy/gold). Calculate stays disabled until required fields are filled.
- **Repo cleanup:** Scratch `check*` / `temp*` / `fix*` / `test-plane*` files gone; airports inlined; unused `api/cabins.ts`, `api/getcabin.ts`, `api/menu.ts` removed (app never called them). Dead CSS (`.glow-gold`, `--aurora-opacity`, `--text-muted`) and unused DOM ids (`chip-container`, `btn-dev-import`) removed. Dead overlay helpers (`openMenuViewer`, `showMenuError`, `hideMenuError`) already gone.
- **Step 6 inflight menu printer:** Same slide-up glass sheet as the menu viewer (`#print-backdrop` + `#print-overlay` `translate-y-full`). Handle, title, Export, X. Chrome: `SQ n · N sheets`, date/route, numbered sector pills, Elegant/Compact, A4/A6, zoom, Greyscale, Descriptions, Menu sheet / Edit content. Elegant = restaurant-style one page (Cormorant Garamond, no cursive). Compact = tight all-caps APP/MAIN/DESSERT with protein strikethrough + beverages. Export PNG/JPEG (`html2canvas` CDN) and Word (HTML `.doc`). Edit writes back into `printState.model`. Do not call SQ from the browser.

## In-Progress / Known Gaps

- **Printer sheet art:** Overlay chrome matches the crew UI shots. Elegant/compact **menu** typography and packing still first-pass — wait for the dedicated restaurant / compact menu references before locking layout.

## Key Architecture Decisions & Constraints

- **DOM injection:** Do not use `container.innerHTML += ...` for complex dynamic trees (menu loops). It re-parses the subtree, drops listeners, and yields `null` on mobile. Use `insertAdjacentHTML('beforeend', ...)` or `document.createElement`.
- **Unique-string patches:** Prefer Python unique-string replace on `index.html` over brittle search/replace in the 200KB file. Avoid `print(...)` with escaped quotes in those scripts (parse errors abort the whole patch).
- **Vercel proxy:** SQ WAF is aggressive. The live app still `POST`s `/api/sq` (`getcabin` / `menu` only). `api/getcabin.ts`, `api/menu.ts`, and `api/cabins.ts` are extra routes with upstream-then-flagship fallback and document beverage `imagePathIfeHigh`; do not replace `/api/sq` without changing the frontend contract. They use `@vercel/node` (Node), not edge.
- **Design system:** Glass (`glass-bubble`, `glass-sheet`). Palette: SIA Navy `#0B1A3A`, Charcoal, SIA Gold `#C9A227`. Mobile-first iOS styling.
- **Chat cadence (project rule):** After every chat bubble (user or bot, including calculator and lookup cards) fully animates in, wait 500ms before showing another bubble or the typing indicator. Do not start typing until that gap has elapsed. Typing may be followed immediately by the next bot bubble once typing hides.
- **SemVer (project rule):** Keep `APP_VERSION` in `index.html` and paint it on onboarding as `vX.Y.Z` (`#app-semver`, very low contrast). Bump it on **every** change: patch (x.y.Z) for fixes/copy/polish, minor (x.Y.0) for features, major (X.0.0) for breaking product shifts. Current line is 1.x (stable crew app: chat, COP, menu, printer). This stamp is how the user confirms the phone is on the latest build.
- **Cache:** Bump `CACHE_NAME` in `sw.js` when `index.html` (or other cached assets) change.
- **Continuity:** After every commit, update `README.md` and `HANDOVER.md` to match the build. Ask for review before starting the next slice of work.
- **Sandbox drift:** This environment can silently check out old `main` (`a70877c`) with mass deletions. Recover with `git fetch origin arena/01a0819d-crewassist` + `git reset --hard FETCH_HEAD`. Only push to the arena branch. Merging arena → main in GitHub Desktop is correct.
