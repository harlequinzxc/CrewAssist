# CrewAssist

An **unofficial** Progressive Web App for Singapore Airlines (SIA) cabin crew: a mobile-first, chatbot-style assistant for inflight and layover allowance calculations, roster reading, and live digital inflight menus. Calculation rules are verified against the Staff Members' Agreement (Clauses 34–36; the full PDF lives in `docs/`).

## Docs
- [`docs/HANDOVER.md`](docs/HANDOVER.md) — next-agent instructions; start with its **Cold start** section
- [`docs/LOGIC.md`](docs/LOGIC.md) — the COP/IFA/LMA formulas, coefficients and rules
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — the SQ inflight-menu API map
- [`docs/TOUR-BREAKDOWN.md`](docs/TOUR-BREAKDOWN.md) — the feature tour's beat-by-beat script
- [`tests/README.md`](tests/README.md) — the test-suite contracts and conventions

## Features
- **Chat assistant** — natural commands (`cop sq802 6 oct sq807 8 oct`) and quick keywords (`menu`, `print`, `IFA`, `LMA`, `COP` / `total`), typing dots before every bot line, animated cards; inputs lock while the bot works.
- **COP / IFA / LMA calculator** — day-by-day layover and turnaround allowances per [`docs/LOGIC.md`](docs/LOGIC.md), coefficients from `rates.json`. Per-sector **Fetch** from flight number + date, a trip bar with **Fetch all** and per-leg Retry, Direct US / Paxing / Shuttle toggles, Default / Manual / Advanced interfaces, plain-English Flight Overview summaries.
- **Roster PDF import** — the monthly Crew Roster Report PDF read entirely on-device (pdf.js from CDN, nothing uploaded). Trips chained and prefilled (same-day pairs → turnarounds, back-to-back pairs → one 4-sector day, >6h ground → layovers — heuristics in [`docs/LOGIC.md`](docs/LOGIC.md)); one-shot Build, **Calculate all**, multi-month stitching; unreadable input is reported honestly, never guessed.
- **Roster calendar** — month grid of duty pills (one seamless capsule per multi-day run), today accent, tap-to-select detail timelines; every duty opens its saved or live-priced earnings.
- **Earnings archive** — saved flights grouped by month with totals, averages, projection and vs-last-year context, a twelve-month chart, Best / Low / In-progress badges, insight cards, search and delete-with-undo.
- **Feature tour** — five steps, offered once on first run or via `tour` / `help`, skippable at every step, demo data only (the crew's own data is never touched).
- **Inflight menu viewer + printer** — live SQ menus via the Vercel proxy, cabin / sector / cuisine filters, editorial course cards with photos; the print sheet offers Elegant / Compact presets (A4 / A6), a page-scaled preview and PNG / JPEG / Word export.
- **Offline menu archive** — the last successful menus stay viewable offline with an honest offline badge; stale entries pruned, aging backups flagged.
- **Design system** — SIA Navy, Charcoal and Gold; glassmorphic bubbles and bottom sheets; animated starry sky; Lucide icons throughout — no emoji.

## Tech Stack
- **Frontend:** HTML5, CSS3, vanilla JavaScript. Almost all UI and logic is a single `index.html`. Tailwind ships as a **compiled stylesheet** (`tw.css`, rebuilt from `tw.config.cjs` — no CDN runtime); Lucide icons.
- **Backend / proxy:** one Node.js Vercel serverless function (`api/sq.js`) for SQ `getcabin` and `menu` only. SQ CORS allowlists `inflightmenu.singaporeair.com`, so the browser cannot read the JSON directly; images are plain `<img src>` to that host (not CORS-gated).
- **Data:** airport IATA list and regions inlined in `index.html`. Default IFA/LMA numbers in `rates.json` (network-first; developer mode can save device overrides and export/import JSON).
- **Architecture:** installable PWA (service worker, web manifest). The worker precaches the shell, `rates.json` and the CDN runtime deps with retries, and runs network-first for documents and rates. `APP_VERSION` shows on onboarding — a deploy mismatch means cache, not code. `APP_CHANGELOG` (newest first) drives both the What's New overlay and Settings → Changelog, which is the record of what changed and when.

## File Structure
- `index.html` — UI, chat, calculators, roster import, calendar, earnings, menu overlay, printer, and all app logic.
- `manifest.json` & `sw.js` — PWA install and cache.
- `tw.css` & `tw.config.cjs` — the compiled Tailwind stylesheet and the config that rebuilds it (rebuild when class names change; the Tailwind CLI rides `tests/smoke/node_modules` because the repo root stays package-free by convention).
- `rates.json` — default IFA modifiers and LMA region rates (fetched network-first).
- `api/sq.js` — JSON proxy to SQ `POST …/api/getcabin` and `…/api/menu` (avoids CORS / WAF issues).
- `icons/` — transparent dart for in-app (`logo-192.png`, `logo-512.png`); navy + gold PWA icons (`app-icon-180/192/512.png`).
- `docs/` — all written matter: `LOGIC.md` (formulas), `HANDOVER.md` (agent handoff), `API_REFERENCE.md` (SQ API), `TOUR-BREAKDOWN.md` (tour script), `_reference_rosters/` (the owner's real roster/menu PDFs the regression suite reads), and the full Staff Members' Agreement PDF — Clauses 34–36 are the ones this app implements.
- `tests/` — the jsdom behaviour suite plus `tests/smoke/`, the real-Chromium browser rig (`cd tests && npm install && npm test`; see `tests/README.md`).
- `README.md` — this overview.

## Setup & Running
1. Clone the repository.
2. Frontend only: serve the root (e.g. `npx http-server` or `python3 -m http.server`).
3. Proxy / live menus: Vercel CLI (`npm i -g vercel`) then `vercel dev`.
4. Use a mobile viewport (or a phone) — the UI is built mobile-first.

Install as a PWA from the phone browser. What changed and when: the in-app changelog (Settings → Changelog).

## Tests
`tests/` holds the jsdom behaviour suite — it boots the real `index.html` in a fake browser and asserts the feature contracts. `tests/smoke/` is the real-browser layer — it boots the app in actual Chromium and checks boot health, release stamps, What's New and the headline calculation semantics. Run: `cd tests && npm install && npm test` for the suite, `cd tests/smoke && npm install && node run.js` for the smoke. Suite and assert counts are not recorded here — the run-all summary is the live source of truth. The real-roster regression tests read every PDF in `docs/_reference_rosters/`, so a fresh clone runs the full suite out of the box. New features bring their test block; intentional behaviour changes update the matching block in the same sitting. Details and conventions: [`tests/README.md`](tests/README.md).
