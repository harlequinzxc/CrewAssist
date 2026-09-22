// Feature tour: the five-step walk (chat → roster showpiece with the earnings
// thread → Default → Manual → menu/print), driven end-to-end in jsdom where
// the network is offline — which is exactly what the Default step's honest
// pivot and the menu watcher's pivot are built for.
const H = require('./_harness');
const { R, boot, wait, APP } = H;

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
const chatText = (d) => d.getElementById('chat-container').textContent;
const clickLast = (d, sel) => {
    const els = d.querySelectorAll(sel);
    if (!els.length) return false;
    els[els.length - 1].click();
    return true;
};

(async () => {
  // ---- registry is data: five steps, in the owner's order ----
  {
    const { w } = await boot(APP);
    R.eq(typeof w.startCaTour, 'function', 'startCaTour is global (tour intent can reach it)');
    R.eq(w.CA_TOUR_STEPS.map((s) => s.id).join(','), 'chat,roster,default,manual,menu', 'five steps: chat, roster, default, manual, menu');
    R.ok(w.CA_TOUR_STEPS[4].expectsInput === true, 'the menu step is the interactive one');
  }

  // ---- full walk, started through the chat intent ----
  {
    const { w, d } = await boot(APP);
    const until = mkUntil(d);
    const nextCount = () => d.querySelectorAll('.ca-tour-next').length;
    const nextReady = async (n, ms) => until(() => nextCount() === n && !w.isChatBusy(), ms || 25000);
    w.processInput('tour');

    // step 0: chat basics
    R.ok(await until(() => chatText(d).indexOf('This is your crew assistant') !== -1, 20000), 'step 0 narration types');
    R.ok(await nextReady(1), 'step 0 ends with Next / Skip tour');
    clickLast(d, '.ca-tour-next');

    // step 1: roster showpiece with the earnings thread woven in
    R.ok(await until(() => chatText(d).indexOf('demo month') !== -1, 20000), 'roster step announces the demo month');
    R.ok(await until('.ca-tour-glow', 15000), 'gold ring glow marks the narrated target');
    R.ok(await until('.roster-calc-all-btn', 20000), 'demo roster confirm bubble renders');
    const conf = chatText(d);
    R.ok(conf.indexOf('Demo month.pdf') !== -1, 'demo month is labelled as a file');
    R.ok(/3 trips/.test(conf) && /8 sectors/.test(conf), 'three trips, eight sectors');
    R.ok(/Skipped \d+ non-flying day/.test(conf), 'non-flying days are reported honestly');
    R.ok(await until(() => !d.getElementById('results-backdrop').classList.contains('hidden'), 25000), 'Calculate all opens the combined summary');
    R.ok(await until(() => chatText(d).indexOf('$823.23') !== -1, 15000), 'the month totals $823.23 (360.72 + 154.35 + 308.16)');
    R.ok(await until(() => w.caTour.entries.length === 3, 20000), 'the save beat files three demo entries');
    R.eq(w.localStorage.getItem('crewAssist.archive'), null, 'demo saves never touch localStorage');
    R.ok(await until(() => !d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 15000), 'the earn chip opens the earnings page');
    R.ok(await until(() => d.querySelectorAll('#ca-arch-list .ca-arch-row').length === 3, 10000), 'archive shows the three demo flights');
    R.ok(d.getElementById('ca-arch-list').textContent.indexOf('Jul 2026') !== -1, 'grouped under the demo month');
    R.ok(await until(() => !d.getElementById('ca-arch-sub').classList.contains('hidden'), 10000), 'tapping a row reopens its summary');
    R.ok(d.getElementById('ca-arch-sub-sheet').textContent.indexOf('Flight Overview') !== -1, 'reopened summary carries the Flight Overview');
    R.ok(await nextReady(2), 'roster step ends with Next');
    clickLast(d, '.ca-tour-next');

    // step 2: Default — offline, so the honest pivot
    R.ok(await until(() => chatText(d).indexOf('never a made-up number') !== -1, 30000), 'offline Default step pivots honestly');
    const cards = d.querySelectorAll('[data-calc-card]');
    const lastCard = cards[cards.length - 1];
    R.ok(lastCard && lastCard.querySelector('input[id$="-ifa-fn1"]') && lastCard.querySelector('input[id$="-ifa-fn1"]').value === '11', 'SQ 11 typed into the demo card');
    R.ok(await nextReady(3), 'Default step ends with Next');
    clickLast(d, '.ca-tour-next');

    // step 3: Manual — the real settings pill, KTM by hand, $360.72
    R.ok(await until(() => w.localStorage.getItem('crewAssist.calcUi') === 'manual', 20000), 'Manual switched through the real settings pill');
    R.ok(await until(() => {
        const rb = d.getElementById('results-backdrop');
        return !rb.classList.contains('hidden') && d.getElementById('results-content').textContent.indexOf('360.72') !== -1;
    }, 30000), 'the hand-typed KTM layover computes $360.72');
    R.ok(await until(() => w.caTour.entries.length === 4, 20000), 'the manual summary saves like every other');
    R.ok(await until(() => w.localStorage.getItem('crewAssist.calcUi') === 'default', 15000), "the crew's original mode is restored");
    R.ok(await nextReady(4), 'Manual step ends with Next');
    clickLast(d, '.ca-tour-next');

    // step 4: menu + print — interactive; the crew's typing IS the demo
    R.ok(await until(() => chatText(d).indexOf('yours to drive') !== -1, 20000), 'menu step hands over the keys');
    R.ok(await nextReady(5, 30000), 'Finish / Skip tour wait while the crew drives');
    w.processInput('menu');
    R.ok(await until('[id^="fv-mode-"]', 15000), 'typing menu mid-step does not interrupt — the real card opens');
    const fv = d.querySelector('[id^="fv-mode-"]');
    const uid = fv.id.replace('fv-mode-', '');
    const finp = d.getElementById('fv-flight-' + uid);
    finp.value = '11';
    // the date pills carry inline onclick attributes, which jsdom's
    // outside-only mode never compiles — call the handler directly instead
    w.setDateAndFetch(uid, w.todayLocalYMD(), 'today');
    R.ok(await until(() => chatText(d).indexOf('honest error') !== -1, 25000), 'the watcher pivots on the offline fetch error');
    clickLast(d, '.ca-tour-next'); // Finish

    // the tour packs itself up
    R.ok(await until(() => w.caTour.on === false, 20000), 'the tour finishes');
    R.eq(w.localStorage.getItem('crewAssist.tourDone'), '1', 'tourDone recorded');
    R.eq(w.localStorage.getItem('crewAssist.archive'), null, 'no demo data ever reached localStorage');
    R.eq(w.localStorage.getItem('crewAssist.calcUi'), 'default', 'calculator mode left as found');
    R.ok(await until(() => d.querySelectorAll('.ca-tour-bubble').length === 0, 10000), 'every demo bubble folded away');
    R.ok(chatText(d).indexOf("That's the lot") !== -1, 'the closing line outlives the cleanup');
    R.ok(!!d.querySelector('[id^="fv-mode-"]'), "the crew's own menu card stays in the thread");
    R.eq(w.loadArchive().length, 0, 'the archive reads empty once the tour is over');
  }

  // ---- first-run offer: appears once, skippable, never nags ----
  {
    const { w, d } = await boot(APP);
    const until = mkUntil(d);
    // complete onboarding the way a first-run crew would
    const name = d.getElementById('ob-name');
    name.value = 'Tour Tester';
    name.dispatchEvent(new w.Event('input', { bubbles: true }));
    d.querySelector('.ob-gender-btn').click();
    await wait(150);
    d.querySelector('.ob-rank-btn').click();
    await wait(50);
    d.getElementById('ob-submit').click();
    const wn = d.getElementById('whatsnew-close');
    if (wn) wn.click();
    R.ok(await until('.ca-tour-offer-go', 25000), 'the offer lands after the greeting');
    R.ok(!!d.querySelector('.ca-tour-offer-skip'), 'the offer is skippable');
    d.querySelector('.ca-tour-offer-skip').click();
    R.ok(await until(() => w.localStorage.getItem('crewAssist.tourDone') === '1', 5000), 'skip records tourDone');
    R.ok(await until(() => chatText(d).indexOf('No worries') !== -1, 8000), 'skip is acknowledged warmly');
    w.maybeOfferTour();
    await wait(800);
    R.eq(d.querySelectorAll('.ca-tour-offer-go').length, 1, 'the offer never repeats');
  }

  // ---- interruption: typing yields, resume restarts the same step ----
  {
    const { w, d } = await boot(APP);
    const until = mkUntil(d);
    const nextCount = () => d.querySelectorAll('.ca-tour-next').length;
    w.startCaTour(true);
    R.ok(await until(() => nextCount() === 1 && !w.isChatBusy(), 25000), 'step 0 reaches its buttons');
    w.processInput('what can you do');
    R.ok(await until(() => chatText(d).indexOf('Pick up where we left off') !== -1, 25000), 'the tour yields and offers to resume');
    R.ok(chatText(d).indexOf("didn't quite catch that") !== -1, 'the question itself was answered first');
    R.ok(await until(() => nextCount() === 2 && !w.isChatBusy(), 15000), 'Resume / Skip tour offered');
    clickLast(d, '.ca-tour-next'); // Resume
    R.ok(await until(() => chatText(d).split('This is your crew assistant').length === 3, 20000), 'resume restarts the same step fresh');
    R.ok(await until(() => nextCount() === 3, 20000), 'the restarted step reaches its buttons');
    clickLast(d, '.ca-tour-skip'); // Skip tour
    R.ok(await until(() => w.caTour.on === false, 10000), 'skip ends the tour');
    R.eq(w.localStorage.getItem('crewAssist.tourDone'), '1', 'skip records tourDone');
    R.ok(await until(() => chatText(d).indexOf('No problem') !== -1, 8000), 'skip farewell lands');
    R.ok(await until(() => d.querySelectorAll('.ca-tour-bubble').length === 0, 10000), 'bubbles excised after skip');
    R.ok(await until(() => (w.localStorage.getItem('crewAssist.calcUi') || 'default') === 'default', 5000), 'mode untouched by an early skip');
  }

  process.exit(R.done());
})().catch((e) => { console.error(e); process.exit(1); });
