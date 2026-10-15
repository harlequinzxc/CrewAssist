# Repo Rules

> Owns how work physically lands in this repository: branch strategy, the
> commands that are safe to run, per-file precautions, build and test
> procedure, release mechanics, and the environment hazards specific to this
> sandbox.
>
> What the UI must look like lives in `UI_UX_DISCIPLINE.md`. Universal agent
> conduct lives in `STANDING_RULES.md`. Project history lives in `HANDOVER.md`.

---

## How to work in this repo

- **Branch:** every Arena chat session gets its **own** branch, `arena/<session-id>-crewassist` (ids look like `01a0a47b-…`). It is **different for every chat** and changes when the owner jumps between chats, so a branch name you read in this file, in an old commit message, or from a previous session is **already stale**. First action in any session: `BR=$(git branch --show-current)`, and use `$BR` everywhere below. Push only that branch. Merging `arena` → `main` in **GitHub Desktop** is the correct publish path. Do not rebase `arena` onto a stale `main`.
- **Sandbox drift:** this environment can silently **re-clone the repo onto an outdated/stale commit** — your commits vanish from local history while your file edits survive as uncommitted changes, and `/tmp` plus any background process are wiped. `git reflog` shows the signature: a fresh `clone: from …` followed by `checkout: moving from main to arena/…`. The remote is **not** damaged. Recover with (`$BR` = this session's branch):
  ```bash
  BR=$(git branch --show-current)
  git fetch origin "refs/heads/$BR:refs/remotes/origin/$BR"   # a plain `git fetch origin` does NOT restore the ref
  git reset --hard "origin/$BR"
  ```
  Then re-apply the change you were making and commit it again. Confirm with `git ls-remote origin "refs/heads/$BR"` that local HEAD equals the remote SHA.
  **A rejected non-fast-forward push is this drift, not a sync problem** — it means the remote is *ahead* and your local branch was reset to a stale base. **Never `git push --force`;** that erases the good upstream commits. Seen first-hand 2026-09-15: three already-pushed commits disappeared locally, the remote was untouched, and the rejected push was the only warning.
- **Drift, second variant (seen 2026-09-24):** the sandbox came back as a **shallow clone rooted at the session branch's original fork point** (a `Ship v1.5.9`-era commit). Signature: HEAD is an ancient commit, `.git/shallow` exists, `origin/<session-branch>` is missing locally, and `git ls-remote origin` shows the true tip intact. The **working tree survives with your uncommitted edits** — so `git reset --hard` from the recipe above would **destroy a round of work**. With uncommitted changes, fetch the branch and rebase the branch pointer with **`git reset --mixed FETCH_HEAD`** (moves the branch onto the remote tip, leaves the working tree alone); afterwards `git status` must show *only* your real edits — if it shows more, stop and reconcile before committing.
- **Authorised exception to `STANDING_RULES.md` §7.** Standing Rules forbids resetting shared work or rewriting published history *as a routine recovery step*. The two recipes above are a narrow, pre-authorised exception, and they stay inside §7 because: the remote is never modified (drift is local-only — confirm with `git ls-remote origin "refs/heads/$BR"` before acting); `reset --hard "origin/$BR"` discards only local commits that already exist upstream, so no published history is rewritten; and the evidence gate is mandatory, not optional — read `git reflog` and `git status` first, and if uncommitted edits are present you **must** use variant 2's `git reset --mixed FETCH_HEAD` instead. `git push --force` remains forbidden in all cases, with no exception.
- **Clock & calendar:** the sandbox runs **UTC**; the owner lives in Singapore (**UTC+8**) — late in the owner's day, jsdom's `todayLocalYMD()` reads a day behind the owner's wall clock. Date-derived behaviour (current-month expansion, month projections, demo dates) and the date-anchored test seeds follow jsdom's clock, and expected figures are computed from the run date, never hardcoded. When the calendar month rolls over, the date-anchored tests fail **loudly on purpose** — reseed the months and expectations, never change app behaviour to match stale seeds. (Anchor while writing this: September 2026.)
- **Patching `index.html`:** it is ~1.12 MB (18.5k lines) with three inline scripts plus one external `<script src>` (lucide) — re-verify before relying on the count. Prefer **Python unique-string replace** (`count == 1`) over editor search/replace. Never `innerHTML +=` on complex trees. After a write, assert `function openMenuPrinter` and size. Syntax-check inline scripts with `node --check` using **real newlines** between script bodies (`'\n;\n'.join` — a checker `\\n;\\n` string is a SyntaxError).
- **Do not edit `HANDOVER.md` in parallel.** Two concurrent search/replaces race; the later write wins and drops the other. README then HANDOVER, **one file at a time**, after every commit.
- **Keep history entries readable by tooling.** Wrap new entries at sentence boundaries and keep any single line under ~1,500 characters; split longer rounds into sub-bullets. Entries of 3,000–6,000 characters on one line have already caused a chunked read to silently drop the v1.40.0 meal ruling (the 3,773-character transit-meals entry) and produce two wrong findings. Rendered markdown is identical either way.
- **SemVer + cache on every app change:** bump `APP_VERSION` in `index.html` (patch x.y.Z for polish, minor x.Y.0 for features) **and** `CACHE_NAME` in `sw.js` (`crewassist-vN`). The onboarding stamp is how the owner confirms the phone has the build. Docs-only README/HANDOVER tweaks have sometimes shipped without a bump; app/JS/CSS changes must bump both. **Owner ruling (2026-10-03, standing): the DEFAULT is bump both on every app change. When the owner says “do not bump version”, `APP_VERSION` freezes (the change ships inside the current version) but `CACHE_NAME` still bumps — the cache swap is delivery plumbing, not a version change.**
- **Ask for review** before starting the next slice.
- **No secrets.** No GitHub tokens, no API keys in the tree or the PWA. SQ menu JSON is unauthenticated; images are public CDN.
- **Do not call SQ / cifp from the browser.** JSON goes through `POST /api/sq` only.


---

## Git, patching and docs

- Unique-string Python replace on `index.html`; assert `function openMenuPrinter` and size > ~1,000k after every write.
- After every commit update `README.md`, `HANDOVER.md`, and **`LOGIC.md` if the change touches formulas or calculator rules**, to match the build. Edit those files **sequentially** (never two HANDOVER writes at once).
- Periodically scan for unused files in the repo and unused variables/functions in `index.html`; remove them when found (`crewAssist.modifiers` / `appModifiers` were removed in 1.5.1).
- Bump `APP_VERSION` + `sw.js` `CACHE_NAME` on every app change.
- Only push the session branch (`$BR`). Recover sandbox drift with explicit fetch + `reset --hard` of that branch — do not rebase onto old `main`.
- No tokens in files. Screenshots in chat are OK.

---

## How to ship a change

Resolve the session branch first and reuse it — never type a branch name from memory:

```bash
BR=$(git branch --show-current)   # this session's arena/<session-id>-crewassist
```

1. Implement on `$BR`. Do not start a new slice until the owner signs off the last one.
2. Bump **both** stamps together: `APP_VERSION` (`index.html` — patch x.y.Z for polish, minor x.Y.0 for a feature) and `CACHE_NAME` (`sw.js`, `crewassist-vN`). Without the cache bump the owner's phone keeps serving the old build and the change never ships.
3. Verify before committing. There is **no interactive browser** here, so drive the real code:
    - `node --check` **every** inline script (join with **real** newlines). Catches a write that broke a script mid-block; it **cannot** see a whole missing block.
    - `node --check sw.js`. `python3 -m json.tool rates.json manifest.json` if either changed — a malformed `rates.json` parses to garbage and silently mis-computes allowances.
    - For DOM / CSS / JS behaviour, load `index.html` in jsdom and call the **shipping** function (`openCaDatePicker`, `maybeWhatsNewOverlay`, `executeCalculation`), then assert DOM order and `getComputedStyle`.
    - If `rates.json` or a formula changed, re-run the `LOGIC.md` §6 test cases through `executeCalculation`. All nine cases (IFA 1–4, LMA 5a/5b, 6, 6b×2) were executed green against 1.43.0 on 2026-10-11 (re-verified: 24 checks across the nine cases).
    - **The smoke rig (real Chromium, since 2026-10-07):** `node tests/smoke/build-app.js` (rebuilds `app.html`), then `node tests/smoke/run.js` — 87 checks against the real app with CDNs blocked (icons stay `<i>` stubs; correctness is proven by name-resolution, not rendered pixels). Any colour/CSS change additionally rides the **style-snapshot protocol**: snapshot the same DOM before and after, both themes, diff computed styles — **zero diffs** is the pass bar. Chromium libs auto-extract to `/tmp/chr-libs`; `/tmp` is ephemeral, re-extract after a sandbox rebuild.
    - Truncation / drift net: the `function openMenuPrinter` + size assertion (see **How to work in this repo → Patching `index.html`**) is the only check that catches a whole-block loss.
4. Commit, then update docs **one file at a time**: README → HANDOVER → LOGIC (only if formulas or calculator rules changed). Never two HANDOVER writes at once.
5. `git push origin "$BR"`.
6. Ask the owner to review on the **phone** — the onboarding stamp must read the new `APP_VERSION`. A mismatch means cache, not code.
7. Owner merges arena → main in GitHub Desktop when they want production. No agent pushes `main`.

To publish new **rates** to everyone: change `rates.json` (or paste an Export), commit, merge. Devices without a `crewAssist.rates` override pick it up on next network-first fetch. Devices with an override keep the override until Reset.


---

## Testing (jsdom battery + real-Chromium smoke)

`tests/` contains the behaviour suite introduced 2026-09-19 (owner-approved). Run: `cd tests && npm install && npm test` (or `node tests/run-all.js`). Suites are named by feature — `dev-rates`, `dev-ui`, `earnings-archive`, `exports`, `trip-bar`, `roster-pdf`, `roster-real` (every `_inbox/` PDF through the real pipeline), `tour`, `logic-cases`, `roster-calendar`, `sw` — and assert OUTCOMES, not internals, so they survive refactors. `run-all.js` auto-globs `*.test.js` with a 300s cap per suite (14 suites / 2,331 asserts at v1.44.9, incl. `menu-extraction` + `offline-menus` + `next-flight` + `logic-cases` + `roster-calendar` + `sw`). `roster-pdf` generates synthetic rosters with the real generator's geometry (rotated table, echo rows, column splits) — real roster data is never committed. Rules: every new feature ships with its test block; an intentional behaviour change updates the matching block in the same commit; never dispatch DOMContentLoaded manually in the harness (jsdom fires its own — double-firing double-binds every listener); dialog close fades take 200ms, wait >=400ms before asserting hidden. `tests/package.json` pins jsdom (committed via a `.gitignore` negation; the root package files stay ignored by repo convention) — `node_modules` and lockfiles are never committed. The real-Chromium smoke rig and the style-snapshot protocol live in **How to ship a change → step 3**.

---

## Release notes and housekeeping

`APP_CHANGELOG` (since v1.35.0) is the app's **full version history**, newest first — 113 entries, v1.0.0 → current. Each release **appends one new entry at the top** (never rewrite, reorder or re-summarise the entries below it), gives it `d` (the release date) and categorises every pointer as `{ c, t }` — **one pointer = one sentence**, several pointers per release encouraged (`c` is `new` / `fix` / `imp` / `fun`; FUN is for lighthearted entries like the menu-extraction rulings). Past features never re-show because the What's New delta stops at `crewAssist.wnSeen` — the v1.34.3 no-accumulate intent lives on inside the entry you append. dev-ui's E6 block machine-checks the structure (≥60 entries, strictly descending versions, newest === `APP_VERSION`, the current release's pointers one sentence and ≤12 words each, every pointer categorised, and a release date on every version — the inception dates are owner-supplied, the v1.5.9 → current run is approximate from the development log). Run a dead-code sweep each release (unused `let`/`const`/`function`/files) and remove findings; the sweep is a simple identifier-count over `index.html`.

**v1.25.1 sweep (2026-09-26, repo-wide):** removed `ARCH_MU` (dead month array), `.chat-anim-out` + its keyframes (all bubbles animate with `chat-anim-in`), the `.print-edit-block` selector arm (class never assigned), and the dead `id="calcui-pill-default"` / `id="dev-save-label"` attributes; deleted superseded scratch `_inbox/menu/compact-preview.html`. Kept: `btn-dev-import` id (test hook in dev-ui), `_inbox/menu/extraction-digest.md` (ground-truth reference). **Sweep traps learned:** named IIFEs (`(function bindArchUi(){…})()`) self-execute — not dead; and classes/ids constructed at runtime (`'print-paper print-' + paper`, `'menu-' + type + '-menu'`, `'ca-arch-yoy-' + dir`) are invisible to plain string searches — grep the PREFIX (`'print-'`, `'-menu'`, `'-' +`) before declaring anything dead. 1,470 declarations scanned, 2 JS candidates, only 1 real.

---

## File map

| Path | Role |
|---|---|
| `index.html` | Entire UI + engine (~1.12 MB, 18.5k lines). Three inline `<script>` blocks + one external (lucide). |
| `tw.css` | The compiled Tailwind stylesheet (~39 kB), first-party and precached by `sw.js`; linked from `index.html` AFTER the inline `<style>` block (hotfix 19 — do not reorder). Committed and served as-is; rebuild with `tests/smoke/node_modules/.bin/tailwindcss -c tw.config.cjs -o tw.css --minify` from the repo root when class names change. The smoke rig builds its OWN copy next to `app.html` — that copy is the "generated, not persisted" one. |
| `tw.config.cjs` | Tailwind config that rebuilds `tw.css`; sets `future: { hoverOnlyWhenSupported: true }` so every hover utility compiles behind `@media (hover:hover)`. The CLI rides `tests/smoke/node_modules` — the repo root stays package-free. |
| `sw.js` | Cache `crewassist-vN` (live N = the stamp at the top of this file; bump on every app change). Precaches the first-party shell (`./`, `index.html`, `manifest.json`, `tw.css`, `rates.json` + all six `icons/`) and then the four CDN runtime deps (**pdf.js, pdf.worker, lucide, Google Fonts CSS** — v1.36.0) with retries. **Tailwind is NOT a CDN dep** — it is the precached first-party `./tw.css`; no CSS compiler runs in the browser; runtime-backfills first-party + allowlisted CDN responses (incl. opaque). Network-first for navigate/document/`index.html`/`sw.js`/`rates.json`. |
| `rates.json` | Default IFA + LMA numbers (`version`, `ifa.*`, `lma.regions`). |
| `api/sq.js` | Vercel POST proxy; only `getcabin` \| `menu`; 12s abort; Origin/Referer spoof official site. |
| `manifest.json` | PWA; `start_url` `./index.html`; theme `#0B1A3A`. |
| `docs/LOGIC.md` | Formulas/rules. Behaviour wins here; live rates win on numbers. Archive sections are **spec-only**. |
| `docs/API_REFERENCE.md` | SQ API, image fields, CORS. User-uploaded (`81c1e1e`). Do not skip its “missing image = 200 HTML” gotcha. |
| `icons/` | `logo-192/512` in-app dart; `app-icon-180/192/512` PWA; `favicon.png`. |
| `tests/` | jsdom behaviour suite (`run-all.js` auto-globs `*.test.js`); contracts in `tests/README.md`. `npm install` inside `tests/` first — `node_modules` dies at sandbox turn boundaries. |
| `app.html` | **Generated build artifact**, not source. `node tests/smoke/build-app.js` produces it (with a local `tw.css`) for the real-Chromium smoke rig. Gitignored (`tests/smoke/.gitignore`), not persisted across workspace restores — run the builder FIRST or the smoke server 404s 'nope'. Its byte size is recorded every round in these entries. |
| `docs/TOUR-BREAKDOWN.md` | The feature tour's beat-by-beat script. Sync + commit after every tour change (owner references beats by number). |
| `docs/CA_058_of_2025_Singapore_Airlines_Staff_Members_Agreement.pdf` | The full Staff Collective Agreement 2025–2027, uploaded by the owner (2026-10-07). **Only Clauses 34–36 concern this app** (COP/IFA/LMA) — the rest is reference. `docs/LOGIC.md` §0 maps every formula to those clauses. |
| `docs/_reference_rosters/` | The owner's real monthly roster + menu PDFs (2024–2026) and `menu/sq_main_courses.json` — committed fixtures `roster-real`/`roster-calendar` read directly (renamed from `_inbox/`, owner order 2026-10-07). |
| `README.md` | Human overview. |
| `docs/STANDING_RULES.md` | Universal agent conduct: scope, safety, quality bars, verification, reporting. |
| `docs/UI_UX_DISCIPLINE.md` | Binding UI rules: typography rungs, colour tokens, spacing, shapes, motion, regression discipline. |
| `docs/REPO_RULES.md` | This file. |
| `docs/HANDOVER.md` | Project memory: history, decisions, known gaps, dead ends. |

The frontend has **no bundler and no build step**; behaviour tests live in `tests/` (jsdom — see **Testing** near the end).


---

## localStorage keys

| Key | Purpose |
|---|---|
| `crewAssist.profile` | Onboarding profile (name, rank, gender, …). |
| `crewAssist.theme` | `'light'` or dark. |
| `crewAssist.prefs` | `{ autoScroll }` (autoscroll toggle UI was removed). |
| `crewAssist.devMode` | `'true'` / `'false'`. |
| `crewAssist.rates` | Device override of `rates.json` (including meal windows). Absent → use shipped file. |
| `crewAssist.hideWhatsNew` | `APP_VERSION` if the user ticked “Do not show again” for that stamp. |
| `crewAssist.wnSeen` | Version stamp last marked seen via the What’s New checkbox; the WN delta = every `APP_CHANGELOG` entry newer than it (v1.35.0). |
| `crewAssist.calcUi` | Calculator interface mode: `default` (absent/unknown) \| `manual` \| `advanced` (developer mode only). |
| `crewAssist.motion` | Motion preference (v1.45.0): `reduced` \| `full`; absent → follow the OS Reduce Motion switch (`prefers-reduced-motion`). |
| `crewAssist.recentFlights` | Last 5 successful menu lookups `{ flight, date }`. |
| `crewAssist.tourOffered` | `'1'` once the first-run tour offer has been shown (never re-offered). |
| `crewAssist.ratesCheckedAt` | Timestamp of the last successful network rates check (shown in the status popover; v1.26.0). |
| `SQ<flight>:<date>:CABINS`, `SQ<flight>:<date>:<cabin>` | Saved SQ payloads: cabin schedule + per-cabin menus, `{timestamp, data}`. Menus cache with a 6 h freshness TTL but serve stale forever offline; pruned to the 5 recent flights (v1.26.0 formalised the CABINS key + prune). |
| `crewAssist.tourDone` | `'1'` once the tour finished or was skipped (ends offers; the `tour` intent still works). |
| `crewAssist.lastBackupAt` | Timestamp of the last **full backup** export (v1.41.0: the earnings JSON extract no longer stamps it — only Settings → Data Management → Export backup does); read by the backup nudge. |
| `crewAssist.backupNudgeSnoozedAt` | Timestamp of the last nudge snooze (2-week quiet period). |
| `crewAssist.upcoming` | Roster-remembered upcoming flights `{ '<monthKey>': [{ fn, dep, arr, ymd, std }] }`, positioning excluded (v1.28.0). |
| `crewAssist.archive` | The earnings archive: saved calculation snapshots `{ id, savedAt, monthKey, sectorDate, flightType, stationDisplay, amount, snapshot }`. |
| `crewAssist.dutyDays` | Roster-remembered duty days (month-replaced like `upcoming`); drives the calendar's duty pills and timeline (v1.39.0 B6). |
| `crewAssist.allFlights` | Never-pruned roster flight store (leg times, aircraft, report times) — the calendar's live-pricing fallback across months. |
| `crewAssist.manualEdits` | Counter of hand-edits to fetched sectors; at 2 it arms the one-time Manual-mode nudge. |
| `crewAssist.nudgedCalcUi` | `'1'` once the Manual-mode nudge has been offered. |
| `crewAssist.manualCards` | Counter of fully hand-typed calculator cards; at 2 it arms the one-time roster-import nudge. |
| `crewAssist.nudgedRoster` | `'1'` once the roster-import nudge has been offered. |
| `crewAssist.installHintDone` | `'1'` once the install-as-PWA hint has been shown. |
| `crewAssist.ratesUpdatedAt` | Timestamp of the last rates *edit* on this device (honest staleness display, v1.33.0). |
| `crewAssist.nudgeDismissed` | Map of `fn\|ymd` → 1 for menu-nudge dismissals (v1.28.0). |


---

## Known environment hazards

This sandbox has specific, repeatable failure modes. Each of these has bitten
at least once.

- **Mid-turn file corruption (2026-09-25, once):** during a run of `edit_file` calls, `index.html` grew spliced lines (`document.getElementById('chat-input').vaER PDF IMPORT`), a garbled comment, a mangled airports entry and 22 duplicated lines past `</html>` — byte-level tearing, not a bad text match, and `node --check`-style parsing caught it (`Unexpected identifier 'PDF'`). Recovery: `git checkout HEAD -- <file>`, re-apply the edits with **python count-asserted replaces**, then verify — parse every inline script (`new vm.Script(code)`), `git diff | grep ^@@` to audit hunk locations, and grep the corruption signatures. After any bulk edit session, run the parse + hunk audit before committing.
- Rebasing `arena` onto a stale `main`.
- Parallel `HANDOVER.md` search/replaces.
- `must(old, new, 2)` treating `2` as a label.
- `node --check` with `'\\n;\\n'.join` (checker SyntaxError).
- Calling cifp from the browser / this sandbox (CORS / TLS EOF).

---
