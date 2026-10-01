// Developer-mode UI: the Save/Export/Import footer anatomy, the Data Management
// pills (gold Reset above red Clear All Data) and the 10-tap dev-mode reveal.
const H = require('./_harness');
const { R, boot, wait, APP } = H;

const mkUntil = (d) => async (cond, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 10000)) {
        let ok = false;
        try { ok = (typeof cond === 'string') ? !!d.querySelector(cond) : !!cond(); } catch (e) { ok = false; }
        if (ok) return true;
        await wait(100);
    }
    return false;
};
(async () => {
  const { w, d } = await boot(APP);
  const card = d.getElementById('settings-developer');
  const exp = d.getElementById('btn-dev-export');
  const imp = d.getElementById('btn-dev-import');

  // footer: two equal one-line buttons matching the Save button's language
  R.ok(exp && exp.className.includes('flex-1') && exp.className.includes('items-center') && !exp.className.includes('flex-col'), 'Export: equal-width one-line button');
  R.ok(imp && imp.className.includes('flex-1') && imp.className.includes('items-center') && !imp.className.includes('flex-col'), 'Import: equal-width one-line button');
  R.eq(exp.querySelector('i').getAttribute('data-lucide'), 'download', 'Export icon is download');
  R.eq(imp.querySelector('i').getAttribute('data-lucide'), 'upload', 'Import icon is upload');
  R.eq(exp.textContent.trim(), 'Export', 'Export label visible');
  R.ok(d.getElementById('btn-dev-save'), 'Save button still present');
  R.ok(!card.contains(d.getElementById('btn-dev-reset')), 'Reset no longer inside dev rates card');
  R.ok(imp.contains(d.getElementById('dev-file-import')), 'file input stays inside Import button');

  // Data Management: gold Reset above red Clear All Data, dev-gated
  const reset = d.getElementById('btn-dev-reset');
  const clear = d.getElementById('btn-clear-data');
  R.ok(reset.classList.contains('hidden'), 'Reset hidden when dev mode off');
  R.ok(reset.className.includes('text-sia-gold') && reset.className.includes('border-sia-gold'), 'Reset: gold text + gold border');
  R.ok(clear.className.includes('text-red-600') && clear.className.includes('border-red-500'), 'Clear All Data: red text + red border');
  R.ok(clear.className.includes('bg-transparent'), 'Clear All Data: transparent background');
  const order = Array.from(d.querySelectorAll('#btn-dev-reset, #btn-clear-data')).map((el) => el.id);
  R.eq(order.join(','), 'btn-dev-reset,btn-clear-data', 'Reset sits above Clear All Data');

  // the real 10-tap path reveals both the section and the pill
  for (let i = 0; i < 10; i++) d.getElementById('header-brand').click();
  await wait(50);
  R.ok(!reset.classList.contains('hidden'), '10 taps reveal Reset pill');
  R.ok(!card.classList.contains('hidden'), '10 taps reveal dev section');

  // v1.29.0: two-tap clear-chat + calculator Enter-advance + keypad coverage
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourOffered', '1');
      x.localStorage.setItem('crewAssist.tourDone', '1');
    } });
    await wait(3500); // fast lane: greeting settles
    const resetBtn = d.getElementById('btn-reset');
    const firstBubble = d.getElementById('chat-container').firstElementChild;
    resetBtn.click();
    await wait(100);
    R.ok(resetBtn.classList.contains('ca-twotap-armed'), 'first clear-chat tap arms red, nothing cleared');
    R.ok(firstBubble && firstBubble.isConnected, 'the conversation survives the first tap');
    resetBtn.click();
    await wait(3000);
    R.ok(!firstBubble.isConnected, 'the second tap clears the chat');
    R.ok(/, FS Test!/.test(d.getElementById('chat-container').textContent), 'and the greeting re-types');

    // Enter hops to the next calculator field; every text field has a keypad
    w.renderCalculatorCard('both');
    await wait(120);
    const card = d.querySelector('[data-calc-card]');
    R.ok(!!card, 'calculator card renders');
    const fields = Array.from(card.querySelectorAll('input.ui-input')).filter((i) => i.type === 'text');
    R.ok(fields.length >= 2, 'card has text fields');
    R.ok(fields.every((i) => /iata/.test(i.id) || i.getAttribute('inputmode')), 'every numeric calculator field summons a keypad; station-code fields are letters');
    const first = fields[0];
    first.focus();
    first.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(50);
    R.ok(d.activeElement === fields[1], 'Enter advances to the next field');
    void d;
  }

  // v1.31.0: the UX-review release — labelled pill, aria, type floor, ink, hit areas
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(!/text-\[(9|9\.5|10|11)px\]/.test(src), 'nothing renders below the 11px type floor');
    R.ok(src.includes('.ca-micro { font-size: 11px; }'), 'the micro tier is one token');
    R.ok(src.includes('--sia-gold-ink: #7d650f') && src.includes('html:not(.dark) .text-sia-gold'), 'light-mode gold text uses the measured ink');
    R.ok(src.includes('min-w-[88px]') && src.includes("actionText = { save: 'Save', check: 'Saved'"), 'the save action is a labelled pill');
    R.ok(src.includes('.ca-hit::after'), 'invisible hit-area growth exists');
    R.ok(src.includes('px-4 py-3.5 min-h-[48px] text-xs font-bold whitespace-nowrap'), 'quick-action chips reach the 48px standard');
    R.ok(src.includes("div.setAttribute('aria-hidden', 'true');"), 'the typing dots stay quiet for screen readers');
    R.eq(d.getElementById('chat-container').getAttribute('role'), 'log', 'the chat is a live log');
    R.eq(d.getElementById('chat-container').getAttribute('aria-live'), 'polite', 'bot narration is announced politely');
    R.eq(d.getElementById('results-sheet').getAttribute('role'), 'dialog', 'the summary sheet is a dialog');
    R.eq(d.getElementById('settings-sheet').getAttribute('aria-modal'), 'true', 'settings reads as modal');
    // the pill keeps its shape across states (owner ruling)
    w.eval('setResultsAction("save", false)');
    const ab = d.getElementById('btn-results-action');
    R.ok(ab.textContent === 'Save' && ab.className.indexOf('min-w-[88px]') !== -1, 'save state reads Save');
    w.eval('setResultsAction("check", false)');
    R.ok(ab.textContent === 'Saved' && ab.className.indexOf('min-w-[88px]') !== -1, 'saved state reads Saved — same footprint');
    // the tour is one Settings tap away
    d.getElementById('btn-settings').click();
    await wait(150);
    const rp = d.getElementById('btn-replay-tour');
    R.ok(rp && rp.textContent.indexOf('Replay') !== -1, 'Settings offers the feature tour replay');
    rp.click();
    R.ok(w.caTour.on === true, 'replay starts the tour');
    w.eval('finishCaTour(true)');
    await wait(150);
    R.ok(w.caTour.on === false, 'the replayed tour ends cleanly');
    void d;
  }

  // v1.31.1: fixes from the owner's device pass
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    // the calculator interface selector follows the chosen mode (the Default
    // pill was missing its id, so it never un-selected)
    w.eval('setCalcUiMode("manual")');
    await wait(60);
    const dPill = d.getElementById('calcui-pill-default');
    const mPill = d.getElementById('calcui-pill-manual');
    R.ok(dPill && !dPill.classList.contains('bg-sia-gold') && dPill.getAttribute('aria-checked') === 'false', 'Default un-selects when Manual is chosen');
    R.ok(mPill && mPill.classList.contains('bg-sia-gold') && mPill.getAttribute('aria-checked') === 'true', 'Manual takes the selection');
    w.eval('setCalcUiMode("default")');
    await wait(60);
    R.ok(dPill.classList.contains('bg-sia-gold') && dPill.getAttribute('aria-checked') === 'true', 'Default re-selects on return');
    // toasts: gold border always, bright pill in dark mode
    R.ok(src.includes('border: 1.5px solid #d4af37'), 'every toast carries a gold border');
    R.ok(src.includes('.dark .ca-arch-toast { background: #f6f1e8; color: #171d2b; }'), 'dark mode toasts invert to a bright pill');
    R.ok(src.includes('.ca-arch-toast .ca-toast-undo'), 'the Undo action keeps a readable gold in both themes');
    void d;
  }

  // v1.31.2: the pinned totals bar can never clip its own text again
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('.ca-roster-sticky.ca-on { max-height: 96px; opacity: 1; padding: 9px 24px; }'), 'the height cap carries generous headroom');
    R.ok(/\.ca-roster-sticky \{[^}]*line-height: 1\.2;/.test(src), 'the bar pins its line-height against font-metric surprises');
    void d;
  }

  // ---- v1.32.0: the owner's eight-item review batch ----
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    const { w, d } = await boot(APP);
    // E3: keyboards get a gold focus ring; thumbs never see it
    R.ok(src.includes(':focus-visible:not(input):not(textarea):not(select) { outline: 2px solid var(--sia-gold-ink, #7d650f); outline-offset: 2px; }'), 'focus-visible paints a gold ring on every control (E3)');
    // E4: the earnings chip is second, Print the menu last — both most-used
    // actions on-screen at once on a 360px phone
    const chips = d.querySelectorAll('.action-chip');
    R.eq(chips.length, 4, 'four quick action chips');
    R.eq(chips[1].getAttribute('data-intent'), 'earn', 'the earnings chip sits second (E4)');
    R.eq(chips[2].getAttribute('data-intent'), 'menu', 'What\'s being served? is third (E4)');
    R.eq(chips[3].getAttribute('data-intent'), 'print', 'Print the menu is last (E4)');
    // E5: the money type ladder
    R.ok(src.includes('.ca-amt { font-variant-numeric: tabular-nums; }'), 'the money ladder sets tabular digits (E5)');
    R.ok(!src.includes('text-[34px]'), 'the gold-card total joins the heroes at 36px (E5)');
    R.ok(src.includes('<p class="text-4xl font-bold ca-amt">'), 'hero money sets tabular digits (E5)');
    R.ok(src.includes('<span class="shrink-0 text-sm text-sia-gold ca-amt">'), 'review money steps up from micro to body size (E5)');
    R.ok(src.includes('<span class="font-bold text-[17px] ca-amt text-sia-gold">'), 'breakdown totals sit on the amount rung (E5)');
    // E5 (v1.32.1): LMA breakdown figures match IFA body size
    R.ok(src.includes('<span class="ml-2 text-sm font-bold ca-amt text-gray-800 dark:text-gray-200">'), 'LMA day-cost figures step up to IFA body size (E5, v1.32.1)');
    R.ok(src.includes('<span class="text-sia-gold ca-amt text-sm">'), 'LMA meal figures step up to IFA body size (E5, v1.32.1)');
    // E6 (v1.35.0, owner ruling): the versioned APP_CHANGELOG drives both the
    // What's New delta and the Settings changelog. The CURRENT release's
    // pointers stay one sentence of at most twelve words; versions run
    // strictly descending, newest first; the delta machinery tracks what the
    // crew has seen (crewAssist.wnSeen) so no release replays.
    const appVer = (src.match(/(?:const|var) APP_VERSION = '([^']+)';/) || [])[1];
    const clMatch = src.match(/const APP_CHANGELOG = \[([\s\S]*?)\n\s*\];/);
    R.ok(!!clMatch, 'the changelog parses as a list (E6)');
    if (clMatch) {
      const entries = [...clMatch[1].matchAll(/v:\s*'([^']+)',\s*items:\s*\[([\s\S]*?)\]/g)].map((m) => ({ v: m[1], items: [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]) }));
      R.ok(entries.length >= 60, `the changelog covers every version since inception (${entries.length} entries) (E6)`);
      R.eq(entries[0].v, appVer, 'the newest changelog entry is the current release (E6)');
      for (let i = 1; i < entries.length; i++) {
        const [a, b] = [entries[i - 1].v, entries[i].v].map((v2) => v2.split('.').map(Number));
        const descending = (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
        R.ok(descending > 0, `changelog versions run strictly descending: v${entries[i - 1].v} then v${entries[i].v} (E6)`);
      }
      R.ok(entries[0].items.length >= 1, 'the current release carries at least one pointer (E6)');
      entries[0].items.forEach((line) => {
        R.ok(line.indexOf('. ') === -1 && /[.!?]$/.test(line), `current-release pointer is one sentence: "${line}" (E6)`);
        R.ok(line.split(/\s+/).length <= 12, `current-release pointer stays within twelve words: "${line}" (E6)`);
      });
    }
    // the delta machinery + the scrollable, headered list (owner spec)
    R.ok(src.includes('function wnPendingEntries') && src.includes("localStorage.getItem('crewAssist.wnSeen')"), "what's new tracks the version the crew last saw (E6)");
    R.ok(src.includes('function wnSeenVersion') && src.includes('APP_CHANGELOG[1] && APP_CHANGELOG[1].v'), 'a pre-changelog device defaults to the release before current (E6)');
    R.ok(/id="whatsnew-list"[^>]*max-h-\[50vh\] overflow-y-auto/.test(src), "the what's-new list scrolls when a big jump brings many versions (E6)");
    R.ok(src.includes('function renderChangelogInto'), 'one renderer draws both the delta and the changelog overlay (E6)');
    R.ok(src.includes('id="ca-changelog-sheet"') && src.includes('id="btn-changelog"'), 'Settings opens the full changelog overlay (E6)');
    // ---- v1.33.0: the review batch (contrast, targets, SR, CSV, hints) ----
    R.ok(src.includes('ui-input text-gray-600 ob-gender-btn'), 'unselected onboarding buttons read at gray-600 (was 2.26:1)');
    R.ok(src.includes("sr.className = 'sr-only'; sr.textContent = ' "), 'undo toasts speak their deadline to screen readers');
    R.ok(src.includes('.ca-arch-iconbtn { width: 48px; height: 48px;'), 'archive icon buttons are 48px');
    R.ok(src.split('px-4 py-3.5 min-h-[48px] text-xs').length === 5, 'all four quick chips are min-48px tall');
    R.ok(src.includes('class="p-3.5 rounded-full'), 'header and sheet close buttons are 48px');
    R.ok(src.includes('ca-hit w-10 h-10'), 'send / roster / scroll buttons grow past 48px effective');
    R.ok(src.includes('ca-arch-del ca-hit p-3'), 'archive entry delete is a 50px effective target');
    R.ok((src.match(/<label class="flex items-center justify-between gap-3 w-full cursor-pointer">/g) || []).length === 3, 'all three switches make their text part of the tap target');
    R.ok(src.includes('html:not(.dark) .ca-micro.text-gray-500 { color: #4b5563; }'), 'light-theme micro labels step up to gray-600');
    R.ok(src.split('text-xs font-bold text-gray-500 ca-inset p-2 rounded-xl mt-1 mb-1').length === 3, 'the B/L/D strip reads at 12px in both render paths');
    R.ok(src.includes('CA_CHAT_PLACEHOLDERS') && src.includes('How much is my allowance?'), 'the chat input rotates three example asks');
    R.ok(src.includes("'crewAssist.ratesUpdatedAt'"), 'rates record when they were last edited');
    R.ok(src.includes('function rosterResultsCsv'), 'the combined summary serialises as CSV');
    R.ok(src.includes('id="btn-results-csv"'), 'the CSV button lives in the results header');
    R.ok(src.includes('function paintIfaTimeHints'), 'sectors without a flight time explain themselves');
    R.ok(src.includes('Offline — type the flight time from your roster'), 'the offline hint teaches the manual way out');
    R.ok(src.includes('if (bound % 15 === 0)'), 'bulk builds paint icons every 15 cards');
    R.ok(src.includes('const monthOf = (r) =>'), 'combined summaries group by month');
    R.ok(src.includes("doesn't look like a Crew Roster Report"), 'a flightless PDF is told it is not a roster');
    // ---- v1.33.1: light-mode surfaces + arrival-time next-flight ----
    R.ok(src.includes('html:not(.dark) #onboarding-view .ui-input'), 'onboarding fields get a light-mode surface and border');
    R.ok(src.includes('html:not(.dark) #whatsnew-backdrop .glass-bubble'), 'the What\u2019s New bubble gets a light-mode surface');
    R.ok((src.match(/text-sia-navy\/70 dark:text-white\/15/g) || []).length === 2, 'the tagline and semver step up from navy/20 (1.4:1) to navy/70');
    R.ok(src.includes('placeholder-gray-600 dark:placeholder-gray-400'), 'the onboarding name placeholder reads at gray-600 in daylight');
    R.ok(src.includes('whatsnew-close" class="absolute top-3 right-3 p-3.5'), 'the What\u2019s New close button joins the 48px standard');
    R.ok(src.includes('sta: f.staHm'), 'roster imports record each flight\u2019s arrival time');
    R.ok(src.includes('function nextFlightExpirySweep'), 'a sweep retires landed flights from the card');
    R.ok(src.includes('setInterval(caRealtimeSweep, 60000)'), 'the sweep runs every minute while the app is open');
    R.ok(src.includes("document.addEventListener('visibilitychange', () => { if (!document.hidden) caRealtimeSweep(); })"), 'returning to the screen triggers an immediate sweep');
    R.ok(src.includes('lands ' + "' + rosterEsc(f.sta)"), 'a leg in the air shows its landing time');
    // ---- v1.33.2: the earnings schedule model follows landings ----
    R.ok(src.includes("cardRoot.setAttribute('data-duty-end'"), 'roster-built cards carry their duty landing');
    R.ok(src.includes('rec.endAt = dutyEnd'), 'save payloads record the duty landing time');
    R.ok(src.includes('function archEntryLanded'), 'a duty counts as flown once it has landed');
    R.ok(src.includes('function archLandedSweep'), 'the earnings sheet sweeps for landings');
    R.ok(src.includes('const caRealtimeSweep = () => { nextFlightExpirySweep(); archLandedSweep(); };'), 'both real-time tracks share one sweep cadence');
    // M1: surface tokens replaced the hand-mixed pairs everywhere
    R.ok(src.includes('--ca-surface-1: var(--glass-bg)') && src.includes('--ca-surface-2:') && src.includes('--ca-hairline:'), 'surface tokens are defined for both themes (M1)');
    R.ok(src.includes('.ca-inset { background-color: var(--ca-surface-2); }'), 'the inset token class exists (M1)');
    R.ok(src.split('bg-black/5 dark:bg-white/5').length === 1, 'no hand-mixed inset pairs remain (M1)');
    R.ok(src.split('border-black/5 dark:border-white/5').length === 1, 'no hand-mixed hairline pairs remain (M1)');
    // M3: sheets keep their modal promise — focus enters, Tab loops, focus returns
    d.getElementById('btn-settings').focus();
    w.eval('openSettings()');
    const sh = d.getElementById('settings-sheet');
    R.ok(d.activeElement === sh, 'opening a sheet moves focus into it (M3)');
    const fSel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(sh.querySelectorAll(fSel)).filter((el) => !el.disabled && !el.closest('.hidden'));
    R.ok(focusables.length > 1, 'the settings sheet offers keyboard controls');
    focusables[focusables.length - 1].focus();
    focusables[focusables.length - 1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    R.ok(d.activeElement === focusables[0], 'Tab wraps from the last control back to the first (M3)');
    focusables[0].focus();
    focusables[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, shiftKey: true }));
    R.ok(d.activeElement === focusables[focusables.length - 1], 'Shift+Tab wraps from the first control to the last (M3)');
    w.eval('closeSettings()');
    R.ok(d.activeElement === d.getElementById('btn-settings'), 'closing returns focus to the opener (M3)');
    R.ok(src.includes('caSheetFocusIn(sheet);') && src.includes('caSheetFocusOut(sheet);') && src.includes('caSheetFocusIn(s);') && src.includes('caSheetFocusOut(s);') && src.includes("caSheetFocusIn(archEl('ca-arch-sub-sheet'));"), 'all four sheets wire the focus trap (M3)');
    void w;
  }

  // --- v1.35.0: what's-new delta + the Settings changelog ---
  {
    // fresh stamp (returning device, no wnSeen): the delta is exactly the current release
    const a = await boot(APP, { keepWhatsNew: true, seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    const aUntil = mkUntil(a.d);
    R.ok(await aUntil(() => !a.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 5000), "a fresh device sees the what's-new sheet");
    await aUntil(() => (a.d.getElementById('whatsnew-list') || {}).childElementCount > 0, 3000);
    const heads = a.d.querySelectorAll('#whatsnew-list .ca-micro');
    R.eq(heads.length, 1, 'a device without a stamp sees only the current release (the pre-changelog default)');
    R.ok((heads[0].textContent || '').includes(a.w.APP_VERSION), 'the header names the current version');
    R.eq(a.w.localStorage.getItem('crewAssist.wnSeen'), null, 'merely opening the sheet never stamps it seen');
    a.d.getElementById('whatsnew-close').click();
    await aUntil(() => a.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 3000);
    a.w.eval('maybeWhatsNewOverlay()');
    await a.w.eval('new Promise((r) => requestAnimationFrame(r))');
    R.ok(!a.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'the sheet returns on the next launch until "Do not show again" is tapped (v1.35.0 hotfix)');
  }
  {
    // a device last seen on 1.29.0: the delta spans every version since
    const b = await boot(APP, { keepWhatsNew: true, seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', '1.29.0');
    } });
    const bUntil = mkUntil(b.d);
    R.ok(await bUntil(() => !b.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 5000), 'the sheet opens for a big version jump');
    await bUntil(() => (b.d.getElementById('whatsnew-list') || {}).childElementCount > 10, 3000);
    const heads = [...b.d.querySelectorAll('#whatsnew-list .ca-micro')].map((h) => h.textContent);
    R.ok(heads.length >= 17, `a 1.29.0 device sees every version since (${heads.length} headers)`);
    R.ok(heads[0].includes(b.w.APP_VERSION) && heads[heads.length - 1].includes('1.29.1'), 'the delta runs newest first down to the first missed release');
    const listEl = b.d.getElementById('whatsnew-list');
    R.ok(listEl.className.includes('max-h-[50vh]') && listEl.className.includes('overflow-y-auto'), 'the long list is scrollable');
    // "Do not show again" is the ONLY thing that dismisses it for good
    b.d.getElementById('whatsnew-hide').checked = true;
    b.d.getElementById('whatsnew-close').click();
    await bUntil(() => b.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 3000);
    R.eq(b.w.localStorage.getItem('crewAssist.hideWhatsNew'), b.w.APP_VERSION, 'the checkbox writes the per-version hide stamp');
    R.eq(b.w.localStorage.getItem('crewAssist.wnSeen'), b.w.APP_VERSION, 'the checkbox is the only thing that stamps the seen version');
    b.w.eval('maybeWhatsNewOverlay()');
    await b.w.eval('new Promise((r) => requestAnimationFrame(r))');
    R.ok(b.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'a ticked dismissal keeps the sheet away');
  }
  {
    // up-to-date device: no sheet at all
    const c = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
    } });
    const cUntil = mkUntil(c.d);
    await cUntil(() => !c.d.getElementById('main-view') || true, 100);
    R.ok(c.d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'an up-to-date device sees no sheet');
    R.eq(String(c.w.eval('wnPendingEntries().length')), '0', 'the delta is empty on the current version');
    // the Settings changelog: every version since inception
    c.w.eval('openSettings()');
    await cUntil(() => !c.d.getElementById('settings-backdrop').classList.contains('hidden'), 3000);
    c.d.getElementById('btn-changelog').click();
    await cUntil(() => !c.d.getElementById('ca-changelog-sheet').classList.contains('hidden'), 3000);
    await cUntil(() => (c.d.getElementById('ca-changelog-list') || {}).childElementCount > 50, 3000);
    const clHeads = [...c.d.querySelectorAll('#ca-changelog-list .ca-micro')].map((h) => h.textContent);
    R.ok(clHeads.length >= 60, `the changelog lists every version (${clHeads.length} headers)`);
    R.ok(clHeads[0].includes(c.w.APP_VERSION), 'the changelog opens on the current version');
    R.ok(clHeads[clHeads.length - 1].includes('1.5.9'), 'the changelog reaches back to the first signed-off release');
    R.ok((c.d.getElementById('ca-changelog-cur') || {}).textContent === c.w.APP_VERSION, 'the changelog names the running version');
    c.d.getElementById('ca-changelog-close').click();
    await cUntil(() => c.d.getElementById('ca-changelog-backdrop').classList.contains('hidden'), 3000);
  }

  process.exit(R.done() ? 1 : 0);
})();
