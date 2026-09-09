**CrewAssist** is a Progressive Web App (PWA) for Singapore Airlines (SIA) cabin crew. It is a mobile-first, chatbot-style assistant for inflight and layover calculations, plus live digital inflight menus.

## Features & Goals
- **Chatbot interface:** NLP-style intent matching for quick commands (`menu`, `print`, `IFA`, `LMA`, `COP` / `total`). Jump-to-latest control matches the send button and only shows when the thread is not at the bottom.
- **COP / IFA / LMA calculator:** Day-by-day engine for layover and turnaround allowances from `LOGIC.md`. IFA flight-type and sector-count menus are glass overlays (same pattern as the inflight menu sheet).
- **Inflight menu viewer:** Live data from `inflightmenu.singaporeair.com` via the Vercel proxy. Chat flight + date lookup, then a glassmorphic overlay: route hero, cabin / sector / cuisine dropdowns, segmented Meals · Drinks · Snacks · Amenities bar, meal-service title, editorial course cards, drinks/snacks hairlines, drink thumbs when SQ sends `imagePathIfeHigh`, amenities as bullets, More/Less on long copy.
- **Inflight menu printer (on hold):** Compact homework-style `window.print()` from the Print chip. Default is compact meals only (no drinks, amenities, or images) until work resumes.
- **Design system:** SIA Navy, Charcoal, and Gold; glassmorphic bubbles and bottom sheets; animated starry sky; iOS-first layout.

## Tech Stack
- **Frontend:** HTML5, CSS3, vanilla JavaScript, Tailwind CSS (CDN), Lucide Icons.
- **Backend / proxy:** Node.js Vercel serverless function (`api/sq.js`) for `getcabin` and `menu`.
- **Data:** Airport IATA list and regions inlined in `index.html`.
- **Architecture:** PWA (service worker `crewassist-v12`, web manifest) for install and cache.

## File Structure
- `index.html` — UI, chat, calculators, menu overlay, printer, and all app logic.
- `manifest.json` & `sw.js` — PWA install and cache (`crewassist-v12`).
- `api/sq.js` — JSON proxy to the SIA inflight-menu API (avoids CORS / WAF issues).
- `LOGIC.md` — Source of truth for COP / IFA / LMA formulas and rules.
- `icons/` — Gold paper-plane favicon SVG plus `logo-192.png` / `logo-512.png`.
- `README.md` — Overview, stack, setup, and tree.
- `HANDOVER.md` — AI-agent handoff: current build, open work, and constraints.

## Setup & Running
1. Clone the repository.
2. Frontend only: serve the root (e.g. `npx http-server` or `python3 -m http.server`).
3. Proxy / live menus: Vercel CLI (`npm i -g vercel`) then `vercel dev`.
4. Use a mobile viewport (or a phone) — the UI is built mobile-first.
