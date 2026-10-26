// Earnings archive: SIN-only route stripping, real-current-month expansion,
// and the settings-style delete confirmation with undo-safe cancel.
// v1.24.0: segmented summary scopes, 12-month chart with projection stubs,
// twelve insight cards, month badges + YoY arrows, search-scoped delete.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
(async () => {
  // route display + month expansion
  {
    // frozen clock: the block's "current/future month" expectations are
    // pinned to Sep 2026 and must not drift with the real date
    const { w, d } = await boot(APP, { now: '2026-09-20T12:00:00+08:00' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-10-29T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-29', stationDisplay: 'JNB/SIN', amount: 100 },
      { id: 'M', savedAt: '2026-10-20T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-20', stationDisplay: 'JNB/CPT', amount: 50 },
      { id: 'S', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'NRT/LAX', amount: 70 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    // v1.45.13: a fresh open starts on the current month's COP allowance
    R.ok(d.querySelector('.ca-arch-seg[data-scope="month"]').classList.contains('ca-arch-segon') && !d.querySelector('.ca-arch-seg[data-scope="all"]').classList.contains('ca-arch-segon'), 'v1.45.13: Month is the default scope');
    R.ok(d.querySelector('.ca-arch-seg[data-mode="cop"]').classList.contains('ca-arch-segon'), 'v1.45.13: COP Allowance is the default lens');
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(100);
    const txt = d.getElementById('ca-arch-list').textContent;
    R.ok(txt.includes('JNB') && !txt.includes('JNB/SIN'), 'SIN stripped from turnaround');
    R.ok(txt.includes('JNB/CPT') && txt.includes('NRT/LAX'), 'multisector kept');
    const grp = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]').closest('.ca-arch-group');
    const sepG = grp('2026-09'), octG = grp('2026-10');
    R.ok(sepG && !sepG.classList.contains('ca-arch-collapsed'), 'current real month (Sep) expanded');
    R.ok(octG && octG.classList.contains('ca-arch-collapsed'), 'future month (Oct) collapsed');
  }

  // delete confirmation: settings-style pop-up, OK deletes, Cancel keeps
  {
    const { w, d } = await boot(APP);
    const seed = () => w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'JNB/CPT', amount: 100 }
    ]));
    seed();
    w.showArchiveOverlay();
    await wait(100);
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(50);
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    const backdrop = d.getElementById('app-dialog-backdrop');
    R.ok(!backdrop.classList.contains('hidden'), 'delete opens settings-style dialog');
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete all 1 entry') !== -1, 'dialog message wording');
    R.ok(!d.getElementById('app-dialog-cancel').classList.contains('hidden'), 'dialog has Cancel button');
    d.getElementById('app-dialog-ok').click();
    await wait(400); // the dialog fades out over 200ms before 'hidden' lands
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 0, 'OK deletes the entry');
    R.ok(backdrop.classList.contains('hidden'), 'dialog closes after OK');

    seed();
    w.showArchiveOverlay();
    await wait(100);
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    d.getElementById('app-dialog-cancel').click();
    await wait(100);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'Cancel keeps the entry');
  }

  // empty archive: the earnings page opens anyway, no dead-end bubbles
  {
    const { w, d } = await boot(APP);
    w.analyzeIntent('archive');
    await wait(1600); // overlay at 400ms; the greeting bubble types for up to ~900ms
    const chatTxt = d.getElementById('chat-container').textContent;
    R.ok(!/piggy bank is empty/i.test(chatTxt), 'no piggy-bank bubble');
    R.ok(!/keep track of everything/i.test(chatTxt), 'no follow-up guidance bubble');
    R.ok(/Pulling up your earnings/.test(chatTxt), 'the opening bubble still greets');
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'earnings page opens with nothing saved');
    const listTxt = d.getElementById('ca-arch-list').textContent;
    R.ok(/No flights yet/.test(listTxt), 'empty state heading');
    R.ok(/Entries appear when you tap Save on a calculation/.test(listTxt) && /restore a backup in Settings/.test(listTxt), 'v1.41.0: the empty state names both ways to fill it in mental-model order');
  }

  // tap-through: rows reopen the saved summary; old entries say so honestly
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'NEW', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', flightType: 'Layover', stationDisplay: 'KTM', amount: 360.72,
        detail: { v: 1, type: 'Layover', sectorCount: 2, rankRate: 13.5, tripSdpHm: '14H 11M', ifaTotal: 178.72, lmaTotal: 182, grandTotal: 360.72, bonusCount: 0, bonusAmount: 0,
          sectors: [
            { fn: '442', ftHm: '4H 56M', sdpHm: '7H 26M', mult: 1.3, amount: 86.58, paxing: false, directUs: false, isSg: true, dep: 'SIN', arr: 'KTM', depYmd: '2026-09-15', logic: 'Layover Bracket (SDP 7H 26M)' },
            { fn: '441', ftHm: '5H 15M', sdpHm: '6H 45M', mult: 1.3, amount: 92.14, paxing: false, directUs: false, isSg: false, dep: 'KTM', arr: 'SIN', depYmd: '2026-09-16', logic: 'Layover Bracket (SDP 6H 45M)' }
          ],
          stations: [ { code: 'KTM', region: 'South Asia', inYmd: '2026-09-15', inHm: '21:55', outYmd: '2026-09-16', outHm: '22:59', total: 182, shuttle: false, skipped: '',
            days: [ { ymd: '2026-09-15', b: 0, l: 0, d: 0, cost: 0 }, { ymd: '2026-09-16', b: 1, l: 1, d: 1, cost: 182 } ] } ],
          meals: { b: 1, l: 1, d: 1, bAmt: 36, lAmt: 64, dAmt: 82 } } },
      { id: 'OLD', savedAt: '2026-09-10T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-10', stationDisplay: 'HKT', amount: 154.35 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    const rows = d.querySelectorAll('.ca-arch-row');
    R.eq(rows.length, 2, 'rows render with tap targets');
    // sorted desc by sectorDate: NEW (15th) first, OLD (10th) second
    rows[1].click();
    await wait(400);
    const sub = d.getElementById('ca-arch-sub');
    const sheetTxt = d.getElementById('ca-arch-sub-sheet').textContent;
    R.ok(!sub.classList.contains('hidden'), 'tapping a row opens the summary sheet');
    R.ok(/Saved before detailed summaries/.test(sheetTxt), 'old entry says so honestly');
    R.ok(/154\.35/.test(sheetTxt), 'old entry still shows its total');
    d.querySelector('[data-ca-arch-sub-close]').click();
    await wait(400);
    R.ok(sub.classList.contains('hidden'), 'summary sheet closes');
    // the detailed entry reopens the whole summary
    d.querySelectorAll('.ca-arch-row')[0].click();
    await wait(400);
    const txt2 = d.getElementById('ca-arch-sub-sheet').textContent;
    R.ok(/Flight Overview/.test(txt2), 'detailed entry shows the Flight Overview');
    R.ok(/Kathmandu overnight/.test(txt2), 'overview reads in the personal voice');
    R.ok(/IFA Breakdown/.test(txt2) && /LMA Breakdown/.test(txt2), 'breakdowns rebuilt from the snapshot');
    R.ok(/SQ 442/.test(txt2) && /SQ 441/.test(txt2), 'flight numbers in the breakdown');
    R.ok(/Saved /.test(txt2), 'saved-at footer');
    // tall summaries: the body scrolls inside and opens at the TOP
    const sheetEl = d.getElementById('ca-arch-sub-sheet');
    const bodyEl = d.getElementById('ca-arch-sub-body');
    R.ok(bodyEl.classList.contains('overflow-y-auto'), 'summary body is scrollable');
    R.ok(sheetEl.classList.contains('top-[calc(60px+env(safe-area-inset-top,20px))]'), 'hotfix 19: the summary opens below the chat header, like every other overlay');
    R.ok(sheetEl.classList.contains('rounded-t-3xl') && sheetEl.classList.contains('flex') && sheetEl.classList.contains('flex-col'), 'hotfix 19: it wears the overlay chrome \u2014 rounded top, handle, column');
    R.ok(!!d.getElementById('btn-close-arch-sub') && !!d.getElementById('ca-arch-sub-title') && !!d.getElementById('ca-arch-sub-subtitle'), 'hotfix 19: the grab-handle sheet carries a title row and its own close button');
    R.eq(bodyEl.scrollTop, 0, 'opens at the top, never auto-scrolled to the bottom');
    // the X deletes immediately (undo toast) without opening the sheet
    d.querySelector('[data-ca-arch-sub-close]').click();
    await wait(400);
    d.querySelector('.ca-arch-row .ca-arch-del').click();
    await wait(100);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'X deletes the entry straight away');
    R.ok(/Deleted/.test(d.getElementById('ca-arch-toast').textContent), 'undo toast confirms the delete');
    R.ok(d.getElementById('ca-arch-sub').classList.contains('hidden'), 'X does not open the summary sheet');
  }

  // v1.24.0 earnings page: segmented summary, 12-month chart with projection,
  // insight cards, badges/YoY in the month list, search-scoped delete.
  // Anchored to a Sep 2026 run date (current real month partial, 24 of 30 days).
  {
    // The whole block runs on a frozen mid-September clock so its figures hold
    // on any real run date (v1.33.0: the harness now supports a fixed clock).
    const ARCH_NOW = '2026-09-20T12:00:00+08:00';
    const { w, d } = await boot(APP, { now: ARCH_NOW });
    const seedEntry = (id, sectorDate, st, amount, ty) => ({ id: id, savedAt: sectorDate + 'T20:00:00Z', monthKey: sectorDate.slice(0, 7), sectorDate: sectorDate, stationDisplay: st, amount: amount, flightType: ty });
    // 19 entries, Aug 2025 → Sep 2026; Nov 2025 empty (chart stub); best Mar 2026
    // $1,000, low Apr 2026 $200, busiest Jul 2026, Aug 2026 YoY +100%, longest
    // break Oct→Dec 2025, top single SYD $900, Jul 20–22 flight streak.
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      seedEntry('A1', '2025-08-15', 'NRT', 400, 'Layover'),
      seedEntry('A2', '2025-09-05', 'KTM', 360.72, 'Layover'),
      seedEntry('A3', '2025-09-18', 'HKT', 339.28, 'Turnaround'),
      seedEntry('A4', '2025-10-10', 'PEN', 300, 'Turnaround'),
      seedEntry('A6', '2025-12-20', 'SYD', 900, 'Layover'),
      seedEntry('A7', '2026-01-09', 'HKT', 400, 'Turnaround'),
      seedEntry('A8', '2026-02-12', 'KTM', 350, 'Layover'),
      seedEntry('A9', '2026-03-14', 'KTM', 400, 'Layover'),
      seedEntry('A10', '2026-03-20', 'TPE', 600, 'Layover'),
      seedEntry('A11', '2026-04-05', 'PEN', 200, 'Turnaround'),
      seedEntry('A12', '2026-05-08', 'HKT', 600, 'Turnaround'),
      seedEntry('A13', '2026-06-15', 'KTM', 450, 'Layover'),
      seedEntry('A14', '2026-07-20', 'KTM', 274.41, 'Layover'),
      seedEntry('A15', '2026-07-21', 'HKT', 300, 'Turnaround'),
      seedEntry('A16', '2026-07-22', 'PEN', 248.82, 'Turnaround'),
      seedEntry('A17', '2026-08-08', 'TPE', 500, 'Layover'),
      seedEntry('A18', '2026-08-25', 'NRT', 300, 'Turnaround'),
      seedEntry('A19', '2026-09-10', 'KTM', 300, 'Layover'),
      seedEntry('A20', '2026-09-30', 'HKT', 200, 'Turnaround')
    ]));
    w.showArchiveOverlay();
    await wait(150);

    // Date anchor: the seed and expected figures below assume the run happens
    // inside a late September 2026 (same anchor the whole suite shares).
    const now = new Date(ARCH_NOW);
    const ymdNow = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    R.ok(ymdNow.slice(0, 7) === '2026-09', 'the frozen clock anchors the block to Sep 2026');
    R.ok(now.getDate() < 30, 'A20 (Sep 30) must still be un-flown');
    const fm = (n) => { const x = Number(n); const s = x < 0 ? '-' : ''; const p = Math.abs(x).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return s + '$' + p[0] + '.' + p[1]; };
    // v1.29.2 schedule model: A19 ($300, Sep 10) flown, A20 ($200, Sep 30)
    // still to be flown — Sep is in progress with a KNOWN $500 month.
    const sepFlown = 300;
    const projTotal = 500;          // the month's known schedule total
    const projLeft = 200;           // the un-flown remainder
    const projFlights = 2;          // the month's saved flight count
    const barPx = Math.round(120 * sepFlown / 1000);   // solid = flown only
    const fullPx = Math.round(120 * projTotal / 1000);
    const projPx = Math.max(0, Math.min(fullPx - barPx, 120 - barPx));

    // -- sheet chrome: handle, header icon buttons, segmented control
    R.ok(d.querySelector('#ca-arch-sheet .w-\\[44px\\].h-\\[4px\\]'), 'iOS-style sheet handle pill');
    R.ok(d.querySelector('#ca-arch-sheet > div.max-w-xl.mx-auto.w-full.flex.items-center.justify-between'), 'v1.36.1: the earnings header joins the centered reading column (owner tier ruling)');
    R.ok(d.querySelector('#ca-arch-scroll.max-w-xl.mx-auto.w-full'), 'v1.36.1: the earnings content scrolls inside the reading column, so flight taps open a same-width summary');
    R.eq(d.querySelectorAll('.ca-arch-iconbtn').length, 3, 'three header icon buttons (v1.41.0: export, trash, close — the import arrow moved to Settings → Restore backup)');
    R.eq(d.querySelectorAll('#ca-arch-summary .ca-arch-seg[data-scope]').length, 3, 'three segmented scope buttons');
    R.eq(d.querySelectorAll('#ca-arch-summary .ca-arch-seg[data-mode]').length, 2, 'v1.45.11: two view pills - COP Allowance / Monthly Salary');
    const segOf = (scope) => d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="' + scope + '"]');
    R.ok(['month', 'year', 'all'].every((s) => !!segOf(s)), 'segmented buttons: month / year / all');
    R.ok(segOf('month').classList.contains('ca-arch-segon') && !segOf('all').classList.contains('ca-arch-segon'), 'v1.45.13: Month is the default scope');
    R.ok(d.querySelector('.ca-arch-seg[data-mode="cop"]').classList.contains('ca-arch-segon'), 'v1.45.13: COP Allowance is the default lens');
    R.ok(!d.getElementById('ca-arch-coprow') && !d.querySelector('.ca-arch-copseg'), 'v1.45.13: the IFA/LMA counting row is gone');
    R.ok(fs.readFileSync(APP, 'utf8').indexOf('crewAssist.archMode') === -1 && fs.readFileSync(APP, 'utf8').indexOf('crewAssist.archCopMode') === -1, 'v1.45.13: the lens no longer persists (no archMode / archCopMode keys)');
    segOf('all').click();
    await wait(50);

    // -- all-time gold card: $7,423.23 across 19 flights
    R.eq(d.getElementById('ca-arch-total').textContent, '$7,423.23', 'all-time total');
    R.eq(d.getElementById('ca-arch-m-flights').textContent, '19', 'all-time flight count');
    R.eq(d.getElementById('ca-arch-m-avg').textContent, '$390.70', 'all-time average per flight');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Annual avg', 'v1.45.18: COP + ALL-TIME carries the ANNUAL AVG career column (the Context line is unmounted)');
    const ctxAll = d.getElementById('ca-arch-m-ctx');
    const avgAll = w.eval("formatMoney(archCopTotal(JSON.parse(localStorage.getItem('crewAssist.archive') || '[]')) / 2)");
    R.eq(ctxAll.textContent, avgAll, 'the annual average = career COP over the two years on record (' + avgAll + ')');
    R.ok(ctxAll.innerHTML.indexOf('<span') === -1 && ctxAll.innerHTML.indexOf('vs LY') === -1, 'v1.45.18: no truncating context parts, and the value rides bare text - the ctx ellipsis rule can never clip it');

    // -- 12-month chart: oldest left, stub month, projection segment, peak
    // (v1.45.11: the 12-month window is the Month-scope shape; All-time
    // draws the year-by-year comparison now)
    segOf('month').click();
    await wait(50);
    const cols = d.querySelectorAll('#ca-arch-chart .ca-arch-barcol');
    R.eq(cols.length, 12, 'twelve chart columns');
    R.eq(cols[0].getAttribute('data-mk'), '2025-10', 'oldest column is 12 months back');
    R.eq(cols[11].getAttribute('data-mk'), '2026-09', 'newest column is the current month');
    R.eq(d.getElementById('ca-arch-peak').textContent, 'Peak: $1.0k', 'peak label above the chart');
    R.eq(d.querySelector('.ca-arch-barcol[data-mk="2025-11"] .ca-arch-bar').style.height, '2px', 'empty month renders a 2px stub');
    R.eq(d.querySelector('.ca-arch-barcol[data-mk="2026-03"] .ca-arch-bar').style.height, '120px', 'highest month fills the 120px track');
    const projBars = d.querySelectorAll('#ca-arch-chart .ca-arch-barproj');
    R.eq(projBars.length, 1, 'exactly one projection segment');
    R.ok(projBars[0].closest('.ca-arch-barcol').getAttribute('data-mk') === '2026-09' && projBars[0].style.height === projPx + 'px', 'projection stacks on the partial month (' + barPx + 'px of ' + fullPx + 'px)');
    R.ok(d.querySelector('.ca-arch-barcol[data-mk="2026-09"] .ca-arch-bartip').textContent.indexOf('\u2192 ' + fm(projTotal)) !== -1, 'column tooltip projects the month end');
    // tapping a bar selects it and expands that month in the list
    d.querySelector('.ca-arch-barcol[data-mk="2026-05"]').click();
    await wait(50);
    const onCols = d.querySelectorAll('#ca-arch-chart .ca-arch-barcol.ca-arch-baron');
    R.eq(onCols.length, 1, 'one selected column after a tap');
    R.ok(onCols[0].getAttribute('data-mk') === '2026-05', 'the tapped column is selected');
    // back to All-time for the whole-archive list (the list follows the
    // pill now; the May tap's expansion sticks)
    segOf('all').click();
    await wait(50);
    const grp = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]').closest('.ca-arch-group');
    R.ok(grp('2026-05') && !grp('2026-05').classList.contains('ca-arch-collapsed'), 'tapping a bar expands that month group');
    R.ok(grp('2026-04').classList.contains('ca-arch-collapsed'), 'other months stay collapsed');

    // -- month list: groups, badges, YoY arrow, projected row, footer
    R.eq(d.querySelectorAll('.ca-arch-group').length, 13, 'one group per month on record');
    R.eq(d.querySelector('.ca-arch-group-head').getAttribute('data-mk'), '2026-09', 'newest month leads the list');
    R.eq(d.querySelectorAll('.ca-arch-group-head .ca-arch-chev').length, 13, 'every group head carries a chevron');
    const headOf = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    R.ok(headOf('2026-03').querySelector('.ca-arch-badge-best') && headOf('2026-03').textContent.indexOf('Best') !== -1, 'Best badge on the top month');
    R.ok(headOf('2026-04').querySelector('.ca-arch-badge-low') && headOf('2026-04').textContent.indexOf('Low') !== -1, 'Low badge on the weakest month');
    R.ok(headOf('2026-09').textContent.indexOf('In progress') !== -1, 'In progress status on the current month (v1.45.16: the word rides the count line, the state rides the icon)');
    const up = d.querySelectorAll('.ca-arch-yoy-up'), down = d.querySelectorAll('.ca-arch-yoy-down');
    R.eq(up.length, 1, 'one YoY arrow in the list');
    R.ok(up[0].closest('.ca-arch-group-head').getAttribute('data-mk') === '2026-08' && up[0].textContent.indexOf('100.0%') !== -1, 'Aug 2026 up 100.0% vs Aug 2025');
    R.eq(down.length, 0, 'no down arrows in this seed');
    const sepBody = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    // v1.38.0 (A1): the projection is a tap-to-reveal panel under the month total
    const sepToggle = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn');
    const sepWrap = sepBody.querySelector('.ca-arch-proj-wrap');
    R.ok(!!sepToggle && !!sepWrap && !sepWrap.classList.contains('open') && sepToggle.getAttribute('aria-expanded') === 'false', 'v1.38.0: an in-progress month carries a closed still-to-fly toggle on its total');
    sepToggle.click();
    R.ok(sepWrap.classList.contains('open') && sepWrap.textContent.indexOf('Remaining flights') !== -1 && sepWrap.textContent.indexOf(fm(projLeft)) !== -1 && sepWrap.textContent.indexOf('1 flight completed \u00b7 1 left') !== -1, 'v1.38.0/18: tapping the month total unfolds the remaining-flights panel');
    R.eq(sepToggle.getAttribute('aria-expanded'), 'true', 'the toggle announces its open state');
    sepToggle.click();
    R.ok(!sepWrap.classList.contains('open') && sepToggle.getAttribute('aria-expanded') === 'false', 'a second tap folds the projection away');
    const listTxt = d.getElementById('ca-arch-list').textContent;
    R.ok(listTxt.indexOf('End of records') !== -1 && listTxt.indexOf('Showing earnings since Aug 2025') !== -1, 'footer marks the end of records');
    R.eq(d.querySelectorAll('.ca-arch-row').length, 19, 'every entry renders a row');

    // -- insights: toggle flips, twelve cards, exact figures
    const toggle = d.getElementById('ca-arch-ins-toggle');
    R.ok(!d.getElementById('ca-arch-insights').classList.contains('ca-arch-insopen'), 'insights collapsed by default');
    toggle.click();
    await wait(50);
    R.ok(d.getElementById('ca-arch-insights').classList.contains('ca-arch-insopen'), 'toggle expands the insights');
    R.eq(d.getElementById('ca-arch-ins-toggle-label').textContent, 'Hide insights', 'toggle label flips to Hide');
    R.eq(toggle.getAttribute('aria-expanded'), 'true', 'aria-expanded follows the toggle');
    R.ok(toggle.classList.contains('ca-arch-insopen'), 'open state styled on the toggle');
    R.eq(d.querySelectorAll('.ca-arch-inscard').length, 12, 'exactly twelve insight cards');
    const card = (label) => {
      const lab = Array.from(d.querySelectorAll('.ca-arch-inslabel')).find((el) => el.textContent === label);
      return lab ? lab.closest('.ca-arch-inscard').textContent : '';
    };
    R.ok(card('Top earning month').indexOf('Mar 2026') !== -1 && card('Top earning month').indexOf('$1,000.00') !== -1, 'top earning month card');
    R.ok(card('Lowest earning month').indexOf('Apr 2026') !== -1 && card('Lowest earning month').indexOf('$200.00') !== -1, 'lowest earning month card');
    R.ok(card('Monthly average').indexOf('$576.94') !== -1 && card('Monthly average').indexOf('across 12 months') !== -1, 'monthly average over complete months only');
    R.ok(card('Busiest month').indexOf('Jul 2026') !== -1 && card('Busiest month').indexOf('3 flights') !== -1, 'busiest month card');
    R.ok(card('Current streak').indexOf('2 months') !== -1 && card('Current streak').indexOf('above $576.94') !== -1, 'streak counts months above average');
    R.ok(card('Longest flight streak').indexOf('3 days') !== -1 && card('Longest flight streak').indexOf('since 20 Jul') !== -1, 'longest back-to-back flying days');
    R.ok(card('Longest break').indexOf('70 days off') !== -1 && card('Longest break').indexOf('11 Oct\u201319 Dec') !== -1, 'longest break between flying days');
    R.ok(card('Highest single flight').indexOf('$900.00') !== -1 && card('Highest single flight').indexOf('SYD 20 Dec') !== -1, 'highest single flight card');
    R.ok(card('Per flying day').indexOf('$390.70') !== -1 && card('Per flying day').indexOf('across 19 flying days') !== -1, 'earnings per flying day');
    R.ok(card('Nights away YTD').indexOf('7') !== -1 && card('Nights away YTD').indexOf('avg 0.8 / month') !== -1, 'nights away this year');
    R.ok(card('Flying days this year').indexOf('14 / 365') !== -1 && card('Flying days this year').indexOf('96% of days off') !== -1, 'flying days this year');
    R.ok(card('Busiest weekday').indexOf('Fridays') !== -1 && card('Busiest weekday').indexOf('16% of all flights') !== -1, 'busiest weekday card');
    const insTxt = d.getElementById('ca-arch-insights').textContent;
    R.ok(!/annual goal|long-haul|longhaul/i.test(insTxt), 'no annual-goal or long-haul leftovers from the old design');
    // v1.31.0: curation — the top four lead, the rest unfold on demand
    R.ok(d.querySelector('#ca-arch-insights .ca-arch-inscard .ca-arch-inslabel').textContent === 'Top earning month', 'all-time scope leads with the top month');
    const moreWrap = d.querySelector('#ca-arch-insights .ca-arch-insmore');
    R.ok(moreWrap && moreWrap.classList.contains('ca-arch-insmore-hide') && moreWrap.querySelectorAll('.ca-arch-inscard').length === 8, 'the remaining eight start folded');
    R.eq(d.getElementById('ca-arch-ins-mtoggle-label').textContent, 'Show all 12', 'the disclosure invites the rest');
    d.getElementById('ca-arch-ins-mtoggle').click();
    await wait(60);
    R.ok(!d.querySelector('#ca-arch-insights .ca-arch-insmore').classList.contains('ca-arch-insmore-hide'), 'all twelve unfold');
    R.eq(d.getElementById('ca-arch-ins-mtoggle-label').textContent, 'Show less', 'the disclosure flips to Show less');
    segOf('month').click();
    await wait(80);
    R.ok(d.querySelector('#ca-arch-insights .ca-arch-inscard .ca-arch-inslabel').textContent === 'Current streak', 'month scope re-curates: the streak leads');
    segOf('all').click();
    await wait(80);
    R.ok(d.querySelector('#ca-arch-insights .ca-arch-inscard .ca-arch-inslabel').textContent === 'Top earning month', 'all-time leads with the records again');
    toggle.click();
    await wait(50);
    R.ok(!d.getElementById('ca-arch-insights').classList.contains('ca-arch-insopen') && d.getElementById('ca-arch-ins-toggle-label').textContent === 'View insights', 'toggle collapses the insights again');

    // -- segmented switching: month / year / all-time figures
    segOf('month').click();
    await wait(50);
    R.ok(segOf('month').classList.contains('ca-arch-segon') && !segOf('all').classList.contains('ca-arch-segon'), 'active segment follows the tap');
    R.eq(d.getElementById('ca-arch-total').textContent, '$500.00', 'month scope totals the current month');
    R.eq(d.getElementById('ca-arch-m-flights').textContent, '2', 'month scope flight count');
    R.eq(d.getElementById('ca-arch-m-avg').textContent, '$250.00', 'month scope average');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Remaining to earn', 'v1.45.17: the milestone label reads Remaining to earn (uppercased by the metalabel class)');
    const ctxM = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxM.textContent.indexOf(fm(projLeft) + ' before end of month') !== -1 && ctxM.textContent.indexOf('On track for') === -1, 'v1.45.17: the milestone line carries the remainder before end of month, old layout gone');
    R.ok(ctxM.innerHTML.indexOf('target') !== -1, 'on-track context uses the target icon');
    R.eq(d.querySelectorAll('.ca-arch-group').length, 1, 'v1.45.11: the list follows the scope - month shows the selected month');
    R.eq(d.querySelectorAll('.ca-arch-row').length, 2, 'v1.45.11: month scope lists just the selected month\u2019s rows (Sep = 2)');
    segOf('year').click();
    await wait(50);
    R.eq(d.getElementById('ca-arch-total').textContent, '$5,123.23', 'year scope totals 2026');
    R.eq(d.getElementById('ca-arch-m-flights').textContent, '14', 'year scope flight count');
    R.eq(d.getElementById('ca-arch-m-avg').textContent, '$365.94', 'year scope average');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, '2026 YTD', 'year context label');
    const ctxY = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxY.textContent.indexOf('+122.7% vs LY') !== -1, 'year YoY vs the whole of 2025');
    R.ok(ctxY.innerHTML.indexOf('trending-up') !== -1, 'year context uses the up icon');
    d.getElementById('ca-arch-seg-year').click();
    await wait(50);
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, '2025', 'second tap cycles to the earliest year');
    R.eq(d.getElementById('ca-arch-m-ctx').textContent, '—', 'v1.45.21: no prior year on record - the clean quiet em dash, never a text placeholder');
    R.ok(d.getElementById('ca-arch-m-ctx').innerHTML.indexOf('not on record') === -1, 'the old placeholder string is gone from the card');
    segOf('all').click();
    await wait(50);
    R.eq(d.getElementById('ca-arch-total').textContent, '$7,423.23', 'all-time scope restores the full total');

    // -- search narrows the list only; trash deletes what search leaves visible
    const search = d.getElementById('ca-arch-search');
    search.value = 'KTM';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(d.querySelectorAll('.ca-arch-group').length, 6, 'search narrows the list to months with a match');
    R.eq(d.querySelectorAll('.ca-arch-row').length, 6, 'only matching rows render');
    R.ok(Array.from(d.querySelectorAll('.ca-arch-row')).every((r) => r.textContent.indexOf('KTM') !== -1), 'every visible row matches the search');
    R.eq(d.getElementById('ca-arch-total').textContent, '$7,423.23', 'search never narrows the summary');
    R.ok(headOf('2025-09').closest('.ca-arch-group').textContent.indexOf('$360.72') !== -1 && headOf('2025-09').closest('.ca-arch-group').textContent.indexOf('of $700.00') !== -1, 'filtered month shows its share of the full month (v1.38.0: the amount sits beside the header, not inside it)');
    R.ok(d.getElementById('ca-arch-list').textContent.indexOf('End of records') !== -1, 'footer stays while entries exist');
    R.ok(!d.getElementById('ca-arch-clear').classList.contains('opacity-0'), 'clear button fades in with text in the search');
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete 6 shown entries') !== -1, 'trash counts only the search-visible entries');
    d.getElementById('app-dialog-ok').click();
    await wait(100);
    const after = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.eq(after.length, 13, 'delete removes exactly the six KTM entries');
    R.ok(after.every((e) => e.stationDisplay !== 'KTM'), 'no KTM entries remain');
    R.ok(d.getElementById('ca-arch-toast').textContent.indexOf('Deleted 6 entries') !== -1, 'toast confirms the scoped delete');
  }

  // --- v1.45.9 (owner order): the search reads each flight's frozen summary ---
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([
        { id: 'pax1', savedAt: '2026-02-13T10:00:00Z', monthKey: '2026-02', sectorDate: '2026-02-13', stationDisplay: 'SIN/CHC/SIN', flightType: 'Layover', amount: 561.76,
          detail: { type: 'Layover', grandTotal: 561.76, rankRate: 28.5, stations: [], sectors: [
            { fn: '295', dep: 'SIN', arr: 'CHC', std: '0906', sta: '2340', ftHm: '9H 34M', depYmd: '2026-02-11' },
            { fn: '298', dep: 'CHC', arr: 'SIN', std: '1200', sta: '1735', ftHm: '', paxing: true, depYmd: '2026-02-13' }
          ] } },
        { id: 'old1', savedAt: '2026-02-02T10:00:00Z', monthKey: '2026-02', sectorDate: '2026-02-02', stationDisplay: 'SIN/KTM', flightType: 'Turnaround', amount: 210.5 },
        { id: 'ktm1', savedAt: '2026-10-18T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-18', stationDisplay: 'SIN/KTM/SIN', flightType: 'Turnaround', amount: 320.4,
          detail: { type: 'Turnaround', grandTotal: 320.4, rankRate: 28.5, stations: [], sectors: [
            { fn: '442', dep: 'SIN', arr: 'KTM', std: '0900', sta: '1155', ftHm: '4H 55M', depYmd: '2026-10-18' },
            { fn: '441', dep: 'KTM', arr: 'SIN', std: '1300', sta: '1830', ftHm: '4H 30M', depYmd: '2026-10-18' }
          ] } }
      ]));
    } });
    w.showArchiveOverlay();
    d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(50);
    await wait(200);
    const type = async (q) => {
      const s = d.getElementById('ca-arch-search');
      s.value = q; s.dispatchEvent(new w.Event('input', { bubbles: true }));
      await wait(60);
      return Array.from(d.querySelectorAll('.ca-arch-row'));
    };
    let rows = await type('paxing');
    R.eq(rows.length, 1, '"paxing" finds the flight whose summary carries the paxing note');
    R.ok(rows[0] && rows[0].textContent.indexOf('561.76') >= 0, 'and it is the CHC layover entry');
    rows = await type('298');
    R.eq(rows.length, 1, 'the partner flight number SQ 298 — a word only the summary knows — finds its entry');
    rows = await type('1200');
    R.eq(rows.length, 1, 'a printed STD from the summary finds its entry');
    rows = await type('kathmandu');
    R.eq(rows.length, 1, 'a full city name from the overview sentence finds its entry');
    R.ok(rows[0] && rows[0].textContent.indexOf('320.40') >= 0, 'and it is the entry WITH a summary — the old bare KTM one stays out');
    rows = await type('KTM');
    R.eq(rows.length, 2, 'route matching is unchanged: both KTM entries answer to "KTM"');
    rows = await type('CHC');
    R.eq(rows.length, 1, 'the CHC entry still answers to its route');
    rows = await type('');
    R.eq(rows.length, 3, 'clearing the search restores all three');
  }

    // --- v1.27.0 backup nudge ---
  {
    // v1.39.0 hotfix 9: the seeds ride the run date (convention #5) — a
    // fixed savedAt crossed the rolling 30-day backup window and failed the
    // suite a day later. A is always an older month (40 days back), B always
    // a newer one (3 days back) — two distinct months in every calendar
    // position, and B is always "new" versus a 30-day-old backup.
    const ago = (days) => {
      const t = new Date(Date.now() - days * 86400000);
      const key = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
      return { iso: t.toISOString(), key: key };
    };
    const A = ago(40), B = ago(3);
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'A', savedAt: A.iso, monthKey: A.key, sectorDate: A.key + '-02', stationDisplay: 'SIN/ICN', amount: 100 },
      { id: 'B', savedAt: B.iso, monthKey: B.key, sectorDate: B.key + '-05', stationDisplay: 'SIN/HND', amount: 200 }
    ]));
    w.showArchiveOverlay();
    let card = d.getElementById('ca-arch-backup-nudge');
    R.ok(card, 'never backed up + 2 months of entries → nudge card');
    R.ok(card && card.textContent.indexOf('only on this phone') >= 0, 'never-backed-up copy');
    R.ok(!!d.getElementById('ca-arch-nudge-export') && !!d.getElementById('ca-arch-nudge-snooze'), 'nudge carries Export + snooze buttons');
    // snooze: the card animates away and the snooze is stamped
    d.getElementById('ca-arch-nudge-snooze').click();
    await wait(60);
    card = d.getElementById('ca-arch-backup-nudge');
    R.ok(card && card.style.opacity === '0', 'snooze fades the card out (no instant pop)');
    await wait(420);
    R.ok(!d.getElementById('ca-arch-backup-nudge'), 'card gone after the collapse animation');
    R.ok(Number(w.localStorage.getItem('crewAssist.backupNudgeSnoozedAt')) > 0, 'snooze stamped');
    // fresh backup (2 days old) with newer entries → no card
    w.localStorage.setItem('crewAssist.lastBackupAt', String(Date.now() - 2 * 86400000));
    w.localStorage.removeItem('crewAssist.backupNudgeSnoozedAt');
    w.eval('renderArch()');
    R.ok(!d.getElementById('ca-arch-backup-nudge'), 'backup 2 days old → no nudge despite new entries');
    // stale backup (30 days) + entry saved after it → card with the month count
    w.localStorage.setItem('crewAssist.lastBackupAt', String(Date.now() - 30 * 86400000));
    w.eval('renderArch()');
    card = d.getElementById('ca-arch-backup-nudge');
    R.ok(card, 'backup 30 days old + new month → nudge card');
    R.ok(card && card.textContent.indexOf('1 month of new entries since your last backup') >= 0, 'stale-backup copy counts the new months');
    // v1.41.0: the earnings JSON is an EXTRACT now — it does NOT stamp the
    // backup clock. Only the full backup (Settings → Data Management) does.
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
    w.eval("archDoExport('json')");
    R.ok(Number(w.localStorage.getItem('crewAssist.lastBackupAt')) < Date.now() - 20 * 86400000, 'an earnings extract does not stamp lastBackupAt');
    w.eval('renderArch()');
    R.ok(!!d.getElementById('ca-arch-backup-nudge'), 'an extract does not silence the backup nudge');
    w.eval('exportFullBackup()');
    R.ok(Number(w.localStorage.getItem('crewAssist.lastBackupAt')) > Date.now() - 60000, 'the full backup stamps lastBackupAt');
    w.eval('renderArch()');
    R.ok(!d.getElementById('ca-arch-backup-nudge'), 'fresh full backup → no nudge');
  }
  {
    // single month + never backed up → stays quiet
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'A', savedAt: '2026-09-05T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', stationDisplay: 'SIN/HND', amount: 200 }
    ]));
    w.showArchiveOverlay();
    R.ok(!d.getElementById('ca-arch-backup-nudge'), 'one month + never backed up → no nudge yet');
  }

  // --- v1.41.0: the one-shot backup + the one restore door ---
  {
    const seed = (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Backup Bo', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01' }));
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 'bk1', savedAt: '2026-10-01T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-01', stationDisplay: 'SIN/KUL', amount: 100 }]));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [{ ymd: '2026-10-07', kind: 'F' }] }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [{ fn: 'SQ106' }] }));
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-10': [{ fn: '106', ymd: '2026-10-20', std: '0900' }] }));
      x.localStorage.setItem('crewAssist.devMode', 'true');
    };
    const { w, d } = await boot(APP, { seed });
    // build: the manifest counts what matters and carries the crown jewels
    const p = JSON.parse(w.eval('JSON.stringify(buildFullBackup())'));
    R.eq(p.v, 1, 'backup manifest v1');
    R.eq(p.app, 'CrewAssist', 'backup manifest names the app');
    R.eq(p.counts.earnings, 1, 'backup counts the earnings entries');
    R.eq(p.counts.dutyMonths, 1, 'backup counts the duty months');
    R.ok(p.data['crewAssist.profile'] && p.data['crewAssist.profile'].name === 'Backup Bo', 'backup carries the profile');
    R.ok(!('crewAssist.devMode' in p.data), 'device flags stay out of the backup');
    R.ok(!('crewAssist.installHintDone' in p.data), 'one-time flags stay out of the backup');
    // round-trip: wipe the data keys, apply, everything returns
    w.eval("['crewAssist.profile','crewAssist.archive','crewAssist.dutyDays','crewAssist.allFlights','crewAssist.upcoming'].forEach((k) => localStorage.removeItem(k))");
    R.ok(!w.localStorage.getItem('crewAssist.dutyDays'), 'duty days gone before the restore');
    w.eval('applyFullBackupData(' + JSON.stringify(p.data) + ')');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'restore returns the earnings');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'))['2026-10'].length, 1, 'restore returns the duty days — the calendar survives a reset, no PDF re-upload');
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.profile')).name === 'Backup Bo', 'restore returns the profile');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.upcoming'))['2026-10'].length, 1, 'restore returns upcoming flights');
    // replace semantics: a key not in the backup is cleared
    w.eval("localStorage.setItem('crewAssist.manualCards', '[{\"x\":1}]'); applyFullBackupData(" + JSON.stringify(p.data) + ')');
    R.ok(!w.localStorage.getItem('crewAssist.manualCards'), 'restore replaces — a key not in the backup is cleared');
    // the door detects a legacy earnings file and merges through a confirm
    const legacy = JSON.stringify(JSON.stringify([{ id: 'x1', savedAt: '2026-10-02T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-02', stationDisplay: 'SIN/HKT', amount: 55 }]));
    w.eval('backupRestoreRead("e.json", ' + legacy + ')');
    await wait(80);
    R.ok(!d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'an earnings file opens the confirm door');
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('1 readable') !== -1, 'the earnings preview counts readables');
    d.getElementById('app-dialog-ok').click();
    await wait(120);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'legacy earnings files still import through the door');
    // the same file again → the honest nothing-new alert, archive untouched
    w.eval('backupRestoreRead("e.json", ' + legacy + ')');
    await wait(80);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('already on this device') !== -1, 'a fully-duplicate file gets the honest nothing-new alert');
    d.getElementById('app-dialog-ok').click();
    await wait(80);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'a fully-duplicate import adds nothing');
    // a rates file through the door
    w.eval('backupRestoreRead("r.json", ' + JSON.stringify(JSON.stringify({ version: 1, ifa: { sgBuffer: 5 } })) + ')');
    await wait(80);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Rates file') !== -1, 'a rates file opens the rates confirm');
    d.getElementById('app-dialog-ok').click();
    await wait(120);
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.rates')).ifa.sgBuffer === 5, 'a rates file applies through the door');
    // a full backup previews its counts and profile; cancel is safe
    w.eval('backupRestoreRead("b.json", ' + JSON.stringify(JSON.stringify(p)) + ')');
    await wait(80);
    const msg = d.getElementById('app-dialog-msg').textContent;
    R.ok(msg.indexOf('1 earnings entries') !== -1 && msg.indexOf('Backup Bo') !== -1, 'a full backup previews counts + profile');
    d.getElementById('app-dialog-cancel').click();
    await wait(80);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'cancel leaves the device untouched');
    R.ok(!w.localStorage.getItem('crewAssist.tourDone'), 'the Settings door leaves the tour flag alone');
    // the v1.42.0 welcome-screen door: partial exports redirect, full backups land
    w.eval('backupRestoreRead("e.json", ' + legacy + ', { fromOnboarding: true })');
    await wait(80);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('earnings export') !== -1, 'the welcome door refuses an earnings export with directions');
    d.getElementById('app-dialog-ok').click();
    await wait(80);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'the welcome-door refusal imports nothing');
    w.eval('backupRestoreRead("r.json", ' + JSON.stringify(JSON.stringify({ version: 1, ifa: { sgBuffer: 9 } })) + ', { fromOnboarding: true })');
    await wait(80);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('rates export') !== -1, 'the welcome door refuses a rates export with directions');
    d.getElementById('app-dialog-ok').click();
    await wait(80);
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.rates')).ifa.sgBuffer === 5, 'the welcome-door rates refusal changes nothing');
    w.eval('backupRestoreRead("b.json", ' + JSON.stringify(JSON.stringify(p)) + ', { fromOnboarding: true })');
    await wait(80);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('1 earnings entries') !== -1, 'the welcome door previews the full backup');
    d.getElementById('app-dialog-ok').click();
    await wait(120);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'the welcome door applies the full backup wholesale');
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.profile')).name === 'Backup Bo', 'the profile comes home through the welcome door');
    R.eq(w.localStorage.getItem('crewAssist.tourDone'), '1', 'hotfix: the welcome door retires the tour — a restoring user is not a new user');
    // the earnings header: the import arrow is gone, the export stays
    w.showArchiveOverlay();
    await wait(100);
    R.ok(!d.getElementById('ca-arch-import'), 'the earnings header import arrow is gone (v1.41.0)');
    R.ok(!!d.getElementById('ca-arch-export'), 'the earnings header keeps its export');
  }

  // --- v1.27.1: insights must react to the FIRST tap (regression: a leftover
  // `hidden` toggle in renderArchInsights kept the panel display:none until
  // some unrelated re-render ran) ---
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'A', savedAt: '2026-09-05T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', stationDisplay: 'SIN/HND', amount: 200 }
    ]));
    w.showArchiveOverlay();
    d.getElementById('ca-arch-ins-toggle').click();
    const ins = d.getElementById('ca-arch-insights');
    R.ok(ins.classList.contains('ca-arch-insopen'), 'first tap expands the insights');
    R.ok(!ins.classList.contains('hidden'), 'first tap leaves no display:none behind (the v1.27.0 regression)');
    R.ok(d.getElementById('ca-arch-ins-toggle-label').textContent === 'Hide insights', 'label flips on the first tap');
    // a re-render while open (search typing) must keep it open
    const si = d.getElementById('ca-arch-search');
    si.value = 'HND'; si.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(60);
    R.ok(ins.classList.contains('ca-arch-insopen') && !ins.classList.contains('hidden'), 're-render while open keeps the insights expanded');
    // close + reopen resets the toggle completely (stale-label regression)
    w.closeArchOverlay();
    await wait(400);
    w.showArchiveOverlay();
    const ins2 = d.getElementById('ca-arch-insights');
    R.ok(!ins2.classList.contains('ca-arch-insopen'), 'reopen collapses the insights');
    R.ok(d.getElementById('ca-arch-ins-toggle-label').textContent === 'View insights', 'reopen resets the toggle label');
    R.ok(d.getElementById('ca-arch-ins-toggle').getAttribute('aria-expanded') === 'false', 'reopen resets aria-expanded');
    R.ok(!d.getElementById('ca-arch-ins-toggle').classList.contains('ca-arch-insopen'), 'reopen resets the chevron');
  }

  // --- v1.28.1: re-saving an already-saved trip updates it, never duplicates ---
  {
    const { w, d } = await boot(APP);
    const base = { id: 'a1', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 100 };
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([base]));
    // helper: same signature (month+date+type+stations) with a new amount → replace
    const again = { id: 'a2', savedAt: '2026-09-20T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 250 };
    const res1 = w.eval('persistArchiveSaving(' + JSON.stringify([again]) + ')');
    let arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr.length === 1 && arr[0].amount === 250 && arr[0].id === 'a2', 'same trip saved again replaces the entry');
    R.ok(res1.updated === 1 && res1.fresh === 0, 'save reports the update');
    // a different trip appends
    const other = { id: 'a3', savedAt: '2026-09-21T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-12', flightType: 'Turnaround', stationDisplay: 'ICN', amount: 80 };
    const res2 = w.eval('persistArchiveSaving(' + JSON.stringify([other]) + ')');
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr.length === 2, 'a different trip still appends');
    R.ok(res2.fresh === 1 && res2.updated === 0, 'save reports the new entry');
    // same date + route but different type is a different duty
    const ta = { id: 'a4', savedAt: '2026-09-22T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Turnaround', stationDisplay: 'CDG', amount: 60 };
    w.eval('persistArchiveSaving(' + JSON.stringify([ta]) + ')');
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr.length === 3, 'turnaround vs layover on the same day stay separate');
    // the REAL single-summary save path updates too
    const dup = { id: 'a9', savedAt: new Date().toISOString(), monthKey: '2026-09', sectorDate: '2026-09-12', flightType: 'Turnaround', stationDisplay: 'ICN', amount: 99 };
    w.eval('showResultsOverlay(99, 99, 0, [], [], true, "both", ' + JSON.stringify(dup) + ', null)');
    await wait(60);
    const btn = d.getElementById('btn-results-action');
    R.ok(btn && !btn.disabled, 'results overlay offers save');
    btn.click();
    await wait(60);
    // v1.30.0: the review step — nothing is written until Confirm
    const rev = d.getElementById('ca-save-review');
    R.ok(rev, 'tapping Save opens the review first');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 3, 'nothing is written while the review is open');
    R.ok(rev.textContent.indexOf('Updated') !== -1 && rev.textContent.indexOf('$80.00') !== -1 && rev.textContent.indexOf('$99.00') !== -1, 'the review tags the ICN duty Updated, old amount struck through');
    R.ok(rev.textContent.indexOf('1 updated') !== -1, 'the counts line reads one updated');
    d.getElementById('ca-save-confirm').click();
    await wait(60);
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    const icn = arr.filter((e) => e.stationDisplay === 'ICN');
    R.ok(icn.length === 1 && icn[0].amount === 99, 'saving from the summary updates the existing ICN entry');
    R.ok(btn.dataset.done === '1', 'save is one-shot per summary');
    R.ok(!d.getElementById('ca-arch-toast').classList.contains('hidden') && d.getElementById('ca-arch-toast').textContent.indexOf('updated') !== -1, 'the save confirms with a quiet toast');
    R.ok(d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'no pop-up after a confirmed save');
    void d;
  }

  // --- v1.30.0: the save review — New / Updated / No change before writing ---
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'G1', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 300 },
      { id: 'G2', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-12', flightType: 'Layover', stationDisplay: 'NRT', amount: 250 }
    ]));
    const payloads = JSON.stringify([
      { id: 'g1', savedAt: '2026-09-25T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 350 },
      { id: 'g2', savedAt: '2026-09-25T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-12', flightType: 'Layover', stationDisplay: 'NRT', amount: 250 },
      { id: 'g3', savedAt: '2026-09-25T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-20', flightType: 'Turnaround', stationDisplay: 'KTM', amount: 120 }
    ]);
    w.eval('showResultsOverlay(720, 720, 0, [], [], true, "both", { id: "z", savedAt: "2026-09-25T10:00:00Z", monthKey: "2026-09", sectorDate: "2026-09-25", flightType: "Layover", stationDisplay: "TPE", amount: 50 }, null)');
    await wait(60);
    w.eval('openSaveReviewPanel(document.getElementById("results-content"), ' + payloads + ', function () { window.__reviewConfirmed = true; })');
    await wait(60);
    const rev = d.getElementById('ca-save-review');
    R.ok(rev, 'the review panel opens above the summary');
    R.ok(rev.textContent.indexOf('1 new \u00b7 1 updated \u00b7 1 no change') !== -1, 'counts line names all three kinds');
    const rows = rev.querySelectorAll('.ca-save-revrow');
    R.eq(rows.length, 3, 'one row per payload');
    R.ok(rows[0].textContent.indexOf('Updated') !== -1 && rows[0].textContent.indexOf('$300.00') !== -1 && rows[0].textContent.indexOf('$350.00') !== -1, 'updated row shows the old and new amounts');
    R.ok(rows[0].querySelector('.line-through'), 'the old amount is struck through');
    R.ok(rows[1].textContent.indexOf('No change') !== -1, 'an identical re-save reads No change');
    R.ok(rows[2].textContent.indexOf('New') !== -1 && rows[2].textContent.indexOf('$120.00') !== -1, 'a fresh duty reads New with its amount');
    R.ok(d.getElementById('btn-results-action').classList.contains('hidden'), 'the header Save steps aside while the review is open');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'nothing is written while the review is open');
    d.getElementById('ca-save-cancel').click();
    await wait(60);
    R.ok(!d.getElementById('ca-save-review'), 'cancel closes the review');
    R.ok(!d.getElementById('btn-results-action').classList.contains('hidden') && !d.getElementById('btn-results-action').disabled, 'cancel re-arms the Save button');
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'cancel files nothing');
    // the re-armed button must still WORK after the review hid it once
    d.getElementById('btn-results-action').click();
    await wait(60);
    R.ok(d.getElementById('ca-save-review'), 'tapping Save after a cancel reopens the review');
    d.getElementById('ca-save-cancel').click();
    await wait(60);
    w.eval('openSaveReviewPanel(document.getElementById("results-content"), ' + payloads + ', function () { window.__reviewConfirmed = true; })');
    await wait(60);
    d.getElementById('ca-save-confirm').click();
    await wait(60);
    R.ok(w.eval('window.__reviewConfirmed') === true, 'confirm runs the save');
    R.ok(!d.getElementById('ca-save-review'), 'confirm closes the review');
    void d;
  }

  // v1.29.0: tap-an-amount-to-correct — in place, with the 6s undo
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'E1', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', flightType: 'Layover', stationDisplay: 'KTM', amount: 100 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    const amtBtn = d.querySelector('.ca-arch-amt[data-amt="E1"]');
    R.ok(amtBtn && amtBtn.textContent === '$100.00', 'amount renders as a tappable button');
    amtBtn.click();
    await wait(50);
    const inp = d.querySelector('.ca-arch-amt-input');
    R.ok(inp && inp.value === '100', 'tap turns the amount into a pre-filled input');
    inp.value = '123.45';
    inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(100);
    let arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr.length === 1 && arr[0].amount === 123.45, 'Enter commits the corrected amount');
    R.ok(d.querySelector('.ca-arch-amt[data-amt="E1"]').textContent === '$123.45', 'the row shows the new figure');
    const toast = d.getElementById('ca-arch-toast');
    R.ok(!toast.classList.contains('hidden') && toast.textContent.indexOf('Amount corrected') !== -1, 'correction toast appears');
    toast.querySelector('button').click();
    await wait(100);
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr[0].amount === 100, 'undo restores the previous figure');
    R.ok(d.querySelector('.ca-arch-amt[data-amt="E1"]').textContent === '$100.00', 'the row shows the restored figure');
    // Escape cancels without touching anything
    d.querySelector('.ca-arch-amt[data-amt="E1"]').click();
    await wait(50);
    const inp2 = d.querySelector('.ca-arch-amt-input');
    inp2.value = '999';
    inp2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(50);
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arr[0].amount === 100, 'Escape cancels the edit');
    void d;
  }

  // v1.29.0: search matches month/date and amount, not just route
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'S1', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', flightType: 'Layover', stationDisplay: 'KTM', amount: 777.77 },
      { id: 'S2', savedAt: '2026-10-20T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-20', flightType: 'Turnaround', stationDisplay: 'KTM', amount: 50 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(50);
    const search = d.getElementById('ca-arch-search');
    const rows = () => d.querySelectorAll('.ca-arch-row').length;
    search.value = 'september';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(rows(), 1, 'month name finds the September entry');
    search.value = '2026-10';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(rows(), 1, 'month key finds the October entry');
    search.value = '777';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(rows(), 1, 'amount finds the 777.77 entry');
    search.value = 'layover';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(rows(), 1, 'flight type finds the layover');
    search.value = 'KTM';
    search.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.eq(rows(), 2, 'route search still works');
    void d;
  }

  // v1.29.0: a refused save says so honestly — no silent loss, retry stays open
  {
    const { w, d } = await boot(APP);
    const seed = [{ id: 'F1', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', flightType: 'Layover', stationDisplay: 'KTM', amount: 100 }];
    w.localStorage.setItem('crewAssist.archive', JSON.stringify(seed));
    const origSet = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function (k, v) { if (k === 'crewAssist.archive') throw new Error('QuotaExceededError'); return origSet.call(this, k, v); };
    w.eval('showResultsOverlay(99, 99, 0, [], [], true, "both", ' + JSON.stringify({ id: 'F2', savedAt: new Date().toISOString(), monthKey: '2026-09', sectorDate: '2026-09-16', flightType: 'Layover', stationDisplay: 'NRT', amount: 200 }) + ', null)');
    await wait(60);
    const btn = d.getElementById('btn-results-action');
    R.ok(btn && !btn.disabled, 'results overlay offers save');
    btn.click();
    await wait(100);
    R.ok(d.getElementById('ca-save-review'), 'the review opens before anything is written');
    d.getElementById('ca-save-confirm').click();
    await wait(100);
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf("Couldn't save") !== -1, 'a refused write says so honestly');
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length === 1, 'nothing was added');
    R.ok(!btn.dataset.done && !btn.disabled && !btn.classList.contains('hidden'), 'the save stays armed and visible for a retry');
    w.Storage.prototype.setItem = origSet;
    btn.click();
    await wait(100);
    d.getElementById('ca-save-confirm').click();
    await wait(100);
    R.ok(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length === 2, 'retry after freeing storage saves');
    R.ok(btn.dataset.done === '1', 'and becomes one-shot');
    R.ok(!d.getElementById('ca-arch-toast').classList.contains('hidden') && d.getElementById('ca-arch-toast').textContent.indexOf('saved') !== -1, 'the retry lands as a toast too');
    void d;
  }

  // v1.29.2: flight-based progress — a fully-flown month reads Completed with
  // a full bar; a pre-saved future month reads Upcoming with its projection
  {
    // frozen late-Sep clock: Sep must stay the current, fully-flown month
    const { w, d } = await boot(APP, { now: '2026-09-26T12:00:00+08:00' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'C1', savedAt: '2026-09-11T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-10', flightType: 'Layover', stationDisplay: 'KTM', amount: 300 },
      { id: 'C2', savedAt: '2026-09-21T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-20', flightType: 'Turnaround', stationDisplay: 'HKT', amount: 200 },
      { id: 'C3', savedAt: '2026-09-25T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-05', flightType: 'Layover', stationDisplay: 'NRT', amount: 400 }
    ]));
    w.showArchiveOverlay();
    await wait(150);
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(150);
    const headOf = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    const bodyOf = (mk) => headOf(mk).closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    R.ok(headOf('2026-09').textContent.indexOf('Completed') !== -1, 'fully-flown current month reads Completed');
    R.ok(!headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn') && !bodyOf('2026-09').querySelector('.ca-arch-proj-wrap'), 'v1.38.0: no still-to-fly toggle once every flight has landed');
    R.ok(headOf('2026-10').textContent.indexOf('Upcoming') !== -1, 'future month with saved flights reads Upcoming');
    const octToggle = headOf('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn');
    const octWrap = bodyOf('2026-10').querySelector('.ca-arch-proj-wrap');
    R.ok(!!octToggle && !!octWrap, 'v1.38.0: an upcoming month carries the still-to-fly toggle');
    octToggle.click();
    R.ok(octWrap.classList.contains('open') && octWrap.textContent.indexOf('Remaining flights') !== -1 && octWrap.textContent.indexOf('$400.00') !== -1 && octWrap.textContent.indexOf('0 flights completed \u00b7 1 left') !== -1, 'the upcoming month unfolds its remaining-flights panel on tap');
    // v1.45.11: month columns live in Month scope (All-time is year bars)
    d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="month"]').click();
    await wait(50);
    const sepCol = d.querySelector('.ca-arch-barcol[data-mk="2026-09"]');
    const octCol = d.querySelector('.ca-arch-barcol[data-mk="2026-10"]');
    R.ok(sepCol && !sepCol.querySelector('.ca-arch-barproj') && sepCol.querySelector('.ca-arch-bar').style.height === '120px', 'completed month is a full solid bar');
    R.ok(octCol && octCol.querySelector('.ca-arch-barproj') && octCol.querySelector('.ca-arch-barproj').style.height === Math.round(120 * 400 / 500) + 'px', 'upcoming month renders the un-flown remainder as stripe');
    R.ok(octCol.querySelector('.ca-arch-bartip').textContent.indexOf('$0.00 \u2192 $400.00') !== -1, 'upcoming tooltip reads flown to projected');
    d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="month"]').click();
    await wait(50);
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Month total', 'completed current month context label');
    R.ok(d.getElementById('ca-arch-m-ctx').textContent.indexOf('Month complete') !== -1, 'Month complete line once the last flight has landed');
    void d;
  }

  // everything-moves ruling: the insights panel and search clear animate
  {
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('.ca-arch-insights { overflow: hidden; max-height: 0; opacity: 0; margin-top: 0; transition: max-height .3s ease, opacity .3s ease, margin-top .3s ease; }'), 'insights panel has the expand/collapse transition');
    R.ok(src.includes('transition-opacity duration-200'), 'search clear button fades');
  }

  // --- v1.34.2 (owner report): light-mode pop-ups readable + whole-archive delete holds a 10s Undo ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    // the gold-tint glass over the dim scrim composites to dark olive with
    // near-black text (~3.4:1) — unreadable confirms ("Delete all entries?")
    R.ok(/html:not\(\.dark\) #app-dialog-backdrop \.glass-bubble\s*{[^}]*var\(--ca-sheet-solid\)/.test(src), 'the alert/confirm pop-up gets the cream card in light mode'); // v1.44.4: the cream rides the token now
    R.ok(src.includes("archToast('Deleted ' + removed.length + ' entr' + (removed.length === 1 ? 'y' : 'ies'), () => { persistArchive(loadArchive().concat(removed)); renderArch(); }, 10000)"), 'deleting entries holds its Undo for the ten-second window');
  }

  // --- v1.32.0 (E1, owner ruling): a confirmed save can be taken back for ten seconds ---
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'u1', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 300 }
    ]));
    // a NEW trip saved on top of one existing entry
    w.eval('showResultsOverlay(99, 99, 0, [], [], true, "both", { id: "u2", savedAt: "2026-09-25T10:00:00Z", monthKey: "2026-09", sectorDate: "2026-09-12", flightType: "Layover", stationDisplay: "NRT", amount: 250 }, null)');
    await wait(60);
    const btn = d.getElementById('btn-results-action');
    btn.click();
    await wait(60);
    d.getElementById('ca-save-confirm').click();
    await wait(60);
    let arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.eq(arr.length, 2, 'the save files the new trip');
    R.eq(btn.dataset.done, '1', 'save is one-shot');
    const toast = d.getElementById('ca-arch-toast');
    R.ok(!toast.classList.contains('hidden'), 'the save toast shows');
    R.ok(!!toast.querySelector('.ca-toast-undo'), 'the save toast carries Undo (E1)');
    toast.querySelector('.ca-toast-undo').click();
    await wait(60);
    arr = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.eq(arr.length, 1, 'Undo removes the saved trip');
    R.eq(arr[0].id, 'u1', 'Undo restores the exact pre-save entry');
    R.ok(toast.classList.contains('hidden'), 'Undo dismisses the toast');
    R.ok(btn.dataset.done !== '1' && !btn.disabled, 'Undo re-arms the save button (E1)');
    // a regretted save is fixable: correct and re-save works
    btn.click();
    await wait(60);
    R.ok(!!d.getElementById('ca-save-review'), 'a re-save reopens the review');
    d.getElementById('ca-save-confirm').click();
    await wait(60);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 're-save after an undo files the trip again');
    void d;
  }

  // --- v1.32.0 (E1): an UPDATED entry rolls back to its old amount on Undo ---
  {
    const { w } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'r1', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 300 }
    ]));
    w.eval('showResultsOverlay(99, 99, 0, [], [], true, "both", { id: "r2", savedAt: "2026-09-25T10:00:00Z", monthKey: "2026-09", sectorDate: "2026-09-05", flightType: "Layover", stationDisplay: "CDG", amount: 999 }, null)');
    await wait(60);
    // save via the direct path: review -> confirm
    const w0 = w;
    w0.eval('document.getElementById("btn-results-action").click()');
    await wait(60);
    w0.eval('document.getElementById("ca-save-confirm").click()');
    await wait(60);
    let arr = JSON.parse(w0.localStorage.getItem('crewAssist.archive'));
    R.eq(arr.length, 1, 'the update replaces in place');
    R.eq(arr[0].amount, 999, 'the new amount is filed');
    w0.eval('document.querySelector("#ca-arch-toast .ca-toast-undo").click()');
    await wait(60);
    arr = JSON.parse(w0.localStorage.getItem('crewAssist.archive'));
    R.eq(arr[0].amount, 300, 'Undo rolls the entry back to its old amount (E1)');
  }

  // --- v1.32.0 (E2): the trash names its scope before it takes anything ---
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 't1', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', flightType: 'Layover', stationDisplay: 'CDG', amount: 300 },
      { id: 't2', savedAt: '2026-09-01T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-12', flightType: 'Layover', stationDisplay: 'KTM', amount: 120 }
    ]));
    w.showArchiveOverlay();
    await wait(50);
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(50);
    R.ok(!!d.querySelector('.ca-arch-headrule'), 'a hairline divides the file pair from the destructive pair (E2)');
    // unfiltered: the confirm says ALL plus the count
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    R.eq(d.getElementById('app-dialog-msg').textContent, 'Delete all 2 entries? This can be undone.', 'unfiltered trash confirms "all 2 entries" (E2)');
    d.getElementById('app-dialog-cancel').click();
    await wait(50);
    // filtered: the confirm says SHOWN plus the count
    const si = d.getElementById('ca-arch-search');
    si.value = 'KTM';
    si.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    R.eq(d.getElementById('app-dialog-msg').textContent, 'Delete 1 shown entry? This can be undone.', 'filtered trash confirms "1 shown entry" (E2)');
    d.getElementById('app-dialog-cancel').click();
    await wait(50);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 2, 'a refused confirm deletes nothing');
    void d;
  }

function todayYmd() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

  // ---- v1.33.2: a duty counts as flown when it LANDS, not at midnight ----
  {
    // Frozen midday Sep 26: both duties are TODAY, so the old date rule
    // would call them both un-flown; the landing times say otherwise.
    const { w, d } = await boot(APP, { now: '2026-09-26T12:00:00+08:00' });
    const seed = (id, endAtIso, amount) => ({ id: id, savedAt: '2026-09-26T08:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-26', flightType: 'Layover', stationDisplay: 'KTM', amount: amount, endAt: new Date(endAtIso).getTime() });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      seed('E1', '2026-09-26T03:45:00Z', 300), // landed 11:45am local — the owner's case
      seed('E2', '2026-09-26T15:30:00Z', 200)  // still in the air / to be flown
    ]));
    w.showArchiveOverlay();
    await wait(300);
    const headOf = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    R.ok(/In progress/.test(headOf('2026-09').textContent), 'one duty still out — the month stays in progress');
    d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="month"]').click();
    await wait(60);
    const ctxM = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxM.textContent.indexOf('$200.00 before end of month') !== -1, 'v1.45.17: the landed duty counts as earned, the airborne remainder rides the milestone line');
    const body = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    const ipToggle = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn');
    const ipWrap = body.querySelector('.ca-arch-proj-wrap');
    R.ok(!!ipToggle && !!ipWrap, 'v1.38.0: the un-landed duty still carries a projection toggle');
    ipToggle.click();
    R.ok(ipWrap.classList.contains('open') && ipWrap.textContent.indexOf('Remaining flights') !== -1 && ipWrap.textContent.indexOf('$200.00') !== -1 && ipWrap.textContent.indexOf('1 flight completed \u00b7 1 left') !== -1, 'tapping it shows the airborne duty among the remaining flights');
  }
  {
    // every duty today has landed → Completed on the day itself (the date
    // rule alone would have kept it "In progress" until midnight)
    const { w, d } = await boot(APP, { now: '2026-09-26T12:00:00+08:00' });
    const seed = (id, endAtIso, amount) => ({ id: id, savedAt: '2026-09-26T08:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-26', flightType: 'Layover', stationDisplay: 'KTM', amount: amount, endAt: new Date(endAtIso).getTime() });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      seed('E1', '2026-09-26T03:45:00Z', 300),
      seed('E3', '2026-09-26T00:10:00Z', 250)
    ]));
    w.showArchiveOverlay();
    await wait(300);
    const headOf = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    R.ok(/Completed/.test(headOf('2026-09').textContent), 'a same-day duty that landed reads Completed, not In progress');
    // round 22 (F-08): the .ca-arch-dot-hollow absence pin removed with the dead
    // CSS — the class had no emitter anywhere, so the pin could never fail.
    // entries without an arrival on record keep the date rule
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'E9', savedAt: '2026-09-26T08:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-26', flightType: 'Layover', stationDisplay: 'HKT', amount: 100 }
    ]));
    w.renderArch();
    await wait(200);
    R.ok(/In progress/.test(headOf('2026-09').textContent), 'an entry with no arrival on record keeps the date rule (kept for the day)');
  }
  {
    // the live sweep: a duty that lands while the sheet is open flips the
    // badge in place — the store is aged and the app woken, no reload.
    const { w, d } = await boot(APP);
    const base = { id: 'E1', savedAt: new Date().toISOString(), monthKey: String(new Date().getFullYear()) + '-' + String(new Date().getMonth() + 1).padStart(2, '0'), sectorDate: todayYmd(), flightType: 'Layover', stationDisplay: 'KTM', amount: 300 };
    const mk = base.monthKey;
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([Object.assign({}, base, { endAt: Date.now() + 90000 })]));
    w.showArchiveOverlay();
    await wait(300);
    const headOf = () => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    R.ok(/In progress/.test(headOf().textContent), 'the still-out duty keeps the month in progress');
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([Object.assign({}, base, { endAt: Date.now() - 60000 })]));
    d.dispatchEvent(new w.Event('visibilitychange'));
    await wait(300);
    R.ok(/Completed/.test(headOf().textContent), 'returning to the screen after the landing flips the badge in place');
    const rows = d.querySelectorAll('.ca-arch-row').length;
    R.ok(rows >= 1, 'the re-render keeps the entries visible');
    void rows;
  }

  // ---- v1.33.0: the month context compares against the month before ----
  {
    // Month scope follows the real calendar (owner ruling): a quiet current
    // month shows the NEWEST saved month — that summary now carries the
    // dollar delta against the month before it (MoM), YoY alongside.
    const { w, d } = await boot(APP, { now: '2026-09-20T12:00:00+08:00' });
    const seed = (id, sectorDate, amount) => ({ id: id, savedAt: sectorDate + 'T20:00:00Z', monthKey: sectorDate.slice(0, 7), sectorDate: sectorDate, stationDisplay: 'KTM', amount: amount, flightType: 'Layover' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      seed('M1', '2026-04-05', 200),
      seed('M2', '2026-05-08', 600)
    ]));
    w.showArchiveOverlay();
    await wait(300);
    // the MoM line lives in the month-scope summary — with a quiet current
    // month it falls back to the newest saved month (May)
    d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="month"]').click();
    await wait(60);
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Context', 'the newest month leads the context');
    const ctx = d.getElementById('ca-arch-m-ctx').textContent;
    R.ok(ctx.indexOf('+$400.00 vs Apr 2026') !== -1, 'May carries +$400.00 vs April (MoM in dollars)');
    R.ok(ctx.indexOf('vs LY') === -1, 'no LY chip without a year-ago record to cite');
    R.ok(d.getElementById('ca-arch-m-ctx').innerHTML.indexOf('trending-up') !== -1, 'the up-month shows its trend icon');
  }
  {
    // ---- v1.37.0: owner ruling — a duty belongs to its departure month ----
    const m = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
    } });
    m.w.eval("renderCalculatorCard('ifa')");
    for (let i = 0; i < 40 && !m.d.querySelector('input[id$=\"-ifa-d1\"]'); i++) await wait(100);
    const d1 = m.d.querySelector('input[id$=\"-ifa-d1\"]');
    R.ok(!!d1, 'a manual card exposes its first departure date');
    const cid = d1.id.slice(0, -'-ifa-d1'.length);
    d1.value = '2026-11-30'; // SIN->XXX out Nov 30, back Dec 2
    const rec = m.w.eval("buildCopArchivePayload('" + cid + "', true, 150, 0)");
    R.ok(rec && rec.monthKey === '2026-11', 'v1.37.0 (4.3) owner ruling: a Nov 30 departure counts as November even when the duty lands in December');
    // ---- v1.37.0: ten fresh entries re-arm the backup nudge ----
    const nowMs = Date.now();
    m.w.localStorage.setItem('crewAssist.lastBackupAt', String(nowMs));
    const ten = [];
    for (let i = 0; i < 10; i++) ten.push({ monthKey: '2026-10', savedAt: new Date(nowMs + (i + 1) * 60000).toISOString() });
    const info = m.w.eval('archBackupNudgeInfo(' + JSON.stringify(ten) + ')');
    R.ok(info && info.newCount === 10, 'v1.37.0: ten fresh entries re-arm the backup nudge inside the 21-day quiet window');
    R.ok(m.w.eval('archBackupNudgeInfo(' + JSON.stringify(ten.slice(0, 2)) + ')') === null, 'two fresh entries stay quiet inside the 21-day window');
  }
  {
    // ---- v1.38.0 (A1): the reveal also expands a collapsed group ----
    const e = await boot(APP, { now: '2026-09-20T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.wnSeen', x.eval('APP_VERSION'));
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([
        { id: 'B1', savedAt: '2026-09-02T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-01', flightType: 'Turnaround', stationDisplay: 'HKT', amount: 300, endAt: Date.parse('2026-09-01T22:00:00+08:00') },
        { id: 'B2', savedAt: '2026-09-03T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-28', flightType: 'Layover', stationDisplay: 'NRT', amount: 500, endAt: Date.parse('2026-09-29T06:00:00+08:00') },
        { id: 'B3', savedAt: '2026-07-03T10:00:00Z', monthKey: '2026-07', sectorDate: '2026-07-03', flightType: 'Turnaround', stationDisplay: 'KUL', amount: 150, endAt: Date.parse('2026-07-03T20:00:00+08:00') }
      ]));
    } });
    await wait(100);
    e.w.eval('showArchiveOverlay()');
    await wait(150);
    e.d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(150);
    const grp = e.d.querySelector('.ca-arch-group-head[data-mk="2026-09"]').closest('.ca-arch-group');
    const tgl = grp.querySelector('.ca-arch-proj-btn');
    R.ok(!!tgl && tgl.tagName === 'BUTTON' && !tgl.querySelector('i'), 'hotfix: the total stays tappable with no chevron shifting the text');
    // collapse the group first — the reveal must expand it so it is never hidden
    if (!grp.classList.contains('ca-arch-collapsed')) { e.d.querySelector('.ca-arch-group-head[data-mk="2026-09"]').click(); }
    R.ok(grp.classList.contains('ca-arch-collapsed'), 'group starts collapsed');
    tgl.click();
    const wrap = grp.querySelector('.ca-arch-proj-wrap');
    R.ok(wrap.classList.contains('open') && !grp.classList.contains('ca-arch-collapsed'), 'v1.38.0: opening the projection expands a collapsed month too');
    R.ok(wrap.textContent.indexOf('1 flight completed \u00b7 1 left') !== -1 && wrap.textContent.indexOf('$500.00') !== -1, 'v1.45.18: the panel counts completed vs left, the gold figure carries the priced remainder');
    // a fully-flown past month gets no toggle at all
    R.ok(!e.d.querySelector('.ca-arch-group-head[data-mk="2026-07"]').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn'), 'completed past months keep a plain total');
    e.d.getElementById('ca-arch-backdrop').click();
  }
  // v1.44.5 (owner order): a close+reopen always starts fresh — the search,
  // the scope seg and the list scroll all reset at open. The v1.33.2
  // keep-scroll preservation still holds DURING an open session (the dirty
  // scroll survives below without a close); only the reopen boundary resets.
  {
    const { w, d } = await boot(APP, { now: '2026-09-20T12:00:00+08:00' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'R1', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'NRT/LAX', amount: 70 },
      { id: 'R2', savedAt: '2026-08-15T10:00:00Z', monthKey: '2026-08', sectorDate: '2026-08-15', stationDisplay: 'JNB/CPT', amount: 50 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    // v1.45.13 made Month + COP the default, so the drift demo now leaves
    // the sheet from All-time (the reopen must come back to the default)
    d.querySelector('.ca-arch-seg[data-scope="all"]').click();
    await wait(30);
    const si = d.getElementById('ca-arch-search');
    si.value = 'NRT';
    si.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(30);
    R.ok(d.getElementById('ca-arch-list').textContent.includes('NRT') && !d.getElementById('ca-arch-list').textContent.includes('JNB'), 'the search filter takes before the close');
    R.ok(d.querySelector('.ca-arch-seg[data-scope="all"]').classList.contains('ca-arch-segon'), 'All-time takes before the close');
    d.getElementById('ca-arch-scroll').scrollTop = 777;
    R.eq(d.getElementById('ca-arch-scroll').scrollTop, 777, 'the list scroll sits deep while the sheet stays open');
    w.closeArchOverlay();
    await wait(350); // the owner's flow: close, do something else, come back
    w.showArchiveOverlay();
    await wait(100);
    R.eq(d.getElementById('ca-arch-search').value, '', 'v1.44.5: a reopen clears the search');
    R.ok(d.getElementById('ca-arch-list').textContent.includes('NRT') && !d.getElementById('ca-arch-list').textContent.includes('JNB'), 'v1.45.13: a reopen returns to the current month only');
    R.ok(d.querySelector('.ca-arch-seg[data-scope="month"]').classList.contains('ca-arch-segon'), 'v1.45.13: the scope seg returns to Month (the default)');
    R.ok(d.querySelector('.ca-arch-seg[data-mode="cop"]').classList.contains('ca-arch-segon'), 'v1.45.13: the lens returns to COP Allowance (the default)');
    R.eq(d.getElementById('ca-arch-scroll').scrollTop, 0, 'v1.44.5: the list reopens scrolled to the top');
    w.closeArchOverlay();
  }

  // ---- v1.45.11: Monthly Salary (CA 058/2025 clauses 26/35/37/38) ----
  // The stack: basic + laundry 125 + transport 340 + 32 per duty reporting
  // 0000-0700 at Changi + COP; CPF 20% of basic + IFA + midnights (LMA,
  // laundry and transport stay out). Figures below are hand-computed.
  {
    const NOW = '2026-10-20T12:00:00+08:00';
    const seedAll = (x, basic) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'T', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01', basicSalary: basic ? 2600 : 0 }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
      const mk = (id, monthKey, date, route, amount, ifa, lma, savedAt) => ({ id, savedAt, monthKey, sectorDate: date, flightType: 'Layover', stationDisplay: route, amount, detail: { v: 1, type: 'both', ifaTotal: ifa, lmaTotal: lma, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([
        mk('a1', '2025-06', '2025-06-28', 'SIN-PKX-SIN', 600, 500, 100, '2025-06-30T10:00:00Z'),
        mk('a2', '2025-07', '2025-07-05', 'SIN-SYD-SIN', 900, 700, 200, '2025-07-10T10:00:00Z'),
        mk('a3', '2025-07', '2025-07-20', 'SIN-KUL-SIN', 300, 300, 0, '2025-07-25T10:00:00Z'),
        mk('a4', '2026-02', '2026-02-13', 'SIN-CHC-SIN', 1200, 1000, 200, '2026-02-20T10:00:00Z')
      ]));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({
        '2025-06': [
          { fn: '265', dep: 'SIN', arr: 'BNE', ymd: '2025-06-16', std: '07:13', sta: '15:30', stdYmd: '2025-06-16', staYmd: '2025-06-17', ft: '08:02', rpt: '0510', pos: false },
          { fn: '266', dep: 'BNE', arr: 'SIN', ymd: '2025-06-17', std: '18:15', sta: '00:10', stdYmd: '2025-06-17', staYmd: '2025-06-18', ft: '07:55', rpt: '1710', pos: false },
          { fn: '336', dep: 'SIN', arr: 'CDG', ymd: '2025-06-02', std: '00:17', sta: '06:20', stdYmd: '2025-06-02', staYmd: '2025-06-02', ft: '13:03', rpt: '2215', pos: false },
          { fn: '800', dep: 'SIN', arr: 'PEK', ymd: '2025-06-05', std: '01:30', sta: '07:30', stdYmd: '2025-06-05', staYmd: '2025-06-05', ft: '06:00', rpt: '0000', pos: false },
          { fn: '801', dep: 'PEK', arr: 'SIN', ymd: '2025-06-06', std: '09:00', sta: '15:00', stdYmd: '2025-06-06', staYmd: '2025-06-06', ft: '06:00', rpt: '0700', pos: false },
          { fn: '802', dep: 'SIN', arr: 'HKT', ymd: '2025-06-09', std: '02:00', sta: '05:00', stdYmd: '2025-06-09', staYmd: '2025-06-09', ft: '03:00', rpt: '0701', pos: false },
          { fn: '803', dep: 'HKT', arr: 'SIN', ymd: '2025-06-09', std: '06:00', sta: '09:00', stdYmd: '2025-06-09', staYmd: '2025-06-09', ft: '03:00', rpt: '0500', pos: false }
        ],
        '2026-02': [
          { fn: '298', dep: 'CHC', arr: 'SIN', ymd: '2026-02-13', std: '12:00', sta: '17:35', stdYmd: '2026-02-13', staYmd: '2026-02-13', ft: '09:35', rpt: '1015', pos: false }
        ]
      }));
    };

    // A) the midnight rule, edge by edge: 0000 and 0700 count (inclusive),
    //    0701 does not, outstation reports do not, blank rpt does not
    {
      const { w } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, true) });
      R.eq(w.eval('archMidnightCount("2025-06")'), 2, 'midnight window: 0510 and 0000 count; 0701, blank and outstation reports do not');
      R.eq(w.eval('archMidnightCount("2026-02")'), 0, 'an outstation report (CHC 1015) never counts');
      R.eq(w.eval('archMidnightCount("2025-99")'), 0, 'a month with no roster counts zero');
    }

    // B) the card: COP default, then Monthly Salary with hand-checked math
    {
      const { w, d } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, true) });
      w.showArchiveOverlay(); await wait(150);
      R.eq(d.getElementById('ca-arch-total-label').textContent, 'Total earnings', 'the card opens in COP Allowance as before');
      R.ok(!d.getElementById('ca-arch-salary-prompt') || d.getElementById('ca-arch-salary-prompt').classList.contains('hidden'), 'no salary prompt while COP mode is on');
      d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-total').textContent, '$3,000.00', 'the COP total is untouched in COP mode');
      d.querySelector('.ca-arch-seg[data-mode="salary"]').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-total-label').textContent, 'Net take-home', 'the label flips with the lens');
      // all-time: 3 tracked months. gross = 3x(2600+465) + 2x32 + 3000 = 12259;
      // cpf = .2x(3x2600 + 2500 + 64) = 2072.80; net = 10186.20
      R.eq(d.getElementById('ca-arch-total').textContent, '$10,186.20', 'all-time net = gross 12259 - CPF 2072.80');
      R.ok(d.getElementById('ca-arch-gross-line').textContent.indexOf('Gross $12,259.00') !== -1 && d.getElementById('ca-arch-gross-line').textContent.indexOf('CPF \u2212$2,072.80') !== -1, 'gross and CPF ride under the number');
      const src19 = fs.readFileSync(APP, 'utf8');
      const gl20 = d.getElementById('ca-arch-gross-line');
      R.ok(gl20.className.indexOf('mt-1.5') !== -1 && gl20.className.indexOf('w-full') !== -1 && gl20.className.indexOf('flex') === -1, 'v1.45.21: the subtext is the single never-wrapping Gross|CPF string - no column, no trailing row, in every scope');
      R.ok(gl20.children.length === 1 && gl20.children[0].getAttribute('style').indexOf('white-space: nowrap') !== -1, 'the string carries the strict no-wrap security');
      R.ok(gl20.textContent.indexOf('On track for') === -1 && gl20.textContent.indexOf('vs') === -1, 'no milestone, no comparison below the figures - the right side stays empty');
      R.ok(gl20.innerHTML.indexOf('ca-arch-gross-sep">|</span>') !== -1, 'Gross and CPF group left behind the muted pipe');
      R.ok(src19.includes('.ca-arch-gross-sep { opacity: .45; padding: 0 4px; }'), 'the pipe rides slightly more muted with breathing room');
      R.ok(!src19.includes('.ca-arch-gross-ly') && !src19.includes('ca-arch-metarows'), 'v1.45.21: the year second row and the metarows class are gone from the source');
      R.eq(d.getElementById('ca-arch-m-basic').textContent, '$7,800.00', 'basic meta = 3 tracked months x 2600');
      R.eq(d.getElementById('ca-arch-m-fixed').textContent, '$1,395.00', 'fixed meta = 3 x (125 + 340)');
      R.ok(d.getElementById('ca-arch-m-mid').textContent.indexOf('2') === 0 && d.getElementById('ca-arch-m-mid').textContent.indexOf('$64.00') !== -1, 'midnight meta shows 2 duties = $64');
      R.eq(d.getElementById('ca-arch-m-cop').textContent, '$3,000.00', 'COP meta carries the flight allowance');
      // month figures via Year 2025 -> tap the Jun bar -> Month pill (the
      // tap moves the selection, the owner's spec)
      d.querySelector('.ca-arch-seg[data-scope="year"]').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-seg-year').textContent, '2026', 'Year pill opens on the current year');
      // v1.45.21 (owner order): the yearly net comparison rides beside the
      // headline figure as the triangle badge - one decimal, the app's own
      // YoY precision, computed through the app's own aggregators
      const badge21 = d.getElementById('ca-arch-netyoy');
      const expBadge21 = w.eval("(function () { const all = JSON.parse(localStorage.getItem('crewAssist.archive')); const mkSet = {}; all.forEach((e) => { mkSet[e.monthKey] = 1; }); const yMks = Object.keys(mkSet).filter((k) => k.slice(0, 4) === '2026').sort(); const lyMks = Object.keys(mkSet).filter((k) => k.slice(0, 4) === '2025').sort(); const sal = archSalaryAgg(yMks, all), lySal = archSalaryAgg(lyMks, all); const y = archYoyPct(sal.net, lySal.net); return (y >= 0 ? '▲ ' : '▼ ') + Math.abs(y).toFixed(1) + '%'; })()");
      R.ok(!badge21.classList.contains('hidden') && badge21.textContent === expBadge21, 'v1.45.21: the YEAR badge rides beside the figure with the app-computed net YoY (' + badge21.textContent + ')');
      R.ok(badge21.className.indexOf('ml-3') !== -1 && (badge21.classList.contains('ca-arch-netyoy-up') || badge21.classList.contains('ca-arch-netyoy-dn')), 'the badge carries its 12px margin and its direction class');
      R.ok(d.getElementById('ca-arch-total').parentElement.className.indexOf('items-baseline') !== -1, 'the badge shares the figure row on the strict text baseline');
      d.getElementById('ca-arch-seg-year').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-seg-year').textContent, '2025', 'second tap cycles to the earliest year on record');
      R.ok(badge21.classList.contains('hidden'), 'the earliest year hides the badge entirely - no prior year to cite');
      d.getElementById('ca-arch-seg-year').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-seg-year').textContent, '2026', 'third tap is +1 - back to the current year');
      d.getElementById('ca-arch-seg-year').click(); await wait(150);
      R.eq(d.getElementById('ca-arch-seg-year').textContent, '2025', 'the cycle wraps to the earliest again');
      const junBar = d.querySelector('.ca-arch-barcol[data-mk="2025-06"]');
      R.ok(!!junBar, 'the year view shows the selected year\u2019s months as bars');
      junBar.click(); await wait(150);
      R.ok(d.querySelector('.ca-arch-seg[data-scope="month"]').classList.contains('ca-arch-segon'), 'tapping a month bar jumps into Month scope');
      R.eq(d.getElementById('ca-arch-total').textContent, '$3,096.20', 'June net = 2600+465+64+600 gross 3729 - CPF 632.80');
      R.ok(d.getElementById('ca-arch-gross-line').textContent.indexOf('Gross $3,729.00') !== -1, 'June gross 3729 (basic + fixed + 2 midnights + COP)');
      R.ok(d.getElementById('ca-arch-m-mid').textContent.indexOf('2') === 0, 'June counts its two midnight duties');
      const groups = d.querySelectorAll('.ca-arch-group');
      R.eq(groups.length, 1, 'Month scope lists only the selected month');
      R.ok(!groups[0].classList.contains('ca-arch-collapsed'), 'the selected month opens expanded');
      R.ok(groups[0].textContent.indexOf('net $3,096.20') !== -1, 'the month row leads with net, gross beside it');
    }

    // C) the chart shapes + the average line (complete months only)
    {
      const { w, d } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, true) });
      w.showArchiveOverlay(); await wait(150);
      d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(150);
      const yrBars = d.querySelectorAll('.ca-arch-barcol[data-yr]');
      R.eq(Array.from(yrBars).map((b) => b.getAttribute('data-yr')).join(','), '2025,2026', 'All-time draws one bar per year');
      R.eq(d.getElementById('ca-arch-trend-title').textContent, 'Year by Year', 'the trend title names the all-time shape');
      R.ok(d.getElementById('ca-arch-avglab').textContent.indexOf('Avg $1.8k') === 0, 'the average line averages complete years only (2025 = 1800)');
      yrBars[0].click(); await wait(150);
      R.ok(d.querySelector('.ca-arch-seg[data-scope="year"]').classList.contains('ca-arch-segon'), 'tapping a year bar jumps into Year scope');
      R.eq(d.getElementById('ca-arch-seg-year').textContent, '2025', 'the jump carries the tapped year');
      R.eq(d.querySelectorAll('#ca-arch-list .ca-arch-group').length, 2, 'Year scope lists only that year\u2019s months');
      R.ok(Array.from(d.querySelectorAll('#ca-arch-list .ca-arch-group')).every((g) => g.classList.contains('ca-arch-collapsed')), 'year-scope months start collapsed');
      d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(150);
      R.ok(d.querySelectorAll('#ca-arch-list .ca-arch-yearhead').length === 2, 'All-time groups the months under year headers');
      d.querySelector('.ca-arch-seg[data-mode="salary"]').click(); await wait(150);
      R.ok(d.querySelectorAll('#ca-arch-chart .ca-arch-barsal').length >= 2, 'salary mode stacks a salary slice into each bar');
      R.ok(d.querySelectorAll('#ca-arch-chart .ca-arch-barfly').length >= 2, 'the flying slice rides on top');
      // v1.45.13: the Year-by-Year legend names the stacked golds (salary only)
      const legend = d.getElementById('ca-arch-legend');
      R.ok(legend && !legend.classList.contains('hidden'), 'the legend rides under the Year-by-Year title in salary view');
      R.ok(legend.textContent.indexOf('Basic Salary') !== -1 && legend.textContent.indexOf('Allowances') !== -1, 'the legend names both stacked segments');
      d.querySelector('.ca-arch-seg[data-mode="cop"]').click(); await wait(150);
      R.ok(legend.classList.contains('hidden'), 'the legend steps aside in COP view');
    }

    // D) the trash narrowing (the IFA-only counting row is gone as of
    // v1.45.13 - the narrowing demo only needs a scope that narrows)
    {
      const { w, d } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, true) });
      w.showArchiveOverlay(); await wait(150);
      d.querySelector('.ca-arch-seg[data-scope="month"]').click(); await wait(150);
      d.getElementById('ca-arch-trash').click(); await wait(100);
      R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete 1 shown entry') !== -1, 'trash names the shown entries when a scope narrows the list');
      d.getElementById('app-dialog-cancel').click(); await wait(100);
      R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 4, 'cancel keeps every entry');
    }

    // E) no basic yet: the prompt asks, the card never guesses
    {
      const { w, d } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, false) });
      w.showArchiveOverlay(); await wait(150);
      d.querySelector('.ca-arch-seg[data-mode="salary"]').click(); await wait(150);
      R.ok(!d.getElementById('ca-arch-salary-prompt').classList.contains('hidden'), 'the setup prompt appears when no basic is set');
      R.eq(d.getElementById('ca-arch-total').textContent, '\u2014', 'the net number refuses to guess');
      R.ok(!!d.getElementById('ca-arch-salary-setup'), 'the prompt carries a Set up button');
    }

    // F) the salary insights (owner set)
    {
      const { w, d } = await boot(APP, { now: NOW, seed: (x) => seedAll(x, true) });
      w.showArchiveOverlay(); await wait(150);
      d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(150);
      d.querySelector('.ca-arch-seg[data-mode="salary"]').click(); await wait(150);
      d.getElementById('ca-arch-ins-toggle').click(); await wait(150);
      const labels = d.getElementById('ca-arch-insights').textContent;
      ['Average monthly net', 'Best month (net)', 'CPF this year', 'Flying share', 'Midnight reports', 'Net per flying day', 'Net vs LY'].forEach((t) => {
        R.ok(labels.indexOf(t) !== -1, 'insight card present: ' + t);
      });
      R.ok(labels.indexOf('Top earning month') === -1, 'the COP-only money cards step aside in salary mode');
    }
  }

  // ---- v1.45.12 + v1.45.13: the gold-card and list polish ----
  // v1.45.12 brought the breathing room, equal-width stat grids, AA ink over
  // the gold, month cards, solid status pills and the right-aligned money
  // column; v1.45.13 doubled the air (16px), hardened the grid to a strict
  // 4-track layout whose values never clip, muted the non-active chart bars,
  // striped the future and tinted the month cards.
  {
    const src = fs.readFileSync(APP, 'utf8');
    // the card: src pins (jsdom cannot compute var()-backed properties)
    R.ok(src.includes('#ca-arch-total { padding-top: 16px; padding-bottom: 16px; }'), 'v1.45.13: the core figure carries 16px of air above and below (the 8 from v1.45.12 + 8 more)');
    R.ok(src.includes('.ca-arch-metagrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 8px; }'), 'the metagrid family base (v1.45.13 four-track) - both named grids override it with the quadrant 2x2');
    R.ok(src.includes('.ca-arch-metaspan2 { grid-column: span 2; }'), 'the COP context cell spans the full bottom row of the quadrant grid');
    R.ok(src.includes('@media (max-width: 419px) { .ca-arch-metagrid .ca-arch-metaval { font-size: 12px; } }'), 'values step to 12px under 420px before anything can clip');
    R.ok(src.includes('@media (max-width: 359px) {') && src.includes('.ca-arch-metagrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }'), 'the family fold under 360px (the named grids are already the 2x2 at every width)');
    R.ok(src.includes('.ca-arch-metaval { font-weight: 700; font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }'), 'v1.45.13: values never truncate - nowrap with no clip, the tiers carry the width');
    R.ok(src.includes('.ca-arch-metalabel { font-size: 11px; letter-spacing: .03em;'), 'labels keep the 11px floor with roomier tracking (wrap before ellipsis)');
    R.ok(src.includes('--ca-arch-seg-ink: #1A1300;'), 'v1.45.15: the inactive tab ink is espresso solid by night (the .75 tint read thin)');
    R.ok(src.includes('html:not(.dark) #ca-arch-summary .ca-arch-seg:not(.ca-arch-segon) { color: #2D1E0F; }'), 'v1.45.15/16: strict walnut #2D1E0F by day, ACTIVE pill excluded (the 1.45.16 invisibility fix)');
    R.ok(src.includes('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon) { font-weight: 800; }'), 'v1.45.15: the inactive pills carry font-weight 800 in both themes');
    R.ok(src.includes('rgba(26,19,0,.8)\" id=\"ca-arch-gross-line\"'), 'the gross line ink rides at .80 over the gold');

    // v1.45.13 chart pins: the mute, the future stripe, the legend
    R.ok(src.includes('--ca-arch-bar: rgba(212, 175, 55, 0.65);'), 'v1.45.13: non-active bars sit at 0.65 alpha - 35% under the selected bar\u2019s solid gold');
    R.ok(src.includes('.ca-arch-bar.ca-arch-barfuture { background: repeating-linear-gradient(45deg, var(--ca-arch-proj) 0 4px, var(--ca-arch-proj-fade) 4px 8px); }'), 'the diagonal stripe pattern belongs to the future placeholder');
    R.ok(src.includes('.ca-arch-legsw-sal { background: rgba(146, 94, 14, 0.45); }') && src.includes('.ca-arch-legsw-fly { background: rgba(212, 175, 55, 0.65); }'), 'the legend swatches match the stacked segments - dark gold basic, light gold allowances');

    // v1.45.13 list pins: the tint over the canvas
    R.ok(src.includes('.ca-arch-group { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--arch-surface-border); border-radius: 12px; overflow: hidden; }'), 'v1.45.13: month cards ride a subtle white-2% tint over the dark canvas');
    R.ok(src.includes('html:not(.dark) .ca-arch-group { background: #FFFFFF; }'), 'v1.45.14: the day theme cards turn solid white over the warm canvas');
    R.ok(src.includes('html:not(.dark) #ca-arch-sheet { background: #F4F4F0; }'), 'v1.45.14: the light earnings canvas deepens to the warm gray');
    R.ok(src.includes('html:not(.dark) .ca-arch-surface, html:not(.dark) .ca-arch-group { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }'), 'v1.45.14: white containers carry the soft low-blur shadow by day');

    R.ok(src.includes('.ca-arch-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 40px; column-gap: 10px; align-items: center; }'), 'v1.45.15: the ledger row CENTRES its columns (the text line boxes coincide; the \u2715 no longer sags)');
    R.ok(src.includes('.ca-arch-row .ca-arch-del { justify-self: end; display: flex; align-items: center; justify-content: center; }'), 'v1.45.15: the \u2715 rides a flex-centred wrapper in its fixed end slot');
    R.ok(src.includes('.ca-arch-row .ca-arch-amt { justify-self: end; text-align: right; }'), 'v1.45.14: row values right-align inside their own column, independent of the \u2715 slot');
    R.ok(src.includes('.ca-arch-netyoy { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }'), 'v1.45.21: the badge rides the 14px value rung, bold, tabular, never wrapping');
    R.ok(src.includes('.ca-arch-netyoy-up { color: #123f22; }') && src.includes('.ca-arch-netyoy-dn { color: #6e1f1f; }'), 'deep green for growth, deep brick for decline - both AA over the gold card');
    R.ok(src.includes('ca-arch-netyoy ml-3 hidden" id="ca-arch-netyoy"'), 'the badge markup: 12px off the figure, hidden by default');
    R.ok(src.includes('ca-arch-metaval flex items-center gap-2'), 'v1.45.14: the bullseye icon keeps gap-x-2 from the milestone text');

    // the DOM contract on a live boot
    const NOW2 = '2026-10-20T12:00:00+08:00';
    const seed2 = (x, basic) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'T', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01', basicSalary: basic ? 2600 : 0 }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
      const mk = (id, monthKey, date, amount) => ({ id, savedAt: date + 'T10:00:00Z', monthKey, sectorDate: date, flightType: 'Turnaround', stationDisplay: 'SIN/KUL', amount, detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([
        mk('p1', '2026-10', '2026-10-28', 100),  // still to fly - In progress
        mk('p2', '2026-11', '2026-11-15', 200)   // ahead - Upcoming
      ]));
    };
    const { w, d } = await boot(APP, { now: NOW2, seed: (x) => seed2(x, true) });
    w.showArchiveOverlay(); await wait(150);
    // v1.45.13: the sheet opens on the current month
    R.ok(d.querySelector('.ca-arch-seg[data-scope=\"month\"]').classList.contains('ca-arch-segon'), 'a fresh open lands on Month');
    R.ok(!d.getElementById('ca-arch-coprow'), 'the counting row is absent from the DOM');
    const copRow = d.getElementById('ca-arch-meta-cop');
    R.ok(copRow.className.indexOf('ca-arch-metagrid') !== -1 && copRow.className.indexOf('metagrid-3') === -1, 'the COP stat row rides the metagrid family');
    R.ok([copRow.children[0].className, copRow.children[1].className, copRow.children[2].className].join('|') === 'ca-arch-msq-r ca-arch-msq-b|ca-arch-msq-b|ca-arch-metaspan2', 'v1.45.21: the COP quadrants - Flights r+b, Avg b, the context cell spanning the bottom row');
    R.eq(copRow.querySelectorAll(':scope > div').length, 3, 'three stat cells - the context cell spans both bottom tracks');
    R.ok(copRow.querySelector('.ca-arch-metaspan2') === copRow.children[2], 'the context cell is the full-width spanner');
    R.eq(copRow.querySelectorAll('.ca-arch-metadot').length, 0, 'the old dot separators are gone from the stat row');
    // the year window: empty future months take the 16px striped placeholder
    d.querySelector('.ca-arch-seg[data-scope=\"year\"]').click(); await wait(150);
    const novBar = d.querySelector('.ca-arch-barcol[data-mk=\"2026-11\"] .ca-arch-bar');
    const decBar = d.querySelector('.ca-arch-barcol[data-mk=\"2026-12\"] .ca-arch-bar');
    R.ok(!novBar.classList.contains('ca-arch-barfuture') && d.querySelector('.ca-arch-barcol[data-mk=\"2026-11\"] .ca-arch-barproj'), 'a future month WITH data stripes at its scheduled height (Nov carries the saved $200)');
    R.ok(decBar.classList.contains('ca-arch-barfuture') && decBar.getAttribute('style').indexOf('height:16px') !== -1, 'v1.45.13: an EMPTY future month takes the 16px striped placeholder (Dec has nothing saved)');
    R.ok(!d.querySelector('.ca-arch-barcol[data-mk=\"2026-12\"] .ca-arch-barproj'), 'the placeholder needs no projection div of its own');
    d.querySelector('.ca-arch-seg[data-scope=\"all\"]').click(); await wait(150);
    R.ok(d.getElementById('ca-arch-meta-cop').children[0].className.indexOf('ca-arch-msq-r') !== -1, 'All-time keeps the same quadrant architecture - no scope ever swaps the grid');
    d.querySelector('.ca-arch-seg[data-mode=\"salary\"]').click(); await wait(150);
    const salRow = d.getElementById('ca-arch-meta-salary');
    R.ok(salRow.className.indexOf('ca-arch-metagrid') !== -1 && salRow.className.indexOf('metagrid-4') === -1, 'the salary stat row rides the metagrid family');
    // v1.45.20 (owner order): the salary row is the strict 2x2 hairline grid
    R.ok(src.includes('#ca-arch-meta-salary, #ca-arch-meta-cop { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 0; row-gap: 0; }'), 'v1.45.21: BOTH meta rows ride the unified strict 2x2 - no gaps, the hairlines own the tracks');
    R.ok(src.includes('#ca-arch-meta-salary > div, #ca-arch-meta-cop > div { padding: 12px; border-color: rgba(255, 255, 255, 0.08); }'), 'every quadrant on both rows pads the uniform 12px, hairlines at the night white tint');
    R.ok(src.includes('html:not(.dark) #ca-arch-meta-salary > div, html:not(.dark) #ca-arch-meta-cop > div { border-color: rgba(0, 0, 0, 0.06); }'), 'by day the hairlines shift to the quiet charcoal tint');
    R.ok(src.includes('#ca-arch-meta-salary .ca-arch-msq-r, #ca-arch-meta-cop .ca-arch-msq-r { border-right-width: 1px; border-right-style: solid; }') && src.includes('#ca-arch-meta-salary .ca-arch-msq-b, #ca-arch-meta-cop .ca-arch-msq-b { border-bottom-width: 1px; border-bottom-style: solid; }'), 'the centre axes ride longhand width/style on both rows - the border-color rules stay the single colour source (shorthands would smuggle currentcolor past them)');
    R.ok([...salRow.children].map((c) => c.className).join(',') === 'ca-arch-msq-r ca-arch-msq-b,ca-arch-msq-b,ca-arch-msq-r,', 'the quadrants carry their hairline classes: Basic r+b, Fixed b, After-hours r, COP bare');
    R.ok(src.includes('.ca-arch-metico { color: rgba(26, 19, 0, 0.55); }'), 'the 14px label icons ride the low-opacity espresso token');
    R.ok(src.includes('@media (max-width: 359px) {') && src.includes('#ca-arch-meta-salary .ca-arch-metaval { font-size: 12.5px; }'), 'the v1.45.19 under-360px 1.5px value step survives the rebuild');
    const metLbls = [...salRow.querySelectorAll('.ca-arch-metalabel')].map((l) => l.textContent.trim());
    R.ok(metLbls.join('|') === 'Basic|Fixed|After-hours|COP', 'v1.45.20: MIDNIGHTS is renamed AFTER-HOURS (small muted uppercase inherited)');
    const metIcos = [...salRow.querySelectorAll('.ca-arch-metalabel > i, .ca-arch-metalabel .ca-arch-metipair > i')].map((i) => i.getAttribute('data-lucide'));
    R.ok(metIcos.join(',') === 'circle-dollar-sign,shirt,car-front,car-taxi-front,plane', 'the icon map: Basic circle-dollar-sign, Fixed shirt+car-front pair, After-hours car-taxi-front, COP plane');
    R.ok(salRow.querySelectorAll('.ca-arch-metalabel i.w-3\.h-3\.5, .ca-arch-metalabel i[class*="w-3.5"]').length === 5, 'every icon renders at the uniform 14px (w-3.5 h-3.5)');
    R.eq(salRow.querySelectorAll(':scope > div').length, 4, 'four stat cells - Basic, Fixed, Midnights, COP');
    R.ok(!d.getElementById('ca-arch-legend').classList.contains('hidden'), 'the Year-by-Year legend shows in salary view');
    // the list: month cards, solid pills, the money column (salary mode is
    // where the net/gross column earns its keep)
    const groups = d.querySelectorAll('.ca-arch-group');
    R.ok(groups.length >= 2, 'every month rides its own rounded surface card');
    const headOf2 = (mk) => d.querySelector('.ca-arch-group-head[data-mk=\"' + mk + '\"]');
    // v1.45.16 (owner order): the text status badges are gone - the state
    // rides a Lucide icon beside the title and the word rides the count line
    const octTitle = headOf2('2026-10').querySelector('.text-\\[17px\\]');
    R.ok(octTitle.nextElementSibling && octTitle.nextElementSibling.getAttribute('data-lucide') === 'refresh-cw', 'the live month wears the refresh-cw icon immediately right of the title');
    R.ok(octTitle.nextElementSibling.className.indexOf('ca-arch-liveico') !== -1, 'the live icon carries the slow-spin class');
    R.ok(headOf2('2026-10').textContent.indexOf('In progress') !== -1, 'the live month keeps its status word (now in the count line)');
    const novTitle = headOf2('2026-11').querySelector('.text-\\[17px\\]');
    R.ok(novTitle.nextElementSibling && novTitle.nextElementSibling.getAttribute('data-lucide') === 'clock-arrow-up', 'the future month wears the clock-arrow-up icon');
    R.ok(headOf2('2026-11').textContent.indexOf('Upcoming') !== -1, 'the future month keeps its status word');
    R.ok(!src.includes('ca-arch-badge-prog'), 'the status badge family is gone from src (Best/Low accolades stay)');
    const aRow = headOf2('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-row');
    R.eq(aRow.children.length, 3, 'v1.45.14: a ledger row is three structural parts - route block, value, \u2715 slot');
    R.ok(aRow.children[0].classList.contains('ca-arch-rowmain') && aRow.children[2].classList.contains('ca-arch-del'), 'the route block leads, the delete \u2715 closes the row');
    const amt = headOf2('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-amt');
    R.ok(amt.className.indexOf('flex-col') !== -1 && amt.className.indexOf('items-end') !== -1, 'the money block is a right-aligned column');
    R.ok(amt.querySelector('.ca-arch-amt-net') && amt.textContent.indexOf('net ') !== -1 && amt.textContent.indexOf('gross ') !== -1, 'net rides over gross inside the column');
    R.ok(amt.querySelector('.ca-arch-amt-net').className.indexOf('text-[17px]') !== -1 && amt.children[1].className.indexOf('text-sm') !== -1, 'net keeps the 17px figure, gross the quieter 14px line - baselines pair with the month and count lines');
    d.querySelector('.ca-arch-seg[data-mode=\"cop\"]').click(); await wait(150);
    R.ok(d.getElementById('ca-arch-legend').classList.contains('hidden'), 'the legend steps aside in COP view');
    void w; void d;
  }

  // ---- v1.45.14: the Month fallback never looks ahead of the calendar ----
  // (owner bug report: the fresh-open landed on the UPCOMING month's
  // Still-to-fly notice instead of the current month - a pre-saved future
  // month used to win the "newest entry" race in archScopeInfo)
  {
    const NOW3 = '2026-10-26T12:00:00+08:00';
    const ent = (id, mk, date) => ({ id, savedAt: date + 'T10:00:00Z', monthKey: mk, sectorDate: date, stationDisplay: 'SIN/KUL', amount: 100, flightType: 'Turnaround' });
    // current month empty, September past, November pre-saved (the newest save)
    {
      const { w, d } = await boot(APP, { now: NOW3 });
      w.localStorage.setItem('crewAssist.archive', JSON.stringify([
        ent('s1', '2026-09', '2026-09-20'),
        ent('n1', '2026-11', '2026-11-02')
      ]));
      w.showArchiveOverlay(); await wait(150);
      const mks = [...d.querySelectorAll('.ca-arch-group-head')].map((h) => h.getAttribute('data-mk'));
      R.ok(mks.indexOf('2026-09') !== -1 && mks.indexOf('2026-11') === -1, 'v1.45.14: the fresh Month open falls back to the newest PAST month, never the pre-saved future one');
      R.ok(!d.querySelector('.ca-arch-proj-btn'), 'the upcoming month\u2019s Still-to-fly notice is not the landing view');
    }
    // only future data on file: the scope stays on the current month
    {
      const { w, d } = await boot(APP, { now: NOW3 });
      w.localStorage.setItem('crewAssist.archive', JSON.stringify([ent('n1', '2026-11', '2026-11-02')]));
      w.showArchiveOverlay(); await wait(150);
      R.ok(!d.querySelector('.ca-arch-group-head[data-mk="2026-11"]'), 'v1.45.14: with only future data the Month scope stays on the current month (honest zero, no upcoming landing)');
      R.ok(d.querySelector('.ca-arch-seg[data-scope="month"]').classList.contains('ca-arch-segon'), 'the Month pill stays selected');
    }
    // the current month with data still wins outright
    {
      const { w, d } = await boot(APP, { now: NOW3 });
      w.localStorage.setItem('crewAssist.archive', JSON.stringify([
        ent('o1', '2026-10', '2026-10-05'),
        ent('n1', '2026-11', '2026-11-02')
      ]));
      w.showArchiveOverlay(); await wait(150);
      R.ok(d.querySelector('.ca-arch-group-head[data-mk="2026-10"]') && !d.querySelector('.ca-arch-group-head[data-mk="2026-11"]'), 'the current month with data is the landing, future saves wait their turn');
    }
  }

  // ---- v1.45.15: the still-to-fly notice is roster-aware (owner report:
  // the notice lived only on the pre-saved upcoming month, never on the
  // current month - its remaining flights were on the roster, not saved) ----
  {
    const NOW4 = '2026-10-26T12:00:00+08:00';
    const seedUp = (x) => {
      x.localStorage.setItem('crewAssist.archive', JSON.stringify([
        { id: 'o1', savedAt: '2026-10-05T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-05', stationDisplay: 'KTM', amount: 300, endAt: Date.parse('2026-10-05T20:00:00+08:00') },
        { id: 'n1', savedAt: '2026-10-25T10:00:00Z', monthKey: '2026-11', sectorDate: '2026-11-02', stationDisplay: 'NRT', amount: 500 }
      ]));
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify({
        '2026-10': [
          { fn: '322', dep: 'SIN', arr: 'AMD', ymd: '2026-10-31', std: '07:00', sta: '10:00', stdYmd: '2026-10-31', staYmd: '2026-10-31' },
          { fn: '323', dep: 'AMD', arr: 'SIN', ymd: '2026-10-31', std: '12:00', sta: '18:00', stdYmd: '2026-10-31', staYmd: '2026-10-31' }
        ]
      }));
    };
    const { w, d } = await boot(APP, { now: NOW4, seed: seedUp });
    w.showArchiveOverlay(); await wait(150);
    const head4 = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    R.ok(!!head4('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn'), 'v1.45.15: the CURRENT month carries the still-to-fly notice while its roster has legs ahead');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'On track', 'the context label stays On track (not Month complete)');
    R.ok(d.getElementById('ca-arch-m-ctx').textContent.indexOf('2 roster flights still to fly') !== -1, 'the context names the roster flights still to fly');
    head4('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-proj-btn').click(); await wait(150);
    const octWrap = head4('2026-10').closest('.ca-arch-group').querySelector('.ca-arch-proj-wrap');
    R.ok(octWrap.textContent.indexOf('Remaining flights') !== -1 && octWrap.textContent.indexOf('1 flight completed \u00b7 2 left') !== -1, 'v1.45.18: the panel counts history (1 landed entry) vs the schedule (2 roster legs)');
    R.ok(octWrap.textContent.indexOf('$0.00') === -1 && octWrap.textContent.indexOf('$') === -1, 'roster-only legs carry no dollar - none is ever guessed');
    // every scope shows the current month's notice
    for (const sc of ['all', 'year']) {
      d.querySelector('.ca-arch-seg[data-scope="' + sc + '"]').click(); await wait(150);
      const btns = [...d.querySelectorAll('.ca-arch-proj-btn')].map((b) => b.getAttribute('data-mk'));
      R.ok(btns.indexOf('2026-10') !== -1 && btns.indexOf('2026-11') !== -1, 'v1.45.15: ' + sc + '-time shows the notice on the current month AND the pre-saved upcoming one');
    }
    // the upcoming month's saved story is unchanged
    const novG = head4('2026-11').closest('.ca-arch-group');
    novG.querySelector('.ca-arch-proj-btn').click(); await wait(150);
    R.ok(novG.querySelector('.ca-arch-proj-wrap').textContent.indexOf('Remaining flights') !== -1 && novG.querySelector('.ca-arch-proj-wrap').textContent.indexOf('0 flights completed \u00b7 1 left') !== -1 && novG.querySelector('.ca-arch-proj-wrap').textContent.indexOf('$500.00') !== -1, 'the pre-saved upcoming month keeps its dollar story');
    // a past month is untouched by the roster (ymd >= today excludes it)
    R.ok(!head4('2026-09'), 'no phantom past group');
    void w;
  }

  // ---- v1.45.16: the state icons + count-line status + the daylight
  // active pill (owner order: the badges wrapped the header; the active
  // pill read invisible by day) ----
  {
    const { w, d } = await boot(APP, { now: '2026-10-26T12:00:00+08:00' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 's0', savedAt: '2026-08-05T10:00:00Z', monthKey: '2026-08', sectorDate: '2026-08-05', stationDisplay: 'SIN/KUL', amount: 100 },
      { id: 's1', savedAt: '2026-09-05T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', stationDisplay: 'SIN/BKK', amount: 120 },
      { id: 's2', savedAt: '2026-10-08T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-08', stationDisplay: 'SIN/NRT', amount: 300 },
      { id: 's3', savedAt: '2026-10-25T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-31', stationDisplay: 'SIN/AMD', amount: 200 },
      { id: 's4', savedAt: '2026-10-25T10:00:00Z', monthKey: '2026-11', sectorDate: '2026-11-15', stationDisplay: 'SIN/HKT', amount: 500 }
    ]));
    w.showArchiveOverlay(); await wait(150);
    d.querySelector('.ca-arch-seg[data-scope="all"]').click(); await wait(150);
    const head5 = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    const subOf = (mk) => head5(mk).querySelector('.block.text-sm').textContent.replace(/\s+/g, ' ').trim();
    R.eq(subOf('2026-10'), '2 flights \u2022 In progress', 'the live month counts its flights then names its state (owner format)');
    R.eq(subOf('2026-11'), '1 flight \u2022 Upcoming', 'the future month rides the owner format too');
    R.ok(subOf('2026-09').indexOf('\u2022') === -1, 'history carries no state suffix - no icon asset, no word');
    const titleOf = (mk) => head5(mk).querySelector('.text-\\[17px\\]');
    R.ok(!titleOf('2026-09').nextElementSibling, 'a past month renders no state icon at all');
    R.ok(titleOf('2026-10').nextElementSibling.getAttribute('data-lucide') === 'refresh-cw' && titleOf('2026-10').nextElementSibling.getAttribute('style').indexOf('--ca-gold') !== -1, 'the live icon is a refresh-cw in the signature gold');
    R.ok(titleOf('2026-11').nextElementSibling.getAttribute('data-lucide') === 'clock-arrow-up' && titleOf('2026-11').nextElementSibling.getAttribute('style').indexOf('--arch-muted') !== -1, 'the upcoming icon is a muted clock-arrow-up');
    R.ok(head5('2026-10').classList.contains('items-center'), 'the head row keeps its uniform centre axis (items-center)');
    // the completed word survives for an all-flown current month (October,
    // everything landed, nothing on the roster)
    w.eval("localStorage.setItem('crewAssist.archive', JSON.stringify([JSON.parse(localStorage.getItem('crewAssist.archive'))[2]]))");
    w.closeArchOverlay(); w.showArchiveOverlay(); await wait(150);
    R.ok(subOf('2026-10') === '1 flight \u2022 Completed' && !head5('2026-10').querySelector('i[data-lucide="refresh-cw"], i[data-lucide="clock-arrow-up"]'), 'an all-flown current month reads Completed in the count line, icon-free (accolade badges may still follow the title)');
    void w;
  }
  // ---- v1.45.16 src pins: the spin, the reduced-motion gate, the daylight
  // active pill ----
  {
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('@keyframes caArchLive { to { transform: rotate(1turn); } }'), 'the live icon spins a full turn');
    R.ok(src.includes('.ca-arch-liveico { animation: caArchLive 6s linear infinite; }'), 'the spin is the slowed 6s ambient loop');
    R.ok(src.includes('html.ca-reduced .animate-bounce, html.ca-reduced .ca-arch-liveico {'), 'the ambient loop stops behind the ca-reduced gate');
    R.ok(src.includes('html:not(.dark) #ca-arch-summary .ca-arch-seg:not(.ca-arch-segon) { color: #2D1E0F; }'), 'v1.45.16: the daylight walnut rule EXCLUDES the active pill (the invisibility root cause)');
    R.ok(src.includes('html:not(.dark) #ca-arch-summary .ca-arch-seg.ca-arch-segon { background: #FFFFFF; color: #2D1E0F; }'), 'the daylight active pill is crisp white with walnut ink');
    R.ok(src.includes('.ca-arch-seg.ca-arch-segon { background: var(--ca-arch-ink-on-gold); color: var(--ca-arch-ink-gold); }'), 'the night active pill keeps its espresso fill and clean gold ink');
  }

  // ---- v1.45.17: the milestone block + the daylight search placeholder ----
  {
    const { w, d } = await boot(APP, { now: '2026-10-26T12:00:00+08:00' });
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'm1', savedAt: '2026-10-05T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-05', stationDisplay: 'SIN/KUL', amount: 300 },
      { id: 'm2', savedAt: '2026-10-20T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-31', stationDisplay: 'SIN/NRT', amount: 696.91 }
    ]));
    w.showArchiveOverlay(); await wait(150);
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Remaining to earn', 'the label element carries the new professional string (source title-case, CSS uppercases)');
    const ctx = d.getElementById('ca-arch-m-ctx');
    R.ok(ctx.innerHTML.indexOf('data-lucide="target"') !== -1 && ctx.innerHTML.indexOf('w-3.5 h-3.5 shrink-0') !== -1, 'the bullseye icon and its size classes survive untouched');
    R.ok(ctx.textContent.indexOf('$696.91 before end of month') !== -1, 'the owner format verbatim: remainder before end of month');
    R.ok(ctx.textContent.indexOf('left') === -1 && ctx.textContent.indexOf('On track for') === -1, 'the old two-part layout is gone completely');
    R.ok(ctx.className.indexOf('flex items-center gap-2') !== -1, 'the inline centre baseline with the icon stays (flex items-center gap-2)');
    // the neighbouring states are untouched (roster-only needs the saved
    // future entry gone, or the milestone branch wins)
    w.eval("localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 'm1', savedAt: '2026-10-05T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-05', stationDisplay: 'SIN/KUL', amount: 300 }])); localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-10': [{ fn: '322', dep: 'SIN', arr: 'AMD', ymd: '2026-10-31', std: '07:00', sta: '10:00' }] }))");
    w.closeArchOverlay(); w.showArchiveOverlay(); await wait(150);
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'On track', 'the roster-only case keeps its On track label (the salary branch and Month complete untouched)');
    R.ok(d.getElementById('ca-arch-m-ctx').textContent.indexOf('roster flight') !== -1, 'the roster-only milestone keeps its plane line');
    // the daylight placeholder ink
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('html:not(.dark) .ca-arch-search::placeholder { color: #6B7280; opacity: 1; }'), 'v1.45.17: the daylight placeholder reads dark slate #6B7280 (opacity pinned across engines)');
    R.ok(src.indexOf('html:not(.dark) .ca-arch-search::placeholder') < src.indexOf('/* v1.29.0: two-tap armed state'), 'the placeholder rule rides the earnings CSS block');
    void w;
  }

  process.exit(R.done() ? 1 : 0);
})();
