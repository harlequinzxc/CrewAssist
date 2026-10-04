// Roster calendar (v1.39.0 B6 + hotfix 3): the parser reads the roster's Duty
// column — flying days, layover days with their station, the OFF family,
// annual leave, standby and course codes — into a duty-day store, and the
// header's calendar icon opens the owner-spec pill grid: no cell chrome,
// duty runs as pills behind the numbers (circle for one day, one seamless
// capsule for a run), the today bar beneath the number, tap-to-select with
// the detail section below the divider, and arrows only where a data month
// exists beyond.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
const path = require('path');

// Synthetic PDF items: the roster's rotated table (x = row, y = column).
// Columns: Start Date 21, Day 65, Flight 91, Sector 138, A/C 183, Duty 210,
// Rank 298, Rpt 328, STD 358, STA 388, FT 421.
const row = (x, cells) => cells.map(c => ({ str: c[1], x, y: c[0], page: 1 }));
const synthItems = [].concat(
    row(150, [[21, 'Start Date'], [65, 'Day'], [91, 'Flight'], [138, 'Sector'], [183, 'A/C'], [210, 'Duty'], [298, 'Rank'], [358, 'STD'], [388, 'STA'], [421, 'Flight'], [461, 'Duty'], [461, 'Time']]),
    row(180, [[21, '01Oct26'], [65, 'Thu'], [91, 'SQ 106'], [134, 'SIN-KUL'], [211, 'FLY'], [358, '0825'], [388, '0935']]),
    row(202, [[91, 'SQ 105'], [134, 'KUL-SIN'], [211, 'FLY'], [358, '1025'], [388, '1145']]),
    row(224, [[21, '02Oct26'], [65, 'Fri'], [143, 'MEL'], [207, 'LO']]),
    row(246, [[21, '03Oct26'], [65, 'Sat'], [143, 'SIN'], [207, 'ATDO']]),
    row(268, [[21, '04Oct26'], [65, 'Sun'], [143, 'SIN'], [207, 'AALV']]),
    row(290, [[21, '05Oct26'], [65, 'Mon'], [143, 'SIN'], [208, 'SN80']]),
    row(312, [[21, '06Oct26'], [65, 'Tue'], [91, 'SQ 207'], [134, 'SIN-MEL'], [211, 'FLY'], [358, '0100'], [388, '0900']]),
    // 07Oct: the generator prints NO date on a layover continuation row
    row(334, [[143, 'MEL'], [214, 'LO']]),
    row(356, [[21, '08Oct26'], [65, 'Wed'], [91, 'SQ 218'], [134, 'MEL-SIN'], [211, 'FLY'], [358, '2300'], [388, '0455']]),
    // the Duty Codes legend page — its rows must never become days
    row(600, [[30, 'Duty'], [70, 'Duty'], [120, 'Duty Codes'], [180, 'Duty Desc'], [188, 'Duty']]).map(i => Object.assign(i, { page: 2 })),
    row(650, [[68, 'ATDO'], [166, 'AUTO TAG DAY OFF']]).map(i => Object.assign(i, { page: 2 })),
    row(700, [[72, 'FLY'], [128, 'FLYING']]).map(i => Object.assign(i, { page: 2 })),
    row(750, [[68, 'SN60'], [158, 'NB STANDBY 0600-2200']]).map(i => Object.assign(i, { page: 2 }))
);

(async () => {
  // ---- the parser: duty days, kinds, and the dateless carry-forward ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(synthItems) + ')');
    R.eq(w.eval('window.__p.flights.length'), 4, 'the flights pass is untouched by duty-day parsing');
    const days = JSON.parse(w.eval('JSON.stringify(window.__p.days)'));
    const byYmd = {}; days.forEach(d => { byYmd[d.ymd] = d; });
    R.eq(days.length, 8, 'every duty row becomes exactly one day');
    R.eq(byYmd['2026-10-01'].kind, 'fly', 'a flying row is a fly day');
    R.ok(JSON.stringify(byYmd['2026-10-01'].fns) === JSON.stringify(['106', '105']), 'the day carries its flight numbers');
    R.eq(byYmd['2026-10-02'].kind + '@' + byYmd['2026-10-02'].loc, 'lo@MEL', 'a dated LO row is a layover day with its station');
    R.eq(byYmd['2026-10-03'].kind, 'off', 'ATDO is an OFF day (the owner\u2019s code list)');
    R.eq(byYmd['2026-10-04'].kind, 'al', 'AALV is annual leave');
    R.eq(byYmd['2026-10-05'].kind + '[' + byYmd['2026-10-05'].code + ']', 'duty[SN80]', 'a standby code keeps its own label');
    R.eq(byYmd['2026-10-07'].kind + '@' + byYmd['2026-10-07'].loc, 'lo@MEL', 'a dateless LO row carries forward one day');
    R.ok(!byYmd['2026-10-09'] && !byYmd['2026-10-10'], 'the Duty Codes legend page never becomes days');
    // the OFF family, per the owner's list
    R.eq(w.eval("rosterParse([{str:'09Oct26',x:10,y:21,page:1},{str:'OFFD',x:10,y:207,page:1},{str:'EXDO',x:32,y:207,page:1},{str:'RQ99',x:54,y:207,page:1},{str:'RX99',x:76,y:207,page:1}].concat([{str:'Start Date',x:2,y:21,page:1},{str:'Duty',x:2,y:210,page:1}])).days.map(d=>d.kind).join(',')"), 'off,off,off,off', 'OFFD, EXDO, RQ99 and RX99 all read as OFF');
  }

  // ---- the store: month-replaced like the upcoming store ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [{ ymd: '2026-10-01', kind: 'off', code: 'OFFD', loc: '', fns: [] }] }));
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(synthItems) + ')');
    w.eval('upcomingRemember(window.__p)');
    const store = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    R.ok(store['2026-10'].length > 1, 'a re-import replaces the month it covers');
    R.ok(store['2026-10'].every(d => d.ymd.slice(0, 7) === '2026-10'), 'no day lands in the wrong month');
  }

  // ---- the real October 2026 roster: end-to-end honesty ----
  {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const file = path.resolve(__dirname, '../_inbox/October 2026.pdf');
    const data = new Uint8Array(fs.readFileSync(file));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
    const items = [];
    for (let pi = 1; pi <= doc.numPages; pi++) {
      const tc = await (await doc.getPage(pi)).getTextContent();
      tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
    }
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(items) + ')');
    R.eq(w.eval('window.__p.flights.length'), 15, 'the real October roster still parses its 15 flights');
    w.eval('upcomingRemember(window.__p)');
    const days = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    const oct = days['2026-10'];
    const nov = days['2026-11'] || [];
    const kind = (ymd) => { const dd = oct.find(x => x.ymd === ymd) || nov.find(x => x.ymd === ymd); return dd ? dd.kind + (dd.loc ? '@' + dd.loc : '') : 'none'; };
    R.eq(kind('2026-10-01'), 'fly', 'real: 1 Oct is the SQ 106/105 turnaround');
    R.eq(kind('2026-10-03'), 'off', 'real: an ATDO day reads OFF');
    R.eq(kind('2026-10-04'), 'duty', 'real: a standby code keeps its label');
    R.eq(kind('2026-11-01'), 'lo@AMD', 'real: the dateless layover continuation lands on 1 Nov');

    // ---- the calendar UI on real data (owner spec: the pill grid) ----
    w.eval('openRosterCalendar()');
    await wait(500);
    const wrap = d.getElementById('ca-roster-cal');
    R.ok(wrap && !wrap.classList.contains('hidden'), 'the header calendar opens the sheet');
    // hotfix regression (owner report): the sheet once lived INSIDE the archive
    // sub-sheet wrapper — its own hidden class was gone, but the wrapper's kept
    // it blind. Visibility is asserted through the whole ancestor chain.
    R.ok(wrap && wrap.closest('.hidden') === null, 'no hidden ancestor keeps the calendar blind');
    R.ok(wrap && !wrap.closest('#ca-arch-sub') && !wrap.closest('#ca-arch-sheet'), 'the calendar sheet is never nested inside another sheet');
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('October 2026') === 0, 'it opens on the current month');
    const src = fs.readFileSync(APP, 'utf8');
    const cells = Array.from(d.querySelectorAll('.ca-rc-day[data-ymd]'));
    R.eq(cells.length, 31, 'every day of the month is a tappable cell — duty or not');
    R.ok(src.indexOf('.ca-rc-cell') < 0 && src.indexOf('ca-rc-chip') < 0, 'no cell borders, no cell backgrounds, no text chips — the columns carry the structure');
    R.ok(src.indexOf('id="ca-rc-legend"') < 0, 'the legend is gone (owner order)');
    R.ok(!!d.getElementById('ca-rc-detail'), 'the detail section lives below the divider');
    R.ok(src.indexOf('@media (hover:hover) { .ca-rc-day:hover') >= 0, 'hover states live behind a real-pointer media query');
    R.ok(src.indexOf('.ca-rc-day:active { transform: scale(.92); }') >= 0, 'day cells give immediate press feedback');
    R.ok(src.indexOf('data-lucide="chevron-left"') >= 0 && src.indexOf('data-lucide="chevron-right"') >= 0, 'the chevrons are Lucide icons');
    // ---- pills: shapes, kinds, and the OFF day's plainness ----
    const pills = Array.from(d.querySelectorAll('.ca-rc-pill'));
    R.ok(pills.length > 10, 'duty days render pills behind the numbers');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && p.getAttribute('style').indexOf('calc(2.5 * 100% / 7)') >= 0), 'a single-day flying duty (27 Oct, col 2) is a gold circle centered on its column');
    const cap = pills.find(p => p.className.indexOf('is-capsule') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && p.getAttribute('style').indexOf('calc(5 * 100% / 7 + 3px)') >= 0);
    R.ok(!!cap && cap.getAttribute('style').indexOf('999px 999px 999px 999px') >= 0, 'the 1–2 Oct flying run is ONE capsule, rounded only at its true ends');
    R.ok(pills.some(p => p.className.indexOf('ca-rc-k-duty') >= 0 && p.getAttribute('style').indexOf('calc(2 * 100% / 7 + 3px)') >= 0), 'the 6–7 Oct standby run gets its own blue capsule');
    const weekRows = d.querySelectorAll('#ca-rc-grid .relative.grid');
    R.eq(weekRows[0].querySelectorAll('.ca-rc-pill').length, 1, 'the OFF day (3 Oct) shows no pill — only its plain number');
    // ---- the today bar ----
    const todayCell = cells.find(c => c.getAttribute('data-ymd') === '2026-10-04');
    R.ok(todayCell && !!todayCell.querySelector('.ca-rc-bar.is-today'), 'today is marked by the short accent bar beneath its number');
    R.ok(cells.every(c => !!c.querySelector('.ca-rc-bar')), 'every cell keeps the bar slot — the indicator reads on duty days and off days alike');
    // ---- selection + the detail section ----
    R.ok(todayCell.classList.contains('is-selected'), 'opening the calendar selects today');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('SSS3') >= 0, 'the detail section retells the selected day');
    const future = cells.find(c => c.getAttribute('data-ymd') === '2026-10-27');
    const cardsBefore = d.querySelectorAll('[data-calc-card]').length;
    future.click();
    await wait(300);
    R.ok(future.classList.contains('is-selected'), 'tapping a day selects it');
    R.eq(d.querySelectorAll('[data-calc-card]').length, cardsBefore, 'selecting a flying day never builds a calculator card');
    R.ok(d.getElementById('ca-arch-sub').classList.contains('hidden'), 'no popup — the day\u2019s details live in the section below the divider');
    const det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 164') >= 0 && det.indexOf('SQ 163') >= 0, 'the detail names every leg of the duty');
    R.ok(det.indexOf('Turnaround') >= 0, 'a same-day out-and-back reads Turnaround');
    R.ok(det.indexOf('SIN \u2192 SAI \u2192 SIN') >= 0, 'the detail shows the full route');
    R.ok(det.indexOf('0840H') >= 0 && det.indexOf('0955H') >= 0, 'times read in the 24-hour HHMMH house format');
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-03').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('OFF') >= 0, 'an OFF day says so in the detail section');
    // a saved duty offers its earnings entry from the detail section
    w.eval("persistArchive([{ id: 'e1', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-29', flightType: 'Layover', stationDisplay: 'HKT', amount: 318.55 }])");
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-29').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('318.55') >= 0, 'a saved duty shows its amount in the detail');
    d.querySelector('#ca-rc-detail [data-rc-open-entry]').click();
    await wait(400);
    R.ok(!d.getElementById('ca-arch-sub').classList.contains('hidden'), 'the saved entry opens from the detail section');
    w.eval('closeArchSub()');
    await wait(300);
    // ---- month navigation: bounded arrows, label, rebuild, selection reset ----
    R.ok(d.getElementById('ca-rc-prev').classList.contains('invisible'), 'no previous data month — the back arrow is not shown');
    R.ok(!d.getElementById('ca-rc-next').classList.contains('invisible'), 'November holds roster days — the forward arrow shows');
    d.getElementById('ca-rc-next').click();
    await wait(500);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('November 2026') === 0, 'the month/year label follows the chevron');
    R.ok(d.querySelectorAll('.ca-rc-day[data-ymd="2026-10-27"]').length === 0, 'the grid rebuilds when the month changes');
    const novSel = d.querySelector('.ca-rc-day.is-selected');
    R.ok(novSel && novSel.getAttribute('data-ymd') === '2026-11-01', 'a month without today resets the selection to its first day');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('AMD') >= 0, '1 Nov reads as the AMD layover in the detail');
    R.ok(d.getElementById('ca-rc-next').classList.contains('invisible'), 'no month after November — the forward arrow is not shown');
    d.getElementById('ca-rc-prev').click();
    await wait(500);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('October 2026') === 0, 'the back chevron returns to October');
    R.ok(d.querySelector('.ca-rc-day.is-selected').getAttribute('data-ymd') === '2026-10-04', 'a month holding today reselects today');
    // Escape closes the sheet
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
    R.ok(wrap.classList.contains('hidden'), 'Escape closes the roster calendar');
  }

  // ---- synthetic: a layover run that wraps a week and crosses a month ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      const lo = (ymd) => ({ ymd: ymd, kind: 'lo', code: '', loc: 'NRT', fns: [] });
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({
        '2026-10': [lo('2026-10-26'), lo('2026-10-27'), lo('2026-10-28'), lo('2026-10-29'), lo('2026-10-30'), lo('2026-10-31'), { ymd: '2026-10-08', kind: 'fly', code: '', loc: '', fns: ['999'] }],
        '2026-11': [lo('2026-11-01'), lo('2026-11-02')]
      }));
    } });
    w.eval('openRosterCalendar()');
    await wait(500);
    // week 4 holds 25–31 Oct: the six-day layover is ONE capsule, rounded on
    // Monday and flush at the Saturday edge — the run continues past it
    const w4 = d.querySelectorAll('#ca-rc-grid .relative.grid')[4];
    const seg1 = w4 ? Array.from(w4.querySelectorAll('.ca-rc-pill')) : [];
    R.ok(seg1.length === 1 && seg1[0].className.indexOf('ca-rc-k-lo') >= 0, 'the six-day layover is one teal capsule in its week row');
    R.ok(seg1[0].getAttribute('style').indexOf('calc(1 * 100% / 7 + 3px)') >= 0, 'it starts rounded on the Monday');
    R.ok(seg1[0].getAttribute('style').indexOf('999px 0 0 999px') >= 0, 'it ends flush at the week edge — the run continues');
    // November: the run continues flush from the left edge, rounding off at its true end
    d.getElementById('ca-rc-next').click();
    await wait(500);
    const novRow = d.querySelectorAll('#ca-rc-grid .relative.grid')[0];
    const seg2 = novRow ? Array.from(novRow.querySelectorAll('.ca-rc-pill')) : [];
    R.ok(seg2.length === 1 && seg2[0].getAttribute('style').indexOf('calc(0 * 100% / 7)') >= 0, 'a run wrapped from October continues flush from the left edge');
    R.ok(seg2[0].getAttribute('style').indexOf('0 999px 999px 0') >= 0, '…and rounds off at its true end on 2 Nov');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('NRT') >= 0, '1 Nov reads as the NRT layover');
    // a fly day the parser never timed says so honestly; a no-duty today keeps its bar
    d.getElementById('ca-rc-prev').click();
    await wait(500);
    const cells = Array.from(d.querySelectorAll('.ca-rc-day[data-ymd]'));
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-08').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('no leg times') >= 0, 'a fly day without parsed legs says so honestly');
    const todayCell = cells.find(c => c.getAttribute('data-ymd') === '2026-10-04');
    R.ok(todayCell && !!todayCell.querySelector('.ca-rc-bar.is-today'), 'the today bar shows even on a day with no duty at all');
    const w1 = d.querySelectorAll('#ca-rc-grid .relative.grid')[1];
    R.eq(w1.querySelectorAll('.ca-rc-pill').length, 1, 'no-duty days render no pills');
    R.ok(w1.querySelectorAll('.ca-rc-pill')[0].className.indexOf('is-circle') >= 0, 'a lone fly day renders as a circle');
  }

  // ---- a clean device: honest empty state, driven by the real button ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    let idleOk = false;
    for (let t = 0; t < 50 && !idleOk; t++) { await wait(200); idleOk = !!w.eval('!isChatBusy()'); }
    d.getElementById('btn-roster-cal').click();
    await wait(500);
    const wrapClean = d.getElementById('ca-roster-cal');
    R.ok(wrapClean && !wrapClean.classList.contains('hidden') && wrapClean.closest('.hidden') === null, 'tapping the header icon opens the calendar — through the real click, no hidden ancestor');
    R.ok(!d.getElementById('ca-rc-sheet').classList.contains('translate-y-full'), 'the sheet has slid up');
    R.ok(d.querySelectorAll('.ca-rc-pill').length === 0, 'a clean device renders no pills');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('Nothing on the roster') >= 0, 'a day without duties says so in the detail');
    R.ok(d.getElementById('ca-rc-prev').classList.contains('invisible') && d.getElementById('ca-rc-next').classList.contains('invisible'), 'with a single month, neither arrow shows');
    w.eval('openRosterCalendar()');
    await wait(500);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar opens even with no roster');
    R.ok(d.getElementById('ca-rc-empty').textContent.indexOf('No roster for this month') === 0, 'a month without duties says so honestly');
    R.ok(fs.readFileSync(APP, 'utf8').indexOf('html.ca-tour-on #btn-roster-cal') >= 0, 'the tour locks the calendar button with the other chrome');
  }

  process.exit(R.done() ? 1 : 0);
})();
