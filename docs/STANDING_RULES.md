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

## 5. UI, UX & Accessibility

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
