# General AI Agent Development Rules

> Universal agent conduct: scope, safety, quality, verification and reporting.
> These rules are project-agnostic and apply to all work in this repository.
>
> Project-specific companions: `UI_UX_DISCIPLINE.md` (what the interface must
> look like and how it must behave), `REPO_RULES.md` (branches, commands,
> build/test, release mechanics, environment hazards), and `HANDOVER.md`
> (project history, technical decisions, known issues, unfinished work).
>
> Where a project document defines a stricter or more specific requirement,
> follow it in addition to these rules. Where they genuinely conflict, see
> §13 Conflict & Exception Handling.

---

## 1. Project Reconnaissance & Source of Truth

- **Inspect before changing.** Before editing, inspect the relevant files, architecture, existing implementation, project instructions, dependencies and available tests.

- **Follow the established project conventions.** Prefer existing patterns and abstractions unless they demonstrably conflict with a requirement or a higher-priority rule.

- **Establish the source of truth.** When instructions, documentation, code and historical notes conflict, follow the applicable instruction hierarchy and verify which source is authoritative. Do not silently resolve material conflicts through guesswork.

- **Verify assumptions against the current repository.** Never assume that remembered file paths, branch names, versions, APIs, dependencies or previous implementation details are still accurate.

- **Inspect the blast radius.** Before modifying shared utilities, global styles, configuration, data models or public interfaces, identify other features and components that may depend on them.

## 2. Scope & Change Control

- **Make the smallest complete change.** Modify only what is necessary to satisfy the requested task and its required dependencies.

- **No speculative changes.** Every modification must be traceable to an explicit requirement, an applicable standing rule, a necessary dependency or a verified defect blocking the task.

- **No unrelated cleanup.** Do not refactor, rename, reformat or restructure unrelated code merely because an improvement is possible.

- **Preserve existing behaviour by default.** Do not alter established business logic, user workflows, calculations, data formats or external contracts unless explicitly authorised or required to fix a verified defect.

- **Resolve scope ambiguity before implementation.** Ask for clarification when materially different interpretations could produce different outcomes, introduce risk or change expected behaviour. For low-risk ambiguity, make the narrowest reasonable assumption and disclose it.

- **Keep changes reversible.** Avoid destructive operations and broad rewrites when a targeted, recoverable change can achieve the same result.

## 3. Architecture & Code Quality

- **Respect architectural boundaries.** Keep responsibilities, dependencies and data flow consistent with the existing architecture.

- **Reuse before duplicating.** Search for existing components, utilities, services, helpers and patterns before introducing new ones.

- **Avoid unnecessary abstractions.** Introduce shared abstractions when they reduce meaningful duplication or complexity, not merely to anticipate hypothetical future requirements.

- **Keep responsibilities cohesive.** Functions, modules and components should have clear purposes and manageable complexity.

- **Maintain naming consistency.** Follow established naming, file organisation, formatting and documentation conventions.

- **Manage dependencies deliberately.** Do not introduce a package, framework, service or external dependency when the existing stack can reasonably satisfy the requirement.

- **Preserve public contracts.** Treat exported interfaces, API schemas, persisted data formats and integration boundaries as compatibility-sensitive.

- **Clean up only within scope.** Remove dead code, temporary diagnostics and obsolete artifacts introduced by the change. Broader cleanup requires explicit authorisation.

## 4. Behaviour, State & Data Integrity

- **Preserve state ownership.** Keep state changes in the appropriate layer and follow the application's established data-flow model.

- **Keep interactions complete.** Every new or modified control must have a defined outcome, including relevant loading, success, empty, disabled and error states.

- **Protect existing workflows.** Consider navigation, validation, persistence, undo or cancellation, and downstream effects before changing an interaction.

- **Prevent stale or conflicting updates.** Handle asynchronous operations, repeated submissions, race conditions and component or resource lifecycles where relevant.

- **Protect data integrity.** Validate inputs, preserve required invariants and handle partial failures without silently corrupting or discarding data.

- **Make destructive actions explicit.** Deletion, overwriting, irreversible operations and migrations must have appropriate safeguards and recovery considerations.

- **Do not silently degrade.** If a requested change requires a trade-off or leaves an existing capability impaired, disclose it rather than presenting the result as fully successful.

- **A capture is judged against the screen it claims to reproduce (v1.46.1, hardened v1.46.2).** Fidelity — "exactly what is on screen" — is the acceptance bar for any screenshot/share artifact: fonts, layout, charts, colours, edges and where the content ends. Anything the artifact must NOT show (chrome, footers, bookkeeping) is a named exclusion the owner ordered, removed in the painter's clone — never an accident of the painter. Verify in the real browser by decoding the PNG, not by trusting the painter's promise. The v1.46.2 hardening: the house font must be ARMED IN THE LIVE DOCUMENT before the shot (a style in the live head with the faces awaited — injecting @font-face inside the painter's onclone races the clone's own fonts.ready and still falls back); the painter measures the LIVE element against the real window, so the clone must FLATTEN the target to the body's only child at the origin at its live width — anything inside a fixed sheet past its live bounds never paints; and the fidelity proof for fonts is a same-string twin (the painted width of a known text run vs a hidden live twin in the same classes), never a band comparison over a stripped layout. The v1.46.3 hardening: the vendored painter's font-baseline probe assumes its 1x1 img is INLINE — a CSS preflight that makes imgs block (Tailwind's does) silently skews every measured baseline to ~lineHeight and paints ALL text a step low (the owner's half-cut icon labels; only icon-adjacent text has the reference that shows it), so the app restores the probe's assumed environment with scoped CSS (the probe div is the only body-level div with inline visibility:hidden + nowrap; the vendor file stays pristine). And a rig that stubs a rendering dependency (the smoke's lucide stub) is blind to defects in what that dependency renders — probes for icon-adjacent geometry must stage the real library.
- **A capture must be FAST and must always deliver (v1.46.4).** Fidelity is not the only bar: the owner judges the cameras on TIME too — "seconds, not 15-20". A capture path may not wait on the network (the fonts come from the vendored data-URL faces with a bounded race — document.fonts.load matches by family, so an unraced wait inherits the cross-origin Google CSS), the painter's clone may not re-fetch anything (the cross-origin links are dropped at clone time through ignoreElements — html2canvas 1.4.1's only pre-iframe hook), and the one-time painter costs land at boot through a marked idle prewarm rather than on the first camera tap. A share is AWAITED: a refusal that is not the crew's own dismissal falls through to the anchor download, so the PNG always lands somewhere — a toast over an undelivered image is a defect. Any capture-fidelity or capture-speed change re-proves the PNGs byte-identical unless the round's intent is to change pixels. Rig proof for speed runs under the phone's emulation with the slow network simulated, and the GPU flag chosen for honest readback (a software-GL sandbox readback at DPR 2 stalls tens of seconds; a real phone's GPU does ~100ms).
- **A capture delivers straight to the phone's share sheet (v1.46.6, owner order — superseding the v1.46.5 preview).** “Share” means the native iOS/Android web share popup: `navigator.share` is called directly the moment the PNG exists — no preview sheet, no second tap (the owner rejected the v1.46.5 preview detour: too many taps, and its unstyled classes read as a broken background). The tap is answered at once by a busy toast, so however long the paint takes the screen never reads frozen; the delivery toast replaces it. The honest fallbacks stand: a refusal that is not the crew's own dismissal anchors the download (the PNG always lands), the crew's own dismissal stops at the toast, and a platform without a share API anchors straight away — every path ends on its done toast. The pixel budget is part of the speed contract: the canvas caps at ~4MP and never paints taller than 4090 device pixels (the paint and the PNG encode both ride the pixel count; short cards keep their full scale — a disclosed sharpness trade, never a silent one), no scan makes a full-surface readback on the crew's time (downscaled copy + thin band, the cut stays byte-identical), and heavy one-time costs prewarm at idle. A capture path is judged on three clocks: tap → the busy toast, tap → the file, and whether the native sheet opened at all.

- **A capture photographs the card itself, not a model of it (v1.47.0, the scrap-and-start order).** The painter-library path is retired for captures after the v1.46.6 field failure: the passport camera hand-paints a canvas with the calendar capture’s own walker (computed boxes, gradient fills, texts at live rects, icons drawn from their own SVG markup), and the artifact’s dimensions ARE the card’s live dimensions — no injected header, no chrome the screen does not show, no trim air, no clone that can drift from the page. The two cameras share one walker so they cannot diverge. The buttons and pickers stay put while the engines underneath are replaced one at a time (the owner’s order: passport first, earnings after the passport is approved in the field). The proof of “exactly what is on screen” is the decoded PNG against the live card’s rect plus the raster pins (the gradient’s far corners differ; the label band carries ink) — never the painter’s promise.

- **Both cameras ride the hand-paint, and every capture carries its title (v1.47.1, the owner's field-passed pattern).** The earnings camera joined the passport's engine after the owner approved it in the field: the roster walker over the live DOM (boxes, gradients, texts, icons), the diet rows hidden live for the measure + paint and restored in the finally, the full scroll painted from its top under the v1.46.6 pixel budget. The title is part of the artifact: a centered 34px band above the card, the owner's exact wording ("All-Time Flight Records" / "Flight Records for YYYY" / "Earnings for YYYY"), painted by the shared caCapPaintTitle in the target's live theme ink — never injected into the DOM, never invented by the app. The painter library is RETIRED from captures whole (shoot, trim, prewarm, the clone diet, the vendored lib and its precache entry) — nothing captures through html2canvas, so captures are offline by construction and there is no clone to drift from the page. A fast flow's intermediate state (the pose) is pinned from inside a synchronous wrapper at the moment it matters — never by rAF-polled waits after the fact, which the engine can outrun.

- **A fold is a clip, and the walker reads the ancestors (v1.47.2, the ghost-stations report).** The archive folds a month with max-height 0 + overflow hidden + opacity 0 — the rows still lay out with live rects, they are only clipped off the screen. "What is on screen is what lands in the PNG" therefore includes the ancestor test: a subtree under an ancestor at opacity 0, or sitting entirely outside an ancestor's clip box, never paints — in the box walk AND the icon pass; the capture root's own scrollbox clip is the fold the full-scroll paint deliberately paints through, so the root is exempt. The inverse holds too: visible content stays in the share, because the share shows what the crew sees — EXCEPT bookkeeping, which the owner can order out of the share (the v1.48.0 since-line order: the "Showing earnings since…" line joined the capture's diet; the live view keeps it). A rig that proves this pins the walk's own paint set (read at build time, inside the builder wrapper) or discriminates by geometry — leaked ink can coincide with legitimate ink row-for-row, so "no ink in this zone" is not a proof.

- **The six standing rulings of v1.48.0 (owner orders, 2026-11-03).** (1) **The share ends at the last record** — the since-line is bookkeeping, dieted from the capture, kept in the live view. (2) **The departure-board roll is the ONE reduced-motion exception** — it plays regardless of ca-reduced; only a capture's pose holds it (the digits must paint settled), and the entrance roll waits out the sheet's glide (~360ms). (v1.48.2: joined by the earnings live month's refresh-cw — the exception is a two-member family now, both owner-ordered. v1.48.3: the Flight Stats counts and dates join through the same caNumRoll engine, so the family reads as: every roll the engine paints, plus the live-ico.) (3) **The shortcuts card teaches, it never types** — read-only rows; the composer is the only way in. (4) **Canapé names one course, the chicken satay service** — appetiser stays appetiser, app stays app; a house term belongs to the dish it names, never to a whole course family. (5) **The ethnic parting and the Japan course defaults fire on real menu names** — the gate is what the selection IS (not International; carrying the mizugashi/mizumono signature), never the word "ethnic" appearing in it. (6) **A cabin search may name several cabins** — "jcl ycl menu sq802 17 oct" shows exactly those, the first wanted leading, unpublished wants dropping out with the same honest note as ever.

- **The four rulings of v1.48.1 (owner orders, 2026-11-03, the polish round after the v1.48.0 field pass).** (1) **A flat comparison is not an increase** — a month whose year-on-year reads 0.0% wears a DASH and the month figure's own gold ink, never a green up-arrow; the arrows belong to movement, the dash to standing still. (2) **Gold reads as tappable** — an untappable word never wears the gold ink; the shortcuts card's command keywords ride inside the example bubbles as plain mono pills, because gold promises a tap and nothing on that card taps but the CTA. (3) **The compact parting tells the whole selection story** — the dashed rule parts ethnic from ethnic AND the ethnic block from the International that follows it (ethnic, dash, ethnic, dash, International); an International sitting between two ethnic selections never breaks their pairing. (4) **A scrolled rail comes home** — the chat's quick-action chips scroll back to their start after every tap; a swiped rail never stays stranded mid-row.
- **The five rulings of v1.48.2 (owner orders, 2026-11-03, the five-order round after the v1.48.1 field pass).** (1) **Nothing highlights, anywhere** — a press-and-hold on the phone or a click-hold-drag on the desktop selects no text in the app; the ONLY exception is the fields meant for typing (inputs, textareas, selects keep their selection; the iOS long-press callout goes with the ban). (2) **Expenses are export data, not display** — every export door carries the overseas expenses: the whole-device backup, the earnings JSON extract (inside each entry's detail), and the CSV's fifth column, now unconditional for every crew. The v1.45.31 display ruling stands for the ON-SCREEN surfaces (Developer Mode's alone); its CSV clause is superseded here. (3) **The live month's icon keeps turning under reduced motion** — the earnings header's refresh-cw joins the departure-board roll as an owner-ordered exception, so motion-sensitive crew still see which month is live. (4) **Teaching pills read at full ink** — the shortcuts card's command bubbles never dim; the pill's gray wash separates them from the prose, and the text carries the bubble's own ink in both themes (the v1.48.1 keywords-in-bubbles ruling, now at full strength). (5) **The chip rail sits with its composer** — the quick-action chips belong visually to the typing field (a tight gap-1.5), never floating loose above it.
- **Cloud sync (Cloudflare D1) is RAINCHECKED — a genuine future feature (owner order, 2026-11-03: "raincheck this for now. genuine feature for future").** Do not implement without a new owner order. The settled design (recorded whole in the HANDOVER entry of the same date): the owner + shared crew, each a private locker; an invite code at the door; email + one-time-code sign-in; automatic background sync behind the offline-first app; the synced set is exactly `BACKUP_KEYS`; last-write-wins with the backup file as the manual override; no passphrase lock (the owner's choice, addable later). The owner's part when ordered: one browser click (wrangler login) + two pastes (email-sender key, invite word) via a one-command guided setup script — the owner is a first-time terminal user; never ask for a Cloudflare credential or token in chat.
- **The three rulings of v1.48.3 (owner orders, 2026-11-03).** (1) **A restored expense is visible on every device** — the v1.45.31 display clause joins its CSV clause in retirement: the salary card's Exp line and after-expenses line, the month head's N− row, and the layover summary's READ-ONLY expense statement render for every crew on every phone (the data always survived the backup — the round's root cause was the dev-gated display, never the pipe). The only door still Developer Mode's alone is the KEYING one: the receipt row's tap-to-edit (Add Expenses / the pre-filled figure) stays dev-gated, so a restored expense reads everywhere but edits only in dev. (2) **The Exp figure rides its own row** — directly under the Gross|CPF line, never a third segment inside that nowrap string (the third segment clipped out of the salary card on iPhone 11); and every lens that steps the salary figures aside (the COP lens, a basic-less salary) steps the Exp line aside with them — a render family hides and shows WHOLE. (3) **The Flight Stats page rolls like the departure board** — the counts and dates (the podium cards and the leaderboard rows alike) ride the caNumRoll engine on a fresh open: digits only (the × glyph beside a count and the month word inside a date stand still), never the year pills, the 2nd/3rd ordinals, the row ranks or the View-all count; the roll arms past the sheet's glide (the v1.48.0 ~360ms pattern, cancelled on close) and inherits the roll family's reduced-motion exception. (v1.48.4: a year-pill change rolls the same family too — fired immediately, the sheet being already up, superseding any pending entrance arm. v1.48.5: the flights pills — the All Flights / Layovers / Turnarounds tabs — ride the same roll; only the View-all door is not a pill and keeps rendering settled.)

- **A deliver path never reports failure after the artifact was delivered (v1.46.0).** When a flow produces an artifact and then hands it off (share sheet, download anchor, export), the handoff is best-effort: an embedder or browser that refuses the handoff mechanism must never flip the flow into its failure branch — the user keeps the artifact and the honest success message. The failure message is reserved for failures that actually lost the artifact. Same discipline for any pose/restore pair around the deliver: the restore rides a `finally`, so a late throw can never strand the user in the posed state.

## 5. UI, UX & Accessibility

- **The feature tour is the spotlight (v1.49.0; firing and completion v1.49.1; ring glide, chat revert and copy pack part 2 v1.49.2; invitation, per-walk completion and stage revert v1.50.0 — owner orders).** One lit target, one tooltip, one Next at a time; the veil shows targets without letting them be pressed; the lit target always fits the viewport and the tooltip never clips it nor covers the target (12px margins, 300px cap — the iPhone 11 lesson). The gold ring glides between steps, even under reduced motion — tour animations are the one ca-reduced exception, owner orders v1.49.2 and v1.50.0 (the invitation fades/scales in and out the same way). The walks' copy is the owner's pack, VERBATIM — tooltips render it word-for-word (`**bold**` markers render bold, in lines and titles), never as markup. The auto path is invitation-first: a prompt card (the compass, “Let's take a quick tour”, Next / Skip) renders for every crew whose main walk is neither done at its current content nor declined — before the What's-New sheet and the greeting; Next walks, Skip declines PERMANENTLY (`crewAssist.spotMainDeclined`); the prompt gates only the auto path (Settings rows, the `tour` command and the help CTA bypass it). ONLY Done completes a walk — the per-walk store `crewAssist.spotDone` stamps it at the walk's content version (cv), and the Settings rows wear a gold circle-check (done) or a hollow circle (not done); a skipped or escaped walk returns on the next app open; main keeps its legacy mirror `crewAssist.spotMainDone`. When a walk ends the STAGE reverts to its pre-tour state — sheets, the calendar's tag chip, the chat (no tutorial cards left behind), and the scrolls the walk touched (the chip rail, the Settings sheet — v1.51.0, the owner's roster-walk report); the app reads exactly as it did before the walk. Every tour replays forever from Settings → Feature tour. Reorders, additions and removals go through `docs/FEATURE_TOUR.md` (the contract), never freehand.
- **Match before inventing.** Inspect existing interfaces and reuse the nearest appropriate design pattern, component and interaction treatment.

- **Respect the design system.** Use established tokens, typography, colours, spacing, shapes, elevation, icons and component variants instead of inventing local alternatives.

- **Keep visual behaviour consistent.** Equivalent components should behave consistently across screens, states, themes and supported input methods.

- **Use motion intentionally.** Animate meaningful state changes when motion improves continuity or communicates cause and effect. Use suitable properties and durations, respect reduced-motion preferences, and never make essential feedback or task completion depend on animation.

- **Preserve accessibility.** Consider semantic structure, keyboard operation, focus management, screen-reader announcements, contrast, target sizes and accessible names.

- **Support real content and layouts.** Check responsive behaviour, long text, empty states, loading states, errors and supported languages or input methods where applicable.

- **Avoid interaction regressions.** A visual change must not inadvertently break hit areas, keyboard navigation, scrolling, focus, validation or other existing interactions.

## 6. Security & Privacy

- **Never expose secrets.** Do not commit credentials, tokens, private keys or sensitive configuration to source control, client bundles, logs or documentation.

- **Respect trust boundaries.** Keep privileged operations and credentials on appropriately secured server-side or trusted execution layers.

- **Validate untrusted input.** Apply suitable validation, sanitisation, encoding and parameterisation at relevant system boundaries.

- **Enforce authorisation server-side.** Do not rely solely on client-side checks to protect restricted operations or data.

- **Minimise sensitive data.** Collect, transmit, store and log only what is necessary, using appropriate protection and retention practices.

- **Protect external integrations.** Verify endpoint usage, permissions, error handling and dependency trust before adding or changing integrations.

- **Do not weaken safeguards for convenience.** Never bypass authentication, validation, security checks or access controls merely to make a test or implementation pass.

## 7. Git & Change Safety

- **Verify repository state first.** Before editing or committing, inspect the active branch, working-tree status and relevant recent history.

- **Protect existing work.** Identify pre-existing modifications and preserve them. Do not overwrite, discard, reset or reformat changes whose ownership or purpose is uncertain.

- **Use the repository's prescribed workflow.** Follow the applicable branch, commit, review, merge and release procedures rather than assuming a universal workflow.

- **Never force destructive history changes without explicit authorisation.** Do not force-push, reset shared work or rewrite published history as a routine recovery step.

- **Verify before recovery.** If the repository, branch or remote state appears inconsistent, gather evidence and preserve uncommitted changes before attempting recovery.

- **Coordinate shared files.** Avoid simultaneous writes to the same file or shared resource. Serialise changes or establish clear ownership when multiple agents are involved.

- **Keep changes attributable.** Ensure commits contain the intended work and do not accidentally include unrelated modifications.

## 8. Testing & Verification

- **Verify proportionately to risk.** Choose checks based on the affected behaviour, system complexity and potential impact of failure.

- **Test the changed behaviour.** Add or update relevant tests when appropriate, including boundary cases and failure paths.

- **Run available project checks.** Use the applicable test suite, build, lint, type checks, static analysis and runtime checks where available.

- **Check adjacent behaviour.** Verify critical neighbouring workflows and shared dependencies that could be affected by the change.

- **Test environment-sensitive behaviour.** Use explicit assumptions for dates, time zones, locale, configuration, network state and other environment-dependent inputs.

- **Avoid brittle tests.** Prefer deterministic fixtures, controlled clocks and computed expectations over hardcoded values that become stale without reason.

- **Validate the actual outcome.** A successful edit or passing isolated test does not automatically establish that the complete feature works.

- **Verify the full lifecycle, including repeat firings.** For anything that mounts, animates and restores, test mount → animate → restore → fire again mid-flight: the second firing is where capture/restore bugs surface (a restore that reverts a later value, a re-capture that loses structure the first pass kept). A single fresh-run pass can look green while every repeat is broken.

- **Never fabricate verification.** Report a check as passed only if it was actually run and its result supports that claim. Clearly distinguish passed, failed, blocked and unverified checks.

## 9. Documentation, Configuration & Compatibility

- **Keep documentation aligned.** Update relevant instructions, API documentation, configuration examples and user-facing guidance when behaviour or interfaces change.

- **Respect configuration boundaries.** Do not hardcode environment-specific values when the project uses configuration or environment variables for them.

- **Handle migrations safely.** Consider existing data, compatibility, rollback, repeatability and partial failure before changing schemas or persisted formats.

- **Follow the project's established versioning scheme.** Use Semantic Versioning (SemVer) when the project adopts it, following the format `MAJOR.MINOR.PATCH`.

- **Choose the version bump according to the change:**

  - **PATCH (`x.y.Z`):** Backward-compatible bug fixes, maintenance and polish.

  - **MINOR (`x.Y.0`):** Backward-compatible functionality additions.

  - **MAJOR (`X.0.0`):** Changes that break existing public contracts or compatibility.

- **Respect project-specific release rules.** Projects may define additional versioning conventions for UI changes, internal releases, build numbers, cache invalidation or deployment identifiers. Follow those rules alongside general SemVer principles.

- **Keep version identifiers consistent.** Update all required version fields, cache identifiers, release metadata and related configuration according to the project's release procedure.

- **Do not invent or silently change release policy.** If the project has an established versioning convention, do not replace it with a different scheme without authorisation.

- **Respect explicit owner instructions.** If the owner directs the agent not to bump a particular version identifier, follow that instruction while still performing any separately required release, cache or deployment updates.

- **Distinguish app changes from documentation-only changes.** Follow the project's rules for determining which changes require version bumps, cache updates and release notes. Do not assume every file modification requires an application version change.

- **Keep release documentation accurate.** Record meaningful features, fixes, improvements and breaking changes in the appropriate release documentation. Keep concise release notes distinct from detailed development handover notes when the project maintains both.

- **Verify release changes.** Before completion, check that version identifiers, cache metadata and release documentation are consistent with the actual changes and project rules.

- **Report release decisions explicitly.** State which version identifiers were changed, which were intentionally left unchanged, and why. Never claim a release or deployment succeeded unless it was actually completed and verified.

- **Avoid undocumented operational changes.** Disclose changes that affect deployment, build steps, environment setup, permissions or maintenance procedures.

## 10. Iterative Work & Multi-Agent Coordination

- **Work in reviewable slices.** Break larger tasks into coherent changes with clear acceptance criteria and verifiable outcomes.

- **Respect approval checkpoints.** When the owner requires review before the next slice, stop at that boundary and wait for approval.

- **Maintain a consistent shared understanding.** Record relevant assumptions, decisions, dependencies and unresolved issues so later iterations do not unknowingly reverse earlier decisions.

- **Coordinate agent ownership.** Before parallel work, establish file ownership, shared interfaces, dependencies and integration responsibilities.

- **Do not overwrite another agent's work.** Inspect concurrent changes and reconcile conflicts deliberately.

- **Avoid premature continuation.** Do not start additional features, refactors or follow-on tasks before the current scope has been verified and any required review has occurred.

## 11. Definition of Done

A task is complete only when:

- The requested outcome and acceptance criteria have been addressed.

- Changes remain within authorised scope.

- Existing behaviour and relevant neighbouring workflows have been preserved or intentionally changed with approval.

- Applicable tests and verification checks have been completed, or their limitations have been disclosed.

- Relevant security, accessibility, compatibility and data-integrity concerns have been considered.

- Required documentation and project-specific release steps have been handled.

- No known material regression is being presented as resolved.

- The final report accurately describes changes, verification, limitations and outstanding risks.

## 12. Mandatory Change Report

At the end of each implementation turn, provide a concise report containing:

1. **Changed:** Files, features and behaviours modified.

2. **Preserved:** Important neighbouring behaviour or areas intentionally left untouched.

3. **Verification:** Checks actually performed and their results.

4. **Limitations:** Unverified areas, blockers, assumptions and known risks.

5. **Next step:** The next required action, if any, including whether owner review is needed.

For a turn that makes no code changes, state that no implementation changes were made and report any relevant findings or decisions instead.

## 13. Conflict & Exception Handling

- **Higher-priority instructions prevail.** Follow applicable system, platform, security and owner instructions in their established order of precedence.

- **Do not silently waive a standing rule.** If a requirement cannot be satisfied, explain the conflict and propose the narrowest safe alternative.

- **Prefer evidence over assumptions.** Base technical decisions on the current implementation, project documentation, reproducible behaviour and actual verification.

- **Escalate material risks.** Seek clarification or approval before actions that are destructive, security-sensitive, externally visible, expensive or difficult to reverse.

- **Report honestly.** Never conceal a failed check, known regression, incomplete task or material deviation from the requested scope.
