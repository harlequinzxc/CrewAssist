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

  // footer (v1.41.0): Export is the single one-line secondary — the rates
  // import folded into Settings → Restore backup (one import door).
  R.ok(exp && exp.className.includes('w-full') && exp.className.includes('items-center') && !exp.className.includes('flex-col'), 'Export: full-width one-line button');
  R.ok(exp.className.includes('text-sia-gold') && exp.className.includes('border-sia-gold'), 'hotfix: Export rates.json runs the Export-backup gold');
  R.eq(exp.querySelector('i').getAttribute('data-lucide'), 'download', 'Export icon is download');
  R.eq(exp.textContent.trim(), 'Export rates.json', 'hotfix: the Export label names its file');
  R.ok(!d.getElementById('btn-dev-import'), 'the dev Import button is gone (v1.41.0)');
  R.ok(!d.getElementById('dev-file-import'), 'its file input went with it');
  const save = d.getElementById('btn-dev-save');
  R.ok(save && save.className.includes('h-[42px]') && save.className.includes('border-sia-gold') && !save.className.includes('bg-gradient'), 'v1.42.0: Save rates wears the Data Management uniform (h-[42px] gold outline)');
  R.ok(card.contains(d.getElementById('btn-dev-reset')), 'v1.42.0: Reset rates to default moved into the dev card');
  const devOrder = Array.from(card.querySelectorAll('#btn-dev-save, #btn-dev-export, #btn-dev-reset')).map((el) => el.id);
  R.eq(devOrder.join(','), 'btn-dev-save,btn-dev-export,btn-dev-reset', 'hotfix: Save, then Export rates.json, then Reset last');

  // Data Management (v1.41.0): Export backup (gold) + Restore backup (the one
  // import door, file input inside) above the dev-gated Reset and red Clear.
  const bex = d.getElementById('btn-backup-export');
  const bres = d.getElementById('btn-backup-restore');
  R.ok(bex && bex.className.includes('text-sia-gold') && bex.className.includes('border-sia-gold'), 'Export backup: gold text + gold border');
  R.eq(bex.querySelector('i').getAttribute('data-lucide'), 'download', 'Export backup icon is download');
  R.eq(bex.textContent.trim(), 'Export backup', 'Export backup label visible');
  R.ok(bres && bres.className.includes('relative') && bres.className.includes('overflow-hidden'), 'Restore backup: a pill that can hold its file input');
  R.eq(bres.querySelector('i').getAttribute('data-lucide'), 'upload', 'Restore backup icon is upload');
  R.ok(bres.contains(d.getElementById('backup-file-restore')), 'the restore file input sits inside the button');
  R.eq(d.getElementById('backup-file-restore').getAttribute('accept'), '.json,.txt,application/json,text/plain', 'the restore picker accepts .txt twins (Android round-trip)');
  const reset = d.getElementById('btn-dev-reset');
  const clear = d.getElementById('btn-clear-data');
  R.ok(reset.classList.contains('hidden'), 'Reset hidden when dev mode off');
  R.ok(reset.className.includes('text-[color:var(--ca-danger-strong)]') && reset.className.includes('border-[color:var(--ca-danger-strong-line)]'), 'hotfix: Reset runs the red destructive style (rides --ca-danger-strong since round 3 value 2)');
  R.ok(clear.className.includes('text-[color:var(--ca-danger-strong)]') && clear.className.includes('border-[color:var(--ca-danger-strong-line)]'), 'Clear All Data: red text + red border (rides --ca-danger-strong since round 3 value 2)');
  R.ok(clear.className.includes('bg-transparent'), 'Clear All Data: transparent background');
  R.ok(bex.parentElement.className.includes('glass-panel'), 'v1.42.0: Data Management buttons sit in the house box — the same width as Clear saved menus');
  R.ok(!bex.parentElement.contains(reset), 'Reset left Data Management for the dev card (v1.42.0)');
  const order = Array.from(d.querySelectorAll('#btn-backup-export, #btn-backup-restore, #btn-clear-data')).map((el) => el.id);
  R.eq(order.join(','), 'btn-backup-export,btn-backup-restore,btn-clear-data', 'backup doors sit above Clear All Data');

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

  // v1.40.0 hotfix: onboarding asks for the date of first solo
  {
    const { w, d } = await boot(APP); // no profile seeded: first-run onboarding shows
    const ob = (id) => d.getElementById(id);
    const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
    const rankFolded = () => ob('ob-rank-container').classList.contains('opacity-0');

    R.ok(!!ob('ob-solo'), 'the first-solo field renders');
    R.eq(ob('ob-solo').getAttribute('inputmode'), 'numeric', 'the date field summons the numeric keypad');
    R.eq(ob('ob-solo').placeholder, 'DD/MM/YYYY', 'the placeholder teaches DD/MM/YYYY');
    R.ok(ob('ob-solo').parentElement.parentElement.querySelector('label').textContent === 'Date of First Solo', 'the label reads Date of First Solo (v1.40.1 title case)');
    {
      const fsMod = require('fs'); const appSrc = fsMod.readFileSync(APP, 'utf8');
      R.ok(appSrc.includes('<div class="space-y-4 flex-grow">'), 'the onboarding fields sit closer together (v1.40.1)'); 
    }
    R.ok(rankFolded(), 'Rank stays folded on first run');

    // v1.42.0: the welcome screen carries the restore door beside the CTA.
    const obr = ob('ob-restore');
    R.ok(!!obr, 'the restore door renders on the welcome screen');
    R.eq(obr.getAttribute('aria-label'), 'Restore from a backup', 'the door is labelled for screen readers');
    R.eq((obr.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide'), 'log-in', 'the door uses the log-in icon');
    R.ok(obr.contains(ob('ob-restore-file')), 'the file input overlays the door button (Settings-door pattern)');
    R.eq(ob('ob-restore-file').getAttribute('accept'), '.json,.txt,application/json,text/plain', 'the welcome picker accepts the same files as Settings');
    R.ok(ob('ob-submit').className.includes('flex-1'), 'Let\'s Go keeps the primary share of the row');
    R.ok(ob('ob-submit').disabled === true && !obr.disabled, 'the door is tappable while the form is still empty');
    R.ok(obr.className.includes('w-[52px]') && obr.className.includes('h-[52px]') && obr.className.includes('self-center'), 'hotfix: the door is an explicit 52px square (matches the CTA height)');

    type(ob('ob-name'), 'Junior June');
    R.ok(rankFolded(), 'a name alone does not reveal Rank');

    type(ob('ob-solo'), '11022024');
    R.eq(ob('ob-solo').value, '11/02/2024', 'the mask types 11022024 as 11/02/2024');
    R.ok(rankFolded(), 'name + date without gender keeps Rank folded');

    d.querySelectorAll('.ob-gender-btn')[0].click(); // Male
    await wait(50);
    R.ok(!rankFolded(), 'name + valid date + gender reveals Rank');
    R.eq(Array.from(d.querySelectorAll('.ob-rank-btn')).map((b) => b.textContent.trim()).join(','), 'FS,LS,CS,IFM', 'male ranks list FS/LS/CS/IFM — no junior pill');

    d.querySelectorAll('.ob-gender-btn')[1].click(); // Female
    await wait(50);
    R.eq(Array.from(d.querySelectorAll('.ob-rank-btn')).map((b) => b.textContent.trim()).join(','), 'FSS,LSS,CSS,IFM', 'female ranks list FSS/LSS/CSS/IFM — no junior pill');
    d.querySelectorAll('.ob-gender-btn')[0].click(); // back to Male for the submit
    await wait(50);

    type(ob('ob-solo'), '31022024');
    R.eq(ob('ob-solo').value, '31/02/2024', 'the mask formats 31/02/2024 too');
    R.ok(rankFolded(), 'an impossible calendar date folds Rank away');

    type(ob('ob-solo'), '01082026');
    R.ok(!rankFolded(), 'a corrected date re-reveals Rank');
    R.ok(ob('ob-submit').disabled === true, 'without a rank the submit stays inert');
    d.querySelectorAll('.ob-rank-btn')[0].click(); // FS
    await wait(50);
    R.ok(ob('ob-submit').disabled === false, 'name + date + gender + rank enables Submit');
    ob('ob-submit').click();
    await wait(400);
    const wn = d.getElementById('whatsnew-close');
    if (wn && !d.getElementById('whatsnew-backdrop').classList.contains('hidden')) wn.click();
    const stored = JSON.parse(w.eval('localStorage.getItem("crewAssist.profile")'));
    R.ok(stored && stored.name === 'Junior June' && stored.gender === 'M' && stored.rank === 'FS' && stored.firstSoloYMD === '2026-08-01', 'submit stores the solo date as YYYY-MM-DD');

  // v1.45.11: onboarding asks for the basic salary (Monthly Salary view)
  {
    const { w, d } = await boot(APP); // no profile seeded: first-run onboarding shows
    const ob = (id) => d.getElementById(id);
    const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
    R.ok(!!ob('ob-basic'), 'the basic-salary field renders on first run');
    R.eq(ob('ob-basic').getAttribute('inputmode'), 'decimal', 'the salary field summons the decimal keypad');
    R.ok(ob('ob-basic-hint').textContent.indexOf('pick a rank first') !== -1, 'the hint waits for a rank before naming a range');
    type(ob('ob-name'), 'Salary Sam');
    type(ob('ob-solo'), '01082026');
    d.querySelectorAll('.ob-gender-btn')[0].click();
    d.querySelectorAll('.ob-rank-btn')[0].click(); // FS
    await wait(50);
    R.ok(ob('ob-basic-hint').textContent.indexOf('$1,550 \u2013 $2,400 (CC1)') !== -1, 'with FS picked the hint names the FS grade range');
    type(ob('ob-basic'), '2600');
    ob('ob-submit').click();
    await wait(400);
    const wn = d.getElementById('whatsnew-close');
    if (wn && !d.getElementById('whatsnew-backdrop').classList.contains('hidden')) wn.click();
    const stored = JSON.parse(w.eval('localStorage.getItem("crewAssist.profile")'));
    R.ok(stored && stored.basicSalary === 2600, 'submit stores the basic salary for the Monthly Salary view');
    R.ok(stored && stored.name === 'Salary Sam', 'the rest of the profile still saves beside it');
    void d;
  }

    // the stored date prices the FS junior tier per flight date (profile swaps
    // go through localStorage + initData(), the app's own reload path — the
    // harness evals each script block separately, so appProfile is a closure)
    const swap = (p) => w.eval('localStorage.setItem("crewAssist.profile", ' + JSON.stringify(JSON.stringify(p)) + '); initData();');
    R.eq(w.eval('ifaRankKeyForDate("2026-10-07")'), 'Jr. FS', 'a first solo one month back keys Jr. FS');
    R.eq(w.eval('ifaRankKeyForDate("2028-08-01")'), 'FS', 'the 24-month anniversary crosses to full FS');
    swap({ name: 'Test Tan', gender: 'M', rank: 'LS', firstSoloYMD: '2026-08-01' });
    R.eq(w.eval('ifaRankKeyForDate("2026-10-07")'), 'LS', 'LS never tiers');
    swap({ name: 'Test Tan', gender: 'M', rank: 'FS' });
    R.eq(w.eval('ifaRankKeyForDate("2026-10-07")'), 'FS', 'a pre-hotfix profile with no solo date keeps the full rate');
    swap({ name: 'Test Tan', gender: 'M', rank: 'Jr. FS' });
    R.eq(w.eval('ifaRankKeyForDate("2026-10-07")'), 'Jr. FS', 'a legacy picked Jr. FS rank still resolves');

    // end to end: a card dated within 24 months of first solo prices $10
    swap({ name: 'Test Tan', gender: 'M', rank: 'FS', firstSoloYMD: '2026-08-01' });
    w.eval('renderCalculatorCard("both")');
    await wait(150);
    const card = d.querySelector('#chat-container [data-calc-card]:last-of-type');
    const cid = card.querySelector('input[id$="-ifa-fn1"]').id.slice(0, -'-ifa-fn1'.length);
    const set = (el, v) => { if (el) { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    set(d.getElementById(cid + '-flight-type'), 'Turnaround');
    set(d.getElementById(cid + '-ifa-fn1'), '123'); set(d.getElementById(cid + '-ifa-fn2'), '124');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-07'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-07');
    set(d.getElementById(cid + '-ifa-t1'), '1:30'); set(d.getElementById(cid + '-ifa-t2'), '1:35');
    R.eq(w.eval('computeCardResults("' + cid + '", "both").detail.rankRate'), 10, 'a card dated 2 months after first solo prices the junior $10 rate');
    swap({ name: 'Test Tan', gender: 'M', rank: 'FS', firstSoloYMD: '2024-01-01' });
    R.eq(w.eval('computeCardResults("' + cid + '", "both").detail.rankRate'), 13.5, 'a card past the 24-month mark prices the full $13.50');
  }

  // v1.31.0: the UX-review release — labelled pill, aria, type floor, ink, hit areas
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(!/text-\[(9|9\.5|10|10\.5|11|12\.8|13|15)px\]/.test(src), 'no arbitrary utility size exists \u2014 nothing below the 11px floor, nothing between rungs');
    R.ok(src.includes('.ca-micro { font-size: 11px; }'), 'the micro tier is one token');
    // 2026-10-15 (divergence #2): the last off-rung text-base sites rejoin the scale
    R.ok(!src.includes('text-base'), 'zero text-base anywhere - nothing renders between the rungs (14/17)');
    R.ok(src.includes('id="settings-avatar" class="w-9 h-9 rounded-full flex items-center justify-center border border-sia-gold/70 bg-sia-gold/10 text-sia-gold font-bold text-lg'), 'settings avatar initial at COMPACT 18px');
    R.ok(src.includes('class="font-bold text-lg truncate" id="settings-profile-name"'), 'settings profile name at COMPACT 18px');
    R.ok(src.includes('id="ca-rc-month" class="font-bold text-lg text-left leading-none"'), 'calendar month header at COMPACT 18px');
    R.ok(src.includes('dark:text-sia-gold mb-4 flex items-center'), 'Inflight Menu card header inherits BODY 14px from its bubble - no off-rung 16px');
    R.ok(!src.includes('rounded-[100%]'), 'no arbitrary radii - the timeline rail rides rounded-full');
    // v1.45.0 (divergence #1a + the owner's binary toggle): reduced motion
    R.ok(src.includes('@keyframes ca-reduce-fade { from { opacity: 0; } to { opacity: 1; } }'), 'one shared 150ms fade for every reduced entry');
    R.ok(src.includes('html.ca-reduced .chat-anim-in') && src.includes('html.ca-reduced .ca-cl-badge-new') && src.includes('html.ca-reduced .animate-pulse'), 'entries fade and loops stop behind the ca-reduced gate');
    R.ok(src.includes('html.ca-reduced .transition-transform'), 'position transitions snap - sheets included');
    R.ok(!/@media \(prefers-reduced-motion/.test(src), 'no media-query-only motion rules remain - the class gate owns every reduction');
    R.ok(src.includes("localStorage.getItem('crewAssist.motion')") && src.includes("localStorage.setItem('crewAssist.motion', pref)"), 'crewAssist.motion is the toggle storage, read and written');
    R.ok(src.includes("if (pref === 'reduced') return true;") && src.includes("if (pref === 'full') return false;") && src.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'an absent key follows the OS - the toggle never guts the default');
    R.ok(src.includes('id="motion-pill-reduced"') && src.includes('id="motion-pill-full"') && src.includes('id="motion-segmented"'), 'the binary Reduced/Full toggle lives in Settings');
    R.ok(src.includes("'crewAssist.calcUi', 'crewAssist.motion', 'crewAssist.rates'"), 'the motion key rides the backup set');
    R.ok(src.includes('function syncSkyMotion()') && src.includes('skyAnimating = false;'), 'the sky rests on a still frame and restarts when motion returns');
    // v1.45.1 (owner hotfix 1): the typing bubble never appears under reduced motion
    R.ok(src.includes("if (document.documentElement.classList.contains('ca-reduced')) return;\n            const chatContainer = document.getElementById('chat-container');"), 'the reduced-motion guard sits at the head of showTypingIndicator');
    // v1.45.1 (owner hotfix 2): the nudge arrives as its own chat message
    R.ok(src.includes('enqueueBot(() => { renderLayoverTzCard(); renderNextFlightCard(); });\n                enqueueBot(() => { renderMenuNudge(); });'), 'the menu nudge rides its own bot turn - never bundled with the flight card');
    R.ok(src.includes("el.className = 'flex items-start gap-3 mt-4 w-full'"), 'the nudge row carries standard message spacing (mt-4)');
    // v1.45.2 (owner order): settings descriptions ride one species - ca-micro gray-500
    R.ok(src.includes('id="calcui-desc" class="ca-micro text-gray-500 mt-1.5 leading-relaxed"'), 'the calculator description rides the row species (ca-micro, gray-500)');
    R.ok(src.includes('id="motion-desc" class="ca-micro text-gray-500 mt-3.5 leading-relaxed"'), 'the motion description rides the row species (ca-micro, gray-500)');
    R.ok(!src.includes('id="calcui-desc" class="text-sm') && !src.includes('id="motion-desc" class="text-sm'), 'no panel description keeps the old 14px species');
    // v1.45.3 (owner order): a fully-saved set never shows the nudge
    R.ok(src.includes('const savedNow = flights.map((f) => menusSavedFor(f.fn, f.ymd));') && src.includes('if (flights.length && savedNow.every(Boolean)) {'), 'the all-saved gate heads renderMenuNudge - saved means no nudge');
    R.ok(src.includes('renderMenuNudge(); // all-saved \u2014 the gate animates the card away'), 'the sweep completion routes through the gate instead of a done form');
    // v1.45.5 (owner orders): the whole-duty nudge + the viewer's cycle button
    R.ok(src.includes('const legs = nfDutyOf(list.slice(i)).legs;') && src.includes('if (legs.some((f) => f.ymd <= limit)) picked.push.apply(picked, legs);'), 'the nudge groups legs into duties \u2014 one leg in the window brings the whole duty');
    R.ok(src.includes("'</b> coming up \u2014 save all menus for offline view.'"), 'the multi-flight copy says coming up, not the 2-day window');
    R.ok(src.includes('id="btn-menu-cycle"') && src.includes('data-lucide="refresh-cw"') && src.includes('function menuCycleList()'), 'the viewer carries the cycle button over the saved-menu set');
    R.ok(src.includes("gone.push('SQ' + f.fn + ':' + f.ymd + ':')"), 'the landed-leg sweep takes the saved menus with it');
    // v1.45.6 (owner order): the printer's saved-menu flight chips
    R.ok(src.includes('id="print-flight-row"'), 'the printer carries the flight-chip row above the layout toggle');
    R.ok(src.includes("fnum.className = 'print-sector-num'") && src.includes('fset.forEach((f, idx) => {'), 'the flight chips mirror the sector-chip pattern, numbered, pure route');
    R.ok(src.includes('openMenuPrinter(f.fn, f.ymd, saved.cabinClasses)'), 'a chip tap is a fresh open of that flight');
    R.ok(src.includes("frow.classList.toggle('hidden', searched ? n < 1 : (fset.length < 2 && !multi))"), 'v1.45.10: the chip line hides when neither group applies — a searched duty shows its own, a roster duty needs 2 saved menus or 2 sheets');
    // v1.45.9 (owner rulings): the searched-flight cycle hide + the summary-word search
    R.ok(src.includes('currentMenuSearch.fromSearch = true') && src.includes('!!currentMenuSearch.fromSearch || menuCycleList().length < 2'), 'a flight opened from the search card hides the viewer\u2019s cycle button');
    R.ok(src.includes('currentMenuSearch.fromSearch = false') && src.includes('a roster open — the cycle button is at home here'), 'roster opens clear the searched flag');
    R.ok(src.includes('flightOverviewText(det)') && src.includes('counted as paxing'), 'the earnings search haystack reads each flight\u2019s frozen summary');
    // v1.45.10 (owner rulings): the searched flight cycles its OWN sectors; its print chips are its own
    R.ok(src.includes('currentMenuSearch.sectorLegs') && src.includes('cycSectorBtn'), 'a searched multi-sector flight re-shows the cycle button over its own legs');
    R.ok(src.includes('searched ? [] : menuCycleList()'), 'a searched flight\u2019s print chips exclude the saved menus');
    R.ok(src.includes('chipInto(sec, idx, true, true)'), 'a single-sheet search keeps one inert chip');
    // v1.44.1 (standing owner rule, 2026-10-14): typography discipline \u2014 one
    // fixed scale by role, documented at the head of the <style> block. These
    // pins hold the floor and the rungs.
    R.ok(src.includes('TYPOGRAPHY & COLOR DISCIPLINE \u2014 standing owner rule v2'), 'the scale is documented in the source, roles first');
    // v1.44.4: the semantic colour tokens exist, both themes, and the
    // flagship call sites ride them (the zero-diff proof lives in the
    // style-snapshot rig, not here)
    R.ok(src.includes('--ca-gold: #C9A227;') && src.includes('--ca-panel-bg: #0B1A3A;') && src.includes('html:not(.dark) {') && src.includes('--ca-panel-bg: #F6F1E8;'), 'the semantic colour tokens are defined for both themes');
    R.ok(src.includes('border: 1px solid var(--ca-gold);') && /#cadate-panel \{\n\s*background: var\(--ca-panel-bg\);\n\s*color: var\(--ca-panel-ink\);/.test(src), 'the gold CTA and the date-picker panel ride the tokens');
    // v1.44.6 (owner order "proceed with 2"): the one-off retirement — the
    // round-2 tokens exist, the flagship swept sites ride them, the merge
    // map is documented in source, and the paired surfaces flip per theme
    R.ok(src.includes('--ca-line-gray-10: rgba(127, 127, 127, 0.10);') && src.includes('--ca-gold-soft-30: rgba(201, 162, 39, 0.30);') && src.includes('--ca-gold-glow-90: rgba(201, 162, 39, 0.90);'), 'the round-2 wash/glow tokens are defined');
    R.ok(src.includes('linear-gradient(135deg, var(--ca-arch-card-hi) 0%, var(--ca-arch-card-mid) 60%, var(--ca-arch-card-lo) 100%)') && src.includes('background: var(--ca-arch-bar);') && src.includes('border: 2px solid var(--ca-gold-soft-30);'), 'the goldcard gradient, the chart bar and the spinner ring ride round-2 tokens');
    R.ok(src.includes('background: var(--ca-switch-track);') && src.includes('--ca-switch-track: rgba(0, 0, 0, 0.15);') && src.includes('--ca-sticky-bg: rgba(255, 255, 255, 0.95);'), 'the switch track and roster sticky ride paired tokens that flip per theme');
    R.ok(src.includes('@keyframes ca-rc-flash { 0% { box-shadow: 0 0 0 0 var(--ca-gold-glow-90); } 100% { box-shadow: 0 0 0 14px var(--ca-gold-clear); } }'), 'the flash and pulse keyframes ride the glow tokens');
    R.ok(src.includes('Nearby alphas merged only where the shift is'), 'the merge map is documented beside the round-2 token block');
    R.ok(!src.includes('rgba(127,127,127,.07)') && !src.includes('rgba(127,127,127,.14)') && !src.includes('rgba(201,162,39,.16)') && !src.includes('rgba(212,175,55,.28)'), 'the merged one-offs are gone from the call sites');
    // v1.44.7 audit fix 6, value 1 of 5 (#c9a227 -> var(--ca-gold), round 3):
    // the dev cluster, print editor, shell guard and archGrad stops ride the
    // token; the only remaining literal is the canvas star fill (var() cannot
    // paint a canvas) and the protected defs/fallbacks
    R.ok(src.includes('.dev-rate-chev { transition: transform 280ms ease; color: var(--ca-gold); flex-shrink: 0; }') && src.includes('.dev-bracket-var { font-weight: 800; letter-spacing: 0.04em; color: var(--ca-gold); }') && src.includes('.dev-bracket-arrow { color: var(--ca-gold); font-weight: 700; flex-shrink: 0; }'), 'round 3 value 1: the dev cluster chevrons and brackets ride var(--ca-gold)');
    R.ok(src.includes('.print-edit-chev { transition: transform 280ms ease; color: var(--ca-gold); }') && src.includes('border: 1.5px dashed var(--ca-gold);') && src.includes('background: var(--ca-gold); margin-top: 11px;'), 'round 3 value 1: the print editor family rides var(--ca-gold)');
    R.ok(src.includes('letter-spacing:0.1em;color:var(--ca-gold);margin-bottom:0.75rem;') && src.includes('background:linear-gradient(to right,#E8C766,var(--ca-gold));'), 'round 3 value 1: the shell guard rides var(--ca-gold) (inline <style> tokens, not tw.css)');
    R.ok(src.includes('<stop offset="50%" style="stop-color:var(--ca-gold)" stop-opacity="1" />') && (src.match(/stop-color="#C9A227"/g) || []).length === 0, 'round 3 value 1: the archGrad stops take the style-attribute form (presentation attributes cannot carry var())');
    // v1.44.7 audit fix 6, value 2 of 5 (#ff4c4c -> tokens, round 3): the
    // destructive red rides --ca-danger-strong (dc2626/ff4c4c pair), its 50%
    // border rides --ca-danger-strong-line, the Developer Mode label rides the
    // constant --ca-danger-dev
    R.ok(src.includes('--ca-danger-strong: #ff4c4c;') && src.includes('--ca-danger-strong: #dc2626;') && src.includes('--ca-danger-dev: #ff4c4c;'), 'round 3 value 2: the danger-strong tokens exist, both themes');
    R.ok((src.match(/text-\[color:var\(--ca-danger-strong\)\]/g) || []).length === 6 && (src.match(/border-\[color:var\(--ca-danger-strong-line\)\]/g) || []).length === 3, 'round 3 value 2: six text pairs and three border pairs ride the tokens');
    R.ok(!src.includes('dark:text-[#ff4c4c]') && !src.includes('dark:border-[#ff4c4c]') && !src.includes('text-[#ff4c4c]'), 'round 3 value 2: no #ff4c4c literal survives outside the token defs');
    R.ok(src.includes('html.dark .ca-twotap-armed { color: var(--ca-danger-strong) !important;'), 'round 3 value 2: the two-tap armed red rides the token');
    // v1.44.7 audit fix 6, value 3 of 5 (#16294e -> var(--print-ink), round 3):
    // the print sheet's navy ink is a named token on .print-paper, beside
    // --print-type; the .pe-* family rides it (print = one physical medium,
    // theme-independent)
    R.ok(src.includes('--print-type: 1;\n            --print-ink: #16294e;') && (src.match(/var\(--print-ink\)/g) || []).length === 7, 'round 3 value 3: --print-ink defined once on .print-paper, seven call sites');
    R.ok(!src.toLowerCase().replace('--print-ink: #16294e;', '').includes('#16294e'), 'round 3 value 3: no #16294e literal survives outside the def');
    R.ok(!src.includes('--print-ink: var(--print-ink)'), 'round 3 value 3: the def is not self-referential (the diag-caught first-draft bug)');
    // v1.44.7 audit fix 6, value 4 of 5 (#f6f1e8 -> the existing surface token,
    // round 3): the composer fade's solid from/via ride var(--bg-color) (the
    // token's exact pair). The archive veil's /90+/80 alpha pair and the
    // capture canvas backdrop stay literal BY REPORT: no existing token carries
    // rgba(246,241,232,.9)/rgba(8,11,20,.8), and canvas fillStyle cannot var()
    R.ok(src.includes('from-[color:var(--bg-color)] via-[color:var(--bg-color)] to-transparent dark:from-[#04070F] dark:via-[#04070F]/90'), 'round 3 value 4: the composer fade rides the bg-color token, dark overrides intact');
    // v1.44.9 (owner order 'mint the token'): the two archive-veil alpha sites
    // now ride --ca-arch-veil — the value-4 stay-literal ruling was overturned;
    // the capture canvas backdrop remains the only #F6F1E8-family literal
    R.ok(!src.includes('fill-[#F6F1E8]/90') && !src.includes('bg-[#F6F1E8]/90'), 'the archive veil alpha pair no longer sits in a class (rides --ca-arch-veil since v1.44.9)');
    // v1.44.7 audit fix 6, value 5 of 5 (#9ca3af, round 3): all four free
    // sites are stylesheet rules, where a Tailwind utility cannot live — they
    // ride --ca-ink-faint (the app's canonical gray-400 ink, its own comment
    // says so), theme-constant like the literals they replace
    R.ok(src.includes('.dev-rate-acc-title { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ca-ink-faint); }') && src.includes('.dev-bracket-op { color: var(--ca-ink-faint);'), 'round 3 value 5: the dev cluster labels ride --ca-ink-faint');
    R.ok((src.match(/color: #9[cC][aA]3[aA][fF]/g) || []).length === 0, 'round 3 value 5: no #9ca3af literal survives in a rule');
    // round 3 casing pass (the brief's LAST step): every remaining gold
    // literal spells #C9A227 — the 11 var(--sia-gold, ...) fallbacks and the
    // .dark --sia-gold-ink def; the WCAG comment keeps its original prose
    R.ok((src.match(/var\(--sia-gold, #C9A227\)/g) || []).length === 11 && src.includes('.dark { --sia-gold-ink: #C9A227; }') && (src.match(/#c9a227/g) || []).length === 1, 'round 3 casing: 11 fallbacks + the dark def uppercase, only the WCAG comment stays lowercase');
    R.ok(require('fs').existsSync(require('path').join(__dirname, 'smoke', 'style-snapshot.js')) && require('fs').existsSync(require('path').join(__dirname, 'smoke', 'style-diff.js')), 'the computed-style snapshot rig ships with the app (re-run it around any CSS-touching round)');
    R.ok(!/font-size: (9|9\.5|10|10\.5)px;/.test(src), 'no readable text sits below the MICRO rung (11px) \u2014 CSS side');
    R.ok(!/font-size: (12\.8|13|15)px;/.test(src), 'no in-between CSS sizes survive \u2014 12.8/13/15 are gone');
    R.ok(!/font-size: 0\.8rem;/.test(src), 'the date picker\u2019s day cells left the 12.8px one-off for the 14px day-number role');
    R.ok(!src.includes('text-3xl'), 'the route hero\u2019s station codes stepped down to the 24px rung \u2014 nothing sits between DISPLAY and HERO');
    R.ok(src.includes('.ca-rc-num { font-size: 14px; font-weight: 700;') && src.includes('.ca-rc-gut .n { font-size: 14px; font-weight: 700;'), 'the calendar\u2019s two day-number treatments match end to end (BODY 14/700)');
    R.ok(src.includes('font-size: 0.875rem;') && !src.includes('text-[13px]'), 'inputs sit at BODY \u2014 the date picker and the print editor dropped their 13px one-offs');
    R.ok(src.includes('--sia-gold-ink: #7d650f') && src.includes('html:not(.dark) .text-sia-gold'), 'light-mode gold text uses the measured ink');
    R.ok(src.includes('html:not(.dark) .text-sia-gold { color: var(--sia-gold-ink); }'), 'light gold text rides the token - no raw #7A620F bypass (divergence #3b, 2026-10-15)');
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
    R.ok(src.includes('border: 1.5px solid var(--ca-gold-bright)'), 'every toast carries a gold border'); // v1.44.4: the literal rides the token now
    R.ok(src.includes('.dark .ca-arch-toast { background: var(--ca-toast-bg); color: var(--ca-toast-ink); }'), 'dark mode toasts invert to a bright pill'); // v1.44.4: the pair rides the tokens now
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
      const entries = [...clMatch[1].matchAll(/v:\s*'([^']+)'(?:,\s*d:\s*'([^']*)')?,\s*items:\s*\[([\s\S]*?)\]/g)].map((m) => ({ v: m[1], d: m[2] || '', items: [...m[3].matchAll(/\{ c:\s*'([^']+)', t:\s*'([^']*)' \}/g)].map((x) => ({ c: x[1], t: x[2] })) }));
      R.ok(entries.length >= 60, `the changelog covers every version since inception (${entries.length} entries) (E6)`);
      R.eq(entries[0].v, appVer, 'the newest changelog entry is the current release (E6)');
      for (let i = 1; i < entries.length; i++) {
        const [a, b] = [entries[i - 1].v, entries[i].v].map((v2) => v2.split('.').map(Number));
        const descending = (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
        R.ok(descending > 0, `changelog versions run strictly descending: v${entries[i - 1].v} then v${entries[i].v} (E6)`);
      }
      R.ok(entries[0].items.length >= 1, 'the current release carries at least one pointer (E6)');
      entries[0].items.forEach((it) => {
        R.ok(['new', 'fix', 'imp', 'fun'].indexOf(it.c) !== -1, `current-release pointer is categorised: "${it.t}" (E6)`);
        R.ok(it.t.indexOf('. ') === -1 && /[.!?]$/.test(it.t), `current-release pointer is one sentence: "${it.t}" (E6)`);
        // hotfix 12 (owner order): when a release's hotfix pointers pile up
        // they combine into themed one-sentence pointers — longer than the
        // old twelve-word cap but still one sentence each. Feature pointers
        // (new/imp) keep the tight cap; consolidated fix pointers may run
        // to thirty-five words.
        const cap = (it.c === 'fix') ? 35 : 12;
        R.ok(it.t.split(/\s+/).length <= cap, `current-release pointer stays within ${cap} words: "${it.t}" (E6)`);
      });
      // round 34 (owner order: changelog housekeeping): the three rounds since
      // the 1.43.0 consolidation fold into the current release as fix
      // pointers, so a fresh install tells the crew what actually changed —
      // the feed rework, the nudge-as-fixture, and the calendar first-open fix
      // v1.45.10 (owner rulings 2026-10-24: the searched flight's own cycle
      // and chips, plus the deadhead-transfer fix): takes the head; 1.45.9
      // shifts down one. The 1.44.5 pin leaves the sixteen-entry window.
      // v1.45.21 (owner order): the quadrant unification (both meta rows on
      // the hairline 2x2, the net badge beside the figure, the em-dash
      // fallback). v1.45.22 (owner order): the overseas-expense release -
      // the layover expense field, the trending-icon badge, the three-row
      // money column. v1.45.23 (owner order): the money column becomes the
      // rigid UPPERCASE tabular grid - takes the head. 1.45.22 shifts down
      // one; the 1.45.6 pin leaves the pinned window (floor 1.45.7; its
      // pointer stays in the feed).
      R.eq(entries[0].v, '1.45.23', 'the 1.45.23 tabular-grid release sits at the head of the changelog');
      R.eq(entries[0].items.length, 2, 'the 1.45.23 entry carries its two pointers');
      R.ok(src.includes("c: 'imp', t: 'Month money columns ride a rigid uppercase tabular grid.' }"), 'the grid pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The net figure anchors its column in the gold accent.' }"), 'the accent pointer reads as approved, inside the release it ships');
      R.eq(entries[1].v, '1.45.22', 'the 1.45.22 overseas-expense release sits second, newest first');
      R.eq(entries[1].items.length, 3, 'the 1.45.22 entry carries its three pointers');
      R.ok(src.includes("c: 'new', t: 'Layover trips track overseas expenses against take-home.' }"), 'the expense pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Year badges wear the trending icon, not a glyph.' }"), 'the badge pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Month money columns stack net, gross, after-expenses.' }"), 'the money-column pointer reads as approved, inside the release it ships');
      R.eq(entries[2].v, '1.45.21', 'the 1.45.21 quadrant-unification release sits second, newest first');
      R.eq(entries[2].items.length, 3, 'the 1.45.21 entry carries its three pointers');
      R.ok(src.includes("c: 'imp', t: 'COP stats ride the hairline quadrant architecture.' }"), 'the quadrant pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Yearly net comparisons badge the headline figure.' }"), 'the badge pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The earliest year reads a quiet em dash.' }"), 'the em-dash pointer reads as approved, inside the release it ships');
      R.eq(entries[3].v, '1.45.20', 'the 1.45.20 after-hours release sits third, newest first');
      R.eq(entries[3].items.length, 3, 'the 1.45.20 entry carries its three pointers');
      R.ok(src.includes("c: 'imp', t: 'After-hours rides a strict 2x2 grid with hairlines.' }"), 'the quadrant pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Every salary metric leads with its Lucide icon.' }"), 'the icon pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The month view breathes; yearly comparisons break below.' }"), 'the breathing-room pointer reads as approved, inside the release it ships');
      R.eq(entries[4].v, '1.45.19', 'the 1.45.19 salary-layout release sits fourth, newest first');
      R.eq(entries[4].items.length, 2, 'the 1.45.19 entry carries its two pointers');
      R.ok(src.includes("c: 'imp', t: 'Salary stats ride a weighted grid that never collides.' }"), 'the weighted-grid pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Gross and CPF group left; milestones ride right.' }"), 'the split-row pointer reads as approved, inside the release it ships');
      R.eq(entries[5].v, '1.45.18', 'the 1.45.18 remaining-flights release sits second, newest first');
      R.eq(entries[5].items.length, 3, 'the 1.45.18 entry carries its three pointers');
      R.ok(src.includes("c: 'imp', t: 'The still-to-fly panel reads Remaining flights.' }"), 'the remaining-flights pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Its line counts completed flights and legs left.' }"), 'the completed-left pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'All-time COP gains an annual average figure.' }"), 'the annual-average pointer reads as approved, inside the release it ships');
      R.eq(entries[6].v, '1.45.17', 'the 1.45.17 milestone release sits third, newest first');
      R.eq(entries[6].items.length, 2, 'the 1.45.17 entry carries its two pointers');
      R.ok(src.includes("c: 'fix', t: 'Daylight search placeholders read dark slate gray.' }"), 'the placeholder pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The milestone line names what remains to earn.' }"), 'the milestone pointer reads as approved, inside the release it ships');
      R.eq(entries[7].v, '1.45.16', 'the 1.45.16 state-icons release sits third, newest first');
      R.eq(entries[7].items.length, 4, 'the 1.45.16 entry carries its four pointers');
      R.ok(src.includes("c: 'fix', t: 'Daylight active pills turn white with walnut ink.' }"), 'the daylight-pill pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Month states ride Lucide icons beside the title.' }"), 'the state-icons pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The live month spins a slow gold refresh-cw.' }"), 'the spinning-refresh-cw pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Status words join the flight count line.' }"), 'the count-line-status pointer reads as approved, inside the release it ships');
      R.eq(entries[8].v, '1.45.15', 'the 1.45.15 roster-notice release sits third, newest first');
      R.eq(entries[8].items.length, 4, 'the 1.45.15 entry carries its four pointers');
      R.ok(src.includes("c: 'fix', t: 'The current month shows its still-to-fly notice from the roster.' }"), 'the roster-notice pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The ledger \u2715 centres on its row; the sag is gone.' }"), 'the centred-\u2715 pointer reads as approved, inside the release it ships');
      R.eq(entries[9].v, '1.45.14', 'the 1.45.14 earnings-depth release sits third, newest first');
      R.eq(entries[9].items.length, 5, 'the 1.45.14 entry carries its five pointers');
      R.ok(src.includes("c: 'fix', t: 'Earnings opens on the current month, never a pre-saved future one.' }"), 'the never-future pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Daylight earns a warm canvas under crisp white cards.' }"), 'the daylight-depth pointer reads as approved, inside the release it ships');
      R.eq(entries[10].v, '1.45.13', 'the 1.45.13 earnings-fresh-open release sits third, newest first');
      R.eq(entries[10].items.length, 5, 'the 1.45.13 entry carries its five pointers');
      R.ok(src.includes("c: 'imp', t: 'Earnings opens on this month\u2019s COP allowance.' }"), 'the fresh-open pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Past chart bars sit quieter; stripes mark the future.' }"), 'the chart-mute pointer reads as approved, inside the release it ships');
      R.eq(entries[11].v, '1.45.12', 'the 1.45.12 earnings-polish release sits third, newest first');
      R.eq(entries[11].items.length, 4, 'the 1.45.12 entry carries its four pointers');
      R.ok(src.includes("c: 'imp', t: 'The earnings figure gets breathing room and a tidier stat grid.' }"), 'the breathing-room pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'Gold-card text meets AA contrast in both themes.' }"), 'the contrast pointer reads as approved, inside the release it ships');
      R.eq(entries[12].v, '1.45.11', 'the 1.45.11 monthly-salary release sits second, newest first');
      R.eq(entries[12].items.length, 4, 'the 1.45.11 entry carries its four pointers');
      R.ok(src.includes("c: 'new', t: 'Monthly Salary \u2014 your net take-home beside the COP allowance.' }"), 'the salary pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The earnings chart gains an average line and a year-by-year view.' }"), 'the chart pointer reads as approved, inside the release it ships');
      R.eq(entries[13].v, '1.45.10', 'the 1.45.10 searched-cycle release sits third, newest first');
      R.eq(entries[14].items.length, 3, 'the 1.45.10 entry carries its three pointers');
      R.ok(src.includes("c: 'fix', t: 'A searched flight’s cycle button flips through its own sectors — never back to the saved menus — and hides for single-sector flights.' }"), 'the 1.45.10 pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'fix', t: 'A positioning leg that lands at a different airport than the operating leg departs no longer orphans the return leg.' }"), 'the deadhead pointer reads as approved, inside the release it ships');
      // v1.45.9 (owner rulings 2026-10-24: the printer's ONE chip line, the
      // searched-flight cycle hide, the summary-word earnings search) takes
      // the head; the 1.45.8 paxing-leg pair sits second. The previous
      // rounds shift down two each; the 1.44.4/1.44.3 pair leaves the window.
      R.eq(entries[14].v, '1.45.9', 'the 1.45.9 chip-line release sits third, newest first');
      R.eq(entries[14].items.length, 3, 'the 1.45.9 entry carries its three pointers');
      R.ok(src.includes("c: 'new', t: 'The earnings search reads the words of each flight\u2019s summary.' }"), 'the 1.45.9 pointer reads as approved, inside the release it ships');
      R.eq(entries[15].v, '1.45.8', 'the 1.45.8 paxing-leg release sits fifth, newest first');
      R.eq(entries[15].items.length, 2, 'the 1.45.8 entry carries its two pointers');
      R.ok(src.includes("c: 'fix', t: 'Rosters that print the duty-code legend beside the table (Feb 2026, May 2024) parse their OFF, leave, standby and layover days again.' }"), 'the 1.45.8 pointer reads as approved, inside the release it ships');
      R.eq(entries[16].v, '1.45.7', 'the 1.45.7 split-duty release sits fourth, newest first');
      R.eq(entries[16].items.length, 1, 'the 1.45.7 entry carries its single pointer');
      R.ok(src.includes("c: 'fix', t: 'A report-before-midnight duty departs on its flight day \u2014 the Melbourne layover never shows \"in the air\".' }"), 'the 1.45.7 pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'new', t: 'Flight chips pick saved menus in the printer.' }"), 'the 1.45.6 pointer reads as approved, inside the release it ships');
      R.ok(src.includes("c: 'imp', t: 'The menu nudge covers the whole duty, return legs included.' }"), 'the 1.45.5 whole-duty pointer reads as approved');
      R.ok(src.includes("c: 'fix', t: 'The roster diff sees same-day duty changes, standby to flight included.' }"), 'the 1.45.4 pointer reads as approved (just past the pinned window, still in the feed)');
      R.ok(src.includes("c: 'fix', t: 'A fully-saved flight set never shows the menu nudge.' }"), 'the 1.45.3 pointer reads as approved, inside the twelve-word cap');
      // v1.44.9: the veil token itself — the two archive-overlay alpha sites ride it
      R.ok(src.includes('--ca-arch-veil: rgba(8, 11, 20, 0.80);') && src.includes('--ca-arch-veil: rgba(246, 241, 232, 0.90);') && src.includes('fill-[color:var(--ca-arch-veil)]') && src.includes('bg-[color:var(--ca-arch-veil)]'), 'v1.44.9: --ca-arch-veil exists (dark .80 / light .90) and both overlay sites ride it');
      R.ok(src.includes("c: 'imp', t: 'The last raw colours ride named tokens \u2014 same pixels, one spelling.' }"), 'the 1.44.8 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("c: 'fix', t: 'The flagged-trip warning wears the alert-triangle icon, not a text glyph.' }"), 'the 1.44.7 pointer reads as approved, inside the twelve-word cap');
      // v1.44.7 audit fix 1: the flagged-trip warning is a Lucide icon, and the
      // source carries no warning-sign glyph anywhere (icons only, never emoji).
      R.eq((src.match(/data-lucide="alert-triangle"/g) || []).length, 1, 'exactly one alert-triangle icon - the flagged-trip line');
      R.ok(!src.includes('\u26a0'), 'no U+26A0 warning-sign glyph remains in the source');
      R.ok(src.includes("c: 'imp', t: 'Every remaining colour wash rides a named token — same look.' }"), 'the 1.44.6 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("c: 'fix', t: 'Reopening earnings, menus, and print always starts fresh.' }"), 'the 1.44.5 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("c: 'imp', t: 'Colours now flow through named tokens, identical pixels.' }"), 'the 1.44.4 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("c: 'fix', t: 'Swiping the date picker shows the months gliding under your finger.' }"), 'the 1.44.3 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("t: 'The date picker swipes and arrow-keys through months.' }"), 'the 1.44.2 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("t: 'Every label now shares one fixed type scale.' }"), 'the 1.44.1 pointer reads as approved, inside the twelve-word cap');
      R.ok(src.includes("t: 'Type help in chat to see every command.' }") && src.includes("t: 'Re-importing a roster month reports what changed.' }") && src.includes("t: 'Arrow keys change months on the roster calendar.' }"), 'the 1.44.0 pointers read as approved, inside the twelve-word feature cap');
      const cmpV = (x, y) => { const A = x.split('.').map(Number), B = y.split('.').map(Number); return (A[0] - B[0]) || (A[1] - B[1]) || (A[2] - B[2]); };
      const badCat = [], badDate = [];
      entries.forEach((en) => {
        en.items.forEach((it) => { if (['new', 'fix', 'imp', 'fun'].indexOf(it.c) === -1) badCat.push(en.v + ':' + it.c); });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(en.d)) badDate.push(en.v + ' (missing date)');
      });
      R.ok(badCat.length === 0, `every changelog pointer carries a valid category (E6)${badCat.length ? ': ' + badCat.slice(0, 5).join(', ') : ''}`);
      R.ok(badDate.length === 0, `every changelog version carries a release date (E6)${badDate.length ? ': ' + badDate.slice(0, 5).join(', ') : ''}`);
      R.ok(entries.filter((en) => en.d).length === entries.length, `the owner-supplied inception timeline dates the pre-history too - all ${entries.length} versions (E6)`);
    }
    // the delta machinery + the scrollable, headered list (owner spec)
    R.ok(src.includes('function wnPendingEntries') && src.includes("localStorage.getItem('crewAssist.wnSeen')"), "what's new tracks the version the crew last saw (E6)");
    R.ok(src.includes('function wnSeenVersion') && src.includes('APP_CHANGELOG[1] && APP_CHANGELOG[1].v'), 'a pre-changelog device defaults to the release before current (E6)');
    R.ok(/id="whatsnew-list"[^>]*max-h-\[50vh\] overflow-y-auto/.test(src), "the what's-new list scrolls when a big jump brings many versions (E6)");
    // hotfix 8 (owner order): no surface — changelog or What's New — tells
    // how Developer Mode unlocks; the feature itself stays listed
    R.ok(!src.includes('ten logo taps') && !src.includes('ten taps') && !src.includes('10 taps'), 'the changelog never tells how Developer Mode unlocks (owner order)');
    R.ok(src.includes("t: 'Hidden Developer Mode, edits calculation modifiers via JSON.'"), 'the Developer Mode line stays - only its unlock is secret');
    R.ok(src.includes('function renderChangelogInto'), "the What's New delta keeps its renderer (E6)");
    R.ok(src.includes('function renderChangelogSheet') && src.includes('id="ca-cl-chips"') && src.includes('id="ca-cl-sort"') && src.includes('id="ca-cl-summary"'), 'the Settings changelog renders its own filterable, sortable view (E6)');
    R.ok(src.includes('id="ca-changelog-sheet"') && src.includes('id="btn-changelog"'), 'Settings opens the full changelog overlay (E6)');
    // ---- v1.33.0: the review batch (contrast, targets, SR, CSV, hints) ----
    R.ok(src.includes('ui-input text-gray-600 ob-gender-btn'), 'unselected onboarding buttons read at gray-600 (was 2.26:1)');
    R.ok(src.includes("sr.className = 'sr-only'; sr.textContent = ' "), 'undo toasts speak their deadline to screen readers');
    R.ok(src.includes('.ca-arch-iconbtn { width: 48px; height: 48px;'), 'archive icon buttons are 48px');
    R.ok(src.split('px-4 py-3.5 min-h-[48px] text-xs').length === 5, 'all four quick chips are min-48px tall');
    R.ok(src.includes('class="p-3.5 rounded-full'), 'sheet close buttons are 48px');
    R.ok((src.match(/class="p-3 rounded-full hover:bg-black\/5 dark:hover:bg-white\/5 transition-colors text-gray-600 dark:text-gray-300"/g) || []).length === 4, 'v1.39.0 hotfix: the four header icons pack at 44px so they stop eating the title');
    // hotfix 12 (owner order): while the chat types, calendar / settings /
    // refresh stand down with the other busy controls; the theme button
    // never rests. CSS-only, no JS guards — the tour taps these buttons
    // programmatically and .click() ignores pointer-events.
    {
        const busyCss = (src.match(/html\.chat-busy[^{]*\{[^}]*pointer-events: none;[^}]*opacity: 0\.45;[^}]*\}/g) || []).join('\n');
        R.ok(busyCss.includes('html.chat-busy #btn-roster-cal') && busyCss.includes('html.chat-busy #btn-settings') && busyCss.includes('html.chat-busy #btn-reset'), 'hotfix 12: chat-busy CSS dims and locks the calendar, settings and refresh buttons');
        R.ok(!busyCss.includes('#btn-theme'), 'hotfix 12: the theme button is never in a chat-busy lockout — it stays tappable at all times');
    }
    // ---- hotfix 13 (owner report, Magic V3 foldable): sheets that stick
    // and the gold line ----
    {
        // the glide: every sheet opens through the shared helper — a forced
        // reflow pins the start pose (a close's display:none can cancel the
        // glide, and the next open then never starts), and two heal passes
        // (+450 restart, +900 snap) never leave a sheet below the fold
        R.ok(src.includes('function caSheetGlideIn') && src.includes('function caSheetGlideStuck'), 'hotfix 13: the shared sheet glide exists (start-pose reflow + heal passes)');
        R.ok(src.split('caSheetGlideArm(').length >= 10, 'hotfix 13 + round 20: every sheet opener routes through the shared glide arm (' + (src.split('caSheetGlideArm(').length - 1) + ' call sites)');
        R.ok(/function caSheetGlideIn[\s\S]*?void sheet\.offsetHeight;\s*\n\s*if \(shade\) shade\.classList\.remove\('opacity-0'\);\s*\n\s*sheet\.classList\.remove\('translate-y-full'\);/.test(src), 'the glide pins the start pose with a forced reflow BEFORE the class change');
        R.ok(/function caSheetGlideIn[\s\S]*?\}, 400\)/.test(src) && /function caSheetGlideIn[\s\S]*?\}, 750\)/.test(src), 'the heal passes arm at +400ms (restart) and +750ms (snap)');
        R.ok(src.includes("const gone = () => !sheet.isConnected || sheet.classList.contains('translate-y-full');"), 'a heal pass stands down the moment its sheet closes');
        // the gold line: the focus catch is invisible. On a first launch the
        // onboarding's keyboard typing leaves :focus-visible in keyboard
        // modality, the trap's programmatic focus inherits it, and the
        // full-bleed sheet drew a 2px gold outline whose top edge read as a
        // gold line across the overlay.
        R.ok(src.includes('sheet.classList.add(\'ca-focuscatch\');') && src.includes('.ca-focuscatch:focus, .ca-focuscatch:focus-visible { outline: none !important; }'), 'hotfix 13: the focus catch never draws the gold outline');
    }
    // ---- hotfix 14 (owner report: "some of the calendar contents are not
    // rendering/displaying properly" on the foldable): the stale hide timer —
    // a close armed a 300ms display:none, a quick reopen un-hid the wrap,
    // and the stale timer then fired mid-open (the calendar collapsed and
    // its scroll-flip "corrected" to the first month). Opens cancel, closes
    // arm, through one shared pair — no bare hide timers anywhere.
    R.ok(src.includes('function caSheetHideArm') && src.includes('function caSheetHideCancel'), 'hotfix 14: the shared hide-arm/cancel pair exists');
    R.ok(src.split('caSheetHideCancel(').length - 1 >= 12, 'hotfix 14: every opener cancels a pending hide (' + (src.split('caSheetHideCancel(').length - 1) + ' cancels)');
    R.ok(src.split('caSheetHideArm(').length - 1 >= 10, 'hotfix 14: every closer arms through the pair (' + (src.split('caSheetHideArm(').length - 1) + ' arms)');
    R.ok(!/\}\);? ?\n?\s*setTimeout\(\(\) => \{ ?[a-zA-Z]+\.classList\.add\('hidden'\); ?\}, 300\)/.test(src), 'no bare 300ms hide timers survive outside the pair');
    R.ok(/function caSheetHideArm[\s\S]*?el\.__caHideT = setTimeout\(\(\) => \{ el\.__caHideT = null; el\.classList\.add\('hidden'\); \}, ms \|\| 300\);/.test(src), 'the arm clears any prior timer before arming (double-close never double-arms)');
    // hotfix 15 (owner report: the calendar renders improperly on the
    // foldable's INNER screen only — fine on PC, iPhone and the cover
    // screen): Chrome on Android inflates text on wide mobile viewports via
    // its text autosizer. The cover screen is too narrow to trigger it,
    // desktop Chrome and iOS Safari never apply it — so the wide inner
    // screen was the one place the app rendered at a different text scale,
    // and the inflation is per-block (non-uniform), which misaligns the
    // pixel-tuned cards. The lock makes every screen draw the design as-is.
    R.ok(/html \{\s*\n\s*-webkit-text-size-adjust: 100%;\s*\n\s*text-size-adjust: 100%;\s*\n\s*\}/.test(src), 'hotfix 15: the text autosizer is locked to 100% — the inner screen renders at the designed text scale');
    R.ok((src.match(/will-change/g) || []).length === 3 && (src.match(/width:300%;will-change:transform;transform:translateX\(-33\.3333%\)/g) || []).length === 2 && src.includes('width:200%;will-change:transform;transform:translateX('), 'exactly three will-changes survive — the calendar\u2019s drag track and glide track plus the date picker\u2019s swipe track (v1.44.2), all born with their layer and destroyed when they land (hotfix 17+18); nothing at rest carries one');
    R.ok(!src.includes("el.innerHTML = html;") && src.includes('rcTL.diff[ymd] = node;'), 'hotfix 17: the timeline window is diffed, never wiped — rows mount and unmount one at a time between stable spacers');
    // hotfix 16 (owner screenshots from the foldable's inner screen: the
    // grid / the timeline / both / the earnings sheets dropped whole regions
    // of content in tile-sized bands): the big sheets are 95%-opaque yet
    // carried a live backdrop-filter blur, nested over full-screen blurred
    // shades — the compositor on the wide inner screen shed content under
    // the load. The sheets and every full-screen shade are blur-free now
    // (the blur was invisible under their own opacity/scrim); only the login
    // hero keeps its blur, and the small identity surfaces (header strip,
    // bubbles, the photo lightbox) keep theirs.
    R.ok(!/\.glass-sheet \{[^}]*backdrop-filter/.test(src), 'hotfix 16: the big sheets carry no live blur — a 95%-opaque surface never needed one');
    R.ok((src.match(/backdrop-blur-sm/g) || []).length === 1, 'exactly one backdrop-blur-sm survives (the login hero) — every full-screen shade is scrim-only');
    R.ok(!/\.ca-cl-vhead \{[^}]*backdrop-filter/.test(src), 'the changelog sticky header carries no blur (sticky + blur inside a scroller is a classic Android paint-killer)');
    // hotfix 18 (owner: the same hold-and-move flicker persisting after all
    // four hotfix-17 fixes — the remaining causes were motion-frame costs a
    // headless rig can never see: a runtime CSS compiler observing every
    // mutation, live blur passes on the always-visible chrome, promotion
    // frames, per-event geometry, and rest-time work run mid-gesture):
    R.ok(!/\.glass-panel \{[^}]*backdrop-filter/.test(src) && src.includes('--glass-solid-bg'), 'hotfix 18: the always-visible chrome (sticky header, chips, cards) carries no live blur — the same treatment the sheets got in hotfix 16');
    R.ok(src.includes('<link rel="stylesheet" href="./tw.css">') && !src.includes('cdn.tailwindcss.com'), 'hotfix 18: styles are the compiled ./tw.css — no runtime JIT compiler observes the document');
    R.ok(src.indexOf('<link rel="stylesheet" href="./tw.css">') > src.lastIndexOf('</style>', src.indexOf('<script')), 'hotfix 19: the compiled sheet loads AFTER the inline styles — the CDN always injected last, and app classes that set display (the archive toast) rely on the .hidden utility winning that tie');
    // v1.43.0 hotfix (owner order): every hover utility in the compiled
    // sheet sits behind (hover:hover) — a finger tap latches :hover on
    // touch, and an ungated wash would stick as a pressed state after
    // release (the same latch that washed out the gold toggle)
    {
        const twc = fs.readFileSync(__dirname + '/../tw.css', 'utf8');
        const gated = [false];
        let allHover = 0, badHover = 0;
        for (let i = 0; i < twc.length; i++) {
            const ch = twc[i];
            if (ch === '{') {
                const p = Math.max(twc.lastIndexOf('{', i - 1), twc.lastIndexOf('}', i - 1), 0);
                const head = twc.slice(p + 1, i).trim();
                gated.push(head.indexOf('@media') === 0 ? head.indexOf('hover:hover') !== -1 : gated[gated.length - 1]);
            } else if (ch === '}') gated.pop();
            else if (ch === ':' && twc.indexOf('hover', i) === i + 1 && twc.slice(i - 5, i) !== 'hover') { allHover++; if (!gated[gated.length - 1]) badHover++; }
        }
        R.ok(allHover > 0, 'the compiled sheet still carries hover utilities');
        R.eq(badHover, 0, 'v1.43.0 hotfix: every hover utility compiles behind (hover:hover) — a finger tap can never latch one');
        R.ok(twc.indexOf('@media (hover:hover)') !== -1, 'the hover gate is present in the compiled sheet');
        R.ok(src.indexOf('@media (hover:hover)') < src.indexOf('.ca-arch-iconbtn:hover'), 'v1.43.0 hotfix: the inline hover rules stay inside their (hover:hover) gate too');
    }
    R.ok(src.includes('id="ca-tw-probe"') && src.includes('function caTwLoaded()'), 'the shell guard probes the live stylesheet (the sentinel span) instead of a CDN global');
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
    R.ok((src.match(/text-sia-navy\/70 dark:text-white\/25/g) || []).length === 2, 'the tagline and semver read navy/70 + white/25 (v1.37.0: the stamps step up from white/15)');
    R.ok(src.includes('placeholder-gray-600 dark:placeholder-gray-400'), 'the onboarding name placeholder reads at gray-600 in daylight');
    R.ok(src.includes('whatsnew-close" class="absolute top-3 right-3 p-3.5'), 'the What\u2019s New close button joins the 48px standard');
    R.ok(src.includes('sta: f.staHm'), 'roster imports record each flight\u2019s arrival time');
    R.ok(src.includes('function nextFlightExpirySweep'), 'a sweep retires landed flights from the card');
    R.ok(src.includes('setInterval(caRealtimeSweep, 60000)'), 'the sweep runs every minute while the app is open');
    R.ok(src.includes("document.addEventListener('visibilitychange', () => { if (!document.hidden) caRealtimeSweep(); })"), 'returning to the screen triggers an immediate sweep');
    R.ok(src.includes("In the air &middot; lands ' + nfCountdown("), 'a leg in the air shows a live landing countdown');
    // ---- v1.33.2: the earnings schedule model follows landings ----
    R.ok(src.includes("cardRoot.setAttribute('data-duty-end'"), 'roster-built cards carry their duty landing');
    R.ok(src.includes('rec.endAt = dutyEnd'), 'save payloads record the duty landing time');
    R.ok(src.includes('function archEntryLanded'), 'a duty counts as flown once it has landed');
    R.ok(src.includes('function archLandedSweep'), 'the earnings sheet sweeps for landings');
    R.ok(src.includes('const caRealtimeSweep = () => { nextFlightExpirySweep(); archLandedSweep(); renderLayoverTzCard(); nfAlarmSweep(); };'), 'both real-time tracks — plus the layover clock and the alarm window — share one sweep cadence');
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
    // --- v1.35.0 hotfix 5: settings polish ---
    R.ok((c.d.getElementById('settings-avatar') || {}).textContent === 'T', 'the profile row shows a gold-ringed avatar with the initial');
    R.ok((c.d.getElementById('settings-semver') || {}).textContent === 'CrewAssist v' + c.w.APP_VERSION, 'settings carries a CrewAssist vX footer');
    const learnCopy = c.d.getElementById('settings-scroll').textContent;
    R.ok(learnCopy.includes('Usually replies within a few hours'), 'the developer row sets reply expectations');
    R.ok(learnCopy.includes('Placeholder'), 'v1.42.0: the tour row subtitle is a placeholder pending the tour overhaul');
    R.ok(learnCopy.includes('Features, fixes and improvements'), 'the changelog row subtitles its categories');
    R.ok((c.d.getElementById('btn-edit-profile') || {}).className.includes('w-32'), 'the profile Edit button runs the standard width');
    R.ok((c.d.querySelector('a[href="https://t.me/harlequinzxc"]') || {}).className.includes('w-32'), 'the Telegram button runs the standard width');
    R.ok((c.d.getElementById('btn-replay-tour') || {}).className.includes('w-32'), 'Replay runs the standard width');
    R.ok((c.d.getElementById('btn-changelog') || {}).className.includes('w-32'), 'View runs the standard width');
    R.ok((c.d.querySelector('#btn-replay-tour i[data-lucide]') || {}).getAttribute('data-lucide') === 'play', 'the tour button uses the play icon');
    R.ok((c.d.querySelector('a[href="https://t.me/harlequinzxc"] i[data-lucide]') || {}).getAttribute('data-lucide') === 'send', 'the Telegram button uses the send icon');
    const clBadge = c.d.getElementById('calcui-desc-badge');
    R.ok(clBadge && clBadge.textContent.includes('Recommended'), 'the Default badge still says Recommended');
    R.ok(clBadge.className.includes('ca-badge-green'), 'the Recommended badge is the green pill');
    R.ok((clBadge.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide') === 'star', 'the badge star is a lucide star');
    R.ok((c.d.getElementById('calcui-desc') || {}).textContent.includes('fill in automatically'), 'the Smart automation description is the owner copy');
    c.d.getElementById('btn-changelog').click();
    await cUntil(() => !c.d.getElementById('ca-changelog-sheet').classList.contains('hidden'), 3000);
    await cUntil(() => (c.d.getElementById('ca-changelog-list') || {}).childElementCount > 50, 3000);
    const clHeads = [...c.d.querySelectorAll('#ca-changelog-list .ca-micro')].map((h) => h.textContent);
    R.ok(clHeads.length >= 60, `the changelog lists every version (${clHeads.length} headers)`);
    R.ok(clHeads[0].includes(c.w.APP_VERSION), 'the changelog opens on the current version');
    R.ok(clHeads[clHeads.length - 1].includes('1.0.0'), 'the changelog reaches back to inception (v1.0.0)');
    R.ok((c.d.getElementById('ca-changelog-cur') || {}).textContent === c.w.APP_VERSION, 'the changelog names the running version');
    // --- v1.35.0 hotfix 3: the redesigned sheet (filters, sort, summary, badges) ---
    const vheads = () => [...c.d.querySelectorAll('#ca-changelog-list .ca-cl-vhead')];
    const headCount = vheads().length;
    R.ok(headCount >= 60, `the redesigned list groups every version (${headCount} headers)`);
    R.ok(vheads()[0].textContent.includes('CURRENT'), 'an up-to-date device sees the CURRENT badge on the running version');
    R.ok(vheads().every((h) => !h.textContent.includes('NEW')), 'an up-to-date device sees no NEW badges');
    R.ok(vheads()[headCount - 1].textContent.includes('1.0.0'), 'the oldest header is the inception release');
    R.ok((c.d.getElementById('ca-cl-sumline') || {}).textContent.includes('caught up'), 'the summary card reads all-caught-up for an up-to-date device');
    {
      // v1.36.0: pills appear only when the current release carries new/imp
      // items — a fixes-only release honestly shows zero. Derive from source.
      const fs = require('fs');
      const clSrc = fs.readFileSync(APP, 'utf8');
      const firstBlock = (clSrc.match(/APP_CHANGELOG = \[\s*\{ v: '[^']+', d: '[^']*', items: \[([\s\S]*?)\n\s*\]/) || [])[1] || '';
      const expectPills = /c: '(new|imp)'/.test(firstBlock);
      const pillCount = (c.d.getElementById('ca-cl-sumpills') || {}).childElementCount;
      R.ok(expectPills ? pillCount >= 1 : pillCount === 0, `the summary card pills match the current release (feature items: ${expectPills}, pills: ${pillCount})`);
    }
    R.ok(c.d.defaultView.getComputedStyle(vheads()[0]).position === 'sticky', 'version headers stick to the top while scrolling');
    // a device one release behind: NEW badge + missed-updates summary
    c.w.eval('closeChangelog()');
    await cUntil(() => c.d.getElementById('ca-changelog-backdrop').classList.contains('hidden'), 3000);
    c.w.localStorage.setItem('crewAssist.wnSeen', '1.34.3');
    c.w.eval('openChangelog()');
    await cUntil(() => !c.d.getElementById('ca-changelog-sheet').classList.contains('hidden'), 3000);
    await cUntil(() => (c.d.getElementById('ca-changelog-list') || {}).childElementCount > 50, 3000);
    R.ok(vheads()[0].textContent.includes('NEW'), 'a device behind one release sees the NEW badge on the current version');
    {
      // v1.36.0: the missed count grows with every release — derive it from
      // the source changelog instead of hardcoding one release's item count.
      const fs = require('fs');
      const clSrc = fs.readFileSync(APP, 'utf8');
      const blocks = [...clSrc.matchAll(/\{ v: '([\d.]+)', d: '[^']*', items: \[([\s\S]*?)\] \}/g)];
      const cmp = (x, y) => { const A = x.split('.').map(Number), B = y.split('.').map(Number); return (A[0] - B[0]) || (A[1] - B[1]) || (A[2] - B[2]); };
      const n = blocks.filter((m) => cmp(m[1], '1.34.3') > 0).reduce((a, m) => a + (m[2].match(/\{ c: '/g) || []).length, 0);
      R.ok((c.d.getElementById('ca-cl-sumline') || {}).textContent.includes('You missed ' + n + ' updates'), `the summary card counts the missed updates (${n})`);
    }
    // filter chips narrow the list; groups without matches hide
    c.d.querySelector('#ca-cl-chips [data-filter="fix"]').click();
    const fixHeads = vheads();
    R.ok(fixHeads.length >= 1 && fixHeads.length < headCount, `the Fixes filter narrows the list (${fixHeads.length} of ${headCount} versions)`);
    R.ok([...c.d.querySelectorAll('#ca-changelog-list .ca-cl-tag')].every((t) => t.className.includes('ca-cl-tag-fix')), 'every visible row carries the FIX tag');
    // sort toggle flips to oldest-first
    c.d.getElementById('ca-cl-sort').click();
    {
      // v1.36.1: the view is still Fixes-filtered and the current release may
      // carry no fix pointers — expect the newest version that has one.
      const fs = require('fs');
      const fblocks = [...fs.readFileSync(APP, 'utf8').matchAll(/\{ v: '([\d.]+)', d: '[^']*', items: \[([\s\S]*?)\] \}/g)];
      const newestFix = ((fblocks.find((m) => /c: 'fix'/.test(m[2])) || [])[1]);
      R.ok(newestFix && vheads()[vheads().length - 1].textContent.includes(newestFix), `the sort flip puts the newest matching release last (${newestFix})`);
    }
    R.ok((c.d.querySelector('#ca-cl-sort i[data-lucide]') || {}).getAttribute('data-lucide') === 'arrow-up-wide-narrow', 'the sort icon flips to oldest-first');
    // empty state (the same branch a real empty filter result takes)
    c.w.eval("changelogState.filter = 'none'; renderChangelogSheet();");
    R.ok(!c.d.getElementById('ca-cl-empty').classList.contains('hidden'), 'a filter with no matches shows the empty state');
    R.ok((c.d.getElementById('ca-cl-empty') || {}).textContent.includes('No '), 'the empty state says so');
    // restore, then v1.35.0 hotfix 5: the relative-date ladder
    c.w.eval("changelogState.filter = 'all'; changelogState.sort = 'new'; renderChangelogSheet();");
    R.eq(c.w.eval("clRelDate('2026-10-02', new Date(2026, 9, 2, 15, 0))"), 'Today', 'ladder: same calendar day reads Today');
    R.eq(c.w.eval("clRelDate('2026-10-01', new Date(2026, 9, 2, 0, 30))"), 'Yesterday', 'ladder: calendar-day math, not clock math');
    R.eq(c.w.eval("clRelDate('2026-09-30', new Date(2026, 9, 2, 15, 0))"), '2 days ago', 'ladder: two days ago');
    R.eq(c.w.eval("clRelDate('2026-09-25', new Date(2026, 9, 2, 15, 0))"), 'Last week', 'ladder: seven days reads Last week');
    R.eq(c.w.eval("clRelDate('2026-09-18', new Date(2026, 9, 2, 15, 0))"), '2 weeks ago', 'ladder: fourteen days reads 2 weeks ago');
    R.eq(c.w.eval("clRelDate('2026-05-14', new Date(2026, 9, 2, 15, 0))"), 'May 14', 'ladder: older this year reads short month + day');
    R.eq(c.w.eval("clRelDate('2025-03-20', new Date(2026, 9, 2, 15, 0))"), 'Mar 2025', 'ladder: previous years read short month + year');
    R.eq(c.w.eval("clRelDate('2026-10-02T10:00:00', new Date(2026, 9, 2, 10, 1))"), 'Just now', 'ladder: under two minutes reads Just now');
    R.eq(c.w.eval("clRelDate('2026-10-02T10:00:00', new Date(2026, 9, 2, 10, 2))"), 'Today', 'ladder: two minutes on the dot reads Today');
    // labels freeze at the open-time stamp and never switch while the sheet is up
    c.w.eval('clNow = new Date(2026, 9, 2, 12, 0, 0); renderChangelogSheet();');
    R.ok(vheads()[0].textContent.includes('Today'), 'the current release reads Today against the open-time stamp');
    R.ok(vheads()[headCount - 1].textContent.includes('4 weeks ago'), 'the inception reads 4 weeks ago against the open-time stamp');
    // --- v1.35.0 hotfix 6: the scroll-to-top button ---
    const clScroll = c.d.getElementById('ca-changelog-scroll');
    const clTop = c.d.getElementById('ca-cl-top');
    R.ok(!!clTop && clTop.className.includes('opacity-0'), 'the scroll-to-top button starts hidden at the top');
    R.ok((clTop.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide') === 'chevron-up', 'the scroll-to-top button points up');
    clScroll.scrollTop = 600;
    clScroll.dispatchEvent(new c.w.Event('scroll'));
    R.ok(clTop.className.includes('opacity-100'), 'the scroll-to-top button appears once the list is scrolled');
    const origScrollTo = clScroll.scrollTo;
    let scrollToArgs = null;
    clScroll.scrollTo = (opt) => { scrollToArgs = opt; };
    clTop.click();
    R.ok(scrollToArgs && scrollToArgs.top === 0 && scrollToArgs.behavior === 'smooth', 'tapping it smooth-scrolls the list to the top');
    clScroll.scrollTo = origScrollTo;
    clScroll.scrollTop = 0;
    clScroll.dispatchEvent(new c.w.Event('scroll'));
    R.ok(clTop.className.includes('opacity-0'), 'the button hides again at the top');
    clScroll.scrollTop = 600;
    clScroll.dispatchEvent(new c.w.Event('scroll'));
    c.w.eval('renderChangelogSheet()');
    R.ok(clScroll.scrollTop === 0 && clTop.className.includes('opacity-0'), 'a re-render jumps the list back to the top and hides the button');
    c.d.getElementById('ca-changelog-close').click();
    await cUntil(() => c.d.getElementById('ca-changelog-backdrop').classList.contains('hidden'), 3000);
  }
  {
    // ---- v1.37.0: Escape closes the top sheet; nudges fire once ----
    const e = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
    } });
    const eUntil = mkUntil(e.d);
    e.w.eval('openSettings()');
    await eUntil(() => !e.d.getElementById('settings-sheet').classList.contains('translate-y-full'), 3000);
    e.d.dispatchEvent(new e.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.ok(e.d.getElementById('settings-sheet').classList.contains('translate-y-full'), 'v1.37.0: Escape closes the open settings sheet');
    // the roster-import nudge: the second manual card earns it, exactly once
    e.w.localStorage.removeItem('crewAssist.nudgedRoster');
    e.w.localStorage.setItem('crewAssist.manualCards', '1');
    e.w.eval("renderCalculatorCard('ifa')");
    R.ok(await eUntil(() => (e.d.getElementById('chat-container').textContent || '').includes('roster PDF'), 6000), 'v1.37.0: the second manual card suggests attaching the roster PDF');
    R.eq(e.w.localStorage.getItem('crewAssist.nudgedRoster'), '1', 'the roster hint stamps itself as shown');
    const chat = () => e.d.getElementById('chat-container').textContent || '';
    const nudgeCount = () => (chat().match(/roster PDF/g) || []).length;
    const before = nudgeCount();
    e.w.eval("renderCalculatorCard('ifa')");
    await wait(1800);
    R.eq(nudgeCount(), before, 'the roster hint never repeats on later cards');
    // the Manual-interface hint: three hand edits to Fetch-owned fields
    e.w.localStorage.removeItem('crewAssist.nudgedCalcUi');
    const tField = e.d.querySelector('input[id$="-ifa-t1"]');
    R.ok(!!tField, 'a fresh card exposes the trip-number field Fetch would fill');
    for (let i = 0; i < 3; i++) { tField.value = 'SQ6' + i; tField.dispatchEvent(new e.w.Event('input', { bubbles: true })); }
    R.ok(await eUntil(() => chat().includes('Prefer filling every field by hand?'), 6000), 'v1.37.0: the third hand edit offers the Manual interface');
    R.eq(e.w.localStorage.getItem('crewAssist.nudgedCalcUi'), '1', 'the Manual-mode hint stamps itself as shown');
    // the install hint: a browser-tab user with saved earnings hears it once
    e.w.localStorage.removeItem('crewAssist.installHintDone');
    e.w.localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 'n1', monthKey: '2026-10', savedAt: '2026-10-01T00:00:00.000Z', amount: 120 }]));
    e.w.eval('maybeInstallHint()');
    R.ok(!e.d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'v1.37.0: a browser-tab user with saved earnings gets the install card');
    R.ok((e.d.getElementById('app-dialog-msg').textContent || '').includes('Add to Home Screen'), 'the install card names the Add to Home Screen action');
    R.eq(e.w.localStorage.getItem('crewAssist.installHintDone'), '1', 'the install card shows only once');
    e.d.getElementById('app-dialog-ok').click();
  }

  {
    // ---- v1.38.0: SGT landing conversions (A2) + the storage panel (B9) ----
    // v1.45.5: the 802 seed was pinned to the authoring day (2026-10-20) —
    // one day later the "upcoming" flight had landed and three pins rotted.
    // Tomorrow-relative now, so the seed can never age out.
    const __d = new Date(Date.now() + 86400000);
    const __ty = __d.getFullYear() + '-' + String(__d.getMonth() + 1).padStart(2, '0') + '-' + String(__d.getDate()).padStart(2, '0');
    const f = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 'S1', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-01', flightType: 'Turnaround', stationDisplay: 'KUL', amount: 100 }]));
      x.localStorage.setItem('SQ802:' + __ty + ':CABINS', '{}');
      x.localStorage.setItem('SQ999:2026-10-01:CABINS', '{}');
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ [__ty.slice(0, 7)]: [{ fn: '802', ymd: __ty, std: '09:45', sta: '18:35' }] }));
    } });
    // A2: the conversions are zone math, so DST and the :45 offsets are exact
    f.w.eval("window.__sgtOf = (ymd, hm, zone) => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(zonedWallToUtcMs(ymd, hm, zone)));");
    R.eq(f.w.eval("__sgtOf('2026-10-04','18:35','Asia/Tokyo')"), '17:35', 'a Tokyo landing reads one hour behind in SGT');
    R.eq(f.w.eval("__sgtOf('2026-07-04','18:35','Europe/London')"), '01:35', 'summer London is seven hours behind');
    R.eq(f.w.eval("__sgtOf('2026-12-04','18:35','Europe/London')"), '02:35', 'winter London is eight hours behind — the date carries the DST');
    R.eq(f.w.eval("__sgtOf('2026-07-01','21:55','Asia/Kathmandu')"), '00:10', 'Kathmandu’s :45 offset lands past SGT midnight');
    R.eq(f.w.eval("landingSgtPhrase('NRT','2026-10-04','18:35')"), '17:35 SGT', 'the phrase renders as 17:35 SGT');
    R.eq(f.w.eval("landingSgtPhrase('SIN','2026-10-04','18:35')"), '', 'Singapore landings need no conversion');
    R.eq(f.w.eval("landingSgtPhrase('ZZZ','2026-10-04','18:35')"), '', 'unknown stations never get a guessed offset');
    const ov = f.w.eval("overviewBlock('story', { sectors: [ {fn:'802', dep:'SIN', arr:'NRT', std:'09:45', sta:'18:35', arrYmd:'2026-10-04'} ] })");
    R.ok(ov.indexOf('Flight Overview') !== -1 && ov.indexOf('story') !== -1, 'the Flight Overview stays the prose story');
    R.ok(ov.indexOf('lands') === -1, 'hotfix: the per-sector itinerary rows were withdrawn by owner order (conversions moved to the next-flight card)');
    R.eq(f.w.eval("landingSgtPhrase('KUL','2026-10-04','11:27')"), '', 'a station on SG\u2019s own clock never shows a redundant conversion');
    // B9: the storage panel
    f.w.eval('openSettings()');
    await wait(150);
    const st = f.d.getElementById('settings-storage');
    R.ok(!!st && st.textContent.indexOf('Earnings entries') !== -1, 'v1.38.0: settings renders the storage panel with the entry count');
    R.ok(st.textContent.indexOf('Saved menus (flights)') !== -1 && st.textContent.indexOf('browser estimate') !== -1, 'menu counts show and the usage figure is labelled an estimate');
    R.ok(st.textContent.indexOf('1 upcoming duty flight keeps their menus') !== -1, 'the panel names the protected upcoming menus');
    const clr = f.d.getElementById('btn-clear-menus');
    R.ok(!!clr, 'the clear action exists');
    R.ok(clr.className.includes('text-[color:var(--ca-danger-strong)]') && clr.className.includes('border-[color:var(--ca-danger-strong-line)]'), 'hotfix: Clear saved menus runs the red destructive style (rides --ca-danger-strong since round 3 value 2)');
    clr.click();
    R.ok(clr.textContent.indexOf('Tap again to clear') !== -1, 'the first tap arms instead of firing');
    clr.click();
    await wait(80);
    R.eq(f.w.localStorage.getItem('SQ999:2026-10-01:CABINS'), null, 'an unrelated saved menu clears');
    R.ok(!!f.w.localStorage.getItem('SQ802:' + __ty + ':CABINS'), 'an upcoming duty’s menu survives the clear');
    R.ok(st.textContent.replace(/\s+/g, ' ').indexOf('Saved menus (flights)1') !== -1, 'counts refresh after the clear');
  }

  {
    // ---- v1.39.0 (B7): natural calculator commands in the chat ----
    // the clock is pinned just before the seeded legs (6/8 Oct 2026): the
    // commands below speak in month-day words ("6 oct"), and once 6 Oct
    // passes in real time the year-rollover maps them to 2027 and the
    // roster lookup misses — a date-stable block, not a today-relative one
    const g = await boot(APP, { now: '2026-10-05T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-10': [
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' },
        { fn: '807', dep: 'NRT', arr: 'SIN', ymd: '2026-10-08', std: '20:30', sta: '06:29', staYmd: '2026-10-09' },
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-04', std: '09:00', sta: '10:10', staYmd: '2026-10-04' },
        { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-04', std: '10:25', sta: '11:45', staYmd: '2026-10-04' }
      ] }));
    } });
    const gUntil = mkUntil(g.d);
    const idle = async () => gUntil(() => !g.w.eval('isChatBusy()'), 9000);
    const send = async (t) => { await idle(); g.w.eval('processInput(' + JSON.stringify(t) + ')'); await wait(250); return idle(); };
    // the menu nudge can land mid-block (flights inside 48h) — assert on the
    // whole chat, never on \u201cthe last bubble\u201d
    const chatTxt = () => g.d.getElementById('chat-container').textContent.replace(/\s+/g, ' ');
    const cards = () => Array.from(g.d.querySelectorAll('[data-calc-card]'));
    await wait(1500); await idle();

    // the parser: clean pairs only — a typo falls through to the old engine
    R.eq(g.w.eval("parseNaturalCommand('sq802 4 oct sq807 5 oct').pairs.map(p => p.fn).join(',')"), '802,807', 'bare phrasing parses as flight pairs with no mode');
    R.eq(g.w.eval("parseNaturalCommand('IFA SQ802 4oct').mode"), 'ifa', 'mode word + glued date parse case-insensitively');
    // nearest-upcoming year: "oct 4" is 2026 while it hasn't passed, 2027 after
    const oct4Year = g.w.eval("(function(){ const t = todayLocalYMD(); return (t <= '2026-10-04') ? '2026' : '2027'; })()");
    R.eq(g.w.eval("parseNaturalCommand('cop sq 802 oct 4').pairs[0].ymd"), oct4Year + '-10-04', 'spaced flight and month-first dates both parse');
    R.eq(g.w.eval("!!parseNaturalCommand('what can you do')"), false, 'ordinary sentences never parse as commands');

    // v1.44.0 hotfix (owner spec): the help card is a structured onboarding
    // surface — gold icon-tile header, four tappable command rows (Lucide
    // category glyphs, bold gold monospaced keywords, input-token pills),
    // dimmer tips with Lucide dots, and ONE outlined CTA that starts the
    // feature tour
    {
        const hsrc = require('fs').readFileSync(APP, 'utf8');
        const helpCards = () => g.d.querySelectorAll('[data-ca-help-card]').length;
        const h0 = helpCards();
        await send('help');
        R.eq(helpCards(), h0 + 1, 'a bare help answers with the structured card');
        const card = g.d.querySelector('[data-ca-help-card]');
        const htxt = card.textContent.replace(/\s+/g, ' ');
        R.ok(htxt.indexOf('Quick shortcuts') >= 0 && htxt.indexOf('Type or tap any command below') >= 0, 'the header pairs a bold title with a quiet subtitle');
        R.ok(!!card.querySelector('[data-lucide="lightbulb"]'), 'the header tile is Lucide lightbulb \u2014 icons only, never emoji');
        const rows = Array.from(card.querySelectorAll('[data-ca-help-cmd]'));
        R.eq(rows.map((r) => r.getAttribute('data-ca-help-cmd')).join(','), 'menu,ifa,lma,cop', 'four command rows \u2014 menu, ifa, lma, cop, in that order');
        R.eq(rows.map((r) => r.querySelector('i[data-lucide]').getAttribute('data-lucide')).join(','), 'utensils,calculator,sandwich,map', 'each row carries its category glyph \u2014 utensils, calculator, sandwich, map');
        R.ok(rows.every((r) => r.tagName === 'BUTTON'), 'every row is a real button \u2014 tappable');
        const kw = rows[0].querySelector('span.font-mono');
        R.ok(!!kw && kw.textContent === 'menu' && kw.className.indexOf('text-sia-gold') >= 0 && kw.className.indexOf('text-sm') >= 0, 'the keyword is bold gold in the monospace face at the BODY rung');
        const tok = rows[1].querySelector('.ca-help-token');
        R.ok(!!tok && tok.textContent === 'sq802 4 oct' && tok.className.indexOf('font-mono') >= 0, 'the example argument rides beside the keyword as a monospaced input-token pill, never em-dash prose');
        R.ok(htxt.indexOf('Open a flight\u2019s inflight menus') >= 0 && htxt.indexOf('Price a whole trip, both allowances') >= 0, 'each row keeps its one-phrase description on the line below');
        R.eq(card.querySelectorAll('.ca-hairline').length, 2, 'two hairlines frame the command list');
        // tap: insert + focus + flash
        const inp = g.d.getElementById('chat-input');
        rows[0].click();
        R.eq(inp.value, 'menu ', 'tapping a row inserts keyword + trailing space into the composer');
        R.ok(g.d.activeElement === inp, 'the tap focuses the composer at the end');
        R.ok(rows[0].classList.contains('ca-help-flash'), 'the tapped row flashes gold');
        rows[1].click();
        R.eq(inp.value, 'ifa ', 'a second row tap replaces the draft with its own keyword');
        await wait(500);
        R.ok(!rows[0].classList.contains('ca-help-flash'), 'the flash fades on its own \u2014 no stuck state');
        inp.value = '';
        // tips: dimmer, Lucide dots, no emoji anywhere in the card
        const tips = Array.from(card.querySelectorAll('.ca-help-tip'));
        R.eq(tips.length, 3, 'three tips follow the second hairline');
        R.ok(tips.every((t) => !!t.querySelector('[data-lucide="dot"]')), 'tip bullets are Lucide dots');
        R.ok(htxt.indexOf('plain English') >= 0 && htxt.indexOf('Upload your roster PDF for longer trips') >= 0 && htxt.indexOf('Your attached roster answers first') >= 0, 'the tips carry the plain-English, roster-PDF, and roster-first notes');
        R.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}]/u.test(htxt), 'the card carries no emoji and no Unicode arrows');
        // the CTA owns the tour now
        const cta = card.querySelector('[data-ca-help-tour]');
        R.ok(!!cta && cta.textContent.indexOf('Take the feature tour') >= 0 && !!cta.querySelector('[data-lucide="arrow-right"]'), 'one outlined CTA \u2014 Take the feature tour, with a trailing arrow');
        // the boot does not seed tourOffered, so the greeting\u2019s tour offer can
        // still be typing here \u2014 while busy, html.chat-busy makes every chat
        // button inert (the real anti-double-fire behaviour). Wait it out,
        // exactly like a crew member who reads the card first.
        await idle(); await wait(250);
        cta.click();
        R.ok(await gUntil(() => g.d.documentElement.classList.contains('ca-tour-on'), 15000), 'the CTA starts the feature tour \u2014 help itself never did');
        await g.w.eval('finishCaTour(false, true)');
        R.ok(await gUntil(() => !g.d.documentElement.classList.contains('ca-tour-on'), 15000), 'the tour stands down cleanly for the rest of the suite');
        // the alias and the fallthrough keep their round-35 behaviour
        await send('?');
        R.eq(helpCards(), h0 + 2, 'a bare ? is the alias \u2014 the card answers again');
        await send('HELP');
        R.eq(helpCards(), h0 + 3, 'HELP parses case-insensitively like every command');
        await send('help me');
        R.eq(helpCards(), h0 + 3, 'only the bare word triggers \u2014 \u201chelp me\u201d falls through to the keyword engine untouched');
        // source wiring: the builder, the branch order, the delegated listener,
        // the composer\u2019s lost navy, the chips\u2019 scroll
        R.ok(hsrc.includes('function helpCardHtml()') && hsrc.includes('addBotMessage(helpCardHtml())'), 'the card is built by helpCardHtml() and the help branch renders it');
        R.ok(hsrc.includes("if (/^\\s*(help|\\?)\\s*$/.test(lowerText)) {") && hsrc.includes("else if (/\\btour\\b|show me around/.test(lowerText)) {"), 'help owns its own branch above the tour \u2014 the tour keeps \u201ctour\u201d and \u201cshow me around\u201d as its triggers');
        R.ok(hsrc.includes("closest('[data-ca-help-cmd]')") && hsrc.includes("closest('[data-ca-help-tour]')"), 'one delegated document-level listener wires every row and the CTA \u2014 re-render-proof');
        const comp = (hsrc.match(/<div class="glass-panel rounded-full flex items-center px-4 py-2 gap-2[^"]*"/) || [''])[0];
        R.ok(comp.length > 0 && comp.indexOf('bg-') < 0, 'the composer wears glass-panel\u2019s own charcoal \u2014 the navy override is gone');
        R.ok(hsrc.includes('id="action-chips" class="flex overflow-x-auto') && (hsrc.match(/action-chip shrink-0/g) || []).length >= 4, 'the suggestion chips scroll horizontally, each shrink-0 \u2014 no truncation');
    }

    // ifa: the card arrives prefilled from the roster (offline-honest)
    await send('ifa sq802 6 oct sq807 8 oct');
    const ifaCard = cards()[cards().length - 1];
    R.ok(!!ifaCard, 'ifa sq802 6 oct sq807 8 oct opens a calculator card');
    R.eq((ifaCard.querySelector('input[id$="-ifa-fn1"]') || {}).value, '802', 'sector 1 carries the first flight');
    R.eq((ifaCard.querySelector('input[id$="-ifa-d1"]') || {}).value, '2026-10-06', 'sector 1 carries the parsed date');
    R.eq((ifaCard.querySelector('input[id$="-ifa-t1"]') || {}).value, '08:42', 'sector 1 flight time derives from the roster\u2019s printed STD/STA');
    R.eq((ifaCard.querySelector('input[id$="-ifa-t2"]') || {}).value, '09:59', 'an overnight sector\u2019s time rolls past midnight honestly');

    // the LMA guards (owner rulings)
    await send('lma sq802 6 oct');
    R.ok(chatTxt().indexOf('LMA needs a layover') >= 0, 'a single sector cannot be an LMA');
    await send('lma sq106 4 oct sq105 4 oct');
    R.ok(chatTxt().indexOf('same-day turnaround') >= 0, 'LMA for a same-day turnaround is refused');

    // cop: the whole card, LMA station included
    await send('cop sq802 6 oct sq807 8 oct');
    const copCard = cards()[cards().length - 1];
    R.eq((copCard.querySelector('input[id$="-flight-type"]') || {}).value, 'Layover', 'an out-and-back across days preselects Layover');
    R.eq((copCard.querySelector('input[id$="-lma-iata1"]') || {}).value, 'NRT', 'the layover station prefills from the roster');
    R.eq((copCard.querySelector('input[id$="-lma-at1"]') || {}).value, '18:27', 'the station\u2019s arrival time prefills');
    R.eq((copCard.querySelector('input[id$="-lma-dt1"]') || {}).value, '20:30', 'the station\u2019s departure time prefills');

    // menu: the existing honest flows, straight from the chat
    Object.defineProperty(g.w.navigator, 'onLine', { value: false, configurable: true });
    await send('menu sq802 6 oct');
    R.ok(chatTxt().indexOf('offline') >= 0, 'menu for an unsaved flight offline stays honest');
    Object.defineProperty(g.w.navigator, 'onLine', { value: true, configurable: true });
    await send('menu sq802 6 oct sq807 8 oct');
    const legBtns = Array.from(g.d.querySelectorAll('button[class*=nat-cmd-btn-]')).filter((b) => !b.disabled);
    R.eq(legBtns.length, 2, 'a multi-leg menu command offers each leg');
    R.ok(legBtns[0].textContent.indexOf('SQ 802') >= 0 && legBtns[1].textContent.indexOf('SQ 807') >= 0, 'the leg buttons name their flights');

    // no mode word: the crew picks menus or the allowance
    await send('sq802 6 oct sq807 8 oct');
    const lastBubble = g.d.getElementById('chat-container').lastElementChild;
    const pick = Array.from(lastBubble.querySelectorAll('button[class*=nat-cmd-btn-]')).filter((b) => !b.disabled);
    R.eq(pick.map((b) => b.textContent.trim()).join('|'), 'Menus|COP allowance', 'a bare command offers menus or the COP allowance');
    pick[1].click();
    await idle(); await wait(500);
    const bareCard = cards()[cards().length - 1];
    R.eq((bareCard.querySelector('input[id$="-ifa-fn1"]') || {}).value, '802', 'the COP choice prefills the card');
    R.ok(pick[0].disabled && pick[1].disabled, 'the choice pair retires once pressed');
  }

  {
    // ---- round 18 (improvement #4): the date-picker day button's CSS is
    // ONE rule — the transition and the layout/typography declarations
    // merged (two same-specificity rules, disjoint properties, nothing
    // .cadate-day-matching between them, no media boundary crossed). jsdom
    // resolves the layout longhands; the transition shorthand it cannot
    // expand, so that rides a source pin. ----
    const { w } = await boot(APP, {});
    const cs = w.eval('(function(){ var b = document.createElement("button"); b.className = "cadate-day"; document.body.appendChild(b); var c = getComputedStyle(b); return { w: c.width, h: c.height, r: c.borderRadius, f: c.fontSize, fw: c.fontWeight, d: c.display }; })()');
    R.eq(cs.w, '2.25rem', 'cadate-day: the merged rule keeps its width');
    R.eq(cs.h, '2.25rem', 'cadate-day: the merged rule keeps its height');
    R.eq(cs.r, '9999px', 'cadate-day: the merged rule keeps its pill radius');
    R.eq(cs.f, '0.875rem', 'cadate-day: the day cells sit at the 14px day-number rung (v1.44.1 typography round)');
    R.eq(cs.fw, '700', 'cadate-day: the merged rule keeps its weight');
    R.eq(cs.d, 'inline-flex', 'cadate-day: the merged rule keeps its display');
    const cssSrc = require('fs').readFileSync(APP, 'utf8');
    R.ok((cssSrc.match(/^ {8}\.cadate-day \{$/gm) || []).length === 1, 'cadate-day: exactly one standalone rule remains — the two same-specificity declarations are merged');
    R.ok(/\.cadate-day \{\n\s*transition: background-color 0\.2s ease, color 0\.2s ease, box-shadow 0\.2s ease, transform 0\.2s ease, opacity 0\.2s ease;\n\s*width: 2\.25rem;/.test(cssSrc), 'cadate-day: the merged rule carries both the transition and the layout in one block');
  }

  {
    // ---- v1.44.2 (owner order): the date picker navigates months the way
    // the roster calendar does — a pointer-driven three-thirds swipe (touch
    // and mouse alike) and the arrow keys, with the calendar's own guards:
    // the caret never loses its arrows to the picker, the closing window
    // stands down, and a live drag track owns the grid. ----
    const { w, d } = await boot(APP, {});
    const month = () => d.getElementById('cadate-month').textContent;
    const kd = (key, target) => {
      const ev = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      (target || d).dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    const pev = (type, x, y) => { const e = new w.Event(type, { bubbles: true }); e.clientX = x; e.clientY = y; d.getElementById('cadate-grid').dispatchEvent(e); };
    // open on a fixed date: October 2026, whatever the box clock says
    w.eval('(function(){ var i = document.createElement("input"); i.value = "2026-10-15"; openCaDatePicker(i, false, null, ""); })()');
    R.eq(month(), 'October 2026', 'the picker opens on its field\u2019s month');
    // the open sheds opacity-0 on a 10ms timer (the fade-in start); the
    // closing guard below rejects that class, so the arrows arm after it
    await wait(60);
    // keyboard: the arrows walk months and claim the key
    R.ok(kd('ArrowRight'), 'ArrowRight is claimed (preventDefault) while the picker is open');
    R.eq(month(), 'November 2026', 'ArrowRight walks to the next month');
    kd('ArrowLeft'); kd('ArrowLeft');
    R.eq(month(), 'September 2026', 'ArrowLeft walks back two');
    kd('ArrowRight', d.getElementById('chat-input'));
    R.eq(month(), 'September 2026', 'the caret guard holds \u2014 an input keeps its arrows');
    // swipe: engage builds the clone track, the drag stands the days down,
    // the release past threshold commits (the track WAS the glide)
    pev('pointerdown', 200, 300); pev('pointermove', 160, 300);
    R.ok(!!d.querySelector('#cadate-grid .ca-date-track') && d.getElementById('cadate-grid').classList.contains('ca-date-drag'), 'a horizontal drag builds the three-thirds track and stands the day cells down');
    // v1.44.3 (owner report): a present track is not a VISIBLE track \u2014 the
    // grid's place-items: center treated the 300%-wide track as ONE centered
    // grid item, a full grid-width off the finger, so the swipe glided over
    // nothing. The track must SPAN the whole grid pinned to start, and each
    // third must carry the resting grid's own template.
    const track = d.querySelector('#cadate-grid .ca-date-track');
    R.eq(track.children.length, 3, 'the track carries three month thirds');
    R.ok([].slice.call(track.children).every((c) => c.classList.contains('ca-date-third')), 'every third carries the ca-date-third grid class');
    R.ok(track.children[1].querySelectorAll('.cadate-day').length >= 28 && track.children[0].querySelectorAll('.cadate-day').length >= 27 && track.children[2].querySelectorAll('.cadate-day').length >= 27, 'all three thirds carry real month grids \u2014 the finger glides over months, never a void');
    const navSrc = require('fs').readFileSync(APP, 'utf8');
    R.ok(navSrc.includes('#cadate-grid.ca-date-drag { cursor: grabbing; overflow: hidden; }') && navSrc.includes('.ca-date-track {\n            grid-area: 1 / 1 / -1 / -1;\n            justify-self: start;\n            align-self: start;\n        }'), 'the track spans the whole 7x6 grid pinned to start \u2014 never a centered single cell (the v1.44.3 fix)');
    R.ok(navSrc.includes('.ca-date-third {\n            display: grid;\n            grid-template-columns: repeat(7, minmax(0, 1fr));\n            grid-template-rows: repeat(6, 2.25rem);'), 'each third carries the resting grid\u2019s own 7x6 template');
    pev('pointerup', 60, 300);
    await wait(400);
    R.eq(month(), 'October 2026', 'a leftward swipe past the threshold lands the next month \u2014 no second slide, the track was the glide');
    R.ok(!d.querySelector('#cadate-grid .ca-date-track') && !d.getElementById('cadate-grid').classList.contains('ca-date-drag'), 'the track and the drag class are gone after the commit');
    // a short drag springs back and the month is untouched
    pev('pointerdown', 200, 300); pev('pointermove', 180, 300); pev('pointerup', 190, 300);
    await wait(400);
    R.eq(month(), 'October 2026', 'a short drag springs back \u2014 the month is untouched');
    R.ok(d.querySelectorAll('#cadate-grid [data-ymd]').length >= 28, 'the restored grid carries its day buttons again');
    // a quick flick with no move events keeps the classic threshold
    pev('pointerdown', 200, 300); pev('pointerup', 40, 300);
    await wait(400);
    R.eq(month(), 'November 2026', 'a quick flick (no move events) rides the chevron slide to the next month');
    // a vertical drag never engages
    pev('pointerdown', 200, 300); pev('pointermove', 200, 220); pev('pointerup', 200, 150);
    await wait(150);
    R.eq(month(), 'November 2026', 'a vertical drag never turns into a month change');
    // once closed, the arrows no longer drive the picker
    w.eval('closeCaDatePicker()');
    await wait(400);
    kd('ArrowRight');
    R.eq(month(), 'November 2026', 'once the closing window has passed, the arrows no longer drive the picker');
    // source pins: the wiring and its guards
    R.ok(navSrc.indexOf('caDateMonthHtml(y, m - 1)') >= 0 && navSrc.indexOf('caDateMonthHtml(y, m + 1)') >= 0, 'the track\u2019s outer thirds are real months \u2014 never a void (the hotfix-17 lesson)');
    R.ok(navSrc.indexOf("document.getElementById(e.key === 'ArrowLeft' ? 'cadate-prev' : 'cadate-next')") >= 0 && navSrc.indexOf('#cadate-grid .ca-date-track') >= 0, 'the arrows drive the chevrons and stand down for a live drag');
    R.ok(navSrc.indexOf('.ca-date-track { user-select: none;') >= 0 && navSrc.indexOf('#cadate-grid.ca-date-drag .cadate-day { pointer-events: none; }') >= 0, 'the drag classes carry the calendar\u2019s own no-select + day stand-down');
  }

  // round 20: the ghost-sheet race — a close inside the 10ms glide window
  // must cancel the pending open (the smoke's fv pin exposed this; the
  // deterministic Chromium repro is recorded in HANDOVER task #3)
  {
    const fs20 = require('fs');
    const { w, d } = await boot(APP);
    w.eval('openSettings(); closeSettings();');
    await wait(500);
    R.ok(d.getElementById('settings-sheet').classList.contains('translate-y-full') && d.getElementById('settings-backdrop').classList.contains('hidden'), 'a close inside the 10ms glide window cancels the pending open — no ghost sheet over the chat');
    w.eval('openSettings();');
    await wait(250);
    R.ok(!d.getElementById('settings-sheet').classList.contains('translate-y-full'), 'a plain open still glides the sheet in');
    w.eval('closeSettings();');
    await wait(500);
    R.ok(d.getElementById('settings-sheet').classList.contains('translate-y-full') && d.getElementById('settings-backdrop').classList.contains('hidden'), 'a gapped open+close still closes cleanly');
    w.eval('openChangelog(); closeChangelog();');
    await wait(500);
    R.ok(d.getElementById('ca-changelog-sheet').classList.contains('translate-y-full') && d.getElementById('ca-changelog-backdrop').classList.contains('hidden'), 'the changelog sheet shares the cancellable glide');
    w.eval('openArchOverlay(); closeArchOverlay();');
    await wait(500);
    R.ok(d.getElementById('ca-arch-sheet').classList.contains('translate-y-full'), 'the archive sheet shares the cancellable glide too');
    const src20 = fs20.readFileSync(APP, 'utf8');
    R.eq((src20.match(/caSheetGlideIn\(/g) || []).length, 2, 'caSheetGlideIn is reachable from exactly one place now — inside the arm helper');
    R.eq((src20.match(/caSheetGlideArm\(/g) || []).length, 10, 'nine openers arm the glide through the shared helper');
    R.eq((src20.match(/caSheetGlideCancel\(/g) || []).length, 10, 'nine closers cancel it — closes cancel, opens arm');
  }

  // --- round 22 (owner review): accessible names, clean tail, one class list each ---
  {
    const fs22 = require('fs');
    // fresh boot: the sweep must see pristine static markup, not buttons
    // mutated by earlier pins (two-tap armed states etc.)
    const { d: d22 } = await boot(APP);
    const unlabelled = [...d22.querySelectorAll('button')]
      .filter(b => !b.textContent.trim() && (b.querySelector('i,svg,img')) && !b.getAttribute('aria-label') && !b.getAttribute('title'))
      .map(b => b.id);
    R.eq(unlabelled.length, 0, 'F-05: every icon-only button carries an accessible name (was: theme, settings, reset, send + four sheet closers)');
    R.ok(!d22.body.textContent.includes('script>'), 'F-01: no stray post-</html> text re-parented into <body>');
    const src22 = fs22.readFileSync(APP, 'utf8');
    R.eq((src22.match(/'text-black', 'bg-gradient-to-r', 'from-sia-goldlt', 'to-sia-gold', 'shadow-\[0_0_15px_rgba\(201,162,39,0\.3\)\]', 'border-transparent'/g) || []).length, 2, 'F-06: the gold-pill class list exists exactly twice (caGoldPillOn add + caGoldPillOff remove) — was six inlined sites across gender, rank and reset');
    R.eq((src22.match(/'opacity-0', 'scale-75', 'pointer-events-none'/g) || []).length, 2, 'F-06: the float-pill class list exists exactly twice (inside caPillPaint) — was two inlined sites');
    R.ok((src22.match(/target="_blank"/g) || []).length === (src22.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 'round 24: every _blank link carries rel="noopener noreferrer" (the Telegram link, and any future ones)');
  }

  // v1.45.0 (divergence #1a + the owner's binary toggle): the motion
  // guard, functionally — storage wins, absent follows the OS.
  {
      const m1 = await boot(APP, { seed: (x) => { x.localStorage.setItem('crewAssist.motion', 'reduced'); } });
      R.ok(m1.d.documentElement.classList.contains('ca-reduced'), "crewAssist.motion='reduced' marks html.ca-reduced at boot");
      R.eq(m1.w.eval('caMotionReduced()'), true, 'the guard resolves reduced from storage');
      const m2 = await boot(APP, { seed: (x) => { x.localStorage.setItem('crewAssist.motion', 'full'); } });
      R.ok(!m2.d.documentElement.classList.contains('ca-reduced'), "'full' forces motion on, overriding any OS request");
      const m3 = await boot(APP, {});
      R.ok(!m3.d.documentElement.classList.contains('ca-reduced'), 'an absent key follows the OS (jsdom reports no preference)');
      m3.w.eval("setMotionPref('reduced')");
      R.ok(m3.d.documentElement.classList.contains('ca-reduced'), 'tapping Reduced marks the marker immediately');
      R.eq(m3.w.eval("localStorage.getItem('crewAssist.motion')"), 'reduced', 'the tap persists crewAssist.motion');
      m3.w.eval("setMotionPref('full')");
      R.ok(!m3.d.documentElement.classList.contains('ca-reduced'), 'tapping Full clears the marker again');
      R.eq(m3.w.eval("localStorage.getItem('crewAssist.motion')"), 'full', 'and persists the Full choice');
      // v1.45.1 (owner hotfix 1): the typing bubble never appears under reduced motion
      m1.w.eval('showTypingIndicator()');
      R.ok(!m1.d.getElementById('typing-indicator'), 'reduced motion: the typing bubble never appears');
      m3.w.eval('showTypingIndicator()');
      R.ok(!!m3.d.getElementById('typing-indicator'), 'full motion: the typing bubble still shows');
      m3.w.eval('hideTypingIndicator()');
  }

  process.exit(R.done() ? 1 : 0);
})();
