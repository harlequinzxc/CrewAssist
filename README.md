**CrewAssist** is a Progressive Web App (PWA) for Singapore Airlines (SIA) cabin crew. It is a mobile-first, chatbot-style assistant for inflight and layover calculations, plus live digital inflight menus.

## Features & Goals
- **Chatbot interface:** NLP-style intent matching for quick commands (`menu`, `print`, `IFA`, `LMA`, `COP` / `total`). Jump-to-latest control matches the send button and only shows when the thread is not at the bottom. Typing dots play before every bot line, calculator, and menu lookup. After a bubble finishes entering, wait 500ms before the next bubble or typing. Welcome is two bubbles. Messages, cards, typing, and lookup blocks fade/slide in and out.
- **COP / IFA / LMA calculator:** Day-by-day engine for layover and turnaround allowances from `LOGIC.md`. IFA flight-type and sector-count menus are glass overlays (same pattern as the inflight menu sheet).
- **Inflight menu viewer:** Live JSON from SQ `getcabin` / `menu` via the Vercel proxy (`/api/sq`). Chat card titled Inflight Menu; Fetch menu uses a book icon for viewing and a printer icon for print. After Fetch menu, the bot says “Fetching menu from seat pocket” then “Here is the menu”. Overlay: route hero, cabin / sector / cuisine dropdowns, segmented Meals · Drinks · Snacks · Amenities bar, centered meal-service tabs, editorial course cards, drinks/snacks hairlines, Delectables/snacks as bullets. Dish photos: linked `imagePathIfeHigh` when SQ sends it (~9%), otherwise constructed from dish `id` on the inflightmenu CDN; no photo → gold bullet. Amenities as bullets. More/Less on long copy.
- **Inflight menu printer:** Same slide-up glass overlay as the menu viewer. Numbered sector sheets (`1 LAX → NRT`), Elegant or Compact, A4 or A6 fitted to preview width, type-size A−/A+ (does not resize the page), greyscale and descriptions on the same scrollable toolbar, in-app edit with Hide/Show, export PNG / JPEG / Word. Elegant follows SQ meal-service order; Pralines and coffee/tea-style rows are plain lines; wine groups use the full `CHAMPAGNE AND WINE — WHITE` header. Compact is still the tight homework layout.
- **Design system:** SIA Navy, Charcoal, and Gold; glassmorphic bubbles and bottom sheets; animated starry sky; iOS-first layout.

## Tech Stack
- **Frontend:** HTML5, CSS3, vanilla JavaScript, Tailwind CSS (CDN), Lucide Icons.
- **Backend / proxy:** Node.js Vercel serverless function (`api/sq.js`) for `getcabin` and `menu` only. SQ CORS allowlists `inflightmenu.singaporeair.com`, so the browser cannot read JSON directly; images are plain `<img src>` to that host (not CORS-gated).
- **Data:** Airport IATA list and regions inlined in `index.html`. SQ payload and image URL map in `API_REFERENCE.md`.
- **Architecture:** PWA (service worker `crewassist-v43`, web manifest) for install and cache. App SemVer `APP_VERSION` (currently 1.4.10) is shown on onboarding.

## File Structure
- `index.html` — UI, chat, calculators, menu overlay, printer, and all app logic.
- `manifest.json` & `sw.js` — PWA install and cache (`crewassist-v43`).
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
