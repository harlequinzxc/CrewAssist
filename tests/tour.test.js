// The spotlight feature tour (v1.49.0; firing/completion/bold v1.49.1;
// copy pack part 2 + the chat revert v1.49.2; v1.50.0: the invitation
// prompt, per-walk completion with status icons, and the stage revert;
// v1.51.0: the walk overhauls and the scroll-home stage; v1.52.0: union
// targets, the filled Fetch-menu prop, the storage-safe stage):
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

  // ---- the registry is data: eight tours, the owner's order, 41 steps ----
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
R.eq(counts, 'main:8 roster:6 manual:4 menus:4 earnings:5 calendar:6 stats:4 backup:4', 'step counts (v1.53.0): the main walk gains its eighth step — the tours\u2019 front door');
    const allSteps = Object.keys(w.CA_SPOT_TOURS).reduce((a, k) => a.concat(w.CA_SPOT_TOURS[k].steps), []);
R.eq(allSteps.length, 41, 'forty-one steps in all (v1.53.0: main 7\u21928 — the walk ends at the Feature tour section)');
    R.ok(allSteps.every((s) => s && s.sel && s.title && s.line), 'every step carries a target, a title and a line');
    // v1.50.0: every walk carries a CONTENT version — the store stamps at
    // it, and bumping one retires its check (and re-invites for main)
    R.ok(Object.keys(w.CA_SPOT_TOURS).every((k) => typeof w.CA_SPOT_TOURS[k].cv === 'string' && w.CA_SPOT_TOURS[k].cv), 'every walk carries a cv (its content version)');
R.eq(Object.keys(w.CA_SPOT_TOURS).map((k) => w.CA_SPOT_TOURS[k].cv).join(','), '1.53.2,1.49.2,1.52.0,1.52.0,1.52.0,1.52.0,1.52.0,1.52.0', 'cvs: main bumps to 1.53.2 with its rewritten closer (the check retires, the invitation returns), roster 1.49.2, the six rewritten walks hold 1.52.0');
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
      ['main', 7, '**You\u2019re All Set**', 'Feel free to replay this guide anytime right here in Settings, or jump into walkthroughs for other in-app features.'],
      ['roster', 0, '**First, your Roster Report**', 'Upload your Roster Report PDF directly from CrewApp using the paperclip icon.'],
      ['roster', 1, '**Hands-Free Import**', 'Every line is analyzed automatically. All flights, dates, sectors, and reporting times are extracted instantly without you typing a thing.'],
      ['roster', 2, '**Seamless Integration**', 'Your calendar fills up instantly with your imported data.'],
      ['roster', 3, '**Seamless Integration**', 'As well as the allowances from your flights.'],
      ['roster', 4, '**Stay updated**', 'Re-upload your pdf whenever you get a new monthly roster or schedule changes. Your calendar and allowances update seamlessly.'],
      ['roster', 5, '**No Guesswork**', 'If your uploaded file isn\'t recognized as a valid roster, I will let you know immediately rather than guessing your data.'],
      // v1.51.0: the three overhauled walks, ALL of their new copy
      ['manual', 0, '**Just Ask**', 'Type your flights and dates like "cop sq802 17 oct sq807 18 oct" to calculate your allowance instantly.'],
      ['manual', 1, '**Manual Flight Entry**', 'Add a flight by hand if it is missing from your PDF or if you just need to calculate its allowance.'],
      ['manual', 2, '**Smart vs Manual Search**', '**Default**: Enter the flight number and date to populate the details automatically.\n**Manual**: Key in every detail by hand for full control with zero automation.'],
      ['manual', 3, '**One-Tap Calculation**', '"Calculate" checks your flight details directly against your rank and rate.'],
      ['menus', 0, '**Just Ask**', 'Type a flight and date like "sq802 menu 17 oct" to fetch your menus instantly.'],
      ['menus', 1, '**Manual Flight Entry**', 'Or add a flight by hand to view its menu.'],
      ['menus', 2, '**Manual Flight Entry**', 'Enter your flight number and select your departure date and cabin class.'],
      ['menus', 3, '**Manual Flight Entry**', 'Tap "Fetch Menu" to bring up the inflight menu.'],
      ['earnings', 0, '**Track Your Earnings**', 'This dashboard displays your total earnings from every flight month by month.'],
      ['earnings', 1, '**Monthly View**', 'Each card summarizes your earnings for a single month. Tap it to expand and view the full flight list.'],
      ['earnings', 2, '**Allowance vs Salary**', 'Switch between the two pills to alternate between your COP allowance and your calculated take-home salary.'],
      ['earnings', 3, '**Earnings Breakdown**', 'Track every dollar from your gross pay and CPF down to your overseas expenses (if any) and final net earnings.'],
      ['earnings', 4, '**Search History**', 'Easily look up your past trips by filtering for specific routes or flight numbers.'],
      ['calendar', 0, '**Roster Visualization**', 'Your imported flights automatically transforms into an interactive calendar.'],
      ['calendar', 1, '**Calendar Flight Details**', 'Tap the "Tag" button to display station codes and arrival times on the calendar.'],
      ['calendar', 2, '**Share Your Roster**', 'Turn the tags on to reveal the camera icon and instantly convert this month\u2019s roster into a shareable image.'],
      ['calendar', 3, '**Month Selection**', 'Swipe the calendar or tap the arrow buttons to transition between different months.'],
      ['calendar', 4, '**Instant Earnings Breakdown**', 'Tap any day with flights to check your calculated earnings.'],
      ['calendar', 5, '**Personal Records**', 'This section stores your all-time flight history metrics.'],


      ['stats', 0, '**Flight Passport**', 'View a complete tally of your lifetime flights, total hours, and unique stations.'],
      ['stats', 1, '**Highlights**', 'This section displays your total flight time, layover days, and top visited station across five organized rows.'],
      ['stats', 2, '**Station Leaderboard**', 'View your most frequent layover and turnaround stations ranked by frequency.'],
      ['stats', 3, '**Filter Your Rankings**', 'Tap the year pills to filter your top layovers and turnarounds by specific years or view your all-time stats.'],

      ['backup', 0, '**Your Data, Your File**', 'Securely manage your profile, rates, earnings, expenses, and flight history in one place with quick options to export a backup, restore, or clear all data.'],
      ['backup', 1, '**Secure Your Data**', 'Your profile, rates, earnings, expenses, and flight history will be saved straight to your downloads folder as a .json file.'],
      ['backup', 2, '**Restore Your Data**', 'Select your saved backup .json file to instantly load your profile, rates, earnings, expenses, and flight history back into the app.'],
      ['backup', 3, '**Reset Your Data**', 'Permanently wipes all data from this device.']

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
    // v1.52.0: the union target and the new doors
    R.ok(Array.isArray(w.CA_SPOT_TOURS.calendar.steps[0].sel) && w.CA_SPOT_TOURS.calendar.steps[0].sel.join(',') === '#ca-rc-head,#ca-rc-grid', 'calendar step 1 lights the month header AND the grid as one union target');
    R.eq(w.CA_SPOT_TOURS.backup.steps[0].sel, '#ca-dm-section', 'backup step 1 lights the WHOLE Data Management section');
    R.eq(w.CA_SPOT_TOURS.backup.steps[3].sel, '#btn-clear-data', 'backup step 4 lights the clear-all-data door');
    R.eq(w.CA_SPOT_TOURS.stats.steps[2].sel, '#ca-rc-pod-gate', 'stats step 3 lights the My Flight Stats gate');
    R.eq(w.CA_SPOT_TOURS.menus.steps[3].sel && w.CA_SPOT_TOURS.menus.steps[3].before, w.CA_SPOT_TOURS.menus.steps[3].before, 'menus step 4 rides its own fill-the-card world');
    // v1.53.0: the closer — the walk ends at the tours' own front door
    R.eq(w.CA_SPOT_TOURS.main.steps[7].sel, '#ca-ft-section', 'v1.53.0: main step 8 lights the Feature tour section itself');
    R.ok(typeof w.CA_SPOT_TOURS.main.steps[7].before === 'function', 'v1.53.0: main step 8 rides the Settings world — the folds open first');
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
    R.ok(tipText(d).indexOf('1 of 8') !== -1, 'the counter reads 1 of 8');
    R.ok(!d.getElementById('ca-spot-back'), 'Back is hidden on step 1');
    R.ok(d.getElementById('ca-spot-next') && d.getElementById('ca-spot-skip'), 'Next and Skip ride every step');
    R.eq([...d.querySelectorAll('#ca-spot-tip button')].map((b) => b.id).join(','), 'ca-spot-skip,ca-spot-next', 'step 1 orders the buttons Skip, Next \u2014 with the spacer between, Skip never hugs Next');
    d.getElementById('ca-spot-next').click();
    await wait(600);
    R.ok(tipText(d).indexOf('2 of 8') !== -1, 'Next advances to 2 of 8');
    R.ok(!!d.getElementById('ca-spot-back'), 'Back shows from step 2 on');
    // v1.49.3 (owner order): Skip sits FAR from Next — the row reads
    // Skip | spacer | Back, Next (Back only past step 1)
    const rowBtns = () => [...d.querySelectorAll('#ca-spot-tip button')].map((b) => b.id);
    R.eq(rowBtns().join(','), 'ca-spot-skip,ca-spot-back,ca-spot-next', 'step 2+ orders the buttons Skip, Back, Next \u2014 the destructive exit is pinned left');
    d.getElementById('ca-spot-back').click();
    await wait(600);
    R.ok(tipText(d).indexOf('1 of 8') !== -1, 'Back re-runs the prior step\u2019s world');
    for (let i = 0; i < 6; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(tipText(d).indexOf('7 of 8') !== -1, 'seven steps in, the counter reads 7 of 8');
    d.getElementById('ca-spot-next').click();
    await wait(600);
    R.ok(tipText(d).indexOf('8 of 8') !== -1 && tipText(d).indexOf('You\u2019re All Set') !== -1, 'v1.53.0: step 8 titles the closer \u2014 the copy VERBATIM');
    R.ok(tipText(d).indexOf('Feel free to replay this guide anytime right here in Settings, or jump into walkthroughs for other in-app features.') !== -1, 'the eighth line reads word-for-word (v1.53.2: the rewritten closer)');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.53.0: the eighth step lights inside Settings \u2014 its world opened the sheet');
    R.ok(!d.getElementById('ca-ft-section').classList.contains('ca-acc-closed'), 'the lit Feature tour section sits OPEN \u2014 the world unfolded it first');
    d.getElementById('ca-spot-next').click();
    await wait(520);
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Done stands the tour down');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.53.0: the stage revert closes Settings behind the Done');
    // v1.50.0: completion is per-walk now — the store stamps at the walk's
    // cv, and main keeps its legacy mirror (the archive pin + the
    // welcome-restore door read it)
    R.eq(w.localStorage.getItem('crewAssist.spotMainDone'), '1', 'Done on the main tour keeps the legacy spotMainDone mirror');
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ main: '1.53.2' }), 'Done stamps the per-walk store at main\u2019s current cv');
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
    R.ok(tipText(d).indexOf('4 of 8') !== -1, 'the walk reaches step 4');
    d.getElementById('ca-spot-next').click();
    await wait(520);
    R.ok(tipText(d).indexOf('6 of 8') !== -1, 'the vanished theme step skips itself \u2014 the counter carries on to 6');
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
    R.ok(tipText(d).indexOf('Track Your Earnings') !== -1, 'earnings step 1 shows (v1.51.0 copy)');
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'the earnings tour opens the archive on its own');
    R.ok(tipText(d).indexOf('1 of 5') !== -1, 'the earnings walk counts five (v1.51.0)');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'v1.50.0: the archive the walk opened closes behind it');

    // calendar: the sheet opens, the tag world obeys each step — and the
    // tag chip the walk switched ON reverts OFF at the end
    w.caSpotStart('calendar');
    await wait(600);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar tour opens the calendar on its own');
    R.ok(tipText(d).indexOf('Roster Visualization') !== -1, 'calendar step 1 shows (v1.52.0 copy)');
    R.ok(tipText(d).indexOf('1 of 6') !== -1, 'the calendar walk counts six');
    R.eq(w.eval('caSpotVis(["#ca-rc-head", "#ca-rc-grid"]).id'), 'ca-rc-head', 'the union sel resolves its first member \u2014 the header');
    R.eq(w.eval('caSpotVis(["#nope-not-there", "#ca-rc-grid"]).id'), 'ca-rc-grid', 'a union member that vanishes drops out \u2014 the ring wraps the rest');
    d.getElementById('ca-spot-next').click(); await wait(520);
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Share Your Roster') !== -1, 'calendar step 3 shows (v1.52.0 copy)');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'true', 'the camera step turns the tags ON first');
    R.ok(!d.getElementById('ca-rc-shot').classList.contains('hidden'), 'the camera appears only with the tags on \u2014 the owner\u2019s correction, live');
    d.getElementById('ca-spot-back').click(); await wait(520);
    R.ok(tipText(d).indexOf('Calendar Flight Details') !== -1, 'Back returns to the tag step (v1.52.0 copy)');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'false', 'the tag step\u2019s world resets the tags OFF');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-roster-cal').classList.contains('hidden'), 'v1.50.0: the calendar sheet closes at the walk\u2019s end');
    R.eq(d.getElementById('ca-rc-tag').getAttribute('aria-pressed'), 'false', 'v1.50.0: the tag chip sits as it sat before the walk');

    // stats (v1.52.0): the passport opens; step 4 rides the gate\u2019s own
    // door into the records list; both sheets close at the end
    w.caSpotStart('stats');
    await wait(600);
    R.ok(!d.getElementById('ca-rc-podwrap').classList.contains('hidden'), 'the stats tour opens the passport on its own');
    R.ok(tipText(d).indexOf('Flight Passport') !== -1, 'stats step 1 shows (v1.52.0 copy)');
    R.ok(tipText(d).indexOf('1 of 4') !== -1, 'the stats walk counts four');
    d.getElementById('ca-spot-next').click(); await wait(520);
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Station Leaderboard') !== -1, 'stats step 3 lights the My Flight Stats gate');
    R.ok(d.getElementById('ca-rc-statwrap').classList.contains('hidden'), 'the records page still waits behind the gate');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Filter Your Rankings') !== -1, 'stats step 4 rides through the gate');
    R.ok(!d.getElementById('ca-rc-statwrap').classList.contains('hidden'), 'step 4\u2019s world opens the records list through the app\u2019s own door');
    w.caSpotEnd();
    await wait(500);
    R.ok(d.getElementById('ca-rc-podwrap').classList.contains('hidden'), 'v1.50.0: the passport closes at the walk\u2019s end');
    R.ok(d.getElementById('ca-rc-statwrap').classList.contains('hidden'), 'v1.52.0: the records page the walk opened closes behind it too');

    // backup: Settings open at the start (the real flow — the row lives in
    // it) stays open THROUGH the walk and is restored open at the end
    w.openSettings();
    await wait(450);   // let the sheet finish its glide — the snapshot must read it open
    w.caSpotStart('backup');
    await wait(600);
    R.ok(tipText(d).indexOf('Your Data, Your File') !== -1, 'backup step 1 shows (v1.52.0 copy)');
    R.ok(tipText(d).indexOf('1 of 4') !== -1, 'the backup walk counts four');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the backup tour keeps Settings open');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'Settings stays open through the walk');
    R.ok(tipText(d).indexOf('Secure Your Data') !== -1, 'backup step 2 shows (v1.52.0 copy)');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Restore Your Data') !== -1, 'backup step 3 shows (v1.52.0 copy)');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Reset Your Data') !== -1, 'backup step 4 lights the clear-all-data door');
    R.ok(!!w.eval('caSpotVis("#btn-clear-data")'), 'the clear-all-data button is the lit target');
    w.caSpotEnd();
    await wait(500);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.50.0: Settings restores OPEN \u2014 the walk found it that way');
    w.closeSettings();
    await wait(500);

    // manual (v1.51.0, owner order): the walk teaches its four doors — the
    // chat command, the calculate chip, the Settings interface, the card's
    // Calculate button — and the card still leaves with the veil
    const chatKidsBefore = d.getElementById('chat-container').children.length;
    w.openSettings();
    await wait(450);   // same: the snapshot reads the settled sheet
    w.caSpotStart('manual');
    await wait(600);
    R.ok(tipText(d).indexOf('Just Ask') !== -1, 'manual step 1 shows (v1.51.0 copy)');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the manual walk now opens on the MAIN screen — the world closes Settings');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Manual Flight Entry') !== -1, 'manual step 2 lights the calculate-my-allowance chip');
    R.ok(tipText(d).indexOf('missing from your PDF') !== -1, 'step 2 reads its line verbatim');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Smart vs Manual Search') !== -1, 'manual step 3 shows');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'the interface step opens Settings on its own');
    R.eq(d.querySelectorAll('#ca-spot-tip b').length, 3, 'step 3 renders its three bolds — the title, Default and Manual');
    R.eq(d.querySelectorAll('#ca-spot-tip br').length, 1, 'the owner\u2019s (new line) marker renders one real line break');
    // the Settings sheet scrolled mid-walk rides home at the end (v1.51.0)
    w.eval('document.getElementById("settings-scroll").scrollTop = 200;');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('One-Tap Calculation') !== -1, 'manual step 4 shows');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the card step returns to the main screen');
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
    R.eq(d.getElementById('settings-scroll').scrollTop, 0, 'v1.51.0: the Settings sheet\u2019s scroll rides home with the stage');

    // menus (v1.52.0, owner order): four doors \u2014 the chat command, the
    // menu chip, the empty form, then the filled card (802 + TODAY)
    // whose app-own fetch path brings the gold Fetch menu button up.
    // Offline with a seeded cabin schedule the app\u2019s own saved-copy
    // path renders the button with no network \u2014 the offline road the
    // app ships. The fetch writes the recents list; the stage puts it
    // back \u2014 a tour saves nothing.
    const todayYMD = (() => { const t = new Date(); const off = t.getTimezoneOffset() * 60000; return (new Date(t.getTime() - off)).toISOString().split('T')[0]; })();
    const RECENTS_SEED = JSON.stringify([{ flight: '736', date: '2026-01-05' }]);
    w.localStorage.setItem('SQ802:' + todayYMD + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, aircraftType: '787', cabinClasses: ['JCL', 'YCL'], legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'HND' } }] } }));
    w.localStorage.setItem('crewAssist.recentFlights', RECENTS_SEED);
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });   // the app\u2019s own offline path \u2014 no network in jsdom
    const chatKidsBeforeMenus = d.getElementById('chat-container').children.length;
    w.caSpotStart('menus');
    await wait(600);
    R.ok(tipText(d).indexOf('Just Ask') !== -1, 'menus step 1 shows (v1.51.0 copy)');
    R.ok(tipText(d).indexOf('sq802 menu 17 oct') !== -1, 'the step-1 line quotes its example verbatim');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('Or add a flight by hand') !== -1, 'menus step 2 lights the what\u2019s-being-served chip');
    d.getElementById('ca-spot-next').click(); await wait(520);
    R.ok(tipText(d).indexOf('3 of 4') !== -1, 'menus step 3 shows');
    R.ok(tipText(d).indexOf('Enter your flight number and select your departure date and cabin class.') !== -1, 'the form step reads its line verbatim');
    R.ok(!!w.caSpot.fvEl && !!d.querySelector('#chat-container [id^="fv-flight-"]'), 'the prop is a real Inflight Menu card \u2014 the app\u2019s own engine, flight number field and all');
    R.ok(d.getElementById('chat-container').children.length > chatKidsBeforeMenus, 'the card lives in the thread while the veil is up');
    const fvFlightInput = d.querySelector('#chat-container [id^="fv-flight-"]');
    R.eq(fvFlightInput.value, '', 'the form step\u2019s card hands over its PRISTINE form');
    d.getElementById('ca-spot-next').click();
    let btnUp = false;
    for (let i = 0; i < 40 && !btnUp; i++) { await wait(250); btnUp = tipText(d).indexOf('4 of 4') !== -1; }
    R.ok(btnUp, 'the button step waits for the app\u2019s own fetch path to land (offline: the saved schedule)');
    R.ok(tipText(d).indexOf('Tap "Fetch Menu" to bring up the inflight menu.') !== -1, 'the button step reads its line verbatim');
    R.eq(fvFlightInput.value, '802', 'the fill is the owner\u2019s: 802 in the flight field');
    R.ok(!!d.querySelector('#chat-container [data-fv-act="menu"]'), 'the gold Fetch menu button is there \u2014 the fetch\u2019s own render');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.recentFlights'))[0].flight, '802', 'the fetch wrote the recents list, as a real search does');
    // Back: the form step\u2019s world hands the card back pristine
    d.getElementById('ca-spot-back').click(); await wait(520);
    R.ok(tipText(d).indexOf('3 of 4') !== -1, 'Back returns to the form step');
    R.eq(fvFlightInput.value, '', 'Back re-runs the form world \u2014 the filled flight clears away');
    const fvArea = d.querySelector('#chat-container [id^="fv-action-area-"]');
    R.ok(!fvArea || fvArea.classList.contains('hidden'), 'the fetched cabins fold away with the reset');
    d.getElementById('ca-spot-next').click();
    let btnUp2 = false;
    for (let i = 0; i < 40 && !btnUp2; i++) { await wait(250); btnUp2 = tipText(d).indexOf('4 of 4') !== -1; }
    R.ok(btnUp2, 'the fill runs again \u2014 idempotent');
    // the chip rail scrolled mid-walk rides home at the end (v1.51.0, the
    // owner\u2019s roster-walk report)
    w.eval('document.getElementById("action-chips").scrollLeft = 90;');
    d.getElementById('ca-spot-next').click();   // Done on the last step
    await wait(600);
    R.ok(!w.caSpot.on, 'the menus walk stands down at Done');
    R.eq(d.getElementById('action-chips').scrollLeft, 0, 'v1.51.0: a walk never leaves the chip rail scrolled away \u2014 the stage revert carries it home');
    R.ok(!d.querySelector('#chat-container [id^="fv-flight-"]'), 'the Inflight Menu card leaves with the veil');
    R.eq(d.getElementById('chat-container').children.length, chatKidsBeforeMenus, 'the thread reads exactly as it did before the menus walk');
    R.eq(w.localStorage.getItem('crewAssist.recentFlights'), RECENTS_SEED, 'v1.52.0: the recents list the fetch wrote rides home with the stage \u2014 a tour saves nothing');
    R.ok(!!w.localStorage.getItem('SQ802:' + todayYMD + ':CABINS'), 'the seeded cabin schedule survives \u2014 nothing pruned away');
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ main: '1.53.2', menus: '1.52.0' }), 'the menus Done stamps at its 1.52.0 content (main sits there from the legacy materialization)');

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

  // ---- v1.53.0: the Settings accordions — the four quieter sections
  // (Feature tour, Developer Mode, Storage, Data Management) fold behind
  // their headers. Dependency-free and data-attribute-bound; v1.53.1
  // (owner order): they START FOLDED — one tap opens; in memory only;
  // a fold hides its target; the worlds unfold; the stage revert folds
  // the crew's own state home ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    R.eq(typeof w.caAccOpenAll, 'function', 'caAccOpenAll is global — the Settings worlds reach it');
    R.eq(typeof w.caAccState, 'function', 'caAccState is global — the stage snapshot reads it');
    R.eq(typeof w.caAccRestore, 'function', 'caAccRestore is global — the stage revert drives it');
    R.eq([...d.querySelectorAll('.ca-acc')].map((el) => el.getAttribute('data-ca-acc')).join(','), 'ft,dev,storage,dm', 'exactly four accordion sections: Feature tour, Developer Mode, Storage, Data Management');
    R.eq(d.querySelectorAll('[data-accordion-target]').length, 4, 'four heads, every one bound through data-accordion-target');
    // v1.53.1 (owner order): the folds start CLOSED
    R.ok([...d.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed')), 'every section starts FOLDED (v1.53.1, owner order)');
    R.ok([...d.querySelectorAll('[data-accordion-target]')].every((b) => b.getAttribute('aria-expanded') === 'false'), 'the heads announce themselves folded (aria)');
    // a plain click opens; a second click folds — no framework, one delegated listener
    const keysBefore = JSON.stringify(Object.keys(w.localStorage).sort());
    d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').click();
    R.ok(!d.getElementById('ca-ft-section').classList.contains('ca-acc-closed'), 'a head tap opens its section');
    R.eq(d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').getAttribute('aria-expanded'), 'true', 'the head announces the open');
    R.ok(d.getElementById('ca-ft-section').querySelector('.ca-acc-body') !== null, 'the body sits in the DOM (the grid-rows ride does the height)');
    d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').click();
    R.ok(d.getElementById('ca-ft-section').classList.contains('ca-acc-closed'), 'a second tap folds it again');
    // caAccOpenAll + state + restore round-trip
    R.eq(w.caAccState().ft, false, 'caAccState reads the fold');
    d.querySelector('[data-accordion-target=\"ca-acc-dm\"]').click();
    R.eq(w.caAccState().dm, true, 'caAccState reads the open');
    w.caAccOpenAll();
    R.ok(Object.values(w.caAccState()).every((v) => v === true), 'caAccOpenAll opens every fold');
    R.eq(JSON.stringify(Object.keys(w.localStorage).sort()), keysBefore, 'the fold state never touches localStorage — in memory only, a reload folds everything again');
    // the worlds unfold before they light, and the stage revert folds the
    // crew's own state home: fold TWO sections, walk, end — both re-folded
    w.openSettings();
    await wait(450);
    // the round-trip left every fold open — set the crew's state by hand
    // through the app's own door: everything folded, then the crew taps
    // the Feature tour fold open
    w.caAccRestore({ ft: false, dev: false, storage: false, dm: false });
    d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').click();
    // the engine's shown-check: the open fold shows its panel; folded, it
    // hides the panel exactly like a vanished target would
    R.eq(!!w.eval('caSpotVis(\"#ca-feature-tours\")'), true, 'the tapped-open fold shows its panel');
    d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').click();
    R.eq(!!w.eval('caSpotVis(\"#ca-feature-tours\")'), false, 'v1.53.0: a closed fold reads as a VANISHED target — the shown-check walks the ca-acc-closed ancestors');
    d.querySelector('[data-accordion-target=\"ca-acc-ft\"]').click();   // the crew leaves it open
    // the crew's state: FT open (tapped), the rest folded — the walk's
    // world opens every fold it needs, and the revert hands the crew's
    // own state home
    w.caSpotStart('backup');
    await wait(600);
    R.ok(tipText(d).indexOf('Your Data, Your File') !== -1, 'the backup walk lights a section that sat folded — the Settings world opened the fold first');
    R.ok(!d.getElementById('ca-dm-section').classList.contains('ca-acc-closed'), 'the lit DM section sits open mid-walk — the world unfolded the default');
    d.getElementById('ca-spot-skip').click();
    await wait(500);
    R.ok(d.getElementById('ca-dm-section').classList.contains('ca-acc-closed'), 'v1.53.0: the stage revert re-folds the section the crew had folded (the default state)');
    R.ok(!d.getElementById('ca-ft-section').classList.contains('ca-acc-closed'), 'the section the crew had tapped open rides home open');
    R.ok(d.querySelector('[data-ca-acc=\"storage\"]').classList.contains('ca-acc-closed'), 'an untouched section stays folded through the revert');
    w.caAccOpenAll();
    w.closeSettings();
    await wait(500);
    // the src contract: delegated binding, grid-rows fold, reduced-motion kill
    R.ok(src.indexOf('e.target.closest && e.target.closest(\'[data-accordion-target]\')') >= 0, 'the toggle binds through the data attribute — one delegated document listener');
    R.ok(src.indexOf('.ca-acc.ca-acc-closed .ca-acc-body { grid-template-rows: 0fr; opacity: 0; }') >= 0, 'the fold rides grid-template-rows 1fr→0fr — zero JS measuring');
    R.ok(src.indexOf('html.ca-reduced .ca-acc-body, html.ca-reduced .ca-acc-head .ca-acc-chev { transition: none; }') >= 0, 'reduced motion folds instantly');
    // v1.53.0's engine lesson: a near-viewport-tall lit target clamps the
    // tooltip onto the ring's edge — the tip-aware scroll pass shifts the
    // nearest scrollable just enough for a clean fit (pinned end-to-end by
    // the smoke rig's never-covers geometry in real Chromium)
    R.ok(src.indexOf('function caSpotFitTip(el, rect)') >= 0 && src.indexOf('if (caSpotFitTip(el, rect))') >= 0, 'the tip-aware scroll pass rides every placement — the ring glides, so the fit reads the placement rect, never the transitioning box');
  }

  // ---- v1.58.0 (owner orders): the main walk's Done lands on the chat
  // screen — step 8's Settings world never hands the sheet back on
  // completion — and the Settings folds never survive a close: a reopen
  // always finds them collapsed however they were left ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.spotMainDone', '1');
    } });
    R.eq(typeof w.caAccCloseAll, 'function', 'v1.58.0: caAccCloseAll is global — the close door drives it');
    // the folds never survive a close: open the sheet, expand two sections,
    // close, reopen — everything sits collapsed
    w.openSettings();
    await wait(450);
    d.querySelector('[data-accordion-target="ca-acc-ft"]').click();
    d.querySelector('[data-accordion-target="ca-acc-dm"]').click();
    R.ok(!d.getElementById('ca-ft-section').classList.contains('ca-acc-closed') && !d.getElementById('ca-dm-section').classList.contains('ca-acc-closed'), 'two sections stand open inside the sheet');
    const keysBefore58 = JSON.stringify(Object.keys(w.localStorage).sort());
    w.closeSettings();
    await wait(500);
    R.ok([...d.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed')), 'v1.58.0: the close door folds every section — however they were left');
    R.ok([...d.querySelectorAll('[data-accordion-target]')].every((b) => b.getAttribute('aria-expanded') === 'false'), 'the heads announce themselves folded after the close');
    R.eq(JSON.stringify(Object.keys(w.localStorage).sort()), keysBefore58, 'the fold reset never touches localStorage — still in memory only');
    w.openSettings();
    await wait(450);
    R.ok([...d.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed')), 'v1.58.0: the reopen finds every section collapsed — the fold state died with the close');
    // the row-tapped main walk: Done at step 8 CLOSES the Settings sheet
    d.querySelector('[data-accordion-target="ca-acc-ft"]').click();   // the crew leaves the tours fold open as they tap in
    d.querySelector('#ca-feature-tours [data-ca-spot="main"]').click();
    await wait(600);
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'the main row-tap closes Settings for the walk (the v1.49.0 order holds DURING the walk)');
    for (let i = 0; i < 7; i++) { d.getElementById('ca-spot-next').click(); await wait(520); }
    R.ok(tipText(d).indexOf('You\u2019re All Set') !== -1, 'the walk stands on step 8 — the closer, in the Settings world');
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'step 8 rides the Settings world — the sheet is open under the closer');
    d.getElementById('ca-spot-next').click();   // Done
    await wait(700);
    R.ok(!d.documentElement.classList.contains('ca-spot-on'), 'Done stands the tour down');
    R.ok(d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.58.0: the main walk\u2019s Done CLOSES Settings — the crew lands on the chat screen, whatever path started the walk');
    R.ok([...d.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed')), 'v1.58.0: the folds rode the close door down — a reopen finds them collapsed');
    // Skip keeps the pre-tap contract: the sheet hands back open
    w.openSettings();
    await wait(450);
    d.querySelector('#ca-feature-tours [data-ca-spot="main"]').click();
    await wait(600);
    for (let i = 0; i < 7; i++) { d.getElementById('ca-spot-next').click(); await wait(520); }
    d.getElementById('ca-spot-skip').click();
    await wait(600);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.58.0: Skip still hands Settings back open — the pre-tap contract stands for the exits that do not complete');
    w.closeSettings();
    await wait(500);
    // a NON-main walk's Done keeps the row-tap contract: the sheet reopens,
    // and the stage revert re-puts the crew's own fold state above the
    // close-fold (the v1.53.0 contract rides the open sheet)
    w.openSettings();
    await wait(450);
    d.querySelector('[data-accordion-target="ca-acc-ft"]').click();   // the crew's own state: FT open, the rest folded
    d.querySelector('#ca-feature-tours [data-ca-spot="backup"]').click();
    await wait(600);
    for (let i = 0; i < 3; i++) { d.getElementById('ca-spot-next').click(); await wait(520); }
    d.getElementById('ca-spot-next').click();   // Done on the backup walk's fourth step
    await wait(700);
    R.ok(!d.getElementById('settings-backdrop').classList.contains('hidden'), 'v1.58.0: a non-main walk\u2019s Done still reopens Settings — only the main walk\u2019s closer sends the crew home');
    R.ok(!d.getElementById('ca-ft-section').classList.contains('ca-acc-closed'), 'the stage revert re-puts the crew\u2019s own fold state above the close-fold — the section they had open rides home open');
    R.ok(d.getElementById('ca-dm-section').classList.contains('ca-acc-closed'), 'the untouched sections stay folded through the revert');
    w.closeSettings();
    await wait(500);
    // the src contract: the close door drives the fold, and the main walk's
    // Done overrides the stage
    R.ok(src.indexOf("try { if (typeof caAccCloseAll === 'function') caAccCloseAll(); } catch (e) {}") >= 0, 'closeSettings drives the fold-close door');
    R.ok(src.indexOf("if (completed === true && caSpot.id === 'main' && stRestore && stRestore.settings) stRestore = Object.assign({}, stRestore, { settings: false, acc: null });") >= 0, 'the main walk\u2019s Done overrides the stage — Settings never hands back on completion');
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
    R.eq(w.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ main: '1.53.2' }), 'the legacy flag materializes into the store at main\u2019s current cv');
    R.eq(w.caSpotWalkDone('main'), true, 'the materialized state reads done');

    // a stale cv (content changed since the walk was done) reads NOT done —
    // the check retires and the invitation returns
    const { w: w2 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.setItem('crewAssist.wnSeen', '9.9.9');
      x.localStorage.setItem('crewAssist.spotDone', JSON.stringify({ main: '1.49.2', earnings: '1.52.0', menus: '1.49.0', calendar: '1.49.0' }));
    } });
    R.eq(w2.caSpotWalkDone('main'), false, 'a stale main cv reads not-done \u2014 the walk must walk again');
    R.eq(w2.caSpotWalkDone('earnings'), true, 'a matching cv still reads done (earnings at its 1.52.0 content)');
    R.eq(w2.caSpotWalkDone('menus'), false, 'a cv from before the button-step split reads not-done \u2014 the check retires with the content');
    R.eq(w2.caSpotWalkDone('calendar'), false, 'a cv from before the v1.52.0 overhaul reads not-done \u2014 the check retires with the content');

    // non-main Done stamps the store; the legacy mirror stays main-only
    const { w: w3 } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', PROFILE);
      x.localStorage.removeItem('crewAssist.spotMainDone');
      x.localStorage.removeItem('crewAssist.spotDone');
      x.localStorage.setItem('crewAssist.spotMainDeclined', '1');
    } });
    const todayYMD3 = (() => { const t = new Date(); const off = t.getTimezoneOffset() * 60000; return (new Date(t.getTime() - off)).toISOString().split('T')[0]; })();
    w3.localStorage.setItem('SQ802:' + todayYMD3 + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, cabinClasses: ['JCL'], legs: [] } }));
    Object.defineProperty(w3.navigator, 'onLine', { value: false, configurable: true });
    w3.caSpotStart('menus');
    await wait(600);
    for (let i = 0; i < 3; i++) { const n = w3.document.getElementById('ca-spot-next'); if (n) { n.click(); await wait(700); } }
    let w3step4 = false;
    for (let i = 0; i < 40 && !w3step4; i++) { await wait(250); w3step4 = w3.document.getElementById('ca-spot-tip').textContent.indexOf('4 of 4') !== -1; }
    R.ok(w3step4, 'the menus walk reaches its button step (the offline saved schedule)');
    const n3 = w3.document.getElementById('ca-spot-next'); if (n3) { n3.click(); await wait(520); }
    R.eq(w3.localStorage.getItem('crewAssist.spotDone'), JSON.stringify({ menus: '1.52.0' }), 'a non-main Done stamps its own walk (menus at its 1.52.0 content)');
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
    R.eq(card.textContent.indexOf('Eight quick steps in under a minute') !== -1, true, 'the secondary line reads verbatim (v1.53.0: the walk grew one)');
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
    R.ok(await until(() => tipText(d).indexOf('1 of 8') !== -1, 10000), 'the first spotlight is the chat bar');
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
    R.ok(await until3(() => d3.getElementById('ca-spot-tip').textContent.indexOf('1 of 8') !== -1, 10000), 'the first spotlight is the chat bar');
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
    R.ok(await until(() => tipText(d).indexOf('1 of 8') !== -1, 10000), 'the first spotlight is the chat bar');
    for (let i = 0; i < 8; i++) { const n = d.getElementById('ca-spot-next'); if (n) { n.click(); await wait(520); } }
    R.ok(!w.caSpot.on, 'Done stands the walk down');
    R.ok(await until(() => w.localStorage.getItem('crewAssist.spotDone') === JSON.stringify({ main: '1.53.2' }), 5000), 'ONLY Done completes — the store lands at main\u2019s cv');
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
    // v1.51.0 (owner orders): the scroll-home stage revert + the fv-card prop
    R.ok(src.indexOf('chips: rail ? rail.scrollLeft : null,') >= 0, 'the stage snapshot carries the chip rail\u2019s scroll (the owner\u2019s roster-walk report)');
    R.ok(src.indexOf('settingsScroll: sscroll ? sscroll.scrollTop : null') >= 0, 'the stage snapshot carries the Settings sheet\u2019s scroll');
    R.ok(src.indexOf('if (rail && st.chips !== null && rail.scrollLeft !== st.chips) rail.scrollLeft = st.chips;') >= 0, 'the stage restore scrolls the chip rail home — instant, never a glide');
    R.ok(src.indexOf('if (sscroll && st.settingsScroll !== null && sscroll.scrollTop !== st.settingsScroll) sscroll.scrollTop = st.settingsScroll;') >= 0, 'the stage restore scrolls the Settings sheet home');
    R.ok(src.indexOf('function caSpotFvWorld') >= 0, 'the menus walk builds its prop through caSpotFvWorld (the app\u2019s own Inflight Menu card)');
    R.ok(src.indexOf("renderFlightVerificationCard('menu');") >= 0, 'the fv prop is the app\u2019s own card engine, never a mock');
    R.ok(src.indexOf("String(step.line || '').split('\\n')") >= 0, 'a step line may carry the owner\u2019s (new line) marker — rendered as real line breaks');
    // v1.52.0 (owner orders): the union target, the filled fv prop, the stats door, the storage-safe stage
    R.ok(src.indexOf('if (Array.isArray(sel)) {') >= 0, 'a sel may be an ARRAY \u2014 the union target resolves member by member');
    R.ok(src.indexOf('function caSpotStepRect') >= 0 && src.indexOf('if (!Array.isArray(step.sel)) return el.getBoundingClientRect();') >= 0, 'the union\u2019s ring wraps every member it resolves');
    R.ok(src.indexOf("sel: ['#ca-rc-head', '#ca-rc-grid']") >= 0, 'calendar step 1 lights the month header AND the grid as one');
    R.ok(src.indexOf('function caSpotFvReset') >= 0, 'the form world hands the card back pristine');
    R.ok(src.indexOf("input.value = '802';") >= 0 && src.indexOf('today.click();') >= 0, 'the button step fills 802 and taps the app\u2019s own TODAY pill');
    R.ok(src.indexOf('function caSpotFvBtnWorld') >= 0, 'the button step rides its own world');
    R.ok(src.indexOf('function caSpotStatWorld') >= 0 && src.indexOf('openRcStat();') >= 0, 'the stats walk\u2019s last step opens the records list through the app\u2019s own door');
    R.ok(src.indexOf("stat: caSpotSheetOpen('ca-rc-statwrap', null),") >= 0, 'the stage snapshot carries the records-list sheet');
    R.ok(src.indexOf('recentFlights: recent,') >= 0 && src.indexOf('sqKeys: sq') >= 0, 'the stage snapshot carries the recents list and every menu-cache key');
    R.ok(src.indexOf('if (st.recentFlights === null) localStorage.removeItem(rf);') >= 0, 'the stage restore puts the storage back \u2014 a tour saves nothing');
    // v1.50.0 (owner order): the stage reverts with the chat
    R.ok(src.indexOf('function caSpotStageSnap') >= 0 && src.indexOf('function caSpotStageRestore') >= 0, 'the stage snapshot/restore pair exists');
    R.ok(src.indexOf("try { caSpot.stage = (stageOverride !== undefined && stageOverride) ? stageOverride : caSpotStageSnap(); } catch (e) { caSpot.stage = null; }") >= 0, 'the walk snapshots the stage at start (a row-tap hands its PRE-TAP snapshot in)');
    R.ok(src.indexOf('const preStage = (typeof caSpotStageSnap === \'function\') ? caSpotStageSnap() : null;') >= 0, 'the Settings rows snapshot BEFORE the handler closes the sheet — the crew lands where they tapped');
    R.ok(src.indexOf('caSpotStageRestore(stRestore);') >= 0 && src.indexOf('let stRestore = caSpot.stage;') >= 0, 'the walk restores the stage on every end (v1.58.0: the restore rides the stRestore hand-off, where the main walk\u2019s Done override lands)');
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
    ['startCaTour', 'finishCaTour', 'maybeOfferTour', 'caTourInterrupt', 'caTourPace', 'caTourArchiveStore', 'CA_TOUR_STEPS', 'tourDone', 'ca-tour-on', 'ca-tour-glow', 'caTourPulse', 'btn-replay-tour', 'ca-tour-bubble', 'ca-tour-offer', 'caSpotFresh', 'caSpotSeen', 'caSpotMarkSeen', 'caSpotMenuWorld', 'COP vs Salary', 'fill in all the details', 'The tag button', 'The camera comes out', 'Walk the months', 'Tap a day', 'The records door', 'Your passport', 'The stats podium', 'Slice it your way', 'Every visit on record', 'Export before you switch', 'The new phone', 'Expenses ride along', 'Keep it private', 'Your data, your file', 'The whole batch', 'Save it or undo', 'Saved on your phone', 'Take it with you', 'Two ways to read it', 'This is your money page'].forEach((dead) => {
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
