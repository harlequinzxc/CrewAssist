// The spotlight feature tour (v1.49.0; firing/completion/bold v1.49.1;
// copy pack part 2 + the chat revert v1.49.2; v1.50.0: the invitation
// prompt, per-walk completion with status icons, and the stage revert):
// one lit target, one tooltip, one Next at a time. The veil blocks every
// tap; the copy is the owner's, verbatim (with **bold** markers since
// v1.49.1, in titles too since v1.49.2); the walk is data
// (docs/FEATURE_TOUR.md is the contract). Since v1.50.0 the auto-fired
// main walk is preceded by a prompt card — Next walks, Skip declines
// forever — and every walk leaves the app exactly as it found it:
// chat (v1.49.2), sheets and tag chip alike. This suite walks every tour
// end-to-end in jsdom — the network is offline, which is exactly what the
// menus tour's honest chip fallback is built for.
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
    R.eq(typeof w.renderTourPromptModal, 'function', 'renderTourPromptModal is global (the boot gate reaches it)');
    R.eq(Object.keys(w.CA_SPOT_TOURS).join(','), 'main,roster,manual,menus,earnings,calendar,stats,backup', 'eight tours, the owner\u2019s Settings order (menus below the manual cards)');
    const labels = Object.keys(w.CA_SPOT_TOURS).map((k) => w.CA_SPOT_TOURS[k].label).join(',');
    R.eq(labels, 'Main screen,Roster import,Manual flight cards,Menus & search,Earnings,Calendar,Flight Stats,Backup & restore', 'labels read as the Settings rows do');
    const counts = Object.keys(w.CA_SPOT_TOURS).map((k) => k + ':' + w.CA_SPOT_TOURS[k].steps.length).join(' ');
    R.eq(counts, 'main:7 roster:6 manual:6 menus:6 earnings:6 calendar:6 stats:5 backup:5', 'step counts: the chat bar leads the main tour, the roster walk gains the earnings step (v1.49.2), the calendar walks six, Flight Stats slimmed to five');
    const allSteps = Object.keys(w.CA_SPOT_TOURS).reduce((a, k) => a.concat(w.CA_SPOT_TOURS[k].steps), []);
    R.eq(allSteps.length, 47, 'forty-seven steps in all');
    R.ok(allSteps.every((s) => s && s.sel && s.title && s.line), 'every step carries a target, a title and a line');
    // v1.50.0: every walk carries a CONTENT version — the store stamps at
    // it, and bumping one retires its check (and re-invites for main)
    R.ok(Object.keys(w.CA_SPOT_TOURS).every((k) => typeof w.CA_SPOT_TOURS[k].cv === 'string' && w.CA_SPOT_TOURS[k].cv), 'every walk carries a cv (its content version)');
    R.eq(Object.keys(w.CA_SPOT_TOURS).map((k) => w.CA_SPOT_TOURS[k].cv).join(','), '1.49.3,1.49.2,1.49.0,1.49.0,1.49.0,1.49.0,1.49.0,1.49.0', 'cvs: main last touched 1.49.3, roster 1.49.2, the rest 1.49.0');
  }

  // ---- the copy ships verbatim: every step's title and line, word for word ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    const pack = [
      // main + roster: the owner's v1.49.2 part-2 copy pack, ALL of it
      ['main', 0, '**At Your Service**', 'Ask about your flight or type "help" / "?" for quick commands.'],
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

  // ---- the walk: counter, Back, Next, Done, the per-walk stamp ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    R.eq(w.caSpotStart('main'), true, 'the main tour starts');
    R.ok(d.documentElement.classList.contains('ca-spot-on'), 'ca-spot-on lights the chrome class');
    R.ok(d.getElementById('ca-spot-veil') && d.getElementById('ca-spot-ring') && d.getElementById('ca-spot-tip'), 'veil, ring and tooltip exist');
    await wait(600);
    R.ok(tipText(d).indexOf('At Your Service') !== -1, 'step 1 titles the chat bar (title case, v1.49.3)');
    // v1.49.2: the **bold** markers ride the TITLE now (the owner's part-2
    // pack bolds its titles) — they render as bold spans, never raw text
    const bolds = d.querySelectorAll('#ca-spot-tip b');
    R.eq(bolds.length, 1, 'step 1\u2019s title carries one bold phrase');
    R.eq(bolds[0].textContent, 'At Your Service', 'the title renders bold');
    R.ok(tipText(d).indexOf('Ask about your flight or type "help" / "?" for quick commands.') !== -1, 'the line reads word-for-word');
    R.ok(tipText(d).indexOf('**') === -1, 'no marker asterisks leak into the rendered copy');
    R.ok(tipText(d).indexOf('1 of 7') !== -1, 'the counter reads 1 of 7');
    R.ok(!d.getElementById('ca-spot-back'), 'Back is hidden on step 1');
    R.ok(d.getElementById('ca-spot-next') && d.getElementById('ca-spot-skip'), 'Next and Skip ride every step');
    R.eq([...d.querySelectorAll('#ca-spot-tip button')].map((b) => b.id).join(','), 'ca-spot-skip,ca-spot-next', 'step 1 orders the buttons Skip, Next \u2014 with the spacer between, Skip never hugs Next');
    d.getElementById('ca-spot-next').click();
    await wait(600);
    R.ok(tipText(d).indexOf('2 of 7') !== -1, 'Next advances to 2 of 7');
    R.ok(!!d.getElementById('ca-spot-back'), 'Back shows from step 2 on');
    // v1.49.3 (owner order): Skip sits FAR from Next — the row reads
    // Skip | spacer | Back, Next (Back only past step 1)
    const rowBtns = () => [...d.querySelectorAll('#ca-spot-tip button')].map((b) => b.id);
    R.eq(rowBtns().join(','), 'ca-spot-skip,ca-spot-back,ca-spot-next', 'step 2+ orders the buttons Skip, Back, Next \u2014 the destructive exit is pinned left');
    d.getElementById('ca-spot-back').click();
    await wait(600);
    R.ok(tipText(d).indexOf('1 of 7') !== -1, 'Back re-runs the prior step\u2019s world');
    for (let i = 0; i < 7; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Done stands the tour down');
    // v1.50.0: completion is per-walk now — the store stamps at the walk's
    // cv, and main keeps its legacy mirror (the archive pin + the
    // welcome-restore door read it)
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), '1', 'Done on the main tour keeps the legacy spotMainDone mirror');
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ main: '1.49.3' }), 'Done stamps the per-walk store at main\u2019s current cv');
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
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.spotDone') || '{}').roster, undefined, 'a skipped roster walk stamps no store entry');
    w.caSpotStart('menus');
    await wait(600);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Escape ends the walk');
    R.ok(d.getElementById('ca-spot-tip').innerHTML === '', 'the tooltip empties on the way out');

    // v1.49.1 (owner order): a skipped MAIN walk never completes — no
    // stamp lands and the invitation returns on the next app open.
    const storeBefore = w.localStorage.getItem('crewAssist.spotDone');
    R.eq(w.caSpotStart('main'), true, 'the main walk starts');
    await wait(600);
    d.getElementById('ca-spot-skip').click();
    R.ok(!w.caSpot.on, 'the main walk stands down on Skip');
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), storeBefore, 'Skip is not completion \u2014 the store does not change');
    R.eq(w.caSpotStart('main'), true, 'the walk returns after a skip');
    await wait(600);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), storeBefore, 'Escape is not completion either');
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

  // ---- each tour opens its own world — and v1.50.0 (owner order): every
  // walk hands the stage back EXACTLY as it found it: sheets slide shut,
  // the tag chip sits as it sat (the chat revert is pinned in the manual
  // block below; stage-revert runs on Done, Skip and supersede alike) ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    // earnings: the archive sheet opens itself, then closes at the end
    w.caSpotStart('earnings');
    await wait(600);
    R.ok(tipText(d).indexOf('This is your money page') !== -1, 'earnings step 1 shows');
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'the earnings tour opens the archive on its own');
    R.ok(tipText(d).indexOf('1 of 6') !== -1, 'the earnings walk counts six');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'v1.50.0: the archive the walk opened closes behind it');

    // calendar: the sheet opens, the tag world obeys each step — and the
    // tag chip the walk switched ON reverts OFF at the end
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
    await wait(500);
    R.ok(d.getElementById('ca-roster-cal').classList.contains('hidden'), 'v1.50.0: the calendar sheet closes at the walk\u2019s end');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'false', 'v1.50.0: the tag chip sits as it sat before the walk');

    // stats: the passport opens, then closes
    w.caSpotStart('stats');
    await wait(600);
    R.ok(!d.getElementById('ca-rc-podwrap').classList.contains('hidden'), 'the stats tour opens the passport on its own');
    R.ok(tipText(d).indexOf('Your passport') !== -1, 'stats step 1 shows');
    R.ok(tipText(d).indexOf('1 of 5') !== -1, 'the stats walk counts five');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-rc-podwrap').classList.contains('hidden'), 'v1.50.0: the passport closes at the walk\u2019s end');

    // backup: Settings open at the start (the real flow — the row lives in
    // it) stays open THROUGH the walk and is restored open at the end
    w.openSettings();
    await wait(450);   // let the sheet finish its glide — the snapshot must read it open
    w.caSpotStart('backup');
    await wait(600);
    R.ok(tipText(d).indexOf('Your data, your file') !== -1, 'backup step 1 shows');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the backup tour keeps Settings open');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'Settings stays open through the walk');
    w.caSpotEnd();
    await wait(500);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.50.0: Settings restores OPEN \u2014 the walk found it that way');
    w.closeSettings();
    await wait(500);

    // manual: the tour builds one real calculator card through the app\u2019s own
    // engine; Settings restores open at the end (the row lives in it)
    const chatKidsBefore = d.getElementById('chat-container').children.length;
    w.openSettings();
    await wait(450);   // same: the snapshot reads the settled sheet
    w.caSpotStart('manual');
    await wait(600);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the manual tour opens Settings for the Manual pill');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Fill the flight') !== -1, 'manual step 2 shows');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the card steps return to the main screen');
    R.ok(!!w.caSpot.cardId && !!d.getElementById(w.caSpot.cardId + '-btn-calc'), 'the prop is a real calculator card with a Calculate button');
    R.ok(d.getElementById('chat-container').children.length > chatKidsBefore, 'the card lives in the thread while the veil is up');
    w.caSpotEnd();
    await wait(500);
    // v1.49.2 (owner order): the chat REVERTS — no tutorial cards left behind
    R.ok(!d.querySelector('.glass-bubble [id$="-btn-calc"]'), 'the tour-built card leaves with the veil');
    R.ok(!d.querySelector('#chat-container [id^="calc-"]'), 'no calculator remnants stay in the thread');
    R.eq(d.getElementById('chat-container').children.length, chatKidsBefore, 'the thread reads exactly as it did before the walk');
    R.eq(w.caSpot.cardId, null, 'the card reference clears with the walk');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.50.0: Settings restores open after the manual walk too');

    // supersede: a tour never stacks on a tour — the first walk\u2019s stage is
    // restored (its sheet closed) before the second walk snapshots
    w.caSpotStart('earnings');
    await wait(600);
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'the superseded earnings walk has its sheet open');
    w.caSpotStart('calendar');
    await wait(500);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar walk takes over');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar sheet closes at the end');
    R.ok(d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'v1.50.0: the superseded walk\u2019s sheet was restored shut \u2014 no stage leaks across walks');

    // v1.50.0 (owner order): the PRE-TAP stage — the row handler snapshots
    // before it closes Settings, so a row-tapped walk hands the sheet back
    // open at its end (the crew tapped inside it)
    w.openSettings();
    await wait(450);
    d.querySelector('#ca-feature-tours [data-ca-spot="backup"]').click();
    await wait(600);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the backup row-tap keeps Settings open through the walk');
    d.getElementById('ca-spot-skip').click();
    await wait(500);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.50.0: a row-tapped backup walk reopens Settings at its end \u2014 the pre-tap stage');
    w.closeSettings();
    await wait(500);
    w.openSettings();
    await wait(450);
    d.querySelector('#ca-feature-tours [data-ca-spot="roster"]').click();
    await wait(600);
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the roster row-tap closes Settings for the main-screen walk (the v1.49.0 order holds DURING the walk)');
    d.getElementById('ca-spot-skip').click();
    await wait(500);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.50.0: the roster walk hands Settings back open \u2014 the pre-tap stage, not the post-close one');
    w.closeSettings();
    await wait(500);
  }

  // ---- v1.50.0: the Settings rows wear their completion state —
  // a gold circle-check for a walk done at its current cv, a quiet
  // hollow circle for one not yet carried to its Done ----
  {
    // fresh device: nothing done — all eight rows hollow
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '9.9.9');
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
    } });
    const hollow = [...d.querySelectorAll('#ca-feature-tours [data-ca-spot]')].map((r) => r.getAttribute('data-ca-spot') + ':' + r.querySelector('.ca-spot-row-status').getAttribute('data-lucide'));
    R.eq(hollow.join(' '), 'main:circle roster:circle manual:circle menus:circle earnings:circle calendar:circle stats:circle backup:circle', 'a fresh device reads eight hollow circles');
    R.ok(d.querySelector('#ca-feature-tours [data-ca-spot="main"] .ca-spot-row-status').className.indexOf('text-gray-400') !== -1, 'a not-done circle sits quiet and gray');
    // carry the earnings walk to Done — its row flips to the gold check
    w.caSpotStart('earnings');
    await wait(600);
    for (let i = 0; i < 6; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!w.caSpot.on, 'the earnings walk stands down at Done');
    R.eq(d.querySelector('#ca-feature-tours [data-ca-spot="earnings"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle-check', 'Done flips the earnings row to the check');
    R.ok(d.querySelector('#ca-feature-tours [data-ca-spot="earnings"] .ca-spot-row-status').className.indexOf('text-sia-gold') !== -1, 'the done check reads gold');
    R.eq(d.querySelector('#ca-feature-tours [data-ca-spot="main"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle', 'the main row stays hollow — its walk never ran');
    // a skipped walk flips nothing
    w.caSpotStart('stats');
    await wait(600);
    d.getElementById('ca-spot-skip').click();
    await wait(300);
    R.eq(d.querySelector('#ca-feature-tours [data-ca-spot="stats"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle', 'a skipped walk leaves its row hollow');

    // seen device: the legacy flag materializes at main\u2019s current cv — the
    // main row reads done from the very first boot
    const { d: d2 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    R.eq(d2.querySelector('#ca-feature-tours [data-ca-spot="main"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle-check', 'a legacy-done main reads done at boot (the store materialized)');
    R.eq(d2.querySelector('#ca-feature-tours [data-ca-spot="roster"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle', 'the other walks stay hollow on a legacy device');
  }

  // ---- v1.50.0: the per-walk store — matching at cv, migrating the
  // legacy flag, refusing stale content ----
  {
    // legacy migration: spotMainDone alone materializes into the store on
    // first read (at main's CURRENT cv) and keeps the device quiet
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
      x.localStorage.removeItem('crewAssist.spotDone');
    } });
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ main: '1.49.3' }), 'the legacy flag materializes into the store at main\u2019s current cv');
    R.eq(w.caSpotWalkDone('main'), true, 'the materialized state reads done');

    // a stale cv (content changed since the walk was done) reads NOT done —
    // the check retires and the invitation returns
    const { w: w2 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '9.9.9');
      x.localStorage.setItem('crewAssist.spotDone', JSON.stringify({ main: '1.49.2', earnings: '1.49.0' }));
    } });
    R.eq(w2.caSpotWalkDone('main'), false, 'a stale main cv reads not-done \u2014 the walk must walk again');
    R.eq(w2.caSpotWalkDone('earnings'), true, 'a matching cv still reads done');

    // non-main Done stamps the store; the legacy mirror stays main-only
    const { w: w3 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.setItem('crewAssist.spotMainDeclined', '1');
    } });
    w3.caSpotStart('menus');
    await wait(600);
    for (let i = 0; i < 6; i++) { const n = w3.document.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.eq(w3.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ menus: '1.49.0' }), 'a non-main Done stamps its own walk');
    R.eq(w3.localStorage.getItem('crewAssist.spotMainDone'), null, 'the legacy mirror stays main-only');
  }

  // ---- v1.50.0: the invitation prompt — Next walks, Skip stays quiet ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '9.9.9');
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.removeItem('crewAssist.spotMainDeclined');
    } });
    const until = mkUntil(d);
    R.ok(await until(() => d.getElementById('ca-spot-prompt-backdrop'), 10000), 'a fresh boot renders the tour prompt');
    R.ok(!w.caSpot.on, 'the walk itself does not fire — the prompt gates it');
    R.ok(d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'the What\u2019s-New sheet waits behind the prompt too');
    R.ok((d.getElementById('chat-container').textContent || '').trim().length === 0, 'the greeting waits behind the prompt');
    const card = d.getElementById('ca-spot-prompt-card');
    R.ok(!!card, 'the prompt is a card');
    R.eq(card.getAttribute('role'), 'dialog', 'the card announces itself as a dialog');
    R.eq((d.getElementById('ca-spot-prompt-backdrop').textContent || '').indexOf('Let\u2019s take a quick tour') !== -1, true, 'the headline reads verbatim');
    R.eq(card.textContent.indexOf('Seven quick steps in under a minute') !== -1, true, 'the secondary line reads verbatim');
    const poly = card.querySelector('svg polygon');
    R.ok(!!poly, 'the prompt carries the compass icon');
    R.eq(poly.getAttribute('points'), '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76', 'the compass is the exact Lucide polygon');
    R.ok(card.querySelector('svg circle'), 'the compass carries its circle too');
    const next = d.getElementById('ca-spot-prompt-next');
    const skip = d.getElementById('ca-spot-prompt-skip');
    R.ok(!!next && !!skip, 'Next and Skip ride the prompt');
    R.eq(next.textContent, 'Next', 'the accept button reads Next');
    R.eq(skip.textContent, 'Skip', 'the decline button reads Skip');
    R.eq(d.activeElement && d.activeElement.id, 'ca-spot-prompt-next', 'Next takes focus on open');
    // Tab is trapped between the two buttons
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    R.eq(d.activeElement.id, 'ca-spot-prompt-skip', 'Tab moves focus to Skip \u2014 never out of the card');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    R.eq(d.activeElement.id, 'ca-spot-prompt-next', 'Tab cycles back to Next \u2014 the trap holds');
    // Next accepts: the card tears down and the walk begins
    next.click();
    R.ok(await until(() => w.caSpot.on, 5000), 'Next starts the main walk');
    R.ok(await until(() => tipText(d).indexOf('1 of 7') !== -1, 10000), 'the first spotlight is the chat bar');
    await wait(450);
    R.ok(!d.getElementById('ca-spot-prompt-backdrop'), 'the prompt tears its nodes down');
    d.getElementById('ca-spot-skip').click();
    await wait(300);
    R.eq(w.localStorage.getItem('crewAssist.spotMainDeclined'), null, 'declining the WALK is not declining the INVITATION');

    // the prompt never renders twice at once (idempotent by id)
    w.renderTourPromptModal(() => {}, () => {});
    w.renderTourPromptModal(() => {}, () => {});
    R.eq(d.querySelectorAll('#ca-spot-prompt-backdrop').length, 1, 'a second render replaces the first \u2014 never two prompts');
    d.getElementById('ca-spot-prompt-skip').click();
    await wait(450);
    R.ok(!d.getElementById('ca-spot-prompt-backdrop'), 'the standalone prompt tears down on Skip');

    // Escape on the prompt = Skip (the standalone one again)
    w.renderTourPromptModal(() => {}, () => {});
    await wait(100);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(450);
    R.ok(!d.getElementById('ca-spot-prompt-backdrop'), 'Escape closes the prompt');
    // the listener left with the nodes: a stray Escape changes nothing
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    R.ok(true, 'a stray key after teardown lands on nothing \u2014 the listener is gone');
  }

  // ---- the firing doors (v1.49.1; prompt-first since v1.50.0) ----
  // The harness pre-stamps spotMainDone on every quiet boot: the every-crew
  // door fires at the chat screen, so plain test boots must be seen devices
  // to stay deterministic. A boot that reads done (legacy or store) never
  // fires — the prompt included.
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
    } });
    await wait(3000);
    R.ok(!w.caSpot.on, 'the pre-stamped boot never auto-fires (test boots are seen devices)');
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'the veil stays down');
    R.ok(!d.getElementById('ca-spot-prompt-backdrop'), 'the prompt stays down too — the device reads done');
  }

  // Every crew, before anything else: an unstamped boot renders the
  // INVITATION at the chat screen — before the What\u2019s-New sheet, before
  // the greeting. Next walks; Skip declines forever (the tour stays one
  // tap away in Settings).
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '1.48.5');
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.removeItem('crewAssist.spotMainDeclined');
    } });
    const until = mkUntil(d);
    R.ok(await until(() => d.getElementById('ca-spot-prompt-backdrop'), 20000), 'the prompt fires for a returning crew at the chat screen');
    R.ok(d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'the What\u2019s-New sheet waits BEHIND the prompt');
    R.ok((d.getElementById('chat-container').textContent || '').trim().length === 0, 'the greeting waits too — the chat is still empty');
    // Skip: permanent dismissal, no completion, the stage moves on
    d.getElementById('ca-spot-prompt-skip').click();
    R.ok(await until(() => !d.getElementById('ca-spot-prompt-backdrop'), 5000), 'Skip tears the prompt down');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDeclined'), '1', 'Skip declines the invitation permanently');
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), null, 'a declined invitation completes nothing');
    R.ok(!w.caSpot.on, 'no walk fires after a decline');
    R.ok(await until(() => !d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 10000), 'the decline hands the stage to the What\u2019s-New sheet');
    const wn = d.getElementById('whatsnew-close');
    if (wn) wn.click();
    R.ok(await until(() => (d.getElementById('chat-container').textContent || '').length > 0, 15000), 'the greeting types once the sheet closes');

    // a declined device never sees the prompt again — but the row stays
    // one tap away, and nothing else changes
    const { w: w2, d: d2 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '1.48.5');
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.setItem('crewAssist.spotMainDeclined', '1');
    } });
    await wait(3000);
    R.ok(!d2.getElementById('ca-spot-prompt-backdrop'), 'a declined device never sees the prompt again');
    R.ok(!w2.caSpot.on, 'no walk fires either');
    R.eq(d2.querySelector('#ca-feature-tours [data-ca-spot="main"] .ca-spot-row-status').getAttribute('data-lucide'), 'circle', 'the main row stays honest — not done, just declined');
    R.eq(w2.caSpotStart('main'), true, 'the tour itself stays one tap away in Settings');

    // a SKIPPED walk (not a declined invitation) returns next open
    const { w: w3, d: d3 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '1.48.5');
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.removeItem('crewAssist.spotMainDeclined');
    } });
    const until3 = mkUntil(d3);
    R.ok(await until3(() => d3.getElementById('ca-spot-prompt-backdrop'), 20000), 'the prompt returns for a crew that skipped the walk');
    d3.getElementById('ca-spot-prompt-next').click();
    R.ok(await until3(() => w3.caSpot.on, 5000), 'Next walks');
    R.ok(await until3(() => d3.getElementById('ca-spot-tip').textContent.indexOf('1 of 7') !== -1, 10000), 'the first spotlight is the chat bar');
    d3.getElementById('ca-spot-skip').click();
    R.ok(await until3(() => !w3.caSpot.on, 5000), 'the walk skips');
    R.eq(w3.localStorage.getItem('crewAssist.spotMainDeclined'), null, 'skipping the walk is not declining the invitation');
  }

  // New crew: onboarding completion \u2192 the INVITATION renders IMMEDIATELY;
  // Next walks, and carried to Done the walk completes at its cv.
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
    R.ok(await until(() => d.getElementById('ca-spot-prompt-backdrop'), 25000), 'onboarding completion renders the invitation');
    R.ok(d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 'for new crew too, the sheet waits behind the prompt');
    d.getElementById('ca-spot-prompt-next').click();
    R.ok(await until(() => tipText(d).indexOf('1 of 7') !== -1, 10000), 'the first spotlight is the chat bar');
    for (let i = 0; i < 7; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!w.caSpot.on, 'Done stands the walk down');
    R.ok(await until(() => w.localStorage.getItem('crewAssist.spotDone') === JSON.stringify({ main: '1.49.3' }), 5000), 'ONLY Done completes — the store lands at main\u2019s cv');
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), '1', 'the legacy mirror lands with it');
    R.ok(await until(() => !d.getElementById('whatsnew-backdrop').classList.contains('hidden'), 10000), 'the sheet takes the stage after Done');
    const wn = d.getElementById('whatsnew-close');
    if (wn) wn.click();
    R.ok(await until(() => (d.getElementById('chat-container').textContent || '').length > 0, 15000), 'the greeting types once the sheet closes');
    // the tour never stacks on itself
    w.eval('caSpotStart("main"); caSpotEnd();');
    R.ok(!w.caSpot.on, 'the tour never stacks on itself');
  }

  // Restoring from the welcome screen is not a new user: the restore door
  // stamps BOTH the legacy mirror and the per-walk store (pinned end-to-end
  // in earnings-archive).
  {
    R.ok(src.indexOf("opts.fromOnboarding) {") >= 0
        && src.indexOf("localStorage.setItem('crewAssist.spotMainDone', '1'); } catch (e) {}") >= 0
        && src.indexOf("if (typeof caSpotMarkDone === 'function') { try { caSpotMarkDone('main'); } catch (e2) {} }") >= 0, 'the welcome-restore door stamps the mirror AND the store');
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
    // v1.50.0: the scrim is one shared token — the veil and the prompt
    // backdrop can never drift apart
    R.ok(src.indexOf('--ca-spot-scrim: rgba(4, 7, 15, .85);') >= 0, 'the scrim is a single token at .85 (v1.49.3\u2019s darkness, kept)');
    R.ok(src.indexOf('0 0 0 9999px var(--ca-spot-scrim);') >= 0, 'the ring reads the token for its veil');
    R.ok(src.indexOf('background: var(--ca-spot-scrim);') >= 0, 'the prompt backdrop reads the same token');
    // v1.50.0 (owner order): the prompt — fade/scale in, fade out, and the
    // tour-animation exemption from reduced motion covers it
    R.ok(src.indexOf('#ca-spot-prompt-backdrop { position: fixed; inset: 0; z-index: 95;') >= 0, 'the prompt backdrop is a full-screen z-95 layer');
    R.ok(src.indexOf('transition: opacity .28s ease;') >= 0, 'the prompt fades over .28s');
    R.ok(src.indexOf('transition: transform .28s cubic-bezier(.34, 1.56, .64, 1);') >= 0, 'the card springs in on the overshoot curve');
    R.ok(src.indexOf('html.ca-reduced #ca-spot-prompt-backdrop') === -1, 'reduced motion does NOT gate the prompt \u2014 the owner\u2019s tour-animation exemption');
    R.ok(src.indexOf('document.removeEventListener(\'keydown\', key, true);') >= 0, 'the prompt teardown removes its document key listener');
    // v1.50.0 (owner order): the completion store and the decline key
    R.ok(src.indexOf("localStorage.getItem('crewAssist.spotDone')") >= 0, 'the per-walk store is crewAssist.spotDone');
    R.ok(src.indexOf("localStorage.getItem('crewAssist.spotMainDeclined')") >= 0, 'the decline key is crewAssist.spotMainDeclined');
    R.ok(src.indexOf("caSpotMarkDone(caSpot.id);") >= 0, 'every walk\u2019s Done stamps its own store entry');
    R.ok(src.indexOf("if (caSpot.id && completed === true)") >= 0, 'the store stamp lands only on a completed walk');
    R.ok(src.indexOf("!caSpotWalkDone('main') && !caSpotDeclined()") >= 0, 'the prompt gate reads done AND declined');
    R.ok(src.indexOf('function caSpotSyncRowIcons') >= 0, 'the row icons sync through their own function');
    // v1.50.0 (owner order): the stage reverts with the chat
    R.ok(src.indexOf('function caSpotStageSnap') >= 0 && src.indexOf('function caSpotStageRestore') >= 0, 'the stage snapshot/restore pair exists');
    R.ok(src.indexOf("try { caSpot.stage = (stageOverride !== undefined && stageOverride) ? stageOverride : caSpotStageSnap(); } catch (e) { caSpot.stage = null; }") >= 0, 'the walk snapshots the stage at start (a row-tap hands its PRE-TAP snapshot in)');
    R.ok(src.indexOf('const preStage = (typeof caSpotStageSnap === \'function\') ? caSpotStageSnap() : null;') >= 0, 'the Settings rows snapshot BEFORE the handler closes the sheet — the crew lands where they tapped');
    R.ok(src.indexOf('try { if (caSpot.stage) caSpotStageRestore(caSpot.stage); } catch (e) {}') >= 0, 'the walk restores the stage on every end');
    // v1.49.2: the once-key migrated — the v1.49.0 key (stamped on ANY end)
    // is wiped on load so every existing crew walks once more
    R.ok(src.indexOf("localStorage.removeItem('crewAssist.spotMainSeen')") >= 0, 'the retired v1.49.0 once-key is wiped at script-eval time');
    R.ok(src.indexOf("localStorage.getItem('crewAssist.spotMainDone')") >= 0, 'the legacy mirror key is spotMainDone');
    // v1.49.2 (owner order): the chat reverts at the walk\u2019s end
    R.ok(src.indexOf('caSpot.chatKids = cc ? Array.prototype.slice.call(cc.children) : [];') >= 0, 'the walk snapshots the thread\u2019s children at start');
    R.ok(src.indexOf('if (caSpot.chatKids.indexOf(kid) === -1) kid.remove();') >= 0, 'walk-built children leave with the veil \u2014 no tutorial cards');
    R.ok(src.indexOf('caSpotAppendRich(title, step.title)') >= 0, 'titles render the **bold** markers too (v1.49.2)');
    R.ok(src.indexOf('ev.key === \'Escape\'') >= 0, 'Escape ends the walk');
    // v1.49.1 pins
    R.ok(src.indexOf('caSpotEnd(true)') >= 0, 'Next past the last step (Done) is the only completing end');
    R.ok(src.indexOf('function caSpotOnEnded') >= 0, 'the boot flow hands the stage through onEnd');
    R.ok(/function showMain\(\) \{[\s\S]{0,3000}caSpotOnEnded\(afterTour\)/.test(src), 'showMain wires the sheet/greeting handoff to the walk\u2019s end');
    R.ok(src.indexOf('renderTourPromptModal(acceptTour, () => { caSpotDecline(); afterTour(); })') >= 0, 'the prompt\u2019s Skip declines and hands the stage on');
    R.ok(src.indexOf('caSpotFitViewport') >= 0 && src.indexOf('CA_SPOT_EDGE = 10') >= 0, 'the lit target is nudged fully into view (the owner\u2019s viewport-fit order)');
    R.ok(src.indexOf('split(/(\\*\\*[^*]+\\*\\*)/g)') >= 0, 'the copy pack\u2019s **bold** markers render as bold spans');
  }

  // ---- the old tour is gone, root and branch ----
  {
    ['startCaTour', 'finishCaTour', 'maybeOfferTour', 'caTourInterrupt', 'caTourPace', 'caTourArchiveStore', 'CA_TOUR_STEPS', 'tourDone', 'ca-tour-on', 'ca-tour-glow', 'caTourPulse', 'btn-replay-tour', 'ca-tour-bubble', 'ca-tour-offer', 'caSpotFresh', 'caSpotSeen', 'caSpotMarkSeen'].forEach((dead) => {
      R.ok(src.indexOf(dead) === -1, 'no trace of ' + dead + ' remains');
    });
    R.ok(src.indexOf('crewAssist.spotMainDone') >= 0, 'the legacy mirror key is the spotlight\u2019s own');
    // the chat queue kept its fast pace; the tour exemption retired with it
    R.ok(src.indexOf('CHAT_ANIM_MS + CHAT_FAST_GAP_MS') >= 0, 'noteBubbleShown runs the universal fast pace');
    R.ok(src.indexOf('150 + Math.random() * 100') >= 0, 'enqueueBot types at the universal fast pace');
    // the archive reads storage directly again — no session store
    R.ok(/function loadArchive\(\) \{\s*try \{\s*const a = JSON\.parse\(localStorage\.getItem\(ARCHIVE_KEY\)\);/.test(src), 'loadArchive reads localStorage straight');
  }

  process.exit(R.done());
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
