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
| `earnings-archive.test.js` | Route display strips only SIN, keeps multi-sector routes; the real current calendar month expands on open; delete uses the settings-style pop-up (OK deletes, Cancel keeps).  Tap-through: rows reopen the full summary from the stored snapshot (Flight Overview + breakdowns), old entries say so honestly, X deletes with the undo toast and never opens the sheet; empty archive still opens the page with both-ways guidance; reopened summaries are bounded + scrollable and open at the top. |
| `exports.test.js` | PC/Mac always download; iPhone shares natively with the real `.json` name; Android shares JSON as the `.txt` twin (extension-gated share), attempts the share directly when `canShare` refuses, downloads on genuine refusal, delivers nothing on cancel; Word never renamed. |
| `tour.test.js` | The what's-new sheet holding the welcome chat until closed (boot with `keepWhatsNew`), then the five-step feature tour end-to-end offline: registry order (chat, roster, default, manual, menu), the four-line opener with its quoted examples, the roster demo fully gated (paperclip said-then-lit, the downloaded-from-Crew-App instruction, Calculate all never highlighted, fictitious roster, Build cards/Calculate all, the summary-opens-only-after-Next beat) labelled 'July 2026 - Demo.pdf', the real flow's 'calculating every flight' line, the save-at-the-bottom + acknowledgement + exit with a breath at every beat (Calculate all lit before the save explanation, smooth scroll, pauses), save beats landing in the session store while `crewAssist.archive` stays untouched, the earnings chapter gated on Next (chip introduced in chat, never auto-tapped) with archive peek + tap-through, the Default demo typing SQ 632/633 digit by digit with sector 2 a day after sector 1 (no gate, no save; the fetch line's window; honest offline pivot), honest menu-watcher pivot, Manual through the real settings pill ($360.72) with the mode restored, the first-run two-line offer (button reads Let's go) shown exactly once and skippable, interruption yields + resume restarts the same step, the print preview concluding the tour with the close button highlighted past the cleanup, and every demo bubble excised while the crew's own menu card stays. |
| `trip-bar.test.js` | IFA/LMA trip-bar boxes turn green when their sector/station is fetched (driven through the real Fetch-all flow with a stubbed `fetchSectorSchedule`), updated in place so the colour transition survives. |
| `roster-pdf.test.js` | Roster PDF import on synthetic rosters (same geometry as the real generator): echo merge incl. cross-page, same-day pairs merging into a 4-sector day, overnight turnaround, 3-station US trip, repeated flight numbers, month-end open trip, mid-column splits, junk rejection; confirm bubble Build/Discard; full card prefill (IFA times/dates/fns, LMA stations, pills, Direct US, Calculate armed); paperclip + `roster`/`upload`/`import` intents; live-FileList change regression (the v1.20.0 real-device bug); multi-month stitching — boundary trip completes, duplicate month skipped, span label shown; Calculate all — builds + calculates in one tap, combined total equals the sum of per-card results, one-tap save-all, stays available after Build, spent by Discard; Flight Overview — single summary and per-trip paragraphs, owner-locked date format, NP/KTM South Asia fix, Direct US rule wording, archive tap-through from save-all. |

## Conventions (what keeps this evergreen)

1. **Assert outcomes, not internals.** "The share panel received the file", not "function X called function Y". Outcome tests survive refactors — the export logic was rewritten twice without touching these assertions.
2. **New features bring their test block.** The feature's "verify" step becomes a permanent suite block, added in the same sitting as the feature.
3. **Intentional behaviour changes update the matching block.** A failing test after a deliberate spec change is the net doing its job — re-sign the contract in the same commit. The cost stays proportional: minutes, never a rewrite.
4. **IDs are contracts.** The app's element ids (`btn-dev-save`, `ca-arch-trash`, …) are stable and pinned by the owner's specs; tests may rely on them. classNames only where the spec pins them (colours, pill styling).
5. **Timing:** the harness boots jsdom and waits 400ms — jsdom fires its own `DOMContentLoaded` exactly once. **Never dispatch it manually**; double-firing double-binds every listener (a real bug this suite caught). Dialog close fades take 200ms — wait ≥400ms after OK/Cancel before asserting `hidden`.

## Harness stubs (`_harness.js`)

`lucide.createIcons` (no-op) · `navigator.serviceWorker` (undefined) · `fetch` (repo `rates.json` served; `/api/sq` returns offline-failure) · `open` · scroll methods · `innerText` · canvas 2D context (absorbing Proxy). Anything new the app needs from a browser gets stubbed here, documented inline.
