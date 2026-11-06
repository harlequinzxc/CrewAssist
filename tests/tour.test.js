// The spotlight feature tour (v1.49.0; firing/completion/bold v1.49.1;
// copy pack part 2 + the chat revert v1.49.2): one lit target, one
// tooltip, one Next at a time. The veil blocks every tap; the copy is the
// owner's, verbatim (with **bold** markers since v1.49.1, in titles too
// since v1.49.2); the walk is data (docs/FEATURE_TOUR.md is the contract).
// This suite walks every tour end-to-end in jsdom — the network is
// offline, which is exactly what the menus tour's honest chip fallback is
// built for.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');

const mkUntil = (d) => async (cond, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 10000)) {
        let ok = false;
        try { ok = (typeof cond === 'string') ? !!d.querySelector(cond) : !!cond(); } catch (e) { ok = false; }
        if (ok) return true;
        await wait(250);
    }
    return false;
};
const tipText = (d) => d.getElementById('ca-spot-tip').textContent;

const PROFILE = JSON.stringify({ name: 'Tour Tester', gender: 'M', rank: 'FS' });

(async () => {
  const src = fs.readFileSync(APP, 'utf8');

  // ---- the registry is data: eight tours, the owner's order, 46 steps ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    R.eq(typeof w.caSpotStart, 'function', 'caSpotStart is global (Settings rows and the tour command reach it)');
    R.eq(Object.keys(w.CA_SPOT_TOURS).join(','), 'main,roster,manual,menus,earnings,calendar,stats,backup', 'eight tours, the owner\u2019s Settings order (menus below the manual cards)');
    const labels = Object.keys(w.CA_SPOT_TOURS).map((k) => w.CA_SPOT_TOURS[k].label).join(',');
    R.eq(labels, 'Main screen,Roster import,Manual flight cards,Menus & search,Earnings,Calendar,Flight Stats,Backup & restore', 'labels read as the Settings rows do');
    const counts = Object.keys(w.CA_SPOT_TOURS).map((k) => k + ':' + w.CA_SPOT_TOURS[k].steps.length).join(' ');
    R.eq(counts, 'main:7 roster:6 manual:6 menus:6 earnings:6 calendar:6 stats:5 backup:5', 'step counts: the chat bar leads the main tour, the roster walk gains the earnings step (v1.49.2), the calendar walks six, Flight Stats slimmed to five');
    const allSteps = Object.keys(w.CA_SPOT_TOURS).reduce((a, k) => a.concat(w.CA_SPOT_TOURS[k].steps), []);
    R.eq(allSteps.length, 47, 'forty-seven steps in all');
    R.ok(allSteps.every((s) => s && s.sel && s.title && s.line), 'every step carries a target, a title and a line');
  }

  // ---- the copy ships verbatim: every step's title and line, word for word ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    const pack = [
      // main + roster: the owner's v1.49.2 part-2 copy pack, ALL of it
      ['main', 0, '**At your service**', 'Ask about your flight or type "help" / "?" for quick commands.'],
      ['main', 1, '**Activate Your Dashboard**', 'Attach your roster report to unlock your flight calendar, calculated allowances, and flight insights.'],
      ['main', 2, '**Quick-Access Commands**', 'Instant answers for allowances, earnings, inflight menus, and menu prints.'],
      ['main', 3, '**Track Your Flights**', 'Access your full schedule, flight records, and personal crew stats in one place.'],
      ['main', 4, '**Theme Toggle**', 'Tap anytime to switch seamlessly between light and dark theme.'],
      ['main', 5, '**Account & Preferences**', 'Update your profile details, manage your saved data, or replay feature tours whenever you need.'],
      ['main', 6, '**Clear Screen**', 'Double-tap to clear your screen. Your saved data remains untouched.'],
      ['roster', 0, '**First, your Roster Report**', 'Upload your Roster Report PDF directly from CrewApp using the paperclip icon.'],
      ['roster', 1, '**Hands-Free Import**', 'Every line is analyzed automatically. All flights, dates, sectors, and reporting times are extracted instantly without you typing a thing.'],
      ['roster', 2, '**Seamless Integration**', 'Your calendar fills up instantly with your imported data.'],
      ['roster', 3, '**Seamless Integration**', 'As well as the allowances from your flights.'],
      ['roster', 4, '**Stay updated**', 'Re-upload your pdf whenever you get a new monthly roster or schedule changes. Your calendar and allowances update seamlessly.'],
      ['roster', 5, '**No Guesswork**', 'If your uploaded file isn\'t recognized as a valid roster, I will let you know immediately rather than guessing your data.'],
      ['manual', 0, 'No roster? No problem', 'Add a card by hand when the trip isn\u2019t on a PDF.'],
      ['manual', 3, 'The whole batch', 'Calculate-all totals everything together, grouped by month.'],
      ['menus', 0, 'Just ask', 'Type a flight and a date \u2014 sq802 menu 17 oct \u2014 and I fetch the menus.'],
      ['menus', 4, 'Saved on your phone', 'Menus you\u2019ve opened stay readable offline, no signal needed.'],
      ['earnings', 0, 'This is your money page', 'Every trip you save adds up here, month by month.'],
      ['earnings', 5, 'Take it with you', 'Export the JSON or the CSV \u2014 your expenses ride along in both.'],
      ['calendar', 1, 'The tag button', 'Tap it and every flight day shows its station and arrival time.'],
      ['calendar', 2, 'The camera comes out', 'With the tags on, the camera appears \u2014 it turns the month into a picture, ready to share.'],
      ['calendar', 5, 'The records door', 'Your passport and all-time stats live behind this gate.'],
      ['stats', 1, 'The hero card', 'Flight time, layover days, top station \u2014 your logbook in five rows.'],
      ['stats', 4, 'Every visit on record', 'Tap a station to open its full visit log.'],
      ['backup', 1, 'Export before you switch', 'Data Management \u2192 Export backup \u2014 the file lands in your downloads.'],
      ['backup', 4, 'Keep it private', 'The file holds your pay data \u2014 keep it somewhere only you control.']
    ];
    pack.forEach(([id, i, title, line]) => {
      const step = w.CA_SPOT_TOURS[id].steps[i];
      R.eq(step.title, title, id + ' step ' + (i + 1) + ' title ships verbatim');
      R.eq(step.line, line, id + ' step ' + (i + 1) + ' line ships verbatim');
    });
    // v1.49.1 (owner order): roster steps 2 and 6 stay on the paperclip
    R.eq(w.CA_SPOT_TOURS.roster.steps[1].sel, '#btn-roster', 'roster step 2 spotlights the paperclip button');
    R.eq(w.CA_SPOT_TOURS.roster.steps[5].sel, '#btn-roster', 'roster step 6 stays on the paperclip too');
    // v1.49.2 (owner order): the NEW step between 3 and 4 — the earnings chip
    R.eq(w.CA_SPOT_TOURS.roster.steps[3].sel, '#action-chips .action-chip[data-intent="earn"]', 'roster step 4 spotlights the how-much-have-I-earned chip (v1.49.2)');
  }

  // ---- the walk: counter, Back, Next, Done, the once-stamp ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.removeItem('crewAssist.spotMainDone');
    } });
    R.eq(w.caSpotStart('main'), true, 'the main tour starts');
    R.ok(d.documentElement.classList.contains('ca-spot-on'), 'ca-spot-on lights the chrome class');
    R.ok(d.getElementById('ca-spot-veil') && d.getElementById('ca-spot-ring') && d.getElementById('ca-spot-tip'), 'veil, ring and tooltip exist');
    await wait(600);
    R.ok(tipText(d).indexOf('At your service') !== -1, 'step 1 titles the chat bar');
    // v1.49.2: the **bold** markers ride the TITLE now (the owner's part-2
    // pack bolds its titles) — they render as bold spans, never raw text
    const bolds = d.querySelectorAll('#ca-spot-tip b');
    R.eq(bolds.length, 1, 'step 1\u2019s title carries one bold phrase');
    R.eq(bolds[0].textContent, 'At your service', 'the title renders bold');
    R.ok(tipText(d).indexOf('Ask about your flight or type "help" / "?" for quick commands.') !== -1, 'the line reads word-for-word');
    R.ok(tipText(d).indexOf('**') === -1, 'no marker asterisks leak into the rendered copy');
    R.ok(tipText(d).indexOf('1 of 7') !== -1, 'the counter reads 1 of 7');
    R.ok(!d.getElementById('ca-spot-back'), 'Back is hidden on step 1');
    R.ok(d.getElementById('ca-spot-next') && d.getElementById('ca-spot-skip'), 'Next and Skip ride every step');
    d.getElementById('ca-spot-next').click();
    await wait(600);
    R.ok(tipText(d).indexOf('2 of 7') !== -1, 'Next advances to 2 of 7');
    R.ok(!!d.getElementById('ca-spot-back'), 'Back shows from step 2 on');
    d.getElementById('ca-spot-back').click();
    await wait(600);
    R.ok(tipText(d).indexOf('1 of 7') !== -1, 'Back re-runs the prior step\u2019s world');
    for (let i = 0; i < 7; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Done stands the tour down');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), '1', 'Done on the main tour stamps spotMainDone \u2014 ONLY Done completes (v1.49.1)');
  }

  // ---- Skip and Escape end it too; the veil never outstays ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    w.caSpotStart('roster');
    await wait(600);
    d.getElementById('ca-spot-skip').click();
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Skip ends the walk');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), '1', 'a non-main tour never stamps the main seen flag');
    w.caSpotStart('menus');
    await wait(600);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Escape ends the walk');
    R.ok(d.getElementById('ca-spot-tip').innerHTML === '', 'the tooltip empties on the way out');

    // v1.49.1 (owner order): a skipped MAIN walk never completes — the
    // flag stays unstamped and the walk returns on the next app open.
    w.eval('localStorage.removeItem("crewAssist.spotMainDone")');
    R.eq(w.caSpotStart('main'), true, 'the main walk starts');
    await wait(600);
    d.getElementById('ca-spot-skip').click();
    R.ok(!w.caSpot.on, 'the main walk stands down on Skip');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), null, 'Skip is not completion — no stamp lands');
    R.eq(w.caSpotStart('main'), true, 'the walk returns after a skip');
    await wait(600);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), null, 'Escape is not completion either');
    w.caSpotEnd();
  }

  // ---- a vanished target never breaks the walk: the step skips ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    w.caSpotStart('main');
    await wait(600);
    // step 5 (Theme switcher) targets the theme button — retire it mid-walk
    d.getElementById('btn-theme').remove();
    for (let i = 0; i < 3; i++) { d.getElementById('ca-spot-next').click(); await wait(520); }
    R.ok(tipText(d).indexOf('4 of 7') !== -1, 'the walk reaches step 4');
    d.getElementById('ca-spot-next').click();
    await wait(520);
    R.ok(tipText(d).indexOf('6 of 7') !== -1, 'the vanished theme step skips itself \u2014 the counter carries on to 6');
    R.ok(tipText(d).indexOf('Account & Preferences') !== -1, 'the walk lands on the step after the gap');
    w.caSpotEnd();
  }

  // ---- each tour opens its own world ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    // earnings: the archive sheet opens itself
    w.caSpotStart('earnings');
    await wait(600);
    R.ok(tipText(d).indexOf('This is your money page') !== -1, 'earnings step 1 shows');
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'the earnings tour opens the archive on its own');
    R.ok(tipText(d).indexOf('1 of 6') !== -1, 'the earnings walk counts six');
    w.caSpotEnd();

    // calendar: the sheet opens, the tag world obeys each step
    w.caSpotStart('calendar');
    await wait(600);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar tour opens the calendar on its own');
    R.ok(tipText(d).indexOf('Here\u2019s your roster') !== -1, 'calendar step 1 shows');
    d.getElementById('ca-spot-next').click(); await wait(520);
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('The camera comes out') !== -1, 'calendar step 3 shows');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'true', 'the camera step turns the tags ON first');
    R.ok(!d.getElementById('ca-rc-shot').classList.contains('hidden'), 'the camera appears only with the tags on \u2014 the owner\u2019s correction, live');
    d.getElementById('ca-spot-back').click(); await wait(520);
    R.ok(tipText(d).indexOf('The tag button') !== -1, 'Back returns to the tag step');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'false', 'the tag step\u2019s world resets the tags OFF');
    w.caSpotEnd();

    // stats: the passport opens
    w.caSpotStart('stats');
    await wait(600);
    R.ok(!d.getElementById('ca-rc-podwrap').classList.contains('hidden'), 'the stats tour opens the passport on its own');
    R.ok(tipText(d).indexOf('Your passport') !== -1, 'stats step 1 shows');
    R.ok(tipText(d).indexOf('1 of 5') !== -1, 'the stats walk counts five');
    w.caSpotEnd();

    // backup: Settings stays open, the spotlight moves inside the sheet
    w.caSpotStart('backup');
    await wait(600);
    R.ok(tipText(d).indexOf('Your data, your file') !== -1, 'backup step 1 shows');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the backup tour keeps Settings open');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'Settings stays open through the walk');
    w.caSpotEnd();

    // manual: the tour builds one real calculator card through the app\u2019s own engine
    const chatKidsBefore = d.getElementById('chat-container').children.length;
    w.caSpotStart('manual');
    await wait(600);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the manual tour opens Settings for the Manual pill');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Fill the flight') !== -1, 'manual step 2 shows');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the card steps return to the main screen');
    R.ok(!!w.caSpot.cardId && !!d.getElementById(w.caSpot.cardId + '-btn-calc'), 'the prop is a real calculator card with a Calculate button');
    R.ok(d.getElementById('chat-container').children.length > chatKidsBefore, 'the card lives in the thread while the veil is up');
    w.caSpotEnd();
    // v1.49.2 (owner order): the chat REVERTS — no tutorial cards left behind
    R.ok(!d.querySelector('.glass-bubble [id$="-btn-calc"]'), 'the tour-built card leaves with the veil');
    R.ok(!d.querySelector('#chat-container [id^="calc-"]'), 'no calculator remnants stay in the thread');
    R.eq(d.getElementById('chat-container').children.length, chatKidsBefore, 'the thread reads exactly as it did before the walk');
    R.eq(w.caSpot.cardId, null, 'the card reference clears with the walk');
  }

  // ---- the firing doors (v1.49.1, owner order) ----
  // The harness pre-stamps spotMainDone on every boot: the every-crew door
  // fires at the chat screen, so plain test boots must be seen devices to
  // stay deterministic. A boot that leaves the stamp never fires.
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
    } });
    await wait(3000);
    R.ok(!w.caSpot.on, 'the pre-stamped boot never auto-fires (test boots are seen devices)');
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'the veil stays down');
  }

  // Every crew, before anything else: an unstamped boot walks the spotlight
  // AT the chat screen — before the What\u2019s-New sheet, before the
  // greeting. Skip hands the stage to the sheet without completing the walk.
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '1.48.5');
      x.localStorage.removeItem('crewAssist.spotMainDone');
    } });
    const until = mkUntil(d);
    R.ok(await until(() => w.caSpot.on, 20000), 'the tour fires for a returning crew at the chat screen');
    R.ok(d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'the What\u2019s-New sheet waits BEHIND the walk');
    R.ok(await until(() => tipText(d).indexOf('1 of 7') !== -1, 10000), 'the spotlight opens on the chat bar');
    R.ok((d.getElementById('chat-container').textContent || '').trim().length === 0, 'the greeting waits too — the chat is still empty');
    d.getElementById('ca-spot-skip').click();
    R.ok(await until(() => !w.caSpot.on, 5000), 'Skip ends the walk');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), null, 'a skipped walk never stamps — it returns next open');
    R.ok(await until(() => !d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 10000), 'the walk\u2019s end hands the stage to the What\u2019s-New sheet');
    const wn = d.getElementById('whatsnew-close');
    if (wn) wn.click();
    R.ok(await until(() => (d.getElementById('chat-container').textContent || '').length > 0, 15000), 'the greeting types once the sheet closes');
  }

  // New crew: onboarding completion \u2192 the spotlight walks IMMEDIATELY;
  // the sheet and the greeting wait. Carried to Done, the walk completes.
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.removeItem('crewAssist.spotMainDone');
    } });
    const until = mkUntil(d);
    const name = d.getElementById('ob-name');
    name.value = 'Tour Tester';
    name.dispatchEvent(new w.Event('input', { bubbles: true }));
    const solo = d.getElementById('ob-solo');
    solo.value = '01/01/2020';
    solo.dispatchEvent(new w.Event('input', { bubbles: true }));
    d.querySelector('.ob-gender-btn').click();
    await wait(150);
    d.querySelector('.ob-rank-btn').click();
    await wait(50);
    d.getElementById('ob-submit').click();
    R.ok(await until(() => w.caSpot.on, 25000), 'onboarding completion fires the main tour');
    R.ok(d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'for new crew too, the sheet waits behind the walk');
    R.ok(await until(() => tipText(d).indexOf('1 of 7') !== -1, 10000), 'the first spotlight is the chat bar');
    for (let i = 0; i < 7; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!w.caSpot.on, 'Done stands the walk down');
    R.ok(await until(() => w.localStorage.getItem('crewAssist.spotMainDone') === '1', 5000), 'ONLY Done completes — the once-flag lands');
    R.ok(await until(() => !d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 10000), 'the sheet takes the stage after Done');
    const wn = d.getElementById('whatsnew-close');
    if (wn) wn.click();
    R.ok(await until(() => (d.getElementById('chat-container').textContent || '').length > 0, 15000), 'the greeting types once the sheet closes');
    // the tour never stacks on itself
    w.eval('caSpotStart("main"); caSpotEnd();');
    R.ok(!w.caSpot.on, 'the tour never stacks on itself');
  }

  // Restoring from the welcome screen is not a new user: the restore door
  // stamps the once-flag (pinned end-to-end in earnings-archive).
  {
    R.ok(src.indexOf("opts.fromOnboarding) { try { localStorage.setItem('crewAssist.spotMainDone', '1'); }") >= 0, 'the welcome-restore door stamps spotMainDone');
  }

  // ---- the engine\u2019s own contract (src pins) ----
  {
    R.ok(src.indexOf('#ca-spot-veil { position: fixed; inset: 0; z-index: 95; visibility: hidden; }') >= 0, 'the veil is a full-screen z-95 blocker, hidden until the tour runs');
    R.ok(src.indexOf('html.ca-spot-on #ca-spot-veil { visibility: visible; }') >= 0, 'only ca-spot-on reveals the veil');
    R.ok(src.indexOf('width: min(300px, calc(100vw - 24px))') >= 0, 'the tooltip is capped at 300px and 24px shy of the viewport');
    R.ok(/function caSpotPlace\([\s\S]{0,600}const m = 12;/.test(src), 'placement clamps to a 12px margin');
    R.ok(src.indexOf('document.addEventListener(\'scroll\', caSpotReflow, true);') >= 0, 'the ring re-places on captured scrolls (sheets scroll inside)');
    R.ok(src.indexOf("window.addEventListener('orientationchange', caSpotReflow);") >= 0, 'the ring re-places on orientation change');
    // v1.49.2 (owner order): the ring GLIDES again — even under reduced
    // motion (the one ca-reduced exception); only the tooltip stays
    // transition-less, and that as belt-and-braces.
    R.ok(src.indexOf('transition: top .24s ease, left .24s ease, width .24s ease, height .24s ease;') >= 0, 'the ring\u2019s glide is restored (the owner missed it)');
    R.ok(src.indexOf('html.ca-reduced #ca-spot-tip { transition: none; }') >= 0, 'the reduced-motion rule keeps only the tooltip');
    R.ok(src.indexOf('html.ca-reduced #ca-spot-ring') === -1, 'reduced motion no longer kills the ring\u2019s glide \u2014 the owner\u2019s one exception');
    // v1.49.2: the once-key migrated — the v1.49.0 key (stamped on ANY end)
    // is wiped on load so every existing crew walks once more
    R.ok(src.indexOf("localStorage.removeItem('crewAssist.spotMainSeen')") >= 0, 'the retired v1.49.0 once-key is wiped at script-eval time');
    R.ok(src.indexOf("localStorage.getItem('crewAssist.spotMainDone')") >= 0, 'the once-key is spotMainDone now');
    // v1.49.2 (owner order): the chat reverts at the walk\u2019s end
    R.ok(src.indexOf('caSpot.chatKids = cc ? Array.prototype.slice.call(cc.children) : [];') >= 0, 'the walk snapshots the thread\u2019s children at start');
    R.ok(src.indexOf('if (caSpot.chatKids.indexOf(kid) === -1) kid.remove();') >= 0, 'walk-built children leave with the veil \u2014 no tutorial cards');
    R.ok(src.indexOf('caSpotAppendRich(title, step.title)') >= 0, 'titles render the **bold** markers too (v1.49.2)');
    R.ok(src.indexOf('ev.key === \'Escape\'') >= 0, 'Escape ends the walk');
    // v1.49.1 pins
    R.ok(src.indexOf('caSpotEnd(true)') >= 0, 'Next past the last step (Done) is the only completing end');
    R.ok(src.indexOf('completed === true') >= 0, 'the once-stamp lands only on a completed walk');
    R.ok(src.indexOf('function caSpotOnEnded') >= 0, 'the boot flow hands the stage through onEnd');
    R.ok(/function showMain\(\) \{[\s\S]{0,1200}caSpotOnEnded\(afterTour\)/.test(src), 'showMain wires the sheet/greeting handoff to the walk\u2019s end');
    R.ok(src.indexOf('caSpotFitViewport') >= 0 && src.indexOf('CA_SPOT_EDGE = 10') >= 0, 'the lit target is nudged fully into view (the owner\u2019s viewport-fit order)');
    R.ok(src.indexOf('rgba(4, 7, 15, .8)') >= 0, 'the scrim darkens to .8');
    R.ok(src.indexOf('split(/(\\*\\*[^*]+\\*\\*)/g)') >= 0, 'the copy pack\u2019s **bold** markers render as bold spans');
  }

  // ---- the old tour is gone, root and branch ----
  {
    ['startCaTour', 'finishCaTour', 'maybeOfferTour', 'caTourInterrupt', 'caTourPace', 'caTourArchiveStore', 'CA_TOUR_STEPS', 'tourDone', 'ca-tour-on', 'ca-tour-glow', 'caTourPulse', 'btn-replay-tour', 'ca-tour-bubble', 'ca-tour-offer', 'caSpotFresh'].forEach((dead) => {
      R.ok(src.indexOf(dead) === -1, 'no trace of ' + dead + ' remains');
    });
    R.ok(src.indexOf('crewAssist.spotMainDone') >= 0, 'the once-flag is the spotlight\u2019s own');
    // the chat queue kept its fast pace; the tour exemption retired with it
    R.ok(src.indexOf('CHAT_ANIM_MS + CHAT_FAST_GAP_MS') >= 0, 'noteBubbleShown runs the universal fast pace');
    R.ok(src.indexOf('150 + Math.random() * 100') >= 0, 'enqueueBot types at the universal fast pace');
    // the archive reads storage directly again — no session store
    R.ok(/function loadArchive\(\) \{\s*try \{\s*const a = JSON\.parse\(localStorage\.getItem\(ARCHIVE_KEY\)\);/.test(src), 'loadArchive reads localStorage straight');
  }

  process.exit(R.done());
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
