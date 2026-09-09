**CrewAssist** is a Progressive Web App (PWA) designed exclusively for Singapore Airlines (SIA) cabin crew. It provides an intuitive, chatbot-style mobile-first interface to streamline daily inflight and layover calculations, as well as providing rapid access to the digital inflight menus.

## Features & Goals
- **Chatbot Interface:** NLP-style intent matching for quick commands (e.g., typing "menu", "total", "LMA").
- **COP/LMA/IFA Calculator:** Complex, day-by-day calculation engine to accurately determine crew layover and turnaround allowances based on SIA logic.
- **Inflight Menu Viewer:** Fetches live data from the `inflightmenu.singaporeair.com` API, bypassing CORS via a custom Vercel proxy, and parses the nested JSON into a beautiful, glassmorphic UI overlay with Hero Cards, Dropdowns, and categorical meal/drink tabs.
- **Design System:** Strictly adheres to SIA's brand identity (Navy, Charcoal, Gold accents, Batik-inspired lines) featuring a reactive animated starry night sky background and smooth modal bottom-sheets.

## Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS (via CDN), Lucide Icons.
- **Backend / Proxy:** Node.js, Vercel Serverless Edge Functions (`api/sq.js`).
- **Data:** Local embedded arrays for Airport IATA data/regions.
- **Architecture:** Standard Progressive Web App (Service Worker, Manifest) for offline-capable installation.

## File Structure
- `index.html`: The core application containing all UI templates, modal overlays, the chat interface, and vanilla JS logic.
- `manifest.json` & `sw.js`: PWA configuration for installation and caching.
- `api/sq.js`: Vercel Edge proxy used to safely fetch data from the SIA datacenter without triggering WAF blocks or CORS errors.
- `LOGIC.md`: The source-of-truth document mapping out the exact formulas and rules for the COP Calculator.
- `icons/`: Directory containing the minimalist gold paper-plane SVG and generated PNGs.
- `README.md`: - Project overview, goal, and target audience. Tech stack, libraries, and tools used. Step-by-step setup and running instructions. Overview of the file/folder structure.
- `HANDOVER.md`: AI Agent handoff context file.

## Setup & Running
1. Clone the repository.
2. For frontend work, run a local web server (e.g., `npx http-server` or `python3 -m http.server`) in the root directory.
3. For proxy testing, install the Vercel CLI (`npm i -g vercel`) and run `vercel dev` to simulate the Edge environment.
4. Load the app in a mobile viewport simulator for accurate UI rendering.
