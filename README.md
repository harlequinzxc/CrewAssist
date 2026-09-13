**CrewAssist** is a Progressive Web App (PWA) for Singapore Airlines (SIA) cabin crew. It is a mobile-first, chatbot-style assistant for inflight and layover calculations, plus live digital inflight menus. It is an **unofficial** crew tool.

As of **v1.4.29** (`crewassist-v62`) the product is **essentially complete**: chat, COP/IFA/LMA calculator, inflight menu viewer, printer, and a developer rates editor. Next-agent instructions, signed-off UX, and hard constraints live in [`HANDOVER.md`](HANDOVER.md). Formulas live in [`LOGIC.md`](LOGIC.md). The SQ inflight-menu API map lives in [`API_REFERENCE.md`](API_REFERENCE.md).

## Features & Goals
- **Chatbot interface:** NLP-style intent matching for quick commands (`menu`, `print`, `IFA`, `LMA`, `COP` / `total`). Jump-to-latest control matches the send button and only shows when the thread is not at the bottom. Typing dots play before every bot line, calculator, and menu lookup. After a bubble finishes entering, wait 500ms before the next bubble or typing. Send, chips, and in-chat buttons stay locked until that animation finishes (no spam). Welcome is two bubbles. Messages, cards, typing, and lookup blocks fade/slide in and out.
- **COP / IFA / LMA calculator:** Day-by-day engine for layover and turnaround allowances from `LOGIC.md`, with coefficients from `rates.json`. Developer mode (10 taps on the header dart to enable, 10 more to disable): animated accordions for paired cabin rank rates, SDP buffers, overrides & bonus, layover/turnaround bands (shared thresholds), and LMA region B/L/D. Save is this device only; Export/Import JSON; Reset restores shipped `rates.json`. IFA flight-type and sector-count menus are glass overlays. Summary overlay: currency with thousands separators (`$1,457.38`); IFA sectors labelled First–Fourth Sector; LMA day cards (DD MMM YY) with aligned B/L/D badges (✕ when a meal is missing), then Breakfast/Lunch/Dinner with counts.
- **Inflight menu viewer:** Live JSON from SQ `getcabin` / `menu` via the Vercel proxy (`/api/sq`). Chat card titled Inflight Menu; Fetch menu uses a book icon for viewing and a printer icon for print. After Fetch menu, the bot says “Fetching menu from seat pocket” then “Here is the menu”. Overlay: route hero, cabin / sector / cuisine dropdowns, segmented Meals · Drinks · Snacks · Amenities bar, centered meal-service tabs, editorial course cards, drinks/snacks hairlines, Delectables/snacks as bullets. Dish photos: linked `imagePathIfeHigh` when SQ sends it, otherwise constructed from dish `id` on the inflightmenu CDN; same-name dishes reuse a working photo/id across sectors, cabins, and later fetches (no name hardcoding). Missing CDN → gold bullet. Amenities as bullets. More/Less on long copy.
- **Inflight menu printer:** Same slide-up glass overlay as the menu viewer. Switch View ↔ Print from the sheet headers (book / printer) using the current flight — no second lookup. Numbered sector sheets (`1 LAX → NRT`). Toolbar pills match Menu sheet / Edit content size. Elegant auto-selects A4, Compact auto-selects A6 (size chips stay toggleable after). Preview is a real A4/A6 page scaled to the overlay width. Sector / Elegant-Compact / A4-A6 jump the preview to the top. Snacks except Light Bites, and drinks except Champagne / red / white wine, start hidden (Show in Edit). Compact also hides bakery / hot drinks, SCL Chocolate plus Cheese and Crackers, and YCL Cheese and Crackers. Menu sheet and Edit content scroll independently. Edit content uses collapsed, animated cabin accordions. A−/A+ grey out at 70% / 140%. Elegant pills are Bounds, then Descriptions, then Greyscale. Export PNG / JPEG / Word at high quality (compact is drawn at 300 dpi so protein invert sits on the text baseline; elegant html2canvas uses scale 3). Compact uses a per-service header with the date after the meal (`SQ478 (→JNB) JCL (SUPPER) 160926`) and a full-width rule after each service (including the last; none above the first). A Bounds pill draws the A4/A6 page edge on the preview only (never in the export). Printer loading copy is “Preparing the menu”.
- **Design system:** SIA Navy, Charcoal, and Gold; glassmorphic bubbles and bottom sheets; animated starry sky; iOS-first layout.

## Tech Stack
- **Frontend:** HTML5, CSS3, vanilla JavaScript, Tailwind CSS (CDN), Lucide Icons. Almost all UI and logic is a single `index.html`.
- **Backend / proxy:** Node.js Vercel serverless function (`api/sq.js`) for `getcabin` and `menu` only. SQ CORS allowlists `inflightmenu.singaporeair.com`, so the browser cannot read JSON directly; images are plain `<img src>` to that host (not CORS-gated).
- **Data:** Airport IATA list and regions inlined in `index.html`. Default IFA/LMA numbers in `rates.json`. SQ payload and image URL map in `API_REFERENCE.md`. Formulas in `LOGIC.md`.
- **Architecture:** PWA (service worker `crewassist-v62`, web manifest) for install and cache. App SemVer `APP_VERSION` (currently 1.4.29) is shown on onboarding. IFA/LMA numbers load from `rates.json` (network-first); developer mode can save device overrides and export/import JSON. Publishing new rates to every install is replacing `rates.json` on GitHub (not from the PWA).

## File Structure
- `index.html` — UI, chat, calculators, menu overlay, printer, and all app logic.
- `manifest.json` & `sw.js` — PWA install and cache (`crewassist-v62`).
- `rates.json` — Default IFA modifiers and LMA region rates (fetched network-first).
- `api/sq.js` — JSON proxy to SQ `POST …/api/getcabin` and `…/api/menu` (avoids CORS / WAF issues).
- `API_REFERENCE.md` — Reverse-engineered SQ inflight-menu API: endpoints, payload tree, image fields, dish-id CDN URLs, CORS.
- `LOGIC.md` — Source of truth for COP / IFA / LMA formulas and rules.
- `icons/` — Transparent dart for in-app (`logo-192.png`, `logo-512.png`); navy + gold PWA icons (`app-icon-180/192/512.png`).
- `README.md` — Overview, stack, setup, and tree.
- `HANDOVER.md` — AI-agent handoff: current build, open work, and constraints.

## Setup & Running
1. Clone the repository.
2. Frontend only: serve the root (e.g. `npx http-server` or `python3 -m http.server`).
3. Proxy / live menus: Vercel CLI (`npm i -g vercel`) then `vercel dev`.
4. Use a mobile viewport (or a phone) — the UI is built mobile-first.

Install as a PWA from the phone browser. After a deploy, confirm the onboarding stamp matches `APP_VERSION` (currently `v1.4.29`).
