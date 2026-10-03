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
    R.ok(/Entries appear when you tap Save on a calculation/.test(listTxt) && /import a JSON backup with the arrow above/.test(listTxt), 'v1.37.0: the empty state names both ways to fill it in mental-model order');
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
    // tall summaries: the sheet is bounded + scrollable and opens at the TOP
    const sheetEl = d.getElementById('ca-arch-sub-sheet');
    R.ok(sheetEl.classList.contains('overflow-y-auto'), 'summary sheet is scrollable');
    R.ok(Array.from(sheetEl.classList).some(c => c.indexOf('max-h-') === 0), 'summary sheet is height-bounded');
    R.eq(sheetEl.scrollTop, 0, 'opens at the top, never auto-scrolled to the bottom');
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
    R.eq(d.querySelectorAll('.ca-arch-iconbtn').length, 4, 'four header icon buttons');
    R.eq(d.querySelectorAll('#ca-arch-summary .ca-arch-seg').length, 3, 'three segmented scope buttons');
    const segOf = (scope) => d.querySelector('#ca-arch-summary .ca-arch-seg[data-scope="' + scope + '"]');
    R.ok(['month', 'year', 'all'].every((s) => !!segOf(s)), 'segmented buttons: month / year / all');
    R.ok(segOf('all').classList.contains('ca-arch-segon'), 'All-time is the default scope');

    // -- all-time gold card: $7,423.23 across 19 flights
    R.eq(d.getElementById('ca-arch-total').textContent, '$7,423.23', 'all-time total');
    R.eq(d.getElementById('ca-arch-m-flights').textContent, '19', 'all-time flight count');
    R.eq(d.getElementById('ca-arch-m-avg').textContent, '$390.70', 'all-time average per flight');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'Context', 'all-time context label');
    const ctxAll = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxAll.textContent.indexOf('\u221228.6% vs LY') !== -1, 'current month down vs last year (real minus sign)');
    R.ok(ctxAll.textContent.indexOf('proj. ' + fm(projTotal)) !== -1, 'all-time context carries the month projection');
    R.ok(ctxAll.innerHTML.indexOf('trending-down') !== -1, 'down trend icon on the context line');

    // -- 12-month chart: oldest left, stub month, projection segment, peak
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
    R.ok(headOf('2026-09').querySelector('.ca-arch-badge-prog') && headOf('2026-09').textContent.indexOf('In progress') !== -1, 'In progress badge on the current month');
    const up = d.querySelectorAll('.ca-arch-yoy-up'), down = d.querySelectorAll('.ca-arch-yoy-down');
    R.eq(up.length, 1, 'one YoY arrow in the list');
    R.ok(up[0].closest('.ca-arch-group-head').getAttribute('data-mk') === '2026-08' && up[0].textContent.indexOf('100.0%') !== -1, 'Aug 2026 up 100.0% vs Aug 2025');
    R.eq(down.length, 0, 'no down arrows in this seed');
    const sepBody = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    R.ok(sepBody.querySelector('.ca-arch-dot-hollow') && sepBody.textContent.indexOf('Projected \u00b7 ' + projFlights + ' flight' + (projFlights === 1 ? '' : 's')) !== -1 && sepBody.textContent.indexOf(fm(projTotal)) !== -1, 'partial month shows a hollow-dot projected row');
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
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, 'On track', 'partial month context label');
    const ctxM = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxM.textContent.indexOf('On track for ' + fm(projTotal) + ' \u00b7 ' + fm(projLeft) + ' left') !== -1, 'on-track projection with what is left to earn');
    R.ok(ctxM.innerHTML.indexOf('target') !== -1, 'on-track context uses the target icon');
    R.eq(d.querySelectorAll('.ca-arch-group').length, 13, 'month scope never narrows the month list');
    R.eq(d.querySelectorAll('.ca-arch-row').length, 19, 'month scope keeps every row visible');
    segOf('year').click();
    await wait(50);
    R.eq(d.getElementById('ca-arch-total').textContent, '$5,123.23', 'year scope totals 2026');
    R.eq(d.getElementById('ca-arch-m-flights').textContent, '14', 'year scope flight count');
    R.eq(d.getElementById('ca-arch-m-avg').textContent, '$365.94', 'year scope average');
    R.eq(d.getElementById('ca-arch-m-ctx-label').textContent, '2026 YTD', 'year context label');
    const ctxY = d.getElementById('ca-arch-m-ctx');
    R.ok(ctxY.textContent.indexOf('+122.7% vs LY') !== -1, 'year YoY vs the whole of 2025');
    R.ok(ctxY.innerHTML.indexOf('trending-up') !== -1, 'year context uses the up icon');
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
    R.ok(headOf('2025-09').textContent.indexOf('$360.72') !== -1 && headOf('2025-09').textContent.indexOf('of $700.00') !== -1, 'filtered month shows its share of the full month');
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

    // --- v1.27.0 backup nudge ---
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'A', savedAt: '2026-08-02T10:00:00Z', monthKey: '2026-08', sectorDate: '2026-08-02', stationDisplay: 'SIN/ICN', amount: 100 },
      { id: 'B', savedAt: '2026-09-05T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-05', stationDisplay: 'SIN/HND', amount: 200 }
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
    // exporting a JSON backup stamps it and clears the card
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
    w.eval("archDoExport('json')");
    R.ok(Number(w.localStorage.getItem('crewAssist.lastBackupAt')) > Date.now() - 60000, 'JSON export stamps lastBackupAt');
    w.eval('renderArch()');
    R.ok(!d.getElementById('ca-arch-backup-nudge'), 'fresh export → no nudge');
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
    const headOf = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
    const bodyOf = (mk) => headOf(mk).closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    R.ok(headOf('2026-09').textContent.indexOf('Completed') !== -1, 'fully-flown current month reads Completed');
    R.ok(!bodyOf('2026-09').querySelector('.ca-arch-dot-hollow'), 'no projected row once every flight has landed');
    R.ok(headOf('2026-10').textContent.indexOf('Upcoming') !== -1, 'future month with saved flights reads Upcoming');
    R.ok(bodyOf('2026-10').querySelector('.ca-arch-dot-hollow') && bodyOf('2026-10').textContent.indexOf('Projected \u00b7 1 flight') !== -1 && bodyOf('2026-10').textContent.indexOf('$400.00') !== -1, 'upcoming month shows its projected schedule');
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
    R.ok(/html:not\(\.dark\) #app-dialog-backdrop \.glass-bubble\s*{[^}]*rgba\(246, 241, 232, 0\.96\)/.test(src), 'the alert/confirm pop-up gets the cream card in light mode');
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
    R.ok(ctxM.textContent.indexOf('On track for $500.00') !== -1 && ctxM.textContent.indexOf('$200.00 left') !== -1, 'the landed duty counts as earned, the airborne one as left');
    const body = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    R.ok(body.textContent.indexOf('Projected') !== -1, 'the un-landed duty still projects');
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
    const body = headOf('2026-09').closest('.ca-arch-group').querySelector('.ca-arch-group-body');
    R.ok(!body.querySelector('.ca-arch-dot-hollow'), 'no projected row once the day\u2019s duties have landed');
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
  process.exit(R.done() ? 1 : 0);
})();
