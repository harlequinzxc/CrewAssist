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
    const { w, d } = await boot(APP);
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
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete 1 entry') !== -1, 'dialog message wording');
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
    R.ok(/Run a COP calculation and hit save or tap the import arrow/.test(listTxt), 'empty state names both ways to fill it');
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
    const { w, d } = await boot(APP);
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
      seedEntry('A20', '2026-09-20', 'HKT', 200, 'Turnaround')
    ]));
    w.showArchiveOverlay();
    await wait(150);

    // Date anchor: the seed and expected figures below assume the run happens
    // inside a partial September 2026 (same anchor the whole suite shares).
    const now = new Date();
    const ymdNow = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    R.ok(ymdNow.slice(0, 7) === '2026-09', 'run date anchors to Sep 2026 (reseed if the anchor month drifts)');
    R.ok(now.getDate() < 30, 'current month still partial');
    const tnum = now.getDate();
    const fm = (n) => { const x = Number(n); const s = x < 0 ? '-' : ''; const p = Math.abs(x).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return s + '$' + p[0] + '.' + p[1]; };
    const sepTotal = 500, sepFlights = 2, sepDays = 30;
    const projTotal = Math.round(((sepTotal / tnum) * sepDays) * 100) / 100;
    const projLeft = Math.max(0, projTotal - sepTotal);
    const projFlights = Math.round((sepFlights / tnum) * sepDays);
    const barPx = Math.round(120 * sepTotal / 1000);
    const fullPx = Math.round(120 * projTotal / 1000);
    const projPx = Math.max(0, Math.min(fullPx - barPx, 120 - barPx));

    // -- sheet chrome: handle, header icon buttons, segmented control
    R.ok(d.querySelector('#ca-arch-sheet .w-\\[44px\\].h-\\[4px\\]'), 'iOS-style sheet handle pill');
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
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete 6 entries') !== -1, 'trash counts only the search-visible entries');
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

  // everything-moves ruling: the insights panel and search clear animate
  {
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('.ca-arch-insights { overflow: hidden; max-height: 0; opacity: 0; margin-top: 0; transition: max-height .3s ease, opacity .3s ease, margin-top .3s ease; }'), 'insights panel has the expand/collapse transition');
    R.ok(src.includes('transition-opacity duration-200'), 'search clear button fades');
  }

  process.exit(R.done() ? 1 : 0);
})();
