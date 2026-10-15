# UI/UX Discipline

> Owns everything the interface looks like and behaves like: typography,
> colour tokens, themes, spacing, shape, elevation, icons, motion, interaction
> states, microcopy, and the regression rules that keep all of it from
> drifting.
>
> Universal agent conduct (scope, verification, reporting) lives in
> `STANDING_RULES.md`. Repo mechanics (branches, builds, releases) live in
> `REPO_RULES.md`. Project history and technical decisions live in
> `HANDOVER.md`.

---

## Golden Rule

> **Match before making.** Before building or styling anything new, scan the
> existing UI and find the element whose role, weight, and placement most
> closely match what you are about to build. Reuse that element's full
> treatment verbatim — size, weight, color, spacing, radius, shadow, states,
> motion, icon size, and copy casing. If no existing element matches cleanly,
> extend the system through the named tokens/roles in this document rather
> than inventing a one-off value.

Boring consistency beats novel polish every iteration. If you can point to the
newest feature because it looks slightly newer, shinier, or different from what
was already there, you have drifted.

---

## Pattern Discipline

For each UI job there is exactly one established pattern. Before building
anything, ask "how does the app already do this?" and use that pattern.

| Job                          | Established pattern                                                              |
|------------------------------|----------------------------------------------------------------------------------|
| Primary call to action       | Filled gold gradient button (single style, `rounded-full` pill, elevate-mid, UPPERCASE label)|
| Secondary action             | Outlined gold button (transparent fill, gold border + text, Title Case)          |
| Tertiary / ghost action      | Text or icon button, minimal styling, gold on press                              |
| Dismiss / close              | Quiet X icon (`x` Lucide), text-tertiary at rest, gold on press, corner placement |
| Proactive suggestion         | Lighter nudge surface (slightly smaller radius, translucent gold-tinted fill, no top-glow), not a second heavy card |
| Success confirmation         | `check` / `check-circle` inline OR slim one-line confirmation nudge above content; never a blocking modal |
| Short loading feedback       | Inline Lucide spinner in the label — never a modal blocker for quick operations  |
| Error feedback (non-blocking)| Inline danger-toned text below the field/button                                  |
| Toggle (binary on/off)       | Icon button: neutral at rest, gold fill when on, with pulse/scale                |
| Suggestion chips             | Horizontally scrollable pill row (radius-pill, no truncation), gold tint on press|
| Card section separation      | Hairline dividers (border-subtle), not nested cards or oversized margins         |

If you want a new pattern, stop. Either the existing pattern works (use it) or
extend it in a dedicated refactor pass — never invent a third button, card, or
chip style for a "slightly different" case.

### Gold-plating is forbidden

Do not add extras you were not asked for. Specifically do not silently add:

- Animations because "it would feel nice".
- Gradients, glows, or shadows to make something "pop".
- Extra icons or decorative elements.
- Extra metadata lines, status pills, or labels beyond what was requested.
- Hover or active polish where neighboring elements don't have it.
- "While I'm here I'll also…" improvements.

If you believe an addition is a clear improvement, suggest it explicitly —
"Want me to also add X?" — rather than silently including it.

---

## Typography

### Type scale roles

The typographic scale is fixed. Always pick by role name; never write bespoke
sizes or tune by eye.

- **HERO** — page/screen titles and the single most important number on a page. At most one per screen.
- **TITLE** — card titles, section headers, key entity labels, large button labels.
- **BODY** — primary readable text, message bubbles, form labels, chip labels, standard button labels, input text.
- **SUBTITLE** — secondary metadata under a title (dates, times, helper lines, quiet CTAs, placeholder text).
- **CAPTION** — tertiary metadata, status pills, timestamps, tab labels, small chip labels, form hints.
- **MICRO** — smallest readable text (badge numbers, counts, character counters, divider labels). Nothing readable is smaller than MICRO.

### The concrete rungs

Roles say what a piece of text is *for*. Rungs are the sizes that actually
ship. There are eight, nothing renders between them, and every role resolves
to one of them.

| Rung | Size | Treatment | Serves |
|---------|------|-------------------------------------|-----------------------------------------------|
| MICRO   | 11px | `ca-micro`                          | badges, counts, tiny uppercase labels         |
| CAPTION | 12px | `text-xs`                           | chips, timestamps, tab labels, metadata       |
| BODY    | 14px | `text-sm`                           | bubbles, labels, buttons, inputs              |
| AMOUNT  | 17px | `text-[17px]` + `ca-amt`, tabular   | money figures                                 |
| COMPACT | 18px | `text-lg`                           | top-bar title, section labels                 |
| TITLE   | 20px | `text-xl`                           | sheet titles, trip-card station codes         |
| DISPLAY | 24px | `text-2xl`                          | screen titles, hero-card codes + times        |
| HERO    | 36px | `text-4xl`                          | the single most important number, once per screen |

Three notes on where roles and rungs do not line up one-to-one:

- **SUBTITLE is a role, not a rung.** Secondary metadata renders at CAPTION, or at MICRO where space is genuinely tight. Do not go looking for a "subtitle size."
- **AMOUNT is a rung with no role name**, and it is mandatory: every money figure uses it, with tabular figures, even when the number is short. Never render money at BODY or COMPACT because it "looks better" — the money ladder is a fixed ruling, not a judgement call.
- **COMPACT and DISPLAY sit between the named roles.** Use them when matching an existing element that already uses them (top-bar titles, screen titles, hero-card codes); do not reach for them to escape a role you find too large or too small.

**Out of scope for this scale:** print sheets (`.pe-*`, `--print-type`) are a
physical medium with their own measured scale, and icon glyph sizes are not
text — neither is governed by the rungs above.

### Type rules

- No in-between sizes. If something feels too large step down one role; if too small step up one.
- Weight and color come with the role. Do not mix weights within a role; do not apply gold to text at a role where gold is not already used.
- Badges and single-digit indicators use MICRO (tight letter-spacing, bold). Never render a badge at BODY size — it shouts.
- Button labels: BODY for primary CTAs, CAPTION for secondary/outlined CTAs.
- Stacked metadata under a title steps down one size/weight per line (e.g. line 1 = SUBTITLE, line 2 = CAPTION-dim). Never render two stacked metadata lines at the same weight/size.
- Input text and placeholder text use BODY size; the placeholder is dimmer, not smaller.
- Money figures use AMOUNT with tabular figures, always. This is the one rung with no discretion attached to it.

---

## Color

The brand accent is gold. Dark theme is the default; light theme is a
first-class variant. All colors are referenced by semantic token name.

### Semantic color tokens

Never write a hex/rgba/hsl directly except inside the token definitions
themselves. Each theme maps these tokens to concrete values.

#### Surfaces (layered, back to front)

- **bg-base** — page/screen background. Deep warm near-black in dark theme; warm off-white / very light grey in light theme.
- **bg-raised** — cards, bubbles, sheets that sit on bg-base. A few steps lighter than bg-base in dark theme; white or near-white in light theme.
- **bg-elevated** — popovers, menus, toasts, dialogs floating above cards.
- **bg-pressed** — active/press fill on interactive surfaces.
- **bg-input** — text field / composer fill.

#### Text (four contrast tiers)

- **text-primary** — primary readable copy (near-white in dark theme, near-black in light).
- **text-secondary** — metadata, helpers, subtitles (muted grey-blue/grey).
- **text-tertiary** — captions, timestamps, placeholders, disabled labels (dim grey).
- **text-inverse** — text on filled accents (near-black on gold; near-white on dark fills).

#### Accents

- **accent-gold** — primary brand color (warm gold). Used for filled CTAs, active toggle fill, selected/on text, highlighted keywords, gold icon tiles. Not body text.
- **accent-gold-soft** — translucent gold for icon tile backgrounds, selected chip backgrounds, outlines on secondary CTAs, focus rings, pulse rings.
- **success** — green family. Saved states, success checks, complete badges, confirmation nudges.
- **warning** — amber/warm tone. Genuine cautions and attention states (delays, conflicts, required actions). Never decorative.
- **danger** — red family. Errors and destructive actions only.
- **info** — cool blue/cyan. Non-critical informational states.

#### Borders

- **border-subtle** — hairline dividers between sections (very low opacity white in dark, very low opacity dark in light).
- **border-default** — card outlines, input borders.
- **border-strong** — focused inputs, selected items, drag handles.

### How these tokens resolve today

Match these; never reach past them to a raw value.

- **Surfaces** — `bg-base` is the sky canvas + body (dark `#04070F` family, light warm off-white). `bg-raised` is `glass-panel` / `glass-bubble` via `var(--glass-solid-bg)` (dark `rgba(4,7,15,.92)`, light `rgba(255,255,255,.94)`). `bg-elevated` is the popover/toast family (`ca-arch-toast` `#111`, the net popover). `bg-input` is the composer's glass fill. `bg-pressed` is the `active:scale-95` + tint family.
- **Text** — primary is the default ink. Secondary is the `text-gray-400/500` + `dark:text-gray-300/400` ladder. Tertiary is `placeholder-gray-500` / `text-gray-500` / `white/45`. Inverse is near-black on gold (`text-black` on the `from-sia-goldlt to-sia-gold` fill).
- **Accents** — gold is `text-sia-gold` plus the gold CTA gradient; **light-mode gold *text* uses the measured `--sia-gold-ink`**, which is a different, darker value than the brand gold (see Themes → Two kinds of token). Gold-soft is `bg-sia-gold/10-15` + `border-sia-gold/30-60` + `rgba(201,162,39,.12-.16)`. Success is the emerald `ca-pill` ok family; danger is the red-600 family; warning and info appear only where a real state calls for them.
- **Borders** — subtle is `ca-hairline` / `rgba(127,127,127,.14-.18)`. Default is the black/10–white/10 card outline pair. Strong is the gold selection ring.
- **States** — hover compiles behind `(hover:hover)` via the Tailwind config's `hoverOnlyWhenSupported`; pressed is `active:scale-95`; focus is the `:focus-visible` gold ring.

### Color rules

- Gold is the leitmotif. Decorative color defaults to gold and neutral greys; success/warning/danger/info earn their place by meaning and must not be used decoratively.
- One bright accent at a time per surface. A card may combine gold + success (CTA + saved badge) but should not simultaneously light up in multiple bright hues unless each signals a real state.
- Gold-filled CTAs use text-inverse (dark text) — never white text on gold, never dark text on a soft translucent-gold fill, without first verifying contrast in both themes.
- Borders and dividers must be visible but quiet. If a divider competes with nearby text it is at the wrong tier.
- Icons inherit the parent element's text color token (text-secondary for muted icons, accent-gold for active icons, text-tertiary for dismiss controls at rest, text-inverse on gold-filled CTAs).
- Shadows follow elevation tiers (see Shape, Spacing & Elevation). Only gold-filled primary CTAs and toggled-on toggles carry a subtle gold glow.
- Gradients must already exist in the app. The primary CTA uses the established gold gradient (light gold → deeper gold top-to-bottom); do not invent new gradients, rainbow effects, or colored glows.

---

## Themes (Dark default + Light)

Dark theme is the default look and feel; light theme is a full peer. Every
element must work in both — never optimize only for dark.

### How a theme gets chosen

- **The theme is an explicit choice, never an inherited one.** A class on the root element marks dark; its absence means light. Do not add `prefers-color-scheme` media queries — the OS preference is deliberately ignored, and a media query would silently fight the in-app toggle, producing a theme nobody selected.
- **Dark is the fallback for every undefined state.** First run, unreadable storage, a corrupted or unexpected stored value — all of these land in dark. Only an explicit, recognised preference for light switches away. Write theme code so "unknown" resolves to dark rather than guessing or throwing.
- **The choice is persisted under one key and re-applied before first paint.** Any code that reads theme state during boot belongs in that same pre-paint pass; read it later and the user sees a flash of the wrong theme.
- **The flip is masked, so respect the mask.** Switching themes closes a full-height cover, swaps the class behind it, then opens again. Nothing may animate across that boundary: no transition longer than the cover, no element that re-measures itself mid-swap. If a component must recompute on theme change, do it while the cover is closed.
- **Browser chrome counts as theme surface.** The address-bar colour is currently a single fixed value, so it matches one theme and merely coexists with the other. Treat any change to it as a theme change, not a metadata tweak.

### Contrast targets

| Text tier     | Minimum contrast against surface | Notes                                           |
|---------------|----------------------------------|-------------------------------------------------|
| text-primary  | ~7:1 (strongly readable)         | Body text and larger in both themes             |
| text-secondary| ~4.5:1 (comfortable, not loud)   | Metadata and helper lines                       |
| text-tertiary | Legible at arm's length          | Placeholder, timestamps, disabled; must not disappear in either theme |
| text-inverse  | High contrast against gold fill  | Always dark text on gold; never light text on gold |
| Badges        | Readable on pill in both themes  | MICRO digits must not blend with pill background|

### Two kinds of token

This distinction matters more than any other rule in this section.

- **Theme-invariant tokens** are brand constants: one value, both themes. Gold fills, brand accents, decorative tints. Defined once, never overridden per theme.
- **Theme-responsive tokens** are redefined under the dark class. Anything that carries *text contrast* belongs here — ink tiers, surfaces, borders, placeholder greys, state colours, and any gold used as **text** rather than as fill.

A brand colour that is perfectly legible as a fill is often illegible as text on a pale background. When that happens the answer is a separate theme-responsive text token, not a tweak to the brand constant. Fills and icons keep the richer brand tone; text gets an ink tuned per theme to clear its contrast floor.

**The coincidence trap.** A theme-responsive token will sometimes resolve to exactly the same value as a brand constant in one theme. That is a coincidence of value, not of meaning. Do not alias them and do not "de-duplicate" them — the brand value is free to be retuned, while a text token is pinned by contrast. Collapse the two and a future brand tweak silently drags body text below its floor, with nothing in the system to catch it.

**Build on tokens, not raw values.** A raw colour written into a rule almost certainly breaks the opposite theme, because it cannot respond to the class. Raw values are legitimate in exactly two places: inside a token's own definition, and as the fallback argument of a token reference. Everywhere else, reference the token. When you touch a component that still carries raw values, convert them then — and verify the computed colour is unchanged in **both** themes before and after.

### Theme rules

- Surface tiers keep their order in both themes: a raised surface never reads as recessed, and no card ends up darker than its parent in light mode.
- Borders flip polarity: low-opacity white in dark, low-opacity dark/grey in light, resolved via border tokens rather than per-element overrides.
- Icons invert polarity: light desaturated grey-blue in dark theme, medium grey in light theme; gold icons stay gold but may use a slightly deeper gold tone in light theme where needed for contrast (token-handled, not per-element).
- Success / warning / danger tones read in both themes (not pastel-invisible in light, not neon-harsh in dark) — always use the token, never retune saturation per element.
- Placeholder grey is per-theme — a dark-theme placeholder grey is illegible on a near-white input; use text-tertiary.
- Shadows are stronger and more defined in light theme, where they carry most of the depth; in dark theme depth comes mostly from subtle edge lighting and very soft shadows. Use the surface-tier shadow token, not raw box-shadow values.
- Decorative ambients (starfields, background glows, twinkling particles) are a dark-theme treatment. In light theme the background is clean — warm off-white or a very soft neutral gradient. Decorations that need a dark backdrop do not persist into light mode, except subtle gold highlights on CTAs.
- Images and media must not assume a dark background — they must be transparent-aware or ship a light-theme variant that swaps with the theme class.
- Review every change in both themes before calling it done. A screenshot in dark only is not a review.

---

## Shape, Spacing & Elevation

### Spacing tokens

Spacing follows a fixed scale. Always copy spacing from an existing element
of the same role rather than hand-tuning.

- **gap-inline** — space between elements sitting side-by-side (icons, chips, button groups).
- **gap-stack-sm** — tight vertical gap between grouped/related items (stacked metadata lines, grouped messages from the same sender).
- **gap-stack-md** — standard vertical gap between sections inside a card, between header and content, between a chip row and the element above.
- **gap-stack-lg** — vertical gap between unrelated blocks (two separate cards, a card and the row below, greeting to first card).
- **pad-card** — internal padding of a standard card.
- **pad-compact** — internal padding of tighter surfaces (nudges, small banners, chips, badges).
- **inset-touch** — invisible padding around small icons so the hit area stays finger-sized while the visible glyph stays small.

### Radius tiers

Every surface uses exactly one of these. No in-between values.

- **radius-sm** — badges, pills, small chips → `rounded-md`.
- **radius-md** — segmented pieces and small inline buttons → `rounded-lg`; text inputs → `rounded-xl`.
- **radius-lg** — cards and glass panels → `rounded-2xl`; the largest hero bubbles → `rounded-3xl`. Primary CTAs are pills, not radius-lg — see radius-pill.
- **radius-pill** — fully rounded ends for CTAs and chips → `rounded-full`.
- **radius-full** — perfect circles (icon buttons, avatars, circular toggles) → also `rounded-full`; pill and circle share the utility — the shape comes from the element's proportions.

### Elevation / shadow tiers

Pick one tier; do not mix values.

- **elevate-none** — flat (dividers, text).
- **elevate-low** — chips, inputs, outlined buttons.
- **elevate-mid** — cards, bubbles, primary CTAs.
- **elevate-high** — popovers, dialogs, floating menus, toasts.
- **elevate-accent** — subtle gold glow reserved for gold-filled CTAs and toggled-on icon buttons.

### Shape/spacing/elevation rules

- Match before making — copy padding, margins, radius, and shadow from the closest existing element.
- No arbitrary numbers; never nudge by 1–3px "to look better".
- Padding is symmetric by default unless an asymmetric element (like a leading icon tile) creates optical weight.
- Margins stack in one direction (margin-top OR margin-bottom between blocks, never both) to avoid double-margin drift.
- Don't tighten or loosen padding to make content fit — shorten the copy instead.
- When copying an existing component, copy its radius along with it; the eye is extremely sensitive to slight radius mismatches between "the same" button rebuilt in two places.
- Border width follows border tokens. Never widen a border on a small element "to make it pop".
- Outlined buttons use border-default (gold); filled buttons use no visible border (gold gradient + shadow defines the edge). Don't mix.
- No colored glows outside the gold accent glow on gold CTAs and active toggles.

---

## Icons (Lucide)

### Icon system rules

- **Lucide icons only, everywhere** — no emoji, no custom SVGs, no other icon libraries, no Unicode arrows or bullets.
- Every glyph (category markers, header icons, CTA arrows, chip icons, status icons, composer icons) is a Lucide icon.
- Icon sizes follow a fixed scale:
  - **icon-sm** — inline with BODY/CAPTION text (labels, chips, timestamps).
  - **icon-md** — default for header icons, card icon tiles, standard buttons.
  - **icon-lg** — hero/onboarding illustrations and empty states (rare).
- Use Lucide's default stroke weight consistently across the app. Do not mix thin and bold stroke variants on the same screen.
- Icon color inherits from the parent element's text token (text-secondary for muted icons, accent-gold for active icons, text-tertiary for dismiss controls at rest, text-inverse on gold-filled CTAs). Do not hardcode an icon color without a token reason.
- Icon-to-text gap uses gap-inline. Don't custom-tune per button.
- When introducing a new glyph, verify the exact Lucide name exists and is semantically correct — don't substitute a "close enough" mismatched icon.
- Consult the Icon Reference table at the bottom of this document for canonical Lucide names for common UI jobs.

---

## Interaction States

Every interactive element (button, chip, row, toggle, icon button, list item,
tab, link, dismiss control) must define complete state treatments for both
desktop (mouse) and mobile (touch). Match state treatments from an existing
element of the same weight.

### State matrix (execution conditions → action → constraint)

| Condition (platform / state)      | Visual / behavioral action                                                            | Constraint                                                               |
|-----------------------------------|---------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| Desktop · rest                    | Element idle at base token values (fill, text, border).                               | Pointer cursor only on clickable things; default cursor on non-interactive. |
| Desktop · hover                   | Background tint toward accent-gold-soft OR text/icon shifts to gold OR 1–2px shadow lift. | Subtle — change at most 2 of (bg, color, shadow, border); do not change radius, size, or typography. Transition short and crisp. |
| Desktop · active (mouse down)     | Scale to ~0.96–0.98 OR slightly darker fill.                                          | Always a press-down, never a scale-up. Release animates back.            |
| Desktop · focus (keyboard)        | Visible accent-gold-soft focus ring (offset outline).                                 | Never remove focus outlines without an alternative; ring must have contrast in both themes. |
| Desktop · disabled                | Drop opacity, use text-tertiary / bg-pressed.                                         | No hover/click response; default cursor; press animation suppressed.     |
| Desktop · selected/on             | Stable gold fill or gold text + matching icon.                                        | Distinct from transient press; visually obvious "on" without a label.    |
| Mobile · rest                     | Element idle at base token values.                                                    | No hover.                                                                |
| Mobile · pressed (finger down)    | Scale ~0.96–0.98 OR slightly darker fill — same feel as desktop active.               | Minimum finger-sized hit area via inset-touch; scroll-vs-tap disambiguation. |
| Mobile · released                 | Return to rest OR transition to selected/on; fire the action.                         | Use hover media queries so hover state does not "stick" after release.   |
| Mobile · disabled                 | Drop opacity, no press feedback.                                                      | Suppress tap action and press animation; default cursor.                 |
| Mobile · selected/on              | Same as desktop — stable gold fill/text.                                              | Same visual as desktop selected; no platform-specific variant.           |
| Loading / in-progress             | Disable control, show inline spinner (`loader-2` or `loader-circle` from Lucide, animated) in label color family, swap label to in-progress text. | Suppress hover/press; cursor default/wait. Transition to success on completion. |
| Completion / success              | Swap icon to Lucide `check`, label to confirmation, fill turns success token if applicable. | Short transition; may show a slim confirmation nudge for batch actions.  |

### Interaction rules

- Hover is not a redesign — quick transitions, no heavy animation.
- Touch targets are at least finger-sized (~44×44px hit area) on mobile (use inset-touch padding around small glyphs).
- Keyboard focus rings appear on both desktop and mobile when a hardware keyboard is attached.
- Selected/on state is visually distinct from pressed: pressed is a transient animation; selected is a persistent visual.
- Disabled state desaturates, removes interactivity, and uses the same token values across all disabled elements.
- Long-press / right-click is optional (context menus, secondary actions); conventional ~400–500ms duration; must not conflict with scroll gestures.
- Scroll vs. tap disambiguation: a finger landing and immediately scrolling must not trigger press visuals or tap actions; only a stationary tap within the tap threshold fires press → release → action.
- Hover-only content (e.g. tooltips) must also be reachable by tap or long-press on mobile. If a piece of information is only visible on hover, it is not critical — or it needs a tap affordance.
- No stuck hover on mobile: after tap-release the element must return cleanly to rest or selected state.

---

## Motion

### Chat cadence

After every chat bubble (user or bot, including calculator and lookup cards) fully animates in, wait 250ms before showing another bubble or the typing indicator — the fast lane, default since v1.28.4 (`CHAT_FAST_GAP_MS`); the classic 500ms gap (`CHAT_GAP_MS`) is tour-only, locked in while `ca-tour-on` is set. Do not start typing until that gap has elapsed. Typing may be followed immediately by the next bot bubble once typing hides. Do not let the user send or press chat/chip/lookup buttons until on-screen bubbles have fully displayed.

### Duration scale

Reuse existing durations and easings; do not invent new ones per component.

- **motion-instant** — state swaps that should feel instantaneous (toggle color, disabled opacity).
- **motion-fast** — hover feedback, press scale, color transitions, border color changes (short and crisp).
- **motion-base** — standard entry, card expand/collapse, toast slide-in, toggle on/off, page transitions.
- **motion-slow** — large sheet/dialog openings, hero entrance motion.

### Motion rules

- Use the app's standard easings (spring or ease-out as established per element type); never add a new cubic-bezier.
- Spring/bounce motion is reserved for playful entry and selection (chip pop-in, bubble arrival, badge pop-in). It is not used for every press.
- Stagger delays use consistent small equal increments when several items appear together. Do not randomize per feature.
- No animation on a non-interactive element unless it serves a purpose (ambient starfield, pulse ring on an active toggle).
- Respect the user's reduced-motion preference: collapse entry motion to simple opacity fades; remove spring, pulse, parallax, and twinkle effects when reduced motion is requested.

### Reduced motion (v1.45.0)

The app honours `prefers-reduced-motion: reduce` **and** adds a binary Settings toggle — **Motion: Reduced · Full** (owner ruling 2026-10-15). One marker, `html.ca-reduced`, drives every reduction:

- `crewAssist.motion` = `'reduced'` forces the marker on, `'full'` forces it off, and a missing key follows the OS — the toggle never guts the OS-following default. Before any tap, the toggle simply mirrors the resolved state and says so.
- Entry animations collapse to one shared 150ms opacity fade (`ca-reduce-fade`); spring, pop, and slide keyframes do not run.
- Loops stop: pulses, floats, jumps, bounces, the tour glow, the badge soft-pulse, sky twinkle, and shooting stars. The sky paints one still frame and repaints it on resize; when motion returns, the loop restarts.
- Spinners stay — `ca-spin` and `animate-spin` encode progress, not decoration.
- Position transitions snap: chevrons, the switch knob, calendar nav, date cells, the fetch face, and every Tailwind `transition-transform` surface (sheets open instantly instead of gliding). Colour transitions are not motion and may stay.
- All rules are class-gated (`html.ca-reduced …`) in one copy in the `<style>` block — never a second `@media (prefers-reduced-motion)` variant; Tailwind overrides ride the `html .` specificity prefix as usual. The OS media query is read once in `applyMotionClass()`, which also listens for its `change` event.

---

## Copy & Language

### Voice

Calm, professional, concise. Match the tone of the product's industry and
audience. Avoid overly cutesy, marketing, or overly casual language unless
that is an explicit part of the brand voice.

### Casing rules

Establish and stick to a casing system. Recommended default for this app:

- Page/screen titles — Title Case.
- Card titles / section headers — pick one (Title Case or Sentence case) and use it consistently app-wide.
- Primary filled CTAs (gold) — UPPERCASE (e.g. SAVE, SET ALARM, SAVE ALL).
- Secondary/outlined and ghost buttons — Title Case.
- Inline text links — Sentence case.
- Chips — Sentence case.
- Metadata / timestamps — abbreviated consistently.

### Formatting rules

1. Status labels are concise adjectives or past participles (Ready, Saving, Saved, Set, Queued). Gerunds only for in-progress states.
2. Full sentences end with a period; short labels (buttons, chips, menu items) do not.
3. Use middle dots (·) between metadata pieces rather than hyphens or em dashes.
4. Ellipses only in placeholder text and loading indicators.
5. Time, date, and number formats must be consistent across the app (chosen format is applied universally — no mixing 12h and 24h, no alternating date orders).
6. Relative labels (Today, Tomorrow, "in Xh Ym") use the same abbreviation style everywhere.
7. New acronyms must show their expansion the first time a user sees them in a flow.
8. Never rephrase existing copy while working on something nearby. Copy changes are a separate, intentional act.

---

## UI Regression Rules

Hard-won constraints. Each one exists because breaking it shipped a visible
defect. Treat them as locks, not preferences — and never "simplify" one away
without evidence that its original cause is gone.

### DOM and CSS traps

**Sticky `:hover` on touch (v1.19.1, resolved v1.19.2).** A phone keeps `:hover` applied after a tap, and a desktop keeps it while the cursor rests on the element, so any `hover:` tint reads as "still gold after the tap". Wrapping it in `@media (hover: hover)` did NOT fix it (the owner's preview matched the query), so as of v1.19.2 the quick-action chips have **no hover tint whatsoever** - the default look is the only look. For any other tappable surface that needs hover feedback, prefer a transient `:active` press effect over `:hover`.

- **Do not** use `container.innerHTML += ...` for complex dynamic trees (menu loops). It re-parses the subtree, drops listeners, and yields `null` on mobile. Use `insertAdjacentHTML('beforeend', ...)` or `document.createElement`. Single `innerHTML = html` assignment for a freshly built string (rates editor) is OK.
- **Do not** restore `#menu-dropdown-row { overflow-x: auto }` — it clips overlay dropdowns.
- **Do not** re-apply global `tabular-nums` on `body` — it fought overlay type. `formatMoney` / compact amounts may use `tabular-nums` locally.
- Accordion clip (rates + print Edit): `grid-template-rows: 0fr` **plus** `overflow: hidden` on the fold **and** padding on a **grandchild**, not on `.dev-rate-fold-inner`. Padding on the `0fr` child leaks table headers on iOS (seen in 1.4.28).
- Chat lock: `html.chat-busy` disables send/chips/lookup until bubbles finish. Do **not** show `#btn-scroll-bottom` while typing. Do **not** add `opacity: 1 !important` under `html.chat-busy`.
- Overlay dropdowns (IFA/COP/menu) must be `position: absolute` glass over content, not a layout push. Date + time same height, no overlap; “Pick Date” one line.

### Design and copy locks


- Palette: SIA Navy `#0B1A3A`, Charcoal, SIA Gold `#C9A227`. Glass: `glass-bubble`, `glass-sheet`. Mobile-first iOS.
- Logo: transparent gold origami dart; inner fold opaque bronze; navy-key fuzz ≤8–10%. PWA `app-icon-*`: navy `#0B1A3A` + gold rim. Onboarding dart `w-48`, title `-mb-12`; header dart `w-10` `py-1.5`.
- Elegant type: weight / italic / navy — not extra sheet typefaces. No photos/icons/veg leaf/timeline through rings.
- Native dialogs only. Footer as specified. Caps only where listed.
- **Everything moves (owner ruling 2026-09-16, formalised 2026-09-26):** anything that appears, disappears, expands, collapses, scrolls or transitions is animated — fade, slide, scale — never an instant pop or jump. Existing overlays, sheets, dropdowns, chat bubbles and tour beats already obey; the rule was written down when the net-status popover initially shipped unanimated (fixed in v1.26.1); the earnings insights panel and the search clear button were the second catch (v1.27.0 — insights now expand/collapse via the `.ca-arch-insights` max-height+opacity transition like the month groups, the clear × fades via `opacity-0 pointer-events-none transition-opacity`). v1.27.1 lesson: when converting a `hidden`-toggled element to animation classes, grep EVERY code path that touches the element's classes — `renderArchInsights` still toggled `hidden` after the fill, so the panel stayed `display:none` and the first tap did nothing until an unrelated re-render. **jsdom is blind to this whole bug class**: the harness strips Tailwind, so `hidden` is inert in tests — assert the absence of `hidden` (not just the presence of the animation class) when a real device owns display via Tailwind.

### Scrolling behaviour


Calculator and flight/menu cards always open top-aligned and hold that position (re-asserted ~70ms apart for ~2s, with a scroll lock that suppresses automatic bottom-scrolls). Text bubbles use the taller-than-window → top, else bottom rule. The top-align animates `scrollTop` directly via rAF — do NOT revert to native `scrollTo({behavior:"smooth"})` for card top-align: iOS Safari cancels it mid-layout.

### UI approaches that have already failed — do not retry

- `innerHTML +=` on menu trees.
- Body-wide `tabular-nums`; `#menu-dropdown-row { overflow-x: auto }`.
- Deriving a scroll-to-row anchor from `getComputedStyle` padding (hotfix 9): the sign is engine-dependent — this Chromium anchors content BELOW the scroller's fixed padding, so subtracting it doubled the error (13px → 26px). Always measure `row.getBoundingClientRect().top − scroller.getBoundingClientRect().top` and add the delta to `scrollTop`.
- Measuring virtualized rows before `lucide.createIcons()` (hotfix 9): the placeholder `<i>` and its svg differ in size, so offsets go stale. Create icons first, then measure — and never rely on a re-measure happening (TLWindow's dedup early-return skips unchanged windows; store corrected offsets instead).
- Padding on a `0fr` accordion inner (iOS header leak).

---

## UI Pre-Delivery Checklist

Run this before calling any UI change done. The general, non-UI delivery
checks live in `STANDING_RULES.md`.

### Type, color, shape, spacing

5. Which typographic role does each piece of text use?
6. Which semantic color tokens (surface, text, accent, border, state) am I using?
7. Are there any new size, weight, spacing, radius, color, opacity, or shadow values that did not already exist in the UI? If yes, justify them or replace with an existing token.

### Theme

8. Is text-primary/text-secondary/text-tertiary readable in BOTH dark and light themes against its immediate surface?
9. Are badges, chips, and CTAs readable against their background in BOTH themes?
10. Do borders and dividers stay visible-but-quiet after polarity flip (dark ↔ light)?
11. Am I using tokens everywhere — zero hardcoded hex/rgba except inside token definitions?

### Interaction

12. Desktop: are rest/hover/active/focus/disabled/selected all defined and consistent with existing controls of the same weight?
13. Mobile: are rest/pressed/released/disabled/selected all defined, with no hover dependency and finger-sized hit targets?
14. Does the element return cleanly to rest/selected after tap-release (no stuck hover state on mobile)?
15. Is pointer cursor shown only on clickable elements, and is there a visible keyboard focus ring?

### Copy and code hygiene

16. Did I change any existing label, message, or placeholder that is unrelated to the request?
17. Are dead classes, orphaned listeners, commented-out code, or duplicate rules cleaned up?
18. Are new CSS/JS/HTML additions placed where they belong (CSS grouped with similar rules, JS near related handlers, HTML in document order)?


---

## Icon Reference (Lucide)

Canonical Lucide icon names for common UI jobs. Use these exact glyphs; do
not substitute semantically similar-but-different icons. Add to this list as
new patterns are established.

| Job / meaning                | Lucide name          |
|------------------------------|----------------------|
| Calculator modes (default · manual · advanced) | `sparkles`, `pen-line`, `sliders-horizontal` |
| Motion preference (Reduced · Full) | `circle-pause`, `orbit` |
| Help / tips / onboarding     | `lightbulb`          |
| Alarm / reminder / wake time | `alarm-clock`        |
| Add / set / create           | `plus`               |
| Menu / food / meals          | `utensils`           |
| Meal / sandwich / layover meal | `sandwich`         |
| Calculator / math / allowance | `calculator`        |
| Earnings / wallet / pay      | `wallet`, `piggy-bank` |
| Map / overview               | `map`                |
| Calendar / roster            | `calendar-days`      |
| Travel / transport / flight  | `plane`              |
| Save / download / offline    | `download`           |
| Success / saved / checkmark  | `check`, `check-circle` |
| Tag / label / overlay        | `tag`                |
| Camera / screenshot / share  | `camera`             |
| Attachment / paperclip       | `paperclip`          |
| Send / submit                | `send`               |
| Navigation / collapse chevrons | `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down` |
| Dismiss / close              | `x`                  |
| Trailing CTA arrow           | `arrow-right`        |
| More options                 | `more-horizontal`, `more-vertical` |
| Read receipts                | `check` (single tick), `check-check` (double tick) |
| Clock / time / standby       | `clock`              |
| Blocked / off / unavailable  | `circle-slash`, `ban`|
| Loading spinner              | `loader-2`, `loader-circle` |
| Info                         | `info`               |
| Warning / alert              | `alert-triangle`     |
| Back / previous              | `chevron-left`, `arrow-left` |
| Forward / next               | `chevron-right`, `arrow-right` |
| Search                       | `search`             |
| Settings                     | `settings`           |
| User / profile               | `user`               |
| Home                         | `home`               |
| Bell / notifications         | `bell`               |
| Star / favorite              | `star`               |
| Edit / pencil                | `pen-line`, `pencil-line`, `square-pen` |
| Delete / trash               | `trash-2`            |
| Refresh / reload             | `refresh-cw`         |
| Share                        | `share-2`            |
| Cloud / offline storage      | `cloud`, `cloud-off` |
| Wifi / connection            | `wifi`, `wifi-off`   |
| Battery                      | `battery-full` etc.  |
| Signal                       | `signal`             |
| Print / print sheet           | `printer`            |
| Saved menus / reading         | `book-open`          |
| History / recent              | `history`            |
| Trend up / down               | `trending-up`, `trending-down` |
| Theme toggle                  | `moon`, `sun`        |
| Reset / retry                 | `rotate-cw`, `rotate-ccw` |
| Save to archive               | `save`               |
| Export / import               | `upload`, `file-down` |
| No results                    | `search-x`           |
| Play / start tour             | `play`               |
| Developer tools               | `terminal`, `bug`, `wrench` |
| Sort / reorder                | `arrow-up-wide-narrow`, `arrow-down-wide-narrow`, `arrow-up`, `arrow-down` |
| Advanced filters              | `sliders-horizontal` |
| Celebration (new month)       | `party-popper`       |
| Duty toggles (Direct US / Paxing / Shuttle) | `flag`, `armchair`, `repeat` |
| Backup / restore              | `hard-drive-download` |
| Best month                    | `trophy`             |
| Projection / goal             | `target`             |
| Compare vs last year          | `git-compare-arrows` |
| Menu category pills (drinks / snacks) | `glass-water`, `cookie` |
| Region / worldwide            | `globe`              |
| Clear / erase                 | `eraser`             |
| New-item chip                 | `sparkles`           |
