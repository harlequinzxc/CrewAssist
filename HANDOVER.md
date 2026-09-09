# AI Agent Handoff File (CrewAssist)

Latest app cache: `crewassist-v28` (`sw.js`). Branch work for this line of UI lives on `arena/01a0819d-crewassist`.

---

## Current State (Completed & Working)

- **Step 1:** PWA scaffold, animated starry sky canvas, theme toggles, gold paper-plane logo.
- **Step 2:** Onboarding UI, settings bottom sheet, developer mode (10 taps on the logo).
- **Step 3:** Chatbot, greeting, quick-action chips, regex intent parser.
- **Step 4:** COP / IFA / LMA calculators with nested sectors, cascading dates, glassmorphic summary overlay. IFA/COP flight-type and sector-count dropdowns use the same glass overlay as the menu sheet (absolute over content, not a layout push).
- **Step 5:** Inflight menu viewer. Chat flight verification → `api/sq.js` → overlay.
  - Dropdowns: one row, horizontal scroll if narrow; menus overlay content.
  - Category control: single segmented bar (Meals / Drinks / Snacks / Amenities), no wrapping pills.
  - `menuViewState` remembers category and meal tab across cabin / sector / cuisine changes; those changes and meal-service tabs scroll the overlay to top.
  - Centered meal-service title under the route hero.
  - Each course is its own card. Course labels sit between thin gold hairlines; if there are 2+ dishes, italic `Choose one of N` (sentence case, no parentheses, never `CHOOSE`).
  - Items without a photo are gold bullets. Sections with 2+ items get a hairline between rows. Tap a thumbnail for a blurred full-screen lightbox (`#menu-lightbox`).
  - If a dish/bread has no image on this sector, reuse a same-name photo from another sector of the same menu (`imageByName`).
  - Meals: course images inherit from item/course/selection; `footnote` appended to copy; `breadDetails` rendered as Bakery & Warm Breads when present.
  - Snacks category: hairline sections; single-line items as bullets.
  - Amenities: no images; bullet list.
  - Descriptions longer than 2 lines: More/Less with rotating chevron and height animation. Imaged meal items stay horizontal (`items-start`).
  - Category / tab / cuisine / sector changes fade content in.
- **Chat jump-to-latest:** `#btn-scroll-bottom`, same size as send, just above chips; shown only when not at bottom; hide at bottom; both controls animate.
- **Flight lookup speed:** Date tap fetches immediately (the 500ms debounce is only for typing the flight number). `getcabin` and a speculative JCL `menu` run in parallel. If `getcabin` returns `legs`, sectors render from those and menu caches in the background. Otherwise we still wait on menu for sector codes. FCL label is Suites vs First from aircraft type (`380`/`388`).
- **Onboarding gender:** Fixed. `#toggle-autoscroll` was removed from settings; `initUI()` no longer reads it, so gender buttons work.
- **CTAs:** Gold-bordered pills (navy/gold). Calculate stays disabled until required fields are filled.
- **Repo cleanup:** Scratch `check*` / `temp*` / `fix*` / `test-plane*` files gone; airports inlined; unused `api/cabins.ts`, `api/getcabin.ts`, `api/menu.ts` removed (app never called them). Dead CSS (`.glow-gold`, `--aurora-opacity`, `--text-muted`) and unused DOM ids (`chip-container`, `btn-dev-import`) removed. Dead overlay helpers (`openMenuViewer`, `showMenuError`, `hideMenuError`) already gone.

## In-Progress / Known Gaps

- **Delectables → Snacks bullets (open):** Items such as “Assorted muffins” still do not render as a bullet list. SQ nests this under beverage `Delectables`; flattening heuristics have not matched the live payload (sandbox cannot call the SQ API). Do not treat these as meal course cards. Need a live JSON snippet or screenshot of the Drinks → Delectables → Snacks block.
- **Step 6 inflight menu printer (on hold):** Print chip → lookup → `openMenuPrinter` → compact `window.print()`. Default compact, meals only — do not add drinks/amenities/images or lock Step 6 unless asked.

## Key Architecture Decisions & Constraints

- **DOM injection:** Do not use `container.innerHTML += ...` for complex dynamic trees (menu loops). It re-parses the subtree, drops listeners, and yields `null` on mobile. Use `insertAdjacentHTML('beforeend', ...)` or `document.createElement`.
- **Unique-string patches:** Prefer Python unique-string replace on `index.html` over brittle search/replace in the 200KB file. Avoid `print(...)` with escaped quotes in those scripts (parse errors abort the whole patch).
- **Vercel proxy:** SQ WAF is aggressive. The live app still `POST`s `/api/sq` (`getcabin` / `menu` only). `api/getcabin.ts`, `api/menu.ts`, and `api/cabins.ts` are extra routes with upstream-then-flagship fallback and document beverage `imagePathIfeHigh`; do not replace `/api/sq` without changing the frontend contract. They use `@vercel/node` (Node), not edge.
- **Design system:** Glass (`glass-bubble`, `glass-sheet`). Palette: SIA Navy `#0B1A3A`, Charcoal, SIA Gold `#C9A227`. Mobile-first iOS styling.
- **Cache:** Bump `CACHE_NAME` in `sw.js` when `index.html` (or other cached assets) change.
- **Continuity:** After every commit, update `README.md` and `HANDOVER.md` to match the build. Ask for review before starting the next slice of work.
