# Singapore Airlines In-flight Menu — Reverse-Engineered API Reference

**Target site:** https://inflightmenu.singaporeair.com/home
**Discovered:** 2026-09-11 · by static analysis of the site's public JS bundles (no hacking, no credentials, no bypassed auth — the app ships its API contract to every browser that opens it)

---

## TL;DR

The site is a static React SPA (Vite/Rolldown build) hosted on S3 + CloudFront. All data comes from an
**unauthenticated JSON API**:

```
POST https://cifp.auto.prod.c0.singaporeair.com/api/menu
POST https://cifp.auto.prod.c0.singaporeair.com/api/getcabin
POST https://cifp.auto.prod.c0.singaporeair.com/api/trackusage   (analytics only)
```

Headers: just `Content-Type: application/json`. **No API key, no auth, no cookies, no signing.**
The `sessionId` the app appends is generated locally in the browser (`YYYYMMDDHHmmss-<uuid4>`), so any
client-side value works.

---

## 1. How it was found

1. `GET /home` returns template HTML referencing one main bundle: `/assets/index-CqyDDV6Q.js`
   (plus `/assets/utils-Bp9uRMvS.js`, a lazy `/assets/DownloadPdf-p-x4xycs.js`).
2. The bundle contains an RTK Query (Redux Toolkit Query) `createApi` slice named `cifpApi`
   with `baseUrl: https://cifp.auto.prod.c0.singaporeair.com/api` and three endpoints.
3. `utils.js` contains the URL-param parser (`?a=…&b=…`), validators, localStorage keys,
   session-id generation, and the cabin-class enum.

## 2. Endpoints

### 2.1 `POST /api/getcabin` — which cabin classes have menus

Request:

```json
{
  "carrierId": "SQ",
  "flightNumber": "321",          // SQ/SIA prefix stripped, no leading zeros needed
  "flightDate": "2026-09-12",     // strict YYYY-MM-DD
  "sessionId": "20260911..."      // optional in practice
}
```

Response:

```json
{
  "cabinClasses": ["FCL", "JCL", "SCL", "YCL"],
  "statusCode": 200,
  "statusMessage": "Success",
  "checksum": "…"
}
```

### 2.2 `POST /api/menu` — the entire menu payload (everything the UI renders)

Request:

```json
{
  "carrierId": "SQ",
  "flightNumber": "321",
  "cabinClass": "FCL",            // FCL | JCL | SCL | YCL
  "flightDate": "2026-09-12",
  "languageCode": "en",           // response includes ALL available language blocks anyway
  "legSequenceNumber": "1",       // optional, for multi-leg flights
  "tailNumber": "9V-Sxx",         // alternative lookup key (then flightNumber/flightDate are omitted)
  "sessionId": "…"
}
```

Response (abridged — full field tree in §4):

```
carrierId, flightNumber, flightDate, cabinClass, fbpDate, serviceType,
legs[]
  ├─ legseqno
  ├─ flightDetails {departureAirportCode, arrivalAirportCode, flightStatus,
  │                 departureLocalDate, arrivalLocalDate, departureUtcDate, arrivalUtcDate,
  │                 departureCityName, arrivalCityName}
  ├─ isHawkerPromo / isNoMenuPlanned / isNoHotRefreshment / isSnackBag / isBentoBox / isSQDelhi40
  ├─ guestChef {id, header, message}
  ├─ menu.language.{EN_UK|JA_JP|KO_KR|ZH_CN|ZH_TW}
  │    └─ meals[] {mealServiceNumber, mealServiceCode, mealServiceName, mealServiceWriteUp,
  │         selectionDetails[] → mealCourses[] {category, maxSequence,
  │              items[] {id, name, description, longDescription, sequence,
  │                       icons[], iconName, iconImagePath, footnote,
  │                       imagePathIfeHigh/Low, specialtyIcon*}}}  ← see §2.4
  ├─ beverage.language.{…} → categories[] {name, description, footer, categorySequence,
  │    subcategories[] → specialities[] → items[] {name, description, itemType, …}}
  └─ amenities {header, footer, items[] {itemName, itemDescription, sequence, imagePath}}
statusCode, statusMessage, checksum
```

Notes:
- **Multi-leg flight numbers** (e.g. SQ11 = LAX→NRT→SIN): one call returns **all legs** in `legs[]`,
  each with its own independent menus/languages — details in §5.2.
- All **language blocks available for that flight come back in one response** (e.g. `EN_UK` + `JA_JP`
  on Japan routes); `languageCode` only tells the UI which to display. One request = all languages.
- Menu/dish images use absolute URLs like
  `https://inflightmenu.singaporeair.com/fabs/DM/DISH_SPECIALTY/EPGMG_Symbol.jpg` (same static host).
- The "Download PDF" button is generated **client-side** from this same JSON (jsPDF in
  `DownloadPdf-*.js`) — so `/menu` is a *complete* source of the site's data.

### 2.3 `POST /api/trackusage` — analytics

Fire-and-forget telemetry (`name: "addUsage"`). Safe to ignore.

### 2.4 Images & media — every image field, URL pattern and gotcha

The menu payloads carry 8 image-ish field families. Verified against all 840 harvested files for
2026-09-11:

| field(s) | lives on | populated? | what it is |
|----------|----------|------------|------------|
| `icons[]`, `iconName`, `iconImagePath` | dish/beverage **items** | ~10% of items | small badges (chef exclusives, dietary marks). Absolute URLs: `…/fabs/DM/DISH_SPECIALTY/<CODE>_Symbol.jpg` (12 distinct codes: EPGMG, MTL, ICP, …). The code usually matches the item's `footnote` text (e.g. `EPGMG` ⇢ "Exclusively created by Chef Monica Galetti"). |
| `footnoteId`, `footnoteName`, `footnoteIconImagePath` | **selectionDetails** (per meal service) | ~100% | the little 20px legend icons under each selection. ⚠️ data-quality gotcha: some are junk — `…/DISH_SPECIALTY/.jpg` (empty filename) — filter those. |
| `specialtyIconId/Name/ImagePath/Footnote` | **items** | rare | specialty-programme badge (e.g. `ICP` International Culinary Panel), same `DISH_SPECIALTY/` URL pattern. |
| `imagePath` | amenity **items** | ~85% | **relative** path, resolve against the site root: `https://inflightmenu.singaporeair.com/ifss/images/DM/<CABIN>/1 Amenity Kit.png` (URL-encode spaces as `%20`). |
| `highResImagePath` / `lowResImagePath` | **selectionDetails** | **empty in all production data** | schema slots for menu-card photos; the UI renders them (mobile → low-res) if SIA ever populates them. |
| `imagePathIfeHigh` / `imagePathIfeLow` | dish **items** | only ~9% of items | **the real dish photography** (from the IFE system). Relative: `fabs/IFE/INFM/<CABIN>/HIGH\|LOW/<ID>_<CABIN>.png`. |

**The big one — dish photos are constructible from dish IDs.** Even where `imagePathIfe*` is empty,
the photo usually exists on the CDN. Item `id` → URL:

```
id: "DH021259-v3-FCL"   →  https://inflightmenu.singaporeair.com/fabs/IFE/INFM/FCL/HIGH/DH021259_FCL.png        ✅ 746 KB
id: "DH026749-001-SCL"  →  https://inflightmenu.singaporeair.com/fabs/IFE/INFM/SCL/HIGH/DH026749-001_SCL.png   ✅ (API itself links this one)
```

i.e. take the `XX######` base (and optional `-###` suffix), drop any `-vN` version segment, append
`_<CABIN>.png`. Measured hit-rate on a 40-ID sample: **75%**. HIGH ≈ 300 KB–1 MB PNG, LOW ≈ 100–300 KB.

**Gotcha — missing images return HTTP 200:** the S3/CloudFront fallback serves the SPA's
`index.html` (content-type `text/html`, 4,664 bytes) for non-existent objects. Never trust the status
code — check `content-type: image/*`.

**Scale, for one day (2026-09-11):** 1,713 unique dish IDs → 3,464 probeable photo URLs
(+21 amenity images, +12 badge icons). The 173 *linked* images alone are 87 MB; a full
constructed sweep is ~2.5 k images ≈ 1.2–1.5 GB. For bulk pulls prefer LOW.

Toolkit: `python3 sia_inflight_menu.py images --date 2026-09-11 --mode linked|all`
(`--list-only` to preview; writes `manifest.json` with every working URL; skips HTML-fallback
responses automatically).

## 3. Enumerations

**Cabin classes:** `FCL` Suites/First · `JCL` Business · `SCL` Premium Economy · `YCL` Economy

**Menu languages:** `EN_UK` · `JA_JP` · `KO_KR` · `ZH_CN` · `ZH_TW`

**Errors:** `statusCode 200` Success · `101` "No flight found." · `400` "Carrier code, flight number
and flight date are mandatory." · flightDate must parse strictly as `YYYY-MM-DD`.

**Visibility window:** menus are published up to ~8 days before departure (per the site's own meta
description); `flightStatus` in each leg says `SCHEDULED`, etc.

## 4. How the SPA builds its URLs (handy for deep links)

Query params are either plaintext or base64 (`atob`):

| param | meaning |
|-------|---------|
| `e`   | plaintext flightNumber (`SQ321` → `321`) |
| `f`   | plaintext tailNumber |
| `a`   | base64 cabinClass |
| `b`   | base64 flightNumber |
| `c`   | base64 flightDate |
| `d`   | base64 tailNumber |
| `g`   | base64 legSequenceNumber |
| `lang`| `en`, `ja`, `ko`, `zh_CN`… |
| `utm_source/medium/campaign/content` | tracking passthrough |

Example: `https://inflightmenu.singaporeair.com/home?a=RkNM&b=MTMyMQ==&c=MjAyNi0wOS0xMQ==&lang=en`
→ Suites menu of SQ321 (base64: `FCL`, `1321`, `2026-09-11`).

Client-side caching: the SPA stores responses in localStorage keyed
`<endpointName>:<JSON body>` and re-sends a `checksum` field to detect staleness — irrelevant for
third-party harvesting.

## 5. Recipe: build a "flight number + date + cabin → meal & photo" web app

This is the exact blueprint for a front-end app where the user types a flight number, a valid date,
picks the applicable cabin class, and sees the meals served with photos.

### 5.1 Architecture first — CORS forces a thin proxy (measured 2026-09-11)

| request | response |
|---|---|
| `OPTIONS /api/menu` (preflight) from any origin | `access-control-allow-origin: *` ✅ passes |
| `POST /api/getcabin` or `/api/menu` with `Origin: https://yourapp.example` | `access-control-allow-origin: https://inflightmenu.singaporeair.com` ❌ **fixed allowlist — your origin is not echoed** |

The browser will pass the preflight, send the POST, then **refuse to let your JS read the response**.
So:

- **JSON (`/getcabin`, `/menu`) → route through a tiny server-side proxy** (Node/Express, Cloudflare
  Worker, Vercel/Netlify function — ~20 lines, see 5.5). Bonus: the proxy is the right place for caching.
- **Images → no proxy needed.** Plain `<img src>` tags are not CORS-gated; point them straight at
  `https://inflightmenu.singaporeair.com/...`. (Only canvas pixel-manipulation would need CORS.)
- If your app is server-rendered (Next.js/Nuxt routes, etc.) you can also just call the API from your
  server actions/loaders — same effect as a proxy.

### 5.2 UI flow (mirrors what the official SPA does)

1. **Flight number field** — accept `SQ321`, `SIA321`, `321`. Normalise: uppercase → strip leading
   `SQ`/`SIA` → strip leading zeros → digits only. The API wants the bare number (`321`).
2. **Date field** — constrain the picker to `today … today+8` (SIA publishes menus up to 8 days out;
   the meta description says "up to eight days before"). The API itself accepted probes at +14 days,
   so don't hard-fail beyond 8 — just treat `statusCode 101` as "menu not published yet".
   Past dates return `101` (flight gone).
3. **Cabin selector — populate it dynamically with `/getcabin`** (recommended): one cheap call
   validates the flight+date *and* returns exactly the applicable cabins (e.g. `["FCL","JCL","SCL","YCL"]`).
   Only after the user picks a cabin do you fire the heavier `/menu` call.
4. **`/menu` → render.** Handle: `legs[]` (see the multi-leg box below), language blocks
   (`menu.language` keys `EN_UK`, `JA_JP`, `KO_KR`, `ZH_CN`, `ZH_TW` → language toggle), and the
   service-style flags (`isSnackBag`, `isBentoBox`, `isNoMenuPlanned`, `isNoHotRefreshment`,
   `isHawkerPromo`) which tell you when there is no conventional meal list to render
   (short-haul economy).
5. **Error states:** `101` → "No menu found for this flight/date"; `400` → fix inputs; network error →
   retry. Never block the UI on `/trackusage` (you don't need to send it at all).

**Multi-leg flight numbers (verified with SQ11 = LAX→NRT→SIN, 2026-09-11):**

- A **single `/menu` call returns all legs** in `legs[]` — you do *not* need `legSequenceNumber`.
  SQ11 FCL comes back as `legseqno 1: LAX→NRT` + `legseqno 2: NRT→SIN` in one response.
- **Each leg is a complete, independent menu world**: own `flightDetails`, meals, beverages,
  amenities, language blocks — and they genuinely differ. SQ11 FCL leg 1 (LAX→NRT) has 3 meal
  services; leg 2 (NRT→SIN) has 1. Languages are per leg too.
- **`flightDate` is anchored to the first leg's departure.** Leg 2 usually departs the *next*
  calendar day in its own timezone (SQ11: leg 1 `2026-09-11 14:20` LAX local, leg 2 `2026-09-12
  19:00` NRT local). Label leg tabs with their own local dates so users aren't confused.
- `legSequenceNumber` in the request is accepted but in tests the API returns **all legs anyway** —
  filter client-side by index rather than round-tripping per leg.
- Frequency: 22 of 840 menus on 2026-09-11 were multi-leg — flight numbers SQ11/12 (SIN–NRT–LAX),
  SQ25/26 (SIN–FRA–JFK), SQ478/479. So: always render a leg tab/selector when `legs.length > 1`.

### 5.3 Request cheat-sheet (what your proxy forwards)

```http
POST {PROXY}/getcabin   {"carrierId":"SQ","flightNumber":"321","flightDate":"2026-09-12","sessionId":"..."}
POST {PROXY}/menu       {"carrierId":"SQ","flightNumber":"321","cabinClass":"FCL",
                         "flightDate":"2026-09-12","languageCode":"en","sessionId":"..."}
```

`sessionId`: generate once per browser session — `${YYYYMMDDHHmmss}-${crypto.randomUUID()}` — and reuse.

### 5.4 The meal photo — fallback chain (the important part)

Per dish item, try these sources **in order** (see §2.4 for the field map):

1. `item.imagePathIfeHigh` if non-empty (the ~9% the API links explicitly) → absolutise.
2. **Constructed from the dish `id`** (75% hit-rate):
   `id "DH021259-v3-FCL"` → strip `-vN` → `fabs/IFE/INFM/FCL/HIGH/DH021259_FCL.png`.
3. Same but `LOW` (smaller, ~100–300 KB — good default for mobile).
4. Your own placeholder (cloche/plate SVG).

Implement the cascade with `<img onerror>`: missing photos return **HTTP 200 with HTML** (the SPA
fallback), which fails image decoding and fires `onerror` — that's your signal to try the next
candidate. Absolutise relative paths as `https://inflightmenu.singaporeair.com/ + encodeURI(path)`
(spaces → `%20` in amenity images like `ifss/images/DM/FCL/1 Amenity Kit.png`).

### 5.5 Minimal proxy — Node ≥18, zero dependencies (`proxy.js`)

```js
import http from 'node:http';

const API = 'https://cifp.auto.prod.c0.singaporeair.com/api';
const TTL = 6 * 60 * 60 * 1000;                 // menus are static once published
const cache = new Map();                        // key -> {t, body}

http.createServer(async (req, res) => {
  if (req.method !== 'POST' || !['/getcabin', '/menu'].includes(req.url)) {
    res.writeHead(405).end(); return;
  }
  let body = '';
  for await (const ch of req) body += ch;
  const key = req.url + body;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) {
    res.writeHead(200, { 'content-type': 'application/json' }).end(hit.body);
    return;
  }
  const upstream = await fetch(API + req.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => null);
  if (!upstream?.ok) { res.writeHead(502).end(); return; }
  const text = await upstream.text();
  cache.set(key, { t: Date.now(), body: text });
  res.writeHead(200, { 'content-type': 'application/json' }).end(text);
}).listen(8787, () => console.log('proxy on :8787'));
```

### 5.6 Front-end logic — framework-agnostic (~50 lines)

```js
const PROXY  = 'http://localhost:8787';                  // your proxy from 5.5
const STATIC = 'https://inflightmenu.singaporeair.com';  // images: fine cross-origin via <img>
const SID = `${new Date().toISOString().slice(0,19).replace(/\D/g,'')}-${crypto.randomUUID()}`;

async function post(path, body) {
  const r = await fetch(`${PROXY}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, sessionId: SID }),
  });
  return r.json();                                       // { statusCode, statusMessage, ... }
}
const getCabins = (fn, date) =>
  post('/getcabin', { carrierId: 'SQ', flightNumber: fn, flightDate: date });
const getMenu = (fn, cabin, date, lang = 'en') =>
  post('/menu', { carrierId: 'SQ', flightNumber: fn, cabinClass: cabin,
                  flightDate: date, languageCode: lang });

export const normFlight = s => s.trim().toUpperCase().replace(/^SIA|^SQ/, '').replace(/^0+/, '');

// photo candidates per dish, priority order (see §5.4)
export function photoCandidates(item, cabin) {
  const ids = (item.id || '').match(/^([A-Z]{2}\d{6}(?:-\d{3})?)(?:-v\d+)?/);
  const list = [];
  if (item.imagePathIfeHigh) list.push(`${STATIC}/${encodeURI(item.imagePathIfeHigh)}`);
  if (ids) for (const res of ['HIGH', 'LOW'])
    list.push(`${STATIC}/fabs/IFE/INFM/${cabin}/${res}/${ids[1]}_${cabin}.png`);
  return list;
}

// <img> whose onerror walks the candidate list, then a placeholder
export function mealImage(item, cabin, placeholder) {
  const cands = photoCandidates(item, cabin);
  const img = new Image();
  let i = 0;
  img.onerror = () => { img.src = ++i < cands.length ? cands[i] : placeholder; };
  img.src = cands[0] ?? placeholder;
  return img;
}

// ---- typical form flow ----
// 1) on flight+date submitted:            const c = await getCabins(normFlight(fn), date);
// 2) c.statusCode === 200 ? populate cabin <select> with c.cabinClasses : show('No flight found');
// 3) on cabin chosen:                     const m = await getMenu(fn, cabin, date);
// 4) m.statusCode === 200 ? m.legs.forEach(renderLeg)  // meals via leg.menu.language[lang].meals,
//                                                      // photos via mealImage(item, cabin)
```

Multi-leg & language: render one tab per `m.legs[]` (title from `leg.flightDetails`), and one
language tab per key of `leg.menu.language` / `leg.beverage.language` — every available translation
ships in a single response, so the toggle costs zero extra requests.

### 5.7 Caching & good citizenship

- Menu data is **static per (flight, cabin, date)** once published — cache aggressively (proxy Map
  above, plus `localStorage`/IndexedDB client-side if you like; the official SPA caches with a
  `checksum`).
- Only fetch on explicit user action; no background sweeps. Your app's request volume should look
  like "one user browsing menus", not a crawler.
- Keep the proxy private to your app (don't leave an open relay on the internet).
- This is SIA's public data served for its guests — fine for personal/hobby tools and research; for a
  commercial product, get permission from Singapore Airlines.

## 6. Reproducibility & responsible use

- The bundled filenames are hashed per deploy; when Singapore Airlines redeploys the site, re-fetch
  `/home` and grab the new `/assets/index-*.js` to re-locate the same `cifpApi` slice (endpoints have
  been stable in structure).
- Data is *schedule-linked*: expect ~340 flights/day with menus; a full day of data (discovery of
  flight numbers 1–999 + one `/menu` call per flight×cabin) is ~1,200 requests and completes in
  ~2 minutes at 6 concurrent workers.
- Be polite: this is a free public endpoint run for airline guests — keep concurrency low, cache
  responses (they're per-date and largely static once published), and honour any robots/terms changes.
  For anything beyond casual research, ask Singapore Airlines for API access.

## 7. Toolkit in this workspace

| file | purpose |
|------|---------|
| `sia_inflight_menu.py` | CLI client: `cabins` / `menu` / `discover` / `harvest` (single date or range, language choice) |
| `data/discovery_2026-09-11.json` | every flight with menu data that day → cabin classes |
| `data/index_2026-09-11.json` | normalised index of all 840 harvested flight×cabin menus |
| `data/menus/*.json` | 840 raw API responses (41 MB) — every meal, beverage, amenity for 2026-09-11 |
| `data/images_2026-09-11/` | `samples/` curated imagery (dish photos, amenities, badges) + `manifest.json` documenting all 173 working image URLs for the day |
| `dashboard.html` | offline browser of the harvested day of data |
