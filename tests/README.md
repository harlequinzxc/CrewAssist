# CrewAssist behaviour tests

A small jsdom suite that boots the **real `index.html`** in a fake browser and drives it the way a person would: tapping buttons, typing into fields, answering dialogs, faking flight fetches. No build step, no browser, no network. Runs in ~25 seconds.

## Run it

```bash
cd tests
npm install        # once; installs the pinned jsdom (see package.json)
npm test           # or: node run-all.js
```

`node_modules/` and the lockfile are git-ignored (repo convention) — the pinned version lives in `tests/package.json`. If jsdom ever needs bumping, bump it deliberately and re-run everything.

## What each suite covers

| Suite | Feature contract |
|---|---|
| `dev-rates.test.js` | Rates editor snapshot/dirty machine: dimmed Save, UNSAVED EDITS dot/label, per-row EDITED tags + section dots, save flash → clean, import fills + dirty but never saves, reset-to-defaults dialog. |
| `dev-ui.test.js` | Footer anatomy (full-width Save; Export `download` / Import `upload` one-line, equal width), Data Management pills (gold Reset above red Clear All Data), 10-tap dev-mode reveal. |
| `earnings-archive.test.js` | Route display strips only SIN, keeps multi-sector routes; the real current calendar month expands on open; delete uses the settings-style pop-up (OK deletes, Cancel keeps). |
| `exports.test.js` | PC/Mac always download; iPhone shares natively with the real `.json` name; Android shares JSON as the `.txt` twin (extension-gated share), attempts the share directly when `canShare` refuses, downloads on genuine refusal, delivers nothing on cancel; Word never renamed. |
| `trip-bar.test.js` | IFA/LMA trip-bar boxes turn green when their sector/station is fetched (driven through the real Fetch-all flow with a stubbed `fetchSectorSchedule`), updated in place so the colour transition survives. |

## Conventions (what keeps this evergreen)

1. **Assert outcomes, not internals.** "The share panel received the file", not "function X called function Y". Outcome tests survive refactors — the export logic was rewritten twice without touching these assertions.
2. **New features bring their test block.** The feature's "verify" step becomes a permanent suite block, added in the same sitting as the feature.
3. **Intentional behaviour changes update the matching block.** A failing test after a deliberate spec change is the net doing its job — re-sign the contract in the same commit. The cost stays proportional: minutes, never a rewrite.
4. **IDs are contracts.** The app's element ids (`btn-dev-save`, `ca-arch-trash`, …) are stable and pinned by the owner's specs; tests may rely on them. classNames only where the spec pins them (colours, pill styling).
5. **Timing:** the harness boots jsdom and waits 400ms — jsdom fires its own `DOMContentLoaded` exactly once. **Never dispatch it manually**; double-firing double-binds every listener (a real bug this suite caught). Dialog close fades take 200ms — wait ≥400ms after OK/Cancel before asserting `hidden`.

## Harness stubs (`_harness.js`)

`lucide.createIcons` (no-op) · `navigator.serviceWorker` (undefined) · `fetch` (repo `rates.json` served; `/api/sq` returns offline-failure) · `open` · scroll methods · `innerText` · canvas 2D context (absorbing Proxy). Anything new the app needs from a browser gets stubbed here, documented inline.
